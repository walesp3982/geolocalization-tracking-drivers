import datetime
import random
import string
import uuid
from typing import Annotated, Literal

from fastapi import APIRouter, Body, Header, HTTPException, Query, status
from geojson_pydantic import Feature, LineString
from pydantic import BaseModel, Field, field_validator
from sqlalchemy import func, select
from sqlalchemy.orm import selectinload

from src.api.deps import GetJefeGrupo
from src.database.models import AsignacionRuta, Conductor, Ruta
from src.depends import DatabaseSession
from src.jwt.security import hash_password

router = APIRouter(prefix="/jefe-grupo", tags=["Jefe de Grupo"])


class ConductorResponse(BaseModel):
    id_conductor: int
    name: str
    id_group: int
    code: str
    telefono: str | None
    activo: bool

    @staticmethod
    def from_model(c: Conductor) -> "ConductorResponse":
        return ConductorResponse(
            id_conductor=c.id_conductor,
            name=c.nombre,
            activo=c.activo,
            code=c.code,
            id_group=c.id_grupo,
            telefono=c.telefono,
        )


@router.get("/me")
async def get_info(jefe: GetJefeGrupo) -> ConductorResponse:
    return ConductorResponse.from_model(jefe)


def gen_code_chofer() -> str:
    alpha_part = "".join(random.choices(string.ascii_letters, k=4)).upper()
    numeric_part = "".join(random.choices(string.digits, k=4))
    return alpha_part + numeric_part


class NewConductor(BaseModel):
    nombre: str
    telefono: str
    password: str


@router.post("/conductores")
async def register_new_conductor(
    input: NewConductor,
    jefe: GetJefeGrupo,
    session: DatabaseSession,
    idempotency_key: Annotated[uuid.UUID, Header()],
) -> ConductorResponse:

    ## First search idempotency key in db
    stmt = select(Conductor).where(Conductor.idempotency_key == idempotency_key)

    if await session.scalar(stmt):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Error duplicated idempotency key",
        )
    # Hashing passowrd
    hashed = hash_password(input.password)

    new_chofer = Conductor(
        code=gen_code_chofer(),
        telefono=input.telefono,
        password=hashed,
        id_grupo=jefe.id_grupo,
        nombre=input.nombre,
        idem_key=idempotency_key,
    )

    session.add(new_chofer)

    await session.flush([new_chofer])

    return ConductorResponse.from_model(new_chofer)


class QueryConductores(BaseModel):
    pattern_name: str | None = None
    type: Literal["active", "inactive", "both"] = "active"
    limit: int = Field(default=20, ge=0)
    page: int = Field(default=1, ge=1)


class ConductoresResponse(BaseModel):
    conductores: list[ConductorResponse]
    actual_page: int
    max_page: int


@router.get("/conductores")
async def get_all_conductor_by_group(
    session: DatabaseSession,
    jefe: GetJefeGrupo,
    query: Annotated[QueryConductores, Query()],
) -> ConductoresResponse:
    stmt = select(Conductor).where(Conductor.id_grupo == jefe.id_grupo)

    match query.type:
        case "active":
            stmt = stmt.where(Conductor.activo == True)
        case "inactive":
            stmt = stmt.where(Conductor.activo == False)
    # Creating dep for verity grupo_id access point is from the jefe grupo

    stmt_count = stmt.with_only_columns(func.count(), maintain_column_froms=True)
    count_conductores = await session.scalar(stmt_count) or 0
    max_page = int(count_conductores) // query.limit + 1
    # Setting pagination
    stmt = stmt.limit(query.limit).offset((query.page - 1) * query.limit)
    result = await session.scalars(stmt)
    conductores = result.all()

    return ConductoresResponse(
        actual_page=query.page,
        conductores=[ConductorResponse.from_model(c) for c in conductores],
        max_page=max_page,
    )


class AsignacionRutaRequest(BaseModel):
    conductor_id: int
    ruta_id: int
    fecha_inicio: datetime.datetime = Field(
        ...,
        description="Fecha y hora del evento. Debe ser posterior al momento de la solicitud.",
        json_schema_extra={
            "format": "date-time",
            "example": "2028-12-31T23:59:59Z",
            "notes": "Validación dinámica: debe ser > fecha/hora actual",
        },
    )

    @field_validator("fecha_inicio")
    @classmethod
    def validar_fecha_futura(cls, value: datetime.datetime) -> datetime.datetime:
        # Si la fecha no tiene zona horaria (naive), le asignamos la hora local o UTC según tu caso
        ahora = (
            datetime.datetime.now(value.tzinfo)
            if value.tzinfo
            else datetime.datetime.now()  # noqa: DTZ005
        )

        if value <= ahora:
            raise ValueError(
                "La fecha debe ser estrictamente posterior a la fecha y hora actual"
            )

        return value


class MetadataLine(BaseModel):
    id_ruta: int
    numero_ruta: str


class RutaResponse(BaseModel):
    id_ruta: int
    id_grupo: int
    numero_ruta: str
    lugar_initial: str
    lugar_final: str
    tiempo_estimado: int | None
    line: Feature[LineString, MetadataLine]

    @staticmethod
    def from_model(r: Ruta, line: Feature[LineString, MetadataLine]) -> "RutaResponse":
        return RutaResponse(
            id_ruta=r.id_ruta,
            id_grupo=r.id_grupo_operativo,
            line=line,
            lugar_final=r.lugar_final,
            lugar_initial=r.lugar_inicial,
            numero_ruta=r.numero_ruta,
            tiempo_estimado=r.tiempo_estimado,
        )


class AsignacionRutaResponse(BaseModel):
    conductor: ConductorResponse
    ruta: RutaResponse
    fecha_hora_inicio: datetime.datetime
    fecha_hora_final: datetime.datetime | None = None


@router.post("/conductores/{conductor_id}/asignation_ruta")
async def asignar_ruta_a_chofer(
    session: DatabaseSession,
    solicitud_asignacion: Annotated[AsignacionRutaRequest, Body()],
    conductor_id: int,
    jefe: GetJefeGrupo,
):
    # Get conductor_id and ruta_id
    stmt = select(Conductor).where(Conductor.id_conductor == conductor_id)
    conductor = await session.scalar(stmt)

    if not conductor:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Conductor not found {conductor_id}",
        )

    if conductor.id_grupo != jefe.id_grupo:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Don't not have permission to assign this conductor",
        )

    stmt = select(Ruta).where(Ruta.id_ruta == solicitud_asignacion.ruta_id)
    ruta = await session.scalar(stmt)

    if not ruta:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Ruta no found {solicitud_asignacion.ruta_id}",
        )

    if ruta.id_grupo_operativo != jefe.id_grupo:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Don't not have permission to assign this route: {ruta.id_grupo_operativo}",
        )

    asignacion = AsignacionRuta(
        id_ruta=ruta.id_ruta,
        id_conductor=conductor.id_conductor,
        datetime_inicio=solicitud_asignacion.fecha_inicio,
    )

    session.add(asignacion)
    await session.commit()
    await session.refresh(asignacion)
    stmt = (
        select(AsignacionRuta)
        .where(AsignacionRuta.id_asignacion == asignacion.id_asignacion)
        .options(
            selectinload(AsignacionRuta.conductor),  # Carga la relación 'usuario'
            selectinload(AsignacionRuta.ruta),
        )
    )

    asignacion = await session.scalar(stmt)

    if not asignacion:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error to creating asignation",
        )

    stmt = select(func.ST_AsGeoJSON(Ruta.line).label("geojson")).where(
        Ruta.id_ruta == asignacion.id_ruta
    )
    result = await session.scalar(stmt)
    if result is None:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed generating geojson",
        )

    geojson_str = result

    line_feature = Feature[LineString, MetadataLine](
        type="Feature",
        geometry=LineString(**geojson_str),
        properties=MetadataLine(
            id_ruta=ruta.id_ruta,
            numero_ruta=ruta.numero_ruta,
        ),
    )

    return AsignacionRutaResponse(
        conductor=ConductorResponse.from_model(asignacion.conductor),
        fecha_hora_inicio=asignacion.fecha_hora_inicio,
        fecha_hora_final=asignacion.fecha_hora_fin,
        ruta=RutaResponse.from_model(ruta, line=line_feature),
    )


# Creating dep for verity grupo_id access point is from the jefe grupo

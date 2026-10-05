import json
import uuid
from datetime import UTC, datetime, timedelta
from typing import Annotated, Any

from fastapi import APIRouter, HTTPException, Query, status
from geoalchemy2.shape import from_shape, to_shape
from geojson_pydantic import Feature, LineString
from pydantic import BaseModel, Field
from shapely.geometry import Point
from sqlalchemy import func, select
from sqlalchemy.orm import selectinload

from src.api.deps import GetConductor
from src.database.models import (
    AsignacionRuta,
    Recorrido,
    Ruta,
)
from src.depends import DatabaseSession, RedisClient
from src.jwt.security import hash_password

router = APIRouter(
    prefix="/conductor",
    tags=["Conductor"],
)


# ==========================================
# SCHEMAS
# ==========================================


class UpdateConductor(BaseModel):
    telefono: str


class UpdatePassword(BaseModel):
    password: str


class NewRecorrido(BaseModel):
    latitud: float = Field(ge=-90, le=90)
    longitud: float = Field(ge=-180, le=180)
    timestamp_frontend: datetime = Field(default_factory=lambda: datetime.now(UTC))
    sample_id: uuid.UUID = Field(default_factory=uuid.uuid4)


class TrackingTicketRequest(BaseModel):
    id_asignacion: int


class TrackingTicketResponse(BaseModel):
    ticket: str
    expires_in: int
    id_asignacion: int


class MetadataLine(BaseModel):
    id_ruta: int
    numero_ruta: str


class RutaAsignacionResponse(BaseModel):
    id_ruta: int
    id_grupo: int
    numero_ruta: str
    lugar_inicial: str
    lugar_final: str
    tiempo_estimado: int | None
    line: Feature[LineString, MetadataLine]


class AsignacionRutaResponse(BaseModel):
    id_asignacion: int
    id_conductor: int
    id_ruta: int
    fecha_hora_inicio: datetime
    fecha_hora_comienzo: datetime | None = None
    fecha_hora_fin: datetime | None = None
    ruta: RutaAsignacionResponse


def serialize_control_point(control_point: Any) -> dict[str, Any]:
    geometry = to_shape(control_point.ubicacion)
    if not isinstance(geometry, Point):
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="La ubicación del punto de control no es un POINT válido",
        )

    return {
        "id_punto_control": control_point.id_punto_control,
        "radio": float(control_point.radio),
        "n_puntos_relativo": control_point.n_puntos_relativo,
        "ubicacion": {
            "type": "Point",
            "coordinates": [float(geometry.x), float(geometry.y)],
        },
    }


async def serialize_assignment_response(
    session: DatabaseSession,
    assignment: AsignacionRuta | dict[str, Any],
) -> dict[str, Any]:
    if isinstance(assignment, dict):
        route = assignment.get("ruta")
        payload = assignment
    else:
        route = assignment.ruta
        payload = {
            "id_asignacion": assignment.id_asignacion,
            "id_conductor": assignment.id_conductor,
            "id_ruta": assignment.id_ruta,
            "fecha_hora_inicio": assignment.fecha_hora_inicio,
            "fecha_hora_comienzo": assignment.fecha_hora_comienzo,
            "fecha_hora_fin": assignment.fecha_hora_fin,
            "estado_tracking": assignment.estado_tracking,
        }

    if route is None:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="La asignación no tiene una ruta asociada",
        )

    stmt = select(func.ST_AsGeoJSON(Ruta.line).label("geojson")).where(
        Ruta.id_ruta == route.id_ruta
    )
    geojson = await session.scalar(stmt)

    if geojson is None:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="No fue posible serializar la geometría de la ruta",
        )

    geojson_dict = json.loads(geojson) if isinstance(geojson, str) else geojson

    line_feature = Feature[LineString, MetadataLine](
        type="Feature",
        geometry=LineString(**geojson_dict),
        properties=MetadataLine(
            id_ruta=route.id_ruta,
            numero_ruta=route.numero_ruta,
        ),
    )

    serialized_route = {
        "id_ruta": route.id_ruta,
        "id_grupo": route.id_grupo_operativo,
        "numero_ruta": route.numero_ruta,
        "lugar_inicial": route.lugar_inicial,
        "lugar_final": route.lugar_final,
        "tiempo_estimado": route.tiempo_estimado,
        "line": line_feature.model_dump(mode="json"),
        "puntos_control": [
            serialize_control_point(control_point)
            for control_point in getattr(route, "puntos_control", [])
        ],
    }

    payload["ruta"] = serialized_route
    return payload


# ==========================================
# OBTENER INFORMACIÓN DEL CONDUCTOR
# ==========================================


@router.get("/me")
async def get_info(
    conductor: GetConductor,
):
    return conductor


# ==========================================
# CAMBIAR TELÉFONO
# ==========================================


@router.put("/conductor")
async def update_conductor(
    input: UpdateConductor,
    conductor: GetConductor,
    session: DatabaseSession,
):
    conductor.telefono = input.telefono

    await session.flush()

    return {
        "message": "Teléfono actualizado correctamente",
        "telefono": conductor.telefono,
    }


# ==========================================
# CAMBIAR CONTRASEÑA
# ==========================================


@router.put("/password")
async def update_password(
    input: UpdatePassword,
    conductor: GetConductor,
    session: DatabaseSession,
):
    conductor.password = hash_password(input.password)

    await session.flush()

    return {
        "message": "Contraseña actualizada correctamente",
    }


# ==========================================
# OBTENER ASIGNACIÓN Y RUTA
# ==========================================


@router.get("/asignacion")
async def get_asignacion(
    conductor: GetConductor,
    session: DatabaseSession,
    redis: RedisClient,
    desde: Annotated[datetime | None, Query()] = None,
    hasta: Annotated[datetime | None, Query()] = None,
):
    if desde is None or hasta is None:
        now = datetime.now(UTC)
        desde = now.replace(hour=0, minute=0, second=0, microsecond=0)
        hasta = desde + timedelta(days=1)
    elif desde.tzinfo is None or hasta.tzinfo is None or desde >= hasta:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="El rango de fechas debe usar timestamps con zona horaria y ser válido",
        )

    stmt = (
        select(AsignacionRuta)
        .where(
            AsignacionRuta.id_conductor == conductor.id_conductor,
            AsignacionRuta.fecha_hora_fin.is_(None),
            AsignacionRuta.fecha_hora_inicio >= desde,
            AsignacionRuta.fecha_hora_inicio < hasta,
        )
        .options(
            selectinload(AsignacionRuta.ruta).selectinload(Ruta.puntos_control),
            selectinload(AsignacionRuta.recorridos),
        )
        .order_by(AsignacionRuta.fecha_hora_inicio, AsignacionRuta.id_asignacion)
    )

    asignacion = await session.scalar(stmt)

    if asignacion is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="El conductor no tiene una asignación activa",
        )

    response = await serialize_assignment_response(session, asignacion)
    raw_tracking_state = await redis.get(f"tracking:session:{asignacion.id_asignacion}")
    if raw_tracking_state:
        tracking_state = json.loads(raw_tracking_state)
        response["puntos_control_completados"] = tracking_state.get("reached", [])
    else:
        response["puntos_control_completados"] = []
    return response


# ==========================================
# GUARDAR RECORRIDO
# ==========================================


@router.post("/recorrido")
async def guardar_recorrido(
    input: NewRecorrido,
    conductor: GetConductor,
    session: DatabaseSession,
):
    # Buscar asignación activa
    stmt = (
        select(AsignacionRuta)
        .where(
            AsignacionRuta.id_conductor == conductor.id_conductor,
            AsignacionRuta.fecha_hora_fin.is_(None),
        )
        .order_by(AsignacionRuta.fecha_hora_inicio, AsignacionRuta.id_asignacion)
        .limit(1)
    )

    asignacion = await session.scalar(stmt)

    if asignacion is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="El conductor no tiene una asignación activa",
        )

    # Crear punto geográfico
    punto = from_shape(
        Point(
            input.longitud,
            input.latitud,
        ),
        srid=4326,
    )

    # Crear recorrido
    recorrido = Recorrido(
        id_recorrido=asignacion.id_asignacion,
        sample_id=input.sample_id,
        ubicacion=punto,
        timestamp_frontend=input.timestamp_frontend,
        timestamp_backend=datetime.now(UTC),
    )

    session.add(recorrido)

    await session.flush()

    return {
        "message": "Recorrido guardado correctamente",
        "id_ubicacion": recorrido.id_ubicacion,
        "id_asignacion": asignacion.id_asignacion,
        "latitud": input.latitud,
        "longitud": input.longitud,
        "timestamp_frontend": recorrido.timestamp_frontend,
        "timestamp_backend": recorrido.timestamp_backend,
    }


@router.post("/tracking-ticket", response_model=TrackingTicketResponse)
async def create_tracking_ticket(
    input: TrackingTicketRequest,
    conductor: GetConductor,
    session: DatabaseSession,
    redis: RedisClient,
):
    assignment = await session.scalar(
        select(AsignacionRuta).where(
            AsignacionRuta.id_asignacion == input.id_asignacion,
            AsignacionRuta.id_conductor == conductor.id_conductor,
            AsignacionRuta.fecha_hora_fin.is_(None),
            AsignacionRuta.estado_tracking.is_(None)
            | (AsignacionRuta.estado_tracking == "in_progress"),
        )
    )
    if assignment is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No existe una asignación pendiente para este conductor",
        )

    ticket = str(uuid.uuid4())
    ticket_data = json.dumps(
        {
            "id_conductor": conductor.id_conductor,
            "id_asignacion": assignment.id_asignacion,
        }
    )
    await redis.set(f"tracking:ticket:{ticket}", ticket_data, ex=60)
    return TrackingTicketResponse(
        ticket=ticket,
        expires_in=60,
        id_asignacion=assignment.id_asignacion,
    )

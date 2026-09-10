import random
import string
import uuid
from typing import Annotated, Literal

from fastapi import APIRouter, Header, HTTPException, Query, status
from pydantic import BaseModel, Field
from sqlalchemy import func, select

from src.api.deps import Conductor, GetJefeGrupo
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


@router.post("/chofer")
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


# Creating dep for verity grupo_id access point is from the jefe grupo

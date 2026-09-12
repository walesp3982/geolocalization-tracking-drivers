from datetime import UTC, datetime

from fastapi import APIRouter, HTTPException, status
from geoalchemy2.shape import from_shape
from pydantic import BaseModel
from shapely.geometry import Point
from sqlalchemy import desc, select
from sqlalchemy.orm import selectinload

from src.api.deps import GetConductor
from src.database.models import (
    AsignacionRuta,
    Recorrido,
    Ruta,
)
from src.depends import DatabaseSession
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
    latitud: float
    longitud: float


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
):
    stmt = (
        select(AsignacionRuta)
        .where(
            AsignacionRuta.id_conductor == conductor.id_conductor,
            AsignacionRuta.fecha_hora_fin.is_(None),
            AsignacionRuta.fecha_hora_inicio >= datetime.now(UTC),
        )
        .options(
            selectinload(AsignacionRuta.ruta).selectinload(Ruta.puntos_control),
            selectinload(AsignacionRuta.recorridos),
        )
        .order_by(desc(AsignacionRuta.fecha_hora_inicio))
    )

    asignacion = await session.scalar(stmt)

    if asignacion is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="El conductor no tiene una asignación activa",
        )

    return asignacion


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
    stmt = select(AsignacionRuta).where(
        AsignacionRuta.id_conductor == conductor.id_conductor,
        AsignacionRuta.fecha_hora_fin.is_(None),
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
        ubicacion=punto,
        timestamp=datetime.now(UTC),
    )

    session.add(recorrido)

    await session.flush()

    return {
        "message": "Recorrido guardado correctamente",
        "id_ubicacion": recorrido.id_ubicacion,
        "id_asignacion": asignacion.id_asignacion,
        "latitud": input.latitud,
        "longitud": input.longitud,
        "timestamp": recorrido.timestamp,
    }

import json
from datetime import UTC, datetime
from typing import Any

from fastapi import APIRouter, HTTPException, status
from geoalchemy2.shape import from_shape
from geojson_pydantic import Feature, LineString
from pydantic import BaseModel
from shapely.geometry import Point
from sqlalchemy import desc, func, select
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

    return await serialize_assignment_response(session, asignacion)


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

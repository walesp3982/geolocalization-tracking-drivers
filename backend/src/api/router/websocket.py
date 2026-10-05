import asyncio
import json
import logging
import math
import uuid
from datetime import UTC, datetime
from typing import Any

from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from geoalchemy2.shape import from_shape, to_shape
from pydantic import BaseModel, Field, ValidationError, field_validator
from shapely.geometry import Point
from sqlalchemy import desc, select

from src.database.models import AsignacionRuta, PuntosControl, Recorrido, Ruta
from src.depends import RedisClient, _SessionMaker

router = APIRouter(tags=["Websocket"])
logger = logging.getLogger(__name__)
SESSION_TTL_SECONDS = 7 * 24 * 60 * 60
TRACKING_REAPER_INTERVAL_SECONDS = 5


class TrackingSample(BaseModel):
    sample_id: uuid.UUID
    latitud: float = Field(ge=-90, le=90)
    longitud: float = Field(ge=-180, le=180)
    timestamp_frontend: datetime

    @field_validator("timestamp_frontend")
    @classmethod
    def require_timezone(cls, value: datetime) -> datetime:
        if value.tzinfo is None or value.utcoffset() is None:
            raise ValueError("timestamp_frontend debe incluir zona horaria")
        return value


def _distance_meters(
    latitude: float, longitude: float, point_latitude: float, point_longitude: float
) -> float:
    earth_radius = 6_371_000
    latitude_delta = math.radians(point_latitude - latitude)
    longitude_delta = math.radians(point_longitude - longitude)
    haversine = (
        math.sin(latitude_delta / 2) ** 2
        + math.cos(math.radians(latitude))
        * math.cos(math.radians(point_latitude))
        * math.sin(longitude_delta / 2) ** 2
    )
    return 2 * earth_radius * math.asin(math.sqrt(min(1, haversine)))


async def _load_tracking_data(
    assignment_id: int, expected_conductor_id: int | None = None
) -> tuple[dict[str, Any], list[dict[str, Any]]]:
    async with _SessionMaker() as session:
        assignment = await session.get(AsignacionRuta, assignment_id)
        if (
            assignment is None
            or assignment.fecha_hora_fin is not None
            or (
                expected_conductor_id is not None
                and assignment.id_conductor != expected_conductor_id
            )
        ):
            raise ValueError("La asignación ya no está disponible para tracking")
        route = await session.get(Ruta, assignment.id_ruta)
        if route is None:
            raise ValueError("La asignación no tiene una ruta válida")
        controls = await session.scalars(
            select(PuntosControl)
            .where(PuntosControl.id_ruta == route.id_ruta)
            .order_by(
                PuntosControl.n_puntos_relativo,
                PuntosControl.id_punto_control,
            )
        )
        checkpoints: list[dict[str, Any]] = []
        for control in controls:
            location = to_shape(control.ubicacion)
            if not isinstance(location, Point):
                continue
            checkpoints.append(
                {
                    "id": control.id_punto_control,
                    "latitude": float(location.y),
                    "longitude": float(location.x),
                    "radius": float(control.radio),
                }
            )
        if not checkpoints:
            raise ValueError("La ruta no tiene puntos de control configurados")
        estimated_minutes = route.tiempo_estimado
        duration_minutes = (
            estimated_minutes * 1.5
            if estimated_minutes is not None and estimated_minutes > 0
            else 60
        )
        return {
            "id_conductor": assignment.id_conductor,
            "id_asignacion": assignment.id_asignacion,
            "duration_seconds": int(duration_minutes * 60),
        }, checkpoints


async def _persist_sample(
    assignment_id: int,
    sample: TrackingSample,
    reached_checkpoint: int | None,
    completed: bool,
) -> tuple[datetime, bool]:
    timestamp_backend = datetime.now(UTC)
    async with _SessionMaker() as session:
        existing = await session.scalar(
            select(Recorrido.id_ubicacion).where(
                Recorrido.sample_id == sample.sample_id
            )
        )
        if existing is not None:
            return timestamp_backend, True

        assignment = await session.get(AsignacionRuta, assignment_id)
        if assignment is None or assignment.fecha_hora_fin is not None:
            raise ValueError("La asignación ya fue finalizada")

        assignment.estado_tracking = "in_progress"
        if assignment.fecha_hora_comienzo is None:
            assignment.fecha_hora_comienzo = timestamp_backend
        session.add(
            Recorrido(
                id_recorrido=assignment_id,
                sample_id=sample.sample_id,
                ubicacion=from_shape(Point(sample.longitud, sample.latitud), srid=4326),
                timestamp_frontend=sample.timestamp_frontend,
                timestamp_backend=timestamp_backend,
            )
        )
        if completed:
            assignment.fecha_hora_fin = timestamp_backend
            assignment.estado_tracking = "completed"
        await session.commit()
    return timestamp_backend, False


async def _sample_already_persisted(sample_id: uuid.UUID) -> bool:
    async with _SessionMaker() as session:
        return (
            await session.scalar(
                select(Recorrido.id_ubicacion).where(Recorrido.sample_id == sample_id)
            )
            is not None
        )


async def _finish_tracking(assignment_id: int, complete: bool) -> dict[str, Any]:
    async with _SessionMaker() as session:
        assignment = await session.get(AsignacionRuta, assignment_id)
        if assignment is None:
            return {
                "type": "finished",
                "success": False,
                "reason": "assignment_missing",
            }
        if assignment.fecha_hora_fin is None:
            last_timestamp = await session.scalar(
                select(Recorrido.timestamp_backend)
                .where(Recorrido.id_recorrido == assignment_id)
                .order_by(desc(Recorrido.timestamp_backend))
                .limit(1)
            )
            if last_timestamp is None:
                last_timestamp = datetime.now(UTC)
            assignment.fecha_hora_fin = last_timestamp
            assignment.estado_tracking = "completed" if complete else "incomplete"
            await session.commit()
        success = assignment.estado_tracking == "completed"
        return {
            "type": "finished",
            "success": success,
            "status": assignment.estado_tracking,
            "fecha_hora_comienzo": (
                assignment.fecha_hora_comienzo.isoformat()
                if assignment.fecha_hora_comienzo
                else None
            ),
            "fecha_hora_fin": assignment.fecha_hora_fin.isoformat(),
        }


async def reap_expired_tracking_sessions(redis: Any) -> None:
    now = datetime.now(UTC).timestamp()
    async for key in redis.scan_iter(match="tracking:session:*"):
        raw_state = await redis.get(key)
        if not raw_state:
            continue
        state = json.loads(raw_state)
        if state.get("status") != "in_progress" or state.get("deadline", now + 1) > now:
            continue
        assignment_id = int(state["id_asignacion"])
        complete = state["next_checkpoint"] >= len(state["checkpoints"])
        await _finish_tracking(assignment_id, complete)
        state["status"] = "finished"
        await redis.set(key, json.dumps(state), ex=SESSION_TTL_SECONDS)


async def tracking_reaper(redis: Any) -> None:
    while True:
        try:
            await reap_expired_tracking_sessions(redis)
        except Exception:
            logger.exception("Error procesando vencimientos de tracking")
        await asyncio.sleep(TRACKING_REAPER_INTERVAL_SECONDS)


@router.websocket("/tracking")
async def send_location(ws: WebSocket, redis: RedisClient) -> None:
    await ws.accept()
    try:
        auth_message = await asyncio.wait_for(ws.receive_json(), timeout=15)
        ticket = auth_message.get("ticket") if isinstance(auth_message, dict) else None
        if (
            not isinstance(auth_message, dict)
            or auth_message.get("type") != "auth"
            or not isinstance(ticket, str)
        ):
            await ws.send_json(
                {
                    "type": "error",
                    "code": "ticket_required",
                    "message": "Se requiere un ticket de tracking",
                }
            )
            await ws.close(code=4401)
            return

        ticket_data = await redis.getdel(f"tracking:ticket:{ticket}")
        if not ticket_data:
            await ws.send_json(
                {
                    "type": "error",
                    "code": "invalid_ticket",
                    "message": "El ticket expiró o ya fue utilizado",
                }
            )
            await ws.close(code=4401)
            return

        credentials = json.loads(ticket_data)
        assignment_id = int(credentials["id_asignacion"])
        conductor_id = int(credentials["id_conductor"])
        session_key = f"tracking:session:{assignment_id}"
        raw_state = await redis.get(session_key)
        state = json.loads(raw_state) if raw_state else None
        if state and state.get("status") == "in_progress":
            if datetime.now(UTC).timestamp() >= state["deadline"]:
                await _finish_tracking(
                    assignment_id, state["next_checkpoint"] >= len(state["checkpoints"])
                )
                state["status"] = "finished"
                await redis.set(session_key, json.dumps(state), ex=SESSION_TTL_SECONDS)
                await ws.send_json(
                    {
                        "type": "finished",
                        "success": state["next_checkpoint"]
                        >= len(state["checkpoints"]),
                        "reason": "timeout",
                    }
                )
                await ws.close()
                return
            await ws.send_json({"type": "authorized", "resume": True})
        else:
            try:
                await _load_tracking_data(assignment_id, conductor_id)
            except ValueError as error:
                await ws.send_json(
                    {
                        "type": "error",
                        "code": "assignment_unavailable",
                        "message": str(error),
                    }
                )
                await ws.close(code=4403)
                return
            await ws.send_json({"type": "authorized", "resume": False})

        while True:
            try:
                timeout = (
                    max(0.1, state["deadline"] - datetime.now(UTC).timestamp())
                    if state and state.get("status") == "in_progress"
                    else None
                )
                message = await asyncio.wait_for(ws.receive_json(), timeout=timeout)
            except TimeoutError:
                if state is None:
                    await ws.send_json(
                        {
                            "type": "error",
                            "code": "session_not_started",
                            "message": "El tracking no llegó a iniciar",
                        }
                    )
                    await ws.close(code=4400)
                    return
                complete = state["next_checkpoint"] >= len(state["checkpoints"])
                final_message = await _finish_tracking(assignment_id, complete)
                state["status"] = "finished"
                await redis.set(session_key, json.dumps(state), ex=SESSION_TTL_SECONDS)
                await ws.send_json({**final_message, "reason": "timeout"})
                await ws.close()
                return

            event_type = message.get("type") if isinstance(message, dict) else None
            if event_type in {"start", "resume"}:
                try:
                    sample = TrackingSample.model_validate(message.get("sample"))
                    if event_type == "resume" and await _sample_already_persisted(
                        sample.sample_id
                    ):
                        await ws.send_json(
                            {
                                "type": "ack",
                                "sample_id": str(sample.sample_id),
                                "duplicate": True,
                                "id_punto_control": None,
                                "reached_checkpoints": state["reached"]
                                if state
                                else [],
                            }
                        )
                        continue
                    if event_type == "start" and state is None:
                        assignment_data, checkpoints = await _load_tracking_data(
                            assignment_id, conductor_id
                        )
                        first = checkpoints[0]
                        if (
                            _distance_meters(
                                sample.latitud,
                                sample.longitud,
                                first["latitude"],
                                first["longitude"],
                            )
                            > first["radius"]
                        ):
                            await ws.send_json(
                                {
                                    "type": "error",
                                    "code": "first_checkpoint_required",
                                    "message": "Acércate al primer punto de control para iniciar el tracking",
                                    "id_punto_control": first["id"],
                                }
                            )
                            await ws.close(code=4403)
                            return
                        now = datetime.now(UTC).timestamp()
                        state = {
                            **assignment_data,
                            "checkpoints": checkpoints,
                            "next_checkpoint": 0,
                            "deadline": now + assignment_data["duration_seconds"],
                            "status": "in_progress",
                            "reached": [],
                        }
                    elif state is None or state.get("status") != "in_progress":
                        await ws.send_json(
                            {
                                "type": "error",
                                "code": "session_not_active",
                                "message": "No existe un tracking activo para reanudar",
                            }
                        )
                        continue

                    if state["next_checkpoint"] < len(state["checkpoints"]):
                        checkpoint = state["checkpoints"][state["next_checkpoint"]]
                        if (
                            _distance_meters(
                                sample.latitud,
                                sample.longitud,
                                checkpoint["latitude"],
                                checkpoint["longitude"],
                            )
                            <= checkpoint["radius"]
                        ):
                            state["next_checkpoint"] += 1
                            state["reached"].append(checkpoint["id"])
                            reached_id = checkpoint["id"]
                        else:
                            reached_id = None
                    else:
                        reached_id = None

                    is_complete = state["next_checkpoint"] >= len(state["checkpoints"])
                    _, duplicate = await _persist_sample(
                        assignment_id, sample, reached_id, is_complete
                    )
                    await redis.set(
                        session_key, json.dumps(state), ex=SESSION_TTL_SECONDS
                    )
                    if is_complete:
                        state["status"] = "finished"
                        await redis.set(
                            session_key, json.dumps(state), ex=SESSION_TTL_SECONDS
                        )
                    await ws.send_json(
                        {
                            "type": "ack",
                            "sample_id": str(sample.sample_id),
                            "duplicate": duplicate,
                            "id_punto_control": reached_id,
                            "reached_checkpoints": state["reached"],
                        }
                    )
                    if event_type == "start":
                        await ws.send_json(
                            {
                                "type": "ready",
                                "deadline": state["deadline"],
                                "reached_checkpoints": state["reached"],
                            }
                        )
                    if is_complete:
                        final_message = await _finish_tracking(assignment_id, True)
                        await ws.send_json(final_message)
                        return
                except ValidationError as error:
                    await ws.send_json(
                        {
                            "type": "error",
                            "code": "invalid_sample",
                            "message": str(error),
                        }
                    )
                except ValueError as error:
                    await ws.send_json(
                        {
                            "type": "error",
                            "code": "assignment_unavailable",
                            "message": str(error),
                        }
                    )
                    return
            elif (
                event_type == "location"
                and state
                and state.get("status") == "in_progress"
            ):
                sample_message = message.get("sample", message)
                try:
                    sample = TrackingSample.model_validate(sample_message)
                    if await _sample_already_persisted(sample.sample_id):
                        await ws.send_json(
                            {
                                "type": "ack",
                                "sample_id": str(sample.sample_id),
                                "duplicate": True,
                                "id_punto_control": None,
                                "reached_checkpoints": state["reached"],
                            }
                        )
                        continue
                    checkpoint = (
                        state["checkpoints"][state["next_checkpoint"]]
                        if state["next_checkpoint"] < len(state["checkpoints"])
                        else None
                    )
                    reached_id = None
                    if (
                        checkpoint
                        and _distance_meters(
                            sample.latitud,
                            sample.longitud,
                            checkpoint["latitude"],
                            checkpoint["longitude"],
                        )
                        <= checkpoint["radius"]
                    ):
                        state["next_checkpoint"] += 1
                        state["reached"].append(checkpoint["id"])
                        reached_id = checkpoint["id"]
                    is_complete = state["next_checkpoint"] >= len(state["checkpoints"])
                    _, duplicate = await _persist_sample(
                        assignment_id, sample, reached_id, is_complete
                    )
                    await redis.set(
                        session_key, json.dumps(state), ex=SESSION_TTL_SECONDS
                    )
                    await ws.send_json(
                        {
                            "type": "ack",
                            "sample_id": str(sample.sample_id),
                            "duplicate": duplicate,
                            "id_punto_control": reached_id,
                            "reached_checkpoints": state["reached"],
                        }
                    )
                    if is_complete:
                        state["status"] = "finished"
                        await redis.set(
                            session_key, json.dumps(state), ex=SESSION_TTL_SECONDS
                        )
                        await ws.send_json(await _finish_tracking(assignment_id, True))
                        return
                except (ValidationError, ValueError) as error:
                    await ws.send_json(
                        {
                            "type": "error",
                            "code": "invalid_sample",
                            "message": str(error),
                        }
                    )
            elif (
                event_type == "stop" and state and state.get("status") == "in_progress"
            ):
                complete = state["next_checkpoint"] >= len(state["checkpoints"])
                final_message = await _finish_tracking(assignment_id, complete)
                state["status"] = "finished"
                await redis.set(session_key, json.dumps(state), ex=SESSION_TTL_SECONDS)
                await ws.send_json(final_message)
                return
            else:
                await ws.send_json(
                    {
                        "type": "error",
                        "code": "unexpected_event",
                        "message": "Evento no válido para el estado actual",
                    }
                )
    except WebSocketDisconnect:
        return
    except (TimeoutError, ValueError, json.JSONDecodeError):
        try:
            await ws.close(code=4400)
        except RuntimeError:
            pass

from __future__ import annotations

import datetime
import secrets
from typing import Literal

from pydantic import BaseModel, ValidationError
from redis.asyncio import Redis
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.database.models import Administrator, Conductor, GrupoOperativo
from src.jwt.security import (
    create_access_token,
    verify_password,
)
from src.schemas.auth import PayloadAdministrador, PayloadConductor


async def autenticar_conductor(
    db: AsyncSession,
    code: str,
    password: str,
) -> Conductor | None:
    # Busca un conductor cuyo ID coincida con el recibido
    # desde la pantalla de inicio de sesión.
    resultado = await db.execute(select(Conductor).where(Conductor.code == code))
    conductor = resultado.scalar_one_or_none()

    # Si el conductor no existe, la autenticación falla.
    if conductor is None:
        return None

    # Compara la contraseña enviada con la contraseña almacenada.
    if not verify_password(password, conductor.password):
        return None

    # Impide que un conductor inactivo pueda iniciar sesión.
    if not conductor.activo:
        return None

    return conductor


async def autentificar_administrador(
    db: AsyncSession,
    email: str,
    password: str,
) -> Administrator | None:
    # Busca un conductor cuyo ID coincida con el recibido
    # desde la pantalla de inicio de sesión.
    resultado = await db.execute(
        select(Administrator).where(Administrator.email == email)
    )
    administrador = resultado.scalar_one_or_none()

    # Si el conductor no existe, la autenticación falla.
    if administrador is None:
        return None

    # Compara la contraseña enviada con la contraseña almacenada.
    if not verify_password(password, administrador.password):
        return None

    return administrador


async def obtener_grupo_conductor(
    db: AsyncSession,
    conductor: Conductor,
) -> GrupoOperativo | None:
    # Busca el grupo cuyo ID sea igual al id_grupo registrado en el conductor.
    resultado = await db.execute(
        select(GrupoOperativo).where(GrupoOperativo.id_grupo == conductor.id_grupo)
    )
    return resultado.scalar_one_or_none()


def is_jefe_conductor(
    conductor: Conductor,
    grupo: GrupoOperativo,
) -> bool:
    # Si el ID del conductor coincide con el ID del representante
    # registrado en su grupo, es el jefe del grupo.
    if grupo.id_representante:
        return grupo.id_representante == conductor.id_conductor
    return False


async def generar_token_conductor(
    db: AsyncSession, identifier: str, password: str
) -> PayloadConductor | None:
    conductor = await autenticar_conductor(db, identifier, password)
    if not conductor:
        return None
    # Estos datos se guardan dentro del token; no crean columnas nuevas.
    grupo = await obtener_grupo_conductor(db, conductor)
    if not grupo:
        raise ValueError("Cannot found group id")
    is_jefe_grupo = is_jefe_conductor(conductor, grupo)

    payload = PayloadConductor(
        sub=conductor.id_conductor,
        name=conductor.nombre,
        id_group=conductor.id_grupo,
        is_jefe_grupo=is_jefe_grupo,
    )

    # create_accepassss_token devuelve (token, fecha_expiracion).
    return payload


async def generar_token_administrador(
    db: AsyncSession, identifier: str, password: str
) -> PayloadAdministrador | None:
    admin = await autentificar_administrador(db, identifier, password)

    if not admin:
        return None

    payload = PayloadAdministrador(
        name=admin.name, role="admin", sub=admin.id_administrador
    )

    return payload


class MetadataInMemoryUser(BaseModel):
    identifier: str
    expires_at: datetime.datetime
    role: Literal["admin", "conductor"] = "conductor"


class Authentification(BaseModel):
    access_token: str
    refresh_token: str


async def save_metadata(
    memory: Redis, metadata: MetadataInMemoryUser, duration_in_days: int = 7
) -> str:
    refresh = secrets.token_urlsafe(30)

    await memory.set(
        f"refresh_token:{refresh}",
        metadata.model_dump_json(),
        ex=60 * 60 * 24 * duration_in_days,
    )

    return refresh


async def generate_payload(
    db: AsyncSession, identifier: str, password: str
) -> tuple[str, Literal["conductor", "admin"]] | None:
    payload_as_conductor = await generar_token_conductor(db, identifier, password)
    if payload_as_conductor:
        return (create_access_token(payload_as_conductor.model_dump()), "conductor")
    payload_as_admin = await generar_token_administrador(db, identifier, password)
    if payload_as_admin:
        return (create_access_token(payload_as_admin.model_dump()), "admin")
    return None


EXPIRE_REFRESH_TOKEN_DAYS = 7


async def generate_first_authenfication(
    db: AsyncSession, identifier: str, password: str, memory: Redis
) -> Authentification | None:

    payload_generating = await generate_payload(db, identifier, password)
    if not payload_generating:
        return None

    token, role = payload_generating

    metadata = MetadataInMemoryUser(
        identifier=identifier,
        expires_at=datetime.datetime.now(tz=datetime.UTC)
        + datetime.timedelta(days=EXPIRE_REFRESH_TOKEN_DAYS),
    )

    match role:
        case "conductor":
            metadata.role = "conductor"
        case "admin":
            metadata.role = "admin"

    refresh_token = await save_metadata(memory, metadata)

    return Authentification(
        access_token=token,
        refresh_token=refresh_token,
    )


async def generar_token_conductor_sin_password(
    db: AsyncSession, identifier: str
) -> PayloadConductor | None:
    resultado = await db.execute(select(Conductor).where(Conductor.code == identifier))
    conductor = resultado.scalar_one_or_none()

    if conductor is None or not conductor.activo:
        return None

    grupo = await obtener_grupo_conductor(db, conductor)
    if not grupo:
        raise ValueError("Cannot found group id")

    return PayloadConductor(
        sub=conductor.id_conductor,
        name=conductor.nombre,
        id_group=conductor.id_grupo,
        is_jefe_grupo=is_jefe_conductor(conductor, grupo),
    )


async def generar_token_administrador_sin_password(
    db: AsyncSession, identifier: str
) -> PayloadAdministrador | None:
    resultado = await db.execute(
        select(Administrator).where(Administrator.email == identifier)
    )
    admin = resultado.scalar_one_or_none()

    if admin is None:
        return None

    return PayloadAdministrador(
        name=admin.name, role="admin", sub=admin.id_administrador
    )


async def reload_access_token(
    db: AsyncSession, memory: Redis, refresh_token: str
) -> str | None:
    data = await memory.get(f"refresh_token:{refresh_token}")

    if not data:
        return None

    try:
        metadata = MetadataInMemoryUser.model_validate_json(data)
    except ValidationError:
        return None

    if metadata.expires_at < datetime.datetime.now(tz=datetime.UTC):
        return None

    payload: PayloadConductor | PayloadAdministrador | None
    match metadata.role:
        case "admin":
            payload = await generar_token_administrador_sin_password(
                db, metadata.identifier
            )
        case "conductor":
            payload = await generar_token_conductor_sin_password(
                db, metadata.identifier
            )

    if payload is None:
        return None

    token = create_access_token(payload.model_dump())

    return token

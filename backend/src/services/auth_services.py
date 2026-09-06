from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.database.models import Conductor, GrupoOperativo
from src.jwt.security import (
    create_access_token,
    verify_password,
)
from src.schemas.auth import PayloadData


async def autenticar_conductor(
    db: AsyncSession,
    code: str,
    password: str,
) -> Conductor | None:
    # Busca un conductor cuyo ID coincida con el recibido
    # desde la pantalla de inicio de sesión.
    resultado = await db.execute(
        select(Conductor).where(Conductor.id_conductor == code)
    )
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
    db: AsyncSession,
    conductor: Conductor,
) -> str:
    # Estos datos se guardan dentro del token; no crean columnas nuevas.
    grupo = await obtener_grupo_conductor(db, conductor)
    if not grupo:
        raise ValueError("Cannot found group id")
    is_jefe_grupo = is_jefe_conductor(conductor, grupo)

    payload = PayloadData(
        sub=conductor.id_conductor,
        name=conductor.nombre,
        id_group=conductor.id_grupo,
        is_jefe_grupo=is_jefe_grupo,
    )

    # create_access_token devuelve (token, fecha_expiracion).
    return create_access_token(data=payload.model_dump())

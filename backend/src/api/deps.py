from __future__ import annotations

from typing import Annotated

from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy import select

import jwt
from src.database.models import Administrator, Conductor, GrupoOperativo

# Dirección de conexion a la base de datos
from src.depends import DatabaseSession

# --------------------------------
from src.jwt.security import decode_access_token

# tokenUrl es solo referencial para el botón "Authorize" de /docs.
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login", refreshUrl="/auth/refresh")

CREDENTIALS_EXCEPTION = HTTPException(
    status_code=status.HTTP_401_UNAUTHORIZED,
    detail="No se pudo validar la credencial",
    headers={"WWW-Authenticate": "Bearer"},
)


# Decodifaca el jwt y devuelve el conductor autenticado, si no es valido lanza una excepcion
async def get_current_conductor(
    token: Annotated[str, Depends(oauth2_scheme)],
    db: DatabaseSession,
) -> Conductor:
    try:
        payload = decode_access_token(token)
        sub = payload.get("sub")
        role: str = str(payload.get("role"))
        if sub is None or role != "conductor":
            print(f" Sub: {sub} ; role: {role}")
            raise CREDENTIALS_EXCEPTION
    except jwt.ExpiredSignatureError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="El token expiró, iniciá sesión nuevamente",
            headers={"WWW-Authenticate": "Bearer"},
        )
    except jwt.PyJWTError:
        raise CREDENTIALS_EXCEPTION

    conductor = await db.get(Conductor, int(sub))
    if conductor is None or not conductor.activo:
        raise CREDENTIALS_EXCEPTION
    return conductor


GetConductor = Annotated[Conductor, Depends(get_current_conductor)]


# Dependencia para proteger endpoints exclusivos de Jefe de Grupo
async def get_current_jefe_grupo(
    conductor: Annotated[Conductor, Depends(get_current_conductor)],
    session: DatabaseSession,
) -> Conductor:
    stmt = select(GrupoOperativo).where(GrupoOperativo.id_grupo == conductor.id_grupo)
    grupo_operativo = await session.scalar(stmt)

    if not grupo_operativo:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Grupo operativo no encontrado",
        )

    if grupo_operativo.id_representante != conductor.id_conductor:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="El chofer no tiene permisos sobre este grupo",
        )

    return conductor


GetJefeGrupo = Annotated[Conductor, Depends(get_current_jefe_grupo)]


async def get_current_admin(
    token: Annotated[str, Depends(oauth2_scheme)],
    db: DatabaseSession,
) -> Administrator:
    try:
        payload = decode_access_token(token)
        sub = payload.get("sub")
        role: str = str(payload.get("role"))
        if sub is None or role != "admin":
            raise CREDENTIALS_EXCEPTION
    except jwt.ExpiredSignatureError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="El token expiró, iniciá sesión nuevamente",
            headers={"WWW-Authenticate": "Bearer"},
        )
    except jwt.PyJWTError:
        raise CREDENTIALS_EXCEPTION

    admin = await db.get(Administrator, int(sub))
    if admin is None:
        raise CREDENTIALS_EXCEPTION
    return admin


GetAdministrator = Annotated[Administrator, Depends(get_current_admin)]

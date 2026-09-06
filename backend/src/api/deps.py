from __future__ import annotations

from typing import Annotated

from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer

import jwt
from src.database.models import Conductor

# Dirección de conexion a la base de datos
from src.depends import DatabaseSession

# --------------------------------
from src.jwt.security import decode_access_token

# tokenUrl es solo referencial para el botón "Authorize" de /docs.
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login")

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
        id_conductor = payload.get("sub")
        if id_conductor is None:
            raise CREDENTIALS_EXCEPTION
    except jwt.ExpiredSignatureError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="El token expiró, iniciá sesión nuevamente",
            headers={"WWW-Authenticate": "Bearer"},
        )
    except jwt.PyJWTError:
        raise CREDENTIALS_EXCEPTION

    conductor = await db.get(Conductor, int(id_conductor))
    if conductor is None or not conductor.activo:
        raise CREDENTIALS_EXCEPTION
    return conductor


# Dependencia para proteger endpoints exclusivos de Jefe de Grupo
def require_jefe_grupo():
    async def _checker(
        conductor: Annotated[Conductor, Depends(get_current_conductor)],
    ) -> Conductor:

        return conductor

    return _checker


JefeGrupo = Annotated[Conductor, Depends(require_jefe_grupo)]

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status

from src.api.deps import get_current_conductor
from src.database.models import Conductor
from src.depends import DatabaseSession
from src.schemas.auth import ConductorOut, LoginRequest, TokenResponse
from src.services.auth_services import (
    autenticar_conductor,
    generar_token_conductor,
)

router = APIRouter(prefix="/auth", tags=["Autenticación"])


# Vista para el login, recibe id_conductor, devuelve los datos del conductor
def _conductor_out(conductor: Conductor) -> ConductorOut:
    return ConductorOut(
        id_conductor=conductor.id_conductor,
        nombre=conductor.nombre,
        telefono=conductor.telefono,
        id_grupo=conductor.id_grupo,
        activo=conductor.activo,
    )


# ingreso de datos para el login, recibe id_conductor y password, devuelve un token de acceso
@router.post("/login", response_model=TokenResponse)
async def login(
    data: LoginRequest,
    db: DatabaseSession,
) -> TokenResponse:
    """El frontend manda codigo_unico + password."""
    conductor = await autenticar_conductor(db, data.code, data.password)
    if conductor is None:
        # No distinguimos "no existe" de "contraseña incorrecta" por seguridad.
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="id_conductor o contraseña incorrectos",
        )

    token = await generar_token_conductor(db, conductor)

    return TokenResponse(
        access_token=token,
    )


# Mostrar datos del conductor autenticado y su rol
@router.get("/me", response_model=ConductorOut)
async def me(
    conductor: Annotated[Conductor, Depends(get_current_conductor)],
) -> ConductorOut:
    """Devuelve los datos del conductor autenticado y su rol actual."""
    return _conductor_out(conductor)


# Emite un tocken cada 7 dias
@router.post("/refresh", response_model=TokenResponse)
async def refresh(
    db: DatabaseSession,
    conductor: Annotated[Conductor, Depends(get_current_conductor)],
) -> TokenResponse:
    token = await generar_token_conductor(db, conductor)
    return TokenResponse(
        access_token=token,
    )

from typing import Annotated

from fastapi import APIRouter, Depends, Form, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm

from src.api.deps import get_current_conductor
from src.database.models import Conductor
from src.depends import DatabaseSession, RedisClient
from src.schemas.auth import (
    ConductorOut,
    ReloadAccessTokenResponse,
    TokenResponse,
)
from src.services.auth_services import (
    create_new_access_token,
    generate_first_authenfication,
)

router = APIRouter(prefix="/auth")


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
@router.post("/login")
async def login(
    data: Annotated[OAuth2PasswordRequestForm, Depends()],
    db: DatabaseSession,
    memory: RedisClient,
) -> TokenResponse:
    """El frontend manda codigo_unico + password."""
    tokens_authentification = await generate_first_authenfication(
        db, data.username, data.password, memory
    )

    if not tokens_authentification:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="credenciales incorrectos",
        )
    return TokenResponse(
        access_token=tokens_authentification.access_token,
        refresh_token=tokens_authentification.refresh_token,
    )


# Mostrar datos del conductor autenticado y su rol
@router.get("/me", response_model=ConductorOut)
async def me(
    conductor: Annotated[Conductor, Depends(get_current_conductor)],
) -> ConductorOut:
    """Devuelve los datos del conductor autenticado y su rol actual."""
    return _conductor_out(conductor)


# Emite un tocken cada 7 dias
@router.post("/refresh", response_model=ReloadAccessTokenResponse)
async def refresh(
    db: DatabaseSession,
    memory: RedisClient,
    refresh_token: str = Form(),
    grant_type: str = Form(),
) -> ReloadAccessTokenResponse:
    new_access_token: str | None = await create_new_access_token(
        db, memory, refresh_token
    )
    if not new_access_token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Refresh token expired or invalid",
        )
    return ReloadAccessTokenResponse(
        access_token=new_access_token,
    )

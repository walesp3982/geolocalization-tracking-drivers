from typing import Annotated

from fastapi import APIRouter, Depends, Form, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm

from src.depends import DatabaseSession, RedisClient
from src.schemas.auth import (
    ReloadAccessTokenResponse,
    TokenResponse,
)
from src.services.auth_services import (
    generate_first_authenfication,
    reload_access_token,
)

router = APIRouter(prefix="/auth", tags=["Autentificación"])


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


# Emite un tocken cada 7 dias
@router.post("/refresh", response_model=ReloadAccessTokenResponse)
async def refresh(
    db: DatabaseSession,
    memory: RedisClient,
    refresh_token: str = Form(),
    grant_type: str = Form(),
) -> ReloadAccessTokenResponse:
    new_access_token: str | None = await reload_access_token(db, memory, refresh_token)
    if not new_access_token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Refresh token expired or invalid",
        )
    return ReloadAccessTokenResponse(
        access_token=new_access_token,
    )

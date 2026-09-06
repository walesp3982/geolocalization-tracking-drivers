from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from src.api.deps import get_current_conductor, get_rol_actual
from src.database.database import get_db  
from src.database.models import Conductor
from src.schemas.auth import ConductorOut, LoginRequest, RolConductor, TokenResponse
from src.services.auth_service import (
    autenticar_conductor,
    determinar_rol_conductor,
    generar_token_conductor,
    obtener_grupo_conductor,
)

router = APIRouter(prefix="/auth", tags=["Autenticación"])

#Vista para el login, recibe id_conductor, devuelve los datos del conductor
def _conductor_out(conductor: Conductor, rol: RolConductor) -> ConductorOut:
    return ConductorOut(
        id_conductor=conductor.id_conductor,
        nombre=conductor.nombre,
        telefono=conductor.telefono,
        id_grupo=conductor.id_grupo,
        activo=conductor.activo,
        rol=rol,
    )

#ingreso de datos para el login, recibe id_conductor y password, devuelve un token de acceso
@router.post("/login", response_model=TokenResponse)
async def login(
    data: LoginRequest,
    db: AsyncSession = Depends(get_db),
) -> TokenResponse:
    """El frontend manda id_conductor + password."""
    conductor = await autenticar_conductor(db, data.id_conductor, data.password)
    if conductor is None:
        # No distinguimos "no existe" de "contraseña incorrecta" por seguridad.
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="id_conductor o contraseña incorrectos",
        )

    grupo = await obtener_grupo_conductor(db, conductor)
    if grupo is None:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="El conductor no tiene un grupo operativo asociado",
        )

    rol = determinar_rol_conductor(conductor, grupo)
    token, expire = generar_token_conductor(conductor, rol)

    return TokenResponse(
        access_token=token,
        expires_at=expire.isoformat(),
        conductor=_conductor_out(conductor, rol),
    )

#Mostrar datos del conductor autenticado y su rol 
@router.get("/me", response_model=ConductorOut)
async def me(
    conductor: Conductor = Depends(get_current_conductor),
    rol: RolConductor = Depends(get_rol_actual),
) -> ConductorOut:
    """Devuelve los datos del conductor autenticado y su rol actual."""
    return _conductor_out(conductor, rol)

#Emite un tocken cada 7 dias
@router.post("/refresh", response_model=TokenResponse)
async def refresh(
    conductor: Conductor = Depends(get_current_conductor),
    rol: RolConductor = Depends(get_rol_actual),
) -> TokenResponse:
    token, expire = generar_token_conductor(conductor, rol)
    return TokenResponse(
        access_token=token,
        expires_at=expire.isoformat(),
        conductor=_conductor_out(conductor, rol),
    )
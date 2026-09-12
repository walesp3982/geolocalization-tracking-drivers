from fastapi import APIRouter

from src.api.deps import GetAdministrator

router = APIRouter(prefix="/admin", tags=["Administrador"])


@router.get("/")
async def get_info(admin: GetAdministrator):
    return admin

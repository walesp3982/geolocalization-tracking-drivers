from fastapi import APIRouter

from src.api.deps import GetConductor

router = APIRouter(prefix="/conductor", tags=["Conductor"])


# TODO: HACER EL ME para el chofer
@router.get("/me")
async def get_info(conductor: GetConductor):
    return conductor

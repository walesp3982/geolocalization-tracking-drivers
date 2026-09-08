import random
import string

from fastapi import APIRouter
from pydantic import BaseModel

from src.api.deps import JefeGrupo
from src.database import Conductor
from src.depends import DatabaseSession
from src.jwt.security import hash_password


def gen_code_chofer() -> str:
    alpha_part = "".join(random.choices(string.ascii_letters, k=4)).upper()
    numeric_part = "".join(random.choices(string.digits, k=4))
    return alpha_part + numeric_part


class NewConductor(BaseModel):
    nombre: str
    telefono: str
    password: str


router = APIRouter(prefix="/conductor", tags=["conductor"])


@router.post("/chofer")
async def register_new_conductor(
    input: NewConductor, jefe: JefeGrupo, session: DatabaseSession
):
    # Hashing passowrd
    hashed = hash_password(input.password)

    new_chofer = Conductor(
        code=gen_code_chofer(),
        telefono=input.telefono,
        password=hashed,
        id_grupo=jefe.id_grupo,
        nombre=input.nombre,
    )

    session.add(new_chofer)

    await session.flush([new_chofer])

    return new_chofer

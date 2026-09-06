# Que datos trabajar en el frontend


from pydantic import BaseModel


# Datos con de ingreso para la autenticacion
class LoginRequest(BaseModel):
    code: str
    password: str


# Datos de salida luego de la autenticacion
class ConductorOut(BaseModel):
    id_conductor: int
    nombre: str
    telefono: str | None
    id_grupo: int
    activo: bool

    model_config = {"from_attributes": True}


class PayloadData(BaseModel):
    sub: int
    name: str
    id_group: int
    is_jefe_grupo: bool


# token de salida luego de la autenticacion
class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"

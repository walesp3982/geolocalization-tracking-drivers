# Que datos trabajar en el frontend


from typing import Annotated, Literal

from pydantic import BaseModel, Field


# Datos con de ingreso para la autenticacion
class LoginRequest(BaseModel):
    identifier: str
    password: str


# Datos de salida luego de la autenticacion
class ConductorOut(BaseModel):
    id_conductor: int
    nombre: str
    telefono: str | None
    id_grupo: int
    activo: bool

    model_config = {"from_attributes": True}


class PayloadConductor(BaseModel):
    sub: int
    name: str
    id_group: int
    is_jefe_grupo: bool
    role: Literal["conductor"] = "conductor"


class PayloadAdministrador(BaseModel):
    sub: int
    name: str
    role: Literal["admin"] = "admin"


Payload = Annotated[
    PayloadConductor | PayloadAdministrador,
    Field(discriminator="role"),
]


# token de salida luego de la autenticacion
class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


class ReloadAccessTokenResponse(BaseModel):
    access_token: str


class ReloadAccessTokenRequest(BaseModel):
    refresh_token: str

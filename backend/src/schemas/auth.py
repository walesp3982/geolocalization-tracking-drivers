#Que datos trabajar en el frontend 

from enum import Enum
 
from pydantic import BaseModel
 
 
class RolConductor(str, Enum):
    CONDUCTOR = "conductor"
    JEFE_GRUPO = "jefe_grupo"
 
#Datos con de ingreso para la autenticacion
class LoginRequest(BaseModel):
    id_conductor: int
    password: str

#Datos de salida luego de la autenticacion
class ConductorOut(BaseModel):
    id_conductor: int
    nombre: str
    telefono: str | None
    id_grupo: int
    activo: bool
    rol: RolConductor
 
    model_config = {"from_attributes": True}
 
#token de salida luego de la autenticacion 
class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_at: str
    conductor: ConductorOut

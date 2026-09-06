from datetime import UTC, datetime, timedelta
from typing import Any

from passlib.context import CryptContext

import jwt
from src.jwt.config import get_settings

settings = get_settings()

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


# Hash de la contraseña
def hash_password(password: str) -> str:

    return pwd_context.hash(password)


# verificacion de la contraseña con el hash almacenado en la base de datos
def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)


# Generacion del tokend de acceso con limite de tiempo de 7 dias que esta en config
def create_access_token(data: dict[str, Any]) -> tuple[str, datetime]:
    now = datetime.now(UTC)
    expire = now + timedelta(days=settings.JWT_EXPIRE_DAYS)

    to_encode = data.copy()
    to_encode.update({"exp": expire, "iat": now})

    token = jwt.encode(
        to_encode, settings.JWT_SECRET_KEY, algorithm=settings.JWT_ALGORITHM
    )
    return token, expire


# decodificacion y validacion del token
def decode_access_token(token: str) -> dict[str, Any]:
    return jwt.decode(
        token, settings.JWT_SECRET_KEY, algorithms=[settings.JWT_ALGORITHM]
    )

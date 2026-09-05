from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Any

import jwt
from passlib.context import CryptContext

from jwt.config import settings

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def hash_password(password: str) -> str:
    """Hashea una contraseña en texto plano para guardarla en Conductor.password."""
    return pwd_context.hash(password)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Compara una contraseña en texto plano contra el hash guardado."""
    return pwd_context.verify(plain_password, hashed_password)


def create_access_token(data: dict[str, Any]) -> tuple[str, datetime]:
    """Genera un JWT firmado, válido por settings.jwt_expire_days (7 días)."""
    now = datetime.now(timezone.utc)
    expire = now + timedelta(days=settings.jwt_expire_days)

    to_encode = data.copy()
    to_encode.update({"exp": expire, "iat": now})

    token = jwt.encode(to_encode, settings.jwt_secret_key, algorithm=settings.jwt_algorithm)
    return token, expire


def decode_access_token(token: str) -> dict[str, Any]:
    """Decodifica y valida un JWT. Lanza jwt.ExpiredSignatureError o jwt.PyJWTError."""
    return jwt.decode(token, settings.jwt_secret_key, algorithms=[settings.jwt_algorithm])
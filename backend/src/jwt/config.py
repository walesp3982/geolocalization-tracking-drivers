from __future__ import annotations

from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env", env_file_encoding="utf-8", extra="ignore"
    )

    DATABASE_URL: str = (
        "postgresql+asyncpg://root:@localhost:5432/"
        "geolocalization-tracking-drivers_db"
    )
    # IMPORTANTE: sobreescribir en producción vía variable de entorno JWT_SECRET_KEY.
    JWT_SECRET_KEY: str = "CAMBIAR_ESTO_POR_UN_VALOR_SECRETO_Y_LARGO"
    JWT_ALGORITHM: str = "HS256"
    JWT_EXPIRE_DAYS: int = 7  # duración del token: 7 días


@lru_cache
def get_settings() -> Settings:
    return Settings()
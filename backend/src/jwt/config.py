from __future__ import annotations

from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env", env_file_encoding="utf-8", extra="ignore"
    )

    # --- Base de datos ---
    database_url: str = (
        "postgresql+asyncpg://root:@localhost:5432/"
        "geolocalization-tracking-drivers_db"
    )
    db_echo: bool = False

    # --- JWT ---
    # IMPORTANTE: sobreescribir en .env / variables de entorno en producción.
    jwt_secret_key: str = "Cabiar frase secreta por una aleatoria y segura en producción"
    jwt_algorithm: str = "HS256"
    jwt_expire_days: int = 7  # duración del token: 7 días


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
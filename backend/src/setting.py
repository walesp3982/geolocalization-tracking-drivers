from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class DatabaseConfig(BaseSettings):
    HOST: str
    PORT: int
    NAME: str
    USER: str
    PASSWORD: str

    model_config = SettingsConfigDict(
        env_prefix="DB_", env_file=".env", env_file_encoding="utf-8"
    )


@lru_cache
def _get_db_config() -> DatabaseConfig:
    return DatabaseConfig()  # type: ignore


_db = _get_db_config()  # type: ignore
DATABASE_URL: str = (
    f"postgresql+asyncpg://{_db.USER}:{_db.PASSWORD}@{_db.HOST}:{_db.PORT}/{_db.NAME}"
)


class RedisConfig(BaseSettings):
    HOST: str
    PORT: int

    model_config = SettingsConfigDict(
        env_prefix="REDIS_", env_file=".env", env_file_encoding="utf-8"
    )

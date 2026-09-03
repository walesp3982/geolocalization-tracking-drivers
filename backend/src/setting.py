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


class RedisConfig(BaseSettings):
    HOST: str
    PORT: int

    model_config = SettingsConfigDict(
        env_prefix="REDIS_", env_file=".env", env_file_encoding="utf-8"
    )

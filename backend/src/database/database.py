from collections.abc import AsyncGenerator

from pydantic_settings import BaseSettings
from sqlalchemy.ext.asyncio import (
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)
from sqlalchemy.orm import DeclarativeBase


class Settings(BaseSettings):
    database_url: str = (
        "postgresql+asyncpg://root:@localhost:5432/"
        "geolocalization-tracking-drivers_db"
    )
    db_echo: bool = False

    class Config:
        env_file = ".env"


settings = Settings()

# Motor de base de datos asíncrono (driver asyncpg).
engine = create_async_engine(
    settings.database_url,
    echo=settings.db_echo,
    pool_pre_ping=True,  # evita usar conexiones que el server ya cerró
)

SessionLocal = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False,
)


class Base(DeclarativeBase):
    """Base declarativa ORM."""
    pass


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """Dependencia de FastAPI: entrega una sesión y garantiza su cierre."""
    async with SessionLocal() as session:
        yield session
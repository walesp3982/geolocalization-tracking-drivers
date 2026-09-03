##Descargamos el asyncpg: pip install asyncpg
#para poder usar el driver asíncrono de PostgreSQL con SQLAlchemy.up
from collections.abc import AsyncGenerator
 
from sqlalchemy.ext.asyncio import (
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)
from sqlalchemy.orm import DeclarativeBase
 
# Conexión con PostgreSQL (driver asíncrono asyncpg).
# Ajustá usuario, password, host, puerto y nombre de BD según tu entorno.
SQLALCHEMY_DATABASE_URL = (
    "postgresql+asyncpg://root:@localhost:5432/"
    "geolocalization-tracking-drivers_db"
)
 
# Motor de base de datos asíncrono.
# echo=True es útil en desarrollo (loguea el SQL generado); desactivalo en producción.
engine = create_async_engine(SQLALCHEMY_DATABASE_URL, echo=True)
 
# Factory de sesiones asíncronas.
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
 

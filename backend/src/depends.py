from collections.abc import AsyncGenerator, Generator
from functools import lru_cache
from typing import Annotated

from fastapi import Depends
from redis.asyncio import Redis
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from src.setting import DatabaseConfig, RedisConfig


@lru_cache
def _get_db_config() -> DatabaseConfig:

    return DatabaseConfig()  # type: ignore


@lru_cache
def _get_redis_config() -> RedisConfig:
    return RedisConfig()  # type: ignore


_db = _get_db_config()  # type: ignore
_engine = create_async_engine(
    f"postgresql+asyncpg://{_db.USER}:{_db.PASSWORD}@{_db.HOST}:{_db.PORT}/{_db.NAME}",
    pool_pre_ping=True,
)
_SessionMaker = async_sessionmaker(autocommit=False, autoflush=False, bind=_engine)


async def _get_db() -> AsyncGenerator[AsyncSession, None]:
    session = _SessionMaker()
    try:
        yield session
        await session.commit()
    except Exception:
        await session.rollback()
        raise
    finally:
        await session.close()


DatabaseSession = Annotated[AsyncSession, Depends(_get_db)]


@lru_cache
def _get_redis_pool() -> Redis:
    config = _get_redis_config()  # type: ignore
    return Redis(host=config.HOST, port=config.PORT)  # type: ignore


def _get_redis() -> Generator[Redis, None, None]:
    yield _get_redis_pool()


RedisClient = Annotated[Redis, Depends(_get_redis)]

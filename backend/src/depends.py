from collections.abc import Generator
from functools import lru_cache
from typing import Annotated

from fastapi import Depends
from redis import Redis
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker

from src.setting import DatabaseConfig, RedisConfig


@lru_cache
def _get_db_config() -> DatabaseConfig:

    return DatabaseConfig()  # type: ignore


@lru_cache
def _get_redis_config() -> RedisConfig:
    return RedisConfig()  # type: ignore


_db = _get_db_config()  # type: ignore
_engine = create_engine(
    f"postgresql+psycopg://{_db.USER}:{_db.PASSWORD}@{_db.HOST}:{_db.PORT}/{_db.NAME}",
    pool_pre_ping=True,
)
_SessionMaker = sessionmaker(autocommit=False, autoflush=False, bind=_engine)


def _get_db() -> Generator[Session, None, None]:
    session = _SessionMaker()
    try:
        yield session
        session.commit()
    except Exception:
        session.rollback()
        raise
    finally:
        session.close()


DatabaseSession = Annotated[Session, Depends(_get_db)]


@lru_cache
def _get_redis_pool() -> Redis:
    config = _get_redis_config()  # type: ignore
    return Redis(host=config.HOST, port=config.PORT)  # type: ignore


def _get_redis() -> Generator[Redis, None, None]:
    yield _get_redis_pool()


RedisClient = Annotated[Redis, Depends(_get_redis)]

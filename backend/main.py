import asyncio
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI
from scalar_fastapi import Theme, add_scalar_reference

from src.api.router import admin, auth, conductor, jefe_grupo, websocket
from src.depends import DatabaseSession, _get_redis_pool


@asynccontextmanager
async def lifespan(_: FastAPI) -> AsyncIterator[None]:
    reaper_task = asyncio.create_task(websocket.tracking_reaper(_get_redis_pool()))
    try:
        yield
    finally:
        reaper_task.cancel()
        try:
            await reaper_task
        except asyncio.CancelledError:
            pass


app = FastAPI(
    lifespan=lifespan,
    servers=[
        {"url": "http://localhost:8000", "description": "Local dev"},
    ],
)
app.include_router(auth.router)
app.include_router(jefe_grupo.router)
app.include_router(admin.router)
app.include_router(conductor.router)
app.include_router(websocket.router)

add_scalar_reference(app, theme=Theme.DEEP_SPACE)


@app.get("/")
def say_hello(get_db: DatabaseSession):
    return {"message": "The database working!"}

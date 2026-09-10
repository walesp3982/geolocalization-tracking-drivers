from fastapi import FastAPI
from scalar_fastapi import Theme, add_scalar_reference

from src.api.router import admin, auth, conductor, jefe_grupo
from src.depends import DatabaseSession

app = FastAPI(
    servers=[
        {"url": "http://localhost:8000", "description": "Local dev"},
    ]
)
app.include_router(auth.router)
app.include_router(jefe_grupo.router)
app.include_router(admin.router)
app.include_router(conductor.router)
add_scalar_reference(app, theme=Theme.DEEP_SPACE)


@app.get("/")
def say_hello(get_db: DatabaseSession):
    return {"message": "The database working!"}

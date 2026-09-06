from fastapi import FastAPI
from scalar_fastapi import Theme, add_scalar_reference

from src.api.router import auth, chofer
from src.depends import DatabaseSession

app = FastAPI()
app.include_router(auth.router)
app.include_router(chofer.router)

add_scalar_reference(app, theme=Theme.DEEP_SPACE)


@app.get("/")
def say_hello(get_db: DatabaseSession):
    return {"message": "The database working!"}

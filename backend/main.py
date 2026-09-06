from fastapi import FastAPI
from scalar_fastapi import Theme, add_scalar_reference

from src.depends import DatabaseSession

app = FastAPI()

add_scalar_reference(app, theme=Theme.DEEP_SPACE)


@app.get("/")
def say_hello(get_db: DatabaseSession):
    return {"message": "The database working!"}

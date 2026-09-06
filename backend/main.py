from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from scalar_fastapi import Theme, add_scalar_reference

from src.api import tracking
from src.depends import DatabaseSession

app = FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(tracking.router)


add_scalar_reference(app, theme=Theme.DEEP_SPACE)


@app.get("/")
def say_hello(get_db: DatabaseSession):
    return {"message": "The database working!"}

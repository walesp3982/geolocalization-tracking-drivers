from fastapi import FastAPI
from scalar_fastapi import Theme, add_scalar_reference

app = FastAPI()

add_scalar_reference(app, theme=Theme.DEEP_SPACE)

@app.get("/")
def say_hello():
    return {"message": "Hello, World!"}
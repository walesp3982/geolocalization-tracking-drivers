import datetime
import json

from fastapi import APIRouter, WebSocket

router = APIRouter(
    tags=["Websocket"],
)


@router.websocket("/tracking")
async def send_location(ws: WebSocket):
    await ws.accept()

    while True:
        data = await ws.receive_text()
        location = json.loads(data)

        print(
            f"{location.latitude} : {location.longituted} : {location.timestamps} for mobile : {datetime.datetime.now(datetime.UTC)}"
        )

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

router = APIRouter(
    tags=["Websocket"],
)


@router.websocket("/tracking")
async def send_location(ws: WebSocket):
    await ws.accept()
    try:
        while True:
            data = await ws.receive_text()
            print(data)
    except WebSocketDisconnect:
        print("Websocket missing")

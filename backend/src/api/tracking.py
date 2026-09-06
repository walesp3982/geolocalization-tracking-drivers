from datetime import UTC, datetime

from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from pydantic import BaseModel, TypeAdapter, ValidationError

from src.depends import DatabaseSession, RedisClient

router = APIRouter(prefix="/tracking", tags=["tracking"])


@router.get("/token-session")
async def get_token_session(session: DatabaseSession):

    pass


class Location(BaseModel):
    latitude: float
    longitude: float
    timestamp: datetime


ListLocation = TypeAdapter(list[Location])


class OutputLocation(Location):
    latency: float

    @staticmethod
    def from_location(input_location: Location) -> "OutputLocation":
        latency = datetime.now(tz=UTC) - input_location.timestamp
        latency = latency.total_seconds() * 1000
        return OutputLocation(
            latitude=input_location.latitude,
            longitude=input_location.longitude,
            timestamp=input_location.timestamp,
            latency=abs(latency),
        )


ListOutputLocation = TypeAdapter(list[OutputLocation])


## Deveploment
CAR_ID = "ASDF1234"


def namespace_redis_tracking(car_id: str) -> str:
    return f"tracking:{car_id}"


@router.websocket("/session")
async def get_tracking(
    websocket: WebSocket,
    session: DatabaseSession,
    memory: RedisClient,
):
    await websocket.accept()
    print("Starting connection...")
    try:
        while True:
            data = await websocket.receive_json()
            try:
                data = ListLocation.validate_python(data)
            except ValidationError:
                print("Invalidated location")
                continue

            data_saved = await memory.get(namespace_redis_tracking(CAR_ID))
            locations_saved: list[OutputLocation]
            if data_saved:
                locations_saved = ListOutputLocation.validate_json(data_saved)
            else:
                locations_saved = []

            new_locations = [OutputLocation.from_location(l) for l in data]

            locations_saved = locations_saved + new_locations
            print("Saving data...")

            await websocket.send_bytes(ListOutputLocation.dump_json(locations_saved))
            await memory.set(
                namespace_redis_tracking(CAR_ID),
                ListOutputLocation.dump_json(locations_saved),
            )
    except WebSocketDisconnect:
        pass

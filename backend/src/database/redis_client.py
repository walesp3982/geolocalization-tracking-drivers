import asyncio
import datetime
import secrets

from pydantic import BaseModel
from pydantic_extra_types.coordinate import Coordinate, Latitude, Longitude
from redis.asyncio import Redis

"""
Redis configuration to Location Realtime
"""


class Location(BaseModel):
    coordinate: Coordinate | None
    time: datetime.datetime


class LocationList(BaseModel):
    locations: list[Location]


def create_namespace_car(id_car: str) -> str:
    return f"location_car:{id_car}"


async def get_locations_from_redis(redis_client: Redis, id_car: str) -> LocationList:
    location_json = await redis_client.get(create_namespace_car(id_car))
    if location_json is None:
        return LocationList(locations=[])
    return LocationList.model_validate_json(location_json)


async def save_location_in_redis(redis_client: Redis, id_car: str, location: Location):
    ## Expired in 24 hours the location will be deleted
    actual_location = await get_locations_from_redis(redis_client, id_car)
    actual_location.locations.append(location)
    await redis_client.set(
        create_namespace_car(id_car), actual_location.model_dump_json(), ex=60 * 60 * 24
    )


"""
Redis storage of web socket token for authentification
"""


def get_token_namespace(token: str) -> str:
    return f"ws_token:{token}"


async def generate_web_socket_token(redis_client: Redis, id_driver: str) -> str:
    token = secrets.token_urlsafe(32)
    await redis_client.set(get_token_namespace(token), id_driver, ex=60 * 5)
    return token


async def validate_web_socket_token(
    redis_client: Redis, id_driver: str, token: str
) -> bool:
    stored_token = await redis_client.get(get_token_namespace(token))
    if stored_token is None:
        return False
    return stored_token == id_driver


async def main():
    location = Location(
        coordinate=Coordinate(
            latitude=Latitude(-12.046374), longitude=Longitude(-77.042793)
        ),
        time=datetime.datetime.now(tz=datetime.timezone.utc),
    )
    redis = Redis(host="localhost", port=6379)
    await save_location_in_redis(redis, "car_1", location)
    data = await get_locations_from_redis(redis, "car_1")
    print(data.model_dump_json(indent=2))


if __name__ == "__main__":
    asyncio.run(main())

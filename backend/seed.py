import asyncio
import json
import logging
import random
import string
import uuid
from pathlib import Path
from typing import Any

from pydantic import BaseModel, Field
from pydantic_settings import BaseSettings, SettingsConfigDict
from shapely import to_wkt
from shapely.geometry import Point
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError, SQLAlchemyError
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from src.database import Administrator, Conductor, GrupoOperativo, PuntosControl, Ruta
from src.jwt.security import hash_password
from src.setting import DATABASE_URL


class CreateAdmin(BaseSettings):
    name: str
    password: str
    email: str

    model_config = SettingsConfigDict(
        env_file=".env", extra="ignore", env_prefix="ADMIN_"
    )


logger = logging.getLogger("SEEDING")
logger.setLevel(logging.INFO)


formatter = logging.Formatter("%(asctime)s - %(name)s - %(levelname)s - %(message)s")
# Consola
console_handler = logging.StreamHandler()
console_handler.setFormatter(formatter)

# Archivo
file_handler = logging.FileHandler("seed.log", encoding="utf-8")
file_handler.setFormatter(formatter)


logger.addHandler(console_handler)
logger.addHandler(file_handler)


async def create_new_administrator(session: AsyncSession):
    admin_load = CreateAdmin()  # pyright: ignore[reportCallIssue]

    # First if exist in the database
    stmt = select(Administrator).where(Administrator.email == admin_load.email)
    admin = await session.scalar(stmt)

    if admin:
        logger.warning("Admin found in the database...No creating admin")
        return

    admin = Administrator(
        name=admin_load.name,
        email=admin_load.email,
        password=hash_password(admin_load.password),
    )

    session.add(admin)
    await session.commit()
    logger.info("Admin created correctly")


class CreateConductor(BaseModel):
    name: str
    telefono: str
    password: str
    activo: bool = True


class CreatePointRouter(BaseModel):
    radio: float = Field(gt=0)
    ubication: str


class CreateRoute(BaseModel):
    number_route: str
    lugar_inicial: str
    lugar_final: str
    tiempo_estimado: int
    line: dict[str, Any]
    points: list[CreatePointRouter] = []


class CreateGruposOperativo(BaseModel):
    nombre_grupo: str
    representante: CreateConductor | None = None
    choferes: list[CreateConductor] = []
    rutas: list[CreateRoute] = []


FATHER_PATH = Path(__file__).resolve().parent
FOLDER_ROUTER = FATHER_PATH / "routes"


def loads_data(path: str) -> dict[str, Any]:
    with open(path, "r", encoding="utf-8") as file:
        return json.load(file)


GRUPOS_OPERATIVOS: list[CreateGruposOperativo] = [
    CreateGruposOperativo(
        nombre_grupo="Grupo 1",
        representante=CreateConductor(
            name="Esteban", password="password", telefono="3834834"
        ),
        choferes=[
            CreateConductor(
                name="Carlos Mamani", password="password", telefono="+234894238"
            ),
            CreateConductor(
                name="Andres Apaza", password="password", telefono="384838334"
            ),
            CreateConductor(
                name="Alvaro Espinoza",
                password="password",
                telefono="3883483",
                activo=False,
            ),
        ],
        rutas=[
            CreateRoute(
                lugar_inicial="Universidad Salesiana de Bolivia",
                lugar_final="Teleférico Amarillo",
                tiempo_estimado=45,
                number_route="CH",
                line=loads_data(str(FOLDER_ROUTER / "test.geojson")),
                points=[
                    CreatePointRouter(
                        ubication=to_wkt(Point(-68.1498714, -16.4778718)), radio=50
                    ),
                    CreatePointRouter(
                        ubication=to_wkt(Point(-68.1445853, -16.4887826)), radio=50
                    ),
                    CreatePointRouter(
                        ubication=to_wkt(Point(-68.1442078, -16.4936934)), radio=50
                    ),
                    CreatePointRouter(
                        ubication=to_wkt(Point(-68.1444671, -16.4988971)), radio=50
                    ),
                    CreatePointRouter(
                        ubication=to_wkt(Point(-68.1427762, -16.5072862)), radio=50
                    ),
                    CreatePointRouter(
                        ubication=to_wkt(Point(-68.1436114, -16.5151328)), radio=50
                    ),
                ],
            ),
            CreateRoute(
                lugar_inicial="Teleférico Amarillo",
                lugar_final="Universidad Salesiana de Bolivia",
                tiempo_estimado=45,
                number_route="CH",
                line=loads_data(str(FOLDER_ROUTER / "test.geojson")),
                points=[
                    CreatePointRouter(
                        ubication=to_wkt(Point(-68.1436114, -16.5151328)), radio=50
                    ),
                    CreatePointRouter(
                        ubication=to_wkt(Point(-68.1427762, -16.5072862)), radio=50
                    ),
                    CreatePointRouter(
                        ubication=to_wkt(Point(-68.1444671, -16.4988971)), radio=50
                    ),
                    CreatePointRouter(
                        ubication=to_wkt(Point(-68.1442078, -16.4936934)), radio=50
                    ),
                    CreatePointRouter(
                        ubication=to_wkt(Point(-68.1445853, -16.4887826)), radio=50
                    ),
                    CreatePointRouter(
                        ubication=to_wkt(Point(-68.1498714, -16.4778718)), radio=50
                    ),
                ],
            ),
        ],
    ),
    CreateGruposOperativo(nombre_grupo="Grupo 16 de Julio"),
]


def gen_code_chofer() -> str:
    alpha_part = "".join(random.choices(string.ascii_letters, k=4)).upper()
    numeric_part = "".join(random.choices(string.digits, k=4))
    return alpha_part + numeric_part


async def saved_conductor(
    session: AsyncSession, conductor: CreateConductor, grupo_id: int
) -> int | None:
    stmt = select(Conductor).where(Conductor.nombre == conductor.name)
    c = await session.scalar(stmt)
    if c:
        logger.warning(
            f"Conductor found in database. Don't saved, name conductor: {conductor.name}"
        )
        return

    c = Conductor(
        code=gen_code_chofer(),
        id_grupo=grupo_id,
        nombre=conductor.name,
        password=hash_password(conductor.password),
        telefono=conductor.telefono,
        idem_key=uuid.uuid4(),
    )

    session.add(c)
    await session.commit()
    await session.refresh(c)
    logger.info(
        f"adding conductor {c.nombre} with id: {c.id_grupo} with code: {c.code}"
    )
    return c.id_grupo


async def create_points_by_group(
    session: AsyncSession, points: list[CreatePointRouter], id_ruta: int
) -> None:
    for i, point in enumerate(points):
        saving_point = PuntosControl(
            radio=point.radio,
            n_puntos_relativo=i + 1,
            ubication=point.ubication,
            id_ruta=id_ruta,
        )
        session.add(saving_point)
        logger.info(f" - Adding point #{i + 1} for route {id_ruta} ")
    await session.commit()
    logger.info(f"Finished points control for route {id_ruta}")


async def create_route_by_group(
    session: AsyncSession, input_data: CreateRoute, group_id: int
) -> None:
    try:
        route = Ruta(
            id_grupo_operativo=group_id,
            line=input_data.line,
            lugar_final=input_data.lugar_final,
            lugar_inicial=input_data.lugar_inicial,
            numero_ruta=input_data.number_route,
            tiempo_estimado=input_data.tiempo_estimado,
        )

        session.add(route)
        await session.commit()

        await session.refresh(route)
        logger.info(
            f"Creating router: [{route.lugar_inicial} - {route.lugar_final}] with id {route.id_ruta}"
        )
        await create_points_by_group(session, input_data.points, route.id_ruta)
    except IntegrityError as e:
        logger.error(f"Error in creating router {e}")
    except SQLAlchemyError as e:
        logger.error(f"Error unexpected: {e}")


async def create_operatives_groups(
    session: AsyncSession, grupos: list[CreateGruposOperativo]
) -> None:
    for grupo in grupos:
        stmt = select(GrupoOperativo).where(
            GrupoOperativo.nombre_grupo == grupo.nombre_grupo
        )
        saved_group = await session.scalar(stmt)

        if saved_group:
            logger.warning(f"Group found in database: {grupo.nombre_grupo}")
            continue

        saved_group = GrupoOperativo(nombre_grupo=grupo.nombre_grupo)
        session.add(saved_group)
        await session.commit()
        logger.info(
            f"Add group: {saved_group.nombre_grupo} with id: {saved_group.id_grupo} "
        )
        await session.refresh(saved_group)

        for c in grupo.choferes:
            await saved_conductor(session, c, saved_group.id_grupo)

        if grupo.representante:
            logger.info("Agregando representante: ")
            id = await saved_conductor(
                session, grupo.representante, saved_group.id_grupo
            )
            if not id:
                logger.warning("Failed to creating representante")
            saved_group.id_representante = id
            await session.commit()

            logger.info("Updating representante in saved_group")

        for r in grupo.rutas:
            await create_route_by_group(session, r, saved_group.id_grupo)


async def main() -> None:
    engine = create_async_engine(url=DATABASE_URL)
    async_session = async_sessionmaker(engine, expire_on_commit=False)

    async with async_session() as session:
        logger.info("Initialization...")
        await create_new_administrator(session)
        await create_operatives_groups(session, GRUPOS_OPERATIVOS)
        logger.info("Finished")
        await session.close()


if __name__ == "__main__":
    asyncio.run(main())

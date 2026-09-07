import asyncio
import logging
import random
import string

from pydantic import BaseModel
from pydantic_settings import BaseSettings, SettingsConfigDict
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from src.database import Administrator, Conductor, GrupoOperativo
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


class CreateGruposOperativo(BaseModel):
    nombre_grupo: str
    representante: CreateConductor | None = None
    choferes: list[CreateConductor] = []


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
    )

    session.add(c)
    await session.commit()
    await session.refresh(c)
    logger.info(
        f"adding conductor {c.nombre} with id: {c.id_grupo} with code: {c.code}"
    )
    return c.id_grupo


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

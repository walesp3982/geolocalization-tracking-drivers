import asyncio
import datetime
import subprocess

import asyncpg

"""
Usar en el folder backend
"""


def print_progress(title: str) -> None:
    print(f"[] {datetime.datetime.now()} - {title}")  # noqa: DTZ005


async def esperar_postgres(
    host: str = "localhost",
    port: int = 5433,
    user: str = "postgres",
    password: str = "postgres",
    database: str = "mydb",
    timeout_total: int = 30,
) -> bool:
    print_progress("Esperando a que PostgreSQL esté listo...")

    inicio = asyncio.get_running_loop().time()

    while True:
        try:
            conn = await asyncpg.connect(
                host=host,
                port=port,
                user=user,
                password=password,
                database=database,
            )

            await conn.close()

            print_progress("¡PostgreSQL está listo para aceptar conexiones!")
            return True

        except (OSError, asyncpg.PostgresError) as error:
            if asyncio.get_running_loop().time() - inicio > timeout_total:
                print_progress(f"❌ Tiempo agotado esperando PostgreSQL: {error}")
                return False

            await asyncio.sleep(1)


def main():
    # Deshabilitar el docker compose
    subprocess.run(["docker", "compose", "down"], check=False, text=True)
    print_progress("Apagando servidor docker...")
    # Delete docker volume
    subprocess.run(
        ["docker", "volume", "rm", "backend_postgres_data"], check=False, text=True
    )
    print_progress("Eliminando volumen existente")

    # Levatar el docker compose
    subprocess.run(["docker", "compose", "up", "-d"], check=True, text=True)
    print_progress("Levantando docker compose")

    if not asyncio.run(esperar_postgres()):
        print_progress("No se puedo acceder a postgresql")
        return

    # Run migration
    subprocess.run(["alembic", "upgrade", "head"], check=True, text=True)
    print_progress("Corriendo migraciones")

    # Run seed
    subprocess.run(["uv", "run", "seed.py"], check=True, text=True)
    print_progress("Iniciando seed con valores iniciales")


if __name__ == "__main__":
    main()

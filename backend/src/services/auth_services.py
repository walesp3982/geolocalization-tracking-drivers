from sqlalchemy import select
from sqlalchemy.orm import Session

from  import Conductor
from app.models.grupo_operativo import GrupoOperativo

from app.schemas.auth import RolConductor

from app.core.security import (
    verify_password,
    create_access_token,
)


def autenticar_conductor(
    db: Session,
    id_conductor: int,
    password: str,
):
    """
    Busca al conductor por su ID y verifica su contraseña.

    También comprueba que el conductor esté activo.
    Si alguna validación falla, devuelve None.
    """

    # Busca un conductor cuyo ID coincida con el recibido
    # desde la pantalla de inicio de sesión.
    resultado = db.execute(
        select(Conductor).where(
            Conductor.id_conductor == id_conductor
        )
    )

    # Obtiene el conductor encontrado o None si no existe.
    conductor = resultado.scalar_one_or_none()

    # Si el conductor no existe, la autenticación falla.
    if conductor is None:
        return None

    # Compara la contraseña enviada con la contraseña
    # almacenada en la base de datos.
    #
    # verify_password debe ser la función que ya tienes
    # configurada en tu archivo security.py.
    if not verify_password(password, conductor.password):
        return None

    # Impide que un conductor inactivo pueda iniciar sesión.
    if not conductor.activo:
        return None

    # Si todas las validaciones fueron correctas,
    # devuelve el objeto conductor autenticado.
    return conductor


def obtener_grupo_conductor(
    db: Session,
    conductor: Conductor,
):
    """
    Obtiene el grupo operativo al que pertenece
    el conductor autenticado.
    """

    # Busca el grupo cuyo ID sea igual al id_grupo
    # registrado en el conductor.
    resultado = db.execute(
        select(GrupoOperativo).where(
            GrupoOperativo.id_grupo == conductor.id_grupo
        )
    )

    # Devuelve el grupo encontrado o None si no existe.
    return resultado.scalar_one_or_none()


def determinar_rol_conductor(
    conductor: Conductor,
    grupo: GrupoOperativo,
) -> RolConductor:
    """
    Determina si el conductor es jefe de grupo
    o conductor común.

    La comparación se realiza utilizando:
        grupo.id_representante
        conductor.id_conductor
    """

    # Este es el punto donde se determina el jefe de grupo.
    #
    # Si el ID del conductor coincide con el ID del
    # representante registrado en su grupo, significa
    # que ese conductor es el jefe del grupo.
    if grupo.id_representante == conductor.id_conductor:
        return RolConductor.JEFE_GRUPO

    # Si los IDs no coinciden, el conductor pertenece
    # al grupo, pero no es su jefe.
    return RolConductor.CONDUCTOR


def generar_token_conductor(
    conductor: Conductor,
    rol: RolConductor,
):
    """
    Genera el token JWT del conductor autenticado.

    Se utiliza la función create_access_token que ya
    tienes configurada en tu archivo security.py.
    """

    # Estos datos se guardan dentro del token.
    # No se crean columnas nuevas en la base de datos.
    datos_token = {
        # sub identifica al usuario principal del token.
        "sub": str(conductor.id_conductor),

        # ID del conductor autenticado.
        "id_conductor": conductor.id_conductor,

        # Grupo al que pertenece el conductor.
        "id_grupo": conductor.id_grupo,

        # Rol calculado según id_representante.
        "rol": rol.value,
    }

    # Genera y devuelve el JWT utilizando
    # la configuración existente del proyecto.
    return create_access_token(data=datos_token)
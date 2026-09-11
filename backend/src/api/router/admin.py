
from fastapi import Depends,HTTPException, status, APIRouter

from pydantic import BaseModel, ConfigDict, EmailStr, Field

from typing import Annotated

from sqlalchemy import select

# Ajustá estos imports a la ubicación real de tus módulos:
from src.database.models import Administrator, Conductor, GrupoOperativo
from src.jwt.security import verify_password, hash_password

from src.api.deps import DatabaseSession, GetAdministrator
from src.depends import DatabaseSession
# ====================================================================
# [1] SCHEMAS (Pydantic) -> irían en app/schemas/admin.py
# ====================================================================
# Estos son los "moldes" de entrada/salida de datos. El frontend (React
# Native) va a mandar JSON que matchea los "Request" y va a recibir JSON
# con la forma de los "Response"/"Out".



class AdminCambiarPassword(BaseModel):
    """Body para PATCH /admin/cambiar_password"""
    password_actual: str
    password_nueva: str = Field(..., min_length=6)


class ConductorDatosBase(BaseModel):
    """Datos mínimos para dar de alta un Conductor nuevo."""
    code: str = Field(..., max_length=10, description="Código interno del conductor")
    nombre: str = Field(..., max_length=120)
    telefono: str | None = Field(default=None, max_length=20)
    password: str = Field(..., min_length=6, description="Password en texto plano, se hashea en el server")


class GrupoOperativoCreate(BaseModel):
    """
    Body para POST /admin/grupos-operativos
    Crea el grupo y, en la misma operación, crea al conductor que será
    su representante.
    """
    nombre_grupo: str = Field(..., max_length=20)
    representante: ConductorDatosBase


class CambiarRepresentanteNuevo(BaseModel):
    """
    Body para PUT /admin/grupos-operativos/{id_grupo}/representante/nuevo-conductor
    Crea un Conductor nuevo y lo asigna como representante del grupo.
    """
    conductor: ConductorDatosBase


class CambiarRepresentanteExistente(BaseModel):
    """
    Body para PUT /admin/grupos-operativos/{id_grupo}/representante/conductor-existente
    Usa un Conductor que ya existe en la base y lo asigna como representante.
    """
    id_conductor: int = Field(..., description="Debe pertenecer al mismo id_grupo")




class ConductorOut(BaseModel):
    """Representación pública de un Conductor (lo que ve el frontend)."""
    model_config = ConfigDict(from_attributes=True)  # permite construir desde el modelo ORM

    id_conductor: int
    code: str
    nombre: str
    telefono: str | None
    activo: bool
    id_grupo: int


class GrupoOperativoOut(BaseModel):
    """Representación pública de un Grupo Operativo, incluye su representante."""
    model_config = ConfigDict(from_attributes=True)

    id_grupo: int
    nombre_grupo: str
    id_representante: int | None
    representante: ConductorOut | None = None  # se arma manualmente en el endpoint



class AdminOut(BaseModel):
    """Lo que se devuelve del administrador logueado (sin password)."""
    model_config = ConfigDict(from_attributes=True)

    id_administrador: int
    name: str
    email: EmailStr


# ====================================================================
# [3] DEPENDENCIAS -> irían en app/api/deps.py
# ====================================================================
# Acá va tal cual tu `get_current_admin`, más los "alias" que ya usabas
# (DatabaseSession, GetAdministrator) y un par de dependencias chicas
# que ayudan a no repetir código en los endpoints (traer el grupo por id,
# por ejemplo).
# Alias de tipo para no repetir `Depends(get_db)` en cada endpoint.


# Alias de tipo: cualquier endpoint que reciba `admin: GetAdministrator`
# ya viene con el Administrator autenticado inyectado y validado.


#Este iria en src/api/deps.py

async def get_grupo_operativo_o_404(
    id_grupo: int,
    db: DatabaseSession,
) -> GrupoOperativo:
    """
    Dependencia auxiliar: busca un Grupo Operativo por su id (viene de
    la URL, ej. /admin/grupos-operativos/{id_grupo}/...).
    Si no existe, corta con 404 antes de llegar al endpoint.
    """
    grupo = await db.get(GrupoOperativo, id_grupo)
    if grupo is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Grupo operativo no encontrado",
        )
    return grupo
GrupoOperativoPath = Annotated[GrupoOperativo, Depends(get_grupo_operativo_o_404)]


def es_representante(conductor: Conductor, grupo: GrupoOperativo) -> bool:
    """
    Implementa la regla que definiste:
    un conductor ES representante de un grupo solo si su id coincide
    con `grupo.id_representante`. Si no coincide, no lo es (y no tiene
    permisos de administrador sobre ese grupo).
    """
    return grupo.id_representante == conductor.id_conductor


# ====================================================================
# [4] ROUTER / ENDPOINTS -> irían en app/api/routers/admin.py
# ====================================================================

# --------------------------------------------------------------------
# 4.1) CAMBIAR CONTRASEÑA DEL ADMINISTRADOR
# --------------------------------------------------------------------
router = APIRouter(prefix="/admin", tags=["Administrador"])


@router.get("/")
async def get_info(admin: GetAdministrator):
    return admin


@router.patch("/cambiar_password", response_model=AdminOut)
async def cambiar_password_admin(
    body: AdminCambiarPassword,
    admin: GetAdministrator,   # <- ya viene autenticado gracias a la dependencia
    db: DatabaseSession,
) -> Administrator:
    """
    El administrador logueado cambia su propia contraseña.
    Flujo:
      1. Verifica que `password_actual` matchee con el hash guardado.
      2. Si matchea, hashea `password_nueva` y la guarda.
      3. Devuelve los datos del admin (sin exponer el hash).
    """
    if not verify_password(body.password_actual, admin.password):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="La contraseña actual no es correcta",
        )

    admin.password = hash_password(body.password_nueva)
    db.add(admin)
    await db.commit()
    await db.refresh(admin)
    return admin


# --------------------------------------------------------------------
# 4.2) CREAR GRUPO OPERATIVO + REPRESENTANTE (conductor nuevo)
# --------------------------------------------------------------------
@router.post(
    "/crear/grupo_operativo",
    response_model=GrupoOperativoOut,
    status_code=status.HTTP_201_CREATED,
)
async def crear_grupo_operativo(
    body: GrupoOperativoCreate,
    admin: GetAdministrator,  # protege el endpoint: solo admin puede crear grupos
    db: DatabaseSession,
) -> GrupoOperativoOut:
    """
    Crea un Grupo Operativo junto con su representante (un Conductor
    nuevo), resolviendo la referencia circular entre las tablas
    `grupo_operativo` y `conductor`:

      Paso 1: se crea el GrupoOperativo SIN representante (id_representante
              queda NULL), porque necesitamos su `id_grupo` autogenerado
              antes de poder crear al conductor (conductor.id_grupo es
              NOT NULL).
      Paso 2: se crea el Conductor usando ese id_grupo recién generado.
      Paso 3: se actualiza el GrupoOperativo seteando
              id_representante = id del conductor recién creado.
    """
    # -- Validaciones de duplicados --
    ya_existe_grupo = await db.scalar(
        select(GrupoOperativo).where(GrupoOperativo.nombre_grupo == body.nombre_grupo)
    )
    if ya_existe_grupo:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Ya existe un grupo operativo con ese nombre",
        )

    ya_existe_conductor = await db.scalar(
        select(Conductor).where(Conductor.nombre == body.representante.nombre)
    )
    if ya_existe_conductor:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Ya existe un conductor con ese nombre",
        )

    try:
        # Paso 1: grupo sin representante todavía
        nuevo_grupo = GrupoOperativo(nombre_grupo=body.nombre_grupo)
        db.add(nuevo_grupo)
        await db.flush()  # genera nuevo_grupo.id_grupo sin cerrar la transacción

        # Paso 2: conductor apuntando al grupo recién creado
        datos = body.representante
        nuevo_conductor = Conductor(
            code=datos.code,
            nombre=datos.nombre,
            telefono=datos.telefono,
            password=hash_password(datos.password),
            id_grupo=nuevo_grupo.id_grupo,
        )
        db.add(nuevo_conductor)
        await db.flush()  # genera nuevo_conductor.id_conductor

        # Paso 3: el grupo ahora sí apunta a su representante
        nuevo_grupo.id_representante = nuevo_conductor.id_conductor

        await db.commit()
        await db.refresh(nuevo_grupo)
        await db.refresh(nuevo_conductor)
    except Exception:
        await db.rollback()
        raise

    # Armamos la respuesta incluyendo el representante embebido.
    return GrupoOperativoOut(
        id_grupo=nuevo_grupo.id_grupo,
        nombre_grupo=nuevo_grupo.nombre_grupo,
        id_representante=nuevo_grupo.id_representante,
        representante=ConductorOut.model_validate(nuevo_conductor),
    )


# --------------------------------------------------------------------
# 4.3) CAMBIAR REPRESENTANTE -> opción A: creando un conductor NUEVO
# --------------------------------------------------------------------
@router.put(
    "/crear/grupo_operativo/{id_grupo}/representante/nuevo-conductor",
    response_model=GrupoOperativoOut,
)
async def cambiar_representante_con_conductor_nuevo(
    body: CambiarRepresentanteNuevo,
    grupo: GrupoOperativoPath,   # ya validado que existe (404 si no)
    admin: GetAdministrator,
    db: DatabaseSession,
) -> GrupoOperativoOut:
    """
    Da de alta un Conductor nuevo DENTRO del grupo indicado en la URL
    y lo convierte en el representante de ese grupo (pisando al
    representante anterior, si había uno).
    """
    datos = body.conductor

    ya_existe_conductor = await db.scalar(
        select(Conductor).where(Conductor.nombre == datos.nombre)
    )
    if ya_existe_conductor:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Ya existe un conductor con ese nombre",
        )

    nuevo_conductor = Conductor(
        code=datos.code,
        nombre=datos.nombre,
        telefono=datos.telefono,
        password=hash_password(datos.password),
        id_grupo=grupo.id_grupo,  # pertenece al grupo de la URL
    )
    db.add(nuevo_conductor)
    await db.flush()  # para tener nuevo_conductor.id_conductor

    # Lo seteamos como representante del grupo.
    grupo.id_representante = nuevo_conductor.id_conductor
    db.add(grupo)

    await db.commit()
    await db.refresh(grupo)
    await db.refresh(nuevo_conductor)

    return GrupoOperativoOut(
        id_grupo=grupo.id_grupo,
        nombre_grupo=grupo.nombre_grupo,
        id_representante=grupo.id_representante,
        representante=ConductorOut.model_validate(nuevo_conductor),
    )


# --------------------------------------------------------------------
# 4.4) CAMBIAR REPRESENTANTE -> opción B: usando un conductor EXISTENTE
# --------------------------------------------------------------------
@router.put(
    "/grupos_operativos/{id_grupo}/representante/conductor_existente",
    response_model=GrupoOperativoOut,
)
async def cambiar_representante_con_conductor_existente(
    body: CambiarRepresentanteExistente,
    grupo: GrupoOperativoPath,
    admin: GetAdministrator,
    db: DatabaseSession,
) -> GrupoOperativoOut:
    """
    Asigna como representante a un Conductor que YA EXISTE en la base.
    Reglas:
      - El conductor debe existir (404 si no).
      - El conductor debe pertenecer al MISMO grupo operativo que se
        está editando (evita que un conductor de otro grupo termine
        "representando" a un grupo al que no pertenece).
    """
    conductor = await db.get(Conductor, body.id_conductor)
    if conductor is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Conductor no encontrado",
        )

    if conductor.id_grupo != grupo.id_grupo:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="El conductor no pertenece a este grupo operativo",
        )

    grupo.id_representante = conductor.id_conductor
    db.add(grupo)
    await db.commit()
    await db.refresh(grupo)

    return GrupoOperativoOut(
        id_grupo=grupo.id_grupo,
        nombre_grupo=grupo.nombre_grupo,
        id_representante=grupo.id_representante,
        representante=ConductorOut.model_validate(conductor),
    )


# --------------------------------------------------------------------
# 4.5) (Extra útil para el frontend) VER GRUPO + SABER QUIÉN ES REPRESENTANTE
# --------------------------------------------------------------------
@router.get(
    "/grupo_operativo/{id_grupo}",
    response_model=GrupoOperativoOut,
)
async def obtener_grupo_operativo(
    grupo: GrupoOperativoPath,
    admin: GetAdministrator,
    db: DatabaseSession,
) -> GrupoOperativoOut:
    """
    Devuelve el detalle de un grupo, incluyendo los datos del
    representante actual (o `null` si todavía no tiene).
    Útil para que React Native pinte la pantalla de "detalle de grupo".
    """
    representante_out = None
    if grupo.id_representante is not None:
        representante = await db.get(Conductor, grupo.id_representante)
        if representante is not None:
            representante_out = ConductorOut.model_validate(representante)

    return GrupoOperativoOut(
        id_grupo=grupo.id_grupo,
        nombre_grupo=grupo.nombre_grupo,
        id_representante=grupo.id_representante,
        representante=representante_out,
    )
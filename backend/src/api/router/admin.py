# cambios
import uuid
from typing import Annotated, Literal

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator
from sqlalchemy import delete, or_, select, update
from sqlalchemy.orm import selectinload

from src.api.deps import GetAdministrator

# Ajustá estos imports a la ubicación real de tus módulos:
from src.database.models import (
    Administrator,
    AsignacionRuta,
    Conductor,
    GrupoOperativo,
    PuntosControl,
    Recorrido,
    Ruta,
)
from src.depends import DatabaseSession
from src.jwt.security import hash_password, verify_password

# este iria en src/api/schemas/admin.py


class AdminCambiarPassword(BaseModel):
    """Body para PATCH /admin/cambiar_password"""

    password_actual: str
    password_nueva: str = Field(..., min_length=6)


class ConductorDatosBase(BaseModel):
    """Datos mínimos para dar de alta un Conductor nuevo."""

    code: str = Field(..., max_length=10)
    nombre: str = Field(..., max_length=120)
    telefono: str | None = Field(default=None, max_length=20)
    password: str = Field(..., min_length=6)


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

    model_config = ConfigDict(
        from_attributes=True
    )  # permite construir desde el modelo ORM

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


class GrupoRepresentanteInput(BaseModel):
    code: str | None = Field(default=None, max_length=10)
    nombre: str = Field(..., max_length=120)
    telefono: str | None = Field(default=None, max_length=20)
    password: str | None = Field(default=None, min_length=6)


class GrupoCreateInput(BaseModel):
    nombre: str = Field(..., max_length=20)
    lineas: list[str] = Field(default_factory=list)
    representante: GrupoRepresentanteInput | None = None


class GrupoUpdateInput(BaseModel):
    nombre: str = Field(..., max_length=20)
    lineas: list[str] | None = None
    representante: GrupoRepresentanteInput | None = None


class ConductorCreateInput(BaseModel):
    code: str = Field(..., max_length=10)
    nombre: str = Field(..., max_length=120)
    telefono: str | None = Field(default=None, max_length=20)
    password: str = Field(..., min_length=6)


class ConductorUpdateInput(BaseModel):
    nombre: str | None = Field(default=None, max_length=120)
    telefono: str | None = Field(default=None, max_length=20)


class GeoJSONLineString(BaseModel):
    type: Literal["LineString"]
    coordinates: list[tuple[float, float]] = Field(..., min_length=2)

    @field_validator("coordinates")
    @classmethod
    def validar_coordenadas(
        cls, coordinates: list[tuple[float, float]]
    ) -> list[tuple[float, float]]:
        for longitud, latitud in coordinates:
            if not -180 <= longitud <= 180 or not -90 <= latitud <= 90:
                raise ValueError(
                    "Las coordenadas deben ser [longitud, latitud] válidas"
                )
        return coordinates


class GeoJSONRouteFeature(BaseModel):
    type: Literal["Feature"]
    geometry: GeoJSONLineString


class PuntoControlInput(BaseModel):
    coordenadas: tuple[float, float]
    radio: float = Field(..., gt=0)
    n_puntos_relativo: int = Field(..., ge=1)

    @field_validator("coordenadas")
    @classmethod
    def validar_coordenadas(
        cls, coordinates: tuple[float, float]
    ) -> tuple[float, float]:
        longitud, latitud = coordinates
        if not -180 <= longitud <= 180 or not -90 <= latitud <= 90:
            raise ValueError("Las coordenadas deben ser [longitud, latitud] válidas")
        return coordinates


class RutaCreateInput(BaseModel):
    numero_ruta: str = Field(..., max_length=10)
    lugar_inicial: str = Field(..., max_length=100)
    lugar_final: str = Field(..., max_length=100)
    tiempo_estimado: int | None = Field(default=None, ge=1)
    geojson: GeoJSONRouteFeature
    puntos_control: list[PuntoControlInput] = Field(..., min_length=2)


class AdminOut(BaseModel):
    """Lo que se devuelve del administrador logueado (sin password)."""

    model_config = ConfigDict(from_attributes=True)

    id_administrador: int
    name: str
    email: EmailStr


# Este iria en src/api/deps.py


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


# endpoint de admin
router = APIRouter(prefix="/admin", tags=["Administrador"])


def serialize_grupo(grupo: GrupoOperativo, include_conductores: bool = False) -> dict:
    rutas = sorted(grupo.rutas, key=lambda ruta: ruta.numero_ruta)
    representante = grupo.representante
    payload = {
        "id": str(grupo.id_grupo),
        "nombre": grupo.nombre_grupo,
        "lineas": sorted({ruta.numero_ruta for ruta in rutas}),
        "representante": (
            {
                "nombre": representante.nombre,
                "telefono": representante.telefono or "",
            }
            if representante
            else None
        ),
        "choferes": [],
    }

    if include_conductores:
        rutas_asignadas_activas = {
            asignacion.id_ruta
            for conductor in grupo.conductores
            if conductor.activo
            for asignacion in conductor.asignaciones
            if asignacion.fecha_hora_fin is None
        }
        payload["rutasDisponibles"] = [
            {
                "id": str(ruta.id_ruta),
                "nombre": (
                    f"{ruta.numero_ruta}: {ruta.lugar_inicial} - {ruta.lugar_final}"
                ),
            }
            for ruta in rutas
            if ruta.id_ruta not in rutas_asignadas_activas
        ]
        payload["choferes"] = [
            {
                "id": str(conductor.id_conductor),
                "nombre": conductor.nombre,
                "activo": conductor.activo,
                "rutas": [
                    {
                        "id": str(asignacion.ruta.id_ruta),
                        "nombre": (
                            f"{asignacion.ruta.numero_ruta}: "
                            f"{asignacion.ruta.lugar_inicial} - "
                            f"{asignacion.ruta.lugar_final}"
                        ),
                        "horaInicio": asignacion.fecha_hora_inicio.strftime("%H:%M"),
                    }
                    for asignacion in conductor.asignaciones
                    if asignacion.ruta is not None
                ],
            }
            for conductor in grupo.conductores
        ]

    return payload


async def load_grupo(db: DatabaseSession, id_grupo: int, include_conductores: bool):
    options = [
        selectinload(GrupoOperativo.representante),
        selectinload(GrupoOperativo.rutas),
    ]
    if include_conductores:
        options.append(
            selectinload(GrupoOperativo.conductores)
            .selectinload(Conductor.asignaciones)
            .selectinload(AsignacionRuta.ruta)
        )

    stmt = (
        select(GrupoOperativo)
        .where(GrupoOperativo.id_grupo == id_grupo)
        .options(*options)
    )
    return await db.scalar(stmt)


def serialize_conductor(conductor: Conductor) -> dict:
    asignaciones = sorted(
        conductor.asignaciones,
        key=lambda asignacion: asignacion.fecha_hora_inicio,
        reverse=True,
    )
    return {
        "id": str(conductor.id_conductor),
        "code": conductor.code,
        "nombre": conductor.nombre,
        "telefono": conductor.telefono,
        "activo": conductor.activo,
        "id_grupo": str(conductor.id_grupo),
        "rutas": [
            {
                "id": str(asignacion.ruta.id_ruta),
                "nombre": (
                    f"{asignacion.ruta.numero_ruta}: "
                    f"{asignacion.ruta.lugar_inicial} - "
                    f"{asignacion.ruta.lugar_final}"
                ),
                "horaInicio": asignacion.fecha_hora_inicio.strftime("%H:%M"),
            }
            for asignacion in asignaciones
            if asignacion.ruta is not None
        ],
    }


async def load_conductor(db: DatabaseSession, id_grupo: int, id_conductor: int):
    stmt = (
        select(Conductor)
        .where(
            Conductor.id_grupo == id_grupo,
            Conductor.id_conductor == id_conductor,
        )
        .options(selectinload(Conductor.asignaciones).selectinload(AsignacionRuta.ruta))
    )
    return await db.scalar(stmt)


@router.post(
    "/grupos-operativos/{id_grupo}/conductores",
    status_code=status.HTTP_201_CREATED,
)
async def crear_conductor_admin(
    id_grupo: int,
    body: ConductorCreateInput,
    admin: GetAdministrator,
    db: DatabaseSession,
) -> dict:
    grupo = await db.get(GrupoOperativo, id_grupo)
    if grupo is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Grupo operativo no encontrado",
        )

    duplicate_name = await db.scalar(
        select(Conductor).where(Conductor.nombre == body.nombre)
    )
    if duplicate_name:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Ya existe un conductor con ese nombre",
        )

    conductor = Conductor(
        code=body.code,
        nombre=body.nombre,
        telefono=body.telefono,
        password=hash_password(body.password),
        id_grupo=id_grupo,
        idem_key=uuid.uuid4(),
    )
    db.add(conductor)
    await db.flush()
    conductor_id = conductor.id_conductor
    await db.commit()
    conductor = await load_conductor(db, id_grupo, conductor_id)
    if conductor is None:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="No se pudo recuperar el conductor recién creado",
        )
    return serialize_conductor(conductor)


@router.get("/grupos-operativos/{id_grupo}/conductores/{id_conductor}")
async def obtener_conductor_admin(
    id_grupo: int,
    id_conductor: int,
    admin: GetAdministrator,
    db: DatabaseSession,
) -> dict:
    conductor = await load_conductor(db, id_grupo, id_conductor)
    if conductor is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Conductor no encontrado en este grupo",
        )
    return serialize_conductor(conductor)


@router.put("/grupos-operativos/{id_grupo}/conductores/{id_conductor}")
async def editar_conductor_admin(
    id_grupo: int,
    id_conductor: int,
    body: ConductorUpdateInput,
    admin: GetAdministrator,
    db: DatabaseSession,
) -> dict:
    conductor = await db.scalar(
        select(Conductor).where(
            Conductor.id_grupo == id_grupo,
            Conductor.id_conductor == id_conductor,
        )
    )
    if conductor is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Conductor no encontrado en este grupo",
        )

    if body.nombre is not None and body.nombre != conductor.nombre:
        duplicate_name = await db.scalar(
            select(Conductor).where(
                Conductor.nombre == body.nombre,
                Conductor.id_conductor != id_conductor,
            )
        )
        if duplicate_name:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Ya existe un conductor con ese nombre",
            )
        conductor.nombre = body.nombre

    if "telefono" in body.model_fields_set:
        conductor.telefono = body.telefono

    conductor_id = conductor.id_conductor
    await db.commit()
    conductor = await load_conductor(db, id_grupo, conductor_id)
    if conductor is None:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="No se pudo recuperar el conductor actualizado",
        )
    return serialize_conductor(conductor)


@router.post(
    "/grupos-operativos/{id_grupo}/rutas",
    status_code=status.HTTP_201_CREATED,
)
async def crear_ruta_admin(
    id_grupo: int,
    body: RutaCreateInput,
    admin: GetAdministrator,
    db: DatabaseSession,
) -> dict:
    grupo = await db.get(GrupoOperativo, id_grupo)
    if grupo is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Grupo operativo no encontrado",
        )

    duplicate_route = await db.scalar(
        select(Ruta).where(
            Ruta.id_grupo_operativo == id_grupo,
            Ruta.numero_ruta == body.numero_ruta,
        )
    )
    if duplicate_route:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Ya existe una ruta con ese número en el grupo",
        )

    geojson = body.geojson.model_dump(mode="json")
    geometry = geojson["geometry"]
    route = Ruta(
        id_grupo_operativo=id_grupo,
        numero_ruta=body.numero_ruta,
        lugar_inicial=body.lugar_inicial,
        lugar_final=body.lugar_final,
        tiempo_estimado=body.tiempo_estimado or 0,
        line=geometry,
    )
    if body.tiempo_estimado is None:
        route.tiempo_estimado = None
    db.add(route)
    await db.flush()

    points = []
    for point in body.puntos_control:
        longitud, latitud = point.coordenadas
        control_point = PuntosControl(
            radio=point.radio,
            ubication=f"POINT({longitud} {latitud})",
            n_puntos_relativo=point.n_puntos_relativo,
            id_ruta=route.id_ruta,
        )
        db.add(control_point)
        points.append(control_point)

    await db.commit()
    await db.refresh(route)
    return {
        "id": str(route.id_ruta),
        "numero_ruta": route.numero_ruta,
        "lugar_inicial": route.lugar_inicial,
        "lugar_final": route.lugar_final,
        "tiempo_estimado": route.tiempo_estimado,
        "puntos_control": len(points),
    }


@router.get("/grupos-operativos")
async def listar_grupos_operativos(
    admin: GetAdministrator,
    db: DatabaseSession,
) -> list[dict]:
    stmt = (
        select(GrupoOperativo)
        .options(
            selectinload(GrupoOperativo.representante),
            selectinload(GrupoOperativo.rutas),
        )
        .order_by(GrupoOperativo.nombre_grupo)
    )
    grupos = (await db.scalars(stmt)).all()
    return [serialize_grupo(grupo) for grupo in grupos]


@router.get("/grupos-operativos/{id_grupo}")
async def obtener_grupo_operativo(
    id_grupo: int,
    admin: GetAdministrator,
    db: DatabaseSession,
) -> dict:
    grupo = await load_grupo(db, id_grupo, include_conductores=True)
    if grupo is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Grupo operativo no encontrado",
        )
    return serialize_grupo(grupo, include_conductores=True)


@router.post(
    "/grupos-operativos",
    status_code=status.HTTP_201_CREATED,
)
async def crear_grupo_operativo_desde_panel(
    body: GrupoCreateInput,
    admin: GetAdministrator,
    db: DatabaseSession,
) -> dict:
    if body.lineas:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Las líneas se crean como rutas y no se pueden añadir desde esta pantalla",
        )

    existing = await db.scalar(
        select(GrupoOperativo).where(GrupoOperativo.nombre_grupo == body.nombre)
    )
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Ya existe un grupo operativo con ese nombre",
        )

    nuevo_grupo = GrupoOperativo(nombre_grupo=body.nombre)
    db.add(nuevo_grupo)
    await db.flush()

    if body.representante:
        datos = body.representante
        if not datos.code or not datos.password:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="El representante nuevo requiere código y contraseña inicial",
            )
        duplicate = await db.scalar(
            select(Conductor).where(Conductor.nombre == datos.nombre)
        )
        if duplicate:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Ya existe un conductor con ese nombre",
            )
        conductor = Conductor(
            code=datos.code,
            nombre=datos.nombre,
            telefono=datos.telefono,
            password=hash_password(datos.password),
            id_grupo=nuevo_grupo.id_grupo,
            idem_key=uuid.uuid4(),
        )
        db.add(conductor)
        await db.flush()
        await db.execute(
            update(GrupoOperativo)
            .where(GrupoOperativo.id_grupo == nuevo_grupo.id_grupo)
            .values(id_representante=conductor.id_conductor)
        )
        db.expire(nuevo_grupo, ["representante", "id_representante"])

    id_grupo = nuevo_grupo.id_grupo
    await db.commit()
    grupo = await load_grupo(db, id_grupo, include_conductores=True)
    if grupo is None:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="No se pudo recuperar el grupo recién creado",
        )
    return serialize_grupo(grupo, include_conductores=True)


@router.put("/grupos-operativos/{id_grupo}")
async def editar_grupo_operativo_desde_panel(
    id_grupo: int,
    body: GrupoUpdateInput,
    admin: GetAdministrator,
    db: DatabaseSession,
) -> dict:
    grupo = await load_grupo(db, id_grupo, include_conductores=True)
    if grupo is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Grupo operativo no encontrado",
        )

    duplicado = await db.scalar(
        select(GrupoOperativo).where(
            GrupoOperativo.nombre_grupo == body.nombre,
            GrupoOperativo.id_grupo != id_grupo,
        )
    )
    if duplicado:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Ya existe un grupo operativo con ese nombre",
        )

    if body.lineas is not None:
        lineas_actuales = sorted({ruta.numero_ruta for ruta in grupo.rutas})
        if sorted(set(body.lineas)) != lineas_actuales:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Las líneas se derivan de las rutas y no se editan desde esta pantalla",
            )

    grupo.nombre_grupo = body.nombre
    if "representante" in body.model_fields_set:
        datos = body.representante
        if datos is None:
            grupo.id_representante = None
        elif grupo.representante is not None:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Desasigna el representante actual antes de asignar uno nuevo",
            )
        else:
            if not datos.code or not datos.password:
                raise HTTPException(
                    status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                    detail="El representante nuevo requiere código y contraseña inicial",
                )
            duplicado_conductor = await db.scalar(
                select(Conductor).where(Conductor.nombre == datos.nombre)
            )
            if duplicado_conductor:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail="Ya existe un conductor con ese nombre",
                )
            conductor = Conductor(
                code=datos.code,
                nombre=datos.nombre,
                telefono=datos.telefono,
                password=hash_password(datos.password),
                id_grupo=id_grupo,
                idem_key=uuid.uuid4(),
            )
            db.add(conductor)
            await db.flush()
            await db.execute(
                update(GrupoOperativo)
                .where(GrupoOperativo.id_grupo == id_grupo)
                .values(id_representante=conductor.id_conductor)
            )
            db.expire(grupo, ["representante", "id_representante"])

    await db.commit()
    grupo = await load_grupo(db, id_grupo, include_conductores=True)
    if grupo is None:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="No se pudo recuperar el grupo actualizado",
        )
    return serialize_grupo(grupo, include_conductores=True)


@router.delete("/grupos-operativos/{id_grupo}", status_code=status.HTTP_204_NO_CONTENT)
async def eliminar_grupo_operativo_desde_panel(
    id_grupo: int,
    admin: GetAdministrator,
    db: DatabaseSession,
) -> None:
    grupo = await db.get(GrupoOperativo, id_grupo)
    if grupo is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Grupo operativo no encontrado",
        )

    route_ids = select(Ruta.id_ruta).where(Ruta.id_grupo_operativo == id_grupo)
    conductor_ids = select(Conductor.id_conductor).where(Conductor.id_grupo == id_grupo)
    assignment_ids = select(AsignacionRuta.id_asignacion).where(
        or_(
            AsignacionRuta.id_ruta.in_(route_ids),
            AsignacionRuta.id_conductor.in_(conductor_ids),
        )
    )
    grupo.id_representante = None
    await db.flush()
    await db.execute(
        delete(Recorrido).where(Recorrido.id_recorrido.in_(assignment_ids))
    )
    await db.execute(delete(PuntosControl).where(PuntosControl.id_ruta.in_(route_ids)))
    await db.execute(
        delete(AsignacionRuta).where(AsignacionRuta.id_asignacion.in_(assignment_ids))
    )
    await db.execute(delete(Ruta).where(Ruta.id_grupo_operativo == id_grupo))
    await db.execute(delete(Conductor).where(Conductor.id_grupo == id_grupo))
    await db.delete(grupo)
    await db.commit()


@router.get("/")
async def get_info(admin: GetAdministrator):
    return admin


@router.patch("/cambiar_password", response_model=AdminOut)
async def cambiar_password_admin(
    body: AdminCambiarPassword,
    admin: GetAdministrator,  # <- ya viene autenticado gracias a la dependencia
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
            idem_key=uuid.uuid4(),
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
    grupo: GrupoOperativoPath,  # ya validado que existe (404 si no)
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
        idem_key=uuid.uuid4(),
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

    if not conductor.activo:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Solo se puede asignar como jefe a un conductor activo",
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

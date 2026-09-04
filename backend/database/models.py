from __future__ import annotations

from datetime import date, datetime, time
from decimal import Decimal
from typing import cast

from geoalchemy2 import Geography
from geoalchemy2.elements import WKBElement, WKTElement
from geoalchemy2.shape import to_shape

# Instalar shapy: uv add shapely
# esto para poder crear un punto a partir de latitud y longitud
from shapely.geometry import Point
from sqlalchemy import Date, DateTime, ForeignKey, Numeric, String, Text, Time
from sqlalchemy.ext.hybrid import hybrid_property
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .database import Base


# ---------------------------------------------------------------------------
# ADMINISTRADOR (Directivos)
# ---------------------------------------------------------------------------
class Administrador(Base):
    __tablename__ = "administradores"

    id_administrador: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    nombre: Mapped[str] = mapped_column(String(60), nullable=False)
    apellido: Mapped[str] = mapped_column(String(60), nullable=False)
    email: Mapped[str] = mapped_column(String(100), nullable=False, unique=True)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    cargo: Mapped[str | None] = mapped_column(String(50))

    def __repr__(self) -> str:
        return (
            f"<Administrador id={self.id_administrador} {self.nombre} {self.apellido}>"
        )


# ---------------------------------------------------------------------------
# RUTA (Lineas)
# ---------------------------------------------------------------------------
class Ruta(Base):
    __tablename__ = "rutas"

    id_ruta: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    numero_ruta: Mapped[str] = mapped_column(String(10), nullable=False)
    nombre: Mapped[str] = mapped_column(String(100), nullable=False)
    descripcion: Mapped[str | None] = mapped_column(Text)
    horario_inicio: Mapped[time | None] = mapped_column(Time)
    horario_fin: Mapped[time | None] = mapped_column(Time)

    paradas: Mapped[list[Parada]] = relationship(
        back_populates="ruta", cascade="all, delete-orphan", order_by="Parada.orden"
    )
    asignaciones: Mapped[list[AsignacionRecorrido]] = relationship(
        back_populates="ruta"
    )
    grupos_operativos: Mapped[list[GrupoOperativo]] = relationship(
        back_populates="ruta"
    )

    def __repr__(self) -> str:
        return f"<Ruta id={self.id_ruta} numero={self.numero_ruta!r}>"


# ---------------------------------------------------------------------------
# PARADAS
# ---------------------------------------------------------------------------
class Parada(Base):
    __tablename__ = "paradas"

    id_parada: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    nombre: Mapped[str] = mapped_column(String(100), nullable=False)

    # --- Punto GPS (GeoAlchemy2 / PostGIS) ---
    ubicacion: Mapped[WKBElement | WKTElement] = mapped_column(
        Geography(geometry_type="POINT", srid=4326), nullable=False
    )

    # --- Alternativa fiel al diagrama original (dos columnas planas) ---
    # latitud: Mapped[Decimal] = mapped_column(Numeric(10, 7), nullable=False)
    # longitud: Mapped[Decimal] = mapped_column(Numeric(10, 7), nullable=False)

    # Radio (en metros) de la geocerca alrededor de la parada, para
    # detectar cuándo una unidad entra en su zona de influencia.
    # NUMERIC(6,2) -> hasta 9999.99 m con 2 decimales de precisión.
    radio: Mapped[Decimal | None] = mapped_column(Numeric(6, 2))

    orden: Mapped[int | None] = mapped_column()

    id_ruta: Mapped[int] = mapped_column(
        ForeignKey("rutas.id_ruta", ondelete="CASCADE"), nullable=False
    )

    ruta: Mapped[Ruta] = relationship(back_populates="paradas")

    @hybrid_property
    def latitud(self) -> float | None:
        if self.ubicacion is None:
            return None
        return cast(Point, to_shape(self.ubicacion)).y

    @hybrid_property
    def longitud(self) -> float | None:
        if self.ubicacion is None:
            return None
        return cast(Point, to_shape(self.ubicacion)).x

    def set_coordenadas(self, latitud: float, longitud: float) -> None:
        """Setea `ubicacion` a partir de lat/lon planos (WGS84)."""
        self.ubicacion = WKTElement(Point(longitud, latitud).wkt, srid=4326)

    def __repr__(self) -> str:
        return f"<Parada id={self.id_parada} nombre={self.nombre!r} radio={self.radio}>"


# ---------------------------------------------------------------------------
# GRUPO_OPERATIVO
# ---------------------------------------------------------------------------
class GrupoOperativo(Base):
    __tablename__ = "grupos_operativos"

    id_grupo: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    nombre_grupo: Mapped[str] = mapped_column(String(20), nullable=False)

    id_ruta: Mapped[int | None] = mapped_column(
        ForeignKey("rutas.id_ruta", ondelete="SET NULL")
    )

    ruta: Mapped[Ruta | None] = relationship(back_populates="grupos_operativos")
    conductores: Mapped[list[Conductor]] = relationship(
        back_populates="grupo_operativo"
    )

    def __repr__(self) -> str:
        return f"<GrupoOperativo id={self.id_grupo} nombre={self.nombre_grupo!r}>"


# ---------------------------------------------------------------------------
# CONDUCTOR
# ---------------------------------------------------------------------------
class Conductor(Base):
    __tablename__ = "conductores"

    id_conductor: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    nombre: Mapped[str] = mapped_column(String(60), nullable=False)
    apellido: Mapped[str] = mapped_column(String(60), nullable=False)
    ci: Mapped[str] = mapped_column(String(15), nullable=False, unique=True)
    telefono: Mapped[str | None] = mapped_column(String(20))
    email: Mapped[str | None] = mapped_column(String(100), unique=True)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    estado: Mapped[str | None] = mapped_column(
        String(15)
    )  # p.ej. ACTIVO/INACTIVO/SUSPENDIDO

    id_grupo: Mapped[int | None] = mapped_column(
        ForeignKey("grupos_operativos.id_grupo", ondelete="SET NULL")
    )

    grupo_operativo: Mapped[GrupoOperativo | None] = relationship(
        back_populates="conductores"
    )
    unidades: Mapped[list[Unidad]] = relationship(back_populates="conductor")
    asignaciones: Mapped[list[AsignacionRecorrido]] = relationship(
        back_populates="conductor"
    )
    recorridos: Mapped[list[RecorridoChofer]] = relationship(back_populates="conductor")

    def __repr__(self) -> str:
        return f"<Conductor id={self.id_conductor} {self.nombre} {self.apellido}>"


# ---------------------------------------------------------------------------
# UNIDAD
# ---------------------------------------------------------------------------
class Unidad(Base):
    __tablename__ = "unidades"

    id_unidad: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    placa: Mapped[str | None] = mapped_column(String(15))
    modelo: Mapped[str | None] = mapped_column(String(50))
    capacidad: Mapped[int | None] = mapped_column()
    estado: Mapped[str | None] = mapped_column(
        String(15)
    )  # p.ej. OPERATIVA/MANTENIMIENTO/BAJA

    id_conductor: Mapped[int | None] = mapped_column(
        ForeignKey("conductores.id_conductor", ondelete="SET NULL")
    )

    conductor: Mapped[Conductor | None] = relationship(back_populates="unidades")
    asignaciones: Mapped[list[AsignacionRecorrido]] = relationship(
        back_populates="unidad"
    )
    recorridos: Mapped[list[RecorridoChofer]] = relationship(back_populates="unidad")

    def __repr__(self) -> str:
        return f"<Unidad id={self.id_unidad} placa={self.placa!r}>"


# ---------------------------------------------------------------------------
# ASIGNACION_RECORRIDO
# ---------------------------------------------------------------------------
class AsignacionRecorrido(Base):
    __tablename__ = "asignaciones_recorrido"

    id_asignacion: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    fecha: Mapped[date | None] = mapped_column(Date)
    turno: Mapped[str | None] = mapped_column(String(20))  # p.ej. MAÑANA/TARDE/NOCHE
    estado: Mapped[str | None] = mapped_column(
        String(15)
    )  # p.ej. PROGRAMADA/EN_CURSO/FINALIZADA

    id_conductor: Mapped[int] = mapped_column(
        ForeignKey("conductores.id_conductor", ondelete="CASCADE"), nullable=False
    )
    id_unidad: Mapped[int] = mapped_column(
        ForeignKey("unidades.id_unidad", ondelete="CASCADE"), nullable=False
    )
    id_ruta: Mapped[int] = mapped_column(
        ForeignKey("rutas.id_ruta", ondelete="CASCADE"), nullable=False
    )

    conductor: Mapped[Conductor] = relationship(back_populates="asignaciones")
    unidad: Mapped[Unidad] = relationship(back_populates="asignaciones")
    ruta: Mapped[Ruta] = relationship(back_populates="asignaciones")
    recorridos: Mapped[list[RecorridoChofer]] = relationship(
        back_populates="asignacion", cascade="all, delete-orphan"
    )

    def __repr__(self) -> str:
        return f"<AsignacionRecorrido id={self.id_asignacion} fecha={self.fecha}>"


# ---------------------------------------------------------------------------
# RECORRIDO_CHOFER
# ---------------------------------------------------------------------------
class RecorridoChofer(Base):
    __tablename__ = "recorridos_chofer"

    id_recorrido: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    fecha_hora_inicio: Mapped[datetime | None] = mapped_column(DateTime)
    fecha_hora_fin: Mapped[datetime | None] = mapped_column(DateTime)
    estado: Mapped[str | None] = mapped_column(
        String(15)
    )  # p.ej. EN_CURSO/COMPLETADO/CANCELADO
    duracion_aprox_min: Mapped[int | None] = mapped_column()

    id_asignacion: Mapped[int] = mapped_column(
        ForeignKey("asignaciones_recorrido.id_asignacion", ondelete="CASCADE"),
        nullable=False,
    )
    id_unidad: Mapped[int] = mapped_column(
        ForeignKey("unidades.id_unidad", ondelete="CASCADE"), nullable=False
    )
    id_conductor: Mapped[int] = mapped_column(
        ForeignKey("conductores.id_conductor", ondelete="CASCADE"), nullable=False
    )

    asignacion: Mapped[AsignacionRecorrido] = relationship(back_populates="recorridos")
    unidad: Mapped[Unidad] = relationship(back_populates="recorridos")
    conductor: Mapped[Conductor] = relationship(back_populates="recorridos")
    historial: Mapped[list[HistorialRecorrido]] = relationship(
        back_populates="recorrido", cascade="all, delete-orphan"
    )

    def __repr__(self) -> str:
        return f"<RecorridoChofer id={self.id_recorrido} estado={self.estado!r}>"


# ---------------------------------------------------------------------------
# HISTORIAL_RECORRIDO (tracking GPS)
# ---------------------------------------------------------------------------
class HistorialRecorrido(Base):
    __tablename__ = "historial_recorrido"

    id_ubicacion: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)

    # --- Punto GPS (GeoAlchemy2 / PostGIS) ---
    ubicacion: Mapped[WKBElement | WKTElement] = mapped_column(
        Geography(geometry_type="POINT", srid=4326), nullable=False
    )
    velocidad_kmh: Mapped[Decimal | None] = mapped_column(Numeric(5, 2))
    fecha_hora: Mapped[datetime | None] = mapped_column(DateTime)

    id_recorrido: Mapped[int] = mapped_column(
        ForeignKey("recorridos_chofer.id_recorrido", ondelete="CASCADE"), nullable=False
    )

    recorrido: Mapped[RecorridoChofer] = relationship(back_populates="historial")

    @hybrid_property
    def latitud(self) -> float | None:
        if self.ubicacion is None:
            return None
        return cast(Point, to_shape(self.ubicacion)).y

    @hybrid_property
    def longitud(self) -> float | None:
        if self.ubicacion is None:
            return None
        return cast(Point, to_shape(self.ubicacion)).x

    def set_coordenadas(self, latitud: float, longitud: float) -> None:
        """Setea `ubicacion` a partir de lat/lon planos (WGS84)."""
        self.ubicacion = WKTElement(Point(longitud, latitud).wkt, srid=4326)

    def __repr__(self) -> str:
        return (
            f"<HistorialRecorrido id={self.id_ubicacion} fecha_hora={self.fecha_hora}>"
        )

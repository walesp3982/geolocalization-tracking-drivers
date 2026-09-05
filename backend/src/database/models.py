from __future__ import annotations

from datetime import datetime, timedelta
from decimal import Decimal
from typing import Any

from geoalchemy2 import Geometry
from sqlalchemy import (
    BigInteger,
    Boolean,
    DateTime,
    ForeignKey,
    Integer,
    Numeric,
    String,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .database import Base  # ajustá el import a tu estructura real


class GrupoOperativo(Base):
    __tablename__ = "grupo_operativo"

    id_grupo: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    nombre_grupo: Mapped[str] = mapped_column(String(20), nullable=False)
    id_representante: Mapped[int | None] = mapped_column(Integer, nullable=True)

    representante: Mapped[Conductor | None] = relationship(
        "conductor", foreign_keys=[id_representante], uselist=False
    )

    conductores: Mapped[list[Conductor]] = relationship(
        back_populates="grupo_operativo"
    )
    rutas: Mapped[list[Ruta]] = relationship(back_populates="grupo_operativo")


class Conductor(Base):
    __tablename__ = "conductor"

    id_conductor: Mapped[int] = mapped_column(
        Integer, primary_key=True, autoincrement=True
    )
    nombre: Mapped[str] = mapped_column(String(120), nullable=False)
    telefono: Mapped[str | None] = mapped_column(String(20), nullable=True)
    password: Mapped[str] = mapped_column(String(255), nullable=False)
    activo: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    id_grupo: Mapped[int] = mapped_column(
        Integer, ForeignKey("grupo_operativo.id_grupo"), nullable=False
    )

    grupo_operativo: Mapped[GrupoOperativo] = relationship(back_populates="conductores")
    asignaciones: Mapped[list[AsignacionRuta]] = relationship(
        back_populates="conductor"
    )


class Ruta(Base):
    __tablename__ = "ruta"

    id_ruta: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    id_grupo_operativo: Mapped[int] = mapped_column(
        Integer, ForeignKey("grupo_operativo.id_grupo"), nullable=False
    )
    numero_ruta: Mapped[str] = mapped_column(String(10), nullable=False)
    lugar_inicial: Mapped[str] = mapped_column(String(100), nullable=False)
    lugar_final: Mapped[str] = mapped_column(String(100), nullable=False)
    tiempo_estimado: Mapped[int | None] = mapped_column(
        Integer, nullable=True
    )  # minutos

    puntos_control: Mapped[list[PuntosControl]] = relationship(back_populates="ruta")


class PuntosControl(Base):
    __tablename__ = "puntos_control"

    # PK agregada por necesidad técnica; el diagrama no la dibuja explícita.
    id_punto_control: Mapped[int] = mapped_column(
        Integer, primary_key=True, autoincrement=True
    )
    radio: Mapped[Decimal] = mapped_column(Numeric(10, 7), nullable=False)
    ubicacion: Mapped[Any] = mapped_column(
        Geometry(geometry_type="POINT", srid=4326), nullable=False
    )
    n_puntos_relativo: Mapped[int | None] = mapped_column(Integer, nullable=True)

    id_ruta: Mapped[int] = mapped_column(
        Integer, ForeignKey("ruta.id_ruta"), nullable=False
    )
    ruta: Mapped[Ruta] = relationship(back_populates="puntos_control")


class AsignacionRuta(Base):
    __tablename__ = "asignacion_ruta"

    id_asignacion: Mapped[int] = mapped_column(
        Integer, primary_key=True, autoincrement=True
    )
    id_ruta: Mapped[int] = mapped_column(
        Integer, ForeignKey("ruta.id_ruta"), nullable=False
    )
    id_conductor: Mapped[int] = mapped_column(
        Integer, ForeignKey("conductor.id_conductor"), nullable=False
    )
    fecha_hora_inicio: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False
    )
    fecha_hora_fin: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    ruta: Mapped[Ruta] = relationship(back_populates="asignaciones")
    conductor: Mapped[Conductor] = relationship(back_populates="asignaciones")
    recorridos: Mapped[list[Recorrido]] = relationship(back_populates="asignacion")

    @property
    def duracion(self) -> timedelta | None:
        """Duración calculada en runtime, no persistida en BD."""
        if self.fecha_hora_fin is None:
            return None
        return self.fecha_hora_fin - self.fecha_hora_inicio


class Recorrido(Base):
    __tablename__ = "recorrido"

    id_ubicacion: Mapped[int] = mapped_column(
        BigInteger, primary_key=True, autoincrement=True
    )
    id_recorrido: Mapped[int] = mapped_column(
        Integer, ForeignKey("asignacion_ruta.id_asignacion"), nullable=False
    )
    ubicacion: Mapped[Any] = mapped_column(
        Geometry(geometry_type="POINT", srid=4326), nullable=False
    )
    # Diagrama dice TIME; recomiendo DateTime para no perder la fecha del punto.
    timestamp: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)

    asignacion: Mapped[AsignacionRuta] = relationship(back_populates="recorridos")

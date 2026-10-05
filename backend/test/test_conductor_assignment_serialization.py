import sys
from datetime import UTC, datetime
from pathlib import Path
from unittest.mock import AsyncMock

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import pytest
from geojson_pydantic import LineString

from src.api.router.conductor import serialize_assignment_response
from src.api.router.jefe_grupo import _geojson_to_mapping
from src.database.models import (
    AsignacionRuta,
    PuntosControl,
    Ruta,
)


@pytest.mark.asyncio
async def test_serialize_assignment_response_returns_json_serializable_route():
    ruta = Ruta(
        id_grupo_operativo=7,
        numero_ruta="R-12",
        lugar_inicial="Origen",
        lugar_final="Destino",
        tiempo_estimado=45,
        line={
            "type": "LineString",
            "coordinates": [
                [-70.6, -33.4],
                [-70.7, -33.45],
            ],
        },
    )
    ruta.id_ruta = 42
    control_point = PuntosControl(
        radio=50,
        ubication="POINT(-70.65 -33.42)",
        n_puntos_relativo=1,
        id_ruta=42,
    )
    control_point.id_punto_control = 5
    ruta.puntos_control.append(control_point)

    db = AsyncMock()
    db.scalar.return_value = (
        '{"type":"LineString","coordinates":[[-70.6,-33.4],[-70.7,-33.45]]}'
    )

    assignment = await serialize_assignment_response(
        db,
        {
            "id_asignacion": 99,
            "id_conductor": 8,
            "id_ruta": 42,
            "fecha_hora_inicio": "2026-10-04T10:00:00+00:00",
            "fecha_hora_comienzo": None,
            "fecha_hora_fin": None,
            "ruta": ruta,
        },
    )

    assert assignment["id_asignacion"] == 99
    assert assignment["ruta"]["numero_ruta"] == "R-12"
    assert assignment["ruta"]["line"]["geometry"]["type"] == "LineString"
    assert assignment["ruta"]["line"]["geometry"]["coordinates"][0] == [-70.6, -33.4]
    assert assignment["ruta"]["puntos_control"] == [
        {
            "id_punto_control": 5,
            "radio": 50.0,
            "n_puntos_relativo": 1,
            "ubicacion": {
                "type": "Point",
                "coordinates": [-70.65, -33.42],
            },
        }
    ]


def test_asignacion_ruta_sets_feha_hora_inicio_from_constructor():
    start = datetime(2026, 10, 4, 10, 0, tzinfo=UTC)

    assignment = AsignacionRuta(
        id_conductor=8,
        id_ruta=42,
        datetime_inicio=start,
    )

    assert assignment.id_conductor == 8
    assert assignment.id_ruta == 42
    assert assignment.fecha_hora_inicio == start


@pytest.mark.parametrize(
    "geojson",
    [
        '{"type":"LineString","coordinates":[[-70.6,-33.4],[-70.7,-33.45]]}',
        {"type": "LineString", "coordinates": [[-70.6, -33.4], [-70.7, -33.45]]},
    ],
)
def test_jefe_grupo_geojson_is_normalized_to_a_mapping(geojson):
    line = LineString(**_geojson_to_mapping(geojson))

    assert line.type == "LineString"
    assert [
        (position.longitude, position.latitude) for position in line.coordinates
    ] == [(-70.6, -33.4), (-70.7, -33.45)]

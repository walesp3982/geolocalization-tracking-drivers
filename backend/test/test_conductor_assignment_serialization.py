import sys
from pathlib import Path
from unittest.mock import AsyncMock

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import pytest

from src.api.router.conductor import serialize_assignment_response
from src.database.models import Ruta


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

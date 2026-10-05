import pytest
from pydantic import ValidationError

from src.api.router.websocket import TrackingSample, _distance_meters


def test_distance_is_zero_at_checkpoint():
    assert _distance_meters(-33.4, -70.6, -33.4, -70.6) == 0


def test_distance_uses_meters_for_small_separation():
    distance = _distance_meters(-33.4, -70.6, -33.4, -70.599)

    assert 90 < distance < 100


def test_tracking_sample_rejects_coordinates_outside_wgs84():
    with pytest.raises(ValidationError):
        TrackingSample.model_validate(
            {
                "sample_id": "8a8c7850-b10d-4bde-85bf-32ff163b3255",
                "latitud": 91,
                "longitud": -70,
                "timestamp_frontend": "2026-10-04T12:00:00+00:00",
            }
        )


def test_tracking_sample_requires_timezone_aware_device_timestamp():
    with pytest.raises(ValidationError):
        TrackingSample.model_validate(
            {
                "sample_id": "8a8c7850-b10d-4bde-85bf-32ff163b3255",
                "latitud": -33.4,
                "longitud": -70.6,
                "timestamp_frontend": "2026-10-04T12:00:00",
            }
        )

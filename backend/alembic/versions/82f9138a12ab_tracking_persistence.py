"""Add tracking sample metadata and status.

Revision ID: 82f9138a12ab
Revises: 3beda3bf0204    
Create Date: 2026-10-04
"""
from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op


revision: str = "82f9138a12ab"
down_revision: str | Sequence[str] | None = "3beda3bf0204"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.alter_column("recorrido", "timestamp", new_column_name="timestamp_backend")
    op.add_column(
        "recorrido",
        sa.Column("timestamp_frontend", sa.DateTime(timezone=True), nullable=True),
    )
    op.add_column("recorrido", sa.Column("sample_id", sa.UUID(), nullable=True))
    op.create_unique_constraint(
        "uq_recorrido_sample_id", "recorrido", ["sample_id"]
    )
    op.add_column(
        "asignacion_ruta", sa.Column("estado_tracking", sa.String(length=20))
    )


def downgrade() -> None:
    op.drop_column("asignacion_ruta", "estado_tracking")
    op.drop_constraint("uq_recorrido_sample_id", "recorrido", type_="unique")
    op.drop_column("recorrido", "sample_id")
    op.drop_column("recorrido", "timestamp_frontend")
    op.alter_column("recorrido", "timestamp_backend", new_column_name="timestamp")
"""Add frequency fields to calendar event types."""

from alembic import op
import sqlalchemy as sa

revision = "20260730_0008"
down_revision = "20260730_0007"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "calendar_event_types",
        sa.Column("frequency_interval", sa.Integer(), nullable=True),
    )
    op.add_column(
        "calendar_event_types",
        sa.Column("frequency_unit", sa.String(length=16), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("calendar_event_types", "frequency_unit")
    op.drop_column("calendar_event_types", "frequency_interval")

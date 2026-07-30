"""Add final_reports JSON to calendar events."""

from alembic import op
import sqlalchemy as sa

revision = "20260730_0007"
down_revision = "20260730_0006"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "calendar_events",
        sa.Column(
            "final_reports",
            sa.JSON(),
            nullable=False,
            server_default=sa.text("'[]'::json"),
        ),
    )


def downgrade() -> None:
    op.drop_column("calendar_events", "final_reports")

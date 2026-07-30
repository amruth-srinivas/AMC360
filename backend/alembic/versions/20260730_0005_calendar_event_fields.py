"""Enrich calendar events for project scheduling."""

from alembic import op
import sqlalchemy as sa

revision = "20260730_0005"
down_revision = "20260730_0004"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Extend enums (PostgreSQL). Each ADD VALUE is committed separately in PG;
    # use IF NOT EXISTS where supported (PG 9.1+ for existence via DO block).
    op.execute("ALTER TYPE calendareventtype ADD VALUE IF NOT EXISTS 'meeting'")
    op.execute("ALTER TYPE calendareventtype ADD VALUE IF NOT EXISTS 'milestone'")
    op.execute("ALTER TYPE calendareventtype ADD VALUE IF NOT EXISTS 'deadline'")
    op.execute("ALTER TYPE calendareventtype ADD VALUE IF NOT EXISTS 'update'")
    op.execute("ALTER TYPE calendareventstatus ADD VALUE IF NOT EXISTS 'in_progress'")
    op.execute("ALTER TYPE calendareventstatus ADD VALUE IF NOT EXISTS 'cancelled'")

    op.add_column("calendar_events", sa.Column("description", sa.Text(), nullable=True))
    op.add_column("calendar_events", sa.Column("color", sa.String(length=32), nullable=True))
    op.add_column("calendar_events", sa.Column("meeting_link", sa.String(length=500), nullable=True))
    op.add_column(
        "calendar_events",
        sa.Column("is_milestone", sa.Boolean(), nullable=False, server_default=sa.text("false")),
    )
    op.add_column(
        "calendar_events",
        sa.Column(
            "updates",
            sa.JSON(),
            nullable=False,
            server_default=sa.text("'[]'::json"),
        ),
    )
    op.add_column(
        "calendar_events",
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
    )
    op.add_column(
        "calendar_events",
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
    )


def downgrade() -> None:
    op.drop_column("calendar_events", "updated_at")
    op.drop_column("calendar_events", "created_at")
    op.drop_column("calendar_events", "updates")
    op.drop_column("calendar_events", "is_milestone")
    op.drop_column("calendar_events", "meeting_link")
    op.drop_column("calendar_events", "color")
    op.drop_column("calendar_events", "description")

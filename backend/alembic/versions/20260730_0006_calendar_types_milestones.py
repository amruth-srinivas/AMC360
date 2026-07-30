"""Configurable event types, start/end, and milestones."""

from alembic import op
import sqlalchemy as sa

revision = "20260730_0006"
down_revision = "20260730_0005"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "calendar_event_types",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("project_id", sa.Integer(), sa.ForeignKey("projects.id"), nullable=False),
        sa.Column("name", sa.String(length=100), nullable=False),
        sa.Column("color", sa.String(length=32), nullable=False, server_default="#3758F9"),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.UniqueConstraint("project_id", "name", name="uq_calendar_event_type_project_name"),
    )

    op.add_column(
        "calendar_events",
        sa.Column("event_type_id", sa.Integer(), sa.ForeignKey("calendar_event_types.id"), nullable=True),
    )
    op.add_column(
        "calendar_events",
        sa.Column("start_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.add_column(
        "calendar_events",
        sa.Column("end_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.add_column(
        "calendar_events",
        sa.Column(
            "milestones",
            sa.JSON(),
            nullable=False,
            server_default=sa.text("'[]'::json"),
        ),
    )

    # Convert enum type column to free-form varchar for custom types.
    op.execute(
        """
        ALTER TABLE calendar_events
        ALTER COLUMN type TYPE varchar(100)
        USING type::text
        """
    )

    op.execute(
        """
        UPDATE calendar_events
        SET start_at = due_date,
            end_at = due_date
        WHERE start_at IS NULL OR end_at IS NULL
        """
    )

    op.alter_column("calendar_events", "start_at", nullable=False)
    op.alter_column("calendar_events", "end_at", nullable=False)


def downgrade() -> None:
    op.drop_column("calendar_events", "milestones")
    op.drop_column("calendar_events", "end_at")
    op.drop_column("calendar_events", "start_at")
    op.drop_column("calendar_events", "event_type_id")
    op.drop_table("calendar_event_types")

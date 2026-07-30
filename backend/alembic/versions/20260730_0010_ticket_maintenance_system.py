"""Maintenance ticketing: issue types, ticket numbers, resolution, attachments, history."""

from alembic import op
import sqlalchemy as sa

revision = "20260730_0010"
down_revision = "20260730_0009"
branch_labels = None
depends_on = None

ISSUE_TYPE = sa.Enum(
    "application_crash",
    "service_interruption",
    "el_image_retrieval_failure",
    "slow_image_loading",
    "database_issue",
    "integration_issue",
    "access_functional_issue",
    "authentication_authorization_issue",
    "ui_functionality_error",
    "data_corruption",
    "db_indexing_problem",
    "file_storage_issue",
    "network_related_issue",
    name="ticketissuetype",
    create_type=False,
)

TICKET_SOURCE = sa.Enum("email", "manual", name="ticketsource", create_type=False)


def upgrade() -> None:
    ISSUE_TYPE.create(op.get_bind(), checkfirst=True)
    TICKET_SOURCE.create(op.get_bind(), checkfirst=True)

    op.execute("ALTER TYPE ticketstatus ADD VALUE IF NOT EXISTS 'in_review'")

    op.add_column("tickets", sa.Column("ticket_number", sa.String(length=4), nullable=True))
    op.add_column(
        "tickets",
        sa.Column("issue_type", ISSUE_TYPE, nullable=True),
    )
    op.add_column(
        "tickets",
        sa.Column("reported_on", sa.DateTime(timezone=True), nullable=True),
    )
    op.add_column(
        "tickets",
        sa.Column("source", TICKET_SOURCE, server_default="manual", nullable=False),
    )
    op.add_column("tickets", sa.Column("details", sa.Text(), nullable=True))
    op.add_column("tickets", sa.Column("resolution_summary", sa.Text(), nullable=True))
    op.add_column("tickets", sa.Column("resolution_root_cause", sa.Text(), nullable=True))
    op.add_column("tickets", sa.Column("resolution_steps", sa.Text(), nullable=True))

    op.create_index("ix_tickets_ticket_number", "tickets", ["ticket_number"], unique=True)

    op.create_table(
        "ticket_attachments",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("ticket_id", sa.Integer(), sa.ForeignKey("tickets.id"), nullable=False),
        sa.Column("filename", sa.String(length=255), nullable=False),
        sa.Column("object_key", sa.String(length=500), nullable=False),
        sa.Column("content_type", sa.String(length=120), nullable=True),
        sa.Column("size_bytes", sa.Integer(), nullable=True),
        sa.Column("uploaded_by", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
    )

    op.create_table(
        "ticket_history",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("ticket_id", sa.Integer(), sa.ForeignKey("tickets.id"), nullable=False),
        sa.Column("actor_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("action", sa.String(length=64), nullable=False),
        sa.Column("detail", sa.Text(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
    )

    op.execute(
        "UPDATE tickets SET ticket_number = LPAD(CAST(id AS TEXT), 4, '0') WHERE ticket_number IS NULL"
    )


def downgrade() -> None:
    op.drop_table("ticket_history")
    op.drop_table("ticket_attachments")
    op.drop_index("ix_tickets_ticket_number", table_name="tickets")
    op.drop_column("tickets", "resolution_steps")
    op.drop_column("tickets", "resolution_root_cause")
    op.drop_column("tickets", "resolution_summary")
    op.drop_column("tickets", "details")
    op.drop_column("tickets", "source")
    op.drop_column("tickets", "reported_on")
    op.drop_column("tickets", "issue_type")
    op.drop_column("tickets", "ticket_number")

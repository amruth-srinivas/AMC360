"""Initial schema."""

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql


revision = "20260728_0001"
down_revision = None
branch_labels = None
depends_on = None


role_enum = postgresql.ENUM(
    "admin", "team_lead", "team_member", name="roleenum", create_type=False
)
template_type_enum = postgresql.ENUM(
    "uptime",
    "patches",
    "health_check",
    "log_monitoring",
    "performance",
    name="reporttemplatetype",
    create_type=False,
)
submission_status_enum = postgresql.ENUM(
    "draft", "submitted", "approved", "rejected", name="submissionstatus", create_type=False
)
backup_status_enum = postgresql.ENUM(
    "success", "failed", "missed", name="backupstatus", create_type=False
)
drill_outcome_enum = postgresql.ENUM(
    "success", "failed", name="drilloutcome", create_type=False
)
ticket_priority_enum = postgresql.ENUM(
    "P1", "P2", "P3", name="ticketpriority", create_type=False
)
ticket_status_enum = postgresql.ENUM(
    "open", "in_progress", "resolved", "closed", name="ticketstatus", create_type=False
)
ticket_category_enum = postgresql.ENUM(
    "incident",
    "service_request",
    "change_request",
    "database",
    "backup",
    "access",
    "performance",
    "health_check",
    "other",
    name="ticketcategory",
    create_type=False,
)
rca_status_enum = postgresql.ENUM(
    "pending", "approved", "rejected", name="rcastatus", create_type=False
)
calendar_type_enum = postgresql.ENUM(
    "health_check",
    "db_restoration",
    "report_due",
    "custom",
    name="calendareventtype",
    create_type=False,
)
calendar_status_enum = postgresql.ENUM(
    "scheduled", "done", "overdue", name="calendareventstatus", create_type=False
)
approval_status_enum = postgresql.ENUM(
    "pending", "approved", "rejected", name="approvalstatus", create_type=False
)


def upgrade() -> None:
    bind = op.get_bind()
    role_enum.create(bind, checkfirst=True)
    template_type_enum.create(bind, checkfirst=True)
    submission_status_enum.create(bind, checkfirst=True)
    backup_status_enum.create(bind, checkfirst=True)
    drill_outcome_enum.create(bind, checkfirst=True)
    ticket_priority_enum.create(bind, checkfirst=True)
    ticket_status_enum.create(bind, checkfirst=True)
    ticket_category_enum.create(bind, checkfirst=True)
    rca_status_enum.create(bind, checkfirst=True)
    calendar_type_enum.create(bind, checkfirst=True)
    calendar_status_enum.create(bind, checkfirst=True)
    approval_status_enum.create(bind, checkfirst=True)

    op.create_table(
        "users",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("email", sa.String(length=255), nullable=False),
        sa.Column("hashed_password", sa.String(length=255), nullable=False),
        sa.Column("role", role_enum, nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.UniqueConstraint("email"),
    )
    op.create_index("ix_users_email", "users", ["email"], unique=True)

    op.create_table(
        "projects",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("client_name", sa.String(length=255), nullable=False),
        sa.Column("team_lead_id", sa.Integer(), sa.ForeignKey("users.id")),
        sa.Column("backup_policy_json", sa.JSON(), nullable=False),
        sa.Column("rto_target", sa.String(length=255)),
        sa.Column("rpo_target", sa.String(length=255)),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )

    op.create_table(
        "project_members",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("project_id", sa.Integer(), sa.ForeignKey("projects.id"), nullable=False),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
        sa.UniqueConstraint("project_id", "user_id", name="uq_project_member"),
    )

    op.create_table(
        "report_templates",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("type", template_type_enum, nullable=False),
        sa.Column("schema_json", sa.JSON()),
        sa.Column("uploaded_file_path", sa.String(length=500)),
        sa.Column("created_by", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )

    op.create_table(
        "report_submissions",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("template_id", sa.Integer(), sa.ForeignKey("report_templates.id"), nullable=False),
        sa.Column("project_id", sa.Integer(), sa.ForeignKey("projects.id"), nullable=False),
        sa.Column("period", sa.String(length=100), nullable=False),
        sa.Column("submitted_by", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("data_json", sa.JSON()),
        sa.Column("file_path", sa.String(length=500)),
        sa.Column("status", submission_status_enum, nullable=False, server_default="draft"),
        sa.Column("reviewed_by", sa.Integer(), sa.ForeignKey("users.id")),
        sa.Column("reviewed_at", sa.DateTime(timezone=True)),
        sa.Column("comments", sa.Text()),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )

    op.create_table(
        "health_check_entries",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("project_id", sa.Integer(), sa.ForeignKey("projects.id"), nullable=False),
        sa.Column("period", sa.String(length=100), nullable=False),
        sa.Column("uptime_status", sa.String(length=100), nullable=False),
        sa.Column("patches_applied", sa.Text(), nullable=False),
        sa.Column("observations", sa.Text()),
        sa.Column("logged_by", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("logged_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )

    op.create_table(
        "db_metric_entries",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("project_id", sa.Integer(), sa.ForeignKey("projects.id"), nullable=False),
        sa.Column("period", sa.String(length=100), nullable=False),
        sa.Column("cpu_pct", sa.Float(), nullable=False),
        sa.Column("memory_pct", sa.Float(), nullable=False),
        sa.Column("disk_io_notes", sa.Text()),
        sa.Column("logged_by", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("logged_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )

    op.create_table(
        "backup_runs",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("project_id", sa.Integer(), sa.ForeignKey("projects.id"), nullable=False),
        sa.Column("run_date", sa.Date(), nullable=False),
        sa.Column("status", backup_status_enum, nullable=False),
        sa.Column("storage_location", sa.String(length=500)),
        sa.Column("notes", sa.Text()),
        sa.Column("logged_by", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
    )

    op.create_table(
        "restoration_drills",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("project_id", sa.Integer(), sa.ForeignKey("projects.id"), nullable=False),
        sa.Column("quarter", sa.String(length=20), nullable=False),
        sa.Column("outcome", drill_outcome_enum, nullable=False),
        sa.Column("time_taken_mins", sa.Integer(), nullable=False),
        sa.Column("notes", sa.Text()),
        sa.Column("performed_by", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("performed_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )

    op.create_table(
        "tickets",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("project_id", sa.Integer(), sa.ForeignKey("projects.id"), nullable=False),
        sa.Column("category", ticket_category_enum, nullable=False),
        sa.Column("priority", ticket_priority_enum, nullable=False),
        sa.Column("status", ticket_status_enum, nullable=False, server_default="open"),
        sa.Column("title", sa.String(length=255), nullable=False),
        sa.Column("description", sa.Text(), nullable=False),
        sa.Column("assignee_id", sa.Integer(), sa.ForeignKey("users.id")),
        sa.Column("raised_by", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("due_date", sa.DateTime(timezone=True)),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("resolved_at", sa.DateTime(timezone=True)),
        sa.Column("closed_at", sa.DateTime(timezone=True)),
    )

    op.create_table(
        "ticket_comments",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("ticket_id", sa.Integer(), sa.ForeignKey("tickets.id"), nullable=False),
        sa.Column("author_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("comment", sa.Text(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )

    op.create_table(
        "rca_documents",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("ticket_id", sa.Integer(), sa.ForeignKey("tickets.id"), nullable=False),
        sa.Column("content", sa.Text()),
        sa.Column("file_path", sa.String(length=500)),
        sa.Column("submitted_by", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("status", rca_status_enum, nullable=False, server_default="pending"),
        sa.Column("reviewed_by", sa.Integer(), sa.ForeignKey("users.id")),
        sa.Column("reviewed_at", sa.DateTime(timezone=True)),
    )

    op.create_table(
        "calendar_events",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("project_id", sa.Integer(), sa.ForeignKey("projects.id")),
        sa.Column("type", calendar_type_enum, nullable=False),
        sa.Column("title", sa.String(length=255), nullable=False),
        sa.Column("due_date", sa.DateTime(timezone=True), nullable=False),
        sa.Column("owner_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("status", calendar_status_enum, nullable=False, server_default="scheduled"),
        sa.Column("recurrence_rule", sa.String(length=255)),
    )

    op.create_table(
        "approvals",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("entity_type", sa.String(length=100), nullable=False),
        sa.Column("entity_id", sa.Integer(), nullable=False),
        sa.Column("requested_by", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("approver_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("status", approval_status_enum, nullable=False, server_default="pending"),
        sa.Column("comment", sa.Text()),
        sa.Column("decided_at", sa.DateTime(timezone=True)),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )

    op.create_table(
        "notification_log",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id")),
        sa.Column("type", sa.String(length=100), nullable=False),
        sa.Column("subject", sa.String(length=255), nullable=False),
        sa.Column("sent_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("related_entity", sa.String(length=255)),
    )


def downgrade() -> None:
    op.drop_table("notification_log")
    op.drop_table("approvals")
    op.drop_table("calendar_events")
    op.drop_table("rca_documents")
    op.drop_table("ticket_comments")
    op.drop_table("tickets")
    op.drop_table("restoration_drills")
    op.drop_table("backup_runs")
    op.drop_table("db_metric_entries")
    op.drop_table("health_check_entries")
    op.drop_table("report_submissions")
    op.drop_table("report_templates")
    op.drop_table("project_members")
    op.drop_table("projects")
    op.drop_index("ix_users_email", table_name="users")
    op.drop_table("users")

    bind = op.get_bind()
    approval_status_enum.drop(bind, checkfirst=True)
    calendar_status_enum.drop(bind, checkfirst=True)
    calendar_type_enum.drop(bind, checkfirst=True)
    rca_status_enum.drop(bind, checkfirst=True)
    ticket_category_enum.drop(bind, checkfirst=True)
    ticket_status_enum.drop(bind, checkfirst=True)
    ticket_priority_enum.drop(bind, checkfirst=True)
    drill_outcome_enum.drop(bind, checkfirst=True)
    backup_status_enum.drop(bind, checkfirst=True)
    submission_status_enum.drop(bind, checkfirst=True)
    template_type_enum.drop(bind, checkfirst=True)
    role_enum.drop(bind, checkfirst=True)

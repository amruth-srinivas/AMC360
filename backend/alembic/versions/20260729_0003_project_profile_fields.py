"""Add project profile fields for admin project management."""

from alembic import op
import sqlalchemy as sa

revision = "20260729_0003"
down_revision = "20260729_0002"
branch_labels = None
depends_on = None

project_status = sa.Enum(
    "active",
    "on_hold",
    "completed",
    "cancelled",
    name="projectstatus",
)


def upgrade() -> None:
    bind = op.get_bind()
    project_status.create(bind, checkfirst=True)

    op.add_column("projects", sa.Column("project_no", sa.String(length=64), nullable=True))
    op.add_column("projects", sa.Column("customer_name", sa.String(length=255), nullable=True))
    op.add_column("projects", sa.Column("details", sa.Text(), nullable=True))
    op.add_column(
        "projects",
        sa.Column(
            "contact_persons",
            sa.JSON(),
            nullable=False,
            server_default=sa.text("'[]'::json"),
        ),
    )
    op.add_column("projects", sa.Column("company_address", sa.Text(), nullable=True))
    op.add_column(
        "projects",
        sa.Column(
            "status",
            project_status,
            nullable=False,
            server_default="active",
        ),
    )
    op.add_column("projects", sa.Column("amc_terms_object_key", sa.String(length=500), nullable=True))
    op.add_column("projects", sa.Column("amc_terms_filename", sa.String(length=255), nullable=True))

    op.execute(
        sa.text(
            "UPDATE projects SET project_no = 'PRJ-' || LPAD(id::text, 4, '0') "
            "WHERE project_no IS NULL"
        )
    )
    op.alter_column("projects", "project_no", nullable=False)
    op.create_index("ix_projects_project_no", "projects", ["project_no"], unique=True)

    op.alter_column("projects", "contact_persons", server_default=None)
    op.alter_column("projects", "status", server_default=None)


def downgrade() -> None:
    op.drop_index("ix_projects_project_no", table_name="projects")
    op.drop_column("projects", "amc_terms_filename")
    op.drop_column("projects", "amc_terms_object_key")
    op.drop_column("projects", "status")
    op.drop_column("projects", "company_address")
    op.drop_column("projects", "contact_persons")
    op.drop_column("projects", "details")
    op.drop_column("projects", "customer_name")
    op.drop_column("projects", "project_no")

    bind = op.get_bind()
    project_status.drop(bind, checkfirst=True)

"""Project report types and completed report documents."""

from alembic import op
import sqlalchemy as sa

revision = "20260730_0009"
down_revision = "20260730_0008"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "project_report_types",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("project_id", sa.Integer(), sa.ForeignKey("projects.id"), nullable=False),
        sa.Column("name", sa.String(length=150), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("frequency_interval", sa.Integer(), nullable=True),
        sa.Column("frequency_unit", sa.String(length=16), nullable=True),
        sa.Column("template_filename", sa.String(length=255), nullable=True),
        sa.Column("template_object_key", sa.String(length=500), nullable=True),
        sa.Column("template_content_type", sa.String(length=120), nullable=True),
        sa.Column("created_by", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.UniqueConstraint("project_id", "name", name="uq_project_report_type_name"),
    )
    op.create_table(
        "project_report_documents",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("project_id", sa.Integer(), sa.ForeignKey("projects.id"), nullable=False),
        sa.Column(
            "report_type_id",
            sa.Integer(),
            sa.ForeignKey("project_report_types.id"),
            nullable=False,
        ),
        sa.Column("title", sa.String(length=255), nullable=False),
        sa.Column("period_label", sa.String(length=120), nullable=False),
        sa.Column("filename", sa.String(length=255), nullable=False),
        sa.Column("object_key", sa.String(length=500), nullable=False),
        sa.Column("content_type", sa.String(length=120), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("uploaded_by", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
    )


def downgrade() -> None:
    op.drop_table("project_report_documents")
    op.drop_table("project_report_types")

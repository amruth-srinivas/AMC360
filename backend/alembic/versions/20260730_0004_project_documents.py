"""Add project_documents table for categorized project files."""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "20260730_0004"
down_revision = "20260729_0003"
branch_labels = None
depends_on = None

document_category = postgresql.ENUM(
    "amc_terms",
    "sow",
    "contract",
    "technical",
    "invoice",
    "other",
    name="projectdocumentcategory",
    create_type=False,
)


def upgrade() -> None:
    bind = op.get_bind()
    postgresql.ENUM(
        "amc_terms",
        "sow",
        "contract",
        "technical",
        "invoice",
        "other",
        name="projectdocumentcategory",
    ).create(bind, checkfirst=True)

    op.create_table(
        "project_documents",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("project_id", sa.Integer(), sa.ForeignKey("projects.id", ondelete="CASCADE"), nullable=False),
        sa.Column("category", document_category, nullable=False),
        sa.Column("title", sa.String(length=255), nullable=True),
        sa.Column("filename", sa.String(length=255), nullable=False),
        sa.Column("object_key", sa.String(length=500), nullable=False),
        sa.Column("content_type", sa.String(length=255), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
    )
    op.create_index("ix_project_documents_project_id", "project_documents", ["project_id"])

    # Migrate existing AMC terms columns into the new documents table.
    op.execute(
        sa.text(
            """
            INSERT INTO project_documents (project_id, category, title, filename, object_key, content_type)
            SELECT id, 'amc_terms', 'AMC terms & conditions', amc_terms_filename, amc_terms_object_key, 'application/pdf'
            FROM projects
            WHERE amc_terms_object_key IS NOT NULL
              AND amc_terms_filename IS NOT NULL
            """
        )
    )


def downgrade() -> None:
    op.drop_index("ix_project_documents_project_id", table_name="project_documents")
    op.drop_table("project_documents")
    postgresql.ENUM(name="projectdocumentcategory").drop(op.get_bind(), checkfirst=True)

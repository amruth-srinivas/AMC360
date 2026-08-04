"""nullable period_label for as-needed report uploads

Revision ID: 20260804_0011
Revises: 20260730_0010
Create Date: 2026-08-04
"""

from alembic import op
import sqlalchemy as sa

revision = "20260804_0011"
down_revision = "20260730_0010"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.alter_column(
        "project_report_documents",
        "period_label",
        existing_type=sa.String(length=120),
        nullable=True,
    )


def downgrade() -> None:
    op.execute(
        "UPDATE project_report_documents SET period_label = 'General' WHERE period_label IS NULL"
    )
    op.alter_column(
        "project_report_documents",
        "period_label",
        existing_type=sa.String(length=120),
        nullable=False,
    )

"""Add has_seen_issues_tour on users for first-time Issues walkthrough.

Revision ID: 20260807_0014
Revises: 20260807_0013
Create Date: 2026-08-07
"""

from alembic import op
import sqlalchemy as sa

revision = "20260807_0014"
down_revision = "20260807_0013"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "users",
        sa.Column(
            "has_seen_issues_tour",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("false"),
        ),
    )


def downgrade() -> None:
    op.drop_column("users", "has_seen_issues_tour")

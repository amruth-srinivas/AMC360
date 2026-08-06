"""Placeholder revision already applied on this environment.

Revision ID: 20260806_0013
Revises: 20260806_0012
Create Date: 2026-08-06

This file exists so local databases stamped at 20260806_0013 remain compatible
with the repo revision graph. No schema changes.
"""

from alembic import op

revision = "20260806_0013"
down_revision = "20260806_0012"
branch_labels = None
depends_on = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass

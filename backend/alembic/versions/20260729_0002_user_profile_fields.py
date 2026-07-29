"""Add employee profile fields to users."""

from alembic import op
import sqlalchemy as sa

revision = "20260729_0002"
down_revision = "20260728_0001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("users", sa.Column("employee_id", sa.String(length=64), nullable=True))
    op.add_column("users", sa.Column("phone", sa.String(length=32), nullable=True))
    op.add_column("users", sa.Column("designation", sa.String(length=255), nullable=True))
    op.create_index("ix_users_employee_id", "users", ["employee_id"], unique=True)


def downgrade() -> None:
    op.drop_index("ix_users_employee_id", table_name="users")
    op.drop_column("users", "designation")
    op.drop_column("users", "phone")
    op.drop_column("users", "employee_id")

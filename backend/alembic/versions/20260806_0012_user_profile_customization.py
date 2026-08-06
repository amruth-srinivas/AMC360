"""Add profile customization fields to users.

Revision ID: 20260806_0012
Revises: 20260804_0011
Create Date: 2026-08-06
"""

from alembic import op
import sqlalchemy as sa

revision = "20260806_0012"
down_revision = "20260804_0011"
branch_labels = None
depends_on = None

presence_enum = sa.Enum(
    "available",
    "busy",
    "do_not_disturb",
    "be_right_back",
    "away",
    "offline",
    name="userpresencestatus",
)


def upgrade() -> None:
    presence_enum.create(op.get_bind(), checkfirst=True)
    op.add_column("users", sa.Column("avatar_object_key", sa.String(length=500), nullable=True))
    op.add_column("users", sa.Column("avatar_content_type", sa.String(length=128), nullable=True))
    op.add_column(
        "users",
        sa.Column(
            "status_presence",
            presence_enum,
            nullable=False,
            server_default="available",
        ),
    )
    op.add_column("users", sa.Column("status_message", sa.String(length=280), nullable=True))
    op.add_column("users", sa.Column("linkedin_url", sa.String(length=500), nullable=True))
    op.add_column("users", sa.Column("github_url", sa.String(length=500), nullable=True))
    op.add_column("users", sa.Column("website_url", sa.String(length=500), nullable=True))
    op.add_column("users", sa.Column("bio", sa.String(length=500), nullable=True))


def downgrade() -> None:
    op.drop_column("users", "bio")
    op.drop_column("users", "website_url")
    op.drop_column("users", "github_url")
    op.drop_column("users", "linkedin_url")
    op.drop_column("users", "status_message")
    op.drop_column("users", "status_presence")
    op.drop_column("users", "avatar_content_type")
    op.drop_column("users", "avatar_object_key")
    presence_enum.drop(op.get_bind(), checkfirst=True)

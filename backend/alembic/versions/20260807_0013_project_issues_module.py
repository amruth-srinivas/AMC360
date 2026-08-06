"""Jira-style issues module: sprints, issues, comments, is_managed_project.

Revision ID: 20260807_0013
Revises: 20260806_0013
Create Date: 2026-08-07
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "20260807_0013"
down_revision = "20260806_0013"
branch_labels = None
depends_on = None


def _enum(name: str, *values: str):
    return postgresql.ENUM(*values, name=name, create_type=False)


def upgrade() -> None:
    bind = op.get_bind()

    for name, values in [
        ("sprintstatus", ("planned", "active", "completed")),
        ("issuetype", ("epic", "story", "task", "bug")),
        ("issuestatus", ("todo", "in_progress", "in_review", "done")),
        ("issuepriority", ("P0", "P1", "P2", "P3")),
    ]:
        postgresql.ENUM(*values, name=name).create(bind, checkfirst=True)

    sprint_status = _enum("sprintstatus", "planned", "active", "completed")
    issue_type = _enum("issuetype", "epic", "story", "task", "bug")
    issue_status = _enum("issuestatus", "todo", "in_progress", "in_review", "done")
    issue_priority = _enum("issuepriority", "P0", "P1", "P2", "P3")

    op.add_column(
        "projects",
        sa.Column(
            "is_managed_project",
            sa.Boolean(),
            server_default=sa.text("false"),
            nullable=False,
        ),
    )
    op.add_column(
        "projects",
        sa.Column("issue_seq", sa.Integer(), server_default="0", nullable=False),
    )

    op.create_table(
        "sprints",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("project_id", sa.Integer(), sa.ForeignKey("projects.id"), nullable=False),
        sa.Column("name", sa.Text(), nullable=False),
        sa.Column("goal", sa.Text(), nullable=True),
        sa.Column("status", sprint_status, server_default="planned", nullable=False),
        sa.Column("start_date", sa.Date(), nullable=True),
        sa.Column("end_date", sa.Date(), nullable=True),
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
    )
    op.create_index("ix_sprints_project_id", "sprints", ["project_id"])

    op.create_table(
        "issues",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("project_id", sa.Integer(), sa.ForeignKey("projects.id"), nullable=False),
        sa.Column("key", sa.String(length=64), nullable=False),
        sa.Column("type", issue_type, nullable=False),
        sa.Column("parent_id", sa.Integer(), sa.ForeignKey("issues.id"), nullable=True),
        sa.Column("sprint_id", sa.Integer(), sa.ForeignKey("sprints.id"), nullable=True),
        sa.Column("title", sa.Text(), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("status", issue_status, server_default="todo", nullable=False),
        sa.Column("priority", issue_priority, server_default="P2", nullable=False),
        sa.Column("assignee_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("reporter_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("story_points", sa.Integer(), nullable=True),
        sa.Column(
            "labels",
            postgresql.ARRAY(sa.Text()),
            server_default="{}",
            nullable=False,
        ),
        sa.Column("epic_color", sa.String(length=32), nullable=True),
        sa.Column("start_date", sa.Date(), nullable=True),
        sa.Column("due_date", sa.Date(), nullable=True),
        sa.Column("rank", sa.Float(), server_default="0", nullable=False),
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
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.UniqueConstraint("project_id", "key", name="uq_issues_project_key"),
    )
    op.create_index("ix_issues_project_sprint", "issues", ["project_id", "sprint_id"])
    op.create_index("ix_issues_project_status", "issues", ["project_id", "status"])
    op.create_index("ix_issues_parent_id", "issues", ["parent_id"])

    op.create_table(
        "issue_comments",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("issue_id", sa.Integer(), sa.ForeignKey("issues.id"), nullable=False),
        sa.Column("author_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("body", sa.Text(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
    )
    op.create_index("ix_issue_comments_issue_id", "issue_comments", ["issue_id"])


def downgrade() -> None:
    op.drop_index("ix_issue_comments_issue_id", table_name="issue_comments")
    op.drop_table("issue_comments")
    op.drop_index("ix_issues_parent_id", table_name="issues")
    op.drop_index("ix_issues_project_status", table_name="issues")
    op.drop_index("ix_issues_project_sprint", table_name="issues")
    op.drop_table("issues")
    op.drop_index("ix_sprints_project_id", table_name="sprints")
    op.drop_table("sprints")
    op.drop_column("projects", "issue_seq")
    op.drop_column("projects", "is_managed_project")

    bind = op.get_bind()
    for name in ("issuepriority", "issuestatus", "issuetype", "sprintstatus"):
        postgresql.ENUM(name=name).drop(bind, checkfirst=True)

from datetime import date, datetime
from enum import StrEnum

from sqlalchemy import (
    JSON,
    Boolean,
    Date,
    DateTime,
    Enum,
    Float,
    ForeignKey,
    Integer,
    String,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.dialects.postgresql import ARRAY
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.db import Base


def enum_column(enum_cls: type[StrEnum]) -> Enum:
    return Enum(
        enum_cls,
        values_callable=lambda members: [member.value for member in members],
        validate_strings=True,
    )


class RoleEnum(StrEnum):
    ADMIN = "admin"
    TEAM_LEAD = "team_lead"
    TEAM_MEMBER = "team_member"


class UserPresenceStatus(StrEnum):
    AVAILABLE = "available"
    BUSY = "busy"
    DO_NOT_DISTURB = "do_not_disturb"
    BE_RIGHT_BACK = "be_right_back"
    AWAY = "away"
    OFFLINE = "offline"


class ReportTemplateType(StrEnum):
    UPTIME = "uptime"
    PATCHES = "patches"
    HEALTH_CHECK = "health_check"
    LOG_MONITORING = "log_monitoring"
    PERFORMANCE = "performance"


class SubmissionStatus(StrEnum):
    DRAFT = "draft"
    SUBMITTED = "submitted"
    APPROVED = "approved"
    REJECTED = "rejected"


class BackupStatus(StrEnum):
    SUCCESS = "success"
    FAILED = "failed"
    MISSED = "missed"


class DrillOutcome(StrEnum):
    SUCCESS = "success"
    FAILED = "failed"


class TicketPriority(StrEnum):
    P1 = "P1"
    P2 = "P2"
    P3 = "P3"


class TicketStatus(StrEnum):
    OPEN = "open"
    IN_PROGRESS = "in_progress"
    IN_REVIEW = "in_review"
    RESOLVED = "resolved"
    CLOSED = "closed"


class TicketIssueType(StrEnum):
    APPLICATION_CRASH = "application_crash"
    SERVICE_INTERRUPTION = "service_interruption"
    EL_IMAGE_RETRIEVAL_FAILURE = "el_image_retrieval_failure"
    SLOW_IMAGE_LOADING = "slow_image_loading"
    DATABASE_ISSUE = "database_issue"
    INTEGRATION_ISSUE = "integration_issue"
    ACCESS_FUNCTIONAL_ISSUE = "access_functional_issue"
    AUTHENTICATION_AUTHORIZATION_ISSUE = "authentication_authorization_issue"
    UI_FUNCTIONALITY_ERROR = "ui_functionality_error"
    DATA_CORRUPTION = "data_corruption"
    DB_INDEXING_PROBLEM = "db_indexing_problem"
    FILE_STORAGE_ISSUE = "file_storage_issue"
    NETWORK_RELATED_ISSUE = "network_related_issue"


class TicketSource(StrEnum):
    EMAIL = "email"
    MANUAL = "manual"


class TicketCategory(StrEnum):
    INCIDENT = "incident"
    SERVICE_REQUEST = "service_request"
    CHANGE_REQUEST = "change_request"
    DATABASE = "database"
    BACKUP = "backup"
    ACCESS = "access"
    PERFORMANCE = "performance"
    HEALTH_CHECK = "health_check"
    OTHER = "other"


class RCAStatus(StrEnum):
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"


class CalendarEventType(StrEnum):
    HEALTH_CHECK = "health_check"
    DB_RESTORATION = "db_restoration"
    REPORT_DUE = "report_due"
    MEETING = "meeting"
    MILESTONE = "milestone"
    DEADLINE = "deadline"
    UPDATE = "update"
    CUSTOM = "custom"


class CalendarEventStatus(StrEnum):
    SCHEDULED = "scheduled"
    IN_PROGRESS = "in_progress"
    DONE = "done"
    OVERDUE = "overdue"
    CANCELLED = "cancelled"


class ApprovalStatus(StrEnum):
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"


class ProjectStatus(StrEnum):
    ACTIVE = "active"
    ON_HOLD = "on_hold"
    COMPLETED = "completed"
    CANCELLED = "cancelled"


class ProjectDocumentCategory(StrEnum):
    AMC_TERMS = "amc_terms"
    SOW = "sow"
    CONTRACT = "contract"
    TECHNICAL = "technical"
    INVOICE = "invoice"
    OTHER = "other"


class SprintStatus(StrEnum):
    PLANNED = "planned"
    ACTIVE = "active"
    COMPLETED = "completed"


class IssueType(StrEnum):
    EPIC = "epic"
    STORY = "story"
    TASK = "task"
    BUG = "bug"


class IssueStatus(StrEnum):
    TODO = "todo"
    IN_PROGRESS = "in_progress"
    IN_REVIEW = "in_review"
    DONE = "done"


class IssuePriority(StrEnum):
    P0 = "P0"
    P1 = "P1"
    P2 = "P2"
    P3 = "P3"


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    employee_id: Mapped[str | None] = mapped_column(String(64), unique=True, nullable=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True, nullable=False)
    phone: Mapped[str | None] = mapped_column(String(32), nullable=True)
    designation: Mapped[str | None] = mapped_column(String(255), nullable=True)
    hashed_password: Mapped[str] = mapped_column(String(255), nullable=False)
    role: Mapped[RoleEnum] = mapped_column(enum_column(RoleEnum), nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    avatar_object_key: Mapped[str | None] = mapped_column(String(500), nullable=True)
    avatar_content_type: Mapped[str | None] = mapped_column(String(128), nullable=True)
    status_presence: Mapped[UserPresenceStatus] = mapped_column(
        enum_column(UserPresenceStatus),
        default=UserPresenceStatus.AVAILABLE,
        nullable=False,
    )
    status_message: Mapped[str | None] = mapped_column(String(280), nullable=True)
    linkedin_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    github_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    website_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    bio: Mapped[str | None] = mapped_column(String(500), nullable=True)
    has_seen_issues_tour: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )


class Project(Base):
    __tablename__ = "projects"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    project_no: Mapped[str] = mapped_column(String(64), unique=True, index=True, nullable=False)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    client_name: Mapped[str] = mapped_column(String(255), nullable=False)
    customer_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    details: Mapped[str | None] = mapped_column(Text, nullable=True)
    contact_persons: Mapped[list] = mapped_column(JSON, default=list, nullable=False)
    company_address: Mapped[str | None] = mapped_column(Text, nullable=True)
    status: Mapped[ProjectStatus] = mapped_column(
        enum_column(ProjectStatus), default=ProjectStatus.ACTIVE, nullable=False
    )
    amc_terms_object_key: Mapped[str | None] = mapped_column(String(500), nullable=True)
    amc_terms_filename: Mapped[str | None] = mapped_column(String(255), nullable=True)
    team_lead_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    backup_policy_json: Mapped[dict] = mapped_column(JSON, default=dict, nullable=False)
    rto_target: Mapped[str | None] = mapped_column(String(255))
    rpo_target: Mapped[str | None] = mapped_column(String(255))
    is_managed_project: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    issue_seq: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )


class ProjectMember(Base):
    __tablename__ = "project_members"
    __table_args__ = (UniqueConstraint("project_id", "user_id", name="uq_project_member"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    project_id: Mapped[int] = mapped_column(ForeignKey("projects.id"), nullable=False)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)


class ProjectDocument(Base):
    __tablename__ = "project_documents"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    project_id: Mapped[int] = mapped_column(ForeignKey("projects.id", ondelete="CASCADE"), nullable=False, index=True)
    category: Mapped[ProjectDocumentCategory] = mapped_column(
        enum_column(ProjectDocumentCategory), nullable=False
    )
    title: Mapped[str | None] = mapped_column(String(255), nullable=True)
    filename: Mapped[str] = mapped_column(String(255), nullable=False)
    object_key: Mapped[str] = mapped_column(String(500), nullable=False)
    content_type: Mapped[str | None] = mapped_column(String(255), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )


class ReportTemplate(Base):
    __tablename__ = "report_templates"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    type: Mapped[ReportTemplateType] = mapped_column(
        enum_column(ReportTemplateType), nullable=False
    )
    schema_json: Mapped[dict | None] = mapped_column(JSON)
    uploaded_file_path: Mapped[str | None] = mapped_column(String(500))
    created_by: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )


class ReportSubmission(Base):
    __tablename__ = "report_submissions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    template_id: Mapped[int] = mapped_column(ForeignKey("report_templates.id"), nullable=False)
    project_id: Mapped[int] = mapped_column(ForeignKey("projects.id"), nullable=False)
    period: Mapped[str] = mapped_column(String(100), nullable=False)
    submitted_by: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
    data_json: Mapped[dict | None] = mapped_column(JSON)
    file_path: Mapped[str | None] = mapped_column(String(500))
    status: Mapped[SubmissionStatus] = mapped_column(
        enum_column(SubmissionStatus), default=SubmissionStatus.DRAFT, nullable=False
    )
    reviewed_by: Mapped[int | None] = mapped_column(ForeignKey("users.id"))
    reviewed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    comments: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )


class ProjectReportType(Base):
    """Project-scoped report category with optional template and cadence."""

    __tablename__ = "project_report_types"
    __table_args__ = (
        UniqueConstraint("project_id", "name", name="uq_project_report_type_name"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    project_id: Mapped[int] = mapped_column(ForeignKey("projects.id"), nullable=False)
    name: Mapped[str] = mapped_column(String(150), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    frequency_interval: Mapped[int | None] = mapped_column(Integer, nullable=True)
    frequency_unit: Mapped[str | None] = mapped_column(String(16), nullable=True)
    template_filename: Mapped[str | None] = mapped_column(String(255), nullable=True)
    template_object_key: Mapped[str | None] = mapped_column(String(500), nullable=True)
    template_content_type: Mapped[str | None] = mapped_column(String(120), nullable=True)
    created_by: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )


class ProjectReportDocument(Base):
    """Completed report file stored under a report type / period folder."""

    __tablename__ = "project_report_documents"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    project_id: Mapped[int] = mapped_column(ForeignKey("projects.id"), nullable=False)
    report_type_id: Mapped[int] = mapped_column(ForeignKey("project_report_types.id"), nullable=False)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    period_label: Mapped[str | None] = mapped_column(String(120), nullable=True)
    filename: Mapped[str] = mapped_column(String(255), nullable=False)
    object_key: Mapped[str] = mapped_column(String(500), nullable=False)
    content_type: Mapped[str | None] = mapped_column(String(120), nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    uploaded_by: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )


class HealthCheckEntry(Base):
    __tablename__ = "health_check_entries"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    project_id: Mapped[int] = mapped_column(ForeignKey("projects.id"), nullable=False)
    period: Mapped[str] = mapped_column(String(100), nullable=False)
    uptime_status: Mapped[str] = mapped_column(String(100), nullable=False)
    patches_applied: Mapped[str] = mapped_column(Text, nullable=False)
    observations: Mapped[str | None] = mapped_column(Text)
    logged_by: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
    logged_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )


class DbMetricEntry(Base):
    __tablename__ = "db_metric_entries"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    project_id: Mapped[int] = mapped_column(ForeignKey("projects.id"), nullable=False)
    period: Mapped[str] = mapped_column(String(100), nullable=False)
    cpu_pct: Mapped[float] = mapped_column(Float, nullable=False)
    memory_pct: Mapped[float] = mapped_column(Float, nullable=False)
    disk_io_notes: Mapped[str | None] = mapped_column(Text)
    logged_by: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
    logged_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )


class BackupRun(Base):
    __tablename__ = "backup_runs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    project_id: Mapped[int] = mapped_column(ForeignKey("projects.id"), nullable=False)
    run_date: Mapped[date] = mapped_column(Date, nullable=False)
    status: Mapped[BackupStatus] = mapped_column(enum_column(BackupStatus), nullable=False)
    storage_location: Mapped[str | None] = mapped_column(String(500))
    notes: Mapped[str | None] = mapped_column(Text)
    logged_by: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)


class RestorationDrill(Base):
    __tablename__ = "restoration_drills"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    project_id: Mapped[int] = mapped_column(ForeignKey("projects.id"), nullable=False)
    quarter: Mapped[str] = mapped_column(String(20), nullable=False)
    outcome: Mapped[DrillOutcome] = mapped_column(enum_column(DrillOutcome), nullable=False)
    time_taken_mins: Mapped[int] = mapped_column(Integer, nullable=False)
    notes: Mapped[str | None] = mapped_column(Text)
    performed_by: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
    performed_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )


class Ticket(Base):
    __tablename__ = "tickets"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    ticket_number: Mapped[str | None] = mapped_column(String(4), unique=True, index=True)
    project_id: Mapped[int] = mapped_column(ForeignKey("projects.id"), nullable=False)
    category: Mapped[TicketCategory] = mapped_column(
        enum_column(TicketCategory), nullable=False
    )
    issue_type: Mapped[TicketIssueType | None] = mapped_column(
        enum_column(TicketIssueType), nullable=True
    )
    priority: Mapped[TicketPriority] = mapped_column(
        enum_column(TicketPriority), nullable=False
    )
    status: Mapped[TicketStatus] = mapped_column(
        enum_column(TicketStatus), default=TicketStatus.OPEN, nullable=False
    )
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    details: Mapped[str | None] = mapped_column(Text, nullable=True)
    source: Mapped[TicketSource] = mapped_column(
        enum_column(TicketSource), default=TicketSource.MANUAL, nullable=False
    )
    reported_on: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    assignee_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"))
    raised_by: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
    due_date: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    resolution_summary: Mapped[str | None] = mapped_column(Text, nullable=True)
    resolution_root_cause: Mapped[str | None] = mapped_column(Text, nullable=True)
    resolution_steps: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    resolved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    closed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class TicketComment(Base):
    __tablename__ = "ticket_comments"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    ticket_id: Mapped[int] = mapped_column(ForeignKey("tickets.id"), nullable=False)
    author_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
    comment: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )


class TicketAttachment(Base):
    __tablename__ = "ticket_attachments"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    ticket_id: Mapped[int] = mapped_column(ForeignKey("tickets.id"), nullable=False)
    filename: Mapped[str] = mapped_column(String(255), nullable=False)
    object_key: Mapped[str] = mapped_column(String(500), nullable=False)
    content_type: Mapped[str | None] = mapped_column(String(120), nullable=True)
    size_bytes: Mapped[int | None] = mapped_column(Integer, nullable=True)
    uploaded_by: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )


class TicketHistory(Base):
    __tablename__ = "ticket_history"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    ticket_id: Mapped[int] = mapped_column(ForeignKey("tickets.id"), nullable=False)
    actor_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    action: Mapped[str] = mapped_column(String(64), nullable=False)
    detail: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )


class RCADocument(Base):
    __tablename__ = "rca_documents"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    ticket_id: Mapped[int] = mapped_column(ForeignKey("tickets.id"), nullable=False)
    content: Mapped[str | None] = mapped_column(Text)
    file_path: Mapped[str | None] = mapped_column(String(500))
    submitted_by: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
    status: Mapped[RCAStatus] = mapped_column(
        enum_column(RCAStatus), default=RCAStatus.PENDING, nullable=False
    )
    reviewed_by: Mapped[int | None] = mapped_column(ForeignKey("users.id"))
    reviewed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class CalendarEventTypeConfig(Base):
    __tablename__ = "calendar_event_types"
    __table_args__ = (UniqueConstraint("project_id", "name", name="uq_calendar_event_type_project_name"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    project_id: Mapped[int] = mapped_column(ForeignKey("projects.id"), nullable=False)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    color: Mapped[str] = mapped_column(String(32), nullable=False, default="#3758F9")
    # e.g. interval=3, unit=month → once every 3 months. Null interval = one-time / as needed.
    frequency_interval: Mapped[int | None] = mapped_column(Integer, nullable=True)
    frequency_unit: Mapped[str | None] = mapped_column(String(16), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )


class CalendarEvent(Base):
    __tablename__ = "calendar_events"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    project_id: Mapped[int | None] = mapped_column(ForeignKey("projects.id"))
    # Free-form label matching a configured project event type name (or legacy enum value).
    type: Mapped[str] = mapped_column(String(100), nullable=False)
    event_type_id: Mapped[int | None] = mapped_column(
        ForeignKey("calendar_event_types.id"), nullable=True
    )
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    start_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    end_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    # Kept in sync with end_at for older list/overdue queries.
    due_date: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    owner_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
    status: Mapped[CalendarEventStatus] = mapped_column(
        enum_column(CalendarEventStatus),
        default=CalendarEventStatus.SCHEDULED,
        nullable=False,
    )
    color: Mapped[str | None] = mapped_column(String(32), nullable=True)
    meeting_link: Mapped[str | None] = mapped_column(String(500), nullable=True)
    is_milestone: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    updates: Mapped[list] = mapped_column(JSON, default=list, nullable=False)
    milestones: Mapped[list] = mapped_column(JSON, default=list, nullable=False)
    final_reports: Mapped[list] = mapped_column(JSON, default=list, nullable=False)
    recurrence_rule: Mapped[str | None] = mapped_column(String(255))
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )


class Approval(Base):
    __tablename__ = "approvals"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    entity_type: Mapped[str] = mapped_column(String(100), nullable=False)
    entity_id: Mapped[int] = mapped_column(Integer, nullable=False)
    requested_by: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
    approver_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
    status: Mapped[ApprovalStatus] = mapped_column(
        enum_column(ApprovalStatus), default=ApprovalStatus.PENDING, nullable=False
    )
    comment: Mapped[str | None] = mapped_column(Text)
    decided_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )


class NotificationLog(Base):
    __tablename__ = "notification_log"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"))
    type: Mapped[str] = mapped_column(String(100), nullable=False)
    subject: Mapped[str] = mapped_column(String(255), nullable=False)
    sent_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    related_entity: Mapped[str | None] = mapped_column(String(255))


class Sprint(Base):
    __tablename__ = "sprints"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    project_id: Mapped[int] = mapped_column(ForeignKey("projects.id"), nullable=False, index=True)
    name: Mapped[str] = mapped_column(Text, nullable=False)
    goal: Mapped[str | None] = mapped_column(Text, nullable=True)
    status: Mapped[SprintStatus] = mapped_column(
        enum_column(SprintStatus), default=SprintStatus.PLANNED, nullable=False
    )
    start_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    end_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )


class Issue(Base):
    __tablename__ = "issues"
    __table_args__ = (UniqueConstraint("project_id", "key", name="uq_issues_project_key"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    project_id: Mapped[int] = mapped_column(ForeignKey("projects.id"), nullable=False)
    key: Mapped[str] = mapped_column(String(64), nullable=False)
    type: Mapped[IssueType] = mapped_column(enum_column(IssueType), nullable=False)
    parent_id: Mapped[int | None] = mapped_column(ForeignKey("issues.id"), nullable=True)
    sprint_id: Mapped[int | None] = mapped_column(ForeignKey("sprints.id"), nullable=True)
    title: Mapped[str] = mapped_column(Text, nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    status: Mapped[IssueStatus] = mapped_column(
        enum_column(IssueStatus), default=IssueStatus.TODO, nullable=False
    )
    priority: Mapped[IssuePriority] = mapped_column(
        enum_column(IssuePriority), default=IssuePriority.P2, nullable=False
    )
    assignee_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    reporter_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
    story_points: Mapped[int | None] = mapped_column(Integer, nullable=True)
    labels: Mapped[list[str]] = mapped_column(ARRAY(Text), default=list, nullable=False)
    epic_color: Mapped[str | None] = mapped_column(String(32), nullable=True)
    start_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    due_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    rank: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


class IssueComment(Base):
    __tablename__ = "issue_comments"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    issue_id: Mapped[int] = mapped_column(ForeignKey("issues.id"), nullable=False, index=True)
    author_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
    body: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

from datetime import date, datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, EmailStr, Field, computed_field

from app.models.entities import (
    ApprovalStatus,
    BackupStatus,
    CalendarEventStatus,
    DrillOutcome,
    IssuePriority,
    IssueStatus,
    IssueType,
    ProjectStatus,
    RCAStatus,
    ReportTemplateType,
    RoleEnum,
    SprintStatus,
    SubmissionStatus,
    TicketCategory,
    TicketIssueType,
    TicketPriority,
    TicketSource,
    TicketStatus,
    UserPresenceStatus,
)


class ORMModel(BaseModel):
    model_config = ConfigDict(from_attributes=True)


class MessageResponse(BaseModel):
    message: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: "UserRead"


class LoginRequest(BaseModel):
    identifier: str = Field(..., min_length=1, description="Email or employee ID")
    password: str


class UserBase(BaseModel):
    name: str
    employee_id: str | None = None
    email: EmailStr
    phone: str | None = None
    designation: str | None = None
    role: RoleEnum
    is_active: bool = True
    status_presence: UserPresenceStatus = UserPresenceStatus.AVAILABLE
    status_message: str | None = None
    linkedin_url: str | None = None
    github_url: str | None = None
    website_url: str | None = None
    bio: str | None = None
    has_seen_issues_tour: bool = False


class UserCreate(UserBase):
    password: str


class UserUpdate(BaseModel):
    name: str | None = None
    employee_id: str | None = None
    email: EmailStr | None = None
    phone: str | None = None
    designation: str | None = None
    role: RoleEnum | None = None
    password: str | None = None
    is_active: bool | None = None
    status_presence: UserPresenceStatus | None = None
    status_message: str | None = None
    linkedin_url: str | None = None
    github_url: str | None = None
    website_url: str | None = None
    bio: str | None = None
    avatar_object_key: str | None = None
    avatar_content_type: str | None = None
    has_seen_issues_tour: bool | None = None


class UserSelfUpdate(BaseModel):
    """Profile fields a signed-in user may change for themselves (no role/active)."""

    name: str | None = None
    employee_id: str | None = None
    email: EmailStr | None = None
    phone: str | None = None
    designation: str | None = None
    password: str | None = None
    status_presence: UserPresenceStatus | None = None
    status_message: str | None = Field(default=None, max_length=280)
    linkedin_url: str | None = Field(default=None, max_length=500)
    github_url: str | None = Field(default=None, max_length=500)
    website_url: str | None = Field(default=None, max_length=500)
    bio: str | None = Field(default=None, max_length=500)


class UserRead(UserBase, ORMModel):
    id: int
    created_at: datetime
    avatar_object_key: str | None = Field(default=None, exclude=True)

    @computed_field  # type: ignore[prop-decorator]
    @property
    def has_avatar(self) -> bool:
        return bool(self.avatar_object_key)


class ContactPerson(BaseModel):
    name: str = Field(..., min_length=1)
    designation: str | None = None
    email: str | None = None
    phone: str | None = None


class ProjectUserSummary(ORMModel):
    id: int
    name: str
    email: str
    designation: str | None = None
    role: RoleEnum


class ProjectBase(BaseModel):
    project_no: str
    name: str
    client_name: str
    customer_name: str | None = None
    details: str | None = None
    contact_persons: list[ContactPerson] = []
    company_address: str | None = None
    status: ProjectStatus = ProjectStatus.ACTIVE
    team_lead_id: int | None = None
    backup_policy_json: dict[str, Any] = {}
    rto_target: str | None = None
    rpo_target: str | None = None
    is_managed_project: bool = False
    member_ids: list[int] = []


class ProjectCreate(ProjectBase):
    pass


class ProjectUpdate(BaseModel):
    project_no: str | None = None
    name: str | None = None
    client_name: str | None = None
    customer_name: str | None = None
    details: str | None = None
    contact_persons: list[ContactPerson] | None = None
    company_address: str | None = None
    status: ProjectStatus | None = None
    team_lead_id: int | None = None
    backup_policy_json: dict[str, Any] | None = None
    rto_target: str | None = None
    rpo_target: str | None = None
    is_managed_project: bool | None = None
    member_ids: list[int] | None = None
    amc_terms_object_key: str | None = None
    amc_terms_filename: str | None = None


class ProjectDocumentRead(ORMModel):
    id: int
    project_id: int
    category: str
    title: str | None = None
    filename: str
    object_key: str
    content_type: str | None = None
    url: str | None = None
    created_at: datetime


class ProjectRead(ORMModel):
    id: int
    project_no: str
    name: str
    client_name: str
    customer_name: str | None = None
    details: str | None = None
    contact_persons: list[ContactPerson] = []
    company_address: str | None = None
    status: ProjectStatus
    amc_terms_object_key: str | None = None
    amc_terms_filename: str | None = None
    amc_terms_url: str | None = None
    team_lead_id: int | None
    team_lead: ProjectUserSummary | None = None
    backup_policy_json: dict[str, Any]
    rto_target: str | None
    rpo_target: str | None
    is_managed_project: bool = False
    created_at: datetime
    member_ids: list[int] = []
    members: list[ProjectUserSummary] = []
    documents: list[ProjectDocumentRead] = []


class TemplateBase(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    name: str
    type: ReportTemplateType
    schema_definition: dict[str, Any] | None = Field(default=None, alias="schema_json")
    uploaded_file_path: str | None = None


class TemplateCreate(TemplateBase):
    pass


class TemplateUpdate(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    name: str | None = None
    type: ReportTemplateType | None = None
    schema_definition: dict[str, Any] | None = Field(default=None, alias="schema_json")
    uploaded_file_path: str | None = None


class TemplateRead(TemplateBase, ORMModel):
    id: int
    created_by: int
    created_at: datetime


class ReportSubmissionBase(BaseModel):
    template_id: int
    project_id: int
    period: str
    data_json: dict[str, Any] | None = None
    file_path: str | None = None


class ReportSubmissionCreate(ReportSubmissionBase):
    status: SubmissionStatus = SubmissionStatus.DRAFT


class ReportSubmissionRead(ReportSubmissionBase, ORMModel):
    id: int
    submitted_by: int
    status: SubmissionStatus
    reviewed_by: int | None
    reviewed_at: datetime | None
    comments: str | None
    created_at: datetime


class ApprovalDecision(BaseModel):
    approved: bool
    comment: str | None = None


class HealthCheckBase(BaseModel):
    project_id: int
    period: str
    uptime_status: str
    patches_applied: str
    observations: str | None = None


class HealthCheckCreate(HealthCheckBase):
    pass


class HealthCheckRead(HealthCheckBase, ORMModel):
    id: int
    logged_by: int
    logged_at: datetime


class DbMetricBase(BaseModel):
    project_id: int
    period: str
    cpu_pct: float
    memory_pct: float
    disk_io_notes: str | None = None


class DbMetricCreate(DbMetricBase):
    pass


class DbMetricRead(DbMetricBase, ORMModel):
    id: int
    logged_by: int
    logged_at: datetime


class BackupRunBase(BaseModel):
    project_id: int
    run_date: date
    status: BackupStatus
    storage_location: str | None = None
    notes: str | None = None


class BackupRunCreate(BackupRunBase):
    pass


class BackupRunRead(BackupRunBase, ORMModel):
    id: int
    logged_by: int


class RestorationDrillBase(BaseModel):
    project_id: int
    quarter: str
    outcome: DrillOutcome
    time_taken_mins: int
    notes: str | None = None


class RestorationDrillCreate(RestorationDrillBase):
    pass


class RestorationDrillRead(RestorationDrillBase, ORMModel):
    id: int
    performed_by: int
    performed_at: datetime


class TicketBase(BaseModel):
    project_id: int
    category: TicketCategory = TicketCategory.INCIDENT
    issue_type: TicketIssueType
    priority: TicketPriority
    title: str = Field(min_length=2, max_length=255)
    description: str = Field(min_length=2)
    details: str | None = None
    source: TicketSource = TicketSource.MANUAL
    reported_on: datetime | None = None
    assignee_id: int | None = None
    due_date: datetime | None = None


class TicketCreate(TicketBase):
    status: TicketStatus = TicketStatus.OPEN


class TicketUpdate(BaseModel):
    category: TicketCategory | None = None
    issue_type: TicketIssueType | None = None
    priority: TicketPriority | None = None
    status: TicketStatus | None = None
    title: str | None = None
    description: str | None = None
    details: str | None = None
    source: TicketSource | None = None
    reported_on: datetime | None = None
    assignee_id: int | None = None
    due_date: datetime | None = None
    status_comment: str | None = None


class TicketResolutionUpdate(BaseModel):
    resolution_summary: str | None = None
    resolution_root_cause: str | None = None
    resolution_steps: str | None = None


class TicketRead(TicketBase, ORMModel):
    id: int
    ticket_number: str | None = None
    status: TicketStatus
    raised_by: int
    resolution_summary: str | None = None
    resolution_root_cause: str | None = None
    resolution_steps: str | None = None
    created_at: datetime
    resolved_at: datetime | None
    closed_at: datetime | None


class TicketCommentCreate(BaseModel):
    comment: str = Field(min_length=1)


class TicketCommentRead(ORMModel):
    id: int
    ticket_id: int
    author_id: int
    author_name: str | None = None
    comment: str
    created_at: datetime


class TicketAttachmentRead(ORMModel):
    id: int
    ticket_id: int
    filename: str
    content_type: str | None = None
    size_bytes: int | None = None
    uploaded_by: int
    uploader_name: str | None = None
    created_at: datetime


class TicketHistoryRead(ORMModel):
    id: int
    ticket_id: int
    actor_id: int | None = None
    actor_name: str | None = None
    action: str
    detail: str | None = None
    created_at: datetime


class RCABase(BaseModel):
    ticket_id: int
    content: str | None = None
    file_path: str | None = None


class RCACreate(RCABase):
    pass


class RCARead(RCABase, ORMModel):
    id: int
    submitted_by: int
    status: RCAStatus
    reviewed_by: int | None
    reviewed_at: datetime | None


class CalendarEventTypeConfigBase(BaseModel):
    project_id: int
    name: str = Field(..., min_length=1, max_length=100)
    color: str = Field(default="#3758F9", max_length=32)
    frequency_interval: int | None = Field(default=None, ge=1)
    frequency_unit: str | None = Field(default=None, pattern="^(day|week|month|year)$")


class CalendarEventTypeConfigCreate(CalendarEventTypeConfigBase):
    pass


class CalendarEventTypeConfigUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=100)
    color: str | None = Field(default=None, max_length=32)
    frequency_interval: int | None = Field(default=None, ge=1)
    frequency_unit: str | None = Field(default=None, pattern="^(day|week|month|year)$")


class CalendarEventTypeConfigRead(CalendarEventTypeConfigBase, ORMModel):
    id: int
    created_at: datetime | None = None


class CalendarEventBase(BaseModel):
    project_id: int | None = None
    type: str = Field(..., min_length=1, max_length=100)
    event_type_id: int | None = None
    title: str
    description: str | None = None
    start_at: datetime | None = None
    end_at: datetime | None = None
    due_date: datetime | None = None
    owner_id: int
    status: CalendarEventStatus = CalendarEventStatus.SCHEDULED
    color: str | None = None
    meeting_link: str | None = None
    is_milestone: bool = False
    updates: list[dict[str, Any]] = []
    milestones: list[dict[str, Any]] = []
    final_reports: list[dict[str, Any]] = []
    recurrence_rule: str | None = None


class CalendarEventCreate(CalendarEventBase):
    pass


class CalendarEventUpdate(BaseModel):
    project_id: int | None = None
    type: str | None = Field(default=None, min_length=1, max_length=100)
    event_type_id: int | None = None
    title: str | None = None
    description: str | None = None
    start_at: datetime | None = None
    end_at: datetime | None = None
    due_date: datetime | None = None
    owner_id: int | None = None
    status: CalendarEventStatus | None = None
    color: str | None = None
    meeting_link: str | None = None
    is_milestone: bool | None = None
    updates: list[dict[str, Any]] | None = None
    milestones: list[dict[str, Any]] | None = None
    final_reports: list[dict[str, Any]] | None = None
    recurrence_rule: str | None = None


class CalendarEventRead(ORMModel):
    id: int
    project_id: int | None = None
    type: str
    event_type_id: int | None = None
    title: str
    description: str | None = None
    start_at: datetime
    end_at: datetime
    due_date: datetime
    owner_id: int
    status: CalendarEventStatus
    color: str | None = None
    meeting_link: str | None = None
    is_milestone: bool = False
    updates: list[dict[str, Any]] = []
    milestones: list[dict[str, Any]] = []
    final_reports: list[dict[str, Any]] = []
    recurrence_rule: str | None = None
    created_at: datetime | None = None
    updated_at: datetime | None = None


class ApprovalRead(ORMModel):
    id: int
    entity_type: str
    entity_id: int
    requested_by: int
    approver_id: int
    status: ApprovalStatus
    comment: str | None
    decided_at: datetime | None
    created_at: datetime


class NotificationLogRead(ORMModel):
    id: int
    user_id: int | None
    type: str
    subject: str
    sent_at: datetime
    related_entity: str | None


class ProjectReportDocumentRead(ORMModel):
    id: int
    project_id: int
    report_type_id: int
    title: str
    period_label: str | None = None
    filename: str
    content_type: str | None = None
    notes: str | None = None
    uploaded_by: int
    created_at: datetime


class ProjectReportDocumentUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=255)
    filename: str | None = Field(default=None, min_length=1, max_length=255)
    period_label: str | None = Field(default=None, max_length=120)
    notes: str | None = None


class ProjectReportPeriodRename(BaseModel):
    from_label: str = Field(..., min_length=1, max_length=120)
    to_label: str = Field(..., min_length=1, max_length=120)


class ProjectReportTypeBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=150)
    description: str | None = None
    frequency_interval: int | None = Field(default=None, ge=1)
    frequency_unit: str | None = Field(default=None, pattern="^(day|week|month|year)$")


class ProjectReportTypeCreate(ProjectReportTypeBase):
    pass


class ProjectReportTypeUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=150)
    description: str | None = None
    frequency_interval: int | None = Field(default=None, ge=1)
    frequency_unit: str | None = Field(default=None, pattern="^(day|week|month|year)$")


class ProjectReportTypeRead(ProjectReportTypeBase, ORMModel):
    id: int
    project_id: int
    template_filename: str | None = None
    template_content_type: str | None = None
    has_template: bool = False
    created_by: int
    created_at: datetime
    updated_at: datetime | None = None
    documents: list[ProjectReportDocumentRead] = []


# --- Delivery issues (Jira-style workspace) ---


class SprintCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=200)
    goal: str | None = None
    start_date: date | None = None
    end_date: date | None = None


class SprintUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=200)
    goal: str | None = None
    status: SprintStatus | None = None
    start_date: date | None = None
    end_date: date | None = None


class SprintRead(ORMModel):
    id: int
    project_id: int
    name: str
    goal: str | None = None
    status: SprintStatus
    start_date: date | None = None
    end_date: date | None = None
    created_at: datetime
    updated_at: datetime
    issue_count: int = 0


class SprintCompleteRequest(BaseModel):
    incomplete_destination: str = Field(
        default="backlog",
        pattern="^(backlog|next_sprint)$",
    )
    next_sprint_id: int | None = None


class IssueCreate(BaseModel):
    title: str = Field(..., min_length=1)
    type: IssueType = IssueType.TASK
    description: str | None = None
    parent_id: int | None = None
    sprint_id: int | None = None
    status: IssueStatus = IssueStatus.TODO
    priority: IssuePriority = IssuePriority.P2
    assignee_id: int | None = None
    story_points: int | None = Field(default=None, ge=0, le=100)
    labels: list[str] = []
    epic_color: str | None = None
    start_date: date | None = None
    due_date: date | None = None


class IssueUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=1)
    type: IssueType | None = None
    description: str | None = None
    parent_id: int | None = None
    sprint_id: int | None = None
    status: IssueStatus | None = None
    priority: IssuePriority | None = None
    assignee_id: int | None = None
    story_points: int | None = Field(default=None, ge=0, le=100)
    labels: list[str] | None = None
    epic_color: str | None = None
    start_date: date | None = None
    due_date: date | None = None
    rank: float | None = None
    clear_parent: bool = False
    clear_sprint: bool = False
    clear_assignee: bool = False


class IssueRankUpdate(BaseModel):
    before_id: int | None = None
    after_id: int | None = None
    sprint_id: int | None = None
    clear_sprint: bool = False
    status: IssueStatus | None = None


class IssueCommentCreate(BaseModel):
    body: str = Field(..., min_length=1)


class IssueCommentRead(ORMModel):
    id: int
    issue_id: int
    author_id: int
    author_name: str | None = None
    body: str
    created_at: datetime


class IssueRead(ORMModel):
    id: int
    project_id: int
    key: str
    type: IssueType
    parent_id: int | None = None
    sprint_id: int | None = None
    title: str
    description: str | None = None
    status: IssueStatus
    priority: IssuePriority
    assignee_id: int | None = None
    assignee_name: str | None = None
    reporter_id: int
    reporter_name: str | None = None
    story_points: int | None = None
    labels: list[str] = []
    epic_color: str | None = None
    start_date: date | None = None
    due_date: date | None = None
    rank: float
    created_at: datetime
    updated_at: datetime
    children: list["IssueRead"] = []
    comments: list[IssueCommentRead] = []
    child_count: int = 0
    child_done_count: int = 0


class BoardColumnRead(BaseModel):
    status: IssueStatus
    issues: list[IssueRead]


class BoardRead(BaseModel):
    sprint_id: int | None = None
    columns: list[BoardColumnRead]


class TimelineIssueRead(BaseModel):
    id: int
    key: str
    type: IssueType
    title: str
    parent_id: int | None = None
    start_date: date | None = None
    due_date: date | None = None
    epic_color: str | None = None
    status: IssueStatus
    children: list["TimelineIssueRead"] = []


class TimelineSprintMarker(BaseModel):
    id: int
    name: str
    start_date: date | None = None
    end_date: date | None = None
    status: SprintStatus


class TimelineRead(BaseModel):
    issues: list[TimelineIssueRead]
    sprints: list[TimelineSprintMarker]


TokenResponse.model_rebuild()
IssueRead.model_rebuild()
TimelineIssueRead.model_rebuild()

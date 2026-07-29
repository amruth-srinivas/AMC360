from datetime import date, datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, EmailStr, Field

from app.models.entities import (
    ApprovalStatus,
    BackupStatus,
    CalendarEventStatus,
    CalendarEventType,
    DrillOutcome,
    ProjectStatus,
    RCAStatus,
    ReportTemplateType,
    RoleEnum,
    SubmissionStatus,
    TicketCategory,
    TicketPriority,
    TicketStatus,
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


class UserRead(UserBase, ORMModel):
    id: int
    created_at: datetime


class ContactPerson(BaseModel):
    name: str = Field(..., min_length=1)
    designation: str | None = None
    email: str | None = None
    phone: str | None = None


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
    member_ids: list[int] | None = None
    amc_terms_object_key: str | None = None
    amc_terms_filename: str | None = None


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
    backup_policy_json: dict[str, Any]
    rto_target: str | None
    rpo_target: str | None
    created_at: datetime
    member_ids: list[int] = []


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
    category: TicketCategory
    priority: TicketPriority
    title: str
    description: str
    assignee_id: int | None = None
    due_date: datetime | None = None


class TicketCreate(TicketBase):
    status: TicketStatus = TicketStatus.OPEN


class TicketUpdate(BaseModel):
    category: TicketCategory | None = None
    priority: TicketPriority | None = None
    status: TicketStatus | None = None
    title: str | None = None
    description: str | None = None
    assignee_id: int | None = None
    due_date: datetime | None = None


class TicketRead(TicketBase, ORMModel):
    id: int
    status: TicketStatus
    raised_by: int
    created_at: datetime
    resolved_at: datetime | None
    closed_at: datetime | None


class TicketCommentCreate(BaseModel):
    comment: str


class TicketCommentRead(ORMModel):
    id: int
    ticket_id: int
    author_id: int
    comment: str
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


class CalendarEventBase(BaseModel):
    project_id: int | None = None
    type: CalendarEventType
    title: str
    due_date: datetime
    owner_id: int
    status: CalendarEventStatus = CalendarEventStatus.SCHEDULED
    recurrence_rule: str | None = None


class CalendarEventCreate(CalendarEventBase):
    pass


class CalendarEventUpdate(BaseModel):
    project_id: int | None = None
    type: CalendarEventType | None = None
    title: str | None = None
    due_date: datetime | None = None
    owner_id: int | None = None
    status: CalendarEventStatus | None = None
    recurrence_rule: str | None = None


class CalendarEventRead(CalendarEventBase, ORMModel):
    id: int


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


TokenResponse.model_rebuild()

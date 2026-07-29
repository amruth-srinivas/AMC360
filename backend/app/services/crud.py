from datetime import UTC, datetime
from typing import Any

from fastapi import HTTPException
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.entities import (
    Approval,
    ApprovalStatus,
    BackupRun,
    CalendarEvent,
    DbMetricEntry,
    HealthCheckEntry,
    NotificationLog,
    Project,
    ProjectMember,
    RCADocument,
    RCAStatus,
    ReportSubmission,
    ReportTemplate,
    RestorationDrill,
    SubmissionStatus,
    Ticket,
    TicketComment,
    TicketStatus,
    User,
)
from app.schemas.common import (
    ApprovalDecision,
    BackupRunCreate,
    CalendarEventCreate,
    CalendarEventUpdate,
    DbMetricCreate,
    HealthCheckCreate,
    ProjectCreate,
    ProjectUpdate,
    RCACreate,
    ReportSubmissionCreate,
    TemplateCreate,
    TemplateUpdate,
    TicketCommentCreate,
    TicketCreate,
    TicketUpdate,
    UserCreate,
    UserUpdate,
)
from app.core.security import get_password_hash


async def list_rows(db: AsyncSession, model: type) -> list[Any]:
    result = await db.execute(select(model))
    return list(result.scalars().all())


async def create_user(db: AsyncSession, payload: UserCreate) -> User:
    user = User(
        name=payload.name,
        employee_id=payload.employee_id,
        email=payload.email,
        phone=payload.phone,
        designation=payload.designation,
        hashed_password=get_password_hash(payload.password),
        role=payload.role,
        is_active=payload.is_active,
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)
    return user


async def update_user(db: AsyncSession, user: User, payload: UserUpdate) -> User:
    updates = payload.model_dump(exclude_unset=True)
    if "password" in updates:
        updates["hashed_password"] = get_password_hash(updates.pop("password"))
    for key, value in updates.items():
        setattr(user, key, value)
    await db.commit()
    await db.refresh(user)
    return user


async def delete_user(db: AsyncSession, user: User) -> None:
    await db.delete(user)
    await db.commit()


async def create_project(db: AsyncSession, payload: ProjectCreate) -> Project:
    data = payload.model_dump(exclude={"member_ids"})
    data["contact_persons"] = [person.model_dump() for person in payload.contact_persons]
    project = Project(**data)
    db.add(project)
    await db.flush()
    for member_id in payload.member_ids:
        db.add(ProjectMember(project_id=project.id, user_id=member_id))
    await db.commit()
    await db.refresh(project)
    return project


async def update_project(db: AsyncSession, project: Project, payload: ProjectUpdate) -> Project:
    updates = payload.model_dump(exclude_unset=True, exclude={"member_ids"})
    if "contact_persons" in updates and updates["contact_persons"] is not None:
        updates["contact_persons"] = [
            person if isinstance(person, dict) else person
            for person in updates["contact_persons"]
        ]
    for key, value in updates.items():
        setattr(project, key, value)
    if payload.member_ids is not None:
        await db.execute(delete(ProjectMember).where(ProjectMember.project_id == project.id))
        for member_id in payload.member_ids:
            db.add(ProjectMember(project_id=project.id, user_id=member_id))
    await db.commit()
    await db.refresh(project)
    return project


async def delete_project(db: AsyncSession, project: Project) -> None:
    await db.execute(delete(ProjectMember).where(ProjectMember.project_id == project.id))
    await db.delete(project)
    await db.commit()


async def get_project_member_ids(db: AsyncSession, project_id: int) -> list[int]:
    result = await db.execute(select(ProjectMember.user_id).where(ProjectMember.project_id == project_id))
    return list(result.scalars().all())


async def create_template(db: AsyncSession, payload: TemplateCreate, user_id: int) -> ReportTemplate:
    item = ReportTemplate(**payload.model_dump(by_alias=True), created_by=user_id)
    db.add(item)
    await db.commit()
    await db.refresh(item)
    return item


async def update_template(db: AsyncSession, item: ReportTemplate, payload: TemplateUpdate) -> ReportTemplate:
    for key, value in payload.model_dump(by_alias=True, exclude_unset=True).items():
        setattr(item, key, value)
    await db.commit()
    await db.refresh(item)
    return item


async def create_report_submission(
    db: AsyncSession, payload: ReportSubmissionCreate, user_id: int
) -> ReportSubmission:
    item = ReportSubmission(**payload.model_dump(), submitted_by=user_id)
    db.add(item)
    await db.commit()
    await db.refresh(item)
    return item


async def submit_report_for_approval(
    db: AsyncSession, submission: ReportSubmission, approver_id: int, user_id: int
) -> ReportSubmission:
    submission.status = SubmissionStatus.SUBMITTED
    db.add(
        Approval(
            entity_type="report_submission",
            entity_id=submission.id,
            requested_by=user_id,
            approver_id=approver_id,
            status=ApprovalStatus.PENDING,
        )
    )
    await db.commit()
    await db.refresh(submission)
    return submission


async def decide_report(
    db: AsyncSession,
    submission: ReportSubmission,
    decision: ApprovalDecision,
    reviewer_id: int,
) -> ReportSubmission:
    submission.status = (
        SubmissionStatus.APPROVED if decision.approved else SubmissionStatus.REJECTED
    )
    submission.reviewed_by = reviewer_id
    submission.reviewed_at = datetime.now(UTC)
    submission.comments = decision.comment
    await db.commit()
    await db.refresh(submission)
    return submission


async def create_health_check(
    db: AsyncSession, payload: HealthCheckCreate, user_id: int
) -> HealthCheckEntry:
    item = HealthCheckEntry(**payload.model_dump(), logged_by=user_id)
    db.add(item)
    await db.commit()
    await db.refresh(item)
    return item


async def create_db_metric(db: AsyncSession, payload: DbMetricCreate, user_id: int) -> DbMetricEntry:
    item = DbMetricEntry(**payload.model_dump(), logged_by=user_id)
    db.add(item)
    await db.commit()
    await db.refresh(item)
    return item


async def create_backup_run(db: AsyncSession, payload: BackupRunCreate, user_id: int) -> BackupRun:
    item = BackupRun(**payload.model_dump(), logged_by=user_id)
    db.add(item)
    await db.commit()
    await db.refresh(item)
    return item


async def create_restoration_drill(
    db: AsyncSession, payload, user_id: int
) -> RestorationDrill:
    item = RestorationDrill(**payload.model_dump(), performed_by=user_id)
    db.add(item)
    await db.commit()
    await db.refresh(item)
    return item


async def create_ticket(db: AsyncSession, payload: TicketCreate, user_id: int) -> Ticket:
    item = Ticket(**payload.model_dump(), raised_by=user_id)
    db.add(item)
    await db.commit()
    await db.refresh(item)
    return item


async def update_ticket(db: AsyncSession, ticket: Ticket, payload: TicketUpdate) -> Ticket:
    updates = payload.model_dump(exclude_unset=True)
    previous_status = ticket.status
    for key, value in updates.items():
        setattr(ticket, key, value)
    if ticket.status == TicketStatus.RESOLVED and previous_status != TicketStatus.RESOLVED:
        ticket.resolved_at = datetime.now(UTC)
    if ticket.status == TicketStatus.CLOSED and previous_status != TicketStatus.CLOSED:
        ticket.closed_at = datetime.now(UTC)
    await db.commit()
    await db.refresh(ticket)
    return ticket


async def create_ticket_comment(
    db: AsyncSession, ticket_id: int, payload: TicketCommentCreate, user_id: int
) -> TicketComment:
    item = TicketComment(ticket_id=ticket_id, author_id=user_id, comment=payload.comment)
    db.add(item)
    await db.commit()
    await db.refresh(item)
    return item


async def create_rca(db: AsyncSession, payload: RCACreate, user_id: int) -> RCADocument:
    item = RCADocument(**payload.model_dump(), submitted_by=user_id)
    db.add(item)
    await db.commit()
    await db.refresh(item)
    return item


async def decide_rca(
    db: AsyncSession, item: RCADocument, decision: ApprovalDecision, reviewer_id: int
) -> RCADocument:
    item.status = RCAStatus.APPROVED if decision.approved else RCAStatus.REJECTED
    item.reviewed_by = reviewer_id
    item.reviewed_at = datetime.now(UTC)
    await db.commit()
    await db.refresh(item)
    return item


async def create_calendar_event(db: AsyncSession, payload: CalendarEventCreate) -> CalendarEvent:
    item = CalendarEvent(**payload.model_dump())
    db.add(item)
    await db.commit()
    await db.refresh(item)
    return item


async def update_calendar_event(
    db: AsyncSession, item: CalendarEvent, payload: CalendarEventUpdate
) -> CalendarEvent:
    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(item, key, value)
    await db.commit()
    await db.refresh(item)
    return item


async def decide_generic_approval(
    db: AsyncSession, item: Approval, decision: ApprovalDecision
) -> Approval:
    item.status = ApprovalStatus.APPROVED if decision.approved else ApprovalStatus.REJECTED
    item.comment = decision.comment
    item.decided_at = datetime.now(UTC)
    await db.commit()
    await db.refresh(item)
    return item


async def log_notification(
    db: AsyncSession,
    user_id: int | None,
    type_: str,
    subject: str,
    related_entity: str | None,
) -> NotificationLog:
    item = NotificationLog(
        user_id=user_id,
        type=type_,
        subject=subject,
        related_entity=related_entity,
    )
    db.add(item)
    await db.commit()
    await db.refresh(item)
    return item


async def get_required(db: AsyncSession, model: type, row_id: int):
    row = await db.get(model, row_id)
    if not row:
        raise HTTPException(status_code=404, detail=f"{model.__name__} not found")
    return row

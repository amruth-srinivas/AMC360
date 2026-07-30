from datetime import UTC, datetime
import random
from typing import Any

from fastapi import HTTPException
from sqlalchemy import delete, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.entities import (
    Approval,
    ApprovalStatus,
    BackupRun,
    CalendarEvent,
    CalendarEventStatus,
    CalendarEventTypeConfig,
    DbMetricEntry,
    HealthCheckEntry,
    NotificationLog,
    Project,
    ProjectDocument,
    ProjectDocumentCategory,
    ProjectMember,
    RCADocument,
    RCAStatus,
    ReportSubmission,
    ReportTemplate,
    RestorationDrill,
    SubmissionStatus,
    Ticket,
    TicketAttachment,
    TicketComment,
    TicketHistory,
    TicketStatus,
    User,
)
from app.schemas.common import (
    ApprovalDecision,
    BackupRunCreate,
    CalendarEventCreate,
    CalendarEventTypeConfigCreate,
    CalendarEventTypeConfigUpdate,
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
    TicketResolutionUpdate,
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
    await db.execute(delete(ProjectDocument).where(ProjectDocument.project_id == project.id))
    await db.execute(delete(ProjectMember).where(ProjectMember.project_id == project.id))
    await db.delete(project)
    await db.commit()


async def get_project_member_ids(db: AsyncSession, project_id: int) -> list[int]:
    result = await db.execute(select(ProjectMember.user_id).where(ProjectMember.project_id == project_id))
    return list(result.scalars().all())


async def list_project_documents(db: AsyncSession, project_id: int) -> list[ProjectDocument]:
    result = await db.execute(
        select(ProjectDocument)
        .where(ProjectDocument.project_id == project_id)
        .order_by(ProjectDocument.created_at.desc())
    )
    return list(result.scalars().all())


async def create_project_document(
    db: AsyncSession,
    *,
    project: Project,
    category: ProjectDocumentCategory,
    title: str | None,
    filename: str,
    object_key: str,
    content_type: str | None,
) -> ProjectDocument:
    document = ProjectDocument(
        project_id=project.id,
        category=category,
        title=title,
        filename=filename,
        object_key=object_key,
        content_type=content_type,
    )
    db.add(document)

    if category == ProjectDocumentCategory.AMC_TERMS:
        project.amc_terms_object_key = object_key
        project.amc_terms_filename = filename

    await db.commit()
    await db.refresh(document)
    return document


async def delete_project_document(db: AsyncSession, project: Project, document: ProjectDocument) -> None:
    was_amc = (
        document.category == ProjectDocumentCategory.AMC_TERMS
        and project.amc_terms_object_key == document.object_key
    )
    await db.delete(document)
    await db.flush()

    if was_amc:
        remaining = await db.execute(
            select(ProjectDocument)
            .where(
                ProjectDocument.project_id == project.id,
                ProjectDocument.category == ProjectDocumentCategory.AMC_TERMS,
            )
            .order_by(ProjectDocument.created_at.desc())
            .limit(1)
        )
        latest = remaining.scalar_one_or_none()
        if latest:
            project.amc_terms_object_key = latest.object_key
            project.amc_terms_filename = latest.filename
        else:
            project.amc_terms_object_key = None
            project.amc_terms_filename = None

    await db.commit()


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


async def generate_ticket_number(db: AsyncSession) -> str:
    for _ in range(200):
        candidate = f"{random.randint(0, 9999):04d}"
        exists = await db.execute(select(Ticket.id).where(Ticket.ticket_number == candidate))
        if exists.scalar_one_or_none() is None:
            return candidate
    raise HTTPException(status_code=500, detail="Unable to allocate ticket number")


async def log_ticket_history(
    db: AsyncSession,
    ticket_id: int,
    actor_id: int | None,
    action: str,
    detail: str | None = None,
) -> TicketHistory:
    entry = TicketHistory(
        ticket_id=ticket_id,
        actor_id=actor_id,
        action=action,
        detail=detail,
    )
    db.add(entry)
    await db.flush()
    return entry


async def create_ticket(db: AsyncSession, payload: TicketCreate, user_id: int) -> Ticket:
    data = payload.model_dump()
    item = Ticket(**data, raised_by=user_id, ticket_number=await generate_ticket_number(db))
    db.add(item)
    await db.flush()
    await log_ticket_history(
        db,
        item.id,
        user_id,
        "ticket_created",
        f"Ticket opened with issue type {item.issue_type}",
    )
    await db.commit()
    await db.refresh(item)
    return item


async def update_ticket(
    db: AsyncSession, ticket: Ticket, payload: TicketUpdate, actor_id: int
) -> Ticket:
    updates = payload.model_dump(exclude_unset=True, exclude={"status_comment"})
    status_comment = payload.status_comment
    previous_status = ticket.status
    for key, value in updates.items():
        setattr(ticket, key, value)
    if ticket.status == TicketStatus.RESOLVED and previous_status != TicketStatus.RESOLVED:
        ticket.resolved_at = datetime.now(UTC)
    if ticket.status == TicketStatus.CLOSED and previous_status != TicketStatus.CLOSED:
        ticket.closed_at = datetime.now(UTC)
    if ticket.status != previous_status:
        detail = f"{previous_status} -> {ticket.status}"
        if status_comment:
            detail = f"{detail}\nComment: {status_comment}"
        await log_ticket_history(db, ticket.id, actor_id, "status_changed", detail)
    await db.commit()
    await db.refresh(ticket)
    return ticket


async def update_ticket_resolution(
    db: AsyncSession,
    ticket: Ticket,
    payload: TicketResolutionUpdate,
    actor_id: int,
) -> Ticket:
    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(ticket, key, value)
    await log_ticket_history(db, ticket.id, actor_id, "resolution_updated", "Resolution fields saved")
    await db.commit()
    await db.refresh(ticket)
    return ticket


async def create_ticket_comment(
    db: AsyncSession, ticket_id: int, payload: TicketCommentCreate, user_id: int
) -> TicketComment:
    item = TicketComment(ticket_id=ticket_id, author_id=user_id, comment=payload.comment)
    db.add(item)
    await db.flush()
    await log_ticket_history(db, ticket_id, user_id, "comment_added", payload.comment[:500])
    await db.commit()
    await db.refresh(item)
    return item


async def create_ticket_attachment(
    db: AsyncSession,
    ticket_id: int,
    filename: str,
    object_key: str,
    content_type: str | None,
    size_bytes: int | None,
    user_id: int,
) -> TicketAttachment:
    item = TicketAttachment(
        ticket_id=ticket_id,
        filename=filename,
        object_key=object_key,
        content_type=content_type,
        size_bytes=size_bytes,
        uploaded_by=user_id,
    )
    db.add(item)
    await db.flush()
    size_label = f" ({round(size_bytes / 1024, 1)} KB)" if size_bytes else ""
    await log_ticket_history(
        db,
        ticket_id,
        user_id,
        "attachment_uploaded",
        f"{filename}{size_label}",
    )
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


DEFAULT_EVENT_TYPES = [
    ("Meeting", "#3758F9"),
    ("Deadline", "#EF4444"),
    ("Review", "#0EA5E9"),
    ("Delivery", "#22C55E"),
    ("Internal", "#A855F7"),
]


def _milestones_complete(milestones: list | None) -> bool:
    items = milestones or []
    if not items:
        return True
    return all(bool(item.get("done")) for item in items)


def _assert_done_allowed(status: Any, milestones: list | None) -> None:
    status_value = getattr(status, "value", status)
    if status_value == CalendarEventStatus.DONE.value and not _milestones_complete(milestones):
        raise HTTPException(
            status_code=400,
            detail="Mark all milestones complete before setting status to Done",
        )


def _normalize_event_times(data: dict[str, Any]) -> dict[str, Any]:
    start_at = data.get("start_at")
    end_at = data.get("end_at")
    due_date = data.get("due_date")

    if start_at is None and due_date is not None:
        start_at = due_date
    if end_at is None and due_date is not None:
        end_at = due_date
    if start_at is None and end_at is not None:
        start_at = end_at
    if end_at is None and start_at is not None:
        end_at = start_at
    if start_at is None or end_at is None:
        raise HTTPException(status_code=400, detail="start_at and end_at are required")
    if end_at < start_at:
        raise HTTPException(status_code=400, detail="end_at must be on or after start_at")

    data["start_at"] = start_at
    data["end_at"] = end_at
    data["due_date"] = end_at
    data.setdefault("milestones", [])
    data.setdefault("updates", [])
    data.setdefault("final_reports", [])
    return data


async def ensure_default_event_types(db: AsyncSession, project_id: int) -> list[CalendarEventTypeConfig]:
    result = await db.execute(
        select(CalendarEventTypeConfig)
        .where(CalendarEventTypeConfig.project_id == project_id)
        .order_by(CalendarEventTypeConfig.id.asc())
    )
    existing = list(result.scalars().all())
    if existing:
        return existing

    created: list[CalendarEventTypeConfig] = []
    for name, color in DEFAULT_EVENT_TYPES:
        item = CalendarEventTypeConfig(project_id=project_id, name=name, color=color)
        db.add(item)
        created.append(item)
    await db.commit()
    for item in created:
        await db.refresh(item)
    return created


async def list_event_types(db: AsyncSession, project_id: int) -> list[CalendarEventTypeConfig]:
    return await ensure_default_event_types(db, project_id)


async def create_event_type(
    db: AsyncSession, payload: CalendarEventTypeConfigCreate
) -> CalendarEventTypeConfig:
    await ensure_default_event_types(db, payload.project_id)
    existing = await db.execute(
        select(CalendarEventTypeConfig).where(
            CalendarEventTypeConfig.project_id == payload.project_id,
            CalendarEventTypeConfig.name == payload.name.strip(),
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Event type with this name already exists")
    if not payload.frequency_interval:
        # one-time / as needed
        pass
    elif not payload.frequency_unit:
        raise HTTPException(status_code=400, detail="frequency_unit is required when interval is set")

    item = CalendarEventTypeConfig(
        project_id=payload.project_id,
        name=payload.name.strip(),
        color=payload.color or "#3758F9",
        frequency_interval=payload.frequency_interval,
        frequency_unit=payload.frequency_unit if payload.frequency_interval else None,
    )
    db.add(item)
    await db.commit()
    await db.refresh(item)
    return item


async def update_event_type(
    db: AsyncSession, item: CalendarEventTypeConfig, payload: CalendarEventTypeConfigUpdate
) -> CalendarEventTypeConfig:
    data = payload.model_dump(exclude_unset=True)
    previous_name = item.name
    if "name" in data and data["name"] is not None:
        data["name"] = data["name"].strip()
        clash = await db.execute(
            select(CalendarEventTypeConfig).where(
                CalendarEventTypeConfig.project_id == item.project_id,
                CalendarEventTypeConfig.name == data["name"],
                CalendarEventTypeConfig.id != item.id,
            )
        )
        if clash.scalar_one_or_none():
            raise HTTPException(status_code=400, detail="Event type with this name already exists")
    for key, value in data.items():
        setattr(item, key, value)

    # Normalize one-time types (no interval → clear unit).
    if item.frequency_interval is None:
        item.frequency_unit = None
    elif not item.frequency_unit:
        raise HTTPException(status_code=400, detail="frequency_unit is required when interval is set")

    # Cascade color/name to all scheduled events using this type.
    event_result = await db.execute(
        select(CalendarEvent).where(
            CalendarEvent.project_id == item.project_id,
            or_(
                CalendarEvent.event_type_id == item.id,
                CalendarEvent.type == previous_name,
            ),
        )
    )
    linked_events = list(event_result.scalars().all())
    for event in linked_events:
        event.event_type_id = item.id
        event.type = item.name
        if "color" in data and data["color"] is not None:
            event.color = item.color

    await db.commit()
    await db.refresh(item)
    return item


async def delete_event_type(db: AsyncSession, item: CalendarEventTypeConfig) -> None:
    await db.delete(item)
    await db.commit()


async def create_calendar_event(db: AsyncSession, payload: CalendarEventCreate) -> CalendarEvent:
    data = _normalize_event_times(payload.model_dump())
    _assert_done_allowed(data.get("status"), data.get("milestones"))
    item = CalendarEvent(**data)
    db.add(item)
    await db.commit()
    await db.refresh(item)
    return item


async def update_calendar_event(
    db: AsyncSession, item: CalendarEvent, payload: CalendarEventUpdate
) -> CalendarEvent:
    data = payload.model_dump(exclude_unset=True)
    merged = {
        "start_at": data.get("start_at", item.start_at),
        "end_at": data.get("end_at", item.end_at),
        "due_date": data.get("due_date", item.due_date),
    }
    if any(key in data for key in ("start_at", "end_at", "due_date")):
        normalized = _normalize_event_times(merged)
        data["start_at"] = normalized["start_at"]
        data["end_at"] = normalized["end_at"]
        data["due_date"] = normalized["due_date"]

    next_status = data.get("status", item.status)
    next_milestones = data.get("milestones", item.milestones)
    _assert_done_allowed(next_status, next_milestones)

    for key, value in data.items():
        setattr(item, key, value)
    await db.commit()
    await db.refresh(item)
    return item


async def delete_calendar_event(db: AsyncSession, item: CalendarEvent) -> None:
    await db.delete(item)
    await db.commit()


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

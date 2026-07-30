from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from fastapi.responses import Response
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.core.db import get_db
from app.models.entities import (
    Approval,
    Project,
    RCADocument,
    RoleEnum,
    Ticket,
    TicketAttachment,
    TicketComment,
    TicketHistory,
    User,
)
from app.schemas.common import (
    ApprovalDecision,
    RCARead,
    RCACreate,
    TicketAttachmentRead,
    TicketCommentCreate,
    TicketCommentRead,
    TicketCreate,
    TicketHistoryRead,
    TicketRead,
    TicketResolutionUpdate,
    TicketUpdate,
)
from app.services.crud import (
    create_rca,
    create_ticket,
    create_ticket_attachment,
    create_ticket_comment,
    decide_generic_approval,
    decide_rca,
    get_required,
    log_ticket_history,
    update_ticket,
    update_ticket_resolution,
)
from app.services.storage import get_object_bytes, upload_ticket_attachment


router = APIRouter(prefix="/tickets", tags=["tickets"])
rca_router = APIRouter(prefix="/rca", tags=["rca"])


async def _user_name(db: AsyncSession, user_id: int | None) -> str | None:
    if not user_id:
        return None
    user = await db.get(User, user_id)
    return user.name if user else None


@router.get("", response_model=list[TicketRead])
async def list_tickets(
    project_id: int | None = None,
    status: str | None = None,
    priority: str | None = None,
    category: str | None = None,
    issue_type: str | None = None,
    assignee_id: int | None = None,
    _: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[TicketRead]:
    stmt = select(Ticket)
    if project_id:
        stmt = stmt.where(Ticket.project_id == project_id)
    if status:
        stmt = stmt.where(Ticket.status == status)
    if priority:
        stmt = stmt.where(Ticket.priority == priority)
    if category:
        stmt = stmt.where(Ticket.category == category)
    if issue_type:
        stmt = stmt.where(Ticket.issue_type == issue_type)
    if assignee_id:
        stmt = stmt.where(Ticket.assignee_id == assignee_id)
    result = await db.execute(stmt)
    return [TicketRead.model_validate(item) for item in result.scalars().all()]


@router.post("", response_model=TicketRead)
async def add_ticket(
    payload: TicketCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> TicketRead:
    return TicketRead.model_validate(await create_ticket(db, payload, current_user.id))


@router.get("/{ticket_id}", response_model=TicketRead)
async def get_ticket(
    ticket_id: int,
    _: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> TicketRead:
    return TicketRead.model_validate(await get_required(db, Ticket, ticket_id))


@router.put("/{ticket_id}", response_model=TicketRead)
async def edit_ticket(
    ticket_id: int,
    payload: TicketUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> TicketRead:
    ticket = await get_required(db, Ticket, ticket_id)
    return TicketRead.model_validate(
        await update_ticket(db, ticket, payload, current_user.id)
    )


@router.put("/{ticket_id}/resolution", response_model=TicketRead)
async def save_ticket_resolution(
    ticket_id: int,
    payload: TicketResolutionUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> TicketRead:
    ticket = await get_required(db, Ticket, ticket_id)
    if ticket.status == "closed":
        raise HTTPException(status_code=400, detail="Closed tickets cannot be edited")
    return TicketRead.model_validate(
        await update_ticket_resolution(db, ticket, payload, current_user.id)
    )


@router.get("/{ticket_id}/comments", response_model=list[TicketCommentRead])
async def list_comments(
    ticket_id: int,
    _: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[TicketCommentRead]:
    result = await db.execute(
        select(TicketComment).where(TicketComment.ticket_id == ticket_id).order_by(
            TicketComment.created_at
        )
    )
    rows: list[TicketCommentRead] = []
    for item in result.scalars().all():
        data = TicketCommentRead.model_validate(item)
        data.author_name = await _user_name(db, item.author_id)
        rows.append(data)
    return rows


@router.post("/{ticket_id}/comments", response_model=TicketCommentRead)
async def add_comment(
    ticket_id: int,
    payload: TicketCommentCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> TicketCommentRead:
    comment = await create_ticket_comment(db, ticket_id, payload, current_user.id)
    data = TicketCommentRead.model_validate(comment)
    data.author_name = await _user_name(db, comment.author_id)
    return data


@router.get("/{ticket_id}/attachments", response_model=list[TicketAttachmentRead])
async def list_attachments(
    ticket_id: int,
    _: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[TicketAttachmentRead]:
    result = await db.execute(
        select(TicketAttachment)
        .where(TicketAttachment.ticket_id == ticket_id)
        .order_by(TicketAttachment.created_at.desc())
    )
    rows: list[TicketAttachmentRead] = []
    for item in result.scalars().all():
        data = TicketAttachmentRead.model_validate(item)
        data.uploader_name = await _user_name(db, item.uploaded_by)
        rows.append(data)
    return rows


@router.post("/{ticket_id}/attachments", response_model=TicketAttachmentRead)
async def upload_attachment(
    ticket_id: int,
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> TicketAttachmentRead:
    ticket = await get_required(db, Ticket, ticket_id)
    project = await get_required(db, Project, ticket.project_id)
    if not ticket.ticket_number:
        raise HTTPException(status_code=400, detail="Ticket number missing")
    data = await file.read()
    object_key = upload_ticket_attachment(
        project_no=project.project_no,
        ticket_number=ticket.ticket_number,
        filename=file.filename or "attachment",
        data=data,
        content_type=file.content_type,
    )
    attachment = await create_ticket_attachment(
        db,
        ticket_id=ticket.id,
        filename=file.filename or "attachment",
        object_key=object_key,
        content_type=file.content_type,
        size_bytes=len(data),
        user_id=current_user.id,
    )
    row = TicketAttachmentRead.model_validate(attachment)
    row.uploader_name = await _user_name(db, current_user.id)
    return row


@router.get("/{ticket_id}/attachments/{attachment_id}/content")
async def download_attachment(
    ticket_id: int,
    attachment_id: int,
    _: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> Response:
    attachment = await get_required(db, TicketAttachment, attachment_id)
    if attachment.ticket_id != ticket_id:
        raise HTTPException(status_code=404, detail="Attachment not found")
    data, stored_type = get_object_bytes(attachment.object_key)
    media_type = attachment.content_type or stored_type or "application/octet-stream"
    return Response(
        content=data,
        media_type=media_type,
        headers={"Content-Disposition": f'attachment; filename="{attachment.filename}"'},
    )


@router.get("/{ticket_id}/history", response_model=list[TicketHistoryRead])
async def list_history(
    ticket_id: int,
    _: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[TicketHistoryRead]:
    result = await db.execute(
        select(TicketHistory)
        .where(TicketHistory.ticket_id == ticket_id)
        .order_by(TicketHistory.created_at.desc())
    )
    rows: list[TicketHistoryRead] = []
    for item in result.scalars().all():
        data = TicketHistoryRead.model_validate(item)
        data.actor_name = await _user_name(db, item.actor_id)
        rows.append(data)
    return rows


@router.get("/{ticket_id}/issue-report")
async def download_issue_report(
    ticket_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> Response:
    if current_user.role not in {RoleEnum.ADMIN, RoleEnum.TEAM_LEAD}:
        raise HTTPException(status_code=403, detail="Only team leads and admins can download issue reports")

    ticket = await get_required(db, Ticket, ticket_id)
    project = await get_required(db, Project, ticket.project_id)
    raiser = await db.get(User, ticket.raised_by)
    assignee = await db.get(User, ticket.assignee_id) if ticket.assignee_id else None

    comments = await db.execute(
        select(TicketComment).where(TicketComment.ticket_id == ticket_id).order_by(
            TicketComment.created_at
        )
    )
    history = await db.execute(
        select(TicketHistory).where(TicketHistory.ticket_id == ticket_id).order_by(
            TicketHistory.created_at
        )
    )

    lines = [
        "MAINTENANCE ISSUE REPORT",
        "========================",
        f"Ticket #: {ticket.ticket_number or ticket.id}",
        f"Project: {project.name} ({project.project_no})",
        f"Status: {ticket.status}",
        f"Priority: {ticket.priority}",
        f"Issue type: {ticket.issue_type or '—'}",
        f"Source: {ticket.source}",
        f"Reported on: {ticket.reported_on or ticket.created_at}",
        f"Raised by: {raiser.name if raiser else ticket.raised_by}",
        f"Assignee: {assignee.name if assignee else '—'}",
        "",
        "ISSUE",
        ticket.title,
        "",
        "DESCRIPTION",
        ticket.description,
        "",
        "DETAILS",
        ticket.details or "—",
        "",
        "RESOLUTION SUMMARY",
        ticket.resolution_summary or "—",
        "",
        "ROOT CAUSE",
        ticket.resolution_root_cause or "—",
        "",
        "STEPS TAKEN",
        ticket.resolution_steps or "—",
        "",
        "CONVERSATION",
    ]
    for comment in comments.scalars().all():
        author = await _user_name(db, comment.author_id)
        lines.append(f"[{comment.created_at}] {author or comment.author_id}: {comment.comment}")

    lines.extend(["", "HISTORY"])
    for entry in history.scalars().all():
        actor = await _user_name(db, entry.actor_id)
        lines.append(f"[{entry.created_at}] {entry.action} — {actor or 'system'}")
        if entry.detail:
            lines.append(entry.detail)

    body = "\n".join(lines)
    filename = f"ticket-{ticket.ticket_number or ticket.id}-report.txt"
    return Response(
        content=body,
        media_type="text/plain; charset=utf-8",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@rca_router.post("", response_model=RCARead)
async def submit_rca(
    payload: RCACreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> RCARead:
    return RCARead.model_validate(await create_rca(db, payload, current_user.id))


@rca_router.post("/{rca_id}/decision", response_model=RCARead)
async def decide_rca_document(
    rca_id: int,
    decision: ApprovalDecision,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> RCARead:
    item = await get_required(db, RCADocument, rca_id)
    row = await decide_rca(db, item, decision, current_user.id)
    approval = await db.execute(
        select(Approval).where(Approval.entity_type == "rca_document", Approval.entity_id == rca_id)
    )
    approval_row = approval.scalar_one_or_none()
    if approval_row:
        await decide_generic_approval(db, approval_row, decision)
    return RCARead.model_validate(row)

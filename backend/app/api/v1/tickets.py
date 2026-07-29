from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.core.db import get_db
from app.models.entities import Approval, Ticket, TicketComment, User
from app.schemas.common import (
    ApprovalDecision,
    RCARead,
    RCACreate,
    TicketCommentCreate,
    TicketCommentRead,
    TicketCreate,
    TicketRead,
    TicketUpdate,
)
from app.services.crud import (
    create_rca,
    create_ticket,
    create_ticket_comment,
    decide_generic_approval,
    decide_rca,
    get_required,
    update_ticket,
)


router = APIRouter(prefix="/tickets", tags=["tickets"])
rca_router = APIRouter(prefix="/rca", tags=["rca"])


@router.get("", response_model=list[TicketRead])
async def list_tickets(
    project_id: int | None = None,
    status: str | None = None,
    priority: str | None = None,
    category: str | None = None,
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
    _: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> TicketRead:
    ticket = await get_required(db, Ticket, ticket_id)
    return TicketRead.model_validate(await update_ticket(db, ticket, payload))


@router.get("/{ticket_id}/comments", response_model=list[TicketCommentRead])
async def list_comments(
    ticket_id: int,
    _: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[TicketCommentRead]:
    result = await db.execute(select(TicketComment).where(TicketComment.ticket_id == ticket_id))
    return [TicketCommentRead.model_validate(item) for item in result.scalars().all()]


@router.post("/{ticket_id}/comments", response_model=TicketCommentRead)
async def add_comment(
    ticket_id: int,
    payload: TicketCommentCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> TicketCommentRead:
    return TicketCommentRead.model_validate(
        await create_ticket_comment(db, ticket_id, payload, current_user.id)
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
    from app.models.entities import RCADocument

    item = await get_required(db, RCADocument, rca_id)
    row = await decide_rca(db, item, decision, current_user.id)
    approval = await db.execute(
        select(Approval).where(Approval.entity_type == "rca_document", Approval.entity_id == rca_id)
    )
    approval_row = approval.scalar_one_or_none()
    if approval_row:
        await decide_generic_approval(db, approval_row, decision)
    return RCARead.model_validate(row)

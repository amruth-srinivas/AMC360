from datetime import UTC, datetime

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.core.db import get_db
from app.models.entities import CalendarEvent, CalendarEventStatus, User
from app.schemas.common import CalendarEventCreate, CalendarEventRead, CalendarEventUpdate
from app.services.crud import create_calendar_event, get_required, update_calendar_event


router = APIRouter(prefix="/calendar", tags=["calendar"])


@router.get("", response_model=list[CalendarEventRead])
async def list_events(
    project_id: int | None = None,
    _: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[CalendarEventRead]:
    stmt = select(CalendarEvent)
    if project_id:
        stmt = stmt.where(CalendarEvent.project_id == project_id)
    result = await db.execute(stmt)
    return [CalendarEventRead.model_validate(item) for item in result.scalars().all()]


@router.post("", response_model=CalendarEventRead)
async def add_event(
    payload: CalendarEventCreate,
    _: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> CalendarEventRead:
    return CalendarEventRead.model_validate(await create_calendar_event(db, payload))


@router.put("/{event_id}", response_model=CalendarEventRead)
async def edit_event(
    event_id: int,
    payload: CalendarEventUpdate,
    _: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> CalendarEventRead:
    row = await get_required(db, CalendarEvent, event_id)
    return CalendarEventRead.model_validate(await update_calendar_event(db, row, payload))


@router.get("/my/upcoming", response_model=list[CalendarEventRead])
async def my_upcoming(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[CalendarEventRead]:
    result = await db.execute(
        select(CalendarEvent).where(
            CalendarEvent.owner_id == current_user.id,
            CalendarEvent.due_date >= datetime.now(UTC),
        )
    )
    return [CalendarEventRead.model_validate(item) for item in result.scalars().all()]


@router.get("/overdue", response_model=list[CalendarEventRead])
async def overdue(
    _: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[CalendarEventRead]:
    result = await db.execute(
        select(CalendarEvent).where(CalendarEvent.status == CalendarEventStatus.OVERDUE)
    )
    return [CalendarEventRead.model_validate(item) for item in result.scalars().all()]

from datetime import UTC, datetime
import uuid

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from fastapi.responses import Response
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm.attributes import flag_modified

from app.api.deps import get_current_user
from app.core.db import get_db
from app.models.entities import (
    CalendarEvent,
    CalendarEventStatus,
    CalendarEventTypeConfig,
    Project,
    User,
)
from app.schemas.common import (
    CalendarEventCreate,
    CalendarEventRead,
    CalendarEventTypeConfigCreate,
    CalendarEventTypeConfigRead,
    CalendarEventTypeConfigUpdate,
    CalendarEventUpdate,
    MessageResponse,
)
from app.services.crud import (
    _milestones_complete,
    create_calendar_event,
    create_event_type,
    delete_calendar_event,
    delete_event_type,
    get_required,
    list_event_types,
    update_calendar_event,
    update_event_type,
)
from app.services.storage import delete_object, get_object_bytes, upload_calendar_final_report


router = APIRouter(prefix="/calendar", tags=["calendar"])


@router.get("/event-types", response_model=list[CalendarEventTypeConfigRead])
async def get_event_types(
    project_id: int,
    _: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[CalendarEventTypeConfigRead]:
    rows = await list_event_types(db, project_id)
    return [CalendarEventTypeConfigRead.model_validate(item) for item in rows]


@router.post("/event-types", response_model=CalendarEventTypeConfigRead)
async def add_event_type(
    payload: CalendarEventTypeConfigCreate,
    _: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> CalendarEventTypeConfigRead:
    return CalendarEventTypeConfigRead.model_validate(await create_event_type(db, payload))


@router.put("/event-types/{type_id}", response_model=CalendarEventTypeConfigRead)
async def edit_event_type(
    type_id: int,
    payload: CalendarEventTypeConfigUpdate,
    _: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> CalendarEventTypeConfigRead:
    row = await get_required(db, CalendarEventTypeConfig, type_id)
    return CalendarEventTypeConfigRead.model_validate(await update_event_type(db, row, payload))


@router.delete("/event-types/{type_id}", response_model=MessageResponse)
async def remove_event_type(
    type_id: int,
    _: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> MessageResponse:
    row = await get_required(db, CalendarEventTypeConfig, type_id)
    await delete_event_type(db, row)
    return MessageResponse(message="Event type deleted")


@router.get("", response_model=list[CalendarEventRead])
async def list_events(
    project_id: int | None = None,
    _: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[CalendarEventRead]:
    stmt = select(CalendarEvent).order_by(CalendarEvent.start_at.asc())
    if project_id:
        stmt = stmt.where(CalendarEvent.project_id == project_id)
    result = await db.execute(stmt)
    return [CalendarEventRead.model_validate(item) for item in result.scalars().all()]


@router.post("", response_model=CalendarEventRead)
async def add_event(
    payload: CalendarEventCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> CalendarEventRead:
    data = payload.model_dump()
    if not data.get("owner_id"):
        data["owner_id"] = current_user.id
    if data.get("event_type_id") and not data.get("color"):
        type_row = await db.get(CalendarEventTypeConfig, data["event_type_id"])
        if type_row:
            data["color"] = type_row.color
            data["type"] = type_row.name
    return CalendarEventRead.model_validate(
        await create_calendar_event(db, CalendarEventCreate.model_validate(data))
    )


@router.put("/{event_id}", response_model=CalendarEventRead)
async def edit_event(
    event_id: int,
    payload: CalendarEventUpdate,
    _: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> CalendarEventRead:
    row = await get_required(db, CalendarEvent, event_id)
    data = payload.model_dump(exclude_unset=True)
    if data.get("event_type_id") and "color" not in data:
        type_row = await db.get(CalendarEventTypeConfig, data["event_type_id"])
        if type_row:
            data["color"] = type_row.color
            data.setdefault("type", type_row.name)
    return CalendarEventRead.model_validate(
        await update_calendar_event(db, row, CalendarEventUpdate.model_validate(data))
    )


@router.delete("/{event_id}", response_model=MessageResponse)
async def remove_event(
    event_id: int,
    _: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> MessageResponse:
    row = await get_required(db, CalendarEvent, event_id)
    for report in row.final_reports or []:
        delete_object(report.get("object_key"))
    await delete_calendar_event(db, row)
    return MessageResponse(message="Event deleted")


@router.post("/{event_id}/final-reports", response_model=CalendarEventRead)
async def upload_final_report(
    event_id: int,
    title: str | None = Form(None),
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> CalendarEventRead:
    row = await get_required(db, CalendarEvent, event_id)
    if row.status != CalendarEventStatus.DONE:
        raise HTTPException(status_code=400, detail="Event must be Done before uploading final reports")
    if not _milestones_complete(row.milestones):
        raise HTTPException(status_code=400, detail="Complete all milestones before uploading final reports")
    if not file.filename:
        raise HTTPException(status_code=400, detail="File is required")

    content = await file.read()
    if not content:
        raise HTTPException(status_code=400, detail="File is empty")

    project_no = "unassigned"
    if row.project_id:
        project = await db.get(Project, row.project_id)
        if project:
            project_no = project.project_no

    object_key = upload_calendar_final_report(
        project_no=project_no,
        event_id=row.id,
        filename=file.filename,
        data=content,
        content_type=file.content_type,
    )
    report = {
        "id": uuid.uuid4().hex,
        "title": (title.strip() if title and title.strip() else None) or file.filename,
        "filename": file.filename,
        "object_key": object_key,
        "content_type": file.content_type,
        "uploaded_at": datetime.now(UTC).isoformat(),
        "uploaded_by": current_user.name,
    }
    reports = list(row.final_reports or [])
    reports.append(report)
    row.final_reports = reports
    flag_modified(row, "final_reports")
    await db.commit()
    await db.refresh(row)
    return CalendarEventRead.model_validate(row)


@router.get("/{event_id}/final-reports/{report_id}/content")
async def get_final_report_content(
    event_id: int,
    report_id: str,
    _: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> Response:
    row = await get_required(db, CalendarEvent, event_id)
    report = next((item for item in (row.final_reports or []) if item.get("id") == report_id), None)
    if not report or not report.get("object_key"):
        raise HTTPException(status_code=404, detail="Final report not found")

    try:
        data, stored_type = get_object_bytes(report["object_key"])
    except Exception as exc:
        raise HTTPException(status_code=404, detail="Final report file not found in storage") from exc

    media_type = report.get("content_type") or stored_type or "application/octet-stream"
    filename = report.get("filename") or "final-report"
    return Response(
        content=data,
        media_type=media_type,
        headers={
            "Content-Disposition": f'inline; filename="{filename}"',
            "Cache-Control": "private, max-age=60",
        },
    )


@router.delete("/{event_id}/final-reports/{report_id}", response_model=CalendarEventRead)
async def delete_final_report(
    event_id: int,
    report_id: str,
    _: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> CalendarEventRead:
    row = await get_required(db, CalendarEvent, event_id)
    reports = list(row.final_reports or [])
    target = next((item for item in reports if item.get("id") == report_id), None)
    if not target:
        raise HTTPException(status_code=404, detail="Final report not found")
    delete_object(target.get("object_key"))
    row.final_reports = [item for item in reports if item.get("id") != report_id]
    flag_modified(row, "final_reports")
    await db.commit()
    await db.refresh(row)
    return CalendarEventRead.model_validate(row)


@router.get("/my/upcoming", response_model=list[CalendarEventRead])
async def my_upcoming(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[CalendarEventRead]:
    result = await db.execute(
        select(CalendarEvent).where(
            CalendarEvent.owner_id == current_user.id,
            CalendarEvent.start_at >= datetime.now(UTC),
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

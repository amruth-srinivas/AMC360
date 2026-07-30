"""Project report library — types, templates, and completed documents."""

from __future__ import annotations

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from fastapi.responses import Response
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import (
    assert_can_manage_report_library,
    assert_project_access,
    get_current_user,
)
from app.core.db import get_db
from app.models.entities import Project, ProjectReportDocument, ProjectReportType, RoleEnum, User
from app.schemas.common import (
    MessageResponse,
    ProjectReportDocumentRead,
    ProjectReportTypeCreate,
    ProjectReportTypeRead,
    ProjectReportTypeUpdate,
)
from app.services.crud import get_required
from app.services.storage import delete_object, get_object_bytes, upload_project_report_file


router = APIRouter(prefix="/projects/{project_id}/report-types", tags=["project-reports"])


def _to_type_read(row: ProjectReportType, documents: list[ProjectReportDocument] | None = None) -> ProjectReportTypeRead:
    docs = documents if documents is not None else []
    return ProjectReportTypeRead(
        id=row.id,
        project_id=row.project_id,
        name=row.name,
        description=row.description,
        frequency_interval=row.frequency_interval,
        frequency_unit=row.frequency_unit,
        template_filename=row.template_filename,
        template_content_type=row.template_content_type,
        has_template=bool(row.template_object_key),
        created_by=row.created_by,
        created_at=row.created_at,
        updated_at=row.updated_at,
        documents=[ProjectReportDocumentRead.model_validate(item) for item in docs],
    )


async def _get_type_for_project(
    db: AsyncSession, project_id: int, type_id: int
) -> ProjectReportType:
    row = await get_required(db, ProjectReportType, type_id)
    if row.project_id != project_id:
        raise HTTPException(status_code=404, detail="Report type not found for this project")
    return row


@router.get("", response_model=list[ProjectReportTypeRead])
async def list_report_types(
    project_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[ProjectReportTypeRead]:
    await assert_project_access(project_id, current_user, db)
    result = await db.execute(
        select(ProjectReportType)
        .where(ProjectReportType.project_id == project_id)
        .order_by(ProjectReportType.name.asc())
    )
    types = list(result.scalars().all())
    if not types:
        return []

    type_ids = [item.id for item in types]
    docs_result = await db.execute(
        select(ProjectReportDocument)
        .where(ProjectReportDocument.report_type_id.in_(type_ids))
        .order_by(ProjectReportDocument.created_at.desc())
    )
    documents = list(docs_result.scalars().all())
    by_type: dict[int, list[ProjectReportDocument]] = {item.id: [] for item in types}
    for doc in documents:
        by_type.setdefault(doc.report_type_id, []).append(doc)

    return [_to_type_read(item, by_type.get(item.id, [])) for item in types]


@router.post("", response_model=ProjectReportTypeRead)
async def create_report_type(
    project_id: int,
    payload: ProjectReportTypeCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> ProjectReportTypeRead:
    await assert_project_access(project_id, current_user, db)
    await assert_can_manage_report_library(project_id, current_user, db)
    await get_required(db, Project, project_id)

    existing = await db.execute(
        select(ProjectReportType).where(
            ProjectReportType.project_id == project_id,
            ProjectReportType.name == payload.name.strip(),
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Report type with this name already exists")

    if payload.frequency_interval and not payload.frequency_unit:
        raise HTTPException(status_code=400, detail="frequency_unit is required when interval is set")

    row = ProjectReportType(
        project_id=project_id,
        name=payload.name.strip(),
        description=(payload.description.strip() if payload.description else None),
        frequency_interval=payload.frequency_interval,
        frequency_unit=payload.frequency_unit if payload.frequency_interval else None,
        created_by=current_user.id,
    )
    db.add(row)
    await db.commit()
    await db.refresh(row)
    return _to_type_read(row, [])


@router.put("/{type_id}", response_model=ProjectReportTypeRead)
async def update_report_type(
    project_id: int,
    type_id: int,
    payload: ProjectReportTypeUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> ProjectReportTypeRead:
    await assert_project_access(project_id, current_user, db)
    await assert_can_manage_report_library(project_id, current_user, db)
    row = await _get_type_for_project(db, project_id, type_id)
    data = payload.model_dump(exclude_unset=True)

    if "name" in data and data["name"] is not None:
        data["name"] = data["name"].strip()
        clash = await db.execute(
            select(ProjectReportType).where(
                ProjectReportType.project_id == project_id,
                ProjectReportType.name == data["name"],
                ProjectReportType.id != type_id,
            )
        )
        if clash.scalar_one_or_none():
            raise HTTPException(status_code=400, detail="Report type with this name already exists")

    if "description" in data and isinstance(data["description"], str):
        data["description"] = data["description"].strip() or None

    for key, value in data.items():
        setattr(row, key, value)

    if row.frequency_interval is None:
        row.frequency_unit = None
    elif not row.frequency_unit:
        raise HTTPException(status_code=400, detail="frequency_unit is required when interval is set")

    await db.commit()
    await db.refresh(row)

    docs_result = await db.execute(
        select(ProjectReportDocument)
        .where(ProjectReportDocument.report_type_id == row.id)
        .order_by(ProjectReportDocument.created_at.desc())
    )
    return _to_type_read(row, list(docs_result.scalars().all()))


@router.delete("/{type_id}", response_model=MessageResponse)
async def delete_report_type(
    project_id: int,
    type_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> MessageResponse:
    await assert_project_access(project_id, current_user, db)
    await assert_can_manage_report_library(project_id, current_user, db)
    row = await _get_type_for_project(db, project_id, type_id)

    docs_result = await db.execute(
        select(ProjectReportDocument).where(ProjectReportDocument.report_type_id == row.id)
    )
    documents = list(docs_result.scalars().all())
    for doc in documents:
        delete_object(doc.object_key)
        await db.delete(doc)
    delete_object(row.template_object_key)
    await db.delete(row)
    await db.commit()
    return MessageResponse(message="Report type deleted")


@router.post("/{type_id}/template", response_model=ProjectReportTypeRead)
async def upload_template(
    project_id: int,
    type_id: int,
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> ProjectReportTypeRead:
    await assert_project_access(project_id, current_user, db)
    await assert_can_manage_report_library(project_id, current_user, db)
    project = await get_required(db, Project, project_id)
    row = await _get_type_for_project(db, project_id, type_id)

    if not file.filename:
        raise HTTPException(status_code=400, detail="File is required")
    content = await file.read()
    if not content:
        raise HTTPException(status_code=400, detail="File is empty")

    delete_object(row.template_object_key)
    object_key = upload_project_report_file(
        project_no=project.project_no,
        report_type_slug=row.name,
        kind="template",
        filename=file.filename,
        data=content,
        content_type=file.content_type,
    )
    row.template_filename = file.filename
    row.template_object_key = object_key
    row.template_content_type = file.content_type
    await db.commit()
    await db.refresh(row)

    docs_result = await db.execute(
        select(ProjectReportDocument)
        .where(ProjectReportDocument.report_type_id == row.id)
        .order_by(ProjectReportDocument.created_at.desc())
    )
    return _to_type_read(row, list(docs_result.scalars().all()))


@router.get("/{type_id}/template/content")
async def download_template(
    project_id: int,
    type_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> Response:
    await assert_project_access(project_id, current_user, db)
    row = await _get_type_for_project(db, project_id, type_id)
    if not row.template_object_key:
        raise HTTPException(status_code=404, detail="No template uploaded for this report type")

    try:
        data, stored_type = get_object_bytes(row.template_object_key)
    except Exception as exc:
        raise HTTPException(status_code=404, detail="Template file not found in storage") from exc

    media_type = row.template_content_type or stored_type or "application/octet-stream"
    filename = row.template_filename or "template"
    return Response(
        content=data,
        media_type=media_type,
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"',
            "Cache-Control": "private, max-age=60",
        },
    )


@router.post("/{type_id}/documents", response_model=ProjectReportDocumentRead)
async def upload_completed_report(
    project_id: int,
    type_id: int,
    title: str = Form(...),
    period_label: str = Form(...),
    notes: str | None = Form(None),
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> ProjectReportDocumentRead:
    await assert_project_access(project_id, current_user, db)
    project = await get_required(db, Project, project_id)
    row = await _get_type_for_project(db, project_id, type_id)

    if not title.strip() or not period_label.strip():
        raise HTTPException(status_code=400, detail="Document name and period are required")
    if not file.filename:
        raise HTTPException(status_code=400, detail="File is required")
    content = await file.read()
    if not content:
        raise HTTPException(status_code=400, detail="File is empty")

    object_key = upload_project_report_file(
        project_no=project.project_no,
        report_type_slug=row.name,
        kind="completed",
        period_slug=period_label.strip(),
        filename=file.filename,
        data=content,
        content_type=file.content_type,
    )
    document = ProjectReportDocument(
        project_id=project_id,
        report_type_id=row.id,
        title=title.strip(),
        period_label=period_label.strip(),
        filename=file.filename,
        object_key=object_key,
        content_type=file.content_type,
        notes=(notes.strip() if notes and notes.strip() else None),
        uploaded_by=current_user.id,
    )
    db.add(document)
    await db.commit()
    await db.refresh(document)
    return ProjectReportDocumentRead.model_validate(document)


@router.get("/{type_id}/documents/{document_id}/content")
async def download_completed_report(
    project_id: int,
    type_id: int,
    document_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> Response:
    await assert_project_access(project_id, current_user, db)
    await _get_type_for_project(db, project_id, type_id)
    document = await get_required(db, ProjectReportDocument, document_id)
    if document.project_id != project_id or document.report_type_id != type_id:
        raise HTTPException(status_code=404, detail="Report document not found")

    try:
        data, stored_type = get_object_bytes(document.object_key)
    except Exception as exc:
        raise HTTPException(status_code=404, detail="Report file not found in storage") from exc

    media_type = document.content_type or stored_type or "application/octet-stream"
    return Response(
        content=data,
        media_type=media_type,
        headers={
            "Content-Disposition": f'inline; filename="{document.filename}"',
            "Cache-Control": "private, max-age=60",
        },
    )


@router.delete("/{type_id}/documents/{document_id}", response_model=MessageResponse)
async def delete_completed_report(
    project_id: int,
    type_id: int,
    document_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> MessageResponse:
    await assert_project_access(project_id, current_user, db)
    await _get_type_for_project(db, project_id, type_id)
    document = await get_required(db, ProjectReportDocument, document_id)
    if document.project_id != project_id or document.report_type_id != type_id:
        raise HTTPException(status_code=404, detail="Report document not found")

    # Uploader, team lead, or admin can delete.
    project = await get_required(db, Project, project_id)
    can_delete = (
        current_user.role == RoleEnum.ADMIN
        or project.team_lead_id == current_user.id
        or document.uploaded_by == current_user.id
    )
    if not can_delete:
        raise HTTPException(status_code=403, detail="Insufficient permissions to delete this report")

    delete_object(document.object_key)
    await db.delete(document)
    await db.commit()
    return MessageResponse(message="Report document deleted")

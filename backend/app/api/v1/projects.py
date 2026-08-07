import json
from typing import Any

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from fastapi.responses import Response
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, require_roles
from app.core.db import get_db
from app.core.security import verify_password
from app.models.entities import (
    Project,
    ProjectDocument,
    ProjectDocumentCategory,
    ProjectStatus,
    RoleEnum,
    User,
)
from app.schemas.common import (
    ContactPerson,
    ProjectCreate,
    ProjectDocumentRead,
    ProjectRead,
    ProjectUpdate,
    ProjectUserSummary,
)
from pydantic import BaseModel, Field
from app.services.crud import (
    create_project,
    create_project_document,
    delete_project,
    delete_project_document,
    get_project_member_ids,
    get_required,
    list_project_documents,
    list_rows,
    update_project,
)
from sqlalchemy import select
from app.services.storage import (
    build_object_url,
    delete_object,
    get_object_bytes,
    upload_amc_document,
    upload_project_document,
)


router = APIRouter(prefix="/projects", tags=["projects"])


class ProjectManagedBody(BaseModel):
    """Irreversible enable of delivery project management (admin + password)."""

    password: str = Field(..., min_length=1)


def to_document_read(document: ProjectDocument) -> ProjectDocumentRead:
    data = {**document.__dict__, "url": build_object_url(document.object_key)}
    return ProjectDocumentRead.model_validate(data)


def to_user_summary(user: User) -> ProjectUserSummary:
    return ProjectUserSummary.model_validate(user)


async def to_project_read(db: AsyncSession, project: Project, member_ids: list[int]) -> ProjectRead:
    documents = await list_project_documents(db, project.id)
    user_ids = list({*(member_ids or []), *([project.team_lead_id] if project.team_lead_id else [])})
    users_by_id: dict[int, User] = {}
    if user_ids:
        result = await db.execute(select(User).where(User.id.in_(user_ids)))
        users_by_id = {user.id: user for user in result.scalars().all()}

    team_lead = users_by_id.get(project.team_lead_id) if project.team_lead_id else None
    members = [
        to_user_summary(users_by_id[member_id])
        for member_id in member_ids
        if member_id in users_by_id
    ]

    data = {
        **project.__dict__,
        "member_ids": member_ids,
        "members": members,
        "team_lead": to_user_summary(team_lead) if team_lead else None,
        "documents": [to_document_read(doc) for doc in documents],
    }
    if project.amc_terms_object_key:
        data["amc_terms_url"] = build_object_url(project.amc_terms_object_key)
    else:
        amc_doc = next((doc for doc in documents if doc.category == ProjectDocumentCategory.AMC_TERMS), None)
        data["amc_terms_url"] = build_object_url(amc_doc.object_key) if amc_doc else None
        if amc_doc and not project.amc_terms_filename:
            data["amc_terms_filename"] = amc_doc.filename
    return ProjectRead.model_validate(data)


def _parse_contact_persons(raw: str | None) -> list[ContactPerson]:
    if not raw or not raw.strip():
        return []
    try:
        payload = json.loads(raw)
    except json.JSONDecodeError as exc:
        raise HTTPException(status_code=400, detail="Invalid contact_persons JSON") from exc
    if not isinstance(payload, list):
        raise HTTPException(status_code=400, detail="contact_persons must be a list")
    return [ContactPerson.model_validate(item) for item in payload]


def _parse_member_ids(raw: str | None) -> list[int]:
    if not raw or not raw.strip():
        return []
    try:
        payload = json.loads(raw)
    except json.JSONDecodeError as exc:
        raise HTTPException(status_code=400, detail="Invalid member_ids JSON") from exc
    if not isinstance(payload, list):
        raise HTTPException(status_code=400, detail="member_ids must be a list")
    return [int(item) for item in payload]


def _optional_int(value: str | None) -> int | None:
    if value is None or value.strip() == "":
        return None
    return int(value)


def _parse_category(raw: str) -> ProjectDocumentCategory:
    try:
        return ProjectDocumentCategory(raw.strip().lower())
    except ValueError as exc:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid category. Allowed: {[item.value for item in ProjectDocumentCategory]}",
        ) from exc


async def _store_amc_terms(
    *,
    project_no: str,
    upload: UploadFile | None,
    previous_key: str | None = None,
) -> tuple[str | None, str | None, str | None]:
    if upload is None or not upload.filename:
        return None, None, None
    content = await upload.read()
    if not content:
        return None, None, None
    object_key = upload_amc_document(
        project_no=project_no,
        filename=upload.filename,
        data=content,
        content_type=upload.content_type,
    )
    if previous_key:
        delete_object(previous_key)
    return object_key, upload.filename, upload.content_type


@router.get("", response_model=list[ProjectRead])
async def list_projects(
    _: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[ProjectRead]:
    rows = await list_rows(db, Project)
    output: list[ProjectRead] = []
    for row in rows:
        output.append(await to_project_read(db, row, await get_project_member_ids(db, row.id)))
    return output


@router.post("", response_model=ProjectRead)
async def add_project(
    project_no: str = Form(...),
    name: str = Form(...),
    client_name: str = Form(...),
    customer_name: str | None = Form(None),
    details: str | None = Form(None),
    company_address: str | None = Form(None),
    status: ProjectStatus = Form(ProjectStatus.ACTIVE),
    team_lead_id: str | None = Form(None),
    contact_persons: str = Form("[]"),
    member_ids: str = Form("[]"),
    amc_terms: UploadFile | None = File(None),
    current_user: User = Depends(require_roles(RoleEnum.ADMIN, RoleEnum.TEAM_LEAD)),
    db: AsyncSession = Depends(get_db),
) -> ProjectRead:
    lead_id = _optional_int(team_lead_id)
    members = _parse_member_ids(member_ids)

    # Team leads can create projects they own; admins may assign any lead.
    if current_user.role == RoleEnum.TEAM_LEAD:
        lead_id = current_user.id

    if lead_id and lead_id not in members:
        members = [lead_id, *members]

    object_key, filename, content_type = await _store_amc_terms(project_no=project_no, upload=amc_terms)

    payload = ProjectCreate(
        project_no=project_no.strip(),
        name=name.strip(),
        client_name=client_name.strip(),
        customer_name=customer_name.strip() if customer_name else None,
        details=details,
        contact_persons=_parse_contact_persons(contact_persons),
        company_address=company_address,
        status=status,
        team_lead_id=lead_id,
        is_managed_project=False,
        member_ids=members,
    )
    row = await create_project(db, payload)
    if object_key and filename:
        row.amc_terms_object_key = object_key
        row.amc_terms_filename = filename
        await create_project_document(
            db,
            project=row,
            category=ProjectDocumentCategory.AMC_TERMS,
            title="AMC terms & conditions",
            filename=filename,
            object_key=object_key,
            content_type=content_type,
        )
        await db.refresh(row)
    return await to_project_read(db, row, await get_project_member_ids(db, row.id))


@router.get("/{project_id}", response_model=ProjectRead)
async def get_project(
    project_id: int,
    _: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> ProjectRead:
    row = await get_required(db, Project, project_id)
    return await to_project_read(db, row, await get_project_member_ids(db, row.id))


@router.put("/{project_id}", response_model=ProjectRead)
async def edit_project(
    project_id: int,
    project_no: str | None = Form(None),
    name: str | None = Form(None),
    client_name: str | None = Form(None),
    customer_name: str | None = Form(None),
    details: str | None = Form(None),
    company_address: str | None = Form(None),
    status: ProjectStatus | None = Form(None),
    team_lead_id: str | None = Form(None),
    contact_persons: str | None = Form(None),
    member_ids: str | None = Form(None),
    amc_terms: UploadFile | None = File(None),
    _: User = Depends(require_roles(RoleEnum.ADMIN)),
    db: AsyncSession = Depends(get_db),
) -> ProjectRead:
    row = await get_required(db, Project, project_id)

    updates: dict[str, Any] = {}
    if project_no is not None:
        updates["project_no"] = project_no.strip()
    if name is not None:
        updates["name"] = name.strip()
    if client_name is not None:
        updates["client_name"] = client_name.strip()
    if customer_name is not None:
        updates["customer_name"] = customer_name.strip() or None
    if details is not None:
        updates["details"] = details
    if company_address is not None:
        updates["company_address"] = company_address
    if status is not None:
        updates["status"] = status
    if team_lead_id is not None:
        updates["team_lead_id"] = _optional_int(team_lead_id)
    if contact_persons is not None:
        updates["contact_persons"] = [
            person.model_dump() for person in _parse_contact_persons(contact_persons)
        ]
    if member_ids is not None:
        updates["member_ids"] = _parse_member_ids(member_ids)

    next_project_no = updates.get("project_no", row.project_no)
    object_key, filename, content_type = await _store_amc_terms(
        project_no=next_project_no,
        upload=amc_terms,
        previous_key=None,
    )
    if object_key and filename:
        updates["amc_terms_object_key"] = object_key
        updates["amc_terms_filename"] = filename

    payload = ProjectUpdate.model_validate(updates)
    row = await update_project(db, row, payload)

    if object_key and filename:
        await create_project_document(
            db,
            project=row,
            category=ProjectDocumentCategory.AMC_TERMS,
            title="AMC terms & conditions",
            filename=filename,
            object_key=object_key,
            content_type=content_type,
        )
        await db.refresh(row)

    return await to_project_read(db, row, await get_project_member_ids(db, row.id))


@router.patch("/{project_id}/managed", response_model=ProjectRead)
async def enable_managed_project(
    project_id: int,
    body: ProjectManagedBody,
    current_user: User = Depends(require_roles(RoleEnum.ADMIN)),
    db: AsyncSession = Depends(get_db),
) -> ProjectRead:
    """Irreversibly enable delivery project management (admin only + password)."""
    row = await get_required(db, Project, project_id)
    if row.is_managed_project:
        raise HTTPException(
            status_code=400,
            detail="Project management is already enabled and cannot be turned off",
        )
    if not verify_password(body.password, current_user.hashed_password):
        raise HTTPException(status_code=401, detail="Incorrect password")
    row.is_managed_project = True
    await db.commit()
    await db.refresh(row)
    return await to_project_read(db, row, await get_project_member_ids(db, row.id))


@router.delete("/{project_id}")
async def remove_project(
    project_id: int,
    _: User = Depends(require_roles(RoleEnum.ADMIN)),
    db: AsyncSession = Depends(get_db),
) -> dict[str, str]:
    row = await get_required(db, Project, project_id)
    documents = await list_project_documents(db, row.id)
    for document in documents:
        delete_object(document.object_key)
    delete_object(row.amc_terms_object_key)
    await delete_project(db, row)
    return {"message": "Project deleted"}


@router.get("/{project_id}/documents", response_model=list[ProjectDocumentRead])
async def list_documents(
    project_id: int,
    _: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[ProjectDocumentRead]:
    await get_required(db, Project, project_id)
    documents = await list_project_documents(db, project_id)
    return [to_document_read(document) for document in documents]


@router.post("/{project_id}/documents", response_model=ProjectDocumentRead)
async def upload_document(
    project_id: int,
    category: str = Form(...),
    title: str | None = Form(None),
    file: UploadFile = File(...),
    _: User = Depends(require_roles(RoleEnum.ADMIN)),
    db: AsyncSession = Depends(get_db),
) -> ProjectDocumentRead:
    project = await get_required(db, Project, project_id)
    if not file.filename:
        raise HTTPException(status_code=400, detail="File is required")

    parsed_category = _parse_category(category)
    content = await file.read()
    if not content:
        raise HTTPException(status_code=400, detail="File is empty")

    object_key = upload_project_document(
        project_no=project.project_no,
        category=parsed_category.value,
        filename=file.filename,
        data=content,
        content_type=file.content_type,
    )
    document = await create_project_document(
        db,
        project=project,
        category=parsed_category,
        title=(title.strip() if title and title.strip() else None),
        filename=file.filename,
        object_key=object_key,
        content_type=file.content_type,
    )
    return to_document_read(document)


@router.get("/{project_id}/documents/{document_id}/content")
async def get_document_content(
    project_id: int,
    document_id: int,
    _: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> Response:
    await get_required(db, Project, project_id)
    document = await get_required(db, ProjectDocument, document_id)
    if document.project_id != project_id:
        raise HTTPException(status_code=404, detail="Document not found for this project")

    try:
        data, stored_type = get_object_bytes(document.object_key)
    except Exception as exc:
        raise HTTPException(status_code=404, detail="Document file not found in storage") from exc

    media_type = document.content_type or stored_type or "application/octet-stream"
    return Response(
        content=data,
        media_type=media_type,
        headers={
            "Content-Disposition": f'inline; filename="{document.filename}"',
            "Cache-Control": "private, max-age=60",
        },
    )


@router.delete("/{project_id}/documents/{document_id}")
async def remove_document(
    project_id: int,
    document_id: int,
    _: User = Depends(require_roles(RoleEnum.ADMIN)),
    db: AsyncSession = Depends(get_db),
) -> dict[str, str]:
    project = await get_required(db, Project, project_id)
    document = await get_required(db, ProjectDocument, document_id)
    if document.project_id != project_id:
        raise HTTPException(status_code=404, detail="Document not found for this project")

    object_key = document.object_key
    await delete_project_document(db, project, document)
    delete_object(object_key)
    return {"message": "Document deleted"}

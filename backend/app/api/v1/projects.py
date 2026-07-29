import json
from typing import Any

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, require_roles
from app.core.db import get_db
from app.models.entities import Project, ProjectStatus, RoleEnum, User
from app.schemas.common import ContactPerson, ProjectCreate, ProjectRead, ProjectUpdate
from app.services.crud import (
    create_project,
    delete_project,
    get_project_member_ids,
    get_required,
    list_rows,
    update_project,
)
from app.services.storage import build_object_url, delete_object, upload_amc_document


router = APIRouter(prefix="/projects", tags=["projects"])


def to_project_read(project: Project, member_ids: list[int]) -> ProjectRead:
    data = {**project.__dict__, "member_ids": member_ids}
    if project.amc_terms_object_key:
        data["amc_terms_url"] = build_object_url(project.amc_terms_object_key)
    else:
        data["amc_terms_url"] = None
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


async def _store_amc_terms(
    *,
    project_no: str,
    upload: UploadFile | None,
    previous_key: str | None = None,
) -> tuple[str | None, str | None]:
    if upload is None or not upload.filename:
        return None, None
    content = await upload.read()
    if not content:
        return None, None
    object_key = upload_amc_document(
        project_no=project_no,
        filename=upload.filename,
        data=content,
        content_type=upload.content_type,
    )
    if previous_key:
        delete_object(previous_key)
    return object_key, upload.filename


@router.get("", response_model=list[ProjectRead])
async def list_projects(
    _: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[ProjectRead]:
    rows = await list_rows(db, Project)
    output: list[ProjectRead] = []
    for row in rows:
        output.append(to_project_read(row, await get_project_member_ids(db, row.id)))
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
    _: User = Depends(require_roles(RoleEnum.ADMIN)),
    db: AsyncSession = Depends(get_db),
) -> ProjectRead:
    lead_id = _optional_int(team_lead_id)
    members = _parse_member_ids(member_ids)
    if lead_id and lead_id not in members:
        members = [lead_id, *members]

    object_key, filename = await _store_amc_terms(project_no=project_no, upload=amc_terms)

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
        member_ids=members,
    )
    row = await create_project(db, payload)
    if object_key:
        row.amc_terms_object_key = object_key
        row.amc_terms_filename = filename
        await db.commit()
        await db.refresh(row)
    return to_project_read(row, await get_project_member_ids(db, row.id))


@router.get("/{project_id}", response_model=ProjectRead)
async def get_project(
    project_id: int,
    _: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> ProjectRead:
    row = await get_required(db, Project, project_id)
    return to_project_read(row, await get_project_member_ids(db, row.id))


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
    object_key, filename = await _store_amc_terms(
        project_no=next_project_no,
        upload=amc_terms,
        previous_key=row.amc_terms_object_key,
    )
    if object_key:
        updates["amc_terms_object_key"] = object_key
        updates["amc_terms_filename"] = filename

    payload = ProjectUpdate.model_validate(updates)
    row = await update_project(db, row, payload)
    return to_project_read(row, await get_project_member_ids(db, row.id))


@router.delete("/{project_id}")
async def remove_project(
    project_id: int,
    _: User = Depends(require_roles(RoleEnum.ADMIN)),
    db: AsyncSession = Depends(get_db),
) -> dict[str, str]:
    row = await get_required(db, Project, project_id)
    delete_object(row.amc_terms_object_key)
    await delete_project(db, row)
    return {"message": "Project deleted"}

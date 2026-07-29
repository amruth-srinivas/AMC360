from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import require_roles
from app.core.db import get_db
from app.models.entities import ReportTemplate, RoleEnum, User
from app.schemas.common import TemplateCreate, TemplateRead, TemplateUpdate
from app.services.crud import create_template, get_required, list_rows, update_template


router = APIRouter(prefix="/templates", tags=["templates"])


@router.get("", response_model=list[TemplateRead])
async def list_templates(
    _: User = Depends(require_roles(RoleEnum.ADMIN, RoleEnum.TEAM_LEAD, RoleEnum.TEAM_MEMBER)),
    db: AsyncSession = Depends(get_db),
) -> list[TemplateRead]:
    return [TemplateRead.model_validate(item) for item in await list_rows(db, ReportTemplate)]


@router.post("", response_model=TemplateRead)
async def add_template(
    payload: TemplateCreate,
    current_user: User = Depends(require_roles(RoleEnum.ADMIN)),
    db: AsyncSession = Depends(get_db),
) -> TemplateRead:
    return TemplateRead.model_validate(await create_template(db, payload, current_user.id))


@router.put("/{template_id}", response_model=TemplateRead)
async def edit_template(
    template_id: int,
    payload: TemplateUpdate,
    _: User = Depends(require_roles(RoleEnum.ADMIN)),
    db: AsyncSession = Depends(get_db),
) -> TemplateRead:
    row = await get_required(db, ReportTemplate, template_id)
    return TemplateRead.model_validate(await update_template(db, row, payload))

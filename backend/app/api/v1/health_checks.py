from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.core.db import get_db
from app.models.entities import HealthCheckEntry, User
from app.schemas.common import HealthCheckCreate, HealthCheckRead
from app.services.crud import create_health_check


router = APIRouter(prefix="/health-checks", tags=["health-checks"])


@router.get("", response_model=list[HealthCheckRead])
async def list_health_checks(
    project_id: int | None = None,
    period: str | None = None,
    _: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[HealthCheckRead]:
    stmt = select(HealthCheckEntry)
    if project_id:
        stmt = stmt.where(HealthCheckEntry.project_id == project_id)
    if period:
        stmt = stmt.where(HealthCheckEntry.period == period)
    result = await db.execute(stmt)
    return [HealthCheckRead.model_validate(item) for item in result.scalars().all()]


@router.post("", response_model=HealthCheckRead)
async def add_health_check(
    payload: HealthCheckCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> HealthCheckRead:
    return HealthCheckRead.model_validate(await create_health_check(db, payload, current_user.id))

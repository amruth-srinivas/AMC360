from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import require_roles
from app.core.db import get_db
from app.models.entities import NotificationLog, RoleEnum, User
from app.schemas.common import NotificationLogRead


router = APIRouter(prefix="/notifications", tags=["notifications"])


@router.get("/logs", response_model=list[NotificationLogRead])
async def list_notification_logs(
    _: User = Depends(require_roles(RoleEnum.ADMIN, RoleEnum.TEAM_LEAD)),
    db: AsyncSession = Depends(get_db),
) -> list[NotificationLogRead]:
    result = await db.execute(select(NotificationLog))
    return [NotificationLogRead.model_validate(item) for item in result.scalars().all()]

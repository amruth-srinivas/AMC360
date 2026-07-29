from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.core.db import get_db
from app.models.entities import Approval, User
from app.schemas.common import ApprovalDecision, ApprovalRead
from app.services.crud import decide_generic_approval, get_required


router = APIRouter(prefix="/approvals", tags=["approvals"])


@router.get("", response_model=list[ApprovalRead])
async def list_my_pending_approvals(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[ApprovalRead]:
    result = await db.execute(select(Approval).where(Approval.approver_id == current_user.id))
    return [ApprovalRead.model_validate(item) for item in result.scalars().all()]


@router.post("/{approval_id}/decision", response_model=ApprovalRead)
async def decide_approval(
    approval_id: int,
    decision: ApprovalDecision,
    _: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> ApprovalRead:
    item = await get_required(db, Approval, approval_id)
    return ApprovalRead.model_validate(await decide_generic_approval(db, item, decision))

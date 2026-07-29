from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.core.db import get_db
from app.models.entities import Approval, Project, ReportSubmission, RoleEnum, User
from app.schemas.common import ApprovalDecision, ReportSubmissionCreate, ReportSubmissionRead
from app.services.crud import (
    create_report_submission,
    decide_generic_approval,
    decide_report,
    get_required,
    submit_report_for_approval,
)


router = APIRouter(prefix="/reports", tags=["reports"])


@router.get("", response_model=list[ReportSubmissionRead])
async def list_reports(
    project_id: int | None = None,
    status: str | None = None,
    period: str | None = None,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
) -> list[ReportSubmissionRead]:
    stmt = select(ReportSubmission)
    if project_id:
        stmt = stmt.where(ReportSubmission.project_id == project_id)
    if status:
        stmt = stmt.where(ReportSubmission.status == status)
    if period:
        stmt = stmt.where(ReportSubmission.period == period)
    result = await db.execute(stmt)
    return [ReportSubmissionRead.model_validate(item) for item in result.scalars().all()]


@router.post("", response_model=ReportSubmissionRead)
async def create_report(
    payload: ReportSubmissionCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> ReportSubmissionRead:
    row = await create_report_submission(db, payload, current_user.id)
    return ReportSubmissionRead.model_validate(row)


@router.post("/{submission_id}/submit", response_model=ReportSubmissionRead)
async def submit_report(
    submission_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> ReportSubmissionRead:
    submission = await get_required(db, ReportSubmission, submission_id)
    project = await get_required(db, Project, submission.project_id)
    approver_id = project.team_lead_id
    if current_user.role == RoleEnum.ADMIN and approver_id is None:
        approver_id = current_user.id
    if approver_id is None:
        raise HTTPException(status_code=400, detail="Project team lead is required")
    row = await submit_report_for_approval(db, submission, approver_id, current_user.id)
    return ReportSubmissionRead.model_validate(row)


@router.post("/{submission_id}/decision", response_model=ReportSubmissionRead)
async def decide_submission(
    submission_id: int,
    decision: ApprovalDecision,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> ReportSubmissionRead:
    submission = await get_required(db, ReportSubmission, submission_id)
    row = await decide_report(db, submission, decision, current_user.id)
    approval_result = await db.execute(
        select(Approval).where(
            Approval.entity_type == "report_submission",
            Approval.entity_id == submission_id,
        )
    )
    approval = approval_result.scalar_one_or_none()
    if approval:
        await decide_generic_approval(db, approval, decision)
    return ReportSubmissionRead.model_validate(row)

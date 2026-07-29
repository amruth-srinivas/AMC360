from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.core.db import get_db
from app.models.entities import BackupRun, DbMetricEntry, RestorationDrill, User
from app.schemas.common import (
    BackupRunCreate,
    BackupRunRead,
    DbMetricCreate,
    DbMetricRead,
    RestorationDrillCreate,
    RestorationDrillRead,
)
from app.services.crud import create_backup_run, create_db_metric, create_restoration_drill


router = APIRouter(prefix="/db-monitoring", tags=["db-monitoring"])


@router.get("/metrics", response_model=list[DbMetricRead])
async def list_metrics(
    project_id: int | None = None,
    _: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[DbMetricRead]:
    stmt = select(DbMetricEntry)
    if project_id:
        stmt = stmt.where(DbMetricEntry.project_id == project_id)
    result = await db.execute(stmt)
    return [DbMetricRead.model_validate(item) for item in result.scalars().all()]


@router.post("/metrics", response_model=DbMetricRead)
async def add_metric(
    payload: DbMetricCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> DbMetricRead:
    return DbMetricRead.model_validate(await create_db_metric(db, payload, current_user.id))


@router.get("/backups", response_model=list[BackupRunRead])
async def list_backups(
    project_id: int | None = None,
    _: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[BackupRunRead]:
    stmt = select(BackupRun)
    if project_id:
        stmt = stmt.where(BackupRun.project_id == project_id)
    result = await db.execute(stmt)
    return [BackupRunRead.model_validate(item) for item in result.scalars().all()]


@router.post("/backups", response_model=BackupRunRead)
async def add_backup(
    payload: BackupRunCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> BackupRunRead:
    return BackupRunRead.model_validate(await create_backup_run(db, payload, current_user.id))


@router.get("/backups/compliance")
async def backup_compliance(
    project_id: int,
    _: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    result = await db.execute(select(BackupRun).where(BackupRun.project_id == project_id))
    items = result.scalars().all()
    total = len(items)
    success = len([item for item in items if item.status == "success"])
    return {
        "project_id": project_id,
        "total_runs": total,
        "successful_runs": success,
        "compliance_pct": round((success / total) * 100, 2) if total else 0,
    }


@router.get("/drills", response_model=list[RestorationDrillRead])
async def list_drills(
    project_id: int | None = None,
    _: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[RestorationDrillRead]:
    stmt = select(RestorationDrill)
    if project_id:
        stmt = stmt.where(RestorationDrill.project_id == project_id)
    result = await db.execute(stmt)
    return [RestorationDrillRead.model_validate(item) for item in result.scalars().all()]


@router.post("/drills", response_model=RestorationDrillRead)
async def add_drill(
    payload: RestorationDrillCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> RestorationDrillRead:
    return RestorationDrillRead.model_validate(
        await create_restoration_drill(db, payload, current_user.id)
    )

"""Sprint APIs for managed delivery projects."""

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import assert_project_access, get_current_user
from app.core.db import get_db
from app.models.entities import User
from app.schemas.common import (
    SprintCompleteRequest,
    SprintCreate,
    SprintRead,
    SprintUpdate,
)
from app.services.issues import (
    complete_sprint,
    create_sprint,
    get_sprint_for_project,
    list_sprints,
    start_sprint,
    to_sprint_read,
    update_sprint,
)

router = APIRouter(prefix="/projects/{project_id}/sprints", tags=["sprints"])


@router.get("", response_model=list[SprintRead])
async def get_sprints(
    project_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[SprintRead]:
    await assert_project_access(project_id, current_user, db)
    return await list_sprints(db, project_id)


@router.post("", response_model=SprintRead)
async def post_sprint(
    project_id: int,
    payload: SprintCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> SprintRead:
    await assert_project_access(project_id, current_user, db)
    sprint = await create_sprint(db, project_id, payload)
    return await to_sprint_read(db, sprint)


@router.patch("/{sprint_id}", response_model=SprintRead)
async def patch_sprint(
    project_id: int,
    sprint_id: int,
    payload: SprintUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> SprintRead:
    await assert_project_access(project_id, current_user, db)
    sprint = await get_sprint_for_project(db, project_id, sprint_id)
    sprint = await update_sprint(db, sprint, payload)
    return await to_sprint_read(db, sprint)


@router.post("/{sprint_id}/start", response_model=SprintRead)
async def post_start_sprint(
    project_id: int,
    sprint_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> SprintRead:
    await assert_project_access(project_id, current_user, db)
    sprint = await get_sprint_for_project(db, project_id, sprint_id)
    sprint = await start_sprint(db, sprint)
    return await to_sprint_read(db, sprint)


@router.post("/{sprint_id}/complete", response_model=SprintRead)
async def post_complete_sprint(
    project_id: int,
    sprint_id: int,
    payload: SprintCompleteRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> SprintRead:
    await assert_project_access(project_id, current_user, db)
    sprint = await get_sprint_for_project(db, project_id, sprint_id)
    sprint = await complete_sprint(db, sprint, payload)
    return await to_sprint_read(db, sprint)

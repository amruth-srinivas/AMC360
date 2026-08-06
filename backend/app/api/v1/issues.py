"""Issue APIs for managed delivery projects (Epics / Stories / Tasks / Bugs)."""

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import assert_project_access, get_current_user
from app.core.db import get_db
from app.models.entities import IssueStatus, IssueType, Project, User
from app.schemas.common import (
    BoardRead,
    IssueCommentCreate,
    IssueCommentRead,
    IssueCreate,
    IssueRankUpdate,
    IssueRead,
    IssueUpdate,
    MessageResponse,
    TimelineRead,
)
from app.services.crud import get_required
from app.services.issues import (
    add_issue_comment,
    board_for_sprint,
    create_issue,
    get_issue_for_project,
    list_issues,
    rank_issue,
    soft_delete_issue,
    timeline_for_project,
    to_issue_read,
    update_issue,
    user_names,
)

router = APIRouter(prefix="/projects/{project_id}/issues", tags=["issues"])


@router.get("/board", response_model=BoardRead)
async def get_board(
    project_id: int,
    sprint_id: int | None = None,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> BoardRead:
    await assert_project_access(project_id, current_user, db)
    return await board_for_sprint(db, project_id, sprint_id)


@router.get("/timeline", response_model=TimelineRead)
async def get_timeline(
    project_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> TimelineRead:
    await assert_project_access(project_id, current_user, db)
    return await timeline_for_project(db, project_id)


@router.get("", response_model=list[IssueRead])
async def get_issues(
    project_id: int,
    sprint_id: int | None = None,
    backlog: bool = Query(False),
    type: IssueType | None = None,
    status: IssueStatus | None = None,
    assignee_id: int | None = None,
    epic_id: int | None = None,
    search: str | None = None,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[IssueRead]:
    await assert_project_access(project_id, current_user, db)
    rows = await list_issues(
        db,
        project_id,
        sprint_id=sprint_id,
        backlog=backlog,
        type_=type,
        status=status,
        assignee_id=assignee_id,
        epic_id=epic_id,
        search=search,
    )
    name_ids = {uid for row in rows for uid in (row.assignee_id, row.reporter_id) if uid}
    names = await user_names(db, name_ids)
    return [await to_issue_read(db, row, names=names) for row in rows]


@router.post("", response_model=IssueRead)
async def post_issue(
    project_id: int,
    payload: IssueCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> IssueRead:
    await assert_project_access(project_id, current_user, db)
    project = await get_required(db, Project, project_id)
    issue = await create_issue(db, project, payload, current_user.id)
    return await to_issue_read(db, issue, include_children=True)


@router.get("/{issue_id}", response_model=IssueRead)
async def get_issue(
    project_id: int,
    issue_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> IssueRead:
    await assert_project_access(project_id, current_user, db)
    issue = await get_issue_for_project(db, project_id, issue_id)
    return await to_issue_read(db, issue, include_children=True, include_comments=True)


@router.patch("/{issue_id}", response_model=IssueRead)
async def patch_issue(
    project_id: int,
    issue_id: int,
    payload: IssueUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> IssueRead:
    await assert_project_access(project_id, current_user, db)
    issue = await get_issue_for_project(db, project_id, issue_id)
    issue = await update_issue(db, issue, payload)
    return await to_issue_read(db, issue, include_children=True, include_comments=True)


@router.patch("/{issue_id}/rank", response_model=IssueRead)
async def patch_issue_rank(
    project_id: int,
    issue_id: int,
    payload: IssueRankUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> IssueRead:
    await assert_project_access(project_id, current_user, db)
    issue = await get_issue_for_project(db, project_id, issue_id)
    issue = await rank_issue(db, issue, payload)
    return await to_issue_read(db, issue)


@router.delete("/{issue_id}", response_model=MessageResponse)
async def delete_issue(
    project_id: int,
    issue_id: int,
    reparent: bool = Query(False),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> MessageResponse:
    await assert_project_access(project_id, current_user, db)
    issue = await get_issue_for_project(db, project_id, issue_id)
    await soft_delete_issue(db, issue, reparent=reparent)
    return MessageResponse(message="Issue deleted")


@router.post("/{issue_id}/comments", response_model=IssueCommentRead)
async def post_comment(
    project_id: int,
    issue_id: int,
    payload: IssueCommentCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> IssueCommentRead:
    await assert_project_access(project_id, current_user, db)
    issue = await get_issue_for_project(db, project_id, issue_id)
    comment = await add_issue_comment(db, issue, payload, current_user.id)
    return IssueCommentRead(
        id=comment.id,
        issue_id=comment.issue_id,
        author_id=comment.author_id,
        author_name=current_user.name,
        body=comment.body,
        created_at=comment.created_at,
    )

"""Business logic for project sprints and delivery issues."""

from __future__ import annotations

import re
from datetime import datetime, timezone

from fastapi import HTTPException
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.entities import (
    Issue,
    IssueComment,
    IssuePriority,
    IssueStatus,
    IssueType,
    Project,
    Sprint,
    SprintStatus,
    User,
)
from app.schemas.common import (
    BoardColumnRead,
    BoardRead,
    IssueCommentCreate,
    IssueCommentRead,
    IssueCreate,
    IssueRankUpdate,
    IssueRead,
    IssueUpdate,
    SprintCompleteRequest,
    SprintCreate,
    SprintRead,
    SprintUpdate,
    TimelineIssueRead,
    TimelineRead,
    TimelineSprintMarker,
)

DEFAULT_EPIC_COLORS = [
    "#6366F1",
    "#8B5CF6",
    "#EC4899",
    "#F59E0B",
    "#10B981",
    "#0EA5E9",
    "#EF4444",
]


def _active_filter():
    return Issue.deleted_at.is_(None)


def _issue_prefix(project: Project) -> str:
    raw = re.sub(r"[^A-Za-z0-9]+", "", project.project_no or "").upper()
    if not raw:
        raw = f"PRJ{project.id}"
    return raw[:12]


async def _next_rank(db: AsyncSession, project_id: int, sprint_id: int | None) -> float:
    stmt = select(func.coalesce(func.max(Issue.rank), 0.0)).where(
        Issue.project_id == project_id,
        _active_filter(),
        Issue.sprint_id.is_(None) if sprint_id is None else Issue.sprint_id == sprint_id,
    )
    result = await db.execute(stmt)
    return float(result.scalar() or 0.0) + 1000.0


def _compute_rank_between(before_rank: float | None, after_rank: float | None) -> float:
    if before_rank is None and after_rank is None:
        return 1000.0
    if before_rank is None:
        return float(after_rank) - 1000.0  # type: ignore[arg-type]
    if after_rank is None:
        return float(before_rank) + 1000.0
    mid = (float(before_rank) + float(after_rank)) / 2.0
    if mid == before_rank or mid == after_rank:
        return float(before_rank) + 0.001
    return mid


async def user_names(db: AsyncSession, user_ids: set[int]) -> dict[int, str]:
    if not user_ids:
        return {}
    result = await db.execute(select(User).where(User.id.in_(user_ids)))
    return {user.id: user.name for user in result.scalars().all()}


async def to_issue_read(
    db: AsyncSession,
    issue: Issue,
    *,
    include_children: bool = False,
    include_comments: bool = False,
    names: dict[int, str] | None = None,
) -> IssueRead:
    names = names or await user_names(
        db, {uid for uid in (issue.assignee_id, issue.reporter_id) if uid}
    )
    child_count = 0
    child_done = 0
    children: list[IssueRead] = []

    kids_result = await db.execute(
        select(Issue)
        .where(Issue.parent_id == issue.id, _active_filter())
        .order_by(Issue.rank.asc(), Issue.id.asc())
    )
    kids = list(kids_result.scalars().all())
    child_count = len(kids)
    child_done = sum(1 for kid in kids if kid.status == IssueStatus.DONE)
    if include_children:
        child_ids = {
            uid
            for kid in kids
            for uid in (kid.assignee_id, kid.reporter_id)
            if uid
        }
        child_names = {**names, **(await user_names(db, child_ids - set(names)))}
        children = [
            await to_issue_read(db, kid, names=child_names) for kid in kids
        ]

    comments: list[IssueCommentRead] = []
    if include_comments:
        c_result = await db.execute(
            select(IssueComment)
            .where(IssueComment.issue_id == issue.id)
            .order_by(IssueComment.created_at.asc())
        )
        comment_rows = list(c_result.scalars().all())
        author_ids = {row.author_id for row in comment_rows}
        cnames = {**names, **(await user_names(db, author_ids - set(names)))}
        comments = [
            IssueCommentRead(
                id=row.id,
                issue_id=row.issue_id,
                author_id=row.author_id,
                author_name=cnames.get(row.author_id),
                body=row.body,
                created_at=row.created_at,
            )
            for row in comment_rows
        ]

    return IssueRead(
        id=issue.id,
        project_id=issue.project_id,
        key=issue.key,
        type=issue.type,
        parent_id=issue.parent_id,
        sprint_id=issue.sprint_id,
        title=issue.title,
        description=issue.description,
        status=issue.status,
        priority=issue.priority,
        assignee_id=issue.assignee_id,
        assignee_name=names.get(issue.assignee_id) if issue.assignee_id else None,
        reporter_id=issue.reporter_id,
        reporter_name=names.get(issue.reporter_id),
        story_points=issue.story_points,
        labels=list(issue.labels or []),
        epic_color=issue.epic_color,
        start_date=issue.start_date,
        due_date=issue.due_date,
        rank=issue.rank,
        created_at=issue.created_at,
        updated_at=issue.updated_at,
        children=children,
        comments=comments,
        child_count=child_count,
        child_done_count=child_done,
    )


async def to_sprint_read(db: AsyncSession, sprint: Sprint) -> SprintRead:
    count_result = await db.execute(
        select(func.count())
        .select_from(Issue)
        .where(
            Issue.project_id == sprint.project_id,
            Issue.sprint_id == sprint.id,
            _active_filter(),
        )
    )
    return SprintRead(
        id=sprint.id,
        project_id=sprint.project_id,
        name=sprint.name,
        goal=sprint.goal,
        status=sprint.status,
        start_date=sprint.start_date,
        end_date=sprint.end_date,
        created_at=sprint.created_at,
        updated_at=sprint.updated_at,
        issue_count=int(count_result.scalar() or 0),
    )


async def list_sprints(db: AsyncSession, project_id: int) -> list[SprintRead]:
    result = await db.execute(
        select(Sprint)
        .where(Sprint.project_id == project_id)
        .order_by(
            # active first, then planned, then completed
            Sprint.status.asc(),
            Sprint.start_date.asc().nullslast(),
            Sprint.id.asc(),
        )
    )
    return [await to_sprint_read(db, row) for row in result.scalars().all()]


async def create_sprint(db: AsyncSession, project_id: int, payload: SprintCreate) -> Sprint:
    sprint = Sprint(
        project_id=project_id,
        name=payload.name.strip(),
        goal=payload.goal.strip() if payload.goal else None,
        status=SprintStatus.PLANNED,
        start_date=payload.start_date,
        end_date=payload.end_date,
    )
    db.add(sprint)
    await db.commit()
    await db.refresh(sprint)
    return sprint


async def update_sprint(db: AsyncSession, sprint: Sprint, payload: SprintUpdate) -> Sprint:
    data = payload.model_dump(exclude_unset=True)
    if "status" in data and data["status"] == SprintStatus.ACTIVE:
        await _ensure_no_other_active(db, sprint.project_id, exclude_id=sprint.id)
    for key, value in data.items():
        if key == "name" and isinstance(value, str):
            value = value.strip()
        if key == "goal" and isinstance(value, str):
            value = value.strip() or None
        setattr(sprint, key, value)
    await db.commit()
    await db.refresh(sprint)
    return sprint


async def _ensure_no_other_active(
    db: AsyncSession, project_id: int, exclude_id: int | None = None
) -> None:
    stmt = select(Sprint).where(
        Sprint.project_id == project_id,
        Sprint.status == SprintStatus.ACTIVE,
    )
    if exclude_id is not None:
        stmt = stmt.where(Sprint.id != exclude_id)
    result = await db.execute(stmt)
    if result.scalar_one_or_none() is not None:
        raise HTTPException(
            status_code=400,
            detail="Another sprint is already active on this project",
        )


async def start_sprint(db: AsyncSession, sprint: Sprint) -> Sprint:
    if sprint.status == SprintStatus.COMPLETED:
        raise HTTPException(status_code=400, detail="Cannot start a completed sprint")
    await _ensure_no_other_active(db, sprint.project_id, exclude_id=sprint.id)
    sprint.status = SprintStatus.ACTIVE
    await db.commit()
    await db.refresh(sprint)
    return sprint


async def complete_sprint(
    db: AsyncSession, sprint: Sprint, payload: SprintCompleteRequest
) -> Sprint:
    if sprint.status != SprintStatus.ACTIVE and sprint.status != SprintStatus.PLANNED:
        raise HTTPException(status_code=400, detail="Sprint is already completed")

    incomplete = await db.execute(
        select(Issue).where(
            Issue.sprint_id == sprint.id,
            Issue.status != IssueStatus.DONE,
            _active_filter(),
        )
    )
    target_sprint_id: int | None = None
    if payload.incomplete_destination == "next_sprint":
        if not payload.next_sprint_id:
            raise HTTPException(status_code=400, detail="next_sprint_id is required")
        next_sprint = await db.get(Sprint, payload.next_sprint_id)
        if not next_sprint or next_sprint.project_id != sprint.project_id:
            raise HTTPException(status_code=404, detail="Next sprint not found")
        if next_sprint.id == sprint.id:
            raise HTTPException(status_code=400, detail="Next sprint must be different")
        if next_sprint.status == SprintStatus.COMPLETED:
            raise HTTPException(status_code=400, detail="Cannot move issues into a completed sprint")
        target_sprint_id = next_sprint.id

    for issue in incomplete.scalars().all():
        issue.sprint_id = target_sprint_id
        if target_sprint_id is not None:
            issue.rank = await _next_rank(db, sprint.project_id, target_sprint_id)

    sprint.status = SprintStatus.COMPLETED
    await db.commit()
    await db.refresh(sprint)
    return sprint


async def get_issue_for_project(db: AsyncSession, project_id: int, issue_id: int) -> Issue:
    issue = await db.get(Issue, issue_id)
    if not issue or issue.project_id != project_id or issue.deleted_at is not None:
        raise HTTPException(status_code=404, detail="Issue not found")
    return issue


async def get_sprint_for_project(db: AsyncSession, project_id: int, sprint_id: int) -> Sprint:
    sprint = await db.get(Sprint, sprint_id)
    if not sprint or sprint.project_id != project_id:
        raise HTTPException(status_code=404, detail="Sprint not found")
    return sprint


async def generate_issue_key(db: AsyncSession, project: Project) -> str:
    project.issue_seq = int(project.issue_seq or 0) + 1
    await db.flush()
    return f"{_issue_prefix(project)}-{project.issue_seq}"


async def create_issue(
    db: AsyncSession,
    project: Project,
    payload: IssueCreate,
    reporter_id: int,
) -> Issue:
    if payload.sprint_id is not None:
        await get_sprint_for_project(db, project.id, payload.sprint_id)
    if payload.parent_id is not None:
        parent = await get_issue_for_project(db, project.id, payload.parent_id)
        if payload.type == IssueType.EPIC:
            raise HTTPException(status_code=400, detail="Epics cannot have a parent")
        if parent.type == IssueType.TASK or parent.type == IssueType.BUG:
            raise HTTPException(status_code=400, detail="Parent must be an epic or story")

    epic_color = payload.epic_color
    if payload.type == IssueType.EPIC and not epic_color:
        count = await db.execute(
            select(func.count())
            .select_from(Issue)
            .where(Issue.project_id == project.id, Issue.type == IssueType.EPIC, _active_filter())
        )
        epic_color = DEFAULT_EPIC_COLORS[int(count.scalar() or 0) % len(DEFAULT_EPIC_COLORS)]

    key = await generate_issue_key(db, project)
    rank = await _next_rank(db, project.id, payload.sprint_id)
    issue = Issue(
        project_id=project.id,
        key=key,
        type=payload.type,
        parent_id=payload.parent_id,
        sprint_id=payload.sprint_id,
        title=payload.title.strip(),
        description=payload.description,
        status=payload.status,
        priority=payload.priority,
        assignee_id=payload.assignee_id,
        reporter_id=reporter_id,
        story_points=payload.story_points if payload.type != IssueType.EPIC else None,
        labels=list(payload.labels or []),
        epic_color=epic_color if payload.type == IssueType.EPIC else None,
        start_date=payload.start_date,
        due_date=payload.due_date,
        rank=rank,
    )
    db.add(issue)
    await db.commit()
    await db.refresh(issue)
    return issue


async def update_issue(db: AsyncSession, issue: Issue, payload: IssueUpdate) -> Issue:
    data = payload.model_dump(exclude_unset=True, exclude={"clear_parent", "clear_sprint", "clear_assignee"})
    if payload.clear_parent:
        issue.parent_id = None
    if payload.clear_sprint:
        issue.sprint_id = None
    if payload.clear_assignee:
        issue.assignee_id = None

    if "sprint_id" in data and data["sprint_id"] is not None:
        await get_sprint_for_project(db, issue.project_id, data["sprint_id"])
    if "parent_id" in data and data["parent_id"] is not None:
        if data["parent_id"] == issue.id:
            raise HTTPException(status_code=400, detail="Issue cannot be its own parent")
        await get_issue_for_project(db, issue.project_id, data["parent_id"])

    for key, value in data.items():
        if key == "title" and isinstance(value, str):
            value = value.strip()
        if key == "labels" and value is None:
            continue
        setattr(issue, key, value)

    if issue.type != IssueType.EPIC:
        issue.epic_color = None
        issue.story_points = issue.story_points  # keep
    else:
        issue.story_points = None

    await db.commit()
    await db.refresh(issue)
    return issue


async def rank_issue(
    db: AsyncSession, issue: Issue, payload: IssueRankUpdate
) -> Issue:
    if payload.clear_sprint:
        issue.sprint_id = None
    elif payload.sprint_id is not None:
        await get_sprint_for_project(db, issue.project_id, payload.sprint_id)
        issue.sprint_id = payload.sprint_id

    if payload.status is not None:
        issue.status = payload.status

    before_rank: float | None = None
    after_rank: float | None = None
    if payload.before_id is not None:
        before = await get_issue_for_project(db, issue.project_id, payload.before_id)
        before_rank = before.rank
    if payload.after_id is not None:
        after = await get_issue_for_project(db, issue.project_id, payload.after_id)
        after_rank = after.rank

    issue.rank = _compute_rank_between(before_rank, after_rank)
    await db.commit()
    await db.refresh(issue)
    return issue


async def soft_delete_issue(db: AsyncSession, issue: Issue, *, reparent: bool = False) -> None:
    kids = await db.execute(
        select(Issue).where(Issue.parent_id == issue.id, _active_filter())
    )
    children = list(kids.scalars().all())
    if children and not reparent:
        raise HTTPException(
            status_code=400,
            detail=f"Issue has {len(children)} child issue(s). Reparent or delete children first.",
        )
    for child in children:
        child.parent_id = issue.parent_id
    issue.deleted_at = datetime.now(timezone.utc)
    await db.commit()


async def list_issues(
    db: AsyncSession,
    project_id: int,
    *,
    sprint_id: int | None = None,
    backlog: bool = False,
    type_: IssueType | None = None,
    status: IssueStatus | None = None,
    assignee_id: int | None = None,
    epic_id: int | None = None,
    search: str | None = None,
) -> list[Issue]:
    stmt = (
        select(Issue)
        .where(Issue.project_id == project_id, _active_filter())
        .order_by(Issue.rank.asc(), Issue.id.asc())
    )
    if backlog:
        stmt = stmt.where(Issue.sprint_id.is_(None))
    elif sprint_id is not None:
        stmt = stmt.where(Issue.sprint_id == sprint_id)
    if type_ is not None:
        stmt = stmt.where(Issue.type == type_)
    if status is not None:
        stmt = stmt.where(Issue.status == status)
    if assignee_id is not None:
        stmt = stmt.where(Issue.assignee_id == assignee_id)
    if epic_id is not None:
        # direct children of epic, or descendants whose parent is a story under epic
        story_ids_result = await db.execute(
            select(Issue.id).where(
                Issue.project_id == project_id,
                Issue.parent_id == epic_id,
                _active_filter(),
            )
        )
        story_ids = list(story_ids_result.scalars().all())
        if story_ids:
            stmt = stmt.where(
                (Issue.parent_id == epic_id)
                | (Issue.id == epic_id)
                | (Issue.parent_id.in_(story_ids))
            )
        else:
            stmt = stmt.where((Issue.parent_id == epic_id) | (Issue.id == epic_id))
    if search:
        q = f"%{search.strip()}%"
        stmt = stmt.where((Issue.title.ilike(q)) | (Issue.key.ilike(q)))

    result = await db.execute(stmt)
    return list(result.scalars().all())


async def board_for_sprint(
    db: AsyncSession, project_id: int, sprint_id: int | None
) -> BoardRead:
    rows = await list_issues(db, project_id, sprint_id=sprint_id, backlog=sprint_id is None)
    name_ids = {uid for row in rows for uid in (row.assignee_id, row.reporter_id) if uid}
    names = await user_names(db, name_ids)
    buckets: dict[IssueStatus, list[IssueRead]] = {status: [] for status in IssueStatus}
    for row in rows:
        if row.type == IssueType.EPIC:
            continue
        buckets[row.status].append(await to_issue_read(db, row, names=names))
    return BoardRead(
        sprint_id=sprint_id,
        columns=[
            BoardColumnRead(status=status, issues=buckets[status]) for status in IssueStatus
        ],
    )


async def timeline_for_project(db: AsyncSession, project_id: int) -> TimelineRead:
    epics = await list_issues(db, project_id, type_=IssueType.EPIC)
    stories = await list_issues(db, project_id, type_=IssueType.STORY)
    sprints_result = await db.execute(
        select(Sprint).where(Sprint.project_id == project_id).order_by(Sprint.start_date.asc().nullslast())
    )
    sprints = list(sprints_result.scalars().all())

    stories_by_epic: dict[int | None, list[Issue]] = {}
    for story in stories:
        stories_by_epic.setdefault(story.parent_id, []).append(story)

    items: list[TimelineIssueRead] = []
    for epic in epics:
        children_stories = stories_by_epic.get(epic.id, [])
        child_reads: list[TimelineIssueRead] = []
        dates: list = []
        if epic.start_date:
            dates.append(epic.start_date)
        if epic.due_date:
            dates.append(epic.due_date)
        for story in children_stories:
            if story.start_date:
                dates.append(story.start_date)
            if story.due_date:
                dates.append(story.due_date)
            child_reads.append(
                TimelineIssueRead(
                    id=story.id,
                    key=story.key,
                    type=story.type,
                    title=story.title,
                    parent_id=story.parent_id,
                    start_date=story.start_date,
                    due_date=story.due_date,
                    epic_color=epic.epic_color,
                    status=story.status,
                )
            )
        start = epic.start_date or (min(dates) if dates else None)
        end = epic.due_date or (max(dates) if dates else None)
        items.append(
            TimelineIssueRead(
                id=epic.id,
                key=epic.key,
                type=epic.type,
                title=epic.title,
                parent_id=None,
                start_date=start,
                due_date=end,
                epic_color=epic.epic_color,
                status=epic.status,
                children=child_reads,
            )
        )

    return TimelineRead(
        issues=items,
        sprints=[
            TimelineSprintMarker(
                id=s.id,
                name=s.name,
                start_date=s.start_date,
                end_date=s.end_date,
                status=s.status,
            )
            for s in sprints
        ],
    )


async def add_issue_comment(
    db: AsyncSession, issue: Issue, payload: IssueCommentCreate, author_id: int
) -> IssueComment:
    comment = IssueComment(issue_id=issue.id, author_id=author_id, body=payload.body.strip())
    db.add(comment)
    await db.commit()
    await db.refresh(comment)
    return comment

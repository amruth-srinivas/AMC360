import {
  DndContext,
  DragOverlay,
  PointerSensor,
  closestCorners,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Bookmark,
  Bug,
  CheckSquare,
  ChevronDown,
  ChevronRight,
  LayoutList,
  Plus,
  Search,
  X,
  Zap,
} from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { UserAvatar } from "./ui/avatar";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { api } from "../lib/api";
import { cn } from "../lib/utils";

export type IssueType = "epic" | "story" | "task" | "bug";
export type IssueStatus = "todo" | "in_progress" | "in_review" | "done";
export type IssuePriority = "P0" | "P1" | "P2" | "P3";
export type SprintStatus = "planned" | "active" | "completed";

export type Sprint = {
  id: number;
  project_id: number;
  name: string;
  goal: string | null;
  status: SprintStatus;
  start_date: string | null;
  end_date: string | null;
  issue_count: number;
};

export type Issue = {
  id: number;
  project_id: number;
  key: string;
  type: IssueType;
  parent_id: number | null;
  sprint_id: number | null;
  title: string;
  description: string | null;
  status: IssueStatus;
  priority: IssuePriority;
  assignee_id: number | null;
  assignee_name: string | null;
  reporter_id: number;
  reporter_name: string | null;
  story_points: number | null;
  labels: string[];
  epic_color: string | null;
  start_date: string | null;
  due_date: string | null;
  rank: number;
  child_count: number;
  child_done_count: number;
  children?: Issue[];
  comments?: IssueComment[];
};

export type IssueComment = {
  id: number;
  issue_id: number;
  author_id: number;
  author_name: string | null;
  body: string;
  created_at: string;
};

type BoardRead = {
  sprint_id: number | null;
  columns: Array<{ status: IssueStatus; issues: Issue[] }>;
};

type TimelineRead = {
  issues: Array<{
    id: number;
    key: string;
    type: IssueType;
    title: string;
    parent_id: number | null;
    start_date: string | null;
    due_date: string | null;
    epic_color: string | null;
    status: IssueStatus;
    children: TimelineRead["issues"];
  }>;
  sprints: Array<{
    id: number;
    name: string;
    start_date: string | null;
    end_date: string | null;
    status: SprintStatus;
  }>;
};

type ProjectMember = {
  id: number;
  name: string;
  email: string;
};

const BOARD_COLUMNS: Array<{ status: IssueStatus; label: string; color: string }> = [
  { status: "todo", label: "To Do", color: "bg-slate-100 text-slate-700" },
  { status: "in_progress", label: "In Progress", color: "bg-indigo-100 text-indigo-700" },
  { status: "in_review", label: "In Review", color: "bg-amber-100 text-amber-800" },
  { status: "done", label: "Done", color: "bg-emerald-100 text-emerald-800" },
];

function priorityVariant(priority: IssuePriority) {
  if (priority === "P0" || priority === "P1") return "danger" as const;
  if (priority === "P2") return "warning" as const;
  return "neutral" as const;
}

function TypeIcon({ type, className }: { type: IssueType; className?: string }) {
  if (type === "epic") return <Zap className={cn("h-3.5 w-3.5 text-violet-600", className)} />;
  if (type === "story") return <Bookmark className={cn("h-3.5 w-3.5 text-emerald-600", className)} />;
  if (type === "bug") return <Bug className={cn("h-3.5 w-3.5 text-rose-600", className)} />;
  return <CheckSquare className={cn("h-3.5 w-3.5 text-sky-600", className)} />;
}

function SprintBadge({ status }: { status: SprintStatus }) {
  if (status === "active") {
    return <span className="rounded bg-indigo-600 px-1.5 py-0.5 text-[10px] font-semibold text-white">Active</span>;
  }
  if (status === "completed") {
    return <span className="rounded bg-gray-400 px-1.5 py-0.5 text-[10px] font-semibold text-white">Done</span>;
  }
  return (
    <span className="rounded border border-slate-300 px-1.5 py-0.5 text-[10px] font-semibold text-slate-600">
      Planned
    </span>
  );
}

function formatDate(value: string | null | undefined) {
  if (!value) return null;
  try {
    return new Date(value).toLocaleDateString(undefined, { month: "short", day: "numeric" });
  } catch {
    return value;
  }
}

function SortableIssueRow({
  issue,
  onOpen,
}: {
  issue: Issue;
  onOpen: (id: number) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: `issue-${issue.id}`,
    data: { issue },
  });

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(
        "group flex items-center gap-2 border-b border-gray-100 bg-white px-3 py-2 text-sm last:border-0",
        isDragging && "opacity-40",
      )}
    >
      <button
        type="button"
        className="cursor-grab touch-none text-gray-300 hover:text-gray-500"
        {...attributes}
        {...listeners}
        aria-label="Drag to reorder"
      >
        ⋮⋮
      </button>
      <TypeIcon type={issue.type} />
      <button
        type="button"
        onClick={() => onOpen(issue.id)}
        className="min-w-0 flex-1 text-left"
      >
        <span className="mr-2 font-mono text-xs text-gray-400">{issue.key}</span>
        <span className="text-gray-900 group-hover:text-primary">{issue.title}</span>
      </button>
      {issue.story_points != null ? (
        <span className="rounded bg-gray-100 px-1.5 py-0.5 text-[11px] font-medium text-gray-600">
          {issue.story_points}
        </span>
      ) : null}
      <Badge variant={priorityVariant(issue.priority)}>{issue.priority}</Badge>
      {issue.assignee_name ? <UserAvatar name={issue.assignee_name} size="sm" /> : (
        <span className="h-6 w-6 rounded-full border border-dashed border-gray-200" />
      )}
    </div>
  );
}

function QuickAddRow({
  projectId,
  sprintId,
  defaultType = "task",
  onCreated,
}: {
  projectId: number;
  sprintId: number | null;
  defaultType?: IssueType;
  onCreated: () => void;
}) {
  const [type, setType] = useState<IssueType>(defaultType);
  const [title, setTitle] = useState("");
  const createMutation = useMutation({
    mutationFn: () =>
      api.post<Issue>(`/projects/${projectId}/issues`, {
        title: title.trim(),
        type,
        sprint_id: sprintId,
      }),
    onSuccess: () => {
      setTitle("");
      onCreated();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <form
      className="flex items-center gap-2 border-t border-dashed border-gray-200 bg-gray-50/60 px-3 py-2"
      onSubmit={(e) => {
        e.preventDefault();
        if (!title.trim()) return;
        createMutation.mutate();
      }}
    >
      <select
        value={type}
        onChange={(e) => setType(e.target.value as IssueType)}
        className="rounded border border-gray-200 bg-white px-2 py-1 text-xs text-gray-700"
      >
        <option value="epic">Epic</option>
        <option value="story">Story</option>
        <option value="task">Task</option>
        <option value="bug">Bug</option>
      </select>
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Create issue…"
        className="min-w-0 flex-1 border-0 bg-transparent text-sm outline-none placeholder:text-gray-400"
      />
      <Button type="submit" size="sm" variant="ghost" disabled={!title.trim() || createMutation.isPending}>
        <Plus className="h-4 w-4" />
      </Button>
    </form>
  );
}

function IssueDetailDrawer({
  projectId,
  issueId,
  members,
  sprints,
  onClose,
  onChanged,
}: {
  projectId: number;
  issueId: number;
  members: ProjectMember[];
  sprints: Sprint[];
  onClose: () => void;
  onChanged: () => void;
}) {
  const query = useQuery({
    queryKey: ["issue", projectId, issueId],
    queryFn: () => api.get<Issue>(`/projects/${projectId}/issues/${issueId}`),
  });
  const issue = query.data;
  const [comment, setComment] = useState("");

  const saveMutation = useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      api.patch<Issue>(`/projects/${projectId}/issues/${issueId}`, body),
    onSuccess: () => {
      toast.success("Issue updated");
      query.refetch();
      onChanged();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const commentMutation = useMutation({
    mutationFn: () =>
      api.post(`/projects/${projectId}/issues/${issueId}/comments`, { body: comment.trim() }),
    onSuccess: () => {
      setComment("");
      query.refetch();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/30" onClick={onClose}>
      <aside
        className="flex h-full w-full max-w-lg flex-col bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-gray-100 px-5 py-3">
          <div className="flex items-center gap-2 text-sm text-gray-500">
            {issue ? <TypeIcon type={issue.type} /> : null}
            <span className="font-mono text-xs">{issue?.key ?? "…"}</span>
          </div>
          <button type="button" onClick={onClose} className="rounded p-1 text-gray-400 hover:bg-gray-100">
            <X className="h-4 w-4" />
          </button>
        </div>
        {query.isLoading || !issue ? (
          <p className="p-5 text-sm text-gray-400">Loading…</p>
        ) : (
          <div className="flex-1 space-y-4 overflow-y-auto px-5 py-4">
            <input
              defaultValue={issue.title}
              className="w-full border-0 text-lg font-semibold text-gray-900 outline-none focus:ring-0"
              onBlur={(e) => {
                const value = e.target.value.trim();
                if (value && value !== issue.title) saveMutation.mutate({ title: value });
              }}
            />
            <div className="grid grid-cols-2 gap-3 text-sm">
              <label className="space-y-1">
                <span className="text-[11px] font-medium uppercase tracking-wide text-gray-400">Type</span>
                <select
                  value={issue.type}
                  onChange={(e) => saveMutation.mutate({ type: e.target.value })}
                  className="w-full rounded-md border border-gray-200 px-2 py-1.5"
                >
                  <option value="epic">Epic</option>
                  <option value="story">Story</option>
                  <option value="task">Task</option>
                  <option value="bug">Bug</option>
                </select>
              </label>
              <label className="space-y-1">
                <span className="text-[11px] font-medium uppercase tracking-wide text-gray-400">Status</span>
                <select
                  value={issue.status}
                  onChange={(e) => saveMutation.mutate({ status: e.target.value })}
                  className="w-full rounded-md border border-gray-200 px-2 py-1.5"
                >
                  {BOARD_COLUMNS.map((col) => (
                    <option key={col.status} value={col.status}>
                      {col.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="space-y-1">
                <span className="text-[11px] font-medium uppercase tracking-wide text-gray-400">Priority</span>
                <select
                  value={issue.priority}
                  onChange={(e) => saveMutation.mutate({ priority: e.target.value })}
                  className="w-full rounded-md border border-gray-200 px-2 py-1.5"
                >
                  {(["P0", "P1", "P2", "P3"] as const).map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>
              </label>
              <label className="space-y-1">
                <span className="text-[11px] font-medium uppercase tracking-wide text-gray-400">Assignee</span>
                <select
                  value={issue.assignee_id ?? ""}
                  onChange={(e) => {
                    const raw = e.target.value;
                    if (!raw) saveMutation.mutate({ clear_assignee: true, assignee_id: null });
                    else saveMutation.mutate({ assignee_id: Number(raw) });
                  }}
                  className="w-full rounded-md border border-gray-200 px-2 py-1.5"
                >
                  <option value="">Unassigned</option>
                  {members.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="space-y-1">
                <span className="text-[11px] font-medium uppercase tracking-wide text-gray-400">Sprint</span>
                <select
                  value={issue.sprint_id ?? ""}
                  onChange={(e) => {
                    const raw = e.target.value;
                    if (!raw) saveMutation.mutate({ clear_sprint: true, sprint_id: null });
                    else saveMutation.mutate({ sprint_id: Number(raw) });
                  }}
                  className="w-full rounded-md border border-gray-200 px-2 py-1.5"
                >
                  <option value="">Backlog</option>
                  {sprints
                    .filter((s) => s.status !== "completed")
                    .map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                </select>
              </label>
              <label className="space-y-1">
                <span className="text-[11px] font-medium uppercase tracking-wide text-gray-400">Story points</span>
                <input
                  type="number"
                  defaultValue={issue.story_points ?? ""}
                  className="w-full rounded-md border border-gray-200 px-2 py-1.5"
                  onBlur={(e) => {
                    const value = e.target.value === "" ? null : Number(e.target.value);
                    if (value !== issue.story_points) saveMutation.mutate({ story_points: value });
                  }}
                />
              </label>
              <label className="space-y-1">
                <span className="text-[11px] font-medium uppercase tracking-wide text-gray-400">Start</span>
                <input
                  type="date"
                  defaultValue={issue.start_date ?? ""}
                  className="w-full rounded-md border border-gray-200 px-2 py-1.5"
                  onChange={(e) => saveMutation.mutate({ start_date: e.target.value || null })}
                />
              </label>
              <label className="space-y-1">
                <span className="text-[11px] font-medium uppercase tracking-wide text-gray-400">Due</span>
                <input
                  type="date"
                  defaultValue={issue.due_date ?? ""}
                  className="w-full rounded-md border border-gray-200 px-2 py-1.5"
                  onChange={(e) => saveMutation.mutate({ due_date: e.target.value || null })}
                />
              </label>
            </div>
            <label className="block space-y-1 text-sm">
              <span className="text-[11px] font-medium uppercase tracking-wide text-gray-400">Description</span>
              <textarea
                defaultValue={issue.description ?? ""}
                rows={5}
                className="w-full rounded-md border border-gray-200 px-3 py-2 text-sm"
                onBlur={(e) => {
                  const value = e.target.value;
                  if (value !== (issue.description ?? "")) saveMutation.mutate({ description: value });
                }}
              />
            </label>
            {issue.children && issue.children.length > 0 ? (
              <div>
                <p className="mb-2 text-[11px] font-medium uppercase tracking-wide text-gray-400">Children</p>
                <div className="space-y-1 rounded-lg border border-gray-100">
                  {issue.children.map((child) => (
                    <div key={child.id} className="flex items-center gap-2 px-3 py-2 text-sm">
                      <TypeIcon type={child.type} />
                      <span className="font-mono text-xs text-gray-400">{child.key}</span>
                      <span className="truncate">{child.title}</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
            <div>
              <p className="mb-2 text-[11px] font-medium uppercase tracking-wide text-gray-400">Comments</p>
              <div className="mb-3 space-y-2">
                {(issue.comments ?? []).map((c) => (
                  <div key={c.id} className="rounded-lg bg-gray-50 px-3 py-2 text-sm">
                    <p className="text-xs font-medium text-gray-700">
                      {c.author_name ?? "User"} · {new Date(c.created_at).toLocaleString()}
                    </p>
                    <p className="mt-1 whitespace-pre-wrap text-gray-800">{c.body}</p>
                  </div>
                ))}
              </div>
              <form
                className="flex gap-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!comment.trim()) return;
                  commentMutation.mutate();
                }}
              >
                <input
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder="Add a comment…"
                  className="min-w-0 flex-1 rounded-md border border-gray-200 px-3 py-2 text-sm"
                />
                <Button type="submit" size="sm" disabled={!comment.trim() || commentMutation.isPending}>
                  Post
                </Button>
              </form>
            </div>
          </div>
        )}
      </aside>
    </div>
  );
}

function BacklogView({
  projectId,
  issues,
  sprints,
  onOpen,
  onRefresh,
}: {
  projectId: number;
  issues: Issue[];
  sprints: Sprint[];
  onOpen: (id: number) => void;
  onRefresh: () => void;
}) {
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [activeId, setActiveId] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const epics = issues.filter((i) => i.type === "epic");
  const openSprints = sprints.filter((s) => s.status !== "completed");
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  function sectionKey(sprintId: number | null) {
    return sprintId == null ? "backlog" : `sprint-${sprintId}`;
  }

  function issuesIn(sprintId: number | null) {
    return issues.filter((i) => i.type !== "epic" && (i.sprint_id ?? null) === sprintId);
  }

  const createSprint = useMutation({
    mutationFn: () =>
      api.post<Sprint>(`/projects/${projectId}/sprints`, {
        name: `Sprint ${sprints.length + 1}`,
      }),
    onSuccess: () => {
      toast.success("Sprint created");
      onRefresh();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const startSprint = useMutation({
    mutationFn: (sprintId: number) => api.post(`/projects/${projectId}/sprints/${sprintId}/start`),
    onSuccess: () => {
      toast.success("Sprint started");
      onRefresh();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const completeSprint = useMutation({
    mutationFn: (sprintId: number) =>
      api.post(`/projects/${projectId}/sprints/${sprintId}/complete`, {
        incomplete_destination: "backlog",
      }),
    onSuccess: () => {
      toast.success("Sprint completed — incomplete issues moved to backlog");
      onRefresh();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  async function handleDragEnd(event: DragEndEvent) {
    setActiveId(null);
    const { active, over } = event;
    if (!over) return;
    const activeIssue = (active.data.current as { issue?: Issue } | undefined)?.issue;
    if (!activeIssue) return;

    const overId = String(over.id);
    let targetSprintId: number | null = activeIssue.sprint_id;
    let beforeId: number | null = null;
    let afterId: number | null = null;

    if (overId.startsWith("section-")) {
      const key = overId.replace("section-", "");
      targetSprintId = key === "backlog" ? null : Number(key.replace("sprint-", ""));
    } else if (overId.startsWith("issue-")) {
      const overIssueId = Number(overId.replace("issue-", ""));
      const overIssue = issues.find((i) => i.id === overIssueId);
      if (!overIssue) return;
      targetSprintId = overIssue.sprint_id;
      const list = issuesIn(targetSprintId).map((i) => i.id);
      const oldIndex = list.indexOf(activeIssue.id);
      const newIndex = list.indexOf(overIssueId);
      if (oldIndex >= 0 && newIndex >= 0) {
        const next = arrayMove(list, oldIndex, newIndex);
        const idx = next.indexOf(activeIssue.id);
        beforeId = idx > 0 ? next[idx - 1] : null;
        afterId = idx < next.length - 1 ? next[idx + 1] : null;
      } else {
        afterId = overIssueId;
      }
    }

    try {
      await api.patch(`/projects/${projectId}/issues/${activeIssue.id}/rank`, {
        sprint_id: targetSprintId,
        clear_sprint: targetSprintId == null,
        before_id: beforeId,
        after_id: afterId,
      });
      await queryClient.invalidateQueries({ queryKey: ["project-issues", projectId] });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Reorder failed");
    }
  }

  function onDragStart(event: DragStartEvent) {
    setActiveId(String(event.active.id));
  }

  const activeIssue = activeId?.startsWith("issue-")
    ? issues.find((i) => i.id === Number(activeId.replace("issue-", "")))
    : null;

  function toggle(key: string) {
    setCollapsed((c) => ({ ...c, [key]: !c[key] }));
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={onDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="space-y-4">
        <section className="rounded-xl border border-gray-200 bg-white">
          <button
            type="button"
            onClick={() => toggle("epics")}
            className="flex w-full items-center gap-2 border-b border-gray-100 px-4 py-3 text-left"
          >
            {collapsed.epics ? <ChevronRight className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            <span className="text-sm font-semibold text-gray-900">Epics</span>
            <span className="text-xs text-gray-400">{epics.length}</span>
          </button>
          {!collapsed.epics ? (
            <div>
              {epics.length === 0 ? (
                <p className="px-4 py-3 text-sm text-gray-400">No epics yet</p>
              ) : (
                epics.map((epic) => {
                  const total = epic.child_count || 0;
                  const done = epic.child_done_count || 0;
                  const pct = total ? Math.round((done / total) * 100) : 0;
                  return (
                    <button
                      key={epic.id}
                      type="button"
                      onClick={() => onOpen(epic.id)}
                      className="flex w-full items-center gap-3 border-b border-gray-50 px-4 py-2.5 text-left last:border-0 hover:bg-gray-50"
                    >
                      <span
                        className="h-2 w-8 rounded-full"
                        style={{ backgroundColor: epic.epic_color || "#6366F1" }}
                      />
                      <TypeIcon type="epic" />
                      <span className="font-mono text-xs text-gray-400">{epic.key}</span>
                      <span className="min-w-0 flex-1 truncate text-sm font-medium text-gray-900">
                        {epic.title}
                      </span>
                      <span className="text-xs text-gray-500">
                        {done}/{total}
                      </span>
                      <span className="h-1.5 w-16 overflow-hidden rounded-full bg-gray-100">
                        <span className="block h-full bg-violet-500" style={{ width: `${pct}%` }} />
                      </span>
                    </button>
                  );
                })
              )}
              <QuickAddRow projectId={projectId} sprintId={null} defaultType="epic" onCreated={onRefresh} />
            </div>
          ) : null}
        </section>

        <div className="flex justify-end">
          <Button size="sm" variant="outline" onClick={() => createSprint.mutate()} disabled={createSprint.isPending}>
            <Plus className="mr-1 h-3.5 w-3.5" />
            New sprint
          </Button>
        </div>

        {openSprints.map((sprint) => {
          const key = sectionKey(sprint.id);
          const list = issuesIn(sprint.id);
          return (
            <section key={sprint.id} className="rounded-xl border border-gray-200 bg-white">
              <div className="flex flex-wrap items-center gap-2 border-b border-gray-100 px-4 py-3">
                <button type="button" onClick={() => toggle(key)} className="flex items-center gap-2">
                  {collapsed[key] ? <ChevronRight className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  <span className="text-sm font-semibold text-gray-900">{sprint.name}</span>
                </button>
                <SprintBadge status={sprint.status} />
                <span className="text-xs text-gray-400">
                  {[formatDate(sprint.start_date), formatDate(sprint.end_date)].filter(Boolean).join(" – ") ||
                    "No dates"}
                </span>
                <span className="text-xs text-gray-400">{list.length} issues</span>
                <div className="ml-auto flex gap-2">
                  {sprint.status === "planned" ? (
                    <Button size="sm" onClick={() => startSprint.mutate(sprint.id)} disabled={startSprint.isPending}>
                      Start sprint
                    </Button>
                  ) : null}
                  {sprint.status === "active" ? (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => completeSprint.mutate(sprint.id)}
                      disabled={completeSprint.isPending}
                    >
                      Complete sprint
                    </Button>
                  ) : null}
                </div>
              </div>
              {!collapsed[key] ? (
                <div id={`section-sprint-${sprint.id}`}>
                  <SortableContext
                    items={list.map((i) => `issue-${i.id}`)}
                    strategy={verticalListSortingStrategy}
                    id={`section-sprint-${sprint.id}`}
                  >
                    {list.length === 0 ? (
                      <p className="px-4 py-3 text-sm text-gray-400">Empty sprint — drag issues here</p>
                    ) : (
                      list.map((issue) => (
                        <SortableIssueRow key={issue.id} issue={issue} onOpen={onOpen} />
                      ))
                    )}
                  </SortableContext>
                  <QuickAddRow projectId={projectId} sprintId={sprint.id} onCreated={onRefresh} />
                </div>
              ) : null}
            </section>
          );
        })}

        <section className="rounded-xl border border-gray-200 bg-white">
          <button
            type="button"
            onClick={() => toggle("backlog")}
            className="flex w-full items-center gap-2 border-b border-gray-100 px-4 py-3 text-left"
          >
            {collapsed.backlog ? <ChevronRight className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            <LayoutList className="h-4 w-4 text-gray-400" />
            <span className="text-sm font-semibold text-gray-900">Backlog</span>
            <span className="text-xs text-gray-400">{issuesIn(null).length}</span>
          </button>
          {!collapsed.backlog ? (
            <div>
              <SortableContext
                items={issuesIn(null).map((i) => `issue-${i.id}`)}
                strategy={verticalListSortingStrategy}
                id="section-backlog"
              >
                {issuesIn(null).length === 0 ? (
                  <p className="px-4 py-3 text-sm text-gray-400">Backlog is empty</p>
                ) : (
                  issuesIn(null).map((issue) => (
                    <SortableIssueRow key={issue.id} issue={issue} onOpen={onOpen} />
                  ))
                )}
              </SortableContext>
              <QuickAddRow projectId={projectId} sprintId={null} onCreated={onRefresh} />
            </div>
          ) : null}
        </section>
      </div>
      <DragOverlay>
        {activeIssue ? (
          <div className="rounded border border-primary/30 bg-white px-3 py-2 text-sm shadow-lg">
            <span className="font-mono text-xs text-gray-400">{activeIssue.key}</span> {activeIssue.title}
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}

function BoardCard({
  issue,
  onOpen,
}: {
  issue: Issue;
  onOpen: (id: number) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: `issue-${issue.id}`,
    data: { issue },
  });
  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        borderLeftWidth: 3,
        borderLeftColor: issue.epic_color || "#cbd5e1",
      }}
      className={cn(
        "cursor-pointer rounded-lg border border-gray-200 bg-white p-2.5 shadow-sm",
        isDragging && "opacity-40",
      )}
      onClick={() => onOpen(issue.id)}
      {...attributes}
      {...listeners}
    >
      <div className="mb-1 flex items-start justify-between gap-2">
        <span className="font-mono text-[11px] text-gray-400">{issue.key}</span>
        {issue.story_points != null ? (
          <span className="rounded bg-gray-100 px-1 text-[10px] font-medium text-gray-600">
            {issue.story_points}
          </span>
        ) : null}
      </div>
      <p className="line-clamp-2 text-sm font-medium text-gray-900">{issue.title}</p>
      <div className="mt-2 flex items-center justify-between">
        <div className="flex flex-wrap gap-1">
          {issue.labels.slice(0, 2).map((label) => (
            <span key={label} className="rounded bg-primary/5 px-1.5 py-0.5 text-[10px] text-primary">
              {label}
            </span>
          ))}
        </div>
        {issue.assignee_name ? <UserAvatar name={issue.assignee_name} size="sm" /> : null}
      </div>
    </div>
  );
}

function TimelineView({
  projectId,
  onOpen,
}: {
  projectId: number;
  onOpen: (id: number) => void;
}) {
  const query = useQuery({
    queryKey: ["project-timeline", projectId],
    queryFn: () => api.get<TimelineRead>(`/projects/${projectId}/issues/timeline`),
  });

  const data = query.data;
  if (query.isLoading) return <p className="text-sm text-gray-400">Loading timeline…</p>;
  if (!data || data.issues.length === 0) {
    return (
      <p className="py-10 text-center text-sm text-gray-400">
        No epics with dates yet. Set start/due dates on epics and stories to see the timeline.
      </p>
    );
  }

  const allDates = data.issues.flatMap((i) => {
    const childDates = i.children.flatMap((c) => [c.start_date, c.due_date]);
    return [i.start_date, i.due_date, ...childDates];
  }).filter(Boolean) as string[];

  const min = allDates.length
    ? new Date(Math.min(...allDates.map((d) => new Date(d).getTime())))
    : new Date();
  const max = allDates.length
    ? new Date(Math.max(...allDates.map((d) => new Date(d).getTime())))
    : new Date(min.getTime() + 30 * 86400000);
  // pad range
  min.setDate(min.getDate() - 7);
  max.setDate(max.getDate() + 14);
  const span = Math.max(1, max.getTime() - min.getTime());

  function leftPct(date: string | null) {
    if (!date) return 0;
    return ((new Date(date).getTime() - min.getTime()) / span) * 100;
  }
  function widthPct(start: string | null, end: string | null) {
    if (!start && !end) return 8;
    const s = new Date(start || end!).getTime();
    const e = new Date(end || start!).getTime();
    return Math.max(2, ((e - s) / span) * 100);
  }

  const months: Date[] = [];
  const cursor = new Date(min.getFullYear(), min.getMonth(), 1);
  while (cursor <= max) {
    months.push(new Date(cursor));
    cursor.setMonth(cursor.getMonth() + 1);
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
      <div className="min-w-[720px]">
        <div className="flex border-b border-gray-100">
          <div className="w-48 shrink-0 border-r border-gray-100 px-3 py-2 text-xs font-semibold text-gray-500">
            Epic / Story
          </div>
          <div className="relative flex-1">
            <div className="flex h-8">
              {months.map((m) => (
                <div
                  key={m.toISOString()}
                  className="border-r border-gray-50 px-1 text-[10px] text-gray-400"
                  style={{
                    width: `${widthPct(
                      new Date(m.getFullYear(), m.getMonth(), 1).toISOString().slice(0, 10),
                      new Date(m.getFullYear(), m.getMonth() + 1, 0).toISOString().slice(0, 10),
                    )}%`,
                    minWidth: 48,
                  }}
                >
                  {m.toLocaleDateString(undefined, { month: "short", year: "2-digit" })}
                </div>
              ))}
            </div>
            {data.sprints
              .filter((s) => s.start_date)
              .map((s) => (
                <div
                  key={s.id}
                  className="pointer-events-none absolute bottom-0 top-0 border-l border-dashed border-indigo-300"
                  style={{ left: `${leftPct(s.start_date)}%` }}
                  title={s.name}
                >
                  <span className="absolute left-0.5 top-0 text-[9px] text-indigo-500">{s.name}</span>
                </div>
              ))}
          </div>
        </div>
        {data.issues.map((epic) => (
          <div key={epic.id} className="border-b border-gray-50">
            <div className="flex items-center">
              <button
                type="button"
                onClick={() => onOpen(epic.id)}
                className="w-48 shrink-0 truncate border-r border-gray-50 px-3 py-2.5 text-left text-sm font-medium text-gray-900 hover:text-primary"
              >
                {epic.key} {epic.title}
              </button>
              <div className="relative h-9 flex-1">
                {(epic.start_date || epic.due_date) && (
                  <button
                    type="button"
                    onClick={() => onOpen(epic.id)}
                    className="absolute top-1.5 h-6 rounded-md px-2 text-[11px] font-medium text-white shadow-sm"
                    style={{
                      left: `${leftPct(epic.start_date || epic.due_date)}%`,
                      width: `${widthPct(epic.start_date, epic.due_date)}%`,
                      backgroundColor: epic.epic_color || "#6366F1",
                      minWidth: 24,
                    }}
                  >
                    <span className="truncate">{epic.key}</span>
                  </button>
                )}
              </div>
            </div>
            {epic.children.map((story) => (
              <div key={story.id} className="flex items-center bg-gray-50/40">
                <button
                  type="button"
                  onClick={() => onOpen(story.id)}
                  className="w-48 shrink-0 truncate border-r border-gray-50 py-2 pl-6 pr-3 text-left text-xs text-gray-600 hover:text-primary"
                >
                  {story.key} {story.title}
                </button>
                <div className="relative h-7 flex-1">
                  {(story.start_date || story.due_date) && (
                    <button
                      type="button"
                      onClick={() => onOpen(story.id)}
                      className="absolute top-1 h-5 rounded px-1.5 text-[10px] text-white"
                      style={{
                        left: `${leftPct(story.start_date || story.due_date)}%`,
                        width: `${widthPct(story.start_date, story.due_date)}%`,
                        backgroundColor: epic.epic_color || "#94a3b8",
                        opacity: 0.85,
                        minWidth: 16,
                      }}
                    />
                  )}
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

export function ProjectIssuesPanel({
  projectId,
  members = [],
}: {
  projectId: number;
  members?: ProjectMember[];
}) {
  const [view, setView] = useState<"backlog" | "board" | "timeline">("backlog");
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const queryClient = useQueryClient();

  const issuesQuery = useQuery({
    queryKey: ["project-issues", projectId],
    queryFn: () => api.get<Issue[]>(`/projects/${projectId}/issues`),
  });
  const sprintsQuery = useQuery({
    queryKey: ["project-sprints", projectId],
    queryFn: () => api.get<Sprint[]>(`/projects/${projectId}/sprints`),
  });

  function refresh() {
    queryClient.invalidateQueries({ queryKey: ["project-issues", projectId] });
    queryClient.invalidateQueries({ queryKey: ["project-sprints", projectId] });
    queryClient.invalidateQueries({ queryKey: ["project-board", projectId] });
    queryClient.invalidateQueries({ queryKey: ["project-timeline", projectId] });
  }

  const issues = issuesQuery.data ?? [];
  const sprints = sprintsQuery.data ?? [];
  const views = [
    { id: "backlog" as const, label: "Backlog" },
    { id: "board" as const, label: "Board" },
    { id: "timeline" as const, label: "Timeline" },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex rounded-lg border border-gray-200 bg-gray-50 p-0.5">
          {views.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setView(item.id)}
              className={cn(
                "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                view === item.id ? "bg-white text-primary shadow-sm" : "text-gray-500 hover:text-gray-800",
              )}
            >
              {item.label}
            </button>
          ))}
        </div>
        <p className="text-xs text-gray-400">
          {issues.length} issues · {sprints.filter((s) => s.status === "active").length ? "1 active sprint" : "No active sprint"}
        </p>
      </div>

      {issuesQuery.isLoading || sprintsQuery.isLoading ? (
        <p className="py-8 text-center text-sm text-gray-400">Loading issues…</p>
      ) : view === "backlog" ? (
        <BacklogView
          projectId={projectId}
          issues={issues}
          sprints={sprints}
          onOpen={setSelectedId}
          onRefresh={refresh}
        />
      ) : view === "board" ? (
        <BoardViewFixed
          projectId={projectId}
          sprints={sprints}
          members={members}
          onOpen={setSelectedId}
          onRefresh={refresh}
        />
      ) : (
        <TimelineView projectId={projectId} onOpen={setSelectedId} />
      )}

      {selectedId != null ? (
        <IssueDetailDrawer
          projectId={projectId}
          issueId={selectedId}
          members={members}
          sprints={sprints}
          onClose={() => setSelectedId(null)}
          onChanged={refresh}
        />
      ) : null}
    </div>
  );
}

/** Board view rewritten cleanly with BoardCard child (hooks-safe). */
function BoardViewFixed({
  projectId,
  sprints,
  members,
  onOpen,
  onRefresh,
}: {
  projectId: number;
  sprints: Sprint[];
  members: ProjectMember[];
  onOpen: (id: number) => void;
  onRefresh: () => void;
}) {
  const activeSprint = sprints.find((s) => s.status === "active");
  const [sprintId, setSprintId] = useState<number | "backlog" | null>(null);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<IssueType | "">("");
  const [assigneeFilter, setAssigneeFilter] = useState<number | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);

  const resolvedSprintId =
    sprintId === "backlog" ? null : sprintId ?? activeSprint?.id ?? sprints[0]?.id ?? null;

  const boardQuery = useQuery({
    queryKey: ["project-board", projectId, resolvedSprintId],
    queryFn: () => {
      const qs = resolvedSprintId == null ? "" : `?sprint_id=${resolvedSprintId}`;
      return api.get<BoardRead>(`/projects/${projectId}/issues/board${qs}`);
    },
  });

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  const columns = useMemo(() => {
    const raw = boardQuery.data?.columns ?? [];
    return raw.map((col) => ({
      ...col,
      issues: col.issues.filter((issue) => {
        if (
          search &&
          !issue.title.toLowerCase().includes(search.toLowerCase()) &&
          !issue.key.toLowerCase().includes(search.toLowerCase())
        ) {
          return false;
        }
        if (typeFilter && issue.type !== typeFilter) return false;
        if (assigneeFilter != null && issue.assignee_id !== assigneeFilter) return false;
        return true;
      }),
    }));
  }, [boardQuery.data, search, typeFilter, assigneeFilter]);

  async function handleDragEnd(event: DragEndEvent) {
    setActiveId(null);
    const { active, over } = event;
    if (!over) return;
    const activeIssue = (active.data.current as { issue?: Issue } | undefined)?.issue;
    if (!activeIssue) return;

    const overId = String(over.id);
    let status: IssueStatus = activeIssue.status;
    let afterId: number | null = null;

    if (overId.startsWith("col-")) {
      status = overId.replace("col-", "") as IssueStatus;
    } else if (overId.startsWith("issue-")) {
      const overIssue = columns.flatMap((c) => c.issues).find((i) => `issue-${i.id}` === overId);
      if (!overIssue) return;
      status = overIssue.status;
      afterId = overIssue.id;
    }

    try {
      await api.patch(`/projects/${projectId}/issues/${activeIssue.id}/rank`, {
        status,
        sprint_id: resolvedSprintId,
        clear_sprint: resolvedSprintId == null,
        after_id: afterId,
      });
      onRefresh();
      boardQuery.refetch();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Move failed");
    }
  }

  const activeIssue = activeId?.startsWith("issue-")
    ? columns.flatMap((c) => c.issues).find((i) => i.id === Number(activeId.replace("issue-", "")))
    : null;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <select
          value={resolvedSprintId == null ? "backlog" : String(resolvedSprintId)}
          onChange={(e) => {
            const v = e.target.value;
            setSprintId(v === "backlog" ? "backlog" : Number(v));
          }}
          className="rounded-md border border-gray-200 px-2.5 py-1.5 text-sm"
        >
          <option value="backlog">Backlog board</option>
          {sprints.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
              {s.status === "active" ? " (active)" : ""}
            </option>
          ))}
        </select>
        <div className="relative">
          <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search"
            className="rounded-md border border-gray-200 py-1.5 pl-7 pr-2 text-sm"
          />
        </div>
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value as IssueType | "")}
          className="rounded-md border border-gray-200 px-2 py-1.5 text-sm"
        >
          <option value="">All types</option>
          <option value="story">Story</option>
          <option value="task">Task</option>
          <option value="bug">Bug</option>
        </select>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setAssigneeFilter(null)}
            className={cn(
              "rounded-full border px-2 py-0.5 text-[11px]",
              assigneeFilter == null ? "border-primary bg-primary/10 text-primary" : "border-gray-200 text-gray-500",
            )}
          >
            All
          </button>
          {members.slice(0, 8).map((m) => (
            <button
              key={m.id}
              type="button"
              title={m.name}
              onClick={() => setAssigneeFilter((cur) => (cur === m.id ? null : m.id))}
              className={cn("rounded-full ring-offset-1", assigneeFilter === m.id ? "ring-2 ring-primary" : "")}
            >
              <UserAvatar name={m.name} size="sm" />
            </button>
          ))}
        </div>
      </div>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={(e) => setActiveId(String(e.active.id))}
        onDragEnd={handleDragEnd}
      >
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {BOARD_COLUMNS.map((col) => {
            const list = columns.find((c) => c.status === col.status)?.issues ?? [];
            return (
              <div
                key={col.status}
                className="flex min-h-[280px] flex-col rounded-xl border border-gray-200 bg-gray-50/80"
              >
                <div className="flex items-center justify-between px-3 py-2">
                  <span className={cn("rounded px-2 py-0.5 text-xs font-semibold", col.color)}>
                    {col.label}
                  </span>
                  <span className="text-xs text-gray-400">{list.length}</span>
                </div>
                <SortableContext items={list.map((i) => `issue-${i.id}`)} strategy={verticalListSortingStrategy}>
                  <div className="flex flex-1 flex-col gap-2 px-2 pb-2">
                    {list.map((issue) => (
                      <BoardCard key={issue.id} issue={issue} onOpen={onOpen} />
                    ))}
                  </div>
                </SortableContext>
              </div>
            );
          })}
        </div>
        <DragOverlay>
          {activeIssue ? (
            <div className="rounded-lg border border-primary/30 bg-white p-2.5 text-sm shadow-lg">
              {activeIssue.key} · {activeIssue.title}
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>
    </div>
  );
}

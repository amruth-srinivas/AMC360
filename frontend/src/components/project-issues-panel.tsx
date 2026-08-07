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
  Calendar as CalendarIcon,
  Check,
  CheckSquare,
  ChevronDown,
  ChevronRight,
  LayoutList,
  MoreHorizontal,
  Pencil,
  Plus,
  Search,
  Trash2,
  X,
  Zap,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState, type MutableRefObject, type ReactNode } from "react";
import { Modal } from "react-aria-components";
import { toast } from "sonner";

import {
  IssuesHelpButton,
  IssuesHelpSheet,
  IssuesWalkthrough,
  type CreateIssueTourDemo,
  type IssuePriorityDemo,
  type IssueTypeDemo,
  type IssuesTourApi,
  typeTextLive,
} from "./issues-onboarding";
import { Backdrop } from "./tailgrids/core/overlay";
import { UserAvatar } from "./ui/avatar";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { api } from "../lib/api";
import { useAuth } from "../store/auth";
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
  created_at?: string;
  updated_at?: string;
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

const BOARD_COLUMNS: Array<{ status: IssueStatus; label: string; className: string }> = [
  { status: "todo", label: "To Do", className: "bg-slate-100 text-slate-700" },
  { status: "in_progress", label: "In Progress", className: "bg-indigo-100 text-indigo-700" },
  { status: "in_review", label: "In Review", className: "bg-amber-100 text-amber-800" },
  { status: "done", label: "Done", className: "bg-emerald-100 text-emerald-800" },
];

const EPIC_COLORS = [
  "#6366F1",
  "#8B5CF6",
  "#EC4899",
  "#F59E0B",
  "#10B981",
  "#0EA5E9",
  "#EF4444",
  "#64748B",
];

const TYPE_META: Array<{
  type: IssueType;
  label: string;
  className: string;
  activeClass: string;
}> = [
  {
    type: "epic",
    label: "Epic",
    className: "text-violet-700",
    activeClass: "border-violet-300 bg-violet-50 text-violet-800",
  },
  {
    type: "story",
    label: "Story",
    className: "text-emerald-700",
    activeClass: "border-emerald-300 bg-emerald-50 text-emerald-800",
  },
  {
    type: "task",
    label: "Task",
    className: "text-sky-700",
    activeClass: "border-sky-300 bg-sky-50 text-sky-800",
  },
  {
    type: "bug",
    label: "Bug",
    className: "text-rose-700",
    activeClass: "border-rose-300 bg-rose-50 text-rose-800",
  },
];

function priorityVariant(priority: IssuePriority) {
  if (priority === "P0" || priority === "P1") return "danger" as const;
  if (priority === "P2") return "warning" as const;
  return "neutral" as const;
}

function statusMeta(status: IssueStatus) {
  return BOARD_COLUMNS.find((c) => c.status === status) ?? BOARD_COLUMNS[0];
}

function TypeIcon({ type, className }: { type: IssueType; className?: string }) {
  if (type === "epic") return <Zap className={cn("h-3.5 w-3.5 text-violet-600", className)} />;
  if (type === "story") return <Bookmark className={cn("h-3.5 w-3.5 text-emerald-600", className)} />;
  if (type === "bug") return <Bug className={cn("h-3.5 w-3.5 text-rose-600", className)} />;
  return <CheckSquare className={cn("h-3.5 w-3.5 text-sky-600", className)} />;
}

function SprintBadge({ status }: { status: SprintStatus }) {
  if (status === "active") {
    return (
      <span className="rounded bg-indigo-600 px-1.5 py-0.5 text-[10px] font-semibold text-white">
        Active
      </span>
    );
  }
  if (status === "completed") {
    return (
      <span className="rounded bg-gray-400 px-1.5 py-0.5 text-[10px] font-semibold text-white">
        Done
      </span>
    );
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
    return new Date(value.includes("T") ? value : `${value}T12:00:00`).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return value;
  }
}

function EmptyState({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center px-4 py-10 text-center">
      <p className="text-sm text-gray-400">{children}</p>
    </div>
  );
}

/** Compact date field: trigger + popover panel (styled, not a bare native control). */
function DateField({
  label,
  value,
  onChange,
  allowClear = true,
}: {
  label?: string;
  value: string | null;
  onChange: (next: string | null) => void;
  allowClear?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  return (
    <div ref={ref} className="relative">
      {label ? (
        <span className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-gray-400">
          {label}
        </span>
      ) : null}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex h-10 w-full items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 text-left text-sm text-gray-800 transition hover:border-primary/40"
      >
        <CalendarIcon className="h-4 w-4 shrink-0 text-gray-400" />
        <span className={cn("min-w-0 flex-1 truncate", !value && "text-gray-400")}>
          {value ? formatDate(value) : "Select date"}
        </span>
      </button>
      {open ? (
        <div className="absolute left-0 top-[calc(100%+6px)] z-[80] w-full min-w-[220px] rounded-xl border border-gray-200 bg-white p-3 shadow-lg">
          <input
            type="date"
            value={value ?? ""}
            onChange={(e) => {
              onChange(e.target.value || null);
              setOpen(false);
            }}
            className="w-full rounded-lg border border-gray-200 px-2 py-2 text-sm outline-none focus:border-primary"
            autoFocus
          />
          {allowClear && value ? (
            <button
              type="button"
              className="mt-2 w-full rounded-md py-1.5 text-xs font-medium text-gray-500 hover:bg-gray-50"
              onClick={() => {
                onChange(null);
                setOpen(false);
              }}
            >
              Clear date
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function LabelsInput({
  value,
  onChange,
}: {
  value: string[];
  onChange: (next: string[]) => void;
}) {
  const [draft, setDraft] = useState("");

  function addTag(raw: string) {
    const tag = raw.trim();
    if (!tag || value.includes(tag)) return;
    onChange([...value, tag]);
    setDraft("");
  }

  return (
    <div className="rounded-lg border border-gray-200 bg-white px-2 py-1.5 focus-within:border-primary/50">
      <div className="flex flex-wrap gap-1.5">
        {value.map((tag) => (
          <span
            key={tag}
            className="inline-flex items-center gap-1 rounded-md bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary"
          >
            {tag}
            <button
              type="button"
              className="text-primary/70 hover:text-primary"
              onClick={() => onChange(value.filter((t) => t !== tag))}
              aria-label={`Remove ${tag}`}
            >
              <X className="h-3 w-3" />
            </button>
          </span>
        ))}
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === ",") {
              e.preventDefault();
              addTag(draft);
            } else if (e.key === "Backspace" && !draft && value.length) {
              onChange(value.slice(0, -1));
            }
          }}
          placeholder={value.length ? "Add label…" : "Type a label and press Enter"}
          className="min-w-[8rem] flex-1 border-0 bg-transparent py-1 text-sm outline-none placeholder:text-gray-400"
        />
      </div>
    </div>
  );
}

function MemberSelect({
  members,
  value,
  onChange,
  placeholder = "Unassigned",
}: {
  members: ProjectMember[];
  value: number | null;
  onChange: (id: number | null) => void;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const ref = useRef<HTMLDivElement>(null);
  const selected = members.find((m) => m.id === value) ?? null;
  const filtered = members.filter(
    (m) =>
      !q.trim() ||
      m.name.toLowerCase().includes(q.toLowerCase()) ||
      m.email.toLowerCase().includes(q.toLowerCase()),
  );

  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex h-10 w-full items-center gap-2 rounded-lg border border-gray-200 bg-white px-2.5 text-left text-sm hover:border-primary/40"
      >
        {selected ? (
          <>
            <UserAvatar name={selected.name} size="sm" />
            <span className="min-w-0 flex-1 truncate font-medium text-gray-800">{selected.name}</span>
          </>
        ) : (
          <>
            <span className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-dashed border-gray-300 text-gray-400">
              <Plus className="h-3 w-3" />
            </span>
            <span className="text-gray-400">{placeholder}</span>
          </>
        )}
        <ChevronDown className="h-3.5 w-3.5 text-gray-400" />
      </button>
      {open ? (
        <div className="absolute left-0 top-[calc(100%+6px)] z-[80] w-full min-w-[220px] overflow-hidden rounded-xl border border-gray-200 bg-white shadow-lg">
          <div className="border-b border-gray-100 p-2">
            <div className="relative">
              <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search members…"
                className="w-full rounded-md border border-gray-200 py-1.5 pl-7 pr-2 text-sm outline-none focus:border-primary"
                autoFocus
              />
            </div>
          </div>
          <div className="max-h-48 overflow-y-auto py-1">
            <button
              type="button"
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-gray-500 hover:bg-gray-50"
              onClick={() => {
                onChange(null);
                setOpen(false);
                setQ("");
              }}
            >
              <span className="h-6 w-6 rounded-full border border-dashed border-gray-300" />
              Unassigned
            </button>
            {filtered.map((m) => (
              <button
                key={m.id}
                type="button"
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-primary/[0.04]"
                onClick={() => {
                  onChange(m.id);
                  setOpen(false);
                  setQ("");
                }}
              >
                <UserAvatar name={m.name} size="sm" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium text-gray-900">{m.name}</span>
                  <span className="block truncate text-[11px] text-gray-400">{m.email}</span>
                </span>
                {value === m.id ? <Check className="h-4 w-4 text-primary" /> : null}
              </button>
            ))}
            {filtered.length === 0 ? (
              <p className="px-3 py-3 text-center text-xs text-gray-400">No matches</p>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function EpicSelect({
  epics,
  value,
  onChange,
}: {
  epics: Issue[];
  value: number | null;
  onChange: (id: number | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const ref = useRef<HTMLDivElement>(null);
  const selected = epics.find((e) => e.id === value) ?? null;
  const filtered = epics.filter(
    (e) =>
      !q.trim() ||
      e.title.toLowerCase().includes(q.toLowerCase()) ||
      e.key.toLowerCase().includes(q.toLowerCase()),
  );

  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex h-10 w-full items-center gap-2 rounded-lg border border-gray-200 bg-white px-2.5 text-left text-sm hover:border-primary/40"
      >
        {selected ? (
          <>
            <span
              className="h-3 w-3 shrink-0 rounded-sm"
              style={{ backgroundColor: selected.epic_color || "#6366F1" }}
            />
            <span className="font-mono text-[11px] text-gray-400">{selected.key}</span>
            <span className="min-w-0 flex-1 truncate text-gray-800">{selected.title}</span>
          </>
        ) : (
          <span className="text-gray-400">No parent epic</span>
        )}
        <ChevronDown className="h-3.5 w-3.5 text-gray-400" />
      </button>
      {open ? (
        <div className="absolute left-0 top-[calc(100%+6px)] z-[80] max-h-56 w-full min-w-[240px] overflow-hidden rounded-xl border border-gray-200 bg-white shadow-lg">
          <div className="border-b border-gray-100 p-2">
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search epics…"
              className="w-full rounded-md border border-gray-200 px-2 py-1.5 text-sm outline-none focus:border-primary"
              autoFocus
            />
          </div>
          <div className="max-h-40 overflow-y-auto py-1">
            <button
              type="button"
              className="flex w-full px-3 py-2 text-left text-sm text-gray-500 hover:bg-gray-50"
              onClick={() => {
                onChange(null);
                setOpen(false);
              }}
            >
              No parent epic
            </button>
            {filtered.map((e) => (
              <button
                key={e.id}
                type="button"
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-primary/[0.04]"
                onClick={() => {
                  onChange(e.id);
                  setOpen(false);
                }}
              >
                <span
                  className="h-3 w-3 shrink-0 rounded-sm"
                  style={{ backgroundColor: e.epic_color || "#6366F1" }}
                />
                <span className="font-mono text-[11px] text-gray-400">{e.key}</span>
                <span className="truncate">{e.title}</span>
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function PillSelect<T extends string>({
  value,
  options,
  onChange,
  renderValue,
}: {
  value: T;
  options: Array<{ value: T; label: string; className?: string }>;
  onChange: (v: T) => void;
  renderValue: (v: T) => ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-1 rounded-md border border-transparent hover:border-gray-200"
      >
        {renderValue(value)}
        <ChevronDown className="h-3 w-3 text-gray-400" />
      </button>
      {open ? (
        <div className="absolute left-0 top-[calc(100%+4px)] z-[80] min-w-[140px] rounded-lg border border-gray-200 bg-white py-1 shadow-lg">
          {options.map((opt) => (
            <button
              key={opt.value}
              type="button"
              className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm hover:bg-gray-50"
              onClick={() => {
                onChange(opt.value);
                setOpen(false);
              }}
            >
              {renderValue(opt.value)}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function resolveEpic(issue: Issue, byId: Map<number, Issue>): Issue | null {
  if (issue.type === "epic") return null;
  if (!issue.parent_id) return null;
  const parent = byId.get(issue.parent_id);
  if (!parent) return null;
  if (parent.type === "epic") return parent;
  if (parent.parent_id) {
    const g = byId.get(parent.parent_id);
    if (g?.type === "epic") return g;
  }
  return null;
}

function SortableIssueRow({
  issue,
  onOpen,
  epic,
  onDelete,
}: {
  issue: Issue;
  onOpen: (id: number) => void;
  epic?: Issue | null;
  onDelete?: (issue: Issue) => void;
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
        "group flex items-center gap-2.5 border-b border-gray-100 bg-white px-3 py-3 text-sm last:border-0 hover:bg-primary/[0.03]",
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
      <button type="button" onClick={() => onOpen(issue.id)} className="min-w-0 flex-1 text-left">
        <span className="mr-2 font-mono text-xs text-gray-400">{issue.key}</span>
        <span className="text-gray-900 group-hover:text-primary">{issue.title}</span>
        {epic ? (
          <span
            className="ml-2 inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-medium"
            style={{
              backgroundColor: `${epic.epic_color || "#6366F1"}18`,
              color: epic.epic_color || "#6366F1",
            }}
          >
            <span
              className="h-1.5 w-1.5 rounded-full"
              style={{ backgroundColor: epic.epic_color || "#6366F1" }}
            />
            {epic.key}
          </span>
        ) : null}
      </button>
      {issue.story_points != null ? (
        <span className="rounded bg-gray-100 px-1.5 py-0.5 text-[11px] font-medium text-gray-600">
          {issue.story_points}
        </span>
      ) : null}
      <Badge variant={priorityVariant(issue.priority)}>{issue.priority}</Badge>
      {issue.assignee_name ? (
        <UserAvatar name={issue.assignee_name} size="sm" />
      ) : (
        <span
          className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-dashed border-gray-300 text-gray-300"
          title="Unassigned"
        >
          <Plus className="h-3 w-3" />
        </span>
      )}
      {onDelete ? (
        <button
          type="button"
          title="Delete"
          className="rounded-md p-1.5 text-gray-300 opacity-0 transition hover:bg-rose-50 hover:text-rose-600 group-hover:opacity-100 focus:opacity-100"
          onClick={(e) => {
            e.stopPropagation();
            onDelete(issue);
          }}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      ) : null}
    </div>
  );
}

function DeleteIssueDialog({
  issue,
  projectId,
  onClose,
  onDeleted,
}: {
  issue: Issue | null;
  projectId: number;
  onClose: () => void;
  onDeleted: () => void;
}) {
  const deleteMutation = useMutation({
    mutationFn: () => {
      if (!issue) throw new Error("No issue");
      // reparent=true so epics with children can be deleted (children stay, unlinked)
      return api.delete(`/projects/${projectId}/issues/${issue.id}?reparent=true`);
    },
    onSuccess: () => {
      toast.success(`${issue?.type === "epic" ? "Epic" : "Issue"} deleted`);
      onDeleted();
      onClose();
    },
    onError: (error: Error) => {
      let message = error.message;
      try {
        const parsed = JSON.parse(error.message) as { detail?: string };
        if (parsed?.detail) message = parsed.detail;
      } catch {
        /* keep */
      }
      toast.error(message);
    },
  });

  if (!issue) return null;

  const hasChildren = (issue.child_count ?? 0) > 0 || (issue.children?.length ?? 0) > 0;

  return (
    <Backdrop isOpen={Boolean(issue)} onOpenChange={(v) => (!v ? onClose() : null)}>
      <Modal>
        <div className="fixed left-1/2 top-1/2 w-full max-w-none -translate-x-1/2 -translate-y-1/2 rounded-xl border border-gray-200 bg-white p-5 shadow-xl outline-none sm:w-1/2 max-sm:max-w-[calc(100%-1.5rem)]">
          <h3 className="text-base font-semibold text-gray-900">
            Delete {issue.type === "epic" ? "epic" : "issue"}?
          </h3>
          <p className="mt-2 text-sm text-gray-600">
            Delete <strong className="font-mono">{issue.key}</strong> — {issue.title}? This cannot be
            undone.
          </p>
          {hasChildren || issue.type === "epic" ? (
            <p className="mt-2 text-xs text-amber-700">
              Any child issues will remain in the project but will no longer be linked under this{" "}
              {issue.type === "epic" ? "epic" : "issue"}.
            </p>
          ) : null}
          <div className="mt-5 flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={onClose} disabled={deleteMutation.isPending}>
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={deleteMutation.isPending}
              onClick={() => deleteMutation.mutate()}
            >
              {deleteMutation.isPending ? "Deleting…" : "Delete"}
            </Button>
          </div>
        </div>
      </Modal>
    </Backdrop>
  );
}

type CreateDefaults = {
  sprintId: number | null;
  type?: IssueType;
  parentId?: number | null;
};

function CreateIssueDialog({
  open,
  onClose,
  projectId,
  members,
  sprints,
  epics,
  defaults,
  onCreated,
  nonModal = false,
  tourDemoRef,
}: {
  open: boolean;
  onClose: () => void;
  projectId: number;
  members: ProjectMember[];
  sprints: Sprint[];
  epics: Issue[];
  defaults: CreateDefaults;
  onCreated: () => void;
  /** When true, skip focus/pointer trap so external UI (e.g. tour tooltips) stays clickable. */
  nonModal?: boolean;
  tourDemoRef?: MutableRefObject<CreateIssueTourDemo | null>;
}) {
  const [type, setType] = useState<IssueType>(defaults.type ?? "task");
  const [title, setTitle] = useState("");
  const [parentId, setParentId] = useState<number | null>(defaults.parentId ?? null);
  const [sprintId, setSprintId] = useState<number | null>(defaults.sprintId);
  const [assigneeId, setAssigneeId] = useState<number | null>(null);
  const [priority, setPriority] = useState<IssuePriority>("P2");
  const [storyPoints, setStoryPoints] = useState<string>("");
  const [labels, setLabels] = useState<string[]>([]);
  const [startDate, setStartDate] = useState<string | null>(null);
  const [dueDate, setDueDate] = useState<string | null>(null);
  const [description, setDescription] = useState("");
  const [epicColor, setEpicColor] = useState(EPIC_COLORS[0]);
  const [demoTyping, setDemoTyping] = useState(false);
  const titleRef = useRef<HTMLInputElement>(null);
  const descRef = useRef<HTMLTextAreaElement>(null);
  const typeGen = useRef(0);
  const membersRef = useRef(members);
  membersRef.current = members;

  useEffect(() => {
    if (!open) return;
    setType(defaults.type ?? "task");
    setTitle("");
    setParentId(defaults.parentId ?? null);
    setSprintId(defaults.sprintId);
    setAssigneeId(null);
    setPriority("P2");
    setStoryPoints("");
    setLabels([]);
    setStartDate(null);
    setDueDate(null);
    setDescription("");
    setEpicColor(EPIC_COLORS[0]);
    setDemoTyping(false);
    if (!nonModal) {
      const t = window.setTimeout(() => titleRef.current?.focus(), 50);
      return () => window.clearTimeout(t);
    }
  }, [open, defaults, nonModal]);

  const createMutation = useMutation({
    mutationFn: (payload?: {
      title: string;
      type: IssueType;
      description: string | null;
      parent_id: number | null;
      sprint_id: number | null;
      priority: IssuePriority;
      assignee_id: number | null;
      story_points: number | null;
      labels: string[];
      epic_color: string | null;
      start_date: string | null;
      due_date: string | null;
    }) => {
      const body = payload ?? {
        title: title.trim(),
        type,
        description: description.trim() || null,
        parent_id: type === "epic" ? null : parentId,
        sprint_id: type === "epic" ? null : sprintId,
        priority,
        assignee_id: assigneeId,
        story_points:
          type === "story" || type === "task"
            ? storyPoints === ""
              ? null
              : Number(storyPoints)
            : null,
        labels,
        epic_color: type === "epic" ? epicColor : null,
        start_date: startDate,
        due_date: dueDate,
      };
      return api.post<Issue>(`/projects/${projectId}/issues`, body);
    },
    onSuccess: () => {
      toast.success("Issue created");
      onCreated();
      onClose();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const createMutationRef = useRef(createMutation);
  createMutationRef.current = createMutation;

  // Snapshot form state for reliable tour create (avoids stale closures)
  const formSnapRef = useRef({
    title: "",
    type: "task" as IssueType,
    description: "",
    parentId: null as number | null,
    sprintId: null as number | null,
    priority: "P2" as IssuePriority,
    assigneeId: null as number | null,
    storyPoints: "",
    labels: [] as string[],
    epicColor: EPIC_COLORS[0],
    startDate: null as string | null,
    dueDate: null as string | null,
  });
  formSnapRef.current = {
    title,
    type,
    description,
    parentId,
    sprintId,
    priority,
    assigneeId,
    storyPoints,
    labels,
    epicColor,
    startDate,
    dueDate,
  };

  useEffect(() => {
    if (!open || !tourDemoRef) return;

    const flashField = async (selector: string) => {
      const el = document.querySelector(selector) as HTMLElement | null;
      el?.scrollIntoView({ block: "nearest", behavior: "smooth" });
      el?.classList.add("tour-demo-field-active");
      await new Promise((r) => window.setTimeout(r, 350));
      el?.classList.remove("tour-demo-field-active");
    };

    tourDemoRef.current = {
      selectType: async (next: IssueTypeDemo) => {
        const gen = ++typeGen.current;
        const btn = document.querySelector(
          `[data-tour-type="${next}"]`,
        ) as HTMLElement | null;
        btn?.classList.add("tour-demo-click");
        setType(next);
        await new Promise((r) => window.setTimeout(r, 280));
        if (gen === typeGen.current) btn?.classList.remove("tour-demo-click");
      },
      typeTitle: async (text: string) => {
        setDemoTyping(true);
        titleRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
        await typeTextLive(setTitle, text, { baseMs: 40 });
        setDemoTyping(false);
      },
      typeDescription: async (text: string) => {
        setDemoTyping(true);
        descRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
        await typeTextLive(setDescription, text, { baseMs: 28 });
        setDemoTyping(false);
      },
      setEpicColor: async (color: string) => {
        setEpicColor(color);
        await flashField(`[data-tour-color="${color}"]`);
      },
      setPriority: async (p: IssuePriorityDemo) => {
        setPriority(p as IssuePriority);
        await flashField('[data-tour="issues-create-priority"]');
      },
      setAssigneeIndex: async (index: number) => {
        const team = membersRef.current;
        if (team[index]) {
          setAssigneeId(team[index].id);
        }
        await flashField('[data-tour="issues-create-assignee"]');
      },
      setLabels: async (next: string[]) => {
        setLabels([]);
        await new Promise((r) => window.setTimeout(r, 120));
        for (let i = 0; i < next.length; i++) {
          setLabels(next.slice(0, i + 1));
          await new Promise((r) => window.setTimeout(r, 280));
        }
        await flashField('[data-tour="issues-create-labels"]');
      },
      setStartDate: async (iso: string) => {
        setStartDate(iso);
        await flashField('[data-tour="issues-create-start"]');
      },
      setDueDate: async (iso: string) => {
        setDueDate(iso);
        await flashField('[data-tour="issues-create-due"]');
      },
      setStoryPoints: async (value: string) => {
        setStoryPoints(value);
        await flashField('[data-tour="issues-create-points"]');
      },
      simulateCreate: async () => {
        const snap = formSnapRef.current;
        const titleText = snap.title.trim() || "Auto-Ballooning Module";
        const btn = document.querySelector(
          '[data-tour="issues-create-submit"]',
        ) as HTMLElement | null;
        btn?.classList.add("tour-demo-click");
        await new Promise((r) => window.setTimeout(r, 400));
        try {
          await createMutationRef.current.mutateAsync({
            title: titleText,
            type: snap.type,
            description: snap.description.trim() || null,
            parent_id: snap.type === "epic" ? null : snap.parentId,
            sprint_id: snap.type === "epic" ? null : snap.sprintId,
            priority: snap.priority,
            assignee_id: snap.assigneeId,
            story_points:
              snap.type === "story" || snap.type === "task"
                ? snap.storyPoints === ""
                  ? null
                  : Number(snap.storyPoints)
                : null,
            labels: snap.labels,
            epic_color: snap.type === "epic" ? snap.epicColor : null,
            start_date: snap.startDate,
            due_date: snap.dueDate,
          });
        } catch {
          toast.message("Create requires the filled form — try again when ready.");
        } finally {
          btn?.classList.remove("tour-demo-click");
        }
      },
    };

    return () => {
      if (tourDemoRef.current) tourDemoRef.current = null;
    };
  }, [open, tourDemoRef]);

  if (!open) return null;

  const form = (
        <div
          className={cn(
            "flex max-h-[min(92vh,820px)] w-full max-w-none flex-col overflow-hidden rounded-xl border border-gray-200 bg-white shadow-xl outline-none sm:w-1/2 max-sm:max-w-[calc(100%-1.5rem)]",
            nonModal
              ? "fixed left-1/2 top-1/2 z-[60] -translate-x-1/2 -translate-y-1/2"
              : "fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2",
          )}
          role="dialog"
          aria-modal={!nonModal}
          data-tour-dialog="create-issue"
        >
          <div className="flex items-center justify-between border-b border-gray-100 px-5 py-3.5">
            <h2 className="text-base font-semibold text-gray-900">Create issue</h2>
            <button
              type="button"
              onClick={onClose}
              className="rounded-md p-1.5 text-gray-400 hover:bg-gray-100"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="flex-1 space-y-4 overflow-y-auto px-5 py-4">
            <div data-tour="issues-create-type">
              <p className="mb-1.5 text-[11px] font-medium uppercase tracking-wide text-gray-400">
                Type
              </p>
              <div className="grid grid-cols-4 gap-1.5">
                {TYPE_META.map((item) => (
                  <button
                    key={item.type}
                    type="button"
                    data-tour-type={item.type}
                    onClick={() => setType(item.type)}
                    className={cn(
                      "inline-flex items-center justify-center gap-1.5 rounded-lg border px-2 py-2 text-xs font-semibold transition",
                      type === item.type
                        ? item.activeClass
                        : "border-gray-200 bg-white text-gray-600 hover:bg-gray-50",
                    )}
                  >
                    <TypeIcon type={item.type} />
                    {item.label}
                  </button>
                ))}
              </div>
            </div>

            <div data-tour="issues-create-title">
              <label className="mb-1.5 block text-[11px] font-medium uppercase tracking-wide text-gray-400">
                Title <span className="text-rose-500">*</span>
              </label>
              <input
                ref={titleRef}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="What needs to be done?"
                className={cn(
                  "h-10 w-full rounded-lg border border-gray-200 px-3 text-sm outline-none focus:border-primary",
                  demoTyping && "tour-demo-typing border-primary ring-2 ring-primary/25",
                )}
                readOnly={demoTyping}
              />
            </div>

            {type === "epic" ? (
              <div data-tour="issues-create-color">
                <p className="mb-1.5 text-[11px] font-medium uppercase tracking-wide text-gray-400">
                  Epic color
                </p>
                <div className="flex flex-wrap gap-2">
                  {EPIC_COLORS.map((color) => (
                    <button
                      key={color}
                      type="button"
                      data-tour-color={color}
                      onClick={() => setEpicColor(color)}
                      className={cn(
                        "h-7 w-7 rounded-full ring-offset-2 transition",
                        epicColor === color ? "ring-2 ring-primary" : "hover:scale-105",
                      )}
                      style={{ backgroundColor: color }}
                      aria-label={`Color ${color}`}
                    />
                  ))}
                </div>
              </div>
            ) : (
              <div data-tour="issues-create-parent" data-has-epics={epics.length > 0 ? "true" : "false"}>
                <p className="mb-1.5 text-[11px] font-medium uppercase tracking-wide text-gray-400">
                  Parent epic
                </p>
                {epics.length > 0 ? (
                  <EpicSelect epics={epics} value={parentId} onChange={setParentId} />
                ) : (
                  <div className="flex items-center gap-2 rounded-lg border border-dashed border-violet-200 bg-violet-50/50 px-3 py-2.5 text-sm">
                    <TypeIcon type="epic" />
                    <span className="min-w-0 flex-1 truncate text-gray-700">
                      Auto-Ballooning Module
                    </span>
                    <span className="shrink-0 rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-800">
                      example
                    </span>
                  </div>
                )}
              </div>
            )}

            {type !== "epic" ? (
              <div data-tour="issues-create-sprint">
                <p className="mb-1.5 text-[11px] font-medium uppercase tracking-wide text-gray-400">
                  Sprint
                </p>
                <select
                  value={sprintId ?? ""}
                  onChange={(e) => setSprintId(e.target.value ? Number(e.target.value) : null)}
                  className="h-10 w-full rounded-lg border border-gray-200 bg-white px-3 text-sm"
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
              </div>
            ) : null}

            <div className="grid grid-cols-2 gap-3">
              <div data-tour="issues-create-assignee">
                <p className="mb-1.5 text-[11px] font-medium uppercase tracking-wide text-gray-400">
                  Assignee
                </p>
                <MemberSelect members={members} value={assigneeId} onChange={setAssigneeId} />
              </div>
              <div data-tour="issues-create-priority">
                <p className="mb-1.5 text-[11px] font-medium uppercase tracking-wide text-gray-400">
                  Priority
                </p>
                <PillSelect
                  value={priority}
                  options={(["P0", "P1", "P2", "P3"] as const).map((p) => ({
                    value: p,
                    label: p,
                  }))}
                  onChange={setPriority}
                  renderValue={(p) => <Badge variant={priorityVariant(p)}>{p}</Badge>}
                />
              </div>
            </div>

            {type === "story" || type === "task" ? (
              <div data-tour="issues-create-points">
                <label className="mb-1.5 block text-[11px] font-medium uppercase tracking-wide text-gray-400">
                  Story points
                </label>
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={storyPoints}
                  onChange={(e) => setStoryPoints(e.target.value)}
                  className="h-10 w-full rounded-lg border border-gray-200 px-3 text-sm"
                  placeholder="e.g. 3"
                />
              </div>
            ) : null}

            <div data-tour="issues-create-labels">
              <p className="mb-1.5 text-[11px] font-medium uppercase tracking-wide text-gray-400">
                Labels
              </p>
              <LabelsInput value={labels} onChange={setLabels} />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div data-tour="issues-create-start">
                <DateField label="Start date" value={startDate} onChange={setStartDate} />
              </div>
              <div data-tour="issues-create-due">
                <DateField label="Due date" value={dueDate} onChange={setDueDate} />
              </div>
            </div>

            <div data-tour="issues-create-description">
              <label className="mb-1.5 block text-[11px] font-medium uppercase tracking-wide text-gray-400">
                Description
              </label>
              <textarea
                ref={descRef}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={4}
                className={cn(
                  "w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-primary",
                  demoTyping && "tour-demo-typing border-primary ring-2 ring-primary/25",
                )}
                placeholder="Optional details…"
                readOnly={demoTyping}
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 border-t border-gray-100 px-5 py-3">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button
              type="button"
              data-tour="issues-create-submit"
              disabled={!title.trim() || createMutation.isPending}
              onClick={() => createMutation.mutate(undefined)}
            >
              {createMutation.isPending ? "Creating…" : "Create"}
            </Button>
          </div>
        </div>
  );

  if (nonModal) {
    return (
      <>
        <div className="fixed inset-0 z-[55] bg-black/40" aria-hidden />
        {form}
      </>
    );
  }

  return (
    <Backdrop isOpen={open} onOpenChange={(v) => (!v ? onClose() : null)}>
      <Modal>{form}</Modal>
    </Backdrop>
  );
}

function CreateIssueTrigger({
  label = "Create issue…",
  onClick,
  tourId,
}: {
  label?: string;
  onClick: () => void;
  tourId?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      data-tour={tourId}
      className="flex w-full items-center gap-2 border-t border-dashed border-gray-200 bg-gray-50/70 px-3 py-2.5 text-left text-sm text-gray-500 transition hover:bg-primary/[0.04] hover:text-primary"
    >
      <Plus className="h-4 w-4" />
      {label}
    </button>
  );
}

function IssueDetailDrawer({
  projectId,
  issueId,
  members,
  sprints,
  epics,
  onClose,
  onChanged,
  onDeleted,
}: {
  projectId: number;
  issueId: number;
  members: ProjectMember[];
  sprints: Sprint[];
  epics: Issue[];
  onClose: () => void;
  onChanged: () => void;
  onDeleted: () => void;
}) {
  const query = useQuery({
    queryKey: ["issue", projectId, issueId],
    queryFn: () => api.get<Issue>(`/projects/${projectId}/issues/${issueId}`),
  });
  const issue = query.data;
  const [comment, setComment] = useState("");
  const [labels, setLabels] = useState<string[]>([]);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    if (issue) setLabels(issue.labels ?? []);
  }, [issue?.id, issue?.labels]);

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

  function Section({ title, children }: { title: string; children: ReactNode }) {
    return (
      <section className="space-y-3">
        <h3 className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">{title}</h3>
        {children}
      </section>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/30" onClick={onClose}>
      <aside
        className="flex h-full w-full max-w-none flex-col bg-white shadow-2xl sm:w-1/2"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-gray-100 px-5 py-3">
          <div className="flex items-center gap-2 text-sm text-gray-500">
            {issue ? <TypeIcon type={issue.type} /> : null}
            <span className="font-mono text-xs">{issue?.key ?? "…"}</span>
          </div>
          <div className="flex items-center gap-1">
            {issue ? (
              <button
                type="button"
                title="Delete"
                onClick={() => setConfirmDelete(true)}
                className="rounded-md p-1.5 text-gray-400 hover:bg-rose-50 hover:text-rose-600"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            ) : null}
            <button
              type="button"
              onClick={onClose}
              className="rounded p-1.5 text-gray-400 hover:bg-gray-100"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
        {query.isLoading || !issue ? (
          <p className="p-5 text-sm text-gray-400">Loading…</p>
        ) : (
          <div className="flex-1 space-y-6 overflow-y-auto px-5 py-4">
            <input
              defaultValue={issue.title}
              key={`title-${issue.id}-${issue.updated_at ?? issue.id}`}
              className="w-full border-0 text-lg font-semibold text-gray-900 outline-none focus:ring-0"
              onBlur={(e) => {
                const value = e.target.value.trim();
                if (value && value !== issue.title) saveMutation.mutate({ title: value });
              }}
            />

            <Section title="Classification">
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <p className="mb-1 text-[11px] text-gray-400">Type</p>
                  <PillSelect
                    value={issue.type}
                    options={TYPE_META.map((t) => ({ value: t.type, label: t.label }))}
                    onChange={(type) => saveMutation.mutate({ type })}
                    renderValue={(t) => (
                      <span
                        className={cn(
                          "inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs font-semibold",
                          TYPE_META.find((m) => m.type === t)?.activeClass,
                        )}
                      >
                        <TypeIcon type={t} />
                        {TYPE_META.find((m) => m.type === t)?.label}
                      </span>
                    )}
                  />
                </div>
                <div>
                  <p className="mb-1 text-[11px] text-gray-400">Status</p>
                  <PillSelect
                    value={issue.status}
                    options={BOARD_COLUMNS.map((c) => ({ value: c.status, label: c.label }))}
                    onChange={(status) => saveMutation.mutate({ status })}
                    renderValue={(s) => (
                      <span
                        className={cn(
                          "inline-flex rounded-md px-2 py-1 text-xs font-semibold",
                          statusMeta(s).className,
                        )}
                      >
                        {statusMeta(s).label}
                      </span>
                    )}
                  />
                </div>
                <div>
                  <p className="mb-1 text-[11px] text-gray-400">Priority</p>
                  <PillSelect
                    value={issue.priority}
                    options={(["P0", "P1", "P2", "P3"] as const).map((p) => ({
                      value: p,
                      label: p,
                    }))}
                    onChange={(priority) => saveMutation.mutate({ priority })}
                    renderValue={(p) => <Badge variant={priorityVariant(p)}>{p}</Badge>}
                  />
                </div>
              </div>
              {issue.type === "epic" ? (
                <div>
                  <p className="mb-1.5 text-[11px] text-gray-400">Epic color</p>
                  <div className="flex flex-wrap gap-2">
                    {EPIC_COLORS.map((color) => (
                      <button
                        key={color}
                        type="button"
                        onClick={() => saveMutation.mutate({ epic_color: color })}
                        className={cn(
                          "h-7 w-7 rounded-full ring-offset-2",
                          (issue.epic_color || EPIC_COLORS[0]) === color
                            ? "ring-2 ring-primary"
                            : "",
                        )}
                        style={{ backgroundColor: color }}
                      />
                    ))}
                  </div>
                </div>
              ) : null}
            </Section>

            <Section title="People">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="mb-1.5 text-[11px] text-gray-400">Assignee</p>
                  <MemberSelect
                    members={members}
                    value={issue.assignee_id}
                    onChange={(id) =>
                      id == null
                        ? saveMutation.mutate({ clear_assignee: true })
                        : saveMutation.mutate({ assignee_id: id })
                    }
                  />
                </div>
                <div>
                  <p className="mb-1.5 text-[11px] text-gray-400">Reporter</p>
                  <div className="flex h-10 items-center gap-2 rounded-lg border border-gray-100 bg-gray-50 px-2.5 text-sm text-gray-600">
                    <UserAvatar name={issue.reporter_name || "User"} size="sm" />
                    <span className="truncate">{issue.reporter_name || "—"}</span>
                  </div>
                </div>
              </div>
            </Section>

            <Section title="Planning">
              <div className="space-y-3">
                {issue.type !== "epic" ? (
                  <>
                    <div>
                      <p className="mb-1.5 text-[11px] text-gray-400">Sprint</p>
                      <select
                        value={issue.sprint_id ?? ""}
                        onChange={(e) => {
                          const raw = e.target.value;
                          if (!raw) saveMutation.mutate({ clear_sprint: true });
                          else saveMutation.mutate({ sprint_id: Number(raw) });
                        }}
                        className="h-10 w-full rounded-lg border border-gray-200 bg-white px-3 text-sm"
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
                    </div>
                    <div>
                      <p className="mb-1.5 text-[11px] text-gray-400">Parent epic</p>
                      <EpicSelect
                        epics={epics.filter((e) => e.id !== issue.id)}
                        value={
                          issue.parent_id &&
                          epics.some((e) => e.id === issue.parent_id)
                            ? issue.parent_id
                            : null
                        }
                        onChange={(id) =>
                          id == null
                            ? saveMutation.mutate({ clear_parent: true })
                            : saveMutation.mutate({ parent_id: id })
                        }
                      />
                    </div>
                  </>
                ) : null}
                {(issue.type === "story" || issue.type === "task") && (
                  <div>
                    <p className="mb-1.5 text-[11px] text-gray-400">Story points</p>
                    <input
                      type="number"
                      defaultValue={issue.story_points ?? ""}
                      className="h-10 w-full rounded-lg border border-gray-200 px-3 text-sm"
                      onBlur={(e) => {
                        const value = e.target.value === "" ? null : Number(e.target.value);
                        if (value !== issue.story_points) {
                          saveMutation.mutate({ story_points: value });
                        }
                      }}
                    />
                  </div>
                )}
                <div className="grid grid-cols-2 gap-3">
                  <DateField
                    label="Start"
                    value={issue.start_date}
                    onChange={(d) => saveMutation.mutate({ start_date: d })}
                  />
                  <DateField
                    label="Due"
                    value={issue.due_date}
                    onChange={(d) => saveMutation.mutate({ due_date: d })}
                  />
                </div>
              </div>
            </Section>

            <Section title="Details">
              <div>
                <p className="mb-1.5 text-[11px] text-gray-400">Description</p>
                <textarea
                  defaultValue={issue.description ?? ""}
                  key={`desc-${issue.id}`}
                  rows={4}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                  onBlur={(e) => {
                    if (e.target.value !== (issue.description ?? "")) {
                      saveMutation.mutate({ description: e.target.value });
                    }
                  }}
                />
              </div>
              <div>
                <p className="mb-1.5 text-[11px] text-gray-400">Labels</p>
                <LabelsInput
                  value={labels}
                  onChange={(next) => {
                    setLabels(next);
                    saveMutation.mutate({ labels: next });
                  }}
                />
              </div>
              {issue.children && issue.children.length > 0 ? (
                <div>
                  <p className="mb-1.5 text-[11px] text-gray-400">Children</p>
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
            </Section>

            <Section title="Activity">
              <div className="space-y-2">
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
                  className="min-w-0 flex-1 rounded-lg border border-gray-200 px-3 py-2 text-sm"
                />
                <Button type="submit" size="sm" disabled={!comment.trim() || commentMutation.isPending}>
                  Post
                </Button>
              </form>
            </Section>
          </div>
        )}
      </aside>
      <DeleteIssueDialog
        issue={confirmDelete && issue ? issue : null}
        projectId={projectId}
        onClose={() => setConfirmDelete(false)}
        onDeleted={onDeleted}
      />
    </div>
  );
}

function SprintHeader({
  sprint,
  projectId,
  issueCount,
  collapsed,
  onToggle,
  onRefresh,
}: {
  sprint: Sprint;
  projectId: number;
  issueCount: number;
  collapsed: boolean;
  onToggle: () => void;
  onRefresh: () => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [name, setName] = useState(sprint.name);
  const [goal, setGoal] = useState(sprint.goal ?? "");
  const [start, setStart] = useState<string | null>(sprint.start_date);
  const [end, setEnd] = useState<string | null>(sprint.end_date);
  const menuRef = useRef<HTMLDivElement>(null);
  const hasDates = Boolean(sprint.start_date && sprint.end_date);

  useEffect(() => {
    setName(sprint.name);
    setGoal(sprint.goal ?? "");
    setStart(sprint.start_date);
    setEnd(sprint.end_date);
  }, [sprint]);

  useEffect(() => {
    if (!menuOpen) return;
    function onDoc(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [menuOpen]);

  const updateMutation = useMutation({
    mutationFn: () =>
      api.patch<Sprint>(`/projects/${projectId}/sprints/${sprint.id}`, {
        name: name.trim(),
        goal: goal.trim() || null,
        start_date: start,
        end_date: end,
      }),
    onSuccess: () => {
      toast.success("Sprint updated");
      setEditOpen(false);
      onRefresh();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const startMutation = useMutation({
    mutationFn: () => api.post(`/projects/${projectId}/sprints/${sprint.id}/start`),
    onSuccess: () => {
      toast.success("Sprint started");
      onRefresh();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const completeMutation = useMutation({
    mutationFn: () =>
      api.post(`/projects/${projectId}/sprints/${sprint.id}/complete`, {
        incomplete_destination: "backlog",
      }),
    onSuccess: () => {
      toast.success("Sprint completed");
      onRefresh();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const deleteMutation = useMutation({
    mutationFn: () => api.delete(`/projects/${projectId}/sprints/${sprint.id}`),
    onSuccess: () => {
      toast.success("Sprint deleted — issues moved to backlog");
      setConfirmDelete(false);
      onRefresh();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <>
      <div className="flex flex-wrap items-center gap-2 border-b border-gray-100 px-4 py-3">
        <button type="button" onClick={onToggle} className="flex items-center gap-2">
          {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          <span className="text-sm font-semibold text-gray-900">{sprint.name}</span>
        </button>
        <button
          type="button"
          onClick={() => setEditOpen(true)}
          className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-primary"
          title="Edit sprint"
        >
          <Pencil className="h-3.5 w-3.5" />
        </button>
        <SprintBadge status={sprint.status} />
        <button
          type="button"
          onClick={() => setEditOpen(true)}
          className="text-xs text-gray-400 hover:text-primary hover:underline"
        >
          {[formatDate(sprint.start_date), formatDate(sprint.end_date)].filter(Boolean).join(" – ") ||
            "No dates — click to set"}
        </button>
        <span className="text-xs text-gray-400">{issueCount} issues</span>
        <div className="ml-auto flex items-center gap-2">
          {sprint.status === "planned" ? (
            <span className="relative group" data-tour="issues-start-sprint">
              <Button
                size="sm"
                onClick={() => startMutation.mutate()}
                disabled={!hasDates || startMutation.isPending}
                className={!hasDates ? "opacity-50" : ""}
              >
                Start sprint
              </Button>
              {!hasDates ? (
                <span className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-1 hidden -translate-x-1/2 whitespace-nowrap rounded bg-gray-900 px-2 py-1 text-[10px] text-white group-hover:block">
                  Set sprint dates first
                </span>
              ) : null}
            </span>
          ) : null}
          {sprint.status === "active" ? (
            <Button
              size="sm"
              variant="outline"
              onClick={() => completeMutation.mutate()}
              disabled={completeMutation.isPending}
            >
              Complete sprint
            </Button>
          ) : null}
          <div ref={menuRef} className="relative">
            <button
              type="button"
              onClick={() => setMenuOpen((v) => !v)}
              className="rounded-md p-1.5 text-gray-400 hover:bg-gray-100"
              aria-label="Sprint menu"
            >
              <MoreHorizontal className="h-4 w-4" />
            </button>
            {menuOpen ? (
              <div className="absolute right-0 top-[calc(100%+4px)] z-40 min-w-[160px] rounded-lg border border-gray-200 bg-white py-1 shadow-lg">
                <button
                  type="button"
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-gray-50"
                  onClick={() => {
                    setMenuOpen(false);
                    setEditOpen(true);
                  }}
                >
                  <Pencil className="h-3.5 w-3.5 text-gray-400" />
                  Edit
                </button>
                <button
                  type="button"
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-rose-600 hover:bg-rose-50"
                  onClick={() => {
                    setMenuOpen(false);
                    setConfirmDelete(true);
                  }}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Delete sprint
                </button>
              </div>
            ) : null}
          </div>
        </div>
      </div>

      {editOpen ? (
        <Backdrop isOpen={editOpen} onOpenChange={(v) => (!v ? setEditOpen(false) : null)}>
          <Modal>
            <div className="fixed left-1/2 top-1/2 max-h-[min(92vh,820px)] w-full max-w-none -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-xl border border-gray-200 bg-white p-5 shadow-xl outline-none sm:w-1/2 max-sm:max-w-[calc(100%-1.5rem)]">
              <h3 className="text-base font-semibold text-gray-900">Edit sprint</h3>
              <div className="mt-4 space-y-3">
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-600">Name</label>
                  <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="h-10 w-full rounded-lg border border-gray-200 px-3 text-sm"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-600">Goal</label>
                  <input
                    value={goal}
                    onChange={(e) => setGoal(e.target.value)}
                    placeholder="Sprint goal (optional)"
                    className="h-10 w-full rounded-lg border border-gray-200 px-3 text-sm"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <DateField label="Start" value={start} onChange={setStart} />
                  <DateField label="End" value={end} onChange={setEnd} />
                </div>
              </div>
              <div className="mt-5 flex justify-end gap-2">
                <Button variant="outline" onClick={() => setEditOpen(false)}>
                  Cancel
                </Button>
                <Button
                  disabled={!name.trim() || updateMutation.isPending}
                  onClick={() => updateMutation.mutate()}
                >
                  Save
                </Button>
              </div>
            </div>
          </Modal>
        </Backdrop>
      ) : null}

      {confirmDelete ? (
        <Backdrop isOpen={confirmDelete} onOpenChange={(v) => (!v ? setConfirmDelete(false) : null)}>
          <Modal>
            <div className="fixed left-1/2 top-1/2 w-full max-w-none -translate-x-1/2 -translate-y-1/2 rounded-xl border border-gray-200 bg-white p-5 shadow-xl outline-none sm:w-1/2 max-sm:max-w-[calc(100%-1.5rem)]">
              <h3 className="text-base font-semibold text-gray-900">Delete sprint?</h3>
              <p className="mt-2 text-sm text-gray-600">
                Issues in <strong>{sprint.name}</strong> will move back to the Backlog. This cannot be
                undone.
              </p>
              <div className="mt-5 flex justify-end gap-2">
                <Button variant="outline" onClick={() => setConfirmDelete(false)}>
                  Cancel
                </Button>
                <Button
                  variant="destructive"
                  disabled={deleteMutation.isPending}
                  onClick={() => deleteMutation.mutate()}
                >
                  {deleteMutation.isPending ? "Deleting…" : "Delete sprint"}
                </Button>
              </div>
            </div>
          </Modal>
        </Backdrop>
      ) : null}
    </>
  );
}

function BacklogView({
  projectId,
  issues,
  sprints,
  members,
  onOpen,
  onRefresh,
  tourApiRef,
  tourActive = false,
}: {
  projectId: number;
  issues: Issue[];
  sprints: Sprint[];
  members: ProjectMember[];
  onOpen: (id: number) => void;
  onRefresh: () => void;
  tourApiRef?: MutableRefObject<IssuesTourApi | null>;
  tourActive?: boolean;
}) {
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({
    epics: false,
    backlog: false,
  });
  const [expandedEpics, setExpandedEpics] = useState<Record<number, boolean>>({});
  const [activeId, setActiveId] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [createDefaults, setCreateDefaults] = useState<CreateDefaults>({
    sprintId: null,
    type: "task",
  });
  const [deleteTarget, setDeleteTarget] = useState<Issue | null>(null);
  const createDemoRef = useRef<CreateIssueTourDemo | null>(null);
  const queryClient = useQueryClient();

  function openCreate(defaults: CreateDefaults) {
    setCreateDefaults(defaults);
    setCreateOpen(true);
  }

  /** Close then re-open so type/parent fields remount cleanly for the tour. */
  function openCreateFresh(defaults: CreateDefaults): Promise<void> {
    setCreateOpen(false);
    return new Promise((resolve) => {
      window.setTimeout(() => {
        setCreateDefaults(defaults);
        setCreateOpen(true);
        window.setTimeout(resolve, 120);
      }, 40);
    });
  }

  useEffect(() => {
    if (!tourApiRef) return;
    tourApiRef.current = {
      goBacklog: () => {
        setCollapsed((c) => ({ ...c, epics: false, backlog: false }));
      },
      openCreateEpic: () => openCreateFresh({ sprintId: null, type: "epic" }),
      openCreateStory: () => openCreateFresh({ sprintId: null, type: "story" }),
      closeCreate: () => setCreateOpen(false),
      selectType: (t) => createDemoRef.current?.selectType(t) ?? Promise.resolve(),
      typeTitle: (text) => createDemoRef.current?.typeTitle(text) ?? Promise.resolve(),
      typeDescription: (text) =>
        createDemoRef.current?.typeDescription(text) ?? Promise.resolve(),
      setEpicColor: (c) => createDemoRef.current?.setEpicColor(c) ?? Promise.resolve(),
      setPriority: (p) => createDemoRef.current?.setPriority(p) ?? Promise.resolve(),
      setAssigneeIndex: (i) =>
        createDemoRef.current?.setAssigneeIndex(i) ?? Promise.resolve(),
      setLabels: (l) => createDemoRef.current?.setLabels(l) ?? Promise.resolve(),
      setStartDate: (d) => createDemoRef.current?.setStartDate(d) ?? Promise.resolve(),
      setDueDate: (d) => createDemoRef.current?.setDueDate(d) ?? Promise.resolve(),
      setStoryPoints: (v) => createDemoRef.current?.setStoryPoints(v) ?? Promise.resolve(),
      simulateCreate: () => createDemoRef.current?.simulateCreate() ?? Promise.resolve(),
      isCreateReady: () => Boolean(createDemoRef.current && createOpen),
    };
    return () => {
      tourApiRef.current = null;
    };
  }, [tourApiRef, createOpen]);

  const epics = issues.filter((i) => i.type === "epic");
  const byId = useMemo(() => new Map(issues.map((i) => [i.id, i])), [issues]);
  const openSprints = sprints.filter((s) => s.status !== "completed");
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  function sectionKey(sprintId: number | null) {
    return sprintId == null ? "backlog" : `sprint-${sprintId}`;
  }

  function issuesIn(sprintId: number | null) {
    return issues.filter((i) => i.type !== "epic" && (i.sprint_id ?? null) === sprintId);
  }

  function epicChildren(epicId: number) {
    return issues.filter((i) => i.type !== "epic" && i.parent_id === epicId);
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

  const activeIssue = activeId?.startsWith("issue-")
    ? issues.find((i) => i.id === Number(activeId.replace("issue-", "")))
    : null;

  return (
    <>
      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={(e) => setActiveId(String(e.active.id))}
        onDragEnd={handleDragEnd}
      >
        <div className="space-y-4">
          <section className="overflow-hidden rounded-xl border border-gray-200 bg-white">
            <button
              type="button"
              onClick={() => setCollapsed((c) => ({ ...c, epics: !c.epics }))}
              className="flex w-full items-center gap-2 border-b border-gray-100 px-4 py-3 text-left"
            >
              {collapsed.epics ? (
                <ChevronRight className="h-4 w-4" />
              ) : (
                <ChevronDown className="h-4 w-4" />
              )}
              <span className="text-sm font-semibold text-gray-900">Epics</span>
              <span className="text-xs text-gray-400">{epics.length}</span>
            </button>
            {!collapsed.epics ? (
              <div>
                {epics.length === 0 ? (
                  <EmptyState>No epics yet</EmptyState>
                ) : (
                  epics.map((epic) => {
                    const total = epic.child_count || 0;
                    const done = epic.child_done_count || 0;
                    const pct = total ? Math.round((done / total) * 100) : 0;
                    const color = epic.epic_color || "#6366F1";
                    const open = expandedEpics[epic.id] ?? false;
                    const children = epicChildren(epic.id);
                    return (
                      <div key={epic.id} className="border-b border-gray-100 last:border-0">
                        <div
                          className="group flex items-center gap-2 px-3 py-3 hover:bg-primary/[0.03]"
                          style={{ borderLeft: `4px solid ${color}` }}
                        >
                          <button
                            type="button"
                            onClick={() =>
                              setExpandedEpics((e) => ({ ...e, [epic.id]: !open }))
                            }
                            className="rounded p-0.5 text-gray-400 hover:bg-gray-100"
                          >
                            {open ? (
                              <ChevronDown className="h-4 w-4" />
                            ) : (
                              <ChevronRight className="h-4 w-4" />
                            )}
                          </button>
                          <button
                            type="button"
                            onClick={() => onOpen(epic.id)}
                            className="flex min-w-0 flex-1 items-center gap-2.5 text-left"
                          >
                            <TypeIcon type="epic" />
                            <span className="font-mono text-xs text-gray-400">{epic.key}</span>
                            <span className="min-w-0 flex-1 truncate text-sm font-semibold text-gray-900">
                              {epic.title}
                            </span>
                            <span className="shrink-0 text-xs tabular-nums text-gray-500">
                              {done}/{total} done
                            </span>
                            <span className="h-2 w-24 overflow-hidden rounded-full bg-gray-100">
                              <span
                                className="block h-full rounded-full transition-all"
                                style={{ width: `${pct}%`, backgroundColor: color }}
                              />
                            </span>
                          </button>
                          <button
                            type="button"
                            title="Delete epic"
                            className="rounded-md p-1.5 text-gray-300 opacity-0 transition hover:bg-rose-50 hover:text-rose-600 group-hover:opacity-100 focus:opacity-100"
                            onClick={(e) => {
                              e.stopPropagation();
                              setDeleteTarget(epic);
                            }}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                        {open ? (
                          <div className="bg-gray-50/50 pb-1 pl-6">
                            {children.length === 0 ? (
                              <p className="px-4 py-3 text-xs text-gray-400">No child issues yet</p>
                            ) : (
                              children.map((child) => (
                                <div
                                  key={child.id}
                                  className="group flex w-full items-center gap-2 border-t border-gray-100 px-4 py-2.5 text-sm hover:bg-white"
                                >
                                  <button
                                    type="button"
                                    onClick={() => onOpen(child.id)}
                                    className="flex min-w-0 flex-1 items-center gap-2 text-left"
                                  >
                                    <TypeIcon type={child.type} />
                                    <span className="font-mono text-xs text-gray-400">
                                      {child.key}
                                    </span>
                                    <span className="min-w-0 flex-1 truncate">{child.title}</span>
                                    <Badge variant={priorityVariant(child.priority)}>
                                      {child.priority}
                                    </Badge>
                                  </button>
                                  <button
                                    type="button"
                                    title="Delete"
                                    className="rounded-md p-1.5 text-gray-300 opacity-0 transition hover:bg-rose-50 hover:text-rose-600 group-hover:opacity-100 focus:opacity-100"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setDeleteTarget(child);
                                    }}
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </button>
                                </div>
                              ))
                            )}
                            <CreateIssueTrigger
                              label="Create child issue…"
                              onClick={() =>
                                openCreate({
                                  sprintId: null,
                                  type: "story",
                                  parentId: epic.id,
                                })
                              }
                            />
                          </div>
                        ) : null}
                      </div>
                    );
                  })
                )}
                <CreateIssueTrigger
                  label="Create epic…"
                  tourId="issues-epics-create"
                  onClick={() => openCreate({ sprintId: null, type: "epic" })}
                />
              </div>
            ) : null}
          </section>

          <div className="flex justify-end">
            <Button
              size="sm"
              variant="outline"
              data-tour="issues-new-sprint"
              onClick={() => createSprint.mutate()}
              disabled={createSprint.isPending}
            >
              <Plus className="mr-1 h-3.5 w-3.5" />
              New sprint
            </Button>
          </div>

          {openSprints.length === 0 ? (
            <div
              data-tour="issues-sprint-section"
              className="rounded-xl border border-dashed border-gray-200 bg-gray-50/80 px-4 py-6 text-center text-sm text-gray-400"
            >
              No sprints yet — create one above, then drag issues into it
            </div>
          ) : null}

          {openSprints.map((sprint, sprintIndex) => {
            const key = sectionKey(sprint.id);
            const list = issuesIn(sprint.id);
            return (
              <section
                key={sprint.id}
                data-tour={sprintIndex === 0 ? "issues-sprint-section" : undefined}
                className="overflow-hidden rounded-xl border border-gray-200 bg-white"
              >                <SprintHeader
                  sprint={sprint}
                  projectId={projectId}
                  issueCount={list.length}
                  collapsed={Boolean(collapsed[key])}
                  onToggle={() => setCollapsed((c) => ({ ...c, [key]: !c[key] }))}
                  onRefresh={onRefresh}
                />
                {!collapsed[key] ? (
                  <div>
                    <SortableContext
                      items={list.map((i) => `issue-${i.id}`)}
                      strategy={verticalListSortingStrategy}
                    >
                      {list.length === 0 ? (
                        <EmptyState>Empty sprint — drag issues here</EmptyState>
                      ) : (
                        list.map((issue) => (
                          <SortableIssueRow
                            key={issue.id}
                            issue={issue}
                            onOpen={onOpen}
                            epic={resolveEpic(issue, byId)}
                            onDelete={setDeleteTarget}
                          />
                        ))
                      )}
                    </SortableContext>
                    <CreateIssueTrigger
                      onClick={() => openCreate({ sprintId: sprint.id, type: "task" })}
                    />
                  </div>
                ) : null}
              </section>
            );
          })}

          <section className="overflow-hidden rounded-xl border border-gray-200 bg-white">
            <button
              type="button"
              onClick={() => setCollapsed((c) => ({ ...c, backlog: !c.backlog }))}
              className="flex w-full items-center gap-2 border-b border-gray-100 px-4 py-3 text-left"
            >
              {collapsed.backlog ? (
                <ChevronRight className="h-4 w-4" />
              ) : (
                <ChevronDown className="h-4 w-4" />
              )}
              <LayoutList className="h-4 w-4 text-gray-400" />
              <span className="text-sm font-semibold text-gray-900">Backlog</span>
              <span className="text-xs text-gray-400">{issuesIn(null).length}</span>
            </button>
            {!collapsed.backlog ? (
              <div>
                <SortableContext
                  items={issuesIn(null).map((i) => `issue-${i.id}`)}
                  strategy={verticalListSortingStrategy}
                >
                  {issuesIn(null).length === 0 ? (
                    <EmptyState>Backlog is empty</EmptyState>
                  ) : (
                    issuesIn(null).map((issue) => (
                      <SortableIssueRow
                        key={issue.id}
                        issue={issue}
                        onOpen={onOpen}
                        epic={resolveEpic(issue, byId)}
                        onDelete={setDeleteTarget}
                      />
                    ))
                  )}
                </SortableContext>
                <CreateIssueTrigger
                  onClick={() => openCreate({ sprintId: null, type: "task" })}
                />
              </div>
            ) : null}
          </section>
        </div>
        <DragOverlay>
          {activeIssue ? (
            <div className="rounded border border-primary/30 bg-white px-3 py-2 text-sm shadow-lg">
              <span className="font-mono text-xs text-gray-400">{activeIssue.key}</span>{" "}
              {activeIssue.title}
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>

      <CreateIssueDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        projectId={projectId}
        members={members}
        sprints={sprints}
        epics={epics}
        defaults={createDefaults}
        onCreated={onRefresh}
        nonModal={tourActive}
        tourDemoRef={createDemoRef}
      />
      <DeleteIssueDialog
        issue={deleteTarget}
        projectId={projectId}
        onClose={() => setDeleteTarget(null)}
        onDeleted={onRefresh}
      />
    </>
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
        "cursor-pointer rounded-lg border border-gray-200 bg-white p-2.5 shadow-sm hover:bg-primary/[0.02]",
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
            <span
              key={label}
              className="rounded bg-primary/5 px-1.5 py-0.5 text-[10px] text-primary"
            >
              {label}
            </span>
          ))}
        </div>
        {issue.assignee_name ? (
          <UserAvatar name={issue.assignee_name} size="sm" />
        ) : (
          <span className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-dashed border-gray-300 text-gray-300">
            <Plus className="h-3 w-3" />
          </span>
        )}
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
      <EmptyState>
        No epics with dates yet. Set start/due dates on epics and stories to see the timeline.
      </EmptyState>
    );
  }

  const allDates = data.issues
    .flatMap((i) => {
      const childDates = i.children.flatMap((c) => [c.start_date, c.due_date]);
      return [i.start_date, i.due_date, ...childDates];
    })
    .filter(Boolean) as string[];

  const min = allDates.length
    ? new Date(Math.min(...allDates.map((d) => new Date(d).getTime())))
    : new Date();
  const max = allDates.length
    ? new Date(Math.max(...allDates.map((d) => new Date(d).getTime())))
    : new Date(min.getTime() + 30 * 86400000);
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
    sprintId === "backlog" ? null : (sprintId ?? activeSprint?.id ?? sprints[0]?.id ?? null);

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
              assigneeFilter == null
                ? "border-primary bg-primary/10 text-primary"
                : "border-gray-200 text-gray-500",
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
              className={cn(
                "rounded-full ring-offset-1",
                assigneeFilter === m.id ? "ring-2 ring-primary" : "",
              )}
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
                  <span className={cn("rounded px-2 py-0.5 text-xs font-semibold", col.className)}>
                    {col.label}
                  </span>
                  <span className="text-xs text-gray-400">{list.length}</span>
                </div>
                <SortableContext
                  items={list.map((i) => `issue-${i.id}`)}
                  strategy={verticalListSortingStrategy}
                >
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

export function ProjectIssuesPanel({
  projectId,
  members = [],
}: {
  projectId: number;
  members?: ProjectMember[];
}) {
  const { user } = useAuth();
  const [view, setView] = useState<"backlog" | "board" | "timeline">("backlog");
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [helpOpen, setHelpOpen] = useState(false);
  const [tourRun, setTourRun] = useState(false);
  const [tourSeeded, setTourSeeded] = useState(false);
  const tourApiRef = useRef<IssuesTourApi | null>(null);
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
    if (selectedId != null) {
      queryClient.invalidateQueries({ queryKey: ["issue", projectId, selectedId] });
    }
  }

  // Auto-start walkthrough once per user (DB flag). Wait until server has populated the field.
  useEffect(() => {
    if (tourSeeded) return;
    if (issuesQuery.isLoading || sprintsQuery.isLoading) return;
    if (!user || user.has_seen_issues_tour === undefined) return;
    setTourSeeded(true);
    if (!user.has_seen_issues_tour) {
      setView("backlog");
      setTourRun(true);
    }
  }, [user, issuesQuery.isLoading, sprintsQuery.isLoading, tourSeeded]);

  const issues = issuesQuery.data ?? [];
  const sprints = sprintsQuery.data ?? [];
  const epics = issues.filter((i) => i.type === "epic");
  const views = [
    { id: "backlog" as const, label: "Backlog", tourId: "issues-view-backlog" },
    { id: "board" as const, label: "Board", tourId: "issues-view-board" },
    { id: "timeline" as const, label: "Timeline", tourId: "issues-view-timeline" },
  ];

  function startTour() {
    setHelpOpen(false);
    setSelectedId(null);
    setView("backlog");
    setTourRun(false);
    window.setTimeout(() => setTourRun(true), 80);
  }

  // Compose tour API: view switching lives here; create dialog lives in BacklogView
  const composedTourApiRef = useRef<IssuesTourApi | null>(null);
  composedTourApiRef.current = {
    goBacklog: () => {
      setView("backlog");
      tourApiRef.current?.goBacklog();
    },
    openCreateEpic: () => {
      setView("backlog");
      return new Promise<void>((resolve) => {
        window.setTimeout(() => {
          void Promise.resolve(tourApiRef.current?.openCreateEpic()).then(() => resolve());
        }, view === "backlog" ? 0 : 80);
      });
    },
    openCreateStory: () => {
      setView("backlog");
      return new Promise<void>((resolve) => {
        window.setTimeout(() => {
          void Promise.resolve(tourApiRef.current?.openCreateStory()).then(() => resolve());
        }, view === "backlog" ? 0 : 80);
      });
    },
    closeCreate: () => {
      tourApiRef.current?.closeCreate();
    },
    selectType: (t) => tourApiRef.current?.selectType?.(t) ?? Promise.resolve(),
    typeTitle: (text) => tourApiRef.current?.typeTitle?.(text) ?? Promise.resolve(),
    typeDescription: (text) =>
      tourApiRef.current?.typeDescription?.(text) ?? Promise.resolve(),
    setEpicColor: (c) => tourApiRef.current?.setEpicColor?.(c) ?? Promise.resolve(),
    setPriority: (p) => tourApiRef.current?.setPriority?.(p) ?? Promise.resolve(),
    setAssigneeIndex: (i) =>
      tourApiRef.current?.setAssigneeIndex?.(i) ?? Promise.resolve(),
    setLabels: (l) => tourApiRef.current?.setLabels?.(l) ?? Promise.resolve(),
    setStartDate: (d) => tourApiRef.current?.setStartDate?.(d) ?? Promise.resolve(),
    setDueDate: (d) => tourApiRef.current?.setDueDate?.(d) ?? Promise.resolve(),
    setStoryPoints: (v) => tourApiRef.current?.setStoryPoints?.(v) ?? Promise.resolve(),
    simulateCreate: () => tourApiRef.current?.simulateCreate?.() ?? Promise.resolve(),
    isCreateReady: () => Boolean(tourApiRef.current?.isCreateReady?.()),
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex rounded-lg border border-gray-200 bg-gray-50 p-0.5">
          {views.map((item) => (
            <button
              key={item.id}
              type="button"
              data-tour={item.tourId}
              onClick={() => setView(item.id)}
              className={cn(
                "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                view === item.id
                  ? "bg-white text-primary shadow-sm"
                  : "text-gray-500 hover:text-gray-800",
              )}
            >
              {item.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-3">
          <p className="text-xs text-gray-400">
            {issues.length} issues ·{" "}
            {sprints.filter((s) => s.status === "active").length
              ? "1 active sprint"
              : "No active sprint"}
          </p>
          <IssuesHelpButton onClick={() => setHelpOpen(true)} />
        </div>
      </div>

      {issuesQuery.isLoading || sprintsQuery.isLoading ? (
        <p className="py-8 text-center text-sm text-gray-400">Loading issues…</p>
      ) : view === "backlog" ? (
        <BacklogView
          projectId={projectId}
          issues={issues}
          sprints={sprints}
          members={members}
          onOpen={setSelectedId}
          onRefresh={refresh}
          tourApiRef={tourApiRef}
          tourActive={tourRun}
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
          epics={epics}
          onClose={() => setSelectedId(null)}
          onChanged={refresh}
          onDeleted={() => {
            setSelectedId(null);
            refresh();
          }}
        />
      ) : null}

      <IssuesHelpSheet
        open={helpOpen}
        onClose={() => setHelpOpen(false)}
        onReplayTour={startTour}
      />

      <IssuesWalkthrough
        run={tourRun}
        onRunChange={setTourRun}
        tourApiRef={composedTourApiRef}
      />
    </div>
  );
}

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ChevronDown,
  Clock,
  Download,
  FileText,
  History,
  MessageSquare,
  Paperclip,
  Save,
  Upload,
} from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { toast } from "sonner";

import { ChatAttachmentPreview, isInlineAttachmentPreview } from "./chat-attachment-preview";
import { ConversationReplyBox } from "./conversation-reply-box";
import { FormatChatMessage } from "./format-chat-message";
import { FormattedTextarea } from "./formatted-textarea";
import { Button } from "./ui/button";
import { api } from "../lib/api";
import { useAuth } from "../store/auth";
import { cn } from "@/utils/cn";

export const TICKET_ISSUE_TYPES = [
  { value: "application_crash", label: "Application crashes" },
  { value: "service_interruption", label: "Service interruptions" },
  { value: "el_image_retrieval_failure", label: "EL image retrieval failures" },
  { value: "slow_image_loading", label: "Slow image loading" },
  { value: "database_issue", label: "Database issues" },
  { value: "integration_issue", label: "Integration issues" },
  { value: "access_functional_issue", label: "Access and functional issues" },
  { value: "authentication_authorization_issue", label: "Authentication and Authorization issues" },
  { value: "ui_functionality_error", label: "UI functionality errors" },
  { value: "data_corruption", label: "Data corruption" },
  { value: "db_indexing_problem", label: "DB indexing problems" },
  { value: "file_storage_issue", label: "File Storage issues" },
  { value: "network_related_issue", label: "Network related issues" },
] as const;

export type TicketIssueType = (typeof TICKET_ISSUE_TYPES)[number]["value"];

export type MaintenanceTicket = {
  id: number;
  ticket_number: string | null;
  project_id: number;
  category: string;
  issue_type: TicketIssueType | null;
  priority: "P1" | "P2" | "P3";
  status: "open" | "in_progress" | "in_review" | "resolved" | "closed";
  title: string;
  description: string;
  details: string | null;
  source: "email" | "manual";
  reported_on: string | null;
  assignee_id: number | null;
  raised_by: number;
  resolution_summary: string | null;
  resolution_root_cause: string | null;
  resolution_steps: string | null;
  created_at: string;
  resolved_at: string | null;
  closed_at: string | null;
};

type TicketComment = {
  id: number;
  author_id: number;
  author_name?: string | null;
  comment: string;
  created_at: string;
};

type TicketAttachment = {
  id: number;
  filename: string;
  content_type?: string | null;
  size_bytes?: number | null;
  uploaded_by: number;
  uploader_name?: string | null;
  created_at: string;
};

type TicketHistoryEntry = {
  id: number;
  actor_id: number | null;
  actor_name?: string | null;
  action: string;
  detail: string | null;
  created_at: string;
};

const STATUS_OPTIONS = [
  { value: "open", label: "Open" },
  { value: "in_progress", label: "In progress" },
  { value: "in_review", label: "In review" },
  { value: "resolved", label: "Resolved" },
  { value: "closed", label: "Closed" },
] as const;

function formatLabel(value: string) {
  return value.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatDateTime(value?: string | null) {
  if (!value) return "—";
  return new Date(value).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function issueTypeLabel(value?: string | null) {
  const match = TICKET_ISSUE_TYPES.find((item) => item.value === value);
  return match?.label ?? formatLabel(value ?? "other");
}

function priorityStyles(priority: MaintenanceTicket["priority"]) {
  if (priority === "P1") return "bg-rose-50 text-rose-700 ring-rose-200/60";
  if (priority === "P2") return "bg-amber-50 text-amber-700 ring-amber-200/60";
  return "bg-sky-50 text-sky-700 ring-sky-200/60";
}

function statusStyles(status: MaintenanceTicket["status"]) {
  if (status === "open") return "bg-emerald-50 text-emerald-700";
  if (status === "in_progress") return "bg-sky-50 text-sky-700";
  if (status === "in_review") return "bg-violet-50 text-violet-700";
  if (status === "resolved") return "bg-teal-50 text-teal-700";
  return "bg-slate-100 text-slate-600";
}

function historyActionLabel(action: string) {
  return formatLabel(action);
}

function initialsFromName(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

function UserAvatar({
  name,
  tone = "indigo",
  size = "md",
}: {
  name: string;
  tone?: "indigo" | "sky" | "amber";
  size?: "sm" | "md";
}) {
  const tones = {
    indigo: "from-indigo-100 to-violet-100 text-indigo-700",
    sky: "from-sky-100 to-cyan-100 text-sky-700",
    amber: "from-amber-100 to-orange-100 text-amber-800",
  };
  return (
    <div
      className={cn(
        "flex shrink-0 items-center justify-center rounded-full bg-gradient-to-br font-bold ring-2 ring-white shadow-sm",
        size === "sm" ? "size-7 text-[10px]" : "size-10 text-xs",
        tones[tone],
      )}
    >
      {initialsFromName(name)}
    </div>
  );
}

function ChatBubble({
  isMine,
  name,
  time,
  children,
  variant = "default",
  media = false,
}: {
  isMine: boolean;
  name: string;
  time: string;
  children: ReactNode;
  variant?: "default" | "report" | "internal";
  media?: boolean;
}) {
  const tone = variant === "report" ? "amber" : isMine ? "sky" : "indigo";

  return (
    <div className={cn("flex items-end gap-1.5", isMine ? "flex-row-reverse" : "flex-row")}>
      <UserAvatar name={name} tone={tone} size="sm" />
      <div
        className={cn(
          media ? "max-w-[min(92%,22rem)]" : "max-w-[min(82%,18rem)]",
          isMine ? "text-right" : "text-left",
        )}
      >
        <div
          className={cn(
            "mb-0.5 flex items-center gap-1.5",
            isMine ? "justify-end" : "justify-start",
          )}
        >
          <span className="text-[11px] font-semibold text-gray-800">{name}</span>
          <span className="text-[10px] text-gray-400">{time}</span>
        </div>
        <div
          className={cn(
            media
              ? "overflow-hidden rounded-xl border border-gray-200 bg-white p-1 shadow-sm"
              : "whitespace-pre-wrap px-3 py-1.5 text-sm leading-snug",
            !media &&
              (variant === "internal"
                ? cn(
                    "rounded-2xl border border-violet-200 bg-violet-50 text-violet-900",
                    isMine ? "rounded-br-sm" : "rounded-bl-sm",
                  )
                : variant === "report"
                  ? "rounded-2xl rounded-bl-sm border border-amber-200 bg-amber-50 text-amber-950"
                  : isMine
                    ? "rounded-2xl rounded-br-sm border border-sky-100 bg-sky-50 text-gray-800"
                    : "rounded-2xl rounded-bl-sm border border-gray-200 bg-white text-gray-700"),
          )}
        >
          {children}
        </div>
      </div>
    </div>
  );
}

type TabKey = "conversation" | "resolution" | "attachments" | "history";

export function TicketDetailPanel({ ticketId }: { ticketId: number }) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [tab, setTab] = useState<TabKey>("conversation");
  const [comment, setComment] = useState("");
  const [conversationPosting, setConversationPosting] = useState(false);
  const [statusComment, setStatusComment] = useState("");
  const [resolution, setResolution] = useState({
    resolution_summary: "",
    resolution_root_cause: "",
    resolution_steps: "",
  });

  const ticketQuery = useQuery({
    queryKey: ["ticket", ticketId],
    queryFn: () => api.get<MaintenanceTicket>(`/tickets/${ticketId}`),
  });

  const commentsQuery = useQuery({
    queryKey: ["ticket-comments", ticketId],
    queryFn: () => api.get<TicketComment[]>(`/tickets/${ticketId}/comments`),
  });

  const attachmentsQuery = useQuery({
    queryKey: ["ticket-attachments", ticketId],
    queryFn: () => api.get<TicketAttachment[]>(`/tickets/${ticketId}/attachments`),
  });

  const historyQuery = useQuery({
    queryKey: ["ticket-history", ticketId],
    queryFn: () => api.get<TicketHistoryEntry[]>(`/tickets/${ticketId}/history`),
  });

  const ticket = ticketQuery.data;
  const isClosed = ticket?.status === "closed";
  const canDownloadReport = user?.role === "admin" || user?.role === "team_lead";

  useEffect(() => {
    if (ticket) {
      setResolution({
        resolution_summary: ticket.resolution_summary ?? "",
        resolution_root_cause: ticket.resolution_root_cause ?? "",
        resolution_steps: ticket.resolution_steps ?? "",
      });
    }
  }, [
    ticket?.id,
    ticket?.resolution_summary,
    ticket?.resolution_root_cause,
    ticket?.resolution_steps,
  ]);

  const invalidateTicket = async () => {
    await queryClient.invalidateQueries({ queryKey: ["ticket", ticketId] });
    await queryClient.invalidateQueries({ queryKey: ["tickets"] });
    await queryClient.invalidateQueries({ queryKey: ["ticket-history", ticketId] });
  };

  const statusMutation = useMutation({
    mutationFn: (status: MaintenanceTicket["status"]) =>
      api.put<MaintenanceTicket>(`/tickets/${ticketId}`, {
        status,
        status_comment: statusComment.trim() || undefined,
      }),
    onSuccess: async () => {
      setStatusComment("");
      await invalidateTicket();
      toast.success("Status updated");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const handleConversationPost = async (
    text: string,
    options: { internal: boolean; files: File[] },
  ) => {
    setConversationPosting(true);
    try {
      for (const file of options.files) {
        const form = new FormData();
        form.append("file", file);
        await api.postForm(`/tickets/${ticketId}/attachments`, form);
      }

      if (text) {
        const body = options.internal ? `[Internal] ${text}` : text;
        await api.post(`/tickets/${ticketId}/comments`, { comment: body });
      }

      setComment("");
      await queryClient.invalidateQueries({ queryKey: ["ticket-comments", ticketId] });
      await queryClient.invalidateQueries({ queryKey: ["ticket-attachments", ticketId] });
      await queryClient.invalidateQueries({ queryKey: ["ticket-history", ticketId] });

      if (options.files.length > 0) {
        toast.success(
          text
            ? "Reply posted with attachments"
            : `${options.files.length} attachment(s) uploaded`,
        );
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to post reply");
    } finally {
      setConversationPosting(false);
    }
  };

  const downloadAttachment = async (attachmentId: number, filename: string) => {
    try {
      const blob = await api.getBlob(`/tickets/${ticketId}/attachments/${attachmentId}/content`);
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = filename;
      anchor.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Download failed");
    }
  };

  const resolutionMutation = useMutation({
    mutationFn: () =>
      api.put<MaintenanceTicket>(`/tickets/${ticketId}/resolution`, resolution),
    onSuccess: async () => {
      await invalidateTicket();
      toast.success("Resolution saved");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const uploadMutation = useMutation({
    mutationFn: (file: File) => {
      const form = new FormData();
      form.append("file", file);
      return api.postForm<TicketAttachment>(`/tickets/${ticketId}/attachments`, form);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["ticket-attachments", ticketId] });
      await queryClient.invalidateQueries({ queryKey: ["ticket-history", ticketId] });
      toast.success("Attachment uploaded");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  if (ticketQuery.isLoading) {
    return (
      <div className="flex items-center justify-center rounded-xl border border-gray-200 bg-white py-20">
        <p className="text-sm text-gray-400">Loading ticket workspace…</p>
      </div>
    );
  }

  if (!ticket) {
    return (
      <div className="flex items-center justify-center rounded-xl border border-gray-200 bg-white py-20">
        <p className="text-sm text-gray-400">Ticket not found.</p>
      </div>
    );
  }

  const tabs: Array<{ key: TabKey; label: string; icon: typeof MessageSquare; count?: number }> = [
    { key: "conversation", label: "Conversation", icon: MessageSquare, count: commentsQuery.data?.length },
    { key: "resolution", label: "Resolution", icon: FileText },
    {
      key: "attachments",
      label: "Attachments",
      icon: Paperclip,
      count: attachmentsQuery.data?.length,
    },
    { key: "history", label: "History", icon: History, count: historyQuery.data?.length },
  ];

  return (
    <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
      {/* Ticket version bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-200 bg-slate-50/90 px-5 py-3">
        <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-500">
          Ticket #{ticket.ticket_number ?? ticket.id}
        </span>
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex h-9 items-center rounded-lg bg-white px-2.5 text-[11px] font-semibold text-slate-500 ring-1 ring-gray-200">
            V1
          </span>
          <div className="relative">
            <select
              value={ticket.status}
              disabled={statusMutation.isPending}
              onChange={(event) =>
                statusMutation.mutate(event.target.value as MaintenanceTicket["status"])
              }
              className={cn(
                "h-9 min-w-[9.5rem] appearance-none rounded-lg border border-gray-200 bg-white pl-3 pr-8 text-sm font-medium leading-normal text-gray-800 outline-none focus:border-primary focus:ring-2 focus:ring-primary/15 disabled:opacity-60",
                statusStyles(ticket.status),
              )}
            >
              {STATUS_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
            <ChevronDown
              className="pointer-events-none absolute right-2.5 top-1/2 size-4 -translate-y-1/2 text-gray-500"
              aria-hidden
            />
          </div>
          {canDownloadReport ? (
            <button
              type="button"
              onClick={() =>
                void api
                  .getBlob(`/tickets/${ticketId}/issue-report`)
                  .then((blob) => {
                    const url = URL.createObjectURL(blob);
                    const anchor = document.createElement("a");
                    anchor.href = url;
                    anchor.download = `ticket-${ticket.ticket_number ?? ticket.id}-report.txt`;
                    anchor.click();
                    URL.revokeObjectURL(url);
                  })
                  .catch((error: Error) => toast.error(error.message))
              }
              className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 text-xs font-medium text-gray-700 transition hover:bg-gray-50"
            >
              <Download className="size-3.5 text-sky-600" />
              Issue report
            </button>
          ) : null}
        </div>
      </div>

      {/* Title + meta */}
      <div className="border-b border-gray-100 px-5 py-4">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <h2 className="text-xl font-semibold tracking-tight text-gray-900">{ticket.title}</h2>
            <p className="mt-1 text-sm text-gray-500">{issueTypeLabel(ticket.issue_type)}</p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <span
              className={cn(
                "inline-flex h-8 items-center rounded-full px-2.5 text-xs font-bold ring-1",
                priorityStyles(ticket.priority),
              )}
            >
              {ticket.priority}
            </span>
            <span className="inline-flex h-8 items-center rounded-full bg-gray-100 px-2.5 text-xs font-medium text-gray-600">
              {formatLabel(ticket.source)}
            </span>
          </div>
        </div>
      </div>

      {/* 25 / 75 — details+status | tabs */}
      <div className="flex min-h-[420px] flex-col lg:flex-row">
        <aside className="w-full shrink-0 border-b border-gray-200 bg-slate-50/50 p-4 lg:w-[25%] lg:border-b-0 lg:border-r">
          <p className="mb-3 text-[10px] font-bold uppercase tracking-wider text-gray-400">
            Details
          </p>
          <div className="space-y-2.5">
            <div className="rounded-lg border border-gray-100 bg-white px-3 py-2.5">
              <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Reported on</p>
              <p className="mt-0.5 text-sm font-medium text-gray-800">
                {formatDateTime(ticket.reported_on ?? ticket.created_at)}
              </p>
            </div>
            <div className="rounded-lg border border-gray-100 bg-white px-3 py-2.5">
              <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Opened</p>
              <p className="mt-0.5 text-sm font-medium text-gray-800">
                {formatDateTime(ticket.created_at)}
              </p>
            </div>
            <div className="rounded-lg border border-gray-100 bg-white px-3 py-2.5">
              <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Ticket ID</p>
              <p className="mt-0.5 font-mono text-sm font-medium text-gray-800">
                {ticket.ticket_number ?? ticket.id}
              </p>
            </div>
          </div>

          <div className="mt-5">
            <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-gray-400">
              Status change
            </p>
            <textarea
              rows={4}
              value={statusComment}
              onChange={(event) => setStatusComment(event.target.value)}
              placeholder="Add a note when changing status (optional)…"
              className="w-full resize-y rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-800 outline-none placeholder:text-gray-400 focus:border-primary focus:ring-2 focus:ring-primary/15"
            />
            <p className="mt-1.5 text-[11px] text-gray-400">
              Used when you update status from the header dropdown.
            </p>
          </div>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col lg:w-[75%]">
          <div className="border-b border-gray-200 bg-white px-4">
            <div className="flex flex-wrap gap-4">
              {tabs.map((item) => (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => setTab(item.key)}
                  className={cn(
                    "relative inline-flex items-center gap-2 py-3 text-sm font-medium transition",
                    tab === item.key ? "text-primary" : "text-gray-500 hover:text-gray-800",
                  )}
                >
                  <item.icon className="size-4" />
                  {item.label}
                  {item.count != null && item.count > 0 ? (
                    <span className="rounded-full bg-gray-100 px-1.5 py-0.5 text-[10px] font-semibold text-gray-600">
                      {item.count}
                    </span>
                  ) : null}
                  {tab === item.key ? (
                    <span className="absolute bottom-0 left-0 h-0.5 w-full rounded-full bg-primary" />
                  ) : null}
                </button>
              ))}
            </div>
          </div>

          <div className="min-h-[360px] flex-1 bg-slate-50/30 p-3">
        {tab === "conversation" ? (
          <div className="space-y-2">
            <ChatBubble
              isMine={false}
              name="Original report"
              time={formatDateTime(ticket.reported_on ?? ticket.created_at)}
              variant="report"
            >
              <FormatChatMessage text={ticket.description} />
              {ticket.details ? (
                <p className="mt-1 border-t border-amber-200/60 pt-1 text-amber-900/80">
                  <FormatChatMessage text={ticket.details} />
                </p>
              ) : null}
            </ChatBubble>

            {[
              ...(commentsQuery.data ?? []).map((item) => ({
                kind: "comment" as const,
                at: item.created_at,
                item,
              })),
              ...(attachmentsQuery.data ?? []).map((item) => ({
                kind: "attachment" as const,
                at: item.created_at,
                item,
              })),
            ]
              .sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime())
              .map((entry) => {
                if (entry.kind === "comment") {
                  const item = entry.item;
                  const isMine = item.author_id === user?.id;
                  const isInternal = item.comment.startsWith("[Internal]");
                  const body = isInternal
                    ? item.comment.replace(/^\[Internal\]\s*/, "")
                    : item.comment;

                  return (
                    <ChatBubble
                      key={`comment-${item.id}`}
                      isMine={isMine}
                      name={item.author_name ?? `User #${item.author_id}`}
                      time={formatDateTime(item.created_at)}
                      variant={isInternal ? "internal" : "default"}
                    >
                      <FormatChatMessage text={body} />
                    </ChatBubble>
                  );
                }

                const item = entry.item;
                const isMine = item.uploaded_by === user?.id;
                const inlinePreview = isInlineAttachmentPreview(item.content_type, item.filename);

                return (
                  <ChatBubble
                    key={`attachment-${item.id}`}
                    isMine={isMine}
                    name={item.uploader_name ?? `User #${item.uploaded_by}`}
                    time={formatDateTime(item.created_at)}
                    media={inlinePreview}
                  >
                    <ChatAttachmentPreview
                      ticketId={ticketId}
                      attachmentId={item.id}
                      filename={item.filename}
                      contentType={item.content_type}
                      onDownload={() => downloadAttachment(item.id, item.filename)}
                    />
                  </ChatBubble>
                );
              })}

            <div className="pt-1">
              <ConversationReplyBox
                value={comment}
                onChange={setComment}
                disabled={isClosed}
                posting={conversationPosting}
                onPost={(text, options) => handleConversationPost(text, options)}
              />
            </div>
          </div>
        ) : null}

        {tab === "resolution" ? (
          <div className="space-y-4">
            {isClosed ? (
              <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                This ticket is closed. Resolution fields are read-only and cannot be saved.
              </div>
            ) : null}
            {[
              { key: "resolution_summary" as const, label: "Summary", rows: 4 },
              { key: "resolution_root_cause" as const, label: "Root cause", rows: 5 },
              { key: "resolution_steps" as const, label: "Steps taken", rows: 5 },
            ].map((field) => (
              <div
                key={field.key}
                className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm"
              >
                <label className="mb-2 block text-sm font-semibold text-gray-900">
                  {field.label}
                </label>
                <FormattedTextarea
                  rows={field.rows}
                  disabled={isClosed}
                  value={resolution[field.key]}
                  onChange={(next) =>
                    setResolution((current) => ({
                      ...current,
                      [field.key]: next,
                    }))
                  }
                  placeholder={`Enter ${field.label.toLowerCase()}…`}
                />
              </div>
            ))}
            <div className="flex justify-end">
              <Button
                size="sm"
                className="gap-1.5"
                disabled={isClosed || resolutionMutation.isPending}
                onClick={() => resolutionMutation.mutate()}
              >
                <Save className="size-4" />
                {resolutionMutation.isPending ? "Saving…" : "Save resolution"}
              </Button>
            </div>
          </div>
        ) : null}

        {tab === "attachments" ? (
          <div className="space-y-3">
            <div className="flex justify-end">
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) uploadMutation.mutate(file);
                  event.target.value = "";
                }}
              />
              <Button
                size="sm"
                variant="outline"
                className="gap-1.5"
                disabled={uploadMutation.isPending}
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload className="size-4" />
                Upload attachment
              </Button>
            </div>
            {(attachmentsQuery.data ?? []).map((item) => (
              <div
                key={item.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-gray-200 bg-white px-4 py-3 shadow-sm"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="flex size-9 items-center justify-center rounded-lg bg-violet-50 text-violet-600">
                    <Paperclip className="size-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-gray-900">{item.filename}</p>
                    <p className="text-xs text-gray-400">
                      {item.uploader_name ?? `User #${item.uploaded_by}`} ·{" "}
                      {formatDateTime(item.created_at)}
                      {item.size_bytes ? ` · ${(item.size_bytes / 1024).toFixed(1)} KB` : ""}
                    </p>
                  </div>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-1.5 shrink-0"
                  onClick={() =>
                    void api
                      .getBlob(`/tickets/${ticketId}/attachments/${item.id}/content`)
                      .then((blob) => {
                        const url = URL.createObjectURL(blob);
                        const anchor = document.createElement("a");
                        anchor.href = url;
                        anchor.download = item.filename;
                        anchor.click();
                        URL.revokeObjectURL(url);
                      })
                      .catch((error: Error) => toast.error(error.message))
                  }
                >
                  <Download className="size-4" />
                  Download
                </Button>
              </div>
            ))}
            {attachmentsQuery.data?.length === 0 ? (
              <p className="py-8 text-center text-sm text-gray-400">No attachments yet.</p>
            ) : null}
          </div>
        ) : null}

        {tab === "history" ? (
          <div>
            <div className="relative space-y-0">
              {(historyQuery.data ?? []).map((item, index) => (
                <div key={item.id} className="relative flex gap-4 pb-6">
                  {index < (historyQuery.data?.length ?? 0) - 1 ? (
                    <span
                      className="absolute left-5 top-10 bottom-0 w-px bg-gradient-to-b from-sky-200 to-transparent"
                    />
                  ) : null}
                  <UserAvatar
                    name={item.actor_name ?? "System"}
                    tone={item.action.includes("status") ? "amber" : "sky"}
                  />
                  <div className="min-w-0 flex-1 rounded-xl border border-gray-200 bg-white px-4 py-3 shadow-sm">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-sm font-semibold text-gray-900">
                        {historyActionLabel(item.action)}
                      </p>
                      <p className="flex items-center gap-1 text-xs text-gray-400">
                        <Clock className="size-3" />
                        {formatDateTime(item.created_at)}
                      </p>
                    </div>
                    <p className="mt-0.5 text-xs font-medium text-gray-500">
                      {item.actor_name ?? "System"}
                    </p>
                    {item.detail ? (
                      <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-gray-600">
                        {item.detail}
                      </p>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
            {historyQuery.data?.length === 0 ? (
              <p className="py-8 text-center text-sm text-gray-400">No history yet.</p>
            ) : null}
          </div>
        ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}

export function issueTypeLabelFromValue(value?: string | null) {
  return issueTypeLabel(value);
}

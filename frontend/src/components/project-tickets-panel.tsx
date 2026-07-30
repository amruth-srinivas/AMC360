import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertCircle,
  Calendar,
  Mail,
  PenLine,
  Plus,
  X,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Link } from "react-router-dom";

import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import {
  TICKET_ISSUE_TYPES,
  TicketDetailPanel,
  issueTypeLabelFromValue,
  type MaintenanceTicket,
  type TicketIssueType,
} from "./ticket-detail-panel";
import {
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableHeaderCell,
  TableHeaderRow,
  TableRow,
} from "./ui/table";
import { api } from "../lib/api";
import { formatDate } from "../lib/utils";
import { cn } from "@/utils/cn";

type RaiseTicketDraft = {
  issue_type: TicketIssueType;
  priority: "P1" | "P2" | "P3";
  source: "email" | "manual";
  title: string;
  description: string;
  details: string;
  reported_on: string;
};

function emptyDraft(): RaiseTicketDraft {
  return {
    issue_type: "application_crash",
    priority: "P2",
    source: "manual",
    title: "",
    description: "",
    details: "",
    reported_on: "",
  };
}

function priorityVariant(priority: MaintenanceTicket["priority"]) {
  if (priority === "P1") return "danger" as const;
  if (priority === "P2") return "warning" as const;
  return "neutral" as const;
}

function ticketStatusVariant(status: MaintenanceTicket["status"]) {
  if (status === "open") return "danger" as const;
  if (status === "in_progress") return "info" as const;
  if (status === "in_review") return "warning" as const;
  if (status === "resolved") return "success" as const;
  return "neutral" as const;
}

const inputClass =
  "h-10 w-full rounded-lg border border-gray-200 bg-white px-3 text-sm text-gray-900 outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20";

const textareaClass =
  "w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-900 outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20";

export function ProjectTicketsPanel({ projectId }: { projectId: number }) {
  const queryClient = useQueryClient();
  const [createMode, setCreateMode] = useState(false);
  const [draft, setDraft] = useState<RaiseTicketDraft>(emptyDraft);
  const [selectedTicketId, setSelectedTicketId] = useState<number | null>(null);

  const ticketsQuery = useQuery({
    queryKey: ["tickets", projectId],
    queryFn: () => api.get<MaintenanceTicket[]>(`/tickets?project_id=${projectId}`),
  });

  const createMutation = useMutation({
    mutationFn: () =>
      api.post<MaintenanceTicket>("/tickets", {
        project_id: projectId,
        category: "incident",
        issue_type: draft.issue_type,
        priority: draft.priority,
        source: draft.source,
        title: draft.title.trim(),
        description: draft.description.trim(),
        details: draft.details.trim() || undefined,
        reported_on: draft.reported_on
          ? new Date(draft.reported_on).toISOString()
          : undefined,
      }),
    onSuccess: async (ticket) => {
      await queryClient.invalidateQueries({ queryKey: ["tickets"] });
      await queryClient.invalidateQueries({ queryKey: ["tickets", projectId] });
      setCreateMode(false);
      setDraft(emptyDraft());
      setSelectedTicketId(ticket.id);
      toast.success(`Ticket #${ticket.ticket_number ?? ticket.id} raised`);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const tickets = ticketsQuery.data ?? [];
  const canSubmit =
    draft.title.trim().length >= 2 && draft.description.trim().length >= 2 && !createMutation.isPending;

  function openCreate() {
    setDraft(emptyDraft());
    setCreateMode(true);
  }

  if (selectedTicketId) {
    return (
      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2 px-1">
          <button
            type="button"
            onClick={() => setSelectedTicketId(null)}
            className="text-sm font-medium text-gray-600 transition hover:text-primary"
          >
            ← Back to ticket list
          </button>
          <Link
            to={`/tickets/${selectedTicketId}`}
            className="text-xs font-medium text-primary hover:underline"
          >
            Open in full page
          </Link>
        </div>
        <TicketDetailPanel ticketId={selectedTicketId} />
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 px-4 py-3">
        <div>
          <h3 className="text-sm font-semibold text-gray-900">Maintenance tickets</h3>
          <p className="text-xs text-gray-500">
            Log email complaints and track resolution for this project.
          </p>
        </div>
        {!createMode ? (
          <Button size="sm" className="gap-1.5" onClick={openCreate}>
            <Plus className="size-4" />
            Raise ticket
          </Button>
        ) : (
          <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setCreateMode(false)}>
            <X className="size-4" />
            Cancel intake
          </Button>
        )}
      </div>

      {createMode ? (
        <div className="border-b border-gray-100 bg-slate-50/40">
          <div className="border-b border-gray-100 bg-white px-5 py-4">
            <div className="flex items-start gap-3">
              <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <AlertCircle className="size-4" />
              </div>
              <div>
                <h4 className="text-sm font-semibold text-gray-900">New maintenance ticket</h4>
                <p className="text-xs text-gray-500">
                  Capture the issue from email or manual observation. A unique 4-digit ticket number
                  is assigned on submit.
                </p>
              </div>
            </div>
          </div>

          <div className="grid gap-0 lg:grid-cols-[280px_1fr]">
            {/* Metadata column */}
            <aside className="space-y-5 border-b border-gray-100 p-5 lg:border-b-0 lg:border-r">
              <div>
                <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-gray-400">
                  Issue type
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {TICKET_ISSUE_TYPES.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() =>
                        setDraft((current) => ({ ...current, issue_type: option.value }))
                      }
                      className={cn(
                        "rounded-md border px-2 py-1 text-left text-[11px] font-medium transition",
                        draft.issue_type === option.value
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-gray-200 bg-white text-gray-600 hover:border-gray-300",
                      )}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-gray-400">
                  Priority
                </p>
                <div className="flex gap-2">
                  {(["P1", "P2", "P3"] as const).map((level) => (
                    <button
                      key={level}
                      type="button"
                      onClick={() => setDraft((current) => ({ ...current, priority: level }))}
                      className={cn(
                        "flex-1 rounded-lg border py-2 text-center text-sm font-semibold transition",
                        draft.priority === level
                          ? level === "P1"
                            ? "border-rose-300 bg-rose-50 text-rose-700"
                            : level === "P2"
                              ? "border-amber-300 bg-amber-50 text-amber-700"
                              : "border-sky-300 bg-sky-50 text-sky-700"
                          : "border-gray-200 bg-white text-gray-500 hover:bg-gray-50",
                      )}
                    >
                      {level}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-gray-400">
                  Source
                </p>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setDraft((current) => ({ ...current, source: "manual" }))}
                    className={cn(
                      "flex items-center justify-center gap-1.5 rounded-lg border py-2 text-xs font-medium transition",
                      draft.source === "manual"
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-gray-200 bg-white text-gray-600 hover:bg-gray-50",
                    )}
                  >
                    <PenLine className="size-3.5" />
                    Manual
                  </button>
                  <button
                    type="button"
                    onClick={() => setDraft((current) => ({ ...current, source: "email" }))}
                    className={cn(
                      "flex items-center justify-center gap-1.5 rounded-lg border py-2 text-xs font-medium transition",
                      draft.source === "email"
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-gray-200 bg-white text-gray-600 hover:bg-gray-50",
                    )}
                  >
                    <Mail className="size-3.5" />
                    Email
                  </button>
                </div>
              </div>

              <div>
                <label className="mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-gray-400">
                  <Calendar className="size-3" />
                  Reported on
                </label>
                <input
                  type="datetime-local"
                  value={draft.reported_on}
                  onChange={(event) =>
                    setDraft((current) => ({ ...current, reported_on: event.target.value }))
                  }
                  className={inputClass}
                />
              </div>
            </aside>

            {/* Main intake column */}
            <div className="space-y-4 p-5">
              <div>
                <label className="mb-1.5 block text-xs font-medium text-gray-700">Issue</label>
                <input
                  type="text"
                  value={draft.title}
                  onChange={(event) =>
                    setDraft((current) => ({ ...current, title: event.target.value }))
                  }
                  placeholder="Short issue title — e.g. RFID endpoint mismatch"
                  className={inputClass}
                />
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-medium text-gray-700">
                  Description
                </label>
                <textarea
                  rows={5}
                  value={draft.description}
                  onChange={(event) =>
                    setDraft((current) => ({ ...current, description: event.target.value }))
                  }
                  placeholder="What happened? Include user impact, error messages, and when it started."
                  className={cn(textareaClass, "min-h-[120px]")}
                />
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-medium text-gray-700">
                  Additional details
                </label>
                <textarea
                  rows={4}
                  value={draft.details}
                  onChange={(event) =>
                    setDraft((current) => ({ ...current, details: event.target.value }))
                  }
                  placeholder="Environment, URLs, endpoints, screenshots references, steps to reproduce…"
                  className={cn(textareaClass, "min-h-[96px]")}
                />
              </div>

              <div className="flex flex-wrap items-center justify-end gap-2 border-t border-gray-100 pt-4">
                <Button size="sm" variant="outline" onClick={() => setCreateMode(false)}>
                  Discard
                </Button>
                <Button
                  size="sm"
                  disabled={!canSubmit}
                  onClick={() => createMutation.mutate()}
                >
                  {createMutation.isPending ? "Raising ticket…" : "Raise ticket"}
                </Button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {ticketsQuery.isLoading ? (
        <p className="py-12 text-center text-sm text-gray-400">Loading tickets…</p>
      ) : tickets.length === 0 && !createMode ? (
        <div className="flex flex-col items-center justify-center px-6 py-14 text-center">
          <p className="text-sm font-medium text-gray-700">No tickets yet</p>
          <p className="mt-1 max-w-md text-xs text-gray-400">
            Raise a ticket when a user reports an issue by email or when you spot a maintenance
            problem.
          </p>
          <Button size="sm" className="mt-4 gap-1.5" onClick={openCreate}>
            <Plus className="size-4" />
            Raise first ticket
          </Button>
        </div>
      ) : tickets.length > 0 ? (
        <TableContainer>
          <Table>
            <TableHead>
              <TableHeaderRow>
                <TableHeaderCell>Ticket #</TableHeaderCell>
                <TableHeaderCell>Issue</TableHeaderCell>
                <TableHeaderCell>Type</TableHeaderCell>
                <TableHeaderCell>Priority</TableHeaderCell>
                <TableHeaderCell>Status</TableHeaderCell>
                <TableHeaderCell>Reported</TableHeaderCell>
                <TableHeaderCell className="text-right">Actions</TableHeaderCell>
              </TableHeaderRow>
            </TableHead>
            <TableBody>
              {tickets.map((item) => (
                <TableRow key={item.id}>
                  <TableCell mono>#{item.ticket_number ?? item.id}</TableCell>
                  <TableCell>
                    <button
                      type="button"
                      onClick={() => setSelectedTicketId(item.id)}
                      className="font-medium text-gray-900 hover:text-primary"
                    >
                      {item.title}
                    </button>
                  </TableCell>
                  <TableCell muted>{issueTypeLabelFromValue(item.issue_type)}</TableCell>
                  <TableCell>
                    <Badge variant={priorityVariant(item.priority)}>{item.priority}</Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant={ticketStatusVariant(item.status)} format>
                      {item.status}
                    </Badge>
                  </TableCell>
                  <TableCell muted>{formatDate(item.reported_on ?? item.created_at)}</TableCell>
                  <TableCell className="text-right">
                    <Button size="sm" variant="outline" onClick={() => setSelectedTicketId(item.id)}>
                      Open
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      ) : null}
    </div>
  );
}

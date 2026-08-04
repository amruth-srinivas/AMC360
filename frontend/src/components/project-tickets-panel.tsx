import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertCircle,
  AlignLeft,
  Calendar,
  FileText,
  Flag,
  Layers,
  ListTree,
  Mail,
  PenLine,
  Plus,
  Send,
  Type,
  X,
} from "lucide-react";
import { useState, type ReactNode } from "react";
import { Modal } from "react-aria-components";
import { toast } from "sonner";
import { Link } from "react-router-dom";

import { Badge } from "./ui/badge";
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
import { Backdrop } from "./tailgrids/core/overlay";
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
  "h-10 w-full rounded-lg border border-gray-200 bg-white pl-10 pr-3 text-sm text-gray-900 outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20";

const textareaClass =
  "w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 pl-10 text-sm text-gray-900 outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20";

function FieldLabel({
  icon: Icon,
  tone,
  children,
}: {
  icon: typeof Type;
  tone: string;
  children: ReactNode;
}) {
  return (
    <label className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-gray-700">
      <span className={cn("inline-flex size-5 shrink-0 items-center justify-center rounded-md [&>svg]:size-3", tone)}>
        <Icon strokeWidth={2} aria-hidden />
      </span>
      {children}
    </label>
  );
}

function SectionLabel({
  icon: Icon,
  children,
}: {
  icon: typeof Type;
  children: ReactNode;
}) {
  return (
    <p className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-gray-400">
      <Icon className="size-3" aria-hidden />
      {children}
    </p>
  );
}

export function ProjectTicketsPanel({ projectId }: { projectId: number }) {
  const queryClient = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
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
      closeCreate();
      setSelectedTicketId(ticket.id);
      toast.success(`Ticket #${ticket.ticket_number ?? ticket.id} raised`);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const tickets = ticketsQuery.data ?? [];
  const canSubmit =
    draft.title.trim().length >= 2 &&
    draft.description.trim().length >= 2 &&
    !createMutation.isPending;

  function openCreate() {
    setDraft(emptyDraft());
    setCreateOpen(true);
  }

  function closeCreate() {
    setCreateOpen(false);
    setDraft(emptyDraft());
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
    <>
      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 px-4 py-3">
          <div>
            <h3 className="text-sm font-semibold text-gray-900">Maintenance tickets</h3>
            <p className="text-xs text-gray-500">
              Log email complaints and track resolution for this project.
            </p>
          </div>
          <button
            type="button"
            onClick={openCreate}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-primary px-3.5 text-sm font-medium text-white transition hover:bg-primary/90"
          >
            <Plus className="size-3.5 shrink-0" strokeWidth={2.5} />
            Raise ticket
          </button>
        </div>

        {ticketsQuery.isLoading ? (
          <p className="py-12 text-center text-sm text-gray-400">Loading tickets…</p>
        ) : tickets.length === 0 ? (
          <div className="flex flex-col items-center justify-center px-6 py-14 text-center">
            <p className="text-sm font-medium text-gray-700">No tickets yet</p>
            <p className="mt-1 max-w-md text-xs text-gray-400">
              Raise a ticket when a user reports an issue by email or when you spot a maintenance
              problem.
            </p>
            <button
              type="button"
              onClick={openCreate}
              className="mt-4 inline-flex h-9 items-center gap-1.5 rounded-lg bg-primary px-3.5 text-sm font-medium text-white transition hover:bg-primary/90"
            >
              <Plus className="size-3.5 shrink-0" strokeWidth={2.5} />
              Raise first ticket
            </button>
          </div>
        ) : (
          <TableContainer>
            <Table className="!min-w-full table-fixed">
              <TableHead>
                <TableHeaderRow>
                  <TableHeaderCell className="w-[7%]">Ticket #</TableHeaderCell>
                  <TableHeaderCell className="w-[22%]">Issue</TableHeaderCell>
                  <TableHeaderCell className="w-[22%]">Type</TableHeaderCell>
                  <TableHeaderCell className="w-[10%]">Priority</TableHeaderCell>
                  <TableHeaderCell className="w-[12%]">Status</TableHeaderCell>
                  <TableHeaderCell className="w-[17%]">Reported</TableHeaderCell>
                  <TableHeaderCell className="w-[10%] !text-right">Actions</TableHeaderCell>
                </TableHeaderRow>
              </TableHead>
              <TableBody>
                {tickets.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell mono className="whitespace-nowrap">
                      #{item.ticket_number ?? item.id}
                    </TableCell>
                    <TableCell>
                      <button
                        type="button"
                        onClick={() => setSelectedTicketId(item.id)}
                        className="max-w-full truncate text-left font-medium text-gray-900 hover:text-primary"
                      >
                        {item.title}
                      </button>
                    </TableCell>
                    <TableCell muted>
                      <span className="line-clamp-2">
                        {issueTypeLabelFromValue(item.issue_type)}
                      </span>
                    </TableCell>
                    <TableCell>
                      <Badge variant={priorityVariant(item.priority)}>{item.priority}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={ticketStatusVariant(item.status)} format>
                        {item.status}
                      </Badge>
                    </TableCell>
                    <TableCell muted className="whitespace-nowrap">
                      {formatDate(item.reported_on ?? item.created_at)}
                    </TableCell>
                    <TableCell className="!text-right">
                      <div className="flex justify-end">
                        <button
                          type="button"
                          onClick={() => setSelectedTicketId(item.id)}
                          className="inline-flex h-8 items-center rounded-lg border border-gray-200 bg-white px-3 text-xs font-medium text-gray-700 transition hover:bg-gray-50 hover:text-primary"
                        >
                          Open
                        </button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </div>

      <Backdrop
        isOpen={createOpen}
        isDismissable={false}
        onOpenChange={(open) => {
          if (!open) closeCreate();
        }}
      >
        <Modal>
          <div className="fixed left-1/2 top-1/2 flex h-[85vh] max-h-[90vh] w-[80vw] max-w-[80vw] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-xl outline-none max-sm:w-[calc(100%-1.5rem)] max-sm:max-w-[calc(100%-1.5rem)]">
            <div className="flex items-start justify-between gap-3 border-b border-gray-100 px-5 py-4">
              <div className="flex items-start gap-3">
                <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <AlertCircle className="size-4" />
                </div>
                <div>
                  <h2 className="text-base font-semibold text-gray-900">
                    New maintenance ticket
                  </h2>
                  <p className="text-xs text-gray-500">
                    Capture the issue from email or manual observation. A unique 4-digit ticket
                    number is assigned on submit.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={closeCreate}
                className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-gray-500 hover:bg-gray-100"
                aria-label="Close"
              >
                <X className="size-4" />
              </button>
            </div>

            <div className="grid min-h-0 flex-1 lg:grid-cols-[minmax(220px,28%)_1fr]">
              <aside className="flex min-h-0 flex-col border-b border-gray-100 bg-slate-50/40 lg:border-b-0 lg:border-r">
                <div className="min-h-0 flex-1 overflow-y-auto p-4">
                  <SectionLabel icon={Layers}>Issue type</SectionLabel>
                  <div className="grid grid-cols-1 gap-1.5">
                    {TICKET_ISSUE_TYPES.map((option) => (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() =>
                          setDraft((current) => ({ ...current, issue_type: option.value }))
                        }
                        className={cn(
                          "rounded-lg border px-2.5 py-2 text-left text-xs font-medium transition",
                          draft.issue_type === option.value
                            ? "border-primary bg-primary/10 text-primary"
                            : "border-gray-200 bg-white text-gray-600 hover:border-gray-300 hover:bg-white",
                        )}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="shrink-0 space-y-4 border-t border-gray-100 p-4">
                  <div>
                    <SectionLabel icon={Flag}>Priority</SectionLabel>
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
                    <SectionLabel icon={ListTree}>Source</SectionLabel>
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
                    <SectionLabel icon={Calendar}>Reported on</SectionLabel>
                    <div className="relative">
                      <Calendar className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-gray-400" />
                      <input
                        type="datetime-local"
                        value={draft.reported_on}
                        onChange={(event) =>
                          setDraft((current) => ({ ...current, reported_on: event.target.value }))
                        }
                        className={inputClass}
                      />
                    </div>
                  </div>
                </div>
              </aside>

              <div className="flex min-h-0 flex-col gap-4 p-5">
                <div className="shrink-0">
                  <FieldLabel icon={Type} tone="bg-sky-50 text-sky-600">
                    Issue
                  </FieldLabel>
                  <div className="relative">
                    <Type className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-gray-400" />
                    <input
                      type="text"
                      value={draft.title}
                      onChange={(event) =>
                        setDraft((current) => ({ ...current, title: event.target.value }))
                      }
                      placeholder="Short issue title — e.g. RFID endpoint mismatch"
                      className={inputClass}
                      autoFocus
                    />
                  </div>
                </div>

                <div className="flex min-h-0 flex-[1.2] flex-col">
                  <FieldLabel icon={AlignLeft} tone="bg-violet-50 text-violet-600">
                    Description
                  </FieldLabel>
                  <div className="relative min-h-0 flex-1">
                    <AlignLeft className="pointer-events-none absolute left-3 top-3 size-4 text-gray-400" />
                    <textarea
                      value={draft.description}
                      onChange={(event) =>
                        setDraft((current) => ({ ...current, description: event.target.value }))
                      }
                      placeholder="What happened? Include user impact, error messages, and when it started."
                      className={cn(textareaClass, "h-full min-h-0 resize-none")}
                    />
                  </div>
                </div>

                <div className="flex min-h-0 flex-1 flex-col">
                  <FieldLabel icon={FileText} tone="bg-amber-50 text-amber-600">
                    Additional details
                  </FieldLabel>
                  <div className="relative min-h-0 flex-1">
                    <FileText className="pointer-events-none absolute left-3 top-3 size-4 text-gray-400" />
                    <textarea
                      value={draft.details}
                      onChange={(event) =>
                        setDraft((current) => ({ ...current, details: event.target.value }))
                      }
                      placeholder="Environment, URLs, endpoints, screenshot references, steps to reproduce…"
                      className={cn(textareaClass, "h-full min-h-0 resize-none")}
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-end gap-2 border-t border-gray-100 bg-white px-5 py-3">
              <button
                type="button"
                onClick={closeCreate}
                className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3.5 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
              >
                <X className="size-3.5" />
                Discard
              </button>
              <button
                type="button"
                disabled={!canSubmit}
                onClick={() => createMutation.mutate()}
                className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-primary px-3.5 text-sm font-medium text-white transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:bg-gray-300 disabled:text-gray-500"
              >
                <Send className="size-3.5" />
                {createMutation.isPending ? "Raising ticket…" : "Raise ticket"}
              </button>
            </div>
          </div>
        </Modal>
      </Backdrop>
    </>
  );
}

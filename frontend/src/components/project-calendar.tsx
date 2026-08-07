import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import interactionPlugin, { type DateClickArg } from "@fullcalendar/interaction";
import timeGridPlugin from "@fullcalendar/timegrid";
import type { EventClickArg, EventDropArg } from "@fullcalendar/core";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Download, FileText, Flag, Link2, Pencil, Plus, Settings2, Trash2, Upload, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { FormField, IconInput } from "./ui/form-field";
import { Select, Textarea } from "./ui/input";
import { Backdrop } from "./tailgrids/core/overlay";
import { Modal } from "react-aria-components";
import {
  DocxPreviewPane,
  isDocxDocument,
  isImageDocument,
  isLegacyDocDocument,
  isLegacyPptDocument,
  isPdfDocument,
  isPreviewableDocument,
  isPptxDocument,
  needsArrayBufferPreview,
  PptxPreviewPane,
} from "./pptx-preview-pane";
import { api } from "../lib/api";
import { useAuth } from "../store/auth";

export type FinalReport = {
  id: string;
  title?: string;
  filename: string;
  object_key?: string;
  content_type?: string | null;
  uploaded_at?: string;
  uploaded_by?: string;
};

export type ProjectCalendarEvent = {
  id: number;
  title: string;
  description?: string | null;
  start_at: string;
  end_at: string;
  due_date: string;
  status: string;
  type: string;
  event_type_id?: number | null;
  project_id?: number | null;
  color?: string | null;
  meeting_link?: string | null;
  is_milestone?: boolean;
  milestones?: Array<{ id: string; title: string; done: boolean; created_at?: string }>;
  final_reports?: FinalReport[];
  owner_id?: number;
  created_at?: string;
  updated_at?: string;
};

export type ProjectEventType = {
  id: number;
  project_id: number;
  name: string;
  color: string;
  frequency_interval?: number | null;
  frequency_unit?: "day" | "week" | "month" | "year" | null;
  created_at?: string;
};

const EVENT_STATUSES = [
  { value: "scheduled", label: "Scheduled" },
  { value: "in_progress", label: "In progress" },
  { value: "done", label: "Done" },
  { value: "overdue", label: "Overdue" },
  { value: "cancelled", label: "Cancelled" },
] as const;

const EVENT_COLORS = [
  "#3758F9",
  "#0EA5E9",
  "#22C55E",
  "#14B8A6",
  "#F59E0B",
  "#EF4444",
  "#A855F7",
  "#EC4899",
  "#6366F1",
  "#64748B",
];

const FREQUENCY_UNITS = [
  { value: "day", label: "Day(s)" },
  { value: "week", label: "Week(s)" },
  { value: "month", label: "Month(s)" },
  { value: "year", label: "Year(s)" },
] as const;

type TypeDraft = {
  name: string;
  color: string;
  frequencyEnabled: boolean;
  frequency_interval: number;
  frequency_unit: "day" | "week" | "month" | "year";
};

const emptyTypeDraft = (): TypeDraft => ({
  name: "",
  color: EVENT_COLORS[0],
  frequencyEnabled: false,
  frequency_interval: 3,
  frequency_unit: "month",
});

function formatFrequency(interval?: number | null, unit?: string | null) {
  if (!interval || !unit) return "One-time / as needed";
  const unitLabel =
    unit === "day"
      ? interval === 1
        ? "day"
        : "days"
      : unit === "week"
        ? interval === 1
          ? "week"
          : "weeks"
        : unit === "month"
          ? interval === 1
            ? "month"
            : "months"
          : interval === 1
            ? "year"
            : "years";
  return interval === 1 ? `Once every ${unitLabel}` : `Once every ${interval} ${unitLabel}`;
}
type EventMilestone = {
  id: string;
  title: string;
  done: boolean;
  created_at?: string;
};

type EventFormState = {
  title: string;
  event_type_id: number | null;
  type: string;
  status: string;
  start_at: string;
  end_at: string;
  color: string;
  meeting_link: string;
  description: string;
  milestones: EventMilestone[];
  new_milestone: string;
};

function pad(n: number) {
  return String(n).padStart(2, "0");
}

function toDateInputValue(value?: string | Date | null) {
  if (!value) return "";
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return "";
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function fromDateInputValue(value: string, endOfDay = false) {
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(year, (month || 1) - 1, day || 1);
  if (endOfDay) {
    date.setHours(23, 59, 59, 999);
  } else {
    date.setHours(0, 0, 0, 0);
  }
  return date.toISOString();
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function eachDateInclusive(startValue: string, endValue: string) {
  const dates: string[] = [];
  if (!startValue || !endValue) return dates;
  let current = new Date(`${startValue}T00:00:00`);
  const last = new Date(`${endValue}T00:00:00`);
  if (Number.isNaN(current.getTime()) || Number.isNaN(last.getTime())) return dates;
  while (current <= last) {
    dates.push(toDateInputValue(current));
    current = addDays(current, 1);
  }
  return dates;
}

function emptyForm(date?: Date, types?: ProjectEventType[]): EventFormState {
  const base = date ? new Date(date) : new Date();
  base.setHours(0, 0, 0, 0);
  const firstType = types?.[0];
  return {
    title: "",
    event_type_id: firstType?.id ?? null,
    type: firstType?.name ?? "Meeting",
    status: "scheduled",
    start_at: toDateInputValue(base),
    end_at: toDateInputValue(base),
    color: firstType?.color || EVENT_COLORS[0],
    meeting_link: "",
    description: "",
    milestones: [],
    new_milestone: "",
  };
}

function formatLabel(value: string) {
  return value.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

function newMilestoneId() {
  return `ms_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function milestonesComplete(milestones: EventMilestone[]) {
  if (milestones.length === 0) return true;
  return milestones.every((item) => item.done);
}

export function ProjectCalendarPanel({ projectId }: { projectId: number }) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const eventsQuery = useQuery({
    queryKey: ["calendar", projectId],
    queryFn: () => api.get<ProjectCalendarEvent[]>(`/calendar?project_id=${projectId}`),
  });
  const typesQuery = useQuery({
    queryKey: ["calendar-event-types", projectId],
    queryFn: () =>
      api.get<ProjectEventType[]>(`/calendar/event-types?project_id=${projectId}`),
  });

  const [eventModalOpen, setEventModalOpen] = useState(false);
  const [typesModalOpen, setTypesModalOpen] = useState(false);
  const [editing, setEditing] = useState<ProjectCalendarEvent | null>(null);
  const [form, setForm] = useState<EventFormState>(emptyForm());
  const [typeDraft, setTypeDraft] = useState<TypeDraft>(emptyTypeDraft());
  const [editingTypeId, setEditingTypeId] = useState<number | null>(null);
  const [previewReport, setPreviewReport] = useState<{
    title: string;
    filename: string;
    contentType: string | null;
    blobUrl: string;
    arrayBuffer?: ArrayBuffer;
  } | null>(null);
  const [previewLoadingId, setPreviewLoadingId] = useState<string | null>(null);
  const reportInputRef = useRef<HTMLInputElement>(null);

  const events = eventsQuery.data ?? [];
  const eventTypes = typesQuery.data ?? [];
  const allMilestonesDone = milestonesComplete(form.milestones);
  const canUploadFinalReports = Boolean(editing) && form.status === "done" && allMilestonesDone;

  const calendarEvents = useMemo(
    () =>
      events.flatMap((event) => {
        const color = event.color || "#3758F9";
        const startDay = toDateInputValue(event.start_at || event.due_date);
        const endDay = toDateInputValue(event.end_at || event.due_date);
        return eachDateInclusive(startDay, endDay).map((day) => ({
          id: `${event.id}__${day}`,
          title: event.title,
          start: day,
          allDay: true,
          backgroundColor: color,
          borderColor: color,
          textColor: "#ffffff",
          display: "block",
          classNames: ["project-cal-event"],
          extendedProps: { raw: event, color, day },
        }));
      }),
    [events],
  );

  function openCreate(date?: Date) {
    setEditing(null);
    setForm(emptyForm(date, eventTypes));
    setEventModalOpen(true);
  }

  function openEdit(event: ProjectCalendarEvent) {
    setEditing(event);
    const matchedType =
      eventTypes.find((item) => item.id === event.event_type_id) ||
      eventTypes.find((item) => item.name.toLowerCase() === event.type.toLowerCase());
    setForm({
      title: event.title,
      event_type_id: matchedType?.id ?? event.event_type_id ?? null,
      type: matchedType?.name ?? event.type,
      status: event.status,
      start_at: toDateInputValue(event.start_at || event.due_date),
      end_at: toDateInputValue(event.end_at || event.due_date),
      color: event.color || matchedType?.color || EVENT_COLORS[0],
      meeting_link: event.meeting_link || "",
      description: event.description || "",
      milestones: (event.milestones ?? []).map((item) => ({
        id: item.id || newMilestoneId(),
        title: item.title,
        done: Boolean(item.done),
        created_at: item.created_at,
      })),
      new_milestone: "",
    });
    setEventModalOpen(true);
  }

  function closeEventModal() {
    setEventModalOpen(false);
    setEditing(null);
    setForm(emptyForm(undefined, eventTypes));
  }

  function applyEventType(typeId: number) {
    const selected = eventTypes.find((item) => item.id === typeId);
    if (!selected) return;
    setForm((current) => ({
      ...current,
      event_type_id: selected.id,
      type: selected.name,
      color: selected.color,
    }));
  }

  function addMilestone() {
    const title = form.new_milestone.trim();
    if (!title) return;
    setForm((current) => ({
      ...current,
      milestones: [
        ...current.milestones,
        { id: newMilestoneId(), title, done: false, created_at: new Date().toISOString() },
      ],
      new_milestone: "",
    }));
  }

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!form.start_at || !form.end_at) {
        throw new Error("Start and end date are required");
      }
      if (form.end_at < form.start_at) {
        throw new Error("End must be on or after start");
      }
      if (form.status === "done" && !milestonesComplete(form.milestones)) {
        throw new Error("Complete all milestones before marking the event Done");
      }

      const payload = {
        project_id: projectId,
        title: form.title.trim(),
        type: form.type,
        event_type_id: form.event_type_id,
        status: form.status,
        start_at: fromDateInputValue(form.start_at, false),
        end_at: fromDateInputValue(form.end_at, true),
        owner_id: editing?.owner_id ?? user?.id ?? 1,
        color: form.color,
        meeting_link: form.meeting_link.trim() || null,
        description: form.description.trim() || null,
        is_milestone: form.milestones.length > 0,
        milestones: form.milestones,
        updates: [],
      };

      if (editing) {
        return api.put<ProjectCalendarEvent>(`/calendar/${editing.id}`, payload);
      }
      return api.post<ProjectCalendarEvent>("/calendar", payload);
    },
    onSuccess: async (saved) => {
      await queryClient.invalidateQueries({ queryKey: ["calendar", projectId] });
      await queryClient.invalidateQueries({ queryKey: ["calendar"] });
      toast.success(editing ? "Event updated" : "Event scheduled");
      if (saved) {
        setEditing(saved);
        setForm((current) => ({
          ...current,
          status: saved.status,
          milestones: (saved.milestones ?? []).map((item) => ({
            id: item.id || newMilestoneId(),
            title: item.title,
            done: Boolean(item.done),
            created_at: item.created_at,
          })),
        }));
      }
      if (!(saved?.status === "done" && milestonesComplete(saved.milestones ?? []))) {
        closeEventModal();
      }
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.delete(`/calendar/${id}`),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["calendar", projectId] });
      await queryClient.invalidateQueries({ queryKey: ["calendar"] });
      toast.success("Event deleted");
      closeEventModal();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const moveMutation = useMutation({
    mutationFn: ({
      id,
      start_at,
      end_at,
    }: {
      id: number;
      start_at: string;
      end_at: string;
    }) => api.put(`/calendar/${id}`, { start_at, end_at }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["calendar", projectId] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const uploadReportMutation = useMutation({
    mutationFn: async (file: File) => {
      if (!editing) throw new Error("Save the event first");
      const data = new FormData();
      data.append("file", file);
      data.append("title", file.name);
      return api.postForm<ProjectCalendarEvent>(`/calendar/${editing.id}/final-reports`, data);
    },
    onSuccess: async (saved) => {
      await queryClient.invalidateQueries({ queryKey: ["calendar", projectId] });
      setEditing(saved);
      toast.success("Final report uploaded");
      if (reportInputRef.current) reportInputRef.current.value = "";
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const deleteReportMutation = useMutation({
    mutationFn: (reportId: string) => {
      if (!editing) throw new Error("Event not found");
      return api.delete<ProjectCalendarEvent>(`/calendar/${editing.id}/final-reports/${reportId}`);
    },
    onSuccess: async (saved) => {
      await queryClient.invalidateQueries({ queryKey: ["calendar", projectId] });
      setEditing(saved);
      toast.success("Final report removed");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  async function openFinalReport(report: FinalReport) {
    if (!editing) return;
    setPreviewLoadingId(report.id);
    try {
      const blob = await api.getBlob(`/calendar/${editing.id}/final-reports/${report.id}/content`);
      const resolvedType = report.content_type || blob.type;
      const blobUrl = URL.createObjectURL(blob);
      const arrayBuffer = needsArrayBufferPreview(resolvedType, report.filename)
        ? await blob.arrayBuffer()
        : undefined;
      setPreviewReport((current) => {
        if (current?.blobUrl) URL.revokeObjectURL(current.blobUrl);
        return {
          title: report.title || report.filename,
          filename: report.filename,
          contentType: resolvedType,
          blobUrl,
          arrayBuffer,
        };
      });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to open report");
    } finally {
      setPreviewLoadingId(null);
    }
  }

  function closeFinalReportPreview() {
    setPreviewReport((current) => {
      if (current?.blobUrl) URL.revokeObjectURL(current.blobUrl);
      return null;
    });
  }

  useEffect(() => {
    return () => {
      if (previewReport?.blobUrl) URL.revokeObjectURL(previewReport.blobUrl);
    };
  }, [previewReport?.blobUrl]);

  const saveTypeMutation = useMutation({
    mutationFn: async () => {
      const name = typeDraft.name.trim();
      if (!name) throw new Error("Type name is required");
      if (typeDraft.frequencyEnabled && (!typeDraft.frequency_interval || typeDraft.frequency_interval < 1)) {
        throw new Error("Enter a valid frequency interval");
      }
      const frequencyPayload = typeDraft.frequencyEnabled
        ? {
            frequency_interval: typeDraft.frequency_interval,
            frequency_unit: typeDraft.frequency_unit,
          }
        : {
            frequency_interval: null,
            frequency_unit: null,
          };
      if (editingTypeId) {
        return api.put<ProjectEventType>(`/calendar/event-types/${editingTypeId}`, {
          name,
          color: typeDraft.color,
          ...frequencyPayload,
        });
      }
      return api.post<ProjectEventType>("/calendar/event-types", {
        project_id: projectId,
        name,
        color: typeDraft.color,
        ...frequencyPayload,
      });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["calendar-event-types", projectId] });
      await queryClient.invalidateQueries({ queryKey: ["calendar", projectId] });
      await queryClient.invalidateQueries({ queryKey: ["calendar"] });
      setTypeDraft(emptyTypeDraft());
      setEditingTypeId(null);
      toast.success(editingTypeId ? "Event type updated" : "Event type created");
    },
    onError: (error: Error) => toast.error(error.message),
  });
  const deleteTypeMutation = useMutation({
    mutationFn: (id: number) => api.delete(`/calendar/event-types/${id}`),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["calendar-event-types", projectId] });
      toast.success("Event type deleted");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  function handleDateClick(arg: DateClickArg) {
    openCreate(arg.date);
  }

  function handleEventClick(arg: EventClickArg) {
    const raw = arg.event.extendedProps.raw as ProjectCalendarEvent;
    openEdit(raw);
  }

  function handleEventDrop(arg: EventDropArg) {
    const raw = arg.event.extendedProps.raw as ProjectCalendarEvent | undefined;
    const segmentDay = arg.event.extendedProps.day as string | undefined;
    const droppedStart = arg.event.start;
    if (!raw || !segmentDay || !droppedStart) {
      arg.revert();
      return;
    }

    const oldDay = new Date(`${segmentDay}T00:00:00`);
    const newDay = new Date(`${toDateInputValue(droppedStart)}T00:00:00`);
    const deltaDays = Math.round((newDay.getTime() - oldDay.getTime()) / 86_400_000);

    const eventStart = toDateInputValue(raw.start_at || raw.due_date);
    const eventEnd = toDateInputValue(raw.end_at || raw.due_date);
    const nextStart = toDateInputValue(addDays(new Date(`${eventStart}T00:00:00`), deltaDays));
    const nextEnd = toDateInputValue(addDays(new Date(`${eventEnd}T00:00:00`), deltaDays));

    moveMutation.mutate({
      id: raw.id,
      start_at: fromDateInputValue(nextStart, false),
      end_at: fromDateInputValue(nextEnd, true),
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-gray-900">Project calendar</h3>
          <p className="text-xs text-gray-500">
            Click a date to schedule · drag events to reschedule · configure types for color coding
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" onClick={() => setTypesModalOpen(true)}>
            <Settings2 className="h-3.5 w-3.5" />
            Configure event types
          </Button>
          <Button size="sm" onClick={() => openCreate()}>
            <Plus className="h-3.5 w-3.5" />
            New event
          </Button>
        </div>
      </div>

      <div className="project-calendar overflow-hidden rounded-xl border border-gray-100 bg-white">
        <FullCalendar
          plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
          initialView="dayGridMonth"
          headerToolbar={{
            left: "prev,next today",
            center: "title",
            right: "dayGridMonth,timeGridWeek,timeGridDay",
          }}
          height={680}
          editable
          selectable
          dayMaxEvents={3}
          nowIndicator
          displayEventTime={false}
          events={calendarEvents}
          dateClick={handleDateClick}
          eventClick={handleEventClick}
          eventDrop={handleEventDrop}
          eventDidMount={(info) => {
            const color = (info.event.extendedProps.color as string) || "#3758F9";
            info.el.style.backgroundColor = color;
            info.el.style.borderColor = color;
            info.el.style.opacity = "0.95";
          }}
        />
      </div>

      {events.length > 0 ? (
        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
          {events
            .slice()
            .sort((a, b) => +new Date(a.start_at || a.due_date) - +new Date(b.start_at || b.due_date))
            .slice(0, 6)
            .map((event) => (
              <button
                key={event.id}
                type="button"
                onClick={() => openEdit(event)}
                className="flex items-start gap-3 rounded-xl border border-gray-100 px-3 py-3 text-left transition hover:border-primary/20 hover:bg-primary/[0.03]"
              >
                <span
                  className="mt-1 h-3 w-3 shrink-0 rounded-full"
                  style={{ backgroundColor: event.color || "#3758F9" }}
                />
                <span className="min-w-0">
                  <span className="block truncate text-sm font-semibold text-gray-900">{event.title}</span>
                  <span className="mt-0.5 block text-xs text-gray-500">
                    {formatLabel(event.type)} · {toDateInputValue(event.start_at || event.due_date)}
                    {toDateInputValue(event.end_at || event.due_date) !==
                    toDateInputValue(event.start_at || event.due_date)
                      ? ` → ${toDateInputValue(event.end_at || event.due_date)}`
                      : ""}
                  </span>
                  {(event.milestones?.length ?? 0) > 0 ? (
                    <span className="mt-1 inline-flex items-center gap-1 text-[11px] text-gray-400">
                      <Flag className="h-3 w-3" />
                      {event.milestones!.filter((m) => m.done).length}/{event.milestones!.length} milestones
                    </span>
                  ) : null}
                </span>
              </button>
            ))}
        </div>
      ) : null}

      <Backdrop isOpen={eventModalOpen} onOpenChange={(open) => (!open ? closeEventModal() : null)}>
        <Modal>
          <div className="fixed left-1/2 top-1/2 flex max-h-[90vh] w-full max-w-none -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-xl outline-none sm:w-1/2 max-sm:max-w-[calc(100%-1.5rem)]">
            <div className="flex items-start justify-between gap-3 border-b border-gray-100 px-5 py-4">
              <div>
                <h2 className="text-base font-semibold text-gray-900">
                  {editing ? "Edit event" : "Schedule event"}
                </h2>
                <p className="text-xs text-gray-500">
                  Title, start/end, configured type, color, milestones, and meeting link
                </p>
              </div>
              <button
                type="button"
                onClick={closeEventModal}
                className="inline-flex h-8 w-8 items-center justify-center rounded-md text-gray-500 hover:bg-gray-100"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-4 overflow-y-auto px-5 py-4">
              <FormField label="Title">
                <IconInput
                  value={form.title}
                  onChange={(value) => setForm((current) => ({ ...current, title: String(value) }))}
                  placeholder="Sprint review / delivery milestone"
                />
              </FormField>

              <div className="grid gap-3 sm:grid-cols-2">
                <FormField label="Event type">
                  <Select
                    value={form.event_type_id ? String(form.event_type_id) : ""}
                    onChange={(event) => {
                      const id = Number(event.target.value);
                      if (Number.isFinite(id) && id > 0) applyEventType(id);
                    }}
                  >
                    {eventTypes.length === 0 ? (
                      <option value="">Configure types first</option>
                    ) : null}
                    {eventTypes.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.name}
                        {item.frequency_interval && item.frequency_unit
                          ? ` · ${formatFrequency(item.frequency_interval, item.frequency_unit)}`
                          : ""}
                      </option>
                    ))}
                  </Select>
                  {form.event_type_id ? (
                    <p className="mt-1 text-[11px] text-gray-400">
                      Frequency:{" "}
                      {formatFrequency(
                        eventTypes.find((item) => item.id === form.event_type_id)?.frequency_interval,
                        eventTypes.find((item) => item.id === form.event_type_id)?.frequency_unit,
                      )}
                    </p>
                  ) : null}
                </FormField>
                <FormField label="Status">
                  <Select
                    value={form.status}
                    onChange={(event) => {
                      const next = event.target.value;
                      if (next === "done" && !milestonesComplete(form.milestones)) {
                        toast.error("Complete all milestones before marking Done");
                        return;
                      }
                      setForm((current) => ({ ...current, status: next }));
                    }}
                  >
                    {EVENT_STATUSES.map((item) => (
                      <option key={item.value} value={item.value}>
                        {item.label}
                      </option>
                    ))}
                  </Select>
                </FormField>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <FormField label="Start">
                  <input
                    type="date"
                    value={form.start_at}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        start_at: event.target.value,
                        end_at:
                          current.end_at && current.end_at < event.target.value
                            ? event.target.value
                            : current.end_at,
                      }))
                    }
                    className="w-full rounded-md border border-gray-200 px-3 py-2 text-sm outline-none focus:border-primary focus:ring-4 focus:ring-primary/20"
                  />
                </FormField>
                <FormField label="End">
                  <input
                    type="date"
                    value={form.end_at}
                    min={form.start_at || undefined}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, end_at: event.target.value }))
                    }
                    className="w-full rounded-md border border-gray-200 px-3 py-2 text-sm outline-none focus:border-primary focus:ring-4 focus:ring-primary/20"
                  />
                </FormField>
              </div>

              <div>
                <p className="mb-1.5 text-xs font-medium text-gray-700">Event color</p>
                <p className="mb-2 text-[11px] text-gray-400">
                  Defaults from the selected type — override if needed
                </p>
                <div className="flex flex-wrap gap-2">
                  {EVENT_COLORS.map((color) => (
                    <button
                      key={color}
                      type="button"
                      onClick={() => setForm((current) => ({ ...current, color }))}
                      className={`h-7 w-7 rounded-full border-2 transition ${
                        form.color.toLowerCase() === color.toLowerCase()
                          ? "scale-110 border-gray-900"
                          : "border-transparent"
                      }`}
                      style={{ backgroundColor: color }}
                      aria-label={`Color ${color}`}
                    />
                  ))}
                  {!EVENT_COLORS.some((c) => c.toLowerCase() === form.color.toLowerCase()) ? (
                    <button
                      type="button"
                      className="h-7 w-7 scale-110 rounded-full border-2 border-gray-900"
                      style={{ backgroundColor: form.color }}
                      aria-label="Custom type color"
                    />
                  ) : null}
                </div>
              </div>

              <FormField label="Meeting link">
                <div className="relative">
                  <Link2 className="pointer-events-none absolute left-3 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-gray-400" />
                  <IconInput
                    className="!pl-9"
                    value={form.meeting_link}
                    onChange={(value) =>
                      setForm((current) => ({ ...current, meeting_link: String(value) }))
                    }
                    placeholder="https://meet.google.com/..."
                  />
                </div>
                {form.meeting_link.trim() ? (
                  <a
                    href={form.meeting_link.trim()}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-1.5 inline-flex text-xs font-medium text-primary hover:underline"
                  >
                    Open meeting link
                  </a>
                ) : null}
              </FormField>

              <FormField label="Description">
                <Textarea
                  rows={3}
                  value={form.description}
                  onChange={(value) =>
                    setForm((current) => ({ ...current, description: String(value) }))
                  }
                  placeholder="Agenda, deliverables, or context"
                />
              </FormField>

              <div>
                <div className="mb-2 flex items-center justify-between gap-2">
                  <div>
                    <p className="text-xs font-medium text-gray-700">Milestones</p>
                    <p className="text-[11px] text-gray-400">
                      Create progress markers and mark them when done
                    </p>
                  </div>
                  <Badge variant="neutral">
                    {form.milestones.filter((m) => m.done).length}/{form.milestones.length}
                  </Badge>
                </div>

                <div className="mb-2 flex gap-2">
                  <IconInput
                    value={form.new_milestone}
                    onChange={(value) =>
                      setForm((current) => ({ ...current, new_milestone: String(value) }))
                    }
                    placeholder="e.g. UAT sign-off"
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        event.preventDefault();
                        addMilestone();
                      }
                    }}
                  />
                  <Button type="button" size="sm" variant="outline" onClick={addMilestone}>
                    <Plus className="h-3.5 w-3.5" />
                    Add
                  </Button>
                </div>

                {form.milestones.length === 0 ? (
                  <p className="rounded-lg border border-dashed border-gray-200 px-3 py-4 text-center text-xs text-gray-400">
                    No milestones yet — add one to track progress on this event
                  </p>
                ) : (
                  <div className="max-h-44 space-y-1.5 overflow-y-auto rounded-lg border border-gray-100 bg-gray-50/70 p-2">
                    {form.milestones.map((item) => (
                      <div
                        key={item.id}
                        className="flex items-center gap-2 rounded-md bg-white px-2.5 py-2"
                      >
                        <button
                          type="button"
                          onClick={() =>
                            setForm((current) => {
                              const milestones = current.milestones.map((ms) =>
                                ms.id === item.id ? { ...ms, done: !ms.done } : ms,
                              );
                              const nextStatus =
                                current.status === "done" && !milestonesComplete(milestones)
                                  ? "in_progress"
                                  : current.status;
                              return { ...current, milestones, status: nextStatus };
                            })
                          }
                          className={`inline-flex h-5 w-5 shrink-0 items-center justify-center rounded border ${
                            item.done
                              ? "border-success bg-success text-white"
                              : "border-gray-300 bg-white text-transparent"
                          }`}
                          aria-label={item.done ? "Unmark milestone" : "Mark milestone done"}
                        >
                          <Check className="h-3 w-3" />
                        </button>
                        <span
                          className={`min-w-0 flex-1 text-sm ${
                            item.done ? "text-gray-400 line-through" : "text-gray-800"
                          }`}
                        >
                          {item.title}
                        </span>
                        <button
                          type="button"
                          onClick={() =>
                            setForm((current) => ({
                              ...current,
                              milestones: current.milestones.filter((ms) => ms.id !== item.id),
                            }))
                          }
                          className="inline-flex h-7 w-7 items-center justify-center rounded-md text-gray-400 hover:bg-danger-light hover:text-danger"
                          aria-label="Remove milestone"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="rounded-xl border border-gray-100 p-3">
                <div className="mb-2 flex items-start justify-between gap-2">
                  <div>
                    <p className="text-xs font-medium text-gray-700">Final reports</p>
                    <p className="text-[11px] text-gray-400">
                      Available when status is Done and every milestone is complete
                    </p>
                  </div>
                  {canUploadFinalReports ? (
                    <Badge variant="success">Ready</Badge>
                  ) : (
                    <Badge variant="neutral">Locked</Badge>
                  )}
                </div>

                {!editing ? (
                  <p className="text-xs text-gray-400">Save the event first, then upload final reports.</p>
                ) : form.status !== "done" ? (
                  <p className="text-xs text-gray-400">Set status to Done to unlock final reports.</p>
                ) : !allMilestonesDone ? (
                  <p className="text-xs text-amber-600">
                    Complete all milestones before uploading final reports.
                  </p>
                ) : (
                  <div className="space-y-2">
                    <input
                      ref={reportInputRef}
                      type="file"
                      className="hidden"
                      onChange={(event) => {
                        const file = event.target.files?.[0];
                        if (file) uploadReportMutation.mutate(file);
                      }}
                    />
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={uploadReportMutation.isPending}
                      onClick={() => reportInputRef.current?.click()}
                    >
                      <Upload className="h-3.5 w-3.5" />
                      {uploadReportMutation.isPending ? "Uploading..." : "Upload final report"}
                    </Button>

                    {(editing.final_reports?.length ?? 0) === 0 ? (
                      <p className="text-xs text-gray-400">No final reports uploaded yet.</p>
                    ) : (
                      <div className="space-y-1.5">
                        {editing.final_reports!.map((report) => (
                          <div
                            key={report.id}
                            className="flex items-center gap-2 rounded-md border border-gray-100 bg-white px-2.5 py-2"
                          >
                            <FileText className="h-3.5 w-3.5 shrink-0 text-primary" />
                            <button
                              type="button"
                              disabled={previewLoadingId === report.id}
                              onClick={() => openFinalReport(report)}
                              className="min-w-0 flex-1 truncate text-left text-sm text-gray-800 hover:text-primary hover:underline disabled:opacity-60"
                            >
                              {previewLoadingId === report.id
                                ? "Opening..."
                                : report.title || report.filename}
                            </button>
                            <button
                              type="button"
                              disabled={deleteReportMutation.isPending}
                              onClick={() => deleteReportMutation.mutate(report.id)}
                              className="inline-flex h-7 w-7 items-center justify-center rounded-md text-gray-400 hover:bg-danger-light hover:text-danger"
                              aria-label="Remove final report"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            <div className="flex items-center justify-between gap-2 border-t border-gray-100 bg-gray-50 px-5 py-3">
              {editing ? (
                <Button
                  size="sm"
                  variant="destructive"
                  disabled={deleteMutation.isPending}
                  onClick={() => deleteMutation.mutate(editing.id)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Delete
                </Button>
              ) : (
                <span />
              )}
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={closeEventModal}>
                  Cancel
                </Button>
                <Button
                  size="sm"
                  disabled={
                    saveMutation.isPending ||
                    !form.title.trim() ||
                    !form.start_at ||
                    !form.end_at ||
                    !form.event_type_id
                  }
                  onClick={() => saveMutation.mutate()}
                >
                  {saveMutation.isPending ? "Saving..." : editing ? "Save changes" : "Create event"}
                </Button>
              </div>
            </div>
          </div>
        </Modal>
      </Backdrop>

      <Backdrop
        isOpen={typesModalOpen}
        onOpenChange={(open) => {
          if (!open) {
            setTypesModalOpen(false);
            setEditingTypeId(null);
            setTypeDraft(emptyTypeDraft());
          }
        }}
      >
        <Modal>
          <div className="fixed left-1/2 top-1/2 flex max-h-[85vh] w-full max-w-none -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-xl border border-gray-200 bg-white shadow-xl outline-none sm:w-1/2 max-sm:max-w-[calc(100%-1.5rem)]">
            <div className="flex items-center justify-between gap-3 border-b border-gray-100 px-4 py-3">
              <div>
                <h2 className="text-base font-semibold text-gray-900">Configure event types</h2>
                <p className="text-xs text-gray-500">Name, color, and how often it happens</p>
              </div>
              <button
                type="button"
                onClick={() => setTypesModalOpen(false)}
                className="inline-flex h-7 w-7 items-center justify-center rounded text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-3 overflow-y-auto px-4 py-3">
              <div className="space-y-2.5 rounded-lg border border-gray-100 bg-gray-50/80 p-3">
                <div className="flex gap-2">
                  <input
                    value={typeDraft.name}
                    onChange={(event) =>
                      setTypeDraft((current) => ({ ...current, name: event.target.value }))
                    }
                    placeholder={editingTypeId ? "Edit type name" : "New type name"}
                    className="h-9 min-w-0 flex-1 rounded-md border border-gray-200 bg-white px-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                  />
                  {editingTypeId ? (
                    <button
                      type="button"
                      onClick={() => {
                        setEditingTypeId(null);
                        setTypeDraft(emptyTypeDraft());
                      }}
                      className="h-9 shrink-0 rounded-md px-2.5 text-sm text-gray-500 hover:bg-gray-100"
                    >
                      Cancel
                    </button>
                  ) : null}
                  <button
                    type="button"
                    disabled={saveTypeMutation.isPending || !typeDraft.name.trim()}
                    onClick={() => saveTypeMutation.mutate()}
                    className="h-9 shrink-0 rounded-md bg-primary px-3 text-sm font-medium text-white hover:bg-primary-dark disabled:opacity-50"
                  >
                    {saveTypeMutation.isPending ? "…" : editingTypeId ? "Save" : "Add"}
                  </button>
                </div>
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="mr-1 text-xs text-gray-500">Color</span>
                  {EVENT_COLORS.map((color) => (
                    <button
                      key={color}
                      type="button"
                      onClick={() => setTypeDraft((current) => ({ ...current, color }))}
                      className={`h-[18px] w-[18px] rounded-full border transition ${
                        typeDraft.color === color
                          ? "border-gray-900 ring-1 ring-gray-900/20"
                          : "border-white/60 hover:scale-105"
                      }`}
                      style={{ backgroundColor: color }}
                      aria-label={`Color ${color}`}
                    />
                  ))}
                </div>
                <div className="space-y-2 rounded-md border border-gray-100 bg-white p-2.5">
                  <label className="flex items-center gap-2 text-sm text-gray-700">
                    <input
                      type="checkbox"
                      className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                      checked={typeDraft.frequencyEnabled}
                      onChange={(event) =>
                        setTypeDraft((current) => ({
                          ...current,
                          frequencyEnabled: event.target.checked,
                        }))
                      }
                    />
                    Recurring frequency
                  </label>
                  {typeDraft.frequencyEnabled ? (
                    <div className="flex flex-wrap items-center gap-2.5">
                      <span className="shrink-0 text-xs text-gray-500">Once every</span>
                      <input
                        type="number"
                        min={1}
                        value={typeDraft.frequency_interval}
                        onChange={(event) =>
                          setTypeDraft((current) => ({
                            ...current,
                            frequency_interval: Math.max(1, Number(event.target.value) || 1),
                          }))
                        }
                        className="h-8 w-[4.25rem] rounded-md border border-gray-200 px-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                      />
                      <select
                        value={typeDraft.frequency_unit}
                        onChange={(event) =>
                          setTypeDraft((current) => ({
                            ...current,
                            frequency_unit: event.target.value as TypeDraft["frequency_unit"],
                          }))
                        }
                        className="h-8 min-w-[7.5rem] appearance-none rounded-md border border-gray-200 bg-white bg-[length:12px] bg-[right_0.6rem_center] bg-no-repeat px-2.5 pr-8 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                        style={{
                          backgroundImage:
                            "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%236b7280'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'/%3E%3C/svg%3E\")",
                        }}
                      >
                        {FREQUENCY_UNITS.map((unit) => (
                          <option key={unit.value} value={unit.value}>
                            {unit.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  ) : (
                    <p className="text-[11px] text-gray-400">One-time / as needed (no set cadence)</p>
                  )}
                </div>
              </div>

              <div className="divide-y divide-gray-100 overflow-hidden rounded-lg border border-gray-100">
                {eventTypes.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center gap-2.5 px-3 py-2.5 hover:bg-gray-50/80"
                  >
                    <span
                      className="h-3 w-3 shrink-0 rounded-full"
                      style={{ backgroundColor: item.color }}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-gray-800">{item.name}</span>
                      <span className="block text-[11px] text-gray-400">
                        {formatFrequency(item.frequency_interval, item.frequency_unit)}
                      </span>
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setEditingTypeId(item.id);
                        setTypeDraft({
                          name: item.name,
                          color: item.color,
                          frequencyEnabled: Boolean(item.frequency_interval && item.frequency_unit),
                          frequency_interval: item.frequency_interval || 3,
                          frequency_unit: item.frequency_unit || "month",
                        });
                      }}
                      className="inline-flex h-7 w-7 items-center justify-center rounded text-gray-400 hover:bg-gray-100 hover:text-primary"
                      aria-label={`Edit ${item.name}`}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      disabled={deleteTypeMutation.isPending || eventTypes.length <= 1}
                      onClick={() => deleteTypeMutation.mutate(item.id)}
                      className="inline-flex h-7 w-7 items-center justify-center rounded text-gray-400 hover:bg-danger-light hover:text-danger disabled:opacity-40"
                      aria-label={`Delete ${item.name}`}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </Modal>
      </Backdrop>

      <Backdrop
        isOpen={Boolean(previewReport)}
        className="z-[60]"
        onOpenChange={(open) => (!open ? closeFinalReportPreview() : null)}
      >
        <Modal>
          <div
            className="fixed left-1/2 top-1/2 flex h-[min(90vh,880px)] w-full max-w-5xl -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-xl border border-gray-200 bg-white shadow-xl outline-none max-sm:max-w-[calc(100%-1.5rem)]"
            role="dialog"
            aria-modal="true"
          >
            <div className="flex items-start justify-between gap-3 border-b border-gray-100 px-5 py-4">
              <div className="min-w-0">
                <h2 className="truncate text-base font-semibold text-gray-900">{previewReport?.title}</h2>
                <p className="truncate text-xs text-gray-500">{previewReport?.filename}</p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                {previewReport ? (
                  <a
                    href={previewReport.blobUrl}
                    download={previewReport.filename}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50"
                  >
                    <Download className="h-3.5 w-3.5" />
                    Download
                  </a>
                ) : null}
                <button
                  type="button"
                  onClick={closeFinalReportPreview}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-md text-gray-500 hover:bg-gray-100"
                  aria-label="Close preview"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>
            <div className="min-h-0 flex-1 bg-gray-100 p-3">
              {previewReport && isPreviewableDocument(previewReport.contentType, previewReport.filename) ? (
                isImageDocument(previewReport.contentType, previewReport.filename) ? (
                  <div className="flex h-full items-center justify-center overflow-auto rounded-lg bg-white p-4">
                    <img
                      src={previewReport.blobUrl}
                      alt={previewReport.filename}
                      className="max-h-full max-w-full object-contain"
                    />
                  </div>
                ) : isDocxDocument(previewReport.contentType, previewReport.filename) &&
                  previewReport.arrayBuffer ? (
                  <DocxPreviewPane arrayBuffer={previewReport.arrayBuffer} />
                ) : isPptxDocument(previewReport.contentType, previewReport.filename) &&
                  previewReport.arrayBuffer ? (
                  <PptxPreviewPane arrayBuffer={previewReport.arrayBuffer} />
                ) : isPdfDocument(previewReport.contentType, previewReport.filename) ? (
                  <iframe
                    title={previewReport.filename}
                    src={previewReport.blobUrl}
                    className="h-full w-full rounded-lg border-0 bg-white"
                  />
                ) : (
                  <iframe
                    title={previewReport.filename}
                    src={previewReport.blobUrl}
                    className="h-full w-full rounded-lg border-0 bg-white"
                  />
                )
              ) : previewReport ? (
                <div className="flex h-full flex-col items-center justify-center gap-3 rounded-lg bg-white p-6 text-center">
                  <FileText className="h-10 w-10 text-gray-300" />
                  <p className="text-sm text-gray-600">
                    {isLegacyPptDocument(previewReport.contentType, previewReport.filename)
                      ? "Legacy .ppt files can’t be previewed in the browser. Re-save as .pptx, or download to open locally."
                      : isLegacyDocDocument(previewReport.contentType, previewReport.filename)
                        ? "Legacy .doc files can’t be previewed in the browser. Re-save as .docx, or download to open locally."
                        : "Preview is not available for this file type. Download it to open locally."}
                  </p>
                  <a
                    href={previewReport.blobUrl}
                    download={previewReport.filename}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-white hover:bg-primary-dark"
                  >
                    <Download className="h-3.5 w-3.5" />
                    Download {previewReport.filename}
                  </a>
                </div>
              ) : null}
            </div>
          </div>
        </Modal>
      </Backdrop>
    </div>
  );
}

export function EventStatusBadge({ status }: { status: string }) {
  const variant =
    status === "done"
      ? "success"
      : status === "overdue"
        ? "danger"
        : status === "in_progress"
          ? "info"
          : status === "cancelled"
            ? "neutral"
            : "warning";
  return (
    <Badge variant={variant} format>
      {status}
    </Badge>
  );
}

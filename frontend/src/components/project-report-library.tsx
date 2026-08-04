import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ChevronRight,
  Download,
  Eye,
  File,
  FileText,
  Folder,
  FolderOpen,
  FolderPlus,
  Home,
  Pencil,
  RefreshCw,
  Search,
  Trash2,
  Upload,
  UploadCloud,
  X,
  type LucideIcon,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Modal } from "react-aria-components";
import { toast } from "sonner";

import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { FormField, IconInput } from "./ui/form-field";
import { Textarea } from "./ui/input";
import { Backdrop } from "./tailgrids/core/overlay";
import {
  DocumentInlinePreview,
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
import { cn } from "@/utils/cn";

export type ReportDocument = {
  id: number;
  project_id: number;
  report_type_id: number;
  title: string;
  period_label?: string | null;
  filename: string;
  content_type?: string | null;
  notes?: string | null;
  uploaded_by: number;
  created_at: string;
};

export type ReportType = {
  id: number;
  project_id: number;
  name: string;
  description?: string | null;
  frequency_interval?: number | null;
  frequency_unit?: "day" | "week" | "month" | "year" | null;
  template_filename?: string | null;
  template_content_type?: string | null;
  has_template: boolean;
  created_by: number;
  created_at: string;
  updated_at?: string | null;
  documents: ReportDocument[];
};

const FREQUENCY_UNITS = [
  { value: "day", label: "Day(s)" },
  { value: "week", label: "Week(s)" },
  { value: "month", label: "Month(s)" },
  { value: "year", label: "Year(s)" },
] as const;

type TypeForm = {
  name: string;
  description: string;
  frequencyEnabled: boolean;
  frequency_interval: number;
  frequency_unit: "day" | "week" | "month" | "year";
};

type UploadForm = {
  title: string;
  period_label: string;
  notes: string;
};

function isRecurringType(item: Pick<ReportType, "frequency_interval" | "frequency_unit">) {
  return Boolean(item.frequency_interval && item.frequency_unit);
}

function periodsForType(item: ReportType) {
  if (!isRecurringType(item)) return [];
  const set = new Set<string>();
  for (const doc of item.documents ?? []) {
    if (doc.period_label?.trim()) set.add(doc.period_label.trim());
  }
  return Array.from(set).sort((a, b) => a.localeCompare(b));
}

function documentMatchesQuery(doc: ReportDocument, q: string) {
  if (!q) return true;
  return (
    doc.title.toLowerCase().includes(q) ||
    doc.filename.toLowerCase().includes(q) ||
    (doc.period_label ?? "").toLowerCase().includes(q) ||
    (doc.notes ?? "").toLowerCase().includes(q)
  );
}

type NavLocation =
  | { kind: "root" }
  | { kind: "type"; typeId: number }
  | { kind: "period"; typeId: number; period: string };

type TableRow =
  | {
      kind: "folder";
      key: string;
      name: string;
      subtitle: string;
      modified?: string;
      onOpen: () => void;
    }
  | {
      kind: "file";
      key: string;
      name: string;
      filename: string;
      modified: string;
      meta?: string;
      documentId: number;
      typeId: number;
      canDelete: boolean;
      onOpen: () => void;
    }
  | {
      kind: "template";
      key: string;
      name: string;
      filename: string;
      modified?: string;
      onOpen: () => void;
    };

function emptyTypeForm(): TypeForm {
  return {
    name: "",
    description: "",
    frequencyEnabled: false,
    frequency_interval: 3,
    frequency_unit: "month",
  };
}

function emptyUploadForm(period = ""): UploadForm {
  return { title: "", period_label: period, notes: "" };
}

function formatFrequency(interval?: number | null, unit?: string | null) {
  if (!interval || !unit) return "As needed";
  const label =
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
  return interval === 1 ? `Every ${label}` : `Every ${interval} ${label}`;
}

function formatModified(value?: string | null) {
  if (!value) return "—";
  return new Date(value).toLocaleString(undefined, {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

type IconTone = "amber" | "sky" | "violet" | "emerald" | "rose" | "indigo" | "slate";

const ICON_TONES: Record<IconTone, string> = {
  amber: "bg-amber-100 text-amber-600",
  sky: "bg-sky-100 text-sky-600",
  violet: "bg-violet-100 text-violet-600",
  emerald: "bg-emerald-100 text-emerald-600",
  rose: "bg-rose-100 text-rose-600",
  indigo: "bg-indigo-100 text-indigo-600",
  slate: "bg-slate-100 text-slate-500",
};

/** Petite colorful chip — use everywhere so Button’s [&>svg]:size-5 never warps icons. */
function PetiteIcon({ tone, icon: Icon }: { tone: IconTone; icon: LucideIcon }) {
  return (
    <span
      className={cn(
        "inline-flex size-5 shrink-0 items-center justify-center rounded-md [&>svg]:size-3",
        ICON_TONES[tone],
      )}
    >
      <Icon strokeWidth={2} aria-hidden />
    </span>
  );
}

function CompactAction({
  tone,
  icon,
  label,
  onClick,
  disabled,
  title,
}: {
  tone: IconTone;
  icon: LucideIcon;
  label?: string;
  onClick: () => void;
  disabled?: boolean;
  title?: string;
}) {
  return (
    <button
      type="button"
      title={title || label}
      aria-label={title || label}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "inline-flex h-7 items-center gap-1.5 rounded-md border border-gray-200 bg-white text-xs font-medium text-gray-700 transition hover:bg-gray-50 disabled:pointer-events-none disabled:opacity-50",
        label ? "px-2" : "w-7 justify-center px-0",
      )}
    >
      <PetiteIcon tone={tone} icon={icon} />
      {label ? <span>{label}</span> : null}
    </button>
  );
}

export function ProjectReportLibrary({
  projectId,
  canManage,
}: {
  projectId: number;
  canManage: boolean;
}) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const typesQuery = useQuery({
    queryKey: ["project-report-types", projectId],
    queryFn: () => api.get<ReportType[]>(`/projects/${projectId}/report-types`),
  });

  const [nav, setNav] = useState<NavLocation>({ kind: "root" });
  const [expandedTypes, setExpandedTypes] = useState<Set<number>>(new Set());
  const [search, setSearch] = useState("");
  const [typeModalOpen, setTypeModalOpen] = useState(false);
  const [editingType, setEditingType] = useState<ReportType | null>(null);
  const [typeForm, setTypeForm] = useState<TypeForm>(emptyTypeForm());
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [uploadTypeId, setUploadTypeId] = useState<number | null>(null);
  const [uploadForm, setUploadForm] = useState<UploadForm>(emptyUploadForm());
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadFiles, setUploadFiles] = useState<File[]>([]);
  const [manageOpen, setManageOpen] = useState(false);
  const [previewDoc, setPreviewDoc] = useState<{
    title: string;
    filename: string;
    contentType: string | null;
    blobUrl: string;
    arrayBuffer?: ArrayBuffer;
  } | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const templateInputRefs = useRef<Record<number, HTMLInputElement | null>>({});

  const types = typesQuery.data ?? [];
  const typeMap = useMemo(() => new Map(types.map((item) => [item.id, item])), [types]);
  const activeType = nav.kind === "root" ? null : typeMap.get(nav.typeId) ?? null;

  useEffect(() => {
    if (nav.kind !== "root" && !typeMap.has(nav.typeId)) {
      setNav({ kind: "root" });
      return;
    }
    if (nav.kind === "period") {
      const item = typeMap.get(nav.typeId);
      if (item && !isRecurringType(item)) {
        setNav({ kind: "type", typeId: nav.typeId });
      }
    }
  }, [nav, typeMap]);

  useEffect(() => {
    return () => {
      if (previewDoc?.blobUrl) URL.revokeObjectURL(previewDoc.blobUrl);
    };
  }, [previewDoc?.blobUrl]);

  async function openReportPreview(path: string, title: string, filename: string, contentType?: string | null) {
    setPreviewLoading(true);
    try {
      const blob = await api.getBlob(path);
      const resolvedType = contentType || blob.type;
      const blobUrl = URL.createObjectURL(blob);
      const arrayBuffer = needsArrayBufferPreview(resolvedType, filename)
        ? await blob.arrayBuffer()
        : undefined;
      setPreviewDoc((current) => {
        if (current?.blobUrl) URL.revokeObjectURL(current.blobUrl);
        return {
          title,
          filename,
          contentType: resolvedType,
          blobUrl,
          arrayBuffer,
        };
      });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to open document");
    } finally {
      setPreviewLoading(false);
    }
  }

  function closeReportPreview() {
    setPreviewDoc((current) => {
      if (current?.blobUrl) URL.revokeObjectURL(current.blobUrl);
      return null;
    });
  }

  const tableRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    const rows: TableRow[] = [];

    if (nav.kind === "root") {
      for (const item of types) {
        const periods = periodsForType(item);
        const recurring = isRecurringType(item);
        const matchesType =
          !q ||
          item.name.toLowerCase().includes(q) ||
          (item.description ?? "").toLowerCase().includes(q) ||
          (item.documents ?? []).some((doc) => documentMatchesQuery(doc, q));
        if (!matchesType) continue;
        const fileCount = item.documents?.length ?? 0;
        rows.push({
          kind: "folder",
          key: `type-${item.id}`,
          name: item.name,
          subtitle: recurring
            ? `${formatFrequency(item.frequency_interval, item.frequency_unit)} · ${fileCount} file(s) · ${periods.length} period folder(s)`
            : `As needed · ${fileCount} file(s) · direct upload`,
          modified: item.updated_at || item.created_at,
          onOpen: () => {
            setExpandedTypes((current) => new Set(current).add(item.id));
            setNav({ kind: "type", typeId: item.id });
            setSearch("");
          },
        });
      }
      return rows;
    }

    if (!activeType) return rows;

    if (nav.kind === "type") {
      if (activeType.has_template) {
        const templateName = activeType.template_filename || "Template";
        if (!q || templateName.toLowerCase().includes(q) || "template".includes(q)) {
          rows.push({
            kind: "template",
            key: `template-${activeType.id}`,
            name: "Template",
            filename: templateName,
            modified: activeType.updated_at || activeType.created_at,
            onOpen: () =>
              void openReportPreview(
                `/projects/${projectId}/report-types/${activeType.id}/template/content`,
                "Template",
                activeType.template_filename || "template",
                activeType.template_content_type,
              ),
          });
        }
      }

      if (isRecurringType(activeType)) {
        for (const period of periodsForType(activeType)) {
          const docs = (activeType.documents ?? []).filter((doc) => doc.period_label === period);
          const matches =
            !q ||
            period.toLowerCase().includes(q) ||
            docs.some((doc) => documentMatchesQuery(doc, q));
          if (!matches) continue;
          rows.push({
            kind: "folder",
            key: `period-${activeType.id}-${period}`,
            name: period,
            subtitle: `${docs.length} completed report${docs.length === 1 ? "" : "s"}`,
            modified: docs[0]?.created_at,
            onOpen: () => {
              setNav({ kind: "period", typeId: activeType.id, period });
              setSearch("");
            },
          });
        }

        // Orphan files (no period) under a recurring type still show as files
        const orphans = (activeType.documents ?? []).filter((doc) => !doc.period_label?.trim());
        for (const doc of orphans) {
          if (!documentMatchesQuery(doc, q)) continue;
          rows.push({
            kind: "file",
            key: `doc-${doc.id}`,
            name: doc.title,
            filename: doc.filename,
            meta: doc.notes || undefined,
            modified: doc.created_at,
            documentId: doc.id,
            typeId: activeType.id,
            canDelete: canManage || doc.uploaded_by === user?.id,
            onOpen: () =>
              void openReportPreview(
                `/projects/${projectId}/report-types/${activeType.id}/documents/${doc.id}/content`,
                doc.title,
                doc.filename,
                doc.content_type,
              ),
          });
        }
        return rows;
      }

      // As-needed: list files directly in this folder
      for (const doc of activeType.documents ?? []) {
        if (!documentMatchesQuery(doc, q)) continue;
        rows.push({
          kind: "file",
          key: `doc-${doc.id}`,
          name: doc.title,
          filename: doc.filename,
          meta: doc.notes || undefined,
          modified: doc.created_at,
          documentId: doc.id,
          typeId: activeType.id,
          canDelete: canManage || doc.uploaded_by === user?.id,
          onOpen: () =>
            void openReportPreview(
              `/projects/${projectId}/report-types/${activeType.id}/documents/${doc.id}/content`,
              doc.title,
              doc.filename,
              doc.content_type,
            ),
        });
      }
      return rows;
    }

    const docs = (activeType.documents ?? []).filter((doc) => doc.period_label === nav.period);
    for (const doc of docs) {
      if (!documentMatchesQuery(doc, q)) continue;
      rows.push({
        kind: "file",
        key: `doc-${doc.id}`,
        name: doc.title,
        filename: doc.filename,
        meta: doc.notes || undefined,
        modified: doc.created_at,
        documentId: doc.id,
        typeId: activeType.id,
        canDelete: canManage || doc.uploaded_by === user?.id,
        onOpen: () =>
          void openReportPreview(
            `/projects/${projectId}/report-types/${activeType.id}/documents/${doc.id}/content`,
            doc.title,
            doc.filename,
            doc.content_type,
          ),
      });
    }
    return rows;
  }, [activeType, canManage, nav, projectId, search, types, user?.id]);

  function openCreateType() {
    if (!canManage) {
      toast.message("Only the project team lead or an admin can create folders");
      return;
    }
    setEditingType(null);
    setTypeForm(emptyTypeForm());
    setTypeModalOpen(true);
  }

  function openEditType(item: ReportType) {
    setEditingType(item);
    setTypeForm({
      name: item.name,
      description: item.description || "",
      frequencyEnabled: Boolean(item.frequency_interval && item.frequency_unit),
      frequency_interval: item.frequency_interval || 3,
      frequency_unit: item.frequency_unit || "month",
    });
    setTypeModalOpen(true);
  }

  function openUpload(prefillPeriod = "") {
    const typeId =
      nav.kind === "root"
        ? types[0]?.id ?? null
        : nav.typeId;
    if (!typeId) {
      if (canManage) {
        toast.message("Create a report type folder first");
        openCreateType();
      } else {
        toast.error("No report type folders available yet");
      }
      return;
    }
    const targetType = typeMap.get(typeId);
    const period =
      prefillPeriod ||
      (nav.kind === "period" && targetType && isRecurringType(targetType) ? nav.period : "");
    setUploadTypeId(typeId);
    setUploadForm(emptyUploadForm(period));
    setUploadFile(null);
    setUploadFiles([]);
    setUploadModalOpen(true);
  }

  const saveTypeMutation = useMutation({
    mutationFn: async () => {
      const name = typeForm.name.trim();
      if (!name) throw new Error("Folder / report type name is required");
      const payload = {
        name,
        description: typeForm.description.trim() || null,
        frequency_interval: typeForm.frequencyEnabled ? typeForm.frequency_interval : null,
        frequency_unit: typeForm.frequencyEnabled ? typeForm.frequency_unit : null,
      };
      if (editingType) {
        return api.put<ReportType>(`/projects/${projectId}/report-types/${editingType.id}`, payload);
      }
      return api.post<ReportType>(`/projects/${projectId}/report-types`, payload);
    },
    onSuccess: async (saved) => {
      await queryClient.invalidateQueries({ queryKey: ["project-report-types", projectId] });
      setTypeModalOpen(false);
      setEditingType(null);
      setTypeForm(emptyTypeForm());
      setExpandedTypes((current) => new Set(current).add(saved.id));
      setNav({ kind: "type", typeId: saved.id });
      toast.success(editingType ? "Folder updated" : "Folder created");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const deleteTypeMutation = useMutation({
    mutationFn: (id: number) => api.delete(`/projects/${projectId}/report-types/${id}`),
    onSuccess: async (_data, id) => {
      await queryClient.invalidateQueries({ queryKey: ["project-report-types", projectId] });
      if (nav.kind !== "root" && nav.typeId === id) setNav({ kind: "root" });
      toast.success("Folder deleted");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const uploadTemplateMutation = useMutation({
    mutationFn: async ({ typeId, file }: { typeId: number; file: File }) => {
      const data = new FormData();
      data.append("file", file);
      return api.postForm<ReportType>(`/projects/${projectId}/report-types/${typeId}/template`, data);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["project-report-types", projectId] });
      toast.success("Template uploaded");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const uploadDocumentMutation = useMutation({
    mutationFn: async () => {
      if (!uploadTypeId) throw new Error("Select a report type folder");
      const targetType = typeMap.get(uploadTypeId);
      if (!targetType) throw new Error("Report type folder not found");
      const recurring = isRecurringType(targetType);

      if (recurring) {
        if (!uploadFile) throw new Error("Choose a file to upload");
        if (!uploadForm.title.trim() || !uploadForm.period_label.trim()) {
          throw new Error("Document name and period folder are required");
        }
        const data = new FormData();
        data.append("file", uploadFile);
        data.append("title", uploadForm.title.trim());
        data.append("period_label", uploadForm.period_label.trim());
        if (uploadForm.notes.trim()) data.append("notes", uploadForm.notes.trim());
        return {
          mode: "recurring" as const,
          docs: [
            await api.postForm<ReportDocument>(
              `/projects/${projectId}/report-types/${uploadTypeId}/documents`,
              data,
            ),
          ],
        };
      }

      const files = uploadFiles.length > 0 ? uploadFiles : uploadFile ? [uploadFile] : [];
      if (files.length === 0) throw new Error("Choose one or more files to upload");

      const docs: ReportDocument[] = [];
      for (const file of files) {
        const baseName = file.name.replace(/\.[^.]+$/, "") || file.name;
        const data = new FormData();
        data.append("file", file);
        data.append(
          "title",
          files.length === 1 && uploadForm.title.trim()
            ? uploadForm.title.trim()
            : baseName,
        );
        if (uploadForm.notes.trim()) data.append("notes", uploadForm.notes.trim());
        docs.push(
          await api.postForm<ReportDocument>(
            `/projects/${projectId}/report-types/${uploadTypeId}/documents`,
            data,
          ),
        );
      }
      return { mode: "as_needed" as const, docs };
    },
    onSuccess: async (result) => {
      await queryClient.invalidateQueries({ queryKey: ["project-report-types", projectId] });
      setUploadModalOpen(false);
      setUploadFile(null);
      setUploadFiles([]);
      setUploadForm(emptyUploadForm());
      const first = result.docs[0];
      if (first) {
        setExpandedTypes((current) => new Set(current).add(first.report_type_id));
        if (result.mode === "recurring" && first.period_label) {
          setNav({
            kind: "period",
            typeId: first.report_type_id,
            period: first.period_label,
          });
        } else {
          setNav({ kind: "type", typeId: first.report_type_id });
        }
      }
      toast.success(
        result.docs.length === 1
          ? "Document uploaded"
          : `${result.docs.length} documents uploaded`,
      );
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const uploadTargetType = uploadTypeId ? typeMap.get(uploadTypeId) ?? null : null;
  const uploadIsRecurring = uploadTargetType ? isRecurringType(uploadTargetType) : true;

  const deleteDocumentMutation = useMutation({
    mutationFn: ({ typeId, documentId }: { typeId: number; documentId: number }) =>
      api.delete(`/projects/${projectId}/report-types/${typeId}/documents/${documentId}`),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["project-report-types", projectId] });
      toast.success("Document deleted");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  function toggleSidebarType(typeId: number) {
    setExpandedTypes((current) => {
      const next = new Set(current);
      if (next.has(typeId)) next.delete(typeId);
      else next.add(typeId);
      return next;
    });
  }

  const breadcrumb = (
    <div className="flex flex-wrap items-center gap-1.5 text-sm text-gray-600">
      <button
        type="button"
        onClick={() => {
          setNav({ kind: "root" });
          setSearch("");
        }}
        className="inline-flex items-center gap-1.5 rounded px-1.5 py-0.5 hover:bg-gray-100 hover:text-primary"
      >
        <PetiteIcon tone="indigo" icon={Home} />
        Home
      </button>
      {activeType ? (
        <>
          <ChevronRight className="size-3 text-gray-300" strokeWidth={2} />
          <button
            type="button"
            onClick={() => {
              setNav({ kind: "type", typeId: activeType.id });
              setSearch("");
            }}
            className={`rounded px-1.5 py-0.5 hover:bg-gray-100 ${
              nav.kind === "type" ? "font-semibold text-gray-900" : "hover:text-primary"
            }`}
          >
            {activeType.name}
          </button>
        </>
      ) : null}
      {nav.kind === "period" ? (
        <>
          <ChevronRight className="size-3 text-gray-300" strokeWidth={2} />
          <span className="rounded px-1.5 py-0.5 font-semibold text-gray-900">{nav.period}</span>
        </>
      ) : null}
    </div>
  );

  return (
    <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
      <div className="grid min-h-[620px] lg:grid-cols-[260px_1fr]">
        {/* Sidebar */}
        <aside className="border-b border-gray-100 bg-gray-50/80 lg:border-b-0 lg:border-r">
          <div className="max-h-[580px] overflow-y-auto p-2 pt-3">
            <button
              type="button"
              onClick={() => {
                setNav({ kind: "root" });
                setSearch("");
              }}
              className={`mb-1 flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-sm ${
                nav.kind === "root"
                  ? "bg-primary/10 font-semibold text-primary"
                  : "text-gray-700 hover:bg-white"
              }`}
            >
              <PetiteIcon tone="indigo" icon={Home} />
              All folders
            </button>

            {typesQuery.isLoading ? (
              <p className="px-2 py-4 text-xs text-gray-400">Loading folders…</p>
            ) : types.length === 0 ? (
              <p className="px-2 py-4 text-xs text-gray-400">
                {canManage ? "Create a folder to get started." : "No folders yet."}
              </p>
            ) : (
              <ul className="space-y-0.5">
                {types.map((item) => {
                  const expanded = expandedTypes.has(item.id);
                  const periods = periodsForType(item);
                  const selected =
                    nav.kind !== "root" && nav.typeId === item.id && nav.kind === "type";
                  return (
                    <li key={item.id}>
                      <div className="flex items-center gap-0.5">
                        <button
                          type="button"
                          onClick={() => toggleSidebarType(item.id)}
                          className="inline-flex h-7 w-7 items-center justify-center rounded text-gray-400 hover:bg-white hover:text-gray-700"
                          aria-label={expanded ? "Collapse" : "Expand"}
                        >
                          <ChevronRight
                            className={`size-3 transition ${expanded ? "rotate-90" : ""}`}
                            strokeWidth={2}
                          />
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setExpandedTypes((current) => new Set(current).add(item.id));
                            setNav({ kind: "type", typeId: item.id });
                            setSearch("");
                          }}
                          className={`flex min-w-0 flex-1 items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm ${
                            selected
                              ? "bg-primary/10 font-semibold text-primary"
                              : "text-gray-700 hover:bg-white"
                          }`}
                        >
                          <PetiteIcon tone="amber" icon={expanded ? FolderOpen : Folder} />
                          <span className="truncate">{item.name}</span>
                        </button>
                      </div>
                      {expanded ? (
                        isRecurringType(item) ? (
                          <ul className="mb-1 ml-8 space-y-0.5 border-l border-gray-200 pl-2">
                            {periods.length === 0 ? (
                              <li className="px-2 py-1 text-[11px] text-gray-400">
                                No period folders yet
                              </li>
                            ) : (
                              periods.map((period) => {
                                const periodSelected =
                                  nav.kind === "period" &&
                                  nav.typeId === item.id &&
                                  nav.period === period;
                                return (
                                  <li key={period}>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setNav({ kind: "period", typeId: item.id, period });
                                        setSearch("");
                                      }}
                                      className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs ${
                                        periodSelected
                                          ? "bg-primary/10 font-semibold text-primary"
                                          : "text-gray-600 hover:bg-white"
                                      }`}
                                    >
                                      <PetiteIcon tone="sky" icon={Folder} />
                                      <span className="truncate">{period}</span>
                                    </button>
                                  </li>
                                );
                              })
                            )}
                          </ul>
                        ) : (
                          <p className="mb-1 ml-10 px-2 py-1 text-[11px] text-gray-400">
                            Direct uploads · {(item.documents ?? []).length} file
                            {(item.documents ?? []).length === 1 ? "" : "s"}
                          </p>
                        )
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </aside>

        {/* Main pane */}
        <section className="flex min-w-0 flex-col">
          <div className="space-y-3 border-b border-gray-100 px-4 py-3">
            {breadcrumb}

            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
                <div className="relative min-w-[180px] flex-1 max-w-md">
                  <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2">
                    <PetiteIcon tone="slate" icon={Search} />
                  </span>
                  <input
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Search documents (min. 2 characters)..."
                    className="h-9 w-full rounded-md border border-gray-200 bg-white py-2 pl-10 pr-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                  />
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  className="shrink-0 gap-1.5"
                  onClick={openCreateType}
                >
                  <PetiteIcon tone="amber" icon={FolderPlus} />
                  New Folder
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="shrink-0 gap-1.5"
                  onClick={() => setManageOpen(true)}
                >
                  <PetiteIcon tone="violet" icon={FileText} />
                  Document types
                </Button>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <CompactAction
                  tone="slate"
                  icon={RefreshCw}
                  title="Refresh"
                  onClick={() => {
                    setSearch("");
                    void typesQuery.refetch();
                  }}
                />
                <Button
                  size="sm"
                  className="gap-1.5"
                  onClick={() => openUpload(nav.kind === "period" ? nav.period : "")}
                >
                  <PetiteIcon tone="sky" icon={UploadCloud} />
                  Upload document
                </Button>
              </div>
            </div>

            {activeType ? (
              <div className="flex flex-wrap items-center gap-2 text-xs text-gray-500">
                <Badge variant="info">
                  {formatFrequency(activeType.frequency_interval, activeType.frequency_unit)}
                </Badge>
                {activeType.has_template ? (
                  <Badge variant="success">Template available</Badge>
                ) : (
                  <Badge variant="warning">No template yet</Badge>
                )}
                {canManage && nav.kind === "type" ? (
                  <>
                    <input
                      ref={(node) => {
                        templateInputRefs.current[activeType.id] = node;
                      }}
                      type="file"
                      className="hidden"
                      onChange={(event) => {
                        const file = event.target.files?.[0];
                        if (file) {
                          uploadTemplateMutation.mutate({ typeId: activeType.id, file });
                        }
                        event.target.value = "";
                      }}
                    />
                    <Button
                      size="sm"
                      variant="outline"
                      className="gap-1.5"
                      disabled={uploadTemplateMutation.isPending}
                      onClick={() => templateInputRefs.current[activeType.id]?.click()}
                    >
                      <PetiteIcon tone="violet" icon={Upload} />
                      {activeType.has_template ? "Replace template" : "Upload template"}
                    </Button>
                  </>
                ) : null}
              </div>
            ) : null}
          </div>

          <div className="min-h-0 flex-1 overflow-auto">
            <table className="w-full min-w-[640px] border-collapse text-left text-sm">
              <thead className="sticky top-0 z-10 bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
                <tr>
                  <th className="px-4 py-3 font-semibold">Name</th>
                  <th className="px-4 py-3 font-semibold">Type</th>
                  <th className="px-4 py-3 font-semibold">Modified</th>
                  <th className="px-4 py-3 font-semibold">Details</th>
                  <th className="px-4 py-3 text-right font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {typesQuery.isLoading ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-16 text-center text-gray-400">
                      Loading documents…
                    </td>
                  </tr>
                ) : tableRows.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-16">
                      <div className="flex flex-col items-center justify-center text-center">
                        <PetiteIcon tone="sky" icon={File} />
                        <p className="mt-3 text-sm font-medium text-gray-700">No data</p>
                        <p className="mt-1 max-w-sm text-xs text-gray-400">
                          {nav.kind === "root"
                            ? canManage
                              ? "Create a folder for a report type. Use recurring cadence for period folders, or as-needed for direct multi-file uploads."
                              : "No report folders have been set up for this project yet."
                            : nav.kind === "type"
                              ? activeType && isRecurringType(activeType)
                                ? "Upload a completed report to create a period folder, or add a template for this type."
                                : "Upload files directly into this folder. Multi-file upload is supported."
                              : "No documents in this period folder yet."}
                        </p>
                        <div className="mt-4 flex flex-wrap justify-center gap-2">
                          {nav.kind === "root" && canManage ? (
                            <Button size="sm" className="gap-1.5" onClick={openCreateType}>
                              <PetiteIcon tone="amber" icon={FolderPlus} />
                              New Folder
                            </Button>
                          ) : null}
                          <Button
                            size="sm"
                            variant="outline"
                            className="gap-1.5"
                            onClick={() => openUpload(nav.kind === "period" ? nav.period : "")}
                          >
                            <PetiteIcon tone="sky" icon={UploadCloud} />
                            Upload
                          </Button>
                        </div>
                      </div>
                    </td>
                  </tr>
                ) : (
                  tableRows.map((row) => (
                    <tr
                      key={row.key}
                      className="border-t border-gray-50 transition hover:bg-primary/[0.03]"
                    >
                      <td className="px-4 py-3">
                        <button
                          type="button"
                          onClick={row.onOpen}
                          className="flex min-w-0 items-center gap-2.5 text-left"
                        >
                          {row.kind === "folder" ? (
                            <PetiteIcon
                              tone={nav.kind === "root" ? "amber" : "sky"}
                              icon={Folder}
                            />
                          ) : row.kind === "template" ? (
                            <PetiteIcon tone="violet" icon={FileText} />
                          ) : (
                            <PetiteIcon tone="emerald" icon={FileText} />
                          )}
                          <span className="min-w-0">
                            <span className="block truncate font-medium text-gray-900">
                              {row.name}
                            </span>
                            {row.kind === "folder" ? (
                              <span className="block truncate text-[11px] text-gray-400">
                                {row.subtitle}
                              </span>
                            ) : (
                              <span className="block truncate font-mono text-[11px] text-gray-400">
                                {row.filename}
                              </span>
                            )}
                          </span>
                        </button>
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-500">
                        {row.kind === "folder"
                          ? nav.kind === "root"
                            ? "Report type"
                            : "Period folder"
                          : row.kind === "template"
                            ? "Template"
                            : "Completed report"}
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-gray-500">
                        {formatModified(row.modified)}
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-500">
                        {row.kind === "file" ? row.meta || "—" : row.kind === "folder" ? "—" : "Master template"}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-1.5">
                          <CompactAction
                            tone={row.kind === "folder" ? "amber" : "indigo"}
                            icon={row.kind === "folder" ? FolderOpen : Eye}
                            label={
                              row.kind !== "folder" && previewLoading ? "Opening…" : "Open"
                            }
                            disabled={previewLoading && row.kind !== "folder"}
                            onClick={row.onOpen}
                          />
                          {row.kind === "file" && row.canDelete ? (
                            <CompactAction
                              tone="rose"
                              icon={Trash2}
                              title="Delete"
                              onClick={() =>
                                deleteDocumentMutation.mutate({
                                  typeId: row.typeId,
                                  documentId: row.documentId,
                                })
                              }
                            />
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      {/* Create / edit type folder */}
      <Backdrop
        isOpen={typeModalOpen}
        onOpenChange={(open) => {
          if (!open) {
            setTypeModalOpen(false);
            setEditingType(null);
            setTypeForm(emptyTypeForm());
          }
        }}
      >
        <Modal>
          <div className="fixed left-1/2 top-1/2 flex max-h-[90vh] w-full max-w-lg -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-xl border border-gray-200 bg-white shadow-xl outline-none max-sm:max-w-[calc(100%-1.5rem)]">
            <div className="flex items-start justify-between gap-3 border-b border-gray-100 px-5 py-4">
              <div>
                <h2 className="text-base font-semibold text-gray-900">
                  {editingType ? "Edit folder" : "New folder"}
                </h2>
                <p className="text-xs text-gray-500">
                  Report type folder with optional recurring frequency
                </p>
              </div>
              <CompactAction
                tone="slate"
                icon={X}
                title="Close"
                onClick={() => setTypeModalOpen(false)}
              />
            </div>
            <div className="space-y-4 overflow-y-auto px-5 py-4">
              <FormField label="Folder name">
                <IconInput
                  value={typeForm.name}
                  onChange={(value) => setTypeForm((current) => ({ ...current, name: String(value) }))}
                  placeholder="e.g. Database Restoration Drill"
                />
              </FormField>
              <FormField label="Description">
                <Textarea
                  rows={2}
                  value={typeForm.description}
                  onChange={(value) =>
                    setTypeForm((current) => ({ ...current, description: String(value) }))
                  }
                  placeholder="What belongs in this folder"
                />
              </FormField>
              <div className="space-y-2 rounded-lg border border-gray-100 bg-gray-50/70 p-3">
                <label className="flex items-center gap-2 text-sm text-gray-700">
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                    checked={typeForm.frequencyEnabled}
                    onChange={(event) =>
                      setTypeForm((current) => ({
                        ...current,
                        frequencyEnabled: event.target.checked,
                      }))
                    }
                  />
                  Recurring frequency
                </label>
                {typeForm.frequencyEnabled ? (
                  <div className="flex flex-wrap items-center gap-2.5">
                    <span className="text-xs text-gray-500">Once every</span>
                    <input
                      type="number"
                      min={1}
                      value={typeForm.frequency_interval}
                      onChange={(event) =>
                        setTypeForm((current) => ({
                          ...current,
                          frequency_interval: Math.max(1, Number(event.target.value) || 1),
                        }))
                      }
                      className="h-8 w-[4.25rem] rounded-md border border-gray-200 px-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                    />
                    <select
                      value={typeForm.frequency_unit}
                      onChange={(event) =>
                        setTypeForm((current) => ({
                          ...current,
                          frequency_unit: event.target.value as TypeForm["frequency_unit"],
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
                  <p className="text-[11px] text-gray-400">As needed — no fixed cadence</p>
                )}
              </div>
            </div>
            <div className="flex justify-end gap-2 border-t border-gray-100 bg-gray-50 px-5 py-3">
              <Button size="sm" variant="outline" onClick={() => setTypeModalOpen(false)}>
                Cancel
              </Button>
              <Button
                size="sm"
                disabled={saveTypeMutation.isPending || !typeForm.name.trim()}
                onClick={() => saveTypeMutation.mutate()}
              >
                {saveTypeMutation.isPending ? "Saving…" : editingType ? "Save" : "Create folder"}
              </Button>
            </div>
          </div>
        </Modal>
      </Backdrop>

      {/* Upload completed document */}
      <Backdrop
        isOpen={uploadModalOpen}
        onOpenChange={(open) => {
          if (!open) {
            setUploadModalOpen(false);
            setUploadFile(null);
            setUploadFiles([]);
            setUploadForm(emptyUploadForm());
          }
        }}
      >
        <Modal>
          <div className="fixed left-1/2 top-1/2 flex max-h-[90vh] w-full max-w-lg -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-xl border border-gray-200 bg-white shadow-xl outline-none max-sm:max-w-[calc(100%-1.5rem)]">
            <div className="flex items-start justify-between gap-3 border-b border-gray-100 px-5 py-4">
              <div>
                <h2 className="text-base font-semibold text-gray-900">Upload document</h2>
                <p className="text-xs text-gray-500">
                  {uploadIsRecurring
                    ? "Files go into a period folder under a recurring report type"
                    : "Files upload directly into this as-needed folder (multiple allowed)"}
                </p>
              </div>
              <CompactAction
                tone="slate"
                icon={X}
                title="Close"
                onClick={() => setUploadModalOpen(false)}
              />
            </div>
            <div className="space-y-4 overflow-y-auto px-5 py-4">
              <FormField label="Report type folder">
                <select
                  value={uploadTypeId ?? ""}
                  onChange={(event) => {
                    const nextId = Number(event.target.value);
                    setUploadTypeId(nextId);
                    const nextType = typeMap.get(nextId);
                    if (nextType && !isRecurringType(nextType)) {
                      setUploadForm((current) => ({ ...current, period_label: "" }));
                    }
                  }}
                  className="h-9 w-full appearance-none rounded-md border border-gray-200 bg-white px-3 pr-8 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                >
                  {types.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                      {isRecurringType(item) ? " (recurring)" : " (as needed)"}
                    </option>
                  ))}
                </select>
              </FormField>
              {uploadIsRecurring ? (
                <FormField label="Period folder">
                  <IconInput
                    value={uploadForm.period_label}
                    onChange={(value) =>
                      setUploadForm((current) => ({ ...current, period_label: String(value) }))
                    }
                    placeholder="e.g. Jul–Sep 2026"
                  />
                </FormField>
              ) : null}
              <FormField
                label={
                  uploadIsRecurring || uploadFiles.length <= 1
                    ? "Document name"
                    : "Document name (optional, uses filenames)"
                }
              >
                <IconInput
                  value={uploadForm.title}
                  onChange={(value) =>
                    setUploadForm((current) => ({ ...current, title: String(value) }))
                  }
                  placeholder={
                    uploadIsRecurring
                      ? "e.g. SPV Data Flow Restoration Report"
                      : "Optional override for single file"
                  }
                />
              </FormField>
              <FormField label="Notes">
                <Textarea
                  rows={2}
                  value={uploadForm.notes}
                  onChange={(value) =>
                    setUploadForm((current) => ({ ...current, notes: String(value) }))
                  }
                  placeholder="Optional"
                />
              </FormField>
              <div>
                <p className="mb-1.5 text-xs font-medium text-gray-700">
                  {uploadIsRecurring ? "File" : "File(s)"}
                </p>
                <input
                  type="file"
                  multiple={!uploadIsRecurring}
                  onChange={(event) => {
                    const list = event.target.files;
                    if (!list || list.length === 0) {
                      setUploadFile(null);
                      setUploadFiles([]);
                      return;
                    }
                    if (uploadIsRecurring) {
                      setUploadFile(list[0]);
                      setUploadFiles([]);
                    } else {
                      const next = Array.from(list);
                      setUploadFiles(next);
                      setUploadFile(next[0] ?? null);
                      if (next.length === 1 && !uploadForm.title.trim()) {
                        const base = next[0].name.replace(/\.[^.]+$/, "") || next[0].name;
                        setUploadForm((current) => ({ ...current, title: base }));
                      }
                    }
                  }}
                  className="block w-full text-sm text-gray-600 file:mr-3 file:rounded-md file:border-0 file:bg-primary/10 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-primary"
                />
                {uploadIsRecurring && uploadFile ? (
                  <p className="mt-1.5 truncate font-mono text-[11px] text-gray-400">
                    {uploadFile.name}
                  </p>
                ) : null}
                {!uploadIsRecurring && uploadFiles.length > 0 ? (
                  <ul className="mt-1.5 max-h-28 space-y-0.5 overflow-y-auto">
                    {uploadFiles.map((file) => (
                      <li key={`${file.name}-${file.size}`} className="truncate font-mono text-[11px] text-gray-400">
                        {file.name}
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
            </div>
            <div className="flex justify-end gap-2 border-t border-gray-100 bg-gray-50 px-5 py-3">
              <Button size="sm" variant="outline" onClick={() => setUploadModalOpen(false)}>
                Cancel
              </Button>
              <Button
                size="sm"
                disabled={
                  uploadDocumentMutation.isPending ||
                  !uploadTypeId ||
                  (uploadIsRecurring
                    ? !uploadForm.title.trim() ||
                      !uploadForm.period_label.trim() ||
                      !uploadFile
                    : uploadFiles.length === 0 && !uploadFile)
                }
                onClick={() => uploadDocumentMutation.mutate()}
              >
                {uploadDocumentMutation.isPending
                  ? "Uploading…"
                  : !uploadIsRecurring && uploadFiles.length > 1
                    ? `Upload ${uploadFiles.length} files`
                    : "Upload"}
              </Button>
            </div>
          </div>
        </Modal>
      </Backdrop>

      {/* Manage document types */}
      <Backdrop isOpen={manageOpen} onOpenChange={(open) => (!open ? setManageOpen(false) : null)}>
        <Modal>
          <div className="fixed left-1/2 top-1/2 flex max-h-[90vh] w-full max-w-2xl -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-xl border border-gray-200 bg-white shadow-xl outline-none max-sm:max-w-[calc(100%-1.5rem)]">
            <div className="flex items-start justify-between gap-3 border-b border-gray-100 px-5 py-4">
              <div>
                <h2 className="text-base font-semibold text-gray-900">Document types</h2>
                <p className="text-xs text-gray-500">
                  {canManage
                    ? "Manage report type folders, templates, and cadence"
                    : "Browse report type folders and templates"}
                </p>
              </div>
              <CompactAction
                tone="slate"
                icon={X}
                title="Close"
                onClick={() => setManageOpen(false)}
              />
            </div>
            <div className="space-y-2 overflow-y-auto px-5 py-4">
              {canManage ? (
                <div className="mb-2 flex justify-end">
                  <Button size="sm" className="gap-1.5" onClick={openCreateType}>
                    <PetiteIcon tone="amber" icon={FolderPlus} />
                    New folder
                  </Button>
                </div>
              ) : null}
              {types.length === 0 ? (
                <p className="py-8 text-center text-sm text-gray-400">No document types yet.</p>
              ) : (
                types.map((item) => (
                  <div
                    key={item.id}
                    className="rounded-lg border border-gray-100 px-3 py-2.5"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex min-w-0 flex-1 items-center gap-2">
                        <PetiteIcon tone="amber" icon={Folder} />
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-gray-900">{item.name}</p>
                          <p className="text-[11px] text-gray-400">
                            {formatFrequency(item.frequency_interval, item.frequency_unit)}
                            {item.has_template ? "" : " · No template"}
                          </p>
                        </div>
                      </div>
                      {canManage ? (
                        <div className="flex shrink-0 items-center gap-1">
                          <input
                            ref={(node) => {
                              templateInputRefs.current[item.id] = node;
                            }}
                            type="file"
                            className="hidden"
                            onChange={(event) => {
                              const file = event.target.files?.[0];
                              if (file) uploadTemplateMutation.mutate({ typeId: item.id, file });
                              event.target.value = "";
                            }}
                          />
                          <CompactAction
                            tone="violet"
                            icon={Upload}
                            label={item.has_template ? "Replace" : "Template"}
                            onClick={() => templateInputRefs.current[item.id]?.click()}
                          />
                          <CompactAction
                            tone="sky"
                            icon={Pencil}
                            title="Edit"
                            onClick={() => openEditType(item)}
                          />
                          <CompactAction
                            tone="rose"
                            icon={Trash2}
                            title="Delete"
                            onClick={() => {
                              if (
                                window.confirm(
                                  `Delete folder “${item.name}” and all documents inside it?`,
                                )
                              ) {
                                deleteTypeMutation.mutate(item.id);
                              }
                            }}
                          />
                        </div>
                      ) : null}
                    </div>
                    {item.has_template ? (
                      <DocumentInlinePreview
                        contentPath={`/projects/${projectId}/report-types/${item.id}/template/content`}
                        filename={item.template_filename || "template"}
                        contentType={item.template_content_type}
                        onOpenFull={() =>
                          void openReportPreview(
                            `/projects/${projectId}/report-types/${item.id}/template/content`,
                            item.name,
                            item.template_filename || "template",
                            item.template_content_type,
                          )
                        }
                      />
                    ) : null}
                  </div>
                ))
              )}
            </div>
          </div>
        </Modal>
      </Backdrop>

      <Backdrop
        isOpen={Boolean(previewDoc)}
        className="z-[60]"
        onOpenChange={(open) => (!open ? closeReportPreview() : null)}
      >
        <Modal>
          <div
            className="fixed left-1/2 top-1/2 flex h-[min(90vh,880px)] w-full max-w-5xl -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-xl border border-gray-200 bg-white shadow-xl outline-none max-sm:max-w-[calc(100%-1.5rem)]"
            role="dialog"
            aria-modal="true"
          >
            <div className="flex items-start justify-between gap-3 border-b border-gray-100 px-5 py-4">
              <div className="flex min-w-0 items-start gap-2.5">
                <PetiteIcon tone="emerald" icon={FileText} />
                <div className="min-w-0">
                  <h2 className="truncate text-base font-semibold text-gray-900">
                    {previewDoc?.title}
                  </h2>
                  <p className="truncate font-mono text-xs text-gray-500">{previewDoc?.filename}</p>
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                {previewDoc ? (
                  <a
                    href={previewDoc.blobUrl}
                    download={previewDoc.filename}
                    className="inline-flex h-7 items-center gap-1.5 rounded-md border border-gray-200 bg-white px-2 text-xs font-medium text-gray-700 hover:bg-gray-50"
                  >
                    <PetiteIcon tone="sky" icon={Download} />
                    Download
                  </a>
                ) : null}
                <CompactAction tone="slate" icon={X} title="Close preview" onClick={closeReportPreview} />
              </div>
            </div>
            <div className="min-h-0 flex-1 bg-gray-100 p-3">
              {previewDoc && isPreviewableDocument(previewDoc.contentType, previewDoc.filename) ? (
                isImageDocument(previewDoc.contentType, previewDoc.filename) ? (
                  <div className="flex h-full items-center justify-center overflow-auto rounded-lg bg-white p-4">
                    <img
                      src={previewDoc.blobUrl}
                      alt={previewDoc.filename}
                      className="max-h-full max-w-full object-contain"
                    />
                  </div>
                ) : isDocxDocument(previewDoc.contentType, previewDoc.filename) &&
                  previewDoc.arrayBuffer ? (
                  <DocxPreviewPane arrayBuffer={previewDoc.arrayBuffer} />
                ) : isPptxDocument(previewDoc.contentType, previewDoc.filename) &&
                  previewDoc.arrayBuffer ? (
                  <PptxPreviewPane arrayBuffer={previewDoc.arrayBuffer} />
                ) : isPdfDocument(previewDoc.contentType, previewDoc.filename) ? (
                  <iframe
                    title={previewDoc.filename}
                    src={previewDoc.blobUrl}
                    className="h-full w-full rounded-lg border-0 bg-white"
                  />
                ) : (
                  <iframe
                    title={previewDoc.filename}
                    src={previewDoc.blobUrl}
                    className="h-full w-full rounded-lg border-0 bg-white"
                  />
                )
              ) : previewDoc ? (
                <div className="flex h-full flex-col items-center justify-center gap-3 rounded-lg bg-white p-6 text-center">
                  <PetiteIcon tone="violet" icon={FileText} />
                  <p className="text-sm text-gray-600">
                    {isLegacyPptDocument(previewDoc.contentType, previewDoc.filename)
                      ? "Legacy .ppt files can’t be previewed in the browser. Re-save as .pptx, or download to open locally."
                      : isLegacyDocDocument(previewDoc.contentType, previewDoc.filename)
                        ? "Legacy .doc files can’t be previewed in the browser. Re-save as .docx, or download to open locally."
                        : "Preview is not available for this file type. Download it to open locally."}
                  </p>
                  <a
                    href={previewDoc.blobUrl}
                    download={previewDoc.filename}
                    className="inline-flex h-7 items-center gap-1.5 rounded-md bg-primary px-3 text-xs font-medium text-white hover:bg-primary-dark"
                  >
                    <PetiteIcon tone="sky" icon={Download} />
                    Download {previewDoc.filename}
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

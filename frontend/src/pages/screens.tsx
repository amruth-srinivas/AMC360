import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import interactionPlugin from "@fullcalendar/interaction";
import timeGridPlugin from "@fullcalendar/timegrid";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import {
  Bar,
  BarChart,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useForm, useFieldArray, Controller, type FieldErrors } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  CalendarClock,
  ClipboardList,
  FolderKanban,
  ShieldCheck,
  Ticket,
  UserPlus,
  Pencil,
  Trash2,
  User,
  IdCard,
  Mail,
  Phone,
  Briefcase,
  Shield,
  Lock,
  Building2,
  Hash,
  MapPin,
  FileText,
  Plus,
  X,
  Eye,
  Download,
  Upload,
  ArrowRight,
  ArrowLeft,
  Users,
} from "lucide-react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import type React from "react";
import { useEffect, useState } from "react";
import { Modal } from "react-aria-components";

import { Badge } from "../components/ui/badge";
import { UserAvatar } from "../components/ui/avatar";
import { Button } from "../components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "../components/ui/card";
import { FormField, IconInput } from "../components/ui/form-field";
import { Input, PasswordInput, Select, Textarea } from "../components/ui/input";
import { Backdrop } from "../components/tailgrids/core/overlay";
import {
  DialogBody,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../components/tailgrids/core/dialog";
import {
  Table,
  TableActions,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableHeaderCell,
  TableHeaderRow,
  TableIconButton,
  TableRow,
} from "../components/ui/table";
import { api } from "../lib/api";
import { formatDate } from "../lib/utils";
import { useAuth } from "../store/auth";
import { ProjectCalendarPanel } from "../components/project-calendar";
import { ProjectReportLibrary } from "../components/project-report-library";
import type { ReportType } from "../components/project-report-library";
import {
  DocxPreviewPane,
  isDocxDocument,
  isImageDocument,
  isLegacyDocDocument,
  isPptxDocument,
  isPreviewableDocument,
  needsArrayBufferPreview,
  PptxPreviewPane,
} from "../components/pptx-preview-pane";
import {
  TICKET_ISSUE_TYPES,
  TicketDetailPanel,
  issueTypeLabelFromValue,
  type MaintenanceTicket,
} from "../components/ticket-detail-panel";
import { ProjectTicketsPanel } from "../components/project-tickets-panel";
import { ProjectIssuesPanel } from "../components/project-issues-panel";

type ContactPerson = {
  name: string;
  designation?: string | null;
  email?: string | null;
  phone?: string | null;
};

type ProjectDocument = {
  id: number;
  project_id: number;
  category: ProjectDocumentCategory;
  title: string | null;
  filename: string;
  object_key: string;
  content_type: string | null;
  url: string | null;
  created_at: string;
};

type ProjectDocumentCategory =
  | "amc_terms"
  | "sow"
  | "contract"
  | "technical"
  | "invoice"
  | "other";

type PendingProjectDocument = {
  localId: string;
  category: ProjectDocumentCategory;
  title: string;
  file: File;
};

type ProjectUserSummary = {
  id: number;
  name: string;
  email: string;
  designation: string | null;
  role: string;
};

type Project = {
  id: number;
  project_no: string;
  name: string;
  client_name: string;
  customer_name: string | null;
  details: string | null;
  contact_persons: ContactPerson[];
  company_address: string | null;
  status: "active" | "on_hold" | "completed" | "cancelled";
  amc_terms_object_key: string | null;
  amc_terms_filename: string | null;
  amc_terms_url: string | null;
  team_lead_id: number | null;
  team_lead?: ProjectUserSummary | null;
  is_managed_project?: boolean;
  member_ids: number[];
  members?: ProjectUserSummary[];
  documents?: ProjectDocument[];
};

const DOCUMENT_CATEGORIES: Array<{ value: ProjectDocumentCategory; label: string }> = [
  { value: "amc_terms", label: "AMC Terms" },
  { value: "sow", label: "Scope of Work" },
  { value: "contract", label: "Contract" },
  { value: "technical", label: "Technical" },
  { value: "invoice", label: "Invoice" },
  { value: "other", label: "Other" },
];

function documentCategoryLabel(category: string) {
  return DOCUMENT_CATEGORIES.find((item) => item.value === category)?.label ?? category;
}

type TicketRow = MaintenanceTicket;

type ReportRow = {
  id: number;
  project_id: number;
  period: string;
  template_id: number;
  status: string;
  created_at: string;
  comments?: string | null;
};

type ApprovalRow = {
  id: number;
  entity_type: string;
  entity_id: number;
  status: string;
  comment?: string | null;
};

type EventRow = {
  id: number;
  title: string;
  description?: string | null;
  start_at?: string;
  end_at?: string;
  due_date: string;
  status: string;
  type: string;
  event_type_id?: number | null;
  project_id?: number | null;
  color?: string | null;
  meeting_link?: string | null;
  is_milestone?: boolean;
  milestones?: Array<{ id: string; title: string; done: boolean; created_at?: string }>;
  owner_id?: number;
  created_at?: string;
  updated_at?: string;
};

const loginSchema = z.object({
  identifier: z.string().min(1, "Email or Employee ID is required"),
  password: z.string().min(6),
});

const userSchema = z.object({
  name: z.string().min(2),
  employee_id: z.string().min(1),
  email: z.string().email(),
  phone: z.string().min(10),
  designation: z.string().min(2),
  role: z.enum(["admin", "team_lead", "team_member"]),
  password: z.string().min(8).optional(),
});

const contactPersonSchema = z.object({
  name: z.string().optional(),
  designation: z.string().optional(),
  email: z.union([z.literal(""), z.string().email("Invalid email")]).optional(),
  phone: z.string().optional(),
});

const projectSchema = z
  .object({
    project_no: z.string().min(1, "Project No is required"),
    name: z.string().min(2, "Name is required"),
    client_name: z.string().min(2, "Client company is required"),
    customer_name: z.string().min(1, "Customer name is required"),
    details: z.string().optional().or(z.literal("")),
    company_address: z.string().min(1, "Company address is required"),
    status: z.enum(["active", "on_hold", "completed", "cancelled"]),
    team_lead_id: z.number().optional(),
    member_ids: z.array(z.number()),
    contact_persons: z.array(contactPersonSchema),
  })
  .superRefine((data, ctx) => {
    const filledContacts = data.contact_persons.filter((person) => person.name?.trim());
    if (filledContacts.length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Add at least one contact person",
        path: ["contact_persons"],
      });
    }
  });

const templateSchema = z.object({
  name: z.string().min(2),
  type: z.enum(["uptime", "patches", "health_check", "log_monitoring", "performance"]),
});

const reportSchema = z.object({
  template_id: z.coerce.number(),
  project_id: z.coerce.number(),
  period: z.string().min(2),
  data_json: z.string().min(2),
});

const ticketSchema = z.object({
  project_id: z.coerce.number(),
  issue_type: z.enum([
    "application_crash",
    "service_interruption",
    "el_image_retrieval_failure",
    "slow_image_loading",
    "database_issue",
    "integration_issue",
    "access_functional_issue",
    "authentication_authorization_issue",
    "ui_functionality_error",
    "data_corruption",
    "db_indexing_problem",
    "file_storage_issue",
    "network_related_issue",
  ]),
  priority: z.enum(["P1", "P2", "P3"]),
  title: z.string().min(2),
  description: z.string().min(2),
  details: z.string().optional(),
  source: z.enum(["email", "manual"]),
  reported_on: z.string().optional(),
});

const calendarSchema = z.object({
  project_id: z.coerce.number().optional(),
  type: z.string().min(1),
  title: z.string().min(2),
  due_date: z.string().min(5),
  owner_id: z.coerce.number(),
  color: z.string().optional(),
  meeting_link: z.string().optional(),
  description: z.string().optional(),
  status: z.enum(["scheduled", "in_progress", "done", "overdue", "cancelled"]).optional(),
  is_milestone: z.boolean().optional(),
});

function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="grid gap-1.5">
      <span className="text-xs font-medium text-on-surface-variant">{label}</span>
      {children}
      {error ? <span className="text-xs text-red-600 dark:text-red-400">{error}</span> : null}
    </label>
  );
}

function PageHeader({
  title,
  description,
  action,
  index = 0,
}: {
  title: string;
  description: string;
  action?: React.ReactNode;
  index?: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04 }}
      className="mb-5 flex flex-col gap-3 border-b border-gray-200 pb-4 md:flex-row md:items-end md:justify-between"
    >
      <div>
        <h1 className="font-display text-2xl font-semibold tracking-tight text-surface-bright">{title}</h1>
        <p className="mt-1 text-sm text-on-surface-variant">{description}</p>
      </div>
      {action}
    </motion.div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="mb-3 font-display text-sm font-semibold text-surface-bright">
      {children}
    </h2>
  );
}

function FormPanel({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <Card className="overflow-hidden p-0">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        {description ? <CardDescription>{description}</CardDescription> : null}
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

function DataPanel({
  title,
  description,
  count,
  children,
}: {
  title: string;
  description?: string;
  count?: number;
  children: React.ReactNode;
}) {
  return (
    <Card className="overflow-hidden p-0">
      <CardHeader className="flex flex-row items-center justify-between gap-4">
        <div>
          <CardTitle>{title}</CardTitle>
          {description ? <CardDescription>{description}</CardDescription> : null}
        </div>
        {count !== undefined ? (
          <span className="rounded-sm bg-surface-container-low px-2 py-0.5 text-xs font-medium text-on-surface-variant">
            {count} total
          </span>
        ) : null}
      </CardHeader>
      <div className="border-t border-outline-variant/20">{children}</div>
    </Card>
  );
}

function formatLabel(value: string) {
  return value
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function ListItem({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-sm border border-outline-variant/30 bg-surface-container-low/50 px-4 py-3 ${className ?? ""}`}>
      {children}
    </div>
  );
}

function SummaryCard({
  title,
  value,
  icon,
  index = 0,
}: {
  title: string;
  value: string | number;
  icon: React.ReactNode;
  index?: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04 }}
    >
      <Card className="px-5 py-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-medium text-on-surface-variant">{title}</p>
            <p className="mt-1 font-display text-2xl font-semibold text-surface-bright">{value}</p>
          </div>
          <div className="rounded-sm bg-primary/10 p-2 text-primary">{icon}</div>
        </div>
      </Card>
    </motion.div>
  );
}

function ticketStatusVariant(status: TicketRow["status"]): "danger" | "info" | "success" | "neutral" | "warning" {
  if (status === "open") return "danger";
  if (status === "in_progress") return "info";
  if (status === "in_review") return "warning";
  if (status === "resolved") return "success";
  return "neutral";
}

function priorityVariant(priority: TicketRow["priority"]): "danger" | "warning" | "neutral" {
  if (priority === "P1") return "danger";
  if (priority === "P2") return "warning";
  return "neutral";
}

function approvalVariant(status: string): "warning" | "success" | "neutral" {
  if (status === "pending") return "warning";
  if (status === "approved") return "success";
  return "neutral";
}

function useProjects() {
  return useQuery({
    queryKey: ["projects"],
    queryFn: () => api.get<Project[]>("/projects"),
  });
}

function useTickets() {
  return useQuery({
    queryKey: ["tickets"],
    queryFn: () => api.get<TicketRow[]>("/tickets"),
  });
}

function useReports() {
  return useQuery({
    queryKey: ["reports"],
    queryFn: () => api.get<ReportRow[]>("/reports"),
  });
}

function useApprovals() {
  return useQuery({
    queryKey: ["approvals"],
    queryFn: () => api.get<ApprovalRow[]>("/approvals"),
  });
}

function useEvents() {
  return useQuery({
    queryKey: ["calendar"],
    queryFn: () => api.get<EventRow[]>("/calendar"),
  });
}

export function LoginPage() {
  const { login } = useAuth();
  const form = useForm<z.infer<typeof loginSchema>>({
    resolver: zodResolver(loginSchema),
    defaultValues: { identifier: "admin@example.com", password: "admin12345" },
  });

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      await login(values.identifier.trim(), values.password);
      toast.success("Signed in successfully");
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unable to sign in. Check your credentials.";
      toast.error(
        message.includes("401") || message.toLowerCase().includes("invalid")
          ? "Invalid email / employee ID or password"
          : message,
      );
    }
  });

  return (
    <div className="flex min-h-screen w-full bg-gray-50">
      {/* ~70% — brand panel */}
      <div className="relative hidden min-h-screen overflow-hidden bg-[#090E34] lg:flex lg:w-[70%] lg:flex-col lg:justify-between">
        <div className="pointer-events-none absolute inset-0">
          <div className="login-blob login-blob-a absolute -left-24 -top-28 h-[28rem] w-[28rem] rounded-full bg-primary/40 blur-3xl" />
          <div className="login-blob login-blob-b absolute right-[12%] top-[18%] h-80 w-80 rounded-full bg-[#6366F1]/30 blur-3xl" />
          <div className="login-blob login-blob-c absolute bottom-[8%] left-[28%] h-[26rem] w-[26rem] rounded-full bg-[#0EA5E9]/25 blur-3xl" />
          <div className="login-blob login-blob-d absolute -bottom-20 right-[-4%] h-72 w-72 rounded-full bg-[#14B8A6]/20 blur-3xl" />
          <div
            className="absolute inset-0 opacity-[0.09]"
            style={{
              backgroundImage:
                "radial-gradient(circle at 1px 1px, rgba(255,255,255,0.55) 1px, transparent 0)",
              backgroundSize: "32px 32px",
            }}
          />
          <div className="absolute inset-y-0 right-0 w-40 bg-gradient-to-l from-black/25 to-transparent" />
        </div>

        <div className="relative z-10 px-14 pt-12 xl:px-20">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-md bg-primary shadow-sm">
              <span className="text-sm font-bold text-white">A</span>
            </div>
            <div>
              <p className="text-sm font-semibold tracking-tight text-white">AMC Ops</p>
              <p className="text-[11px] font-medium tracking-wide text-white/45">
                Enterprise support console
              </p>
            </div>
          </div>
        </div>

        <div className="relative z-10 px-14 pb-16 xl:px-20">
          <div className="mb-5 h-px w-12 bg-primary" />
          <p className="mb-4 text-[11px] font-semibold uppercase tracking-[0.22em] text-primary-300">
            Operations platform
          </p>
          <h1 className="max-w-2xl text-[2.75rem] font-bold leading-[1.15] tracking-tight text-white xl:text-5xl">
            Support delivery,
            <br />
            under control.
          </h1>
          <p className="mt-5 max-w-lg text-[15px] leading-relaxed text-white/60">
            Manage projects, tickets, reports, and approvals from a single workspace built for
            AMC operations teams.
          </p>

          <div className="mt-10 grid max-w-xl grid-cols-3 gap-6 border-t border-white/10 pt-8">
            {[
              { label: "Tickets", value: "Tracked" },
              { label: "Reports", value: "On schedule" },
              { label: "Approvals", value: "Clear flow" },
            ].map((item) => (
              <div key={item.label}>
                <p className="text-[11px] font-medium uppercase tracking-wider text-white/40">
                  {item.label}
                </p>
                <p className="mt-1 text-sm font-semibold text-white/90">{item.value}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ~30% — sign-in panel */}
      <div className="flex min-h-screen w-full flex-col border-l border-gray-200 bg-white lg:w-[30%] lg:min-w-[24rem] lg:max-w-none">
        <div className="flex flex-1 flex-col justify-center px-7 py-10 sm:px-9">
          <div className="mb-8 lg:hidden">
            <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-md bg-primary">
              <span className="text-sm font-bold text-white">A</span>
            </div>
            <p className="text-sm font-semibold text-gray-900">AMC Ops</p>
          </div>

          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-primary">
            Sign in
          </p>
          <h2 className="mt-2 text-xl font-semibold tracking-tight text-gray-900">
            Welcome back
          </h2>
          <p className="mt-1.5 text-sm leading-relaxed text-gray-500">
            Use your work email or employee ID to continue.
          </p>

          <form className="mt-8 flex flex-col gap-4" onSubmit={onSubmit}>
            <FormField
              label="Email or Employee ID"
              error={form.formState.errors.identifier?.message}
              icon={IdCard}
            >
              <Controller
                control={form.control}
                name="identifier"
                render={({ field }) => (
                  <IconInput
                    placeholder="email@company.com or EMP-001"
                    autoComplete="username"
                    name={field.name}
                    value={field.value}
                    onBlur={field.onBlur}
                    onChange={(event) => {
                      const next =
                        typeof event === "string"
                          ? event
                          : ((event as React.ChangeEvent<HTMLInputElement>).target?.value ?? "");
                      field.onChange(next);
                    }}
                  />
                )}
              />
            </FormField>

            <FormField label="Password" error={form.formState.errors.password?.message}>
              <Controller
                control={form.control}
                name="password"
                render={({ field }) => (
                  <PasswordInput
                    icon={Lock}
                    placeholder="Enter your password"
                    autoComplete="current-password"
                    name={field.name}
                    value={field.value}
                    onBlur={field.onBlur}
                    onChange={(event) => {
                      const next =
                        typeof event === "string"
                          ? event
                          : ((event as React.ChangeEvent<HTMLInputElement>).target?.value ?? "");
                      field.onChange(next);
                    }}
                  />
                )}
              />
            </FormField>

            <button
              type="submit"
              disabled={form.formState.isSubmitting}
              className="mt-3 flex w-full items-center justify-center rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-white transition hover:bg-primary-dark focus:outline-none focus:ring-4 focus:ring-primary/20 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {form.formState.isSubmitting ? "Signing in..." : "Sign in"}
            </button>
          </form>
        </div>

        <div className="border-t border-gray-100 px-7 py-4 sm:px-9">
          <p className="text-[11px] text-gray-400">
            Authorized personnel only · AMC Ops
          </p>
        </div>
      </div>
    </div>
  );
}

export function DashboardPage() {
  const tickets = useTickets();
  const reports = useReports();
  const approvals = useApprovals();
  const events = useEvents();

  const ticketData = tickets.data ?? [];
  const reportData = reports.data ?? [];
  const approvalData = approvals.data ?? [];
  const eventData = events.data ?? [];

  const ticketStatusChart = [
    { name: "Open", value: ticketData.filter((item) => item.status === "open").length, color: "#ef4444" },
    { name: "In Progress", value: ticketData.filter((item) => item.status === "in_progress").length, color: "#38bdf8" },
    { name: "Resolved", value: ticketData.filter((item) => item.status === "resolved").length, color: "#34d399" },
    { name: "Closed", value: ticketData.filter((item) => item.status === "closed").length, color: "#9ca3af" },
  ];

  const reportChart = [
    { name: "On Time", value: reportData.filter((item) => item.status === "approved").length },
    { name: "Late / Pending", value: reportData.filter((item) => item.status !== "approved").length },
  ];

  return (
    <div>
      <PageHeader
        title="Dashboard"
        description="A compact view of workload, approvals, and scheduled activity."
      />
      <div className="space-y-6">
      <div className="grid gap-4 lg:grid-cols-4">
        <SummaryCard
          title="Open Tickets"
          value={ticketData.filter((item) => item.status !== "closed").length}
          icon={<Ticket className="h-5 w-5" />}
          index={1}
        />
        <SummaryCard
          title="Pending Approvals"
          value={approvalData.filter((item) => item.status === "pending").length}
          icon={<ShieldCheck className="h-5 w-5" />}
          index={2}
        />
        <SummaryCard title="Reports" value={reportData.length} icon={<ClipboardList className="h-5 w-5" />} index={3} />
        <SummaryCard
          title="Upcoming Events"
          value={eventData.length}
          icon={<CalendarClock className="h-5 w-5" />}
          index={4}
        />
      </div>
      <div className="grid gap-4 xl:grid-cols-[1.2fr_1fr_1fr]">
        <Card className="px-5 py-4">
          <div className="mb-3 flex items-center justify-between">
            <SectionTitle>Pending approvals</SectionTitle>
            <Link className="text-sm font-medium text-primary hover:text-primary/80" to="/projects">
              View projects
            </Link>
          </div>
          <div className="grid gap-3">
            {approvalData.slice(0, 5).map((item) => (
              <ListItem key={item.id}>
                <div className="flex items-center justify-between gap-3">
                  <span className="font-mono text-[10px] text-surface-bright">
                    {item.entity_type} #{item.entity_id}
                  </span>
                  <Badge variant={approvalVariant(item.status)} pulse={item.status === "pending"} format>
                    {item.status}
                  </Badge>
                </div>
              </ListItem>
            ))}
            {!approvalData.length ? (
              <p className="text-sm text-on-surface-variant">No approvals are pending right now.</p>
            ) : null}
          </div>
        </Card>
        <Card className="px-5 py-4">
          <SectionTitle>Ticket status</SectionTitle>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={ticketStatusChart} dataKey="value" innerRadius={60} outerRadius={88}>
                  {ticketStatusChart.map((entry) => (
                    <Cell key={entry.name} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </Card>
        <Card className="px-5 py-4">
          <SectionTitle>Report timeliness</SectionTitle>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={reportChart}>
                <XAxis dataKey="name" tick={{ fill: "#6b7280", fontSize: 11 }} />
                <YAxis allowDecimals={false} tick={{ fill: "#6b7280", fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="value" fill="#0284c7" radius={[2, 2, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>
      </div>
    </div>
  );
}

export function ProjectsPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const projects = useProjects();
  const canCreateProject = user?.role === "admin" || user?.role === "team_lead";
  const [createOpen, setCreateOpen] = useState(false);

  const directory = useQuery({
    queryKey: ["users-directory"],
    queryFn: () =>
      api.get<
        Array<{ id: number; name: string; role: string; email: string; designation: string | null }>
      >("/users/directory"),
    enabled: canCreateProject && createOpen,
  });

  const form = useForm<z.infer<typeof projectSchema>>({
    resolver: zodResolver(projectSchema),
    defaultValues: {
      project_no: "",
      name: "",
      client_name: "",
      customer_name: "",
      details: "",
      company_address: "",
      status: "active",
      team_lead_id: user?.id,
      member_ids: [],
      contact_persons: [{ name: "", designation: "", email: "", phone: "" }],
    },
  });

  const contacts = useFieldArray({
    control: form.control,
    name: "contact_persons",
  });

  const watchedMemberIds = form.watch("member_ids") ?? [];
  const memberCandidates = (directory.data ?? []).filter(
    (item) => item.role === "team_member" || item.role === "team_lead" || item.role === "admin",
  );

  function openCreate() {
    form.reset({
      project_no: "",
      name: "",
      client_name: "",
      customer_name: "",
      details: "",
      company_address: "",
      status: "active",
      team_lead_id: user?.id,
      member_ids: [],
      contact_persons: [{ name: "", designation: "", email: "", phone: "" }],
    });
    setCreateOpen(true);
  }

  function closeCreate() {
    setCreateOpen(false);
    form.reset();
    if (searchParams.get("create") === "1") {
      const next = new URLSearchParams(searchParams);
      next.delete("create");
      setSearchParams(next, { replace: true });
    }
  }

  useEffect(() => {
    if (!canCreateProject) return;
    if (searchParams.get("create") === "1" && !createOpen) {
      openCreate();
    }
    // openCreate is intentionally stable enough for create=1 deep link
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canCreateProject, searchParams]);

  const createMutation = useMutation({
    mutationFn: async (values: z.infer<typeof projectSchema>) => {
      const data = new FormData();
      const contactPersons = values.contact_persons
        .filter((person) => person.name?.trim())
        .map((person) => ({
          name: person.name!.trim(),
          designation: person.designation || null,
          email: person.email || null,
          phone: person.phone || null,
        }));
      const leadId = user?.role === "team_lead" ? user.id : values.team_lead_id ?? user?.id;
      const memberIds = Array.from(
        new Set([...(values.member_ids ?? []), ...(leadId ? [leadId] : [])]),
      );

      data.append("project_no", values.project_no);
      data.append("name", values.name);
      data.append("client_name", values.client_name);
      data.append("customer_name", values.customer_name);
      data.append("details", values.details ?? "");
      data.append("company_address", values.company_address);
      data.append("status", values.status);
      data.append("team_lead_id", leadId ? String(leadId) : "");
      data.append("member_ids", JSON.stringify(memberIds));
      data.append("contact_persons", JSON.stringify(contactPersons));
      return api.postForm<Project>("/projects", data);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["projects"] });
      toast.success("Project created");
      closeCreate();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  function onSubmit(values: z.infer<typeof projectSchema>) {
    createMutation.mutate({
      ...values,
      contact_persons: values.contact_persons.filter((person) => person.name?.trim()),
    });
  }

  function onInvalid(errors: FieldErrors<z.infer<typeof projectSchema>>) {
    function firstMessage(err: FieldErrors<z.infer<typeof projectSchema>>): string | undefined {
      for (const value of Object.values(err)) {
        if (!value) continue;
        if (typeof value === "object" && "message" in value && value.message) {
          return String(value.message);
        }
        if (typeof value === "object") {
          const nested = firstMessage(value as FieldErrors<z.infer<typeof projectSchema>>);
          if (nested) return nested;
        }
      }
      return undefined;
    }
    toast.error(firstMessage(errors) ?? "Please complete the required fields before saving.");
  }

  const statusTheme: Record<
    Project["status"],
    {
      badge: "success" | "warning" | "danger" | "info" | "neutral";
      accent: string;
      soft: string;
      ring: string;
    }
  > = {
    active: {
      badge: "success",
      accent: "bg-success",
      soft: "from-success-light/80 to-white",
      ring: "hover:border-success/40 hover:shadow-success/10",
    },
    on_hold: {
      badge: "warning",
      accent: "bg-warning",
      soft: "from-warning-light/80 to-white",
      ring: "hover:border-warning/40 hover:shadow-warning/10",
    },
    completed: {
      badge: "info",
      accent: "bg-info",
      soft: "from-info-light/90 to-white",
      ring: "hover:border-info/40 hover:shadow-info/10",
    },
    cancelled: {
      badge: "danger",
      accent: "bg-danger",
      soft: "from-danger-light/80 to-white",
      ring: "hover:border-danger/40 hover:shadow-danger/10",
    },
  };

  return (
    <div>
      <PageHeader
        title="Projects"
        description="Client support projects, ownership, and member assignments."
      />
      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        {(projects.data ?? []).map((project, index) => {
          const docCount = project.documents?.length ?? 0;
          const contactCount = project.contact_persons?.filter((person) => person.name?.trim()).length ?? 0;
          const theme = statusTheme[project.status];

          return (
            <motion.div
              key={project.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.04 }}
            >
              <Link to={`/projects/${project.id}`} className="block h-full">
                <Card
                  className={`relative h-full overflow-hidden border border-gray-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md ${theme.ring}`}
                >
                  <div className={`absolute inset-x-0 top-0 h-1 ${theme.accent}`} />
                  <CardHeader className={`bg-gradient-to-b ${theme.soft} pb-0 pt-6`}>
                    <CardAction>
                      <Badge variant={theme.badge} format>
                        {project.status}
                      </Badge>
                    </CardAction>
                    <p className="inline-flex rounded-md bg-primary/10 px-2 py-0.5 font-mono text-[11px] font-semibold tracking-wide text-primary">
                      {project.project_no}
                    </p>
                    <CardTitle className="mt-2 pr-24 text-lg text-gray-900 md:text-xl">{project.name}</CardTitle>
                    <CardDescription className="mt-1.5 flex items-center gap-1.5 text-sm text-gray-600">
                      <span className="inline-flex h-6 w-6 items-center justify-center rounded-md bg-primary/10 text-primary">
                        <Building2 className="h-3.5 w-3.5" />
                      </span>
                      <span className="truncate">{project.client_name}</span>
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="pt-3">
                    <div className="space-y-2 text-sm text-gray-600">
                      {project.customer_name ? (
                        <p className="flex items-center gap-1.5 truncate">
                          <span className="inline-flex h-6 w-6 items-center justify-center rounded-md bg-success/10 text-success-dark">
                            <User className="h-3.5 w-3.5" />
                          </span>
                          {project.customer_name}
                        </p>
                      ) : null}
                      {project.details ? (
                        <p className="line-clamp-2 text-xs leading-5 text-gray-500">{project.details}</p>
                      ) : null}
                    </div>
                    <div className="mt-4 flex flex-wrap gap-2">
                      <span className="inline-flex items-center gap-1 rounded-md bg-primary/10 px-2 py-1 text-[11px] font-medium text-primary">
                        <Users className="h-3 w-3" />
                        {project.member_ids.length} members
                      </span>
                      <span className="inline-flex items-center gap-1 rounded-md bg-success-light px-2 py-1 text-[11px] font-medium text-success-dark">
                        <User className="h-3 w-3" />
                        {contactCount} contacts
                      </span>
                      <span className="inline-flex items-center gap-1 rounded-md bg-info-light px-2 py-1 text-[11px] font-medium text-info-dark">
                        <FileText className="h-3 w-3" />
                        {docCount} docs
                      </span>
                    </div>
                  </CardContent>
                  <CardFooter className="mt-auto flex items-center justify-between border-t border-primary/10 bg-primary-light/40 pt-3">
                    <span className="text-xs font-medium text-primary/70">Open project</span>
                    <span className="inline-flex items-center gap-1 text-sm font-semibold text-primary">
                      View details
                      <ArrowRight className="h-3.5 w-3.5" />
                    </span>
                  </CardFooter>
                </Card>
              </Link>
            </motion.div>
          );
        })}
      </div>

      {createOpen ? (
        <div className="fixed inset-0 z-50 flex justify-end">
          <button
            type="button"
            aria-label="Close panel"
            className="absolute inset-0 bg-gray-900/40 backdrop-blur-[1px]"
            onClick={closeCreate}
          />
          <motion.aside
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            transition={{ type: "spring", stiffness: 320, damping: 34 }}
            className="relative flex h-full w-full max-w-none flex-col bg-white shadow-2xl sm:w-1/2"
            role="dialog"
            aria-modal="true"
          >
            <div className="flex items-center justify-between gap-4 border-b border-primary/10 bg-primary-light px-5 py-3.5">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-primary shadow-sm">
                  <FolderKanban className="h-4 w-4 text-white" />
                </div>
                <div>
                  <h2 className="text-sm font-semibold text-gray-900">Add project</h2>
                  <p className="text-xs text-gray-600">
                    {user?.role === "team_lead"
                      ? "You’ll be set as team lead for this project."
                      : "Create a client support project and assign the team."}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={closeCreate}
                className="inline-flex h-8 w-8 items-center justify-center rounded-md text-gray-500 hover:bg-white/70"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form
              className="flex min-h-0 flex-1 flex-col"
              onSubmit={form.handleSubmit(onSubmit, onInvalid)}
            >
              <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-4">
                <div className="grid gap-3 sm:grid-cols-2">
                  <FormField label="Project no" error={form.formState.errors.project_no?.message} icon={Hash}>
                    <Controller
                      control={form.control}
                      name="project_no"
                      render={({ field }) => <IconInput placeholder="e.g. ISP2022503" {...field} />}
                    />
                  </FormField>
                  <FormField label="Status" error={form.formState.errors.status?.message}>
                    <Select {...form.register("status")}>
                      <option value="active">Active</option>
                      <option value="on_hold">On hold</option>
                      <option value="completed">Completed</option>
                      <option value="cancelled">Cancelled</option>
                    </Select>
                  </FormField>
                </div>
                <FormField label="Project name" error={form.formState.errors.name?.message} icon={FolderKanban}>
                  <Controller
                    control={form.control}
                    name="name"
                    render={({ field }) => <IconInput placeholder="Project name" {...field} />}
                  />
                </FormField>
                <FormField label="Client company" error={form.formState.errors.client_name?.message} icon={Building2}>
                  <Controller
                    control={form.control}
                    name="client_name"
                    render={({ field }) => <IconInput placeholder="Client company" {...field} />}
                  />
                </FormField>
                <FormField label="Customer name" error={form.formState.errors.customer_name?.message} icon={User}>
                  <Controller
                    control={form.control}
                    name="customer_name"
                    render={({ field }) => <IconInput placeholder="Primary customer contact" {...field} />}
                  />
                </FormField>
                <FormField label="Company address" error={form.formState.errors.company_address?.message} icon={MapPin}>
                  <Controller
                    control={form.control}
                    name="company_address"
                    render={({ field }) => <IconInput placeholder="Address" {...field} />}
                  />
                </FormField>
                <FormField label="Details" error={form.formState.errors.details?.message}>
                  <Textarea rows={3} {...form.register("details")} placeholder="Project overview" />
                </FormField>

                <div className="rounded-lg border border-gray-100 bg-gray-50/70 p-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Team lead</p>
                  <p className="mt-1 text-sm font-medium text-gray-900">
                    {user?.name ?? "You"}
                    <span className="ml-1 text-xs font-normal text-gray-500">
                      {user?.role === "team_lead" ? "(you)" : "(will be set as lead)"}
                    </span>
                  </p>
                </div>

                <div className="space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Team members</p>
                  <div className="max-h-40 space-y-1.5 overflow-y-auto rounded-lg border border-gray-200 p-2">
                    {directory.isLoading ? (
                      <p className="px-1 py-2 text-xs text-gray-400">Loading people…</p>
                    ) : memberCandidates.length === 0 ? (
                      <p className="px-1 py-2 text-xs text-gray-400">No users available to assign.</p>
                    ) : (
                      memberCandidates
                        .filter((item) => item.id !== user?.id)
                        .map((item) => {
                          const checked = watchedMemberIds.includes(item.id);
                          return (
                            <label
                              key={item.id}
                              className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-gray-50"
                            >
                              <input
                                type="checkbox"
                                className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                                checked={checked}
                                onChange={(event) => {
                                  const next = event.target.checked
                                    ? [...watchedMemberIds, item.id]
                                    : watchedMemberIds.filter((id) => id !== item.id);
                                  form.setValue("member_ids", next, { shouldDirty: true });
                                }}
                              />
                              <span className="min-w-0 flex-1 truncate font-medium text-gray-800">{item.name}</span>
                              <span className="text-[11px] text-gray-400">{item.role.replace(/_/g, " ")}</span>
                            </label>
                          );
                        })
                    )}
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                      Contact persons
                    </p>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => contacts.append({ name: "", designation: "", email: "", phone: "" })}
                    >
                      <Plus className="h-3.5 w-3.5" />
                      Add
                    </Button>
                  </div>
                  {form.formState.errors.contact_persons?.message ||
                  form.formState.errors.contact_persons?.root?.message ? (
                    <p className="text-xs text-danger">
                      {String(
                        form.formState.errors.contact_persons?.message ||
                          form.formState.errors.contact_persons?.root?.message,
                      )}
                    </p>
                  ) : null}
                  <div className="space-y-3">
                    {contacts.fields.map((field, index) => (
                      <div key={field.id} className="grid gap-2 rounded-lg border border-gray-100 p-3 sm:grid-cols-2">
                        <FormField label="Name" icon={User}>
                          <Controller
                            control={form.control}
                            name={`contact_persons.${index}.name`}
                            render={({ field: f }) => <IconInput placeholder="Name" {...f} />}
                          />
                        </FormField>
                        <FormField label="Designation" icon={Briefcase}>
                          <Controller
                            control={form.control}
                            name={`contact_persons.${index}.designation`}
                            render={({ field: f }) => <IconInput placeholder="Role" {...f} />}
                          />
                        </FormField>
                        <FormField label="Email" icon={Mail}>
                          <Controller
                            control={form.control}
                            name={`contact_persons.${index}.email`}
                            render={({ field: f }) => <IconInput type="email" placeholder="Email" {...f} />}
                          />
                        </FormField>
                        <FormField label="Phone" icon={Phone}>
                          <Controller
                            control={form.control}
                            name={`contact_persons.${index}.phone`}
                            render={({ field: f }) => <IconInput placeholder="Phone" {...f} />}
                          />
                        </FormField>
                        {contacts.fields.length > 1 ? (
                          <button
                            type="button"
                            className="text-left text-xs text-danger sm:col-span-2"
                            onClick={() => contacts.remove(index)}
                          >
                            Remove contact
                          </button>
                        ) : null}
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="flex shrink-0 items-center justify-end gap-2 border-t border-gray-100 px-5 py-3">
                <Button type="button" size="sm" variant="ghost" onClick={closeCreate}>
                  Cancel
                </Button>
                <Button type="submit" size="sm" disabled={createMutation.isPending}>
                  {createMutation.isPending ? "Creating…" : "Create project"}
                </Button>
              </div>
            </form>
          </motion.aside>
        </div>
      ) : null}
    </div>
  );
}

export function ProjectDetailPage() {
  const { id } = useParams();
  const projectId = Number(id);
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const projects = useProjects();
  const reports = useReports();
  const tickets = useTickets();
  const approvals = useApprovals();
  const projectEventsQuery = useQuery({
    queryKey: ["calendar", projectId],
    queryFn: () => api.get<EventRow[]>(`/calendar?project_id=${projectId}`),
    enabled: Number.isFinite(projectId) && projectId > 0,
  });
  const reportTypesQuery = useQuery({
    queryKey: ["project-report-types", projectId],
    queryFn: () => api.get<ReportType[]>(`/projects/${projectId}/report-types`),
    enabled: Number.isFinite(projectId) && projectId > 0,
  });

  const [activeTab, setActiveTab] = useState<
    "details" | "tickets" | "reports" | "calendar" | "approvals" | "issues"
  >("details");
  const [managedConfirmOpen, setManagedConfirmOpen] = useState(false);
  const [managedPassword, setManagedPassword] = useState("");
  const [previewDoc, setPreviewDoc] = useState<{
    title: string;
    filename: string;
    contentType: string | null;
    blobUrl: string;
    arrayBuffer?: ArrayBuffer;
  } | null>(null);

  const project = (projects.data ?? []).find((item) => item.id === projectId);
  const teamLead = project?.team_lead ?? null;
  const members = (project?.members ?? []).filter((member) => member.id !== project?.team_lead_id);
  const contacts = (project?.contact_persons ?? []).filter((person) => person.name?.trim());
  const documents = project?.documents ?? [];

  const projectTickets = (tickets.data ?? []).filter((item) => item.project_id === projectId);
  const projectReports = (reports.data ?? []).filter((item) => item.project_id === projectId);
  const projectEvents = projectEventsQuery.data ?? [];
  const reportLibraryTypes = reportTypesQuery.data ?? [];
  const reportLibraryDocs = reportLibraryTypes.reduce(
    (sum, item) => sum + (item.documents?.length ?? 0),
    0,
  );
  const canManageReports =
    user?.role === "admin" || Boolean(project?.team_lead_id && project.team_lead_id === user?.id);
  const reportIds = new Set(projectReports.map((item) => item.id));
  const ticketIds = new Set(projectTickets.map((item) => item.id));
  const projectApprovals = (approvals.data ?? []).filter((item) => {
    if (item.entity_type === "report_submission") return reportIds.has(item.entity_id);
    if (item.entity_type === "rca_document" || item.entity_type === "ticket") {
      return ticketIds.has(item.entity_id);
    }
    return false;
  });

  const approvalMutation = useMutation({
    mutationFn: ({ id: approvalId, approved }: { id: number; approved: boolean }) =>
      api.post(`/approvals/${approvalId}/decision`, { approved }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["approvals"] });
      toast.success("Decision saved");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const canEnableProjectManagement = user?.role === "admin" && !project?.is_managed_project;

  const managedMutation = useMutation({
    mutationFn: (password: string) =>
      api.patch<Project>(`/projects/${projectId}/managed`, { password }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["projects"] });
      setManagedConfirmOpen(false);
      setManagedPassword("");
      toast.success("Project management enabled");
    },
    onError: (error: Error) => {
      let message = error.message;
      try {
        const parsed = JSON.parse(error.message) as { detail?: string };
        if (parsed?.detail) message = parsed.detail;
      } catch {
        /* keep raw */
      }
      toast.error(message);
    },
  });

  const tabs = [
    { id: "details" as const, label: "Details" },
    { id: "tickets" as const, label: "Tickets", count: projectTickets.length },
    {
      id: "reports" as const,
      label: "Reports",
      count: reportLibraryDocs || reportLibraryTypes.length || projectReports.length,
    },
    { id: "calendar" as const, label: "Calendar", count: projectEvents.length },
    { id: "approvals" as const, label: "Approvals", count: projectApprovals.length },
    ...(project?.is_managed_project
      ? [{ id: "issues" as const, label: "Issues" }]
      : []),
  ];

  async function openDocumentPreview(document: ProjectDocument) {
    try {
      const blob = await api.getBlob(`/projects/${projectId}/documents/${document.id}/content`);
      const resolvedType = document.content_type || blob.type;
      const blobUrl = URL.createObjectURL(blob);
      const arrayBuffer = needsArrayBufferPreview(resolvedType, document.filename)
        ? await blob.arrayBuffer()
        : undefined;
      setPreviewDoc({
        title: document.title || documentCategoryLabel(document.category),
        filename: document.filename,
        contentType: resolvedType,
        blobUrl,
        arrayBuffer,
      });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to open document");
    }
  }

  function closeDocumentPreview() {
    setPreviewDoc((current) => {
      if (current?.blobUrl) URL.revokeObjectURL(current.blobUrl);
      return null;
    });
  }

  useEffect(() => {
    return () => {
      if (previewDoc?.blobUrl) URL.revokeObjectURL(previewDoc.blobUrl);
    };
  }, [previewDoc?.blobUrl]);

  if (!projects.isLoading && !project) {
    return (
      <div>
        <PageHeader title="Project not found" description="This project may have been removed." />
        <Link to="/projects" className="inline-flex items-center gap-1.5 text-sm font-medium text-primary">
          <ArrowLeft className="h-4 w-4" />
          Back to projects
        </Link>
      </div>
    );
  }

  return (
    <div className="w-full">
      <Link
        to="/projects"
        className="mb-5 inline-flex items-center gap-1.5 text-[13px] font-medium text-gray-500 transition hover:text-primary"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Back to projects
      </Link>

      <div className="relative overflow-hidden rounded-2xl border border-gray-200/80 bg-white shadow-sm">
        <div className="absolute inset-x-0 top-0 h-24 bg-gradient-to-br from-primary/10 via-info/5 to-transparent" />
        <div className="relative border-b border-gray-100 px-5 pt-5 sm:px-7">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="min-w-0 pb-1">
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <span className="rounded-md bg-primary/10 px-2 py-0.5 font-mono text-[11px] font-semibold tracking-wide text-primary">
                  {project?.project_no ?? "—"}
                </span>
                {project ? (
                  <Badge
                    variant={
                      project.status === "active"
                        ? "success"
                        : project.status === "on_hold"
                          ? "warning"
                          : project.status === "cancelled"
                            ? "danger"
                            : "info"
                    }
                    format
                  >
                    {project.status}
                  </Badge>
                ) : null}
              </div>
              <h1 className="font-display text-2xl font-semibold tracking-tight text-gray-900 sm:text-[28px]">
                {project?.name ?? "Project"}
              </h1>
              <p className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-gray-500">
                <span className="inline-flex items-center gap-1.5">
                  <Building2 className="h-3.5 w-3.5 text-primary/70" />
                  {project?.client_name ?? "—"}
                </span>
                {project?.customer_name ? (
                  <>
                    <span className="text-gray-300">·</span>
                    <span className="inline-flex items-center gap-1.5">
                      <User className="h-3.5 w-3.5 text-success/80" />
                      {project.customer_name}
                    </span>
                  </>
                ) : null}
              </p>
            </div>

            <nav className="-mb-px flex gap-1 overflow-x-auto pb-px" aria-label="Project sections">
              {tabs.map((tab) => {
                const active = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setActiveTab(tab.id)}
                    className={`inline-flex shrink-0 items-center gap-1.5 rounded-t-lg border-b-2 px-3.5 py-2.5 text-sm font-medium transition-colors ${
                      active
                        ? "border-primary bg-primary/[0.04] text-primary"
                        : "border-transparent text-gray-500 hover:bg-gray-50 hover:text-gray-800"
                    }`}
                  >
                    {tab.label}
                    {"count" in tab && tab.count !== undefined ? (
                      <span
                        className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${
                          active ? "bg-primary text-white" : "bg-gray-100 text-gray-500"
                        }`}
                      >
                        {tab.count}
                      </span>
                    ) : null}
                  </button>
                );
              })}
            </nav>
          </div>
        </div>

        <div className="px-5 py-6 sm:px-7">
        {activeTab === "details" ? (
          <div className="space-y-8">
            <section>
              <div className="mb-4 flex items-center gap-2">
                <span className="h-4 w-1 rounded-full bg-primary" />
                <h2 className="text-sm font-semibold text-gray-900">Overview</h2>
              </div>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {[
                  { label: "Project No", value: project?.project_no, mono: true },
                  { label: "Project name", value: project?.name },
                  { label: "Status", value: project?.status ? formatLabel(project.status) : null },
                  { label: "Client company", value: project?.client_name },
                  { label: "Customer name", value: project?.customer_name },
                  { label: "Company address", value: project?.company_address },
                ].map((item) => (
                  <div
                    key={item.label}
                    className="rounded-xl border border-gray-100 bg-gray-50/70 px-3.5 py-3"
                  >
                    <p className="text-[11px] font-medium uppercase tracking-wide text-gray-400">{item.label}</p>
                    <p className={`mt-1 text-sm font-medium text-gray-900 ${item.mono ? "font-mono" : ""}`}>
                      {item.value?.trim() ? item.value : "—"}
                    </p>
                  </div>
                ))}
              </div>
              {project?.is_managed_project || user?.role === "admin" ? (
                <div className="mt-3 flex flex-col gap-3 rounded-xl border border-gray-100 bg-white px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-900">Enable project management</p>
                    <p className="mt-0.5 text-xs text-gray-500">
                      Turns on Epics, Stories, Sprints and the Issues tab for delivery work.
                      {project?.is_managed_project
                        ? " This is permanently enabled for this project."
                        : " Admin only · requires password · cannot be undone."}
                    </p>
                  </div>
                  {project?.is_managed_project ? (
                    <span className="inline-flex shrink-0 items-center gap-2 rounded-lg bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-700">
                      <ShieldCheck className="h-4 w-4" />
                      Enabled
                    </span>
                  ) : canEnableProjectManagement ? (
                    <Button
                      type="button"
                      size="default"
                      className="h-11 min-w-[9.5rem] shrink-0 px-5 text-sm font-semibold"
                      disabled={managedMutation.isPending}
                      onClick={() => {
                        setManagedPassword("");
                        setManagedConfirmOpen(true);
                      }}
                    >
                      Enable
                    </Button>
                  ) : null}
                </div>
              ) : null}
              {project?.details ? (
                <div className="mt-3 rounded-xl border border-gray-100 bg-gradient-to-br from-primary/[0.03] to-transparent px-4 py-3.5">
                  <p className="text-[11px] font-medium uppercase tracking-wide text-primary/70">Details</p>
                  <p className="mt-1.5 text-sm leading-6 text-gray-700 whitespace-pre-wrap">{project.details}</p>
                </div>
              ) : null}
            </section>

            <section>
              <div className="mb-4 flex items-center gap-2">
                <span className="h-4 w-1 rounded-full bg-success" />
                <h2 className="text-sm font-semibold text-gray-900">Team</h2>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-xl border border-gray-100 bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
                  <p className="mb-3 text-[11px] font-medium uppercase tracking-wide text-gray-400">Team lead</p>
                  {teamLead ? (
                    <div className="flex items-center gap-3">
                      <UserAvatar name={teamLead.name} size="md" />
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-gray-900">{teamLead.name}</p>
                        <p className="truncate text-xs text-gray-500">{teamLead.designation || teamLead.email}</p>
                        <span className="mt-1 inline-flex rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">
                          Lead
                        </span>
                      </div>
                    </div>
                  ) : (
                    <p className="text-sm text-gray-400">Unassigned</p>
                  )}
                </div>
                <div className="rounded-xl border border-gray-100 bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
                  <p className="mb-3 text-[11px] font-medium uppercase tracking-wide text-gray-400">
                    Members ({members.length})
                  </p>
                  {members.length === 0 ? (
                    <p className="text-sm text-gray-400">No members assigned</p>
                  ) : (
                    <div className="space-y-2.5">
                      {members.map((member) => (
                        <div key={member.id} className="flex items-center gap-3">
                          <UserAvatar name={member.name} />
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium text-gray-900">{member.name}</p>
                            <p className="truncate text-xs text-gray-500">{member.designation || member.email}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </section>

            <section>
              <div className="mb-4 flex items-center gap-2">
                <span className="h-4 w-1 rounded-full bg-info" />
                <h2 className="text-sm font-semibold text-gray-900">Contact persons</h2>
              </div>
              {contacts.length === 0 ? (
                <p className="text-sm text-gray-400">No contacts added.</p>
              ) : (
                <div className="overflow-hidden rounded-xl border border-gray-100">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-gray-50/80">
                      <tr className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">
                        <th className="px-4 py-2.5 font-semibold">Name</th>
                        <th className="px-4 py-2.5 font-semibold">Designation</th>
                        <th className="px-4 py-2.5 font-semibold">Email</th>
                        <th className="px-4 py-2.5 font-semibold">Phone</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {contacts.map((person, index) => (
                        <tr key={`${person.name}-${index}`} className="hover:bg-gray-50/50">
                          <td className="px-4 py-3 font-medium text-gray-900">{person.name}</td>
                          <td className="px-4 py-3 text-gray-600">{person.designation || "—"}</td>
                          <td className="px-4 py-3 text-gray-600">{person.email || "—"}</td>
                          <td className="px-4 py-3 text-gray-600">{person.phone || "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            <section>
              <div className="mb-4 flex items-center gap-2">
                <span className="h-4 w-1 rounded-full bg-warning" />
                <h2 className="text-sm font-semibold text-gray-900">Documents</h2>
              </div>
              {documents.length === 0 ? (
                <p className="text-sm text-gray-400">No documents uploaded.</p>
              ) : (
                <div className="grid gap-2 sm:grid-cols-2">
                  {documents.map((doc) => (
                    <button
                      key={doc.id}
                      type="button"
                      onClick={() => openDocumentPreview(doc)}
                      className="flex items-center gap-3 rounded-xl border border-gray-100 bg-white px-3.5 py-3 text-left shadow-[0_1px_2px_rgba(15,23,42,0.04)] transition hover:border-primary/25 hover:bg-primary/[0.03]"
                    >
                      <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                        <FileText className="h-4 w-4" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold text-gray-900">
                          {doc.title || doc.filename}
                        </span>
                        <span className="block truncate text-xs text-gray-500">
                          {documentCategoryLabel(doc.category)} · {doc.filename}
                        </span>
                      </span>
                      <Eye className="h-4 w-4 shrink-0 text-primary/70" />
                    </button>
                  ))}
                </div>
              )}
            </section>
          </div>
        ) : null}

        {activeTab === "tickets" ? <ProjectTicketsPanel projectId={projectId} /> : null}

        {activeTab === "issues" && project?.is_managed_project ? (
          <ProjectIssuesPanel
            projectId={projectId}
            members={[
              ...(project.team_lead ? [project.team_lead] : []),
              ...((project.members ?? []).filter((m) => m.id !== project.team_lead_id)),
            ]}
          />
        ) : null}

        {activeTab === "reports" ? (
          <ProjectReportLibrary projectId={projectId} canManage={canManageReports} />
        ) : null}

        {activeTab === "calendar" ? <ProjectCalendarPanel projectId={projectId} /> : null}

        {activeTab === "approvals" ? (
          projectApprovals.length === 0 ? (
            <p className="py-10 text-center text-sm text-gray-400">No approvals linked to this project.</p>
          ) : (
            <div className="divide-y divide-gray-50">
              {projectApprovals.map((item) => (
                <div
                  key={item.id}
                  className="flex flex-col gap-3 py-3 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div>
                    <p className="font-mono text-[11px] text-gray-500">
                      {formatLabel(item.entity_type)} #{item.entity_id}
                    </p>
                    <div className="mt-1">
                      <Badge variant={approvalVariant(item.status)} pulse={item.status === "pending"} format>
                        {item.status}
                      </Badge>
                    </div>
                  </div>
                  {item.status === "pending" ? (
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={approvalMutation.isPending}
                        onClick={() => approvalMutation.mutate({ id: item.id, approved: false })}
                      >
                        Reject
                      </Button>
                      <Button
                        size="sm"
                        disabled={approvalMutation.isPending}
                        onClick={() => approvalMutation.mutate({ id: item.id, approved: true })}
                      >
                        Approve
                      </Button>
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          )
        ) : null}
        </div>
      </div>

      <Backdrop
        isOpen={Boolean(previewDoc)}
        onOpenChange={(open) => (!open ? closeDocumentPreview() : null)}
      >
        <Modal>
          <div
            className="fixed left-1/2 top-1/2 flex h-[min(90vh,880px)] w-full max-w-5xl -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-xl border border-gray-200 bg-white shadow-xl outline-none max-sm:max-w-[calc(100%-1.5rem)]"
            role="dialog"
            aria-modal="true"
          >
            <div className="flex items-start justify-between gap-3 border-b border-gray-100 px-5 py-4">
              <div className="min-w-0">
                <h2 className="truncate text-base font-semibold text-gray-900">{previewDoc?.title}</h2>
                <p className="truncate text-xs text-gray-500">{previewDoc?.filename}</p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                {previewDoc ? (
                  <a
                    href={previewDoc.blobUrl}
                    download={previewDoc.filename}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50"
                  >
                    <Download className="h-3.5 w-3.5" />
                    Download
                  </a>
                ) : null}
                <button
                  type="button"
                  onClick={closeDocumentPreview}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-md text-gray-500 hover:bg-gray-100"
                  aria-label="Close preview"
                >
                  <X className="h-4 w-4" />
                </button>
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
                ) : (
                  <iframe
                    title={previewDoc.filename}
                    src={previewDoc.blobUrl}
                    className="h-full w-full rounded-lg border border-gray-200 bg-white"
                  />
                )
              ) : previewDoc ? (
                <div className="flex h-full flex-col items-center justify-center gap-3 rounded-lg bg-white p-8 text-center">
                  <FileText className="h-10 w-10 text-primary" />
                  <p className="text-sm text-gray-700">
                    {isLegacyDocDocument(previewDoc.contentType, previewDoc.filename)
                      ? "Legacy .doc files can’t be previewed in the browser. Re-save as .docx, or download to open locally."
                      : "Preview is not available for this file type. Download it to open locally."}
                  </p>
                  <a
                    href={previewDoc.blobUrl}
                    download={previewDoc.filename}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-dark"
                  >
                    <Download className="h-3.5 w-3.5" />
                    Download {previewDoc.filename}
                  </a>
                </div>
              ) : null}
            </div>
          </div>
        </Modal>
      </Backdrop>

      <Backdrop
        isOpen={managedConfirmOpen}
        onOpenChange={(open) => {
          if (!open) {
            setManagedConfirmOpen(false);
            setManagedPassword("");
          }
        }}
      >
        <Modal>
          <div
            className="fixed left-1/2 top-1/2 w-full max-w-none -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-xl outline-none sm:w-1/2 max-sm:max-w-[calc(100%-1.5rem)]"
            role="dialog"
            aria-modal="true"
          >
            <DialogHeader className="border-b border-gray-100 px-5 py-4">
              <DialogTitle>Enable project management</DialogTitle>
              <DialogDescription>
                This permanently unlocks Issues (Epics, Stories, Sprints) for this project. Enter
                your admin password to confirm. This cannot be reversed.
              </DialogDescription>
            </DialogHeader>
            <DialogBody className="space-y-3 px-5 py-4">
              <FormField label="Your password" icon={Lock}>
                <PasswordInput
                  value={managedPassword}
                  onChange={(next) =>
                    setManagedPassword(typeof next === "string" ? next : String(next ?? ""))
                  }
                  autoComplete="current-password"
                  placeholder="Confirm with your password"
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && managedPassword.trim()) {
                      e.preventDefault();
                      managedMutation.mutate(managedPassword);
                    }
                  }}
                />
              </FormField>
            </DialogBody>
            <DialogFooter className="gap-2 border-t border-gray-100 px-5 py-3">
              <Button
                type="button"
                variant="outline"
                size="default"
                className="h-10 min-w-[5.5rem]"
                disabled={managedMutation.isPending}
                onClick={() => {
                  setManagedConfirmOpen(false);
                  setManagedPassword("");
                }}
              >
                Cancel
              </Button>
              <Button
                type="button"
                size="default"
                className="h-10 min-w-[7.5rem] px-4 font-semibold"
                disabled={!managedPassword.trim() || managedMutation.isPending}
                onClick={() => managedMutation.mutate(managedPassword)}
              >
                {managedMutation.isPending ? "Enabling…" : "Confirm enable"}
              </Button>
            </DialogFooter>
          </div>
        </Modal>
      </Backdrop>
    </div>
  );
}

export function ReportsPage() {
  const reports = useReports();
  return (
    <div>
      <PageHeader
        title="Reports"
        description="Track report submission status across all active projects."
        action={
          <Link to="/reports/new">
            <Button>New submission</Button>
          </Link>
        }
      />
      <DataPanel title="All reports" count={(reports.data ?? []).length}>
        <TableContainer>
          <Table>
            <TableHead>
              <TableHeaderRow>
                <TableHeaderCell>ID</TableHeaderCell>
                <TableHeaderCell>Project</TableHeaderCell>
                <TableHeaderCell>Period</TableHeaderCell>
                <TableHeaderCell>Status</TableHeaderCell>
                <TableHeaderCell>Created</TableHeaderCell>
              </TableHeaderRow>
            </TableHead>
            <TableBody>
              {(reports.data ?? []).map((item) => (
                <TableRow key={item.id}>
                  <TableCell mono>#{item.id}</TableCell>
                  <TableCell mono>{item.project_id}</TableCell>
                  <TableCell mono>{item.period}</TableCell>
                  <TableCell>
                    <Badge variant={item.status === "approved" ? "success" : "warning"} format>
                      {item.status}
                    </Badge>
                  </TableCell>
                  <TableCell mono>{formatDate(item.created_at)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </DataPanel>
    </div>
  );
}

export function NewReportPage() {
  const queryClient = useQueryClient();
  const projects = useProjects();
  const templates = useQuery({
    queryKey: ["templates"],
    queryFn: () => api.get<Array<{ id: number; name: string }>>("/templates"),
  });
  const form = useForm<z.infer<typeof reportSchema>>({
    resolver: zodResolver(reportSchema),
    defaultValues: { data_json: "{\"summary\":\"\"}" },
  });

  const mutation = useMutation({
    mutationFn: async (values: z.infer<typeof reportSchema>) =>
      api.post("/reports", { ...values, data_json: JSON.parse(values.data_json) }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["reports"] });
      form.reset({ data_json: "{\"summary\":\"\"}" });
    },
  });

  return (
    <div className="w-full">
      <PageHeader title="New report" description="Capture and submit a recurring support report." />
      <FormPanel title="Report details">
        <form className="grid gap-4" onSubmit={form.handleSubmit((values) => mutation.mutate(values))}>
          <Field label="Template ID" error={form.formState.errors.template_id?.message}>
            <Input list="templates" {...form.register("template_id")} />
            <datalist id="templates">
              {(templates.data ?? []).map((template) => (
                <option key={template.id} value={template.id}>{template.name}</option>
              ))}
            </datalist>
          </Field>
          <Field label="Project ID" error={form.formState.errors.project_id?.message}>
            <Input list="projects" {...form.register("project_id")} />
            <datalist id="projects">
              {(projects.data ?? []).map((project) => (
                <option key={project.id} value={project.id}>{project.name}</option>
              ))}
            </datalist>
          </Field>
          <Field label="Period" error={form.formState.errors.period?.message}>
            <Input placeholder="Jul-2026" {...form.register("period")} />
          </Field>
          <Field label="Report JSON" error={form.formState.errors.data_json?.message}>
            <Textarea className="min-h-48 font-mono text-xs" {...form.register("data_json")} />
          </Field>
          <Button type="submit" className="w-full">Save draft</Button>
        </form>
      </FormPanel>
    </div>
  );
}

export function AdminTemplatesPage() {
  const queryClient = useQueryClient();
  const templates = useQuery({
    queryKey: ["templates"],
    queryFn: () => api.get<Array<{ id: number; name: string; type: string }>>("/templates"),
  });
  const form = useForm<z.infer<typeof templateSchema>>({
    resolver: zodResolver(templateSchema),
    defaultValues: { type: "uptime" },
  });

  const mutation = useMutation({
    mutationFn: (values: z.infer<typeof templateSchema>) =>
      api.post("/templates", { ...values, schema_json: { fields: [] } }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["templates"] });
      form.reset({ type: "uptime", name: "" });
    },
  });

  return (
    <div>
      <PageHeader title="Templates" description="Define report templates for recurring operational reporting." />
      <div className="grid gap-6 lg:grid-cols-[minmax(280px,360px)_1fr] lg:items-start">
        <FormPanel title="New template" description="Create a reusable report structure.">
          <form className="grid gap-4" onSubmit={form.handleSubmit((values) => mutation.mutate(values))}>
            <Field label="Template name" error={form.formState.errors.name?.message}>
              <Input {...form.register("name")} />
            </Field>
            <Field label="Type" error={form.formState.errors.type?.message}>
              <Select {...form.register("type")}>
                <option value="uptime">Uptime</option>
                <option value="patches">Patches</option>
                <option value="health_check">Health Check</option>
                <option value="log_monitoring">Log Monitoring</option>
                <option value="performance">Performance</option>
              </Select>
            </Field>
            <Button type="submit" className="w-full">Create template</Button>
          </form>
        </FormPanel>
        <DataPanel title="All templates" count={(templates.data ?? []).length}>
          <div className="grid gap-3 p-5">
            {(templates.data ?? []).map((item) => (
              <ListItem key={item.id}>
                <div className="flex items-center justify-between gap-3">
                  <span className="font-medium text-surface-bright">{item.name}</span>
                  <Badge variant="info" format>{item.type}</Badge>
                </div>
              </ListItem>
            ))}
          </div>
        </DataPanel>
      </div>
    </div>
  );
}

export function TicketsPage() {
  const queryClient = useQueryClient();
  const tickets = useTickets();
  const projects = useProjects();
  const form = useForm<z.infer<typeof ticketSchema>>({
    resolver: zodResolver(ticketSchema),
    defaultValues: {
      issue_type: "application_crash",
      priority: "P2",
      source: "manual",
    },
  });

  const mutation = useMutation({
    mutationFn: (values: z.infer<typeof ticketSchema>) =>
      api.post("/tickets", {
        ...values,
        category: "incident",
        reported_on: values.reported_on ? new Date(values.reported_on).toISOString() : undefined,
        details: values.details?.trim() || undefined,
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["tickets"] });
      form.reset({
        issue_type: "application_crash",
        priority: "P2",
        source: "manual",
        title: "",
        description: "",
        details: "",
        reported_on: "",
      });
      toast.success("Ticket raised");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const columns: Array<TicketRow["status"]> = [
    "open",
    "in_progress",
    "in_review",
    "resolved",
    "closed",
  ];

  return (
    <div>
      <PageHeader title="Tickets" description="Operational issue tracking with table and board visibility." />
      <div className="grid gap-6 lg:grid-cols-[minmax(280px,360px)_1fr] lg:items-start">
        <FormPanel title="Raise ticket" description="Log a maintenance issue from email complaints or manual intake.">
          <form className="grid gap-4" onSubmit={form.handleSubmit((values) => mutation.mutate(values))}>
            <Field label="Project" error={form.formState.errors.project_id?.message}>
              <Input list="project-list" {...form.register("project_id")} />
              <datalist id="project-list">
                {(projects.data ?? []).map((project) => (
                  <option key={project.id} value={project.id}>{project.name}</option>
                ))}
              </datalist>
            </Field>
            <Field label="Issue" error={form.formState.errors.title?.message}>
              <Input {...form.register("title")} placeholder="Short issue title" />
            </Field>
            <Field label="Issue type" error={form.formState.errors.issue_type?.message}>
              <Select {...form.register("issue_type")}>
                {TICKET_ISSUE_TYPES.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </Select>
            </Field>
            <Field label="Priority" error={form.formState.errors.priority?.message}>
              <Select {...form.register("priority")}>
                <option value="P1">P1</option>
                <option value="P2">P2</option>
                <option value="P3">P3</option>
              </Select>
            </Field>
            <Field label="Source" error={form.formState.errors.source?.message}>
              <Select {...form.register("source")}>
                <option value="manual">Manual entry</option>
                <option value="email">Email complaint</option>
              </Select>
            </Field>
            <Field label="Reported on" error={form.formState.errors.reported_on?.message}>
              <Input type="datetime-local" {...form.register("reported_on")} />
            </Field>
            <Field label="Description" error={form.formState.errors.description?.message}>
              <Textarea {...form.register("description")} placeholder="What happened?" />
            </Field>
            <Field label="Additional details" error={form.formState.errors.details?.message}>
              <Textarea {...form.register("details")} placeholder="Environment, URLs, error messages…" />
            </Field>
            <Button type="submit" className="w-full" disabled={mutation.isPending}>
              {mutation.isPending ? "Raising…" : "Raise ticket"}
            </Button>
          </form>
        </FormPanel>
        <div className="space-y-4">
          <DataPanel title="All tickets" count={(tickets.data ?? []).length}>
            <TableContainer>
              <Table>
                <TableHead>
                  <TableHeaderRow>
                    <TableHeaderCell>Ticket</TableHeaderCell>
                    <TableHeaderCell>Type</TableHeaderCell>
                    <TableHeaderCell>Priority</TableHeaderCell>
                    <TableHeaderCell>Status</TableHeaderCell>
                    <TableHeaderCell>Reported</TableHeaderCell>
                  </TableHeaderRow>
                </TableHead>
                <TableBody>
                  {(tickets.data ?? []).map((item) => (
                    <TableRow key={item.id}>
                      <TableCell>
                        <Link className="font-medium text-surface-bright hover:text-primary" to={`/tickets/${item.id}`}>
                          #{item.ticket_number ?? item.id} · {item.title}
                        </Link>
                      </TableCell>
                      <TableCell muted>{issueTypeLabelFromValue(item.issue_type)}</TableCell>
                      <TableCell>
                        <Badge variant={priorityVariant(item.priority)}>{item.priority}</Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={ticketStatusVariant(item.status)} pulse={item.status === "open"} format>
                          {item.status}
                        </Badge>
                      </TableCell>
                      <TableCell mono>{formatDate(item.reported_on ?? item.created_at)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </DataPanel>
          <div className="grid gap-4 xl:grid-cols-4">
            {columns.map((column) => (
              <Card key={column} className="px-4 py-3">
                <h3 className="mb-3 text-xs font-medium text-on-surface-variant">
                  {formatLabel(column)}
                </h3>
                <div className="grid gap-3">
                  {(tickets.data ?? [])
                    .filter((ticket) => ticket.status === column)
                    .map((item) => (
                      <ListItem key={item.id}>
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-sm font-bold text-surface-bright">{item.title}</span>
                          <Badge variant={priorityVariant(item.priority)}>{item.priority}</Badge>
                        </div>
                      </ListItem>
                    ))}
                </div>
              </Card>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export function TicketDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const ticketId = Number(id);
  const ticket = useQuery({
    queryKey: ["ticket", ticketId],
    queryFn: () => api.get<TicketRow>(`/tickets/${ticketId}`),
  });

  function closeTicketPage() {
    if (window.history.length > 1) {
      navigate(-1);
      return;
    }
    if (ticket.data?.project_id) {
      navigate(`/projects/${ticket.data.project_id}`);
      return;
    }
    navigate("/tickets");
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={ticket.data ? `Ticket #${ticket.data.ticket_number ?? ticket.data.id}` : "Ticket detail"}
        description="Maintenance issue tracking with conversation, resolution, attachments, and history."
        action={
          <div className="flex flex-wrap items-center gap-2">
            {ticket.data?.project_id ? (
              <Link
                to={`/projects/${ticket.data.project_id}`}
                className="inline-flex h-9 items-center rounded-lg border border-gray-200 bg-white px-3 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
              >
                Back to project
              </Link>
            ) : null}
            <button
              type="button"
              onClick={closeTicketPage}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
              aria-label="Close ticket"
            >
              <X className="size-4" />
              Close
            </button>
          </div>
        }
      />
      <TicketDetailPanel ticketId={ticketId} />
    </div>
  );
}

export function CalendarPage() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const events = useEvents();
  const projects = useProjects();
  const form = useForm<z.infer<typeof calendarSchema>>({
    resolver: zodResolver(calendarSchema),
    defaultValues: { owner_id: user?.id ?? 1, type: "custom" },
  });

  const mutation = useMutation({
    mutationFn: (values: z.infer<typeof calendarSchema>) => api.post("/calendar", values),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["calendar"] });
      form.reset({ owner_id: user?.id ?? 1, type: "custom", title: "", due_date: "" });
    },
  });

  return (
    <div className="space-y-6">
      <PageHeader title="Calendar" description="Shared operational due dates, reminders, and recurring support events." />
      <div className="grid gap-4 xl:grid-cols-[360px_1fr]">
        <Card className="px-6 py-5">
          <form className="grid gap-4" onSubmit={form.handleSubmit((values) => mutation.mutate(values))}>
            <Field label="Title" error={form.formState.errors.title?.message}>
              <Input {...form.register("title")} />
            </Field>
            <Field label="Project ID">
              <Input list="calendar-projects" {...form.register("project_id")} />
              <datalist id="calendar-projects">
                {(projects.data ?? []).map((project) => (
                  <option key={project.id} value={project.id}>{project.name}</option>
                ))}
              </datalist>
            </Field>
            <Field label="Type" error={form.formState.errors.type?.message}>
              <Select {...form.register("type")}>
                <option value="meeting">Meeting</option>
                <option value="milestone">Milestone</option>
                <option value="deadline">Deadline</option>
                <option value="update">Update / Tracking</option>
                <option value="custom">Custom</option>
                <option value="health_check">Health Check</option>
                <option value="db_restoration">DB Restoration</option>
                <option value="report_due">Report Due</option>
              </Select>
            </Field>
            <Field label="Due Date" error={form.formState.errors.due_date?.message}>
              <Input type="datetime-local" {...form.register("due_date")} />
            </Field>
            <Field label="Owner ID" error={form.formState.errors.owner_id?.message}>
              <Input {...form.register("owner_id")} />
            </Field>
            <Button type="submit">Schedule Event</Button>
          </form>
        </Card>
        <Card className="px-6 py-5">
          <FullCalendar
            plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
            initialView="dayGridMonth"
            height={720}
            events={(events.data ?? []).map((event) => ({
              id: String(event.id),
              title: event.title,
              start: event.start_at || event.due_date,
              end: event.end_at || event.due_date,
              color:
                event.color ||
                (event.status === "overdue"
                  ? "#ef4444"
                  : event.type === "custom"
                    ? "#0284c7"
                    : "#34d399"),
            }))}
          />
        </Card>
      </div>
    </div>
  );
}

export function ApprovalsPage() {
  const queryClient = useQueryClient();
  const approvals = useApprovals();

  const mutation = useMutation({
    mutationFn: ({ id, approved }: { id: number; approved: boolean }) =>
      api.post(`/approvals/${id}/decision`, { approved }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["approvals"] });
    },
  });

  return (
    <div className="space-y-6">
      <PageHeader title="Approvals" description="Decide pending reports, RCA documents, and ticket closure requests." />
      <div className="grid gap-4">
        {(approvals.data ?? []).map((item, index) => (
          <motion.div
            key={item.id}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.04 }}
          >
            <Card className="flex flex-col gap-4 px-6 py-5 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="font-mono text-[10px] text-surface-bright">
                  {item.entity_type} #{item.entity_id}
                </p>
                <p className="mt-1 text-sm text-on-surface-variant">
                  Current status:{" "}
                  <Badge variant={approvalVariant(item.status)} pulse={item.status === "pending"} format>
                    {item.status}
                  </Badge>
                </p>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => mutation.mutate({ id: item.id, approved: false })}>
                  Reject
                </Button>
                <Button onClick={() => mutation.mutate({ id: item.id, approved: true })}>Approve</Button>
              </div>
            </Card>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

export function AdminUsersPage() {
  const queryClient = useQueryClient();
  const [formOpen, setFormOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<{
    id: number;
    name: string;
    employee_id: string | null;
    email: string;
    phone: string | null;
    designation: string | null;
    role: string;
  } | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ id: number; name: string } | null>(null);

  const users = useQuery({
    queryKey: ["users"],
    queryFn: () =>
      api.get<
        Array<{
          id: number;
          name: string;
          employee_id: string | null;
          email: string;
          phone: string | null;
          designation: string | null;
          role: string;
          is_active: boolean;
        }>
      >("/users"),
  });

  const form = useForm<z.infer<typeof userSchema>>({
    resolver: zodResolver(userSchema),
    defaultValues: {
      role: "team_member",
      name: "",
      employee_id: "",
      email: "",
      phone: "",
      designation: "",
      password: "",
    },
  });

  const createMutation = useMutation({
    mutationFn: (values: z.infer<typeof userSchema>) => api.post("/users", values),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["users"] });
      toast.success("User created");
      closeForm();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, values }: { id: number; values: Partial<z.infer<typeof userSchema>> }) =>
      api.put(`/users/${id}`, values),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["users"] });
      toast.success("User updated");
      closeForm();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.delete(`/users/${id}`),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["users"] });
      toast.success("User deleted");
      setDeleteTarget(null);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  function openCreateForm() {
    setEditingUser(null);
    form.reset({
      role: "team_member",
      name: "",
      employee_id: "",
      email: "",
      phone: "",
      designation: "",
      password: "",
    });
    setFormOpen(true);
  }

  function openEditForm(user: NonNullable<typeof editingUser>) {
    setEditingUser(user);
    form.reset({
      name: user.name,
      employee_id: user.employee_id ?? "",
      email: user.email,
      phone: user.phone ?? "",
      designation: user.designation ?? "",
      role: user.role as z.infer<typeof userSchema>["role"],
      password: "",
    });
    setFormOpen(true);
  }

  function closeForm() {
    setFormOpen(false);
    setEditingUser(null);
    form.reset({
      role: "team_member",
      name: "",
      employee_id: "",
      email: "",
      phone: "",
      designation: "",
      password: "",
    });
  }

  function onSubmit(values: z.infer<typeof userSchema>) {
    if (editingUser) {
      const payload = { ...values };
      if (!payload.password) {
        delete payload.password;
      }
      updateMutation.mutate({ id: editingUser.id, values: payload });
      return;
    }

    if (!values.password) {
      form.setError("password", { message: "Password is required" });
      return;
    }

    createMutation.mutate(values);
  }

  const isSaving = createMutation.isPending || updateMutation.isPending;

  return (
    <div>
      <PageHeader
        title="Users"
        description="Admin-managed accounts for the internal support team."
        action={
          <Button size="sm" onClick={openCreateForm}>
            <UserPlus className="h-3.5 w-3.5" />
            Create user
          </Button>
        }
      />

      <Card className="gap-0 rounded-lg border border-gray-200 bg-white shadow-sm">
        <CardContent className="p-0">
          <TableContainer>
            <Table>
              <TableHead>
                <TableHeaderRow>
                  <TableHeaderCell>Name</TableHeaderCell>
                  <TableHeaderCell>Employee ID</TableHeaderCell>
                  <TableHeaderCell>Email</TableHeaderCell>
                  <TableHeaderCell>Phone</TableHeaderCell>
                  <TableHeaderCell>Designation</TableHeaderCell>
                  <TableHeaderCell>Role</TableHeaderCell>
                  <TableHeaderCell className="text-right">Actions</TableHeaderCell>
                </TableHeaderRow>
              </TableHead>
              <TableBody>
                {(users.data ?? []).map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="font-medium text-gray-900">
                      <div className="flex items-center gap-2.5">
                        <UserAvatar name={item.name} />
                        <span>{item.name}</span>
                      </div>
                    </TableCell>
                    <TableCell mono muted={!item.employee_id}>
                      {item.employee_id ?? "—"}
                    </TableCell>
                    <TableCell>{item.email}</TableCell>
                    <TableCell muted={!item.phone}>{item.phone ?? "—"}</TableCell>
                    <TableCell muted={!item.designation}>{item.designation ?? "—"}</TableCell>
                    <TableCell>
                      <Badge variant="neutral" format>{item.role}</Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <TableActions>
                        <TableIconButton
                          label={`Edit ${item.name}`}
                          onClick={() => openEditForm(item)}
                        >
                          <Pencil className="h-4 w-4" />
                        </TableIconButton>
                        <TableIconButton
                          label={`Delete ${item.name}`}
                          variant="danger"
                          onClick={() => setDeleteTarget({ id: item.id, name: item.name })}
                        >
                          <Trash2 className="h-4 w-4" />
                        </TableIconButton>
                      </TableActions>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </CardContent>
      </Card>

      <Backdrop isOpen={formOpen} onOpenChange={(open) => (open ? setFormOpen(true) : closeForm())}>
        <Modal>
          <div
            className="fixed left-1/2 top-1/2 w-full max-w-none -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-xl outline-none sm:w-1/2 max-sm:max-w-[calc(100%-2rem)]"
            role="dialog"
            aria-modal="true"
          >
            <div className="border-b border-primary/10 bg-primary-light px-5 py-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary shadow-sm">
                  {editingUser ? (
                    <Pencil className="h-5 w-5 text-white" />
                  ) : (
                    <UserPlus className="h-5 w-5 text-white" />
                  )}
                </div>
                <DialogHeader className="gap-0.5">
                  <DialogTitle className="text-base font-semibold text-gray-900">
                    {editingUser ? "Edit user" : "Create user"}
                  </DialogTitle>
                  <DialogDescription className="text-xs text-gray-600">
                    {editingUser
                      ? "Update team member details. Leave password blank to keep the current password."
                      : "Add a new team member to the platform."}
                  </DialogDescription>
                </DialogHeader>
              </div>
            </div>
            <form className="space-y-0" onSubmit={form.handleSubmit(onSubmit)}>
              <DialogBody className="px-5 py-4">
                <div className="flex flex-col gap-4">
                  <FormField label="Name" error={form.formState.errors.name?.message} icon={User}>
                    <Controller
                      control={form.control}
                      name="name"
                      render={({ field }) => <IconInput placeholder="Full name" {...field} />}
                    />
                  </FormField>
                  <FormField label="Employee ID" error={form.formState.errors.employee_id?.message} icon={IdCard}>
                    <Controller
                      control={form.control}
                      name="employee_id"
                      render={({ field }) => <IconInput placeholder="EMP-001" {...field} />}
                    />
                  </FormField>
                  <FormField label="Email" error={form.formState.errors.email?.message} icon={Mail}>
                    <Controller
                      control={form.control}
                      name="email"
                      render={({ field }) => <IconInput type="email" placeholder="email@company.com" {...field} />}
                    />
                  </FormField>
                  <FormField label="Phone" error={form.formState.errors.phone?.message} icon={Phone}>
                    <Controller
                      control={form.control}
                      name="phone"
                      render={({ field }) => <IconInput placeholder="+91 98765 43210" {...field} />}
                    />
                  </FormField>
                  <FormField
                    label="Designation"
                    error={form.formState.errors.designation?.message}
                    icon={Briefcase}
                  >
                    <Controller
                      control={form.control}
                      name="designation"
                      render={({ field }) => <IconInput placeholder="Support Engineer" {...field} />}
                    />
                  </FormField>
                  <FormField label="Role" error={form.formState.errors.role?.message} icon={Shield}>
                    <Controller
                      control={form.control}
                      name="role"
                      render={({ field }) => (
                        <Select {...field}>
                          <option value="admin">Admin</option>
                          <option value="team_lead">Team Lead</option>
                          <option value="team_member">Team Member</option>
                        </Select>
                      )}
                    />
                  </FormField>
                  <FormField
                    label={editingUser ? "Password (optional)" : "Password"}
                    error={form.formState.errors.password?.message}
                  >
                    <Controller
                      control={form.control}
                      name="password"
                      render={({ field }) => (
                        <PasswordInput
                          icon={Lock}
                          placeholder={editingUser ? "Leave blank to keep current" : "Min. 8 characters"}
                          {...field}
                        />
                      )}
                    />
                  </FormField>
                </div>
              </DialogBody>
              <DialogFooter className="border-t border-gray-100 bg-gray-50 px-5 py-3">
                <Button variant="outline" onClick={closeForm}>Cancel</Button>
                <Button disabled={isSaving} onClick={() => form.handleSubmit(onSubmit)()}>
                  {isSaving ? "Saving..." : editingUser ? "Save changes" : "Create user"}
                </Button>
              </DialogFooter>
            </form>
          </div>
        </Modal>
      </Backdrop>

      <Backdrop
        isOpen={Boolean(deleteTarget)}
        onOpenChange={(open) => (!open ? setDeleteTarget(null) : null)}
      >
        <Modal>
          <div
            className="w-full max-w-md max-sm:max-w-[calc(100%-2rem)] rounded-xl border border-base-100 bg-background-100 p-6 shadow-lg outline-none fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2"
            role="alertdialog"
            aria-modal="true"
          >
            <DialogHeader>
              <DialogTitle>Delete user</DialogTitle>
              <DialogDescription>
                Are you sure you want to delete {deleteTarget?.name}? This action cannot be undone.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter className="pt-4">
              <Button variant="outline" onClick={() => setDeleteTarget(null)}>Cancel</Button>
              <Button
                variant="destructive"
                disabled={deleteMutation.isPending}
                onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
              >
                {deleteMutation.isPending ? "Deleting..." : "Delete user"}
              </Button>
            </DialogFooter>
          </div>
        </Modal>
      </Backdrop>
    </div>
  );
}

export function AdminProjectsPage() {
  const queryClient = useQueryClient();
  const users = useQuery({
    queryKey: ["users"],
    queryFn: () =>
      api.get<Array<{ id: number; name: string; role: string; email: string; designation: string | null }>>(
        "/users",
      ),
  });
  const projects = useProjects();
  const [formOpen, setFormOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ id: number; name: string } | null>(null);
  const [pendingDocs, setPendingDocs] = useState<PendingProjectDocument[]>([]);
  const [docCategory, setDocCategory] = useState<ProjectDocumentCategory>("amc_terms");
  const [docTitle, setDocTitle] = useState("");
  const [docFile, setDocFile] = useState<File | null>(null);
  const [previewDoc, setPreviewDoc] = useState<{
    title: string;
    filename: string;
    contentType: string | null;
    blobUrl: string;
    arrayBuffer?: ArrayBuffer;
  } | null>(null);
  const [docsModal, setDocsModal] = useState<{
    projectId: number;
    projectName: string;
    documents: ProjectDocument[];
  } | null>(null);

  const form = useForm<z.infer<typeof projectSchema>>({
    resolver: zodResolver(projectSchema),
    defaultValues: {
      project_no: "",
      name: "",
      client_name: "",
      customer_name: "",
      details: "",
      company_address: "",
      status: "active",
      team_lead_id: undefined,
      member_ids: [],
      contact_persons: [{ name: "", designation: "", email: "", phone: "" }],
    },
  });

  const contacts = useFieldArray({
    control: form.control,
    name: "contact_persons",
  });

  const watchedLeadId = form.watch("team_lead_id");
  const watchedMemberIds = form.watch("member_ids") ?? [];

  const leadCandidates = (users.data ?? []).filter(
    (user) => user.role === "team_lead" || user.role === "admin",
  );
  const memberCandidates = (users.data ?? []).filter((user) => user.role === "team_member");

  function resetForm() {
    form.reset({
      project_no: "",
      name: "",
      client_name: "",
      customer_name: "",
      details: "",
      company_address: "",
      status: "active",
      team_lead_id: undefined,
      member_ids: [],
      contact_persons: [{ name: "", designation: "", email: "", phone: "" }],
    });
    setPendingDocs([]);
    setDocCategory("amc_terms");
    setDocTitle("");
    setDocFile(null);
    setEditingProject(null);
  }

  function openCreateForm() {
    resetForm();
    setFormOpen(true);
  }

  function openEditForm(project: Project) {
    setEditingProject(project);
    const leadId = project.team_lead_id ?? undefined;
    form.reset({
      project_no: project.project_no,
      name: project.name,
      client_name: project.client_name,
      customer_name: project.customer_name ?? "",
      details: project.details ?? "",
      company_address: project.company_address ?? "",
      status: project.status,
      team_lead_id: leadId,
      member_ids: (project.member_ids ?? []).filter((id) => id !== leadId),
      contact_persons:
        project.contact_persons?.length > 0
          ? project.contact_persons.map((person) => ({
              name: person.name,
              designation: person.designation ?? "",
              email: person.email ?? "",
              phone: person.phone ?? "",
            }))
          : [{ name: "", designation: "", email: "", phone: "" }],
    });
    setPendingDocs([]);
    setDocCategory("amc_terms");
    setDocTitle("");
    setDocFile(null);
    setFormOpen(true);
  }

  function closeForm() {
    setFormOpen(false);
    resetForm();
  }

  function buildFormData(values: z.infer<typeof projectSchema>) {
    const data = new FormData();
    const contactPersons = values.contact_persons
      .filter((person) => person.name?.trim())
      .map((person) => ({
        name: person.name!.trim(),
        designation: person.designation || null,
        email: person.email || null,
        phone: person.phone || null,
      }));

    data.append("project_no", values.project_no);
    data.append("name", values.name);
    data.append("client_name", values.client_name);
    data.append("customer_name", values.customer_name);
    data.append("details", values.details ?? "");
    data.append("company_address", values.company_address);
    data.append("status", values.status);

    const memberIds = Array.from(
      new Set([
        ...(values.member_ids ?? []),
        ...(values.team_lead_id ? [values.team_lead_id] : []),
      ]),
    );

    if (values.team_lead_id) {
      data.append("team_lead_id", String(values.team_lead_id));
    } else {
      data.append("team_lead_id", "");
    }
    data.append("member_ids", JSON.stringify(memberIds));
    data.append("contact_persons", JSON.stringify(contactPersons));
    return data;
  }

  async function uploadPendingDocuments(projectId: number) {
    for (const pending of pendingDocs) {
      const data = new FormData();
      data.append("category", pending.category);
      if (pending.title.trim()) {
        data.append("title", pending.title.trim());
      }
      data.append("file", pending.file);
      await api.postForm(`/projects/${projectId}/documents`, data);
    }
  }

  const createMutation = useMutation({
    mutationFn: async (values: z.infer<typeof projectSchema>) => {
      const project = await api.postForm<Project>("/projects", buildFormData(values));
      if (pendingDocs.length > 0) {
        await uploadPendingDocuments(project.id);
      }
      return project;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["projects"] });
      toast.success("Project created");
      closeForm();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, values }: { id: number; values: z.infer<typeof projectSchema> }) => {
      const project = await api.putForm<Project>(`/projects/${id}`, buildFormData(values));
      if (pendingDocs.length > 0) {
        await uploadPendingDocuments(id);
      }
      return project;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["projects"] });
      toast.success("Project updated");
      closeForm();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.delete(`/projects/${id}`),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["projects"] });
      toast.success("Project deleted");
      setDeleteTarget(null);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const deleteDocumentMutation = useMutation({
    mutationFn: ({ projectId, documentId }: { projectId: number; documentId: number }) =>
      api.delete(`/projects/${projectId}/documents/${documentId}`),
    onSuccess: async (_data, variables) => {
      await queryClient.invalidateQueries({ queryKey: ["projects"] });
      setEditingProject((current) => {
        if (!current || current.id !== variables.projectId) return current;
        return {
          ...current,
          documents: (current.documents ?? []).filter((doc) => doc.id !== variables.documentId),
        };
      });
      toast.success("Document removed");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const isSaving = createMutation.isPending || updateMutation.isPending;

  function queueDocument() {
    if (!docFile) {
      toast.error("Choose a file to upload");
      return;
    }
    setPendingDocs((current) => [
      ...current,
      {
        localId: `${Date.now()}-${docFile.name}`,
        category: docCategory,
        title: docTitle.trim() || documentCategoryLabel(docCategory),
        file: docFile,
      },
    ]);
    setDocFile(null);
    setDocTitle("");
    toast.success("Document queued — save the project to upload");
  }

  async function openDocumentPreview(projectId: number, document: ProjectDocument) {
    try {
      const blob = await api.getBlob(`/projects/${projectId}/documents/${document.id}/content`);
      const resolvedType = document.content_type || blob.type;
      const blobUrl = URL.createObjectURL(blob);
      const arrayBuffer = needsArrayBufferPreview(resolvedType, document.filename)
        ? await blob.arrayBuffer()
        : undefined;
      setPreviewDoc({
        title: document.title || documentCategoryLabel(document.category),
        filename: document.filename,
        contentType: resolvedType,
        blobUrl,
        arrayBuffer,
      });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to open document");
    }
  }

  function closeDocumentPreview() {
    setPreviewDoc((current) => {
      if (current?.blobUrl) {
        URL.revokeObjectURL(current.blobUrl);
      }
      return null;
    });
  }

  useEffect(() => {
    return () => {
      if (previewDoc?.blobUrl) {
        URL.revokeObjectURL(previewDoc.blobUrl);
      }
    };
  }, [previewDoc?.blobUrl]);

  function onSubmit(values: z.infer<typeof projectSchema>) {
    const payload = {
      ...values,
      contact_persons: values.contact_persons.filter((person) => person.name?.trim()),
    };

    if (editingProject) {
      updateMutation.mutate({ id: editingProject.id, values: payload });
      return;
    }
    createMutation.mutate(payload);
  }

  function onInvalid(errors: FieldErrors<z.infer<typeof projectSchema>>) {
    function firstMessage(err: FieldErrors<z.infer<typeof projectSchema>>): string | undefined {
      for (const value of Object.values(err)) {
        if (!value) continue;
        if (typeof value === "object" && "message" in value && value.message) {
          return String(value.message);
        }
        if (typeof value === "object") {
          const nested = firstMessage(value as FieldErrors<z.infer<typeof projectSchema>>);
          if (nested) return nested;
        }
      }
      return undefined;
    }

    toast.error(firstMessage(errors) ?? "Please complete the required fields before saving.");
  }

  const statusVariant: Record<Project["status"], "success" | "warning" | "neutral" | "danger"> = {
    active: "success",
    on_hold: "warning",
    completed: "neutral",
    cancelled: "danger",
  };

  const savedDocuments = editingProject?.documents ?? [];

  return (
    <div>
      <PageHeader
        title="Projects"
        description="Admin-managed client projects and AMC documentation."
        action={
          <Button size="sm" onClick={openCreateForm}>
            <FolderKanban className="h-3.5 w-3.5" />
            Create project
          </Button>
        }
      />

      <Card className="gap-0 rounded-lg border border-gray-200 bg-white shadow-sm">
        <CardContent className="p-0">
          <TableContainer>
            <Table>
              <TableHead>
                <TableHeaderRow>
                  <TableHeaderCell>Project No</TableHeaderCell>
                  <TableHeaderCell>Name</TableHeaderCell>
                  <TableHeaderCell>Client company</TableHeaderCell>
                  <TableHeaderCell>Customer</TableHeaderCell>
                  <TableHeaderCell>Status</TableHeaderCell>
                  <TableHeaderCell className="text-right">Actions</TableHeaderCell>
                </TableHeaderRow>
              </TableHead>
              <TableBody>
                {(projects.data ?? []).map((item) => {
                  const docs = item.documents ?? [];

                  return (
                    <TableRow key={item.id}>
                      <TableCell mono>{item.project_no}</TableCell>
                      <TableCell className="font-medium text-gray-900">{item.name}</TableCell>
                      <TableCell>{item.client_name}</TableCell>
                      <TableCell muted={!item.customer_name}>{item.customer_name ?? "—"}</TableCell>
                      <TableCell>
                        <Badge variant={statusVariant[item.status]} format>
                          {item.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <TableActions>
                          <button
                            type="button"
                            disabled={docs.length === 0}
                            onClick={() =>
                              setDocsModal({
                                projectId: item.id,
                                projectName: item.name,
                                documents: docs,
                              })
                            }
                            className="inline-flex items-center gap-1.5 rounded-md border border-gray-200 bg-white px-2.5 py-1.5 text-xs font-medium text-gray-700 transition hover:border-primary/30 hover:bg-primary/5 hover:text-primary disabled:cursor-not-allowed disabled:opacity-40"
                            title={docs.length === 0 ? "No documents" : `View ${docs.length} document${docs.length === 1 ? "" : "s"}`}
                          >
                            <FileText className="h-3.5 w-3.5" />
                            View docs
                            {docs.length > 0 ? (
                              <span className="rounded bg-gray-100 px-1.5 py-0.5 text-[10px] font-semibold text-gray-600">
                                {docs.length}
                              </span>
                            ) : null}
                          </button>
                          <TableIconButton label={`Edit ${item.name}`} onClick={() => openEditForm(item)}>
                            <Pencil className="h-4 w-4" />
                          </TableIconButton>
                          <TableIconButton
                            label={`Delete ${item.name}`}
                            variant="danger"
                            onClick={() => setDeleteTarget({ id: item.id, name: item.name })}
                          >
                            <Trash2 className="h-4 w-4" />
                          </TableIconButton>
                        </TableActions>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TableContainer>
        </CardContent>
      </Card>

      {formOpen ? (
        <div className="fixed inset-0 z-50 flex justify-end">
          <button
            type="button"
            aria-label="Close panel"
            className="absolute inset-0 bg-gray-900/40 backdrop-blur-[1px]"
            onClick={closeForm}
          />
          <motion.aside
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", stiffness: 320, damping: 34 }}
            className="relative flex h-full w-full max-w-none flex-col bg-white shadow-2xl sm:w-1/2"
            role="dialog"
            aria-modal="true"
          >
            <div className="flex items-center justify-between gap-4 border-b border-primary/10 bg-primary-light px-5 py-3.5">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-primary shadow-sm">
                  {editingProject ? (
                    <Pencil className="h-4 w-4 text-white" />
                  ) : (
                    <FolderKanban className="h-4 w-4 text-white" />
                  )}
                </div>
                <div>
                  <h2 className="text-sm font-semibold text-gray-900">
                    {editingProject ? "Edit project" : "Create project"}
                  </h2>
                  <p className="text-xs text-gray-600">
                    Client details, team, contacts, and documents
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={closeForm}
                className="inline-flex h-8 w-8 items-center justify-center rounded-md text-gray-500 hover:bg-white/70 hover:text-gray-800"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form
              className="flex min-h-0 flex-1 flex-col"
              noValidate
              onSubmit={form.handleSubmit(onSubmit, onInvalid)}
            >
              <div className="flex-1 overflow-y-auto">
                <div className="w-full space-y-4 px-5 py-4 lg:px-8">
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  <FormField className="gap-1" label="Project No" error={form.formState.errors.project_no?.message} icon={Hash}>
                    <Controller
                      control={form.control}
                      name="project_no"
                      render={({ field }) => (
                        <IconInput className="!rounded-md !py-1.5 !pr-3 text-sm" placeholder="PRJ-0001" {...field} />
                      )}
                    />
                  </FormField>
                  <FormField className="gap-1" label="Project name" error={form.formState.errors.name?.message} icon={FolderKanban}>
                    <Controller
                      control={form.control}
                      name="name"
                      render={({ field }) => (
                        <IconInput className="!rounded-md !py-1.5 !pr-3 text-sm" placeholder="Support engagement" {...field} />
                      )}
                    />
                  </FormField>
                  <FormField className="gap-1" label="Client company" error={form.formState.errors.client_name?.message} icon={Building2}>
                    <Controller
                      control={form.control}
                      name="client_name"
                      render={({ field }) => (
                        <IconInput className="!rounded-md !py-1.5 !pr-3 text-sm" placeholder="Acme Corp" {...field} />
                      )}
                    />
                  </FormField>
                  <FormField className="gap-1" label="Customer name" error={form.formState.errors.customer_name?.message} icon={User}>
                    <Controller
                      control={form.control}
                      name="customer_name"
                      render={({ field }) => (
                        <IconInput className="!rounded-md !py-1.5 !pr-3 text-sm" placeholder="Primary customer" {...field} />
                      )}
                    />
                  </FormField>
                </div>

                <div className="grid items-start gap-3 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_180px]">
                  <FormField className="gap-1" label="Details" error={form.formState.errors.details?.message}>
                    <Controller
                      control={form.control}
                      name="details"
                      render={({ field }) => (
                        <Textarea
                          rows={3}
                          className="!min-h-[84px] !rounded-md !px-3 !py-2 text-sm"
                          placeholder="Scope, notes, and delivery details"
                          {...field}
                        />
                      )}
                    />
                  </FormField>
                  <FormField
                    className="gap-1"
                    label="Company address"
                    error={form.formState.errors.company_address?.message}
                    icon={MapPin}
                  >
                    <Controller
                      control={form.control}
                      name="company_address"
                      render={({ field }) => (
                        <Textarea
                          rows={3}
                          className="!min-h-[84px] !rounded-md !py-2 !pr-3 text-sm"
                          placeholder="Company address"
                          {...field}
                        />
                      )}
                    />
                  </FormField>
                  <FormField className="gap-1" label="Status" error={form.formState.errors.status?.message}>
                    <Controller
                      control={form.control}
                      name="status"
                      render={({ field }) => (
                        <Select className="!rounded-md !px-3 !py-1.5 text-sm" {...field}>
                          <option value="active">Active</option>
                          <option value="on_hold">On hold</option>
                          <option value="completed">Completed</option>
                          <option value="cancelled">Cancelled</option>
                        </Select>
                      )}
                    />
                  </FormField>
                </div>

                <div className="rounded-md border border-gray-200 bg-gray-50/60 p-3">
                  <p className="mb-2 text-sm font-semibold text-gray-900">Team assignment</p>

                  <div className="grid gap-3 lg:grid-cols-2">
                    <div className="grid gap-1">
                      <div className="flex h-5 items-center justify-between">
                        <p className="text-xs font-medium text-gray-700">Team lead</p>
                        <span className="text-[11px] text-gray-400">
                          {watchedLeadId ? "1 selected" : "Optional"}
                        </span>
                      </div>
                      <Controller
                        control={form.control}
                        name="team_lead_id"
                        render={({ field }) => (
                          <div className="max-h-44 space-y-0.5 overflow-y-auto rounded-md border border-gray-200 bg-white p-1">
                            <label
                              className={`flex min-h-10 cursor-pointer items-center gap-2 rounded px-2 py-1.5 transition-colors ${
                                !field.value ? "bg-primary-light" : "hover:bg-gray-50"
                              }`}
                            >
                              <input
                                type="radio"
                                name="project-team-lead"
                                className="h-3.5 w-3.5 border-gray-300 text-primary focus:ring-primary"
                                checked={!field.value}
                                onChange={() => field.onChange(undefined)}
                              />
                              <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gray-100 text-[10px] font-semibold text-gray-500">
                                —
                              </span>
                              <div className="min-w-0 flex-1">
                                <p className="truncate text-sm font-medium text-gray-900">Unassigned</p>
                                <p className="truncate text-[11px] text-gray-500">No lead selected</p>
                              </div>
                            </label>
                            {leadCandidates.map((user) => {
                              const checked = field.value === user.id;
                              return (
                                <label
                                  key={user.id}
                                  className={`flex min-h-10 cursor-pointer items-center gap-2 rounded px-2 py-1.5 transition-colors ${
                                    checked ? "bg-primary-light" : "hover:bg-gray-50"
                                  }`}
                                >
                                  <input
                                    type="radio"
                                    name="project-team-lead"
                                    className="h-3.5 w-3.5 border-gray-300 text-primary focus:ring-primary"
                                    checked={checked}
                                    onChange={() => field.onChange(user.id)}
                                  />
                                  <UserAvatar name={user.name} />
                                  <div className="min-w-0 flex-1">
                                    <p className="truncate text-sm font-medium text-gray-900">{user.name}</p>
                                    <p className="truncate text-[11px] text-gray-500">
                                      {user.designation || user.email}
                                    </p>
                                  </div>
                                </label>
                              );
                            })}
                          </div>
                        )}
                      />
                      {form.formState.errors.team_lead_id?.message ? (
                        <p className="text-[11px] text-danger">{form.formState.errors.team_lead_id.message}</p>
                      ) : null}
                    </div>

                    <div className="grid gap-1">
                      <div className="flex h-5 items-center justify-between">
                        <p className="text-xs font-medium text-gray-700">Team members</p>
                        <span className="text-[11px] text-gray-400">{watchedMemberIds.length} selected</span>
                      </div>
                      <div className="max-h-44 space-y-0.5 overflow-y-auto rounded-md border border-gray-200 bg-white p-1">
                        {memberCandidates.length === 0 ? (
                          <p className="px-2 py-2 text-xs text-gray-400">No team members available.</p>
                        ) : (
                          memberCandidates.map((user) => {
                            const checked = watchedMemberIds.includes(user.id);
                            return (
                              <label
                                key={user.id}
                                className={`flex min-h-10 cursor-pointer items-center gap-2 rounded px-2 py-1.5 transition-colors ${
                                  checked ? "bg-primary-light" : "hover:bg-gray-50"
                                }`}
                              >
                                <input
                                  type="checkbox"
                                  className="h-3.5 w-3.5 rounded border-gray-300 text-primary focus:ring-primary"
                                  checked={checked}
                                  onChange={(event) => {
                                    const next = event.target.checked
                                      ? [...watchedMemberIds, user.id]
                                      : watchedMemberIds.filter((id) => id !== user.id);
                                    form.setValue("member_ids", next, { shouldDirty: true });
                                  }}
                                />
                                <UserAvatar name={user.name} />
                                <div className="min-w-0 flex-1">
                                  <p className="truncate text-sm font-medium text-gray-900">{user.name}</p>
                                  <p className="truncate text-[11px] text-gray-500">
                                    {user.designation || user.email}
                                  </p>
                                </div>
                              </label>
                            );
                          })
                        )}
                      </div>
                      {watchedLeadId ? (
                        <p className="text-[11px] text-gray-500">Team lead is included automatically.</p>
                      ) : (
                        <p className="text-[11px] text-transparent">.</p>
                      )}
                    </div>
                  </div>
                </div>

                <div>
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <div className="flex items-baseline gap-2">
                      <p className="text-sm font-semibold text-gray-900">Contact persons</p>
                      <span className="text-xs text-gray-400">{contacts.fields.length}</span>
                    </div>
                    <button
                      type="button"
                      className="inline-flex items-center gap-1 rounded-md border border-gray-200 bg-white px-2.5 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50"
                      onClick={() => contacts.append({ name: "", designation: "", email: "", phone: "" })}
                    >
                      <Plus className="h-3 w-3" />
                      Add
                    </button>
                  </div>
                  {form.formState.errors.contact_persons?.root?.message ||
                  form.formState.errors.contact_persons?.message ? (
                    <p className="mb-2 text-xs text-danger">
                      {form.formState.errors.contact_persons?.root?.message ||
                        form.formState.errors.contact_persons?.message}
                    </p>
                  ) : null}

                  <div className="overflow-hidden rounded-md border border-gray-200">
                    <div className="hidden grid-cols-[28px_1.1fr_1fr_1.2fr_1fr_28px] gap-2 border-b border-gray-100 bg-gray-50 px-2.5 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-gray-500 sm:grid">
                      <span>#</span>
                      <span>Name</span>
                      <span>Designation</span>
                      <span>Email</span>
                      <span>Phone</span>
                      <span />
                    </div>
                    <div className="divide-y divide-gray-100 bg-white">
                      {contacts.fields.map((field, index) => (
                        <div
                          key={field.id}
                          className="grid grid-cols-1 gap-2 px-2.5 py-2 sm:grid-cols-[28px_1.1fr_1fr_1.2fr_1fr_28px] sm:items-start"
                        >
                          <span className="hidden pt-2 text-xs text-gray-400 sm:block">{index + 1}</span>
                          <Controller
                            control={form.control}
                            name={`contact_persons.${index}.name`}
                            render={({ field: f }) => (
                              <div>
                                <IconInput className="!rounded-md !px-2.5 !py-1.5 text-sm" placeholder="Name" {...f} />
                                {form.formState.errors.contact_persons?.[index]?.name?.message ? (
                                  <p className="mt-0.5 text-[11px] text-danger">
                                    {form.formState.errors.contact_persons?.[index]?.name?.message}
                                  </p>
                                ) : null}
                              </div>
                            )}
                          />
                          <Controller
                            control={form.control}
                            name={`contact_persons.${index}.designation`}
                            render={({ field: f }) => (
                              <IconInput className="!rounded-md !px-2.5 !py-1.5 text-sm" placeholder="Designation" {...f} />
                            )}
                          />
                          <Controller
                            control={form.control}
                            name={`contact_persons.${index}.email`}
                            render={({ field: f }) => (
                              <div>
                                <IconInput
                                  className="!rounded-md !px-2.5 !py-1.5 text-sm"
                                  type="text"
                                  inputMode="email"
                                  placeholder="Email"
                                  {...f}
                                />
                                {form.formState.errors.contact_persons?.[index]?.email?.message ? (
                                  <p className="mt-0.5 text-[11px] text-danger">
                                    {form.formState.errors.contact_persons?.[index]?.email?.message}
                                  </p>
                                ) : null}
                              </div>
                            )}
                          />
                          <Controller
                            control={form.control}
                            name={`contact_persons.${index}.phone`}
                            render={({ field: f }) => (
                              <IconInput className="!rounded-md !px-2.5 !py-1.5 text-sm" placeholder="Phone" {...f} />
                            )}
                          />
                          {contacts.fields.length > 1 ? (
                            <button
                              type="button"
                              className="inline-flex h-8 w-8 items-center justify-center justify-self-end rounded-md text-gray-400 hover:bg-danger-light hover:text-danger sm:justify-self-center"
                              onClick={() => contacts.remove(index)}
                              aria-label={`Remove contact ${index + 1}`}
                            >
                              <X className="h-3.5 w-3.5" />
                            </button>
                          ) : (
                            <span className="hidden sm:block" />
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <div>
                  <div className="mb-2 flex items-baseline justify-between gap-2">
                    <div className="flex items-baseline gap-2">
                      <p className="text-sm font-semibold text-gray-900">Documents</p>
                      <span className="text-xs text-gray-400">
                        {savedDocuments.length + pendingDocs.length} file
                        {savedDocuments.length + pendingDocs.length === 1 ? "" : "s"}
                      </span>
                    </div>
                  </div>

                  {(savedDocuments.length > 0 || pendingDocs.length > 0) && (
                    <div className="mb-2 overflow-hidden rounded-md border border-gray-200 bg-white">
                      {savedDocuments.map((doc) => (
                        <div
                          key={doc.id}
                          className="flex items-center gap-2 border-b border-gray-100 px-2.5 py-1.5 last:border-b-0"
                        >
                          <FileText className="h-3.5 w-3.5 shrink-0 text-primary" />
                          <button
                            type="button"
                            onClick={() => editingProject && openDocumentPreview(editingProject.id, doc)}
                            className="min-w-0 flex-1 text-left"
                          >
                            <span className="block truncate text-sm font-medium text-gray-900 hover:text-primary">
                              {doc.title || doc.filename}
                            </span>
                            <span className="block truncate text-[11px] text-gray-500">
                              {documentCategoryLabel(doc.category)} · {doc.filename}
                            </span>
                          </button>
                          <button
                            type="button"
                            className="inline-flex h-7 w-7 items-center justify-center rounded text-primary hover:bg-primary/10"
                            aria-label={`Preview ${doc.filename}`}
                            onClick={() => editingProject && openDocumentPreview(editingProject.id, doc)}
                          >
                            <Eye className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            className="inline-flex h-7 w-7 items-center justify-center rounded text-red-500 hover:bg-red-50"
                            aria-label={`Remove ${doc.filename}`}
                            disabled={deleteDocumentMutation.isPending}
                            onClick={() =>
                              editingProject &&
                              deleteDocumentMutation.mutate({
                                projectId: editingProject.id,
                                documentId: doc.id,
                              })
                            }
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      ))}
                      {pendingDocs.map((doc) => (
                        <div
                          key={doc.localId}
                          className="flex items-center gap-2 border-b border-dashed border-primary/20 bg-primary/[0.03] px-2.5 py-1.5 last:border-b-0"
                        >
                          <Upload className="h-3.5 w-3.5 shrink-0 text-primary" />
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium text-gray-900">{doc.title}</p>
                            <p className="truncate text-[11px] text-gray-500">
                              Queued · {documentCategoryLabel(doc.category)} · {doc.file.name}
                            </p>
                          </div>
                          <button
                            type="button"
                            className="inline-flex h-7 w-7 items-center justify-center rounded text-gray-400 hover:bg-white hover:text-gray-700"
                            aria-label={`Remove queued ${doc.file.name}`}
                            onClick={() =>
                              setPendingDocs((current) =>
                                current.filter((item) => item.localId !== doc.localId),
                              )
                            }
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="grid grid-cols-1 items-end gap-2 rounded-md border border-gray-200 bg-gray-50/60 p-2 sm:grid-cols-[140px_1fr_minmax(0,1.2fr)_auto]">
                    <div className="grid gap-1">
                      <label className="text-[11px] font-medium text-gray-600">Category</label>
                      <Select
                        className="!rounded-md !px-2.5 !py-1.5 text-sm"
                        value={docCategory}
                        onChange={(event) =>
                          setDocCategory(event.target.value as ProjectDocumentCategory)
                        }
                      >
                        {DOCUMENT_CATEGORIES.map((category) => (
                          <option key={category.value} value={category.value}>
                            {category.label}
                          </option>
                        ))}
                      </Select>
                    </div>
                    <div className="grid gap-1">
                      <label className="text-[11px] font-medium text-gray-600">Title</label>
                      <IconInput
                        className="!rounded-md !px-2.5 !py-1.5 text-sm"
                        placeholder={documentCategoryLabel(docCategory)}
                        value={docTitle}
                        onChange={(value) => setDocTitle(String(value))}
                      />
                    </div>
                    <div className="grid gap-1">
                      <label className="text-[11px] font-medium text-gray-600">File</label>
                      <input
                        type="file"
                        accept=".pdf,.doc,.docx,.png,.jpg,.jpeg,.webp,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,image/*"
                        className="block w-full text-xs text-gray-600 file:mr-2 file:rounded file:border-0 file:bg-primary file:px-2.5 file:py-1.5 file:text-xs file:font-medium file:text-white hover:file:bg-primary-dark"
                        onChange={(event) => setDocFile(event.target.files?.[0] ?? null)}
                      />
                    </div>
                    <button
                      type="button"
                      onClick={queueDocument}
                      className="inline-flex h-[34px] items-center justify-center gap-1 rounded-md bg-primary px-3 text-xs font-medium text-white hover:bg-primary-dark"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      Add
                    </button>
                  </div>
                </div>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 border-t border-gray-100 bg-gray-50 px-5 py-3">
                <Button variant="outline" size="sm" onClick={closeForm}>
                  Cancel
                </Button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-white transition hover:bg-primary-dark focus:outline-none focus:ring-4 focus:ring-primary/20 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isSaving ? "Saving..." : editingProject ? "Save changes" : "Create project"}
                </button>
              </div>
            </form>
          </motion.aside>
        </div>
      ) : null}

      <Backdrop
        isOpen={Boolean(docsModal)}
        onOpenChange={(open) => (!open ? setDocsModal(null) : null)}
      >
        <Modal>
          <div
            className="fixed left-1/2 top-1/2 w-full max-w-none -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-xl outline-none sm:w-1/2 max-sm:max-w-[calc(100%-1.5rem)]"
            role="dialog"
            aria-modal="true"
          >
            <div className="flex items-start justify-between gap-3 border-b border-gray-100 px-5 py-4">
              <div className="min-w-0">
                <h2 className="text-base font-semibold text-gray-900">Project documents</h2>
                <p className="truncate text-xs text-gray-500">{docsModal?.projectName}</p>
              </div>
              <button
                type="button"
                onClick={() => setDocsModal(null)}
                className="inline-flex h-8 w-8 items-center justify-center rounded-md text-gray-500 hover:bg-gray-100"
                aria-label="Close documents"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="max-h-[60vh] overflow-y-auto p-3">
              {(docsModal?.documents.length ?? 0) === 0 ? (
                <p className="px-2 py-6 text-center text-sm text-gray-400">No documents uploaded.</p>
              ) : (
                <div className="space-y-1">
                  {docsModal?.documents.map((doc) => (
                    <button
                      key={doc.id}
                      type="button"
                      onClick={() => docsModal && openDocumentPreview(docsModal.projectId, doc)}
                      className="flex w-full items-center gap-3 rounded-lg border border-transparent px-3 py-2.5 text-left transition hover:border-gray-200 hover:bg-gray-50"
                    >
                      <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                        <FileText className="h-4 w-4" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium text-gray-900">
                          {doc.title || doc.filename}
                        </span>
                        <span className="block truncate text-xs text-gray-500">
                          {documentCategoryLabel(doc.category)} · {doc.filename}
                        </span>
                      </span>
                      <Eye className="h-4 w-4 shrink-0 text-gray-400" />
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </Modal>
      </Backdrop>

      <Backdrop
        isOpen={Boolean(previewDoc)}
        onOpenChange={(open) => (!open ? closeDocumentPreview() : null)}
      >
        <Modal>
          <div
            className="fixed left-1/2 top-1/2 flex h-[min(90vh,880px)] w-full max-w-5xl -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-xl border border-gray-200 bg-white shadow-xl outline-none max-sm:max-w-[calc(100%-1.5rem)]"
            role="dialog"
            aria-modal="true"
          >
            <div className="flex items-start justify-between gap-3 border-b border-gray-100 px-5 py-4">
              <div className="min-w-0">
                <h2 className="truncate text-base font-semibold text-gray-900">{previewDoc?.title}</h2>
                <p className="truncate text-xs text-gray-500">{previewDoc?.filename}</p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                {previewDoc ? (
                  <a
                    href={previewDoc.blobUrl}
                    download={previewDoc.filename}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50"
                  >
                    <Download className="h-3.5 w-3.5" />
                    Download
                  </a>
                ) : null}
                <button
                  type="button"
                  onClick={closeDocumentPreview}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-md text-gray-500 hover:bg-gray-100"
                  aria-label="Close preview"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>
            <div className="min-h-0 flex-1 bg-gray-100 p-3">
              {previewDoc &&
              isPreviewableDocument(previewDoc.contentType, previewDoc.filename) ? (
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
                ) : (
                  <iframe
                    title={previewDoc.filename}
                    src={previewDoc.blobUrl}
                    className="h-full w-full rounded-lg border border-gray-200 bg-white"
                  />
                )
              ) : previewDoc ? (
                <div className="flex h-full flex-col items-center justify-center gap-3 rounded-lg bg-white p-8 text-center">
                  <FileText className="h-10 w-10 text-primary" />
                  <p className="text-sm text-gray-700">
                    {isLegacyDocDocument(previewDoc.contentType, previewDoc.filename)
                      ? "Legacy .doc files can’t be previewed in the browser. Re-save as .docx, or download to open locally."
                      : "Preview is not available for this file type. Download it to open locally."}
                  </p>
                  <a
                    href={previewDoc.blobUrl}
                    download={previewDoc.filename}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-dark"
                  >
                    <Download className="h-3.5 w-3.5" />
                    Download {previewDoc.filename}
                  </a>
                </div>
              ) : null}
            </div>
          </div>
        </Modal>
      </Backdrop>

      <Backdrop
        isOpen={Boolean(deleteTarget)}
        onOpenChange={(open) => (!open ? setDeleteTarget(null) : null)}
      >
        <Modal>
          <div
            className="fixed left-1/2 top-1/2 w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-xl border border-gray-200 bg-white p-6 shadow-xl outline-none max-sm:max-w-[calc(100%-2rem)]"
            role="alertdialog"
            aria-modal="true"
          >
            <DialogHeader>
              <DialogTitle>Delete project</DialogTitle>
              <DialogDescription>
                Delete <strong>{deleteTarget?.name}</strong>? This cannot be undone.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDeleteTarget(null)}>
                Cancel
              </Button>
              <Button
                variant="destructive"
                disabled={deleteMutation.isPending}
                onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
              >
                {deleteMutation.isPending ? "Deleting..." : "Delete"}
              </Button>
            </DialogFooter>
          </div>
        </Modal>
      </Backdrop>
    </div>
  );
}

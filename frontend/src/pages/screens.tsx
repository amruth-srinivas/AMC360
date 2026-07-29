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
} from "lucide-react";
import { Link, useParams } from "react-router-dom";
import { toast } from "sonner";
import type React from "react";
import { useState } from "react";
import { Modal } from "react-aria-components";

import { Badge } from "../components/ui/badge";
import { UserAvatar } from "../components/ui/avatar";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
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

type ContactPerson = {
  name: string;
  designation?: string | null;
  email?: string | null;
  phone?: string | null;
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
  member_ids: number[];
};

type TicketRow = {
  id: number;
  project_id: number;
  category: string;
  priority: "P1" | "P2" | "P3";
  status: "open" | "in_progress" | "resolved" | "closed";
  title: string;
  description: string;
  assignee_id: number | null;
  created_at: string;
};

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
  due_date: string;
  status: string;
  type: string;
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
  category: z.enum([
    "incident",
    "service_request",
    "change_request",
    "database",
    "backup",
    "access",
    "performance",
    "health_check",
    "other",
  ]),
  priority: z.enum(["P1", "P2", "P3"]),
  title: z.string().min(2),
  description: z.string().min(2),
});

const calendarSchema = z.object({
  project_id: z.coerce.number().optional(),
  type: z.enum(["health_check", "db_restoration", "report_due", "custom"]),
  title: z.string().min(2),
  due_date: z.string().min(5),
  owner_id: z.coerce.number(),
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

function ticketStatusVariant(status: TicketRow["status"]): "danger" | "info" | "success" | "neutral" {
  if (status === "open") return "danger";
  if (status === "in_progress") return "info";
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
          <div className="login-blob login-blob-a absolute -left-24 -top-28 h-[28rem] w-[28rem] rounded-full bg-primary/35 blur-3xl" />
          <div className="login-blob login-blob-b absolute right-[12%] top-[18%] h-80 w-80 rounded-full bg-[#6366F1]/25 blur-3xl" />
          <div className="login-blob login-blob-c absolute bottom-[8%] left-[28%] h-[26rem] w-[26rem] rounded-full bg-[#0EA5E9]/20 blur-3xl" />
          <div className="login-blob login-blob-d absolute -bottom-20 right-[-4%] h-72 w-72 rounded-full bg-[#14B8A6]/15 blur-3xl" />
          <div
            className="absolute inset-0 opacity-[0.08]"
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
            <Link className="text-sm font-medium text-primary hover:text-primary/80" to="/approvals">
              View all
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
  const projects = useProjects();
  return (
    <div>
      <PageHeader title="Projects" description="Client support projects, ownership, and member assignments." />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {(projects.data ?? []).map((project, index) => (
          <motion.div
            key={project.id}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.04 }}
          >
            <Card className="rounded-lg border border-gray-200 bg-white px-5 py-4 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-mono text-[11px] text-gray-400">{project.project_no}</p>
                  <h2 className="mt-0.5 text-base font-semibold text-gray-900">{project.name}</h2>
                  <p className="mt-0.5 text-sm text-gray-500">{project.client_name}</p>
                  {project.customer_name ? (
                    <p className="mt-1 text-xs text-gray-400">Customer: {project.customer_name}</p>
                  ) : null}
                </div>
                <Badge
                  variant={
                    project.status === "active"
                      ? "success"
                      : project.status === "on_hold"
                        ? "warning"
                        : project.status === "cancelled"
                          ? "danger"
                          : "neutral"
                  }
                  format
                >
                  {project.status}
                </Badge>
              </div>
              <div className="mt-4 flex items-center justify-between text-sm">
                <span className="text-xs text-gray-500">
                  {project.member_ids.length} members
                </span>
                <Link
                  className="text-sm font-medium text-primary hover:text-primary-dark"
                  to={`/projects/${project.id}`}
                >
                  View →
                </Link>
              </div>
            </Card>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

export function ProjectDetailPage() {
  const { id } = useParams();
  const projectId = Number(id);
  const projects = useProjects();
  const reports = useReports();
  const tickets = useTickets();
  const events = useEvents();

  const project = (projects.data ?? []).find((item) => item.id === projectId);

  return (
    <div>
      <PageHeader
        title={project?.name ?? "Project"}
        description={project ? `Client: ${project.client_name}` : "Project detail"}
      />
      <div className="space-y-4">
        <div className="grid gap-4 lg:grid-cols-2">
        <Card className="px-5 py-4">
          <SectionTitle>Reports</SectionTitle>
          <div className="grid gap-3">
            {(reports.data ?? [])
              .filter((item) => item.project_id === projectId)
              .slice(0, 5)
              .map((item) => (
                <ListItem key={item.id}>
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-mono text-[10px] text-surface-bright">Period {item.period}</span>
                    <Badge variant={item.status === "approved" ? "success" : "warning"}>{item.status}</Badge>
                  </div>
                </ListItem>
              ))}
          </div>
        </Card>
        <Card className="px-5 py-4">
          <SectionTitle>Tickets</SectionTitle>
          <div className="grid gap-3">
            {(tickets.data ?? [])
              .filter((item) => item.project_id === projectId)
              .slice(0, 5)
              .map((item) => (
                <ListItem key={item.id}>
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-sm font-bold text-surface-bright">{item.title}</span>
                    <Badge variant={priorityVariant(item.priority)}>{item.priority}</Badge>
                  </div>
                </ListItem>
              ))}
          </div>
        </Card>
        </div>
      <Card className="px-5 py-4">
        <SectionTitle>Calendar</SectionTitle>
        <div className="grid gap-3">
          {(events.data ?? [])
            .filter((item) => item.id)
            .slice(0, 5)
            .map((item) => (
              <ListItem key={item.id}>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm font-medium text-surface-bright">{item.title}</span>
                  <span className="font-mono text-[10px] text-on-surface-variant">{formatDate(item.due_date)}</span>
                </div>
              </ListItem>
            ))}
        </div>
      </Card>
      </div>
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
    defaultValues: { category: "incident", priority: "P2" },
  });

  const mutation = useMutation({
    mutationFn: (values: z.infer<typeof ticketSchema>) => api.post("/tickets", values),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["tickets"] });
      form.reset({ category: "incident", priority: "P2", title: "", description: "" });
    },
  });

  const columns: Array<TicketRow["status"]> = ["open", "in_progress", "resolved", "closed"];

  return (
    <div>
      <PageHeader title="Tickets" description="Operational issue tracking with table and board visibility." />
      <div className="grid gap-6 lg:grid-cols-[minmax(280px,360px)_1fr] lg:items-start">
        <FormPanel title="Raise ticket" description="Log a new operational issue.">
          <form className="grid gap-4" onSubmit={form.handleSubmit((values) => mutation.mutate(values))}>
            <Field label="Project ID" error={form.formState.errors.project_id?.message}>
              <Input list="project-list" {...form.register("project_id")} />
              <datalist id="project-list">
                {(projects.data ?? []).map((project) => (
                  <option key={project.id} value={project.id}>{project.name}</option>
                ))}
              </datalist>
            </Field>
            <Field label="Title" error={form.formState.errors.title?.message}>
              <Input {...form.register("title")} />
            </Field>
            <Field label="Priority" error={form.formState.errors.priority?.message}>
              <Select {...form.register("priority")}>
                <option value="P1">P1</option>
                <option value="P2">P2</option>
                <option value="P3">P3</option>
              </Select>
            </Field>
            <Field label="Category" error={form.formState.errors.category?.message}>
              <Select {...form.register("category")}>
                {ticketSchema.shape.category.options.map((option) => (
                  <option key={option} value={option}>{formatLabel(option)}</option>
                ))}
              </Select>
            </Field>
            <Field label="Description" error={form.formState.errors.description?.message}>
              <Textarea {...form.register("description")} />
            </Field>
            <Button type="submit" className="w-full">Raise ticket</Button>
          </form>
        </FormPanel>
        <div className="space-y-4">
          <DataPanel title="All tickets" count={(tickets.data ?? []).length}>
            <TableContainer>
              <Table>
                <TableHead>
                  <TableHeaderRow>
                    <TableHeaderCell>Ticket</TableHeaderCell>
                    <TableHeaderCell>Priority</TableHeaderCell>
                    <TableHeaderCell>Status</TableHeaderCell>
                    <TableHeaderCell>Created</TableHeaderCell>
                  </TableHeaderRow>
                </TableHead>
                <TableBody>
                  {(tickets.data ?? []).map((item) => (
                    <TableRow key={item.id}>
                      <TableCell>
                        <Link className="font-medium text-surface-bright hover:text-primary" to={`/tickets/${item.id}`}>
                          {item.title}
                        </Link>
                      </TableCell>
                      <TableCell>
                        <Badge variant={priorityVariant(item.priority)}>{item.priority}</Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={ticketStatusVariant(item.status)} pulse={item.status === "open"} format>
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
  const ticketId = Number(id);
  const queryClient = useQueryClient();
  const ticket = useQuery({
    queryKey: ["ticket", ticketId],
    queryFn: () => api.get<TicketRow>(`/tickets/${ticketId}`),
  });
  const comments = useQuery({
    queryKey: ["comments", ticketId],
    queryFn: () => api.get<Array<{ id: number; comment: string; created_at: string }>>(`/tickets/${ticketId}/comments`),
  });

  const commentForm = useForm<{ comment: string }>({ defaultValues: { comment: "" } });
  const commentMutation = useMutation({
    mutationFn: (values: { comment: string }) => api.post(`/tickets/${ticketId}/comments`, values),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["comments", ticketId] });
      commentForm.reset();
    },
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title={ticket.data?.title ?? "Ticket Detail"}
        description={ticket.data?.description ?? "Ticket timeline and RCA flow."}
      />
      <div className="grid gap-4 lg:grid-cols-[1.2fr_360px]">
        <Card className="px-6 py-5">
          <SectionTitle>Comments</SectionTitle>
          <div className="grid gap-3">
            {(comments.data ?? []).map((item) => (
              <ListItem key={item.id}>
                <p className="text-sm text-surface-bright">{item.comment}</p>
                <p className="mt-2 font-mono text-[10px] text-on-surface-variant">{formatDate(item.created_at)}</p>
              </ListItem>
            ))}
          </div>
          <form className="mt-4 grid gap-3" onSubmit={commentForm.handleSubmit((values) => commentMutation.mutate(values))}>
            <Textarea {...commentForm.register("comment")} />
            <Button type="submit">Add Comment</Button>
          </form>
        </Card>
        <Card className="px-6 py-5">
          <SectionTitle>RCA</SectionTitle>
          <p className="text-sm text-on-surface-variant">
            RCA submissions are handled from the API and approvals queue in this first pass.
          </p>
        </Card>
      </div>
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
              date: event.due_date,
              color:
                event.status === "overdue"
                  ? "#ef4444"
                  : event.type === "custom"
                    ? "#0284c7"
                    : "#34d399",
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
            className="w-full max-w-lg max-sm:max-w-[calc(100%-2rem)] overflow-hidden rounded-xl border border-gray-200 bg-white shadow-xl outline-none fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2"
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
  const [amcFile, setAmcFile] = useState<File | null>(null);

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
    setAmcFile(null);
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
    setAmcFile(null);
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
    data.append(
      "contact_persons",
      JSON.stringify(contactPersons),
    );
    if (amcFile) {
      data.append("amc_terms", amcFile);
    }
    return data;
  }

  const createMutation = useMutation({
    mutationFn: (values: z.infer<typeof projectSchema>) => api.postForm("/projects", buildFormData(values)),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["projects"] });
      toast.success("Project created");
      closeForm();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, values }: { id: number; values: z.infer<typeof projectSchema> }) =>
      api.putForm(`/projects/${id}`, buildFormData(values)),
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

  const isSaving = createMutation.isPending || updateMutation.isPending;

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
                  <TableHeaderCell>AMC terms</TableHeaderCell>
                  <TableHeaderCell className="text-right">Actions</TableHeaderCell>
                </TableHeaderRow>
              </TableHead>
              <TableBody>
                {(projects.data ?? []).map((item) => (
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
                    <TableCell>
                      {item.amc_terms_url ? (
                        <a
                          href={item.amc_terms_url}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
                        >
                          <FileText className="h-3.5 w-3.5" />
                          {item.amc_terms_filename ?? "View"}
                        </a>
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <TableActions>
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
                ))}
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
            className="relative flex h-full w-full flex-col bg-white shadow-2xl"
            role="dialog"
            aria-modal="true"
          >
            <div className="flex items-start justify-between gap-4 border-b border-primary/10 bg-primary-light px-6 py-5">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary shadow-sm">
                  {editingProject ? (
                    <Pencil className="h-5 w-5 text-white" />
                  ) : (
                    <FolderKanban className="h-5 w-5 text-white" />
                  )}
                </div>
                <div>
                  <h2 className="text-base font-semibold text-gray-900">
                    {editingProject ? "Edit project" : "Create project"}
                  </h2>
                  <p className="mt-0.5 text-xs text-gray-600">
                    Capture client details, assign team, and upload AMC terms.
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
              <div className="flex-1 space-y-5 overflow-y-auto px-6 py-5">
                <div className="grid gap-4 sm:grid-cols-2">
                  <FormField label="Project No" error={form.formState.errors.project_no?.message} icon={Hash}>
                    <Controller
                      control={form.control}
                      name="project_no"
                      render={({ field }) => <IconInput placeholder="PRJ-0001" {...field} />}
                    />
                  </FormField>
                  <FormField label="Project name" error={form.formState.errors.name?.message} icon={FolderKanban}>
                    <Controller
                      control={form.control}
                      name="name"
                      render={({ field }) => <IconInput placeholder="Support engagement" {...field} />}
                    />
                  </FormField>
                  <FormField label="Client company" error={form.formState.errors.client_name?.message} icon={Building2}>
                    <Controller
                      control={form.control}
                      name="client_name"
                      render={({ field }) => <IconInput placeholder="Acme Corp" {...field} />}
                    />
                  </FormField>
                  <FormField label="Customer name" error={form.formState.errors.customer_name?.message} icon={User}>
                    <Controller
                      control={form.control}
                      name="customer_name"
                      render={({ field }) => <IconInput placeholder="Primary customer contact" {...field} />}
                    />
                  </FormField>
                </div>

                <FormField label="Details" error={form.formState.errors.details?.message}>
                  <Controller
                    control={form.control}
                    name="details"
                    render={({ field }) => (
                      <Textarea rows={3} placeholder="Scope, notes, and delivery details" {...field} />
                    )}
                  />
                </FormField>

                <FormField
                  label="Company address"
                  error={form.formState.errors.company_address?.message}
                  icon={MapPin}
                >
                  <Controller
                    control={form.control}
                    name="company_address"
                    render={({ field }) => <IconInput placeholder="Full company address" {...field} />}
                  />
                </FormField>

                <FormField label="Status" error={form.formState.errors.status?.message}>
                  <Controller
                    control={form.control}
                    name="status"
                    render={({ field }) => (
                      <Select {...field}>
                        <option value="active">Active</option>
                        <option value="on_hold">On hold</option>
                        <option value="completed">Completed</option>
                        <option value="cancelled">Cancelled</option>
                      </Select>
                    )}
                  />
                </FormField>

                <div className="rounded-lg border border-gray-200 bg-gray-50/80 p-4">
                  <p className="text-sm font-semibold text-gray-900">Team assignment</p>
                  <p className="mt-0.5 text-xs text-gray-500">
                    Assign a team lead and one or more team members for this project.
                  </p>

                  <div className="mt-4">
                    <FormField label="Team lead" error={form.formState.errors.team_lead_id?.message}>
                      <Controller
                        control={form.control}
                        name="team_lead_id"
                        render={({ field }) => (
                          <div className="space-y-2 rounded-lg border border-gray-200 bg-white p-2">
                            <label
                              className={`flex cursor-pointer items-center gap-3 rounded-md px-2.5 py-2 transition-colors ${
                                !field.value ? "bg-primary-light" : "hover:bg-gray-50"
                              }`}
                            >
                              <input
                                type="radio"
                                name="project-team-lead"
                                className="h-4 w-4 border-gray-300 text-primary focus:ring-primary"
                                checked={!field.value}
                                onChange={() => field.onChange(undefined)}
                              />
                              <div className="min-w-0 flex-1">
                                <p className="text-sm font-medium text-gray-900">Unassigned</p>
                                <p className="text-xs text-gray-500">No lead selected yet</p>
                              </div>
                            </label>
                            {leadCandidates.map((user) => {
                              const checked = field.value === user.id;
                              return (
                                <label
                                  key={user.id}
                                  className={`flex cursor-pointer items-center gap-3 rounded-md px-2.5 py-2 transition-colors ${
                                    checked ? "bg-primary-light" : "hover:bg-gray-50"
                                  }`}
                                >
                                  <input
                                    type="radio"
                                    name="project-team-lead"
                                    className="h-4 w-4 border-gray-300 text-primary focus:ring-primary"
                                    checked={checked}
                                    onChange={() => field.onChange(user.id)}
                                  />
                                  <UserAvatar name={user.name} />
                                  <div className="min-w-0 flex-1">
                                    <p className="truncate text-sm font-medium text-gray-900">{user.name}</p>
                                    <p className="truncate text-xs text-gray-500">
                                      {user.designation || user.email}
                                    </p>
                                  </div>
                                </label>
                              );
                            })}
                          </div>
                        )}
                      />
                    </FormField>
                  </div>

                  <div className="mt-4">
                    <div className="mb-2 flex items-center justify-between">
                      <p className="text-sm font-medium text-gray-700">Team members</p>
                      <span className="text-xs text-gray-400">
                        {watchedMemberIds.length} selected
                      </span>
                    </div>
                    <div className="max-h-56 space-y-1 overflow-y-auto rounded-lg border border-gray-200 bg-white p-2">
                      {memberCandidates.length === 0 ? (
                        <p className="px-2 py-3 text-sm text-gray-400">
                          No team members available. Create users with the Team Member role first.
                        </p>
                      ) : (
                        memberCandidates.map((user) => {
                          const checked = watchedMemberIds.includes(user.id);
                          return (
                            <label
                              key={user.id}
                              className={`flex cursor-pointer items-center gap-3 rounded-md px-2.5 py-2 transition-colors ${
                                checked ? "bg-primary-light" : "hover:bg-gray-50"
                              }`}
                            >
                              <input
                                type="checkbox"
                                className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
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
                                <p className="truncate text-xs text-gray-500">
                                  {user.designation || user.email}
                                </p>
                              </div>
                            </label>
                          );
                        })
                      )}
                    </div>
                    {watchedLeadId ? (
                      <p className="mt-2 text-xs text-gray-500">
                        Team lead is included automatically in project membership.
                      </p>
                    ) : null}
                  </div>
                </div>

                <div className="rounded-lg border border-gray-200 bg-gray-50/70 p-3">
                  <div className="mb-3 flex items-center justify-between gap-2">
                    <div>
                      <p className="text-sm font-semibold text-gray-900">Contact persons</p>
                      <p className="text-xs text-gray-500">Name, designation, email, and phone</p>
                    </div>
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
                  {form.formState.errors.contact_persons?.root?.message ||
                  form.formState.errors.contact_persons?.message ? (
                    <p className="mb-2 text-xs text-danger">
                      {form.formState.errors.contact_persons?.root?.message ||
                        form.formState.errors.contact_persons?.message}
                    </p>
                  ) : null}
                  <div className="flex flex-col gap-3">
                    {contacts.fields.map((field, index) => (
                      <div key={field.id} className="rounded-md border border-gray-200 bg-white p-3">
                        <div className="mb-2 flex items-center justify-between">
                          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                            Contact {index + 1}
                          </p>
                          {contacts.fields.length > 1 ? (
                            <button
                              type="button"
                              className="inline-flex h-7 w-7 items-center justify-center rounded-md text-gray-400 hover:bg-danger-light hover:text-danger"
                              onClick={() => contacts.remove(index)}
                              aria-label={`Remove contact ${index + 1}`}
                            >
                              <X className="h-4 w-4" />
                            </button>
                          ) : null}
                        </div>
                        <div className="grid gap-3 sm:grid-cols-2">
                          <FormField
                            label="Name"
                            error={form.formState.errors.contact_persons?.[index]?.name?.message}
                            icon={User}
                          >
                            <Controller
                              control={form.control}
                              name={`contact_persons.${index}.name`}
                              render={({ field: f }) => <IconInput placeholder="Contact name" {...f} />}
                            />
                          </FormField>
                          <FormField
                            label="Designation"
                            error={form.formState.errors.contact_persons?.[index]?.designation?.message}
                            icon={Briefcase}
                          >
                            <Controller
                              control={form.control}
                              name={`contact_persons.${index}.designation`}
                              render={({ field: f }) => <IconInput placeholder="Manager" {...f} />}
                            />
                          </FormField>
                          <FormField
                            label="Email"
                            error={form.formState.errors.contact_persons?.[index]?.email?.message}
                            icon={Mail}
                          >
                            <Controller
                              control={form.control}
                              name={`contact_persons.${index}.email`}
                              render={({ field: f }) => (
                                <IconInput
                                  type="text"
                                  inputMode="email"
                                  placeholder="name@company.com"
                                  {...f}
                                />
                              )}
                            />
                          </FormField>
                          <FormField
                            label="Phone"
                            error={form.formState.errors.contact_persons?.[index]?.phone?.message}
                            icon={Phone}
                          >
                            <Controller
                              control={form.control}
                              name={`contact_persons.${index}.phone`}
                              render={({ field: f }) => <IconInput placeholder="+91 ..." {...f} />}
                            />
                          </FormField>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-medium text-gray-700">
                    AMC terms &amp; conditions document
                  </label>
                  <div className="flex flex-col gap-2 rounded-lg border border-dashed border-gray-300 bg-gray-50 px-4 py-3">
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      <FileText className="h-4 w-4 text-primary" />
                      <span>
                        {amcFile
                          ? amcFile.name
                          : editingProject?.amc_terms_filename
                            ? `Current: ${editingProject.amc_terms_filename}`
                            : "Upload PDF or DOC (stored in MinIO)"}
                      </span>
                    </div>
                    <input
                      type="file"
                      accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                      className="block w-full text-sm text-gray-600 file:mr-3 file:rounded-md file:border-0 file:bg-primary file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-white hover:file:bg-primary-dark"
                      onChange={(event) => setAmcFile(event.target.files?.[0] ?? null)}
                    />
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 border-t border-gray-100 bg-gray-50 px-6 py-4">
                <Button variant="outline" onClick={closeForm}>
                  Cancel
                </Button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="inline-flex items-center justify-center rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-white transition hover:bg-primary-dark focus:outline-none focus:ring-4 focus:ring-primary/20 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isSaving ? "Saving..." : editingProject ? "Save changes" : "Create project"}
                </button>
              </div>
            </form>
          </motion.aside>
        </div>
      ) : null}

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

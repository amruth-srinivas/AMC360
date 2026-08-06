import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Bell,
  ChevronDown,
  ClipboardList,
  FolderKanban,
  LayoutDashboard,
  LogOut,
  Moon,
  Pencil,
  Sun,
  Users,
} from "lucide-react";
import { Toaster } from "sonner";
import { createPortal } from "react-dom";
import { BrowserRouter, Link, Navigate, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import type React from "react";
import { useEffect, useLayoutEffect, useRef, useState } from "react";

import { EditProfileDialog } from "./components/edit-profile-dialog";
import {
  UserAvatar,
  presenceMeta,
  useAuthenticatedImage,
} from "./components/ui/avatar";
import { AuthProvider, useAuth } from "./store/auth";
import { cn } from "./lib/utils";
import {
  AdminProjectsPage,
  AdminTemplatesPage,
  AdminUsersPage,
  ApprovalsPage,
  CalendarPage,
  DashboardPage,
  LoginPage,
  NewReportPage,
  ProjectDetailPage,
  ProjectsPage,
  ReportsPage,
  TicketDetailPage,
  TicketsPage,
} from "./pages/screens";

const queryClient = new QueryClient();

const navItems = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/projects", label: "Projects", icon: FolderKanban },
];

const adminItems = [
  { to: "/admin/users", label: "Users", icon: Users },
  { to: "/admin/projects", label: "Projects", icon: FolderKanban },
  { to: "/admin/templates", label: "Templates", icon: ClipboardList },
];

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuth();
  return isAuthenticated ? <>{children}</> : <Navigate to="/login" replace />;
}

function NavLink({ to, label, active }: { to: string; label: string; active: boolean }) {
  return (
    <Link
      to={to}
      className={`shrink-0 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
        active
          ? "bg-primary-light text-primary"
          : "text-gray-500 hover:bg-gray-100 hover:text-gray-800"
      }`}
    >
      {label}
    </Link>
  );
}

function AdminMenu({
  items,
  pathname,
}: {
  items: typeof adminItems;
  pathname: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const active = items.some((item) => pathname.startsWith(item.to));

  useEffect(() => {
    if (!open) return;

    function handleClick(event: MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  return (
    <div ref={ref} className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-haspopup="menu"
        className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
          active || open
            ? "bg-primary-light text-primary"
            : "text-gray-500 hover:bg-gray-100 hover:text-gray-800"
        }`}
      >
        Admin
        <ChevronDown className={`h-3.5 w-3.5 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open ? (
        <div
          role="menu"
          className="absolute left-0 top-[calc(100%+4px)] z-[100] min-w-[200px] rounded-md border border-gray-200 bg-white py-1 shadow-lg"
        >
          {items.map((item) => {
            const Icon = item.icon;
            const itemActive = pathname.startsWith(item.to);
            return (
              <Link
                key={item.to}
                to={item.to}
                onClick={() => setOpen(false)}
                className={`flex items-center gap-2 px-3 py-2 text-sm transition-colors ${
                  itemActive
                    ? "bg-primary-light text-primary"
                    : "text-gray-500 hover:bg-gray-50 hover:text-gray-800"
                }`}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

function UserMenu({ onEditProfile }: { onEditProfile: () => void }) {
  const { user, logout, avatarVersion } = useAuth();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const avatarSrc = useAuthenticatedImage(
    Boolean(user?.has_avatar),
    "/auth/me/avatar",
    avatarVersion,
  );
  const presence = presenceMeta(user?.status_presence);

  useEffect(() => {
    if (!open) return;

    function handleClick(event: MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    function handleKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }

    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleKey);
    };
  }, [open]);

  if (!user) return null;

  return (
    <div ref={ref} className="relative flex items-center gap-2">
      <div className="hidden min-w-0 text-right sm:block">
        <p className="truncate text-sm font-medium leading-tight text-gray-900">{user.name}</p>
        <p className="truncate text-xs leading-tight text-gray-500">
          {user.status_message?.trim() || user.email}
        </p>
      </div>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label="Account menu"
        className="rounded-full ring-offset-2 transition hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
      >
        <UserAvatar
          name={user.name}
          size="md"
          src={avatarSrc}
          presence={user.status_presence}
          showPresence
        />
      </button>
      {open ? (
        <div
          role="menu"
          className="absolute right-0 top-[calc(100%+8px)] z-[100] w-64 overflow-hidden rounded-md border border-gray-200 bg-white py-1 shadow-lg"
        >
          <div className="border-b border-gray-100 px-3 py-2.5">
            <div className="flex items-center gap-2.5">
              <UserAvatar
                name={user.name}
                size="md"
                src={avatarSrc}
                presence={user.status_presence}
                showPresence
              />
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-gray-900">{user.name}</p>
                <p className="flex items-center gap-1.5 truncate text-xs text-gray-500">
                  <span className={cn("h-2 w-2 shrink-0 rounded-full", presence.dotClass)} />
                  {presence.label}
                  {user.status_message?.trim() ? ` · ${user.status_message}` : ""}
                </p>
              </div>
            </div>
            {(user.linkedin_url || user.github_url || user.website_url) && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {user.linkedin_url ? (
                  <a
                    href={user.linkedin_url}
                    target="_blank"
                    rel="noreferrer"
                    className="rounded bg-gray-50 px-1.5 py-0.5 text-[11px] text-primary hover:bg-primary-light"
                    onClick={(e) => e.stopPropagation()}
                  >
                    LinkedIn
                  </a>
                ) : null}
                {user.github_url ? (
                  <a
                    href={user.github_url}
                    target="_blank"
                    rel="noreferrer"
                    className="rounded bg-gray-50 px-1.5 py-0.5 text-[11px] text-primary hover:bg-primary-light"
                    onClick={(e) => e.stopPropagation()}
                  >
                    GitHub
                  </a>
                ) : null}
                {user.website_url ? (
                  <a
                    href={user.website_url}
                    target="_blank"
                    rel="noreferrer"
                    className="rounded bg-gray-50 px-1.5 py-0.5 text-[11px] text-primary hover:bg-primary-light"
                    onClick={(e) => e.stopPropagation()}
                  >
                    Website
                  </a>
                ) : null}
              </div>
            )}
          </div>
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setOpen(false);
              onEditProfile();
            }}
            className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-gray-700 transition-colors hover:bg-gray-50"
          >
            <Pencil className="h-4 w-4 text-gray-500" />
            Edit profile
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setOpen(false);
              logout();
            }}
            className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-gray-700 transition-colors hover:bg-gray-50"
          >
            <LogOut className="h-4 w-4 text-gray-500" />
            Sign out
          </button>
        </div>
      ) : null}
    </div>
  );
}

function ProjectsNavItem({ active }: { active: boolean }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [menuPos, setMenuPos] = useState({ top: 0, left: 0 });
  const wrapRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const canCreateProject = user?.role === "admin" || user?.role === "team_lead";
  const highlighted = active || open;

  useLayoutEffect(() => {
    if (!open || !wrapRef.current) return;
    const rect = wrapRef.current.getBoundingClientRect();
    setMenuPos({ top: rect.bottom + 6, left: rect.left });
  }, [open]);

  useEffect(() => {
    if (!open) return;

    function handleClick(event: MouseEvent) {
      const target = event.target as Node;
      if (wrapRef.current?.contains(target) || menuRef.current?.contains(target)) return;
      setOpen(false);
    }

    function handleKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }

    function handleReposition() {
      if (!wrapRef.current) return;
      const rect = wrapRef.current.getBoundingClientRect();
      setMenuPos({ top: rect.bottom + 6, left: rect.left });
    }

    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleKey);
    window.addEventListener("resize", handleReposition);
    window.addEventListener("scroll", handleReposition, true);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleKey);
      window.removeEventListener("resize", handleReposition);
      window.removeEventListener("scroll", handleReposition, true);
    };
  }, [open]);

  if (!canCreateProject) {
    return <NavLink to="/projects" label="Projects" active={active} />;
  }

  return (
    <div ref={wrapRef} className="relative shrink-0">
      <div
        className={`inline-flex items-center rounded-md text-sm font-medium transition-colors ${
          highlighted
            ? "bg-primary-light text-primary"
            : "text-gray-500 hover:bg-gray-100 hover:text-gray-800"
        }`}
      >
        <Link to="/projects" className="rounded-l-md px-3 py-1.5" onClick={() => setOpen(false)}>
          Projects
        </Link>
        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          aria-expanded={open}
          aria-haspopup="menu"
          aria-label="Projects menu"
          className="rounded-r-md py-1.5 pl-0.5 pr-2"
        >
          <ChevronDown className={`h-3.5 w-3.5 transition-transform ${open ? "rotate-180" : ""}`} />
        </button>
      </div>
      {open
        ? createPortal(
            <div
              ref={menuRef}
              role="menu"
              style={{ top: menuPos.top, left: menuPos.left }}
              className="fixed z-[200] min-w-[180px] overflow-hidden rounded-md border border-gray-200 bg-white py-1 shadow-lg"
            >
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setOpen(false);
                  navigate("/projects?create=1");
                }}
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-gray-700 transition-colors hover:bg-primary/5 hover:text-primary"
              >
                <FolderKanban className="h-4 w-4 shrink-0 text-primary" />
                Add project
              </button>
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}

function AppLayout() {
  const { pathname } = useLocation();
  const { user } = useAuth();
  const reduceMotion = useReducedMotion();
  const [profileOpen, setProfileOpen] = useState(false);
  const [dark, setDark] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.localStorage.getItem("theme") === "dark";
  });

  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
    window.localStorage.setItem("theme", dark ? "dark" : "light");
  }, [dark]);

  return (
    <div className="min-h-screen bg-gray-50 font-sans text-gray-800">
      <header className="sticky top-0 z-30 overflow-visible border-b border-gray-200 bg-white/95 shadow-sm backdrop-blur-sm">
        <div className="flex h-14 w-full items-center gap-4 px-6 lg:px-8">
          <Link to="/dashboard" className="flex shrink-0 items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary">
              <span className="text-sm font-bold text-white">A</span>
            </div>
            <span className="hidden text-sm font-semibold text-gray-900 sm:inline">AMC Ops</span>
          </Link>

          <div className="flex min-w-0 flex-1 items-center gap-1">
            <nav className="no-scrollbar flex min-w-0 flex-1 items-center gap-1 overflow-visible">
              {navItems.map((item) =>
                item.to === "/projects" ? (
                  <ProjectsNavItem key={item.to} active={pathname.startsWith(item.to)} />
                ) : (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    label={item.label}
                    active={pathname.startsWith(item.to)}
                  />
                ),
              )}
            </nav>
            {user?.role === "admin" ? <AdminMenu items={adminItems} pathname={pathname} /> : null}
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              className="hidden h-8 w-8 items-center justify-center rounded-md text-gray-500 transition-colors hover:bg-gray-100 hover:text-primary sm:flex"
              aria-label="Alerts"
            >
              <Bell className="h-4 w-4" />
            </button>

            <button
              type="button"
              onClick={() => setDark(!dark)}
              className="flex h-8 w-8 items-center justify-center rounded-md text-gray-500 transition-colors hover:bg-gray-100 hover:text-primary"
              aria-label="Toggle theme"
            >
              {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </button>

            <div className="hidden h-6 w-px bg-gray-200 sm:block" />

            <UserMenu onEditProfile={() => setProfileOpen(true)} />
          </div>
        </div>
      </header>

      <EditProfileDialog open={profileOpen} onOpenChange={setProfileOpen} />

      <main className="w-full px-6 py-8 lg:px-8">
        <AnimatePresence mode="wait">
          <motion.div
            key={pathname}
            initial={reduceMotion ? false : { opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reduceMotion ? {} : { opacity: 0, y: -4 }}
            transition={{ duration: 0.2 }}
            className="w-full"
          >
            <Routes>
              <Route path="/dashboard" element={<DashboardPage />} />
              <Route path="/projects" element={<ProjectsPage />} />
              <Route path="/projects/:id" element={<ProjectDetailPage />} />
              <Route path="/reports" element={<ReportsPage />} />
              <Route path="/reports/new" element={<NewReportPage />} />
              <Route path="/tickets" element={<TicketsPage />} />
              <Route path="/tickets/:id" element={<TicketDetailPage />} />
              <Route path="/calendar" element={<CalendarPage />} />
              <Route path="/approvals" element={<ApprovalsPage />} />
              <Route path="/admin/users" element={<AdminUsersPage />} />
              <Route path="/admin/projects" element={<AdminProjectsPage />} />
              <Route path="/admin/templates" element={<AdminTemplatesPage />} />
              <Route path="*" element={<Navigate to="/dashboard" replace />} />
            </Routes>
          </motion.div>
        </AnimatePresence>
      </main>
    </div>
  );
}

function RootRouter() {
  const { isAuthenticated } = useAuth();
  return (
    <Routes>
      <Route path="/login" element={isAuthenticated ? <Navigate to="/dashboard" replace /> : <LoginPage />} />
      <Route
        path="/*"
        element={
          <ProtectedRoute>
            <AppLayout />
          </ProtectedRoute>
        }
      />
    </Routes>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BrowserRouter>
          <RootRouter />
        </BrowserRouter>
        <Toaster
          position="top-center"
          closeButton
          toastOptions={{
            classNames: {
              toast:
                "rounded-lg border text-sm font-medium shadow-md !items-center gap-2",
              title: "text-sm font-medium",
              success:
                "!border-success/25 !bg-success-light !text-success-dark [&_[data-icon]]:!text-success",
              error:
                "!border-danger/25 !bg-danger-light !text-danger-dark [&_[data-icon]]:!text-danger",
              warning:
                "!border-warning/25 !bg-warning-light !text-warning-dark [&_[data-icon]]:!text-warning",
            },
          }}
        />
      </AuthProvider>
    </QueryClientProvider>
  );
}

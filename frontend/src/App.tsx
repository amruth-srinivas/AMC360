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
  Sun,
  Users,
} from "lucide-react";
import { Toaster } from "sonner";
import { BrowserRouter, Link, Navigate, Route, Routes, useLocation } from "react-router-dom";
import type React from "react";
import { useEffect, useRef, useState } from "react";

import { Button } from "./components/ui/button";
import { AuthProvider, useAuth } from "./store/auth";
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

function AppLayout() {
  const { pathname } = useLocation();
  const { user, logout } = useAuth();
  const reduceMotion = useReducedMotion();
  const [dark, setDark] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.localStorage.getItem("theme") === "dark";
  });

  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
    window.localStorage.setItem("theme", dark ? "dark" : "light");
  }, [dark]);

  return (
    <div className="min-h-screen bg-gray-50 text-gray-800 font-sans">
      <header className="sticky top-0 z-30 overflow-visible border-b border-gray-200 bg-white/95 shadow-sm backdrop-blur-sm">
        <div className="flex h-14 w-full items-center gap-4 px-6 lg:px-8">
          <Link to="/dashboard" className="flex shrink-0 items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary">
              <span className="text-sm font-bold text-white">A</span>
            </div>
            <span className="hidden text-sm font-semibold text-gray-900 sm:inline">
              AMC Ops
            </span>
          </Link>

          <div className="flex min-w-0 flex-1 items-center gap-1">
            <nav className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto no-scrollbar">
              {navItems.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  label={item.label}
                  active={pathname.startsWith(item.to)}
                />
              ))}
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

            <div className="hidden items-center gap-2 sm:flex">
              <div className="text-right">
                <p className="text-sm font-medium text-gray-900 leading-tight">{user?.name}</p>
                <p className="text-xs text-gray-500 leading-tight">{user?.email}</p>
              </div>
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-sm font-semibold text-white">
                {user?.name?.charAt(0).toUpperCase()}
              </div>
            </div>

            <Button variant="ghost" size="sm" onClick={logout} aria-label="Sign out">
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>

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

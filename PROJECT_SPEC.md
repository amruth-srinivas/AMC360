# AMC Management & Support Tracking System

This repository implements an internal AMC support workspace for a small 4-5 person team.

## Core Scope

- FastAPI backend with PostgreSQL, SQLAlchemy async, Alembic, JWT auth, APScheduler, and notification logging.
- React 18 + TypeScript frontend built with Vite, Tailwind, Radix/shadcn-style components, Framer Motion, TanStack Query, FullCalendar, Recharts, and react-hook-form + zod.
- Three roles only: `admin`, `team_lead`, `team_member`.
- Main modules: users, projects, templates, reports, health checks, DB monitoring, backups, restoration drills, tickets, RCA, calendar, approvals, and notifications.

## Repository Layout

```text
/backend
  /app
    /api/v1
    /models
    /schemas
    /services
    /core
    main.py
  /alembic
  requirements.txt
/frontend
  /src
    /pages
    /components
    /features
    /lib
    /store
docker-compose.yml
DESIGN.md
PROJECT_SPEC.md
```

## Local Development

- Backend default URL: `http://localhost:8000`
- Frontend default URL: `http://localhost:5173`
- Bootstrap admin credentials: `admin@example.com` / `admin12345`

## Notes

- BRD-only enums and business detail refinements can be added later without reshaping the architecture.
- Email reminders are logged even when email sending is disabled for local development.

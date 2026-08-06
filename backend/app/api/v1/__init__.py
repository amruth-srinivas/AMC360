from fastapi import APIRouter

from app.api.v1 import (
    approvals,
    auth,
    calendar,
    db_monitoring,
    health_checks,
    issues,
    notifications,
    projects,
    report_library,
    reports,
    sprints,
    templates,
    tickets,
    users,
)


api_router = APIRouter()
api_router.include_router(auth.router)
api_router.include_router(users.router)
api_router.include_router(report_library.router)
api_router.include_router(projects.router)
api_router.include_router(sprints.router)
api_router.include_router(issues.router)
api_router.include_router(templates.router)
api_router.include_router(reports.router)
api_router.include_router(health_checks.router)
api_router.include_router(db_monitoring.router)
api_router.include_router(tickets.router)
api_router.include_router(tickets.rca_router)
api_router.include_router(calendar.router)
api_router.include_router(approvals.router)
api_router.include_router(notifications.router)

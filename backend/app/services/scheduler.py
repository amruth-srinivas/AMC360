from datetime import UTC, datetime, timedelta

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from sqlalchemy import select

from app.core.db import SessionLocal
from app.models.entities import Approval, ApprovalStatus, CalendarEvent, CalendarEventStatus
from app.services.crud import log_notification


scheduler = AsyncIOScheduler(timezone="UTC")


async def send_due_soon_notifications() -> None:
    async with SessionLocal() as db:
        now = datetime.now(UTC)
        upcoming = now + timedelta(days=1)
        result = await db.execute(
            select(CalendarEvent).where(
                CalendarEvent.status == CalendarEventStatus.SCHEDULED,
                CalendarEvent.due_date <= upcoming,
            )
        )
        for event in result.scalars().all():
            await log_notification(
                db,
                event.owner_id,
                "calendar_reminder",
                f"Reminder: {event.title}",
                f"calendar_event:{event.id}",
            )


async def send_pending_approval_notifications() -> None:
    async with SessionLocal() as db:
        result = await db.execute(
            select(Approval).where(Approval.status == ApprovalStatus.PENDING)
        )
        for approval in result.scalars().all():
            await log_notification(
                db,
                approval.approver_id,
                "approval_pending",
                f"Approval pending for {approval.entity_type}",
                f"{approval.entity_type}:{approval.entity_id}",
            )


def start_scheduler() -> None:
    if scheduler.running:
        return
    scheduler.add_job(send_due_soon_notifications, "interval", hours=4, id="calendar")
    scheduler.add_job(
        send_pending_approval_notifications,
        "interval",
        hours=6,
        id="approvals",
    )
    scheduler.start()

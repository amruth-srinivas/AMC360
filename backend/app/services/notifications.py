from fastapi_mail import ConnectionConfig, FastMail, MessageSchema, MessageType
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.services.crud import log_notification


settings = get_settings()
mail_config = ConnectionConfig(
    MAIL_USERNAME=settings.smtp_username,
    MAIL_PASSWORD=settings.smtp_password,
    MAIL_FROM=str(settings.smtp_from),
    MAIL_PORT=settings.smtp_port,
    MAIL_SERVER=settings.smtp_host,
    MAIL_FROM_NAME=settings.smtp_from_name,
    MAIL_STARTTLS=settings.smtp_starttls,
    MAIL_SSL_TLS=settings.smtp_ssl_tls,
    USE_CREDENTIALS=bool(settings.smtp_username),
)


async def send_notification(
    db: AsyncSession,
    recipient_email: str | None,
    subject: str,
    body: str,
    type_: str,
    user_id: int | None = None,
    related_entity: str | None = None,
) -> None:
    if settings.notifications_enabled and recipient_email:
        message = MessageSchema(
            subject=subject,
            recipients=[recipient_email],
            body=body,
            subtype=MessageType.plain,
        )
        fm = FastMail(mail_config)
        await fm.send_message(message)

    await log_notification(db, user_id, type_, subject, related_entity)

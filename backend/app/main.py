from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import select

from app.api.v1 import api_router
from app.core.config import get_settings
from app.core.db import SessionLocal
from app.core.security import get_password_hash
from app.models import User
from app.models.entities import RoleEnum
from app.services.scheduler import start_scheduler


settings = get_settings()


@asynccontextmanager
async def lifespan(_: FastAPI):
    async with SessionLocal() as db:
        result = await db.execute(select(User).where(User.email == settings.initial_admin_email))
        admin = result.scalar_one_or_none()
        if admin is None:
            db.add(
                User(
                    name=settings.initial_admin_name,
                    email=str(settings.initial_admin_email),
                    hashed_password=get_password_hash(settings.initial_admin_password),
                    role=RoleEnum.ADMIN,
                    is_active=True,
                )
            )
            await db.commit()
    start_scheduler()
    yield


app = FastAPI(title=settings.app_name, lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        settings.frontend_url,
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ],
    allow_origin_regex=r"https?://.*",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.include_router(api_router, prefix=settings.api_v1_prefix)


@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get(f"{settings.api_v1_prefix}/health")
async def health_v1() -> dict[str, str]:
    return {"status": "ok", "service": settings.app_name}

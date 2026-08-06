from functools import lru_cache

from pydantic import EmailStr, Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    app_name: str = "AMC Management & Support Tracking System"
    api_v1_prefix: str = "/api/v1"
    environment: str = "development"
    secret_key: str = Field(default="change-me-in-production", min_length=16)
    access_token_expire_minutes: int = 60 * 24
    algorithm: str = "HS256"

    database_url: str = (
        "postgresql+asyncpg://postgres:postgres@postgres:5432/amc_management"
    )
    sync_database_url: str = "postgresql+psycopg://postgres:postgres@postgres:5432/amc_management"

    smtp_host: str = "mailhog"
    smtp_port: int = 1025
    smtp_username: str = ""
    smtp_password: str = ""
    smtp_from: EmailStr = "noreply@example.com"
    smtp_from_name: str = "AMC Support"
    smtp_starttls: bool = False
    smtp_ssl_tls: bool = False
    notifications_enabled: bool = False

    frontend_url: str = "http://172.18.100.54:5173"
    initial_admin_name: str = "System Admin"
    initial_admin_email: EmailStr = "admin@example.com"
    initial_admin_password: str = "admin12345"

    minio_endpoint: str = "172.18.100.54:9000"
    minio_access_key: str = "minioadmin"
    minio_secret_key: str = "minioadmin"
    minio_bucket: str = "amc"
    minio_secure: bool = False
    minio_public_url: str = "http://172.18.100.54:9000"


@lru_cache
def get_settings() -> Settings:
    return Settings()

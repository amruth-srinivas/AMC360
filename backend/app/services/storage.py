"""MinIO object storage helpers for project documents."""

from __future__ import annotations

import io
import re
import uuid
from functools import lru_cache

from minio import Minio
from minio.error import S3Error

from app.core.config import get_settings


@lru_cache
def get_minio_client() -> Minio:
    settings = get_settings()
    return Minio(
        settings.minio_endpoint,
        access_key=settings.minio_access_key,
        secret_key=settings.minio_secret_key,
        secure=settings.minio_secure,
    )


def _bucket_name() -> str:
    # S3-compatible bucket names should be lowercase.
    return get_settings().minio_bucket.strip().lower() or "amc"


def ensure_bucket() -> None:
    client = get_minio_client()
    bucket = _bucket_name()
    if not client.bucket_exists(bucket):
        client.make_bucket(bucket)


def _safe_filename(filename: str) -> str:
    cleaned = re.sub(r"[^A-Za-z0-9._-]+", "_", filename.strip()) or "document"
    return cleaned[:180]


def _safe_category(category: str) -> str:
    cleaned = re.sub(r"[^A-Za-z0-9._-]+", "-", category.strip().lower()) or "other"
    return cleaned[:64]


def upload_project_document(
    *,
    project_no: str,
    category: str,
    filename: str,
    data: bytes,
    content_type: str | None = None,
) -> str:
    """Upload a categorized project document and return the object key."""
    ensure_bucket()
    safe_name = _safe_filename(filename)
    safe_cat = _safe_category(category)
    object_key = f"projects/{project_no}/{safe_cat}/{uuid.uuid4().hex}_{safe_name}"
    client = get_minio_client()
    client.put_object(
        _bucket_name(),
        object_key,
        io.BytesIO(data),
        length=len(data),
        content_type=content_type or "application/octet-stream",
    )
    return object_key


def upload_amc_document(
    *,
    project_no: str,
    filename: str,
    data: bytes,
    content_type: str | None = None,
) -> str:
    """Backward-compatible AMC terms upload."""
    return upload_project_document(
        project_no=project_no,
        category="amc_terms",
        filename=filename,
        data=data,
        content_type=content_type,
    )


def upload_calendar_final_report(
    *,
    project_no: str,
    event_id: int,
    filename: str,
    data: bytes,
    content_type: str | None = None,
) -> str:
    """Upload a calendar event final report and return the object key."""
    ensure_bucket()
    safe_name = _safe_filename(filename)
    object_key = f"projects/{project_no}/calendar/{event_id}/final/{uuid.uuid4().hex}_{safe_name}"
    client = get_minio_client()
    client.put_object(
        _bucket_name(),
        object_key,
        io.BytesIO(data),
        length=len(data),
        content_type=content_type or "application/octet-stream",
    )
    return object_key


def upload_project_report_file(
    *,
    project_no: str,
    report_type_slug: str,
    kind: str,
    filename: str,
    data: bytes,
    content_type: str | None = None,
    period_slug: str | None = None,
) -> str:
    """Upload a report template or completed report into a folder-like key path."""
    ensure_bucket()
    safe_name = _safe_filename(filename)
    safe_type = _safe_category(report_type_slug)
    safe_kind = _safe_category(kind)
    if period_slug:
        object_key = (
            f"projects/{project_no}/reports/{safe_type}/{_safe_category(period_slug)}/"
            f"{safe_kind}/{uuid.uuid4().hex}_{safe_name}"
        )
    else:
        object_key = (
            f"projects/{project_no}/reports/{safe_type}/{safe_kind}/"
            f"{uuid.uuid4().hex}_{safe_name}"
        )
    client = get_minio_client()
    client.put_object(
        _bucket_name(),
        object_key,
        io.BytesIO(data),
        length=len(data),
        content_type=content_type or "application/octet-stream",
    )
    return object_key


def upload_ticket_attachment(
    *,
    project_no: str,
    ticket_number: str,
    filename: str,
    data: bytes,
    content_type: str | None = None,
) -> str:
    """Upload a ticket attachment and return the object key."""
    ensure_bucket()
    safe_name = _safe_filename(filename)
    safe_ticket = re.sub(r"[^A-Za-z0-9._-]+", "-", ticket_number.strip())[:16] or "ticket"
    object_key = f"projects/{project_no}/tickets/{safe_ticket}/{uuid.uuid4().hex}_{safe_name}"
    client = get_minio_client()
    client.put_object(
        _bucket_name(),
        object_key,
        io.BytesIO(data),
        length=len(data),
        content_type=content_type or "application/octet-stream",
    )
    return object_key


def upload_user_avatar(
    *,
    user_id: int,
    filename: str,
    data: bytes,
    content_type: str | None = None,
) -> str:
    """Upload a user profile photo and return the object key."""
    ensure_bucket()
    safe_name = _safe_filename(filename)
    object_key = f"users/{user_id}/avatar/{uuid.uuid4().hex}_{safe_name}"
    client = get_minio_client()
    client.put_object(
        _bucket_name(),
        object_key,
        io.BytesIO(data),
        length=len(data),
        content_type=content_type or "application/octet-stream",
    )
    return object_key


def build_object_url(object_key: str) -> str:
    settings = get_settings()
    base = settings.minio_public_url.rstrip("/")
    return f"{base}/{_bucket_name()}/{object_key}"


def get_object_bytes(object_key: str) -> tuple[bytes, str | None]:
    client = get_minio_client()
    response = client.get_object(_bucket_name(), object_key)
    try:
        data = response.read()
        content_type = getattr(response, "headers", {}).get("Content-Type")
        return data, content_type
    finally:
        response.close()
        response.release_conn()


def delete_object(object_key: str | None) -> None:
    if not object_key:
        return
    client = get_minio_client()
    try:
        client.remove_object(_bucket_name(), object_key)
    except S3Error:
        pass

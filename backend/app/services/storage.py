"""MinIO object storage helpers for AMC documents."""

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


def upload_amc_document(
    *,
    project_no: str,
    filename: str,
    data: bytes,
    content_type: str | None = None,
) -> str:
    """Upload AMC terms PDF/doc and return the object key."""
    ensure_bucket()
    safe_name = _safe_filename(filename)
    object_key = f"projects/{project_no}/amc-terms/{uuid.uuid4().hex}_{safe_name}"
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


def delete_object(object_key: str | None) -> None:
    if not object_key:
        return
    client = get_minio_client()
    try:
        client.remove_object(_bucket_name(), object_key)
    except S3Error:
        pass

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from fastapi.responses import Response
from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.core.db import get_db
from app.core.security import create_access_token, verify_password
from app.models.entities import User
from app.schemas.common import LoginRequest, TokenResponse, UserRead, UserSelfUpdate, UserUpdate
from app.services.crud import update_user
from app.services.storage import delete_object, get_object_bytes, upload_user_avatar


router = APIRouter(prefix="/auth", tags=["auth"])

ALLOWED_AVATAR_TYPES = {
    "image/jpeg",
    "image/jpg",
    "image/png",
    "image/webp",
    "image/gif",
}
MAX_AVATAR_BYTES = 5 * 1024 * 1024


def _to_user_read(user: User) -> UserRead:
    return UserRead.model_validate(user)


@router.post("/login", response_model=TokenResponse)
async def login(payload: LoginRequest, db: AsyncSession = Depends(get_db)) -> TokenResponse:
    identifier = payload.identifier.strip()
    result = await db.execute(
        select(User).where(
            or_(User.email.ilike(identifier), User.employee_id == identifier)
        )
    )
    user = result.scalar_one_or_none()
    if not user or not verify_password(payload.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    token = create_access_token(user.id)
    return TokenResponse(access_token=token, user=_to_user_read(user))


@router.get("/me", response_model=UserRead)
async def me(current_user: User = Depends(get_current_user)) -> UserRead:
    return _to_user_read(current_user)


@router.put("/me", response_model=UserRead)
async def update_me(
    payload: UserSelfUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> UserRead:
    updates = payload.model_dump(exclude_unset=True)
    if updates.get("password") in (None, ""):
        updates.pop("password", None)
    for key in (
        "status_message",
        "linkedin_url",
        "github_url",
        "website_url",
        "bio",
        "phone",
        "designation",
        "employee_id",
    ):
        if key in updates and isinstance(updates[key], str) and not updates[key].strip():
            updates[key] = None
    user = await update_user(db, current_user, UserUpdate(**updates))
    return _to_user_read(user)


@router.put("/me/avatar", response_model=UserRead)
async def upload_my_avatar(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> UserRead:
    content_type = (file.content_type or "").lower()
    if content_type not in ALLOWED_AVATAR_TYPES:
        raise HTTPException(status_code=400, detail="Avatar must be a JPEG, PNG, WebP, or GIF image")

    data = await file.read()
    if not data:
        raise HTTPException(status_code=400, detail="Empty file")
    if len(data) > MAX_AVATAR_BYTES:
        raise HTTPException(status_code=400, detail="Avatar must be 5MB or smaller")

    old_key = current_user.avatar_object_key
    object_key = upload_user_avatar(
        user_id=current_user.id,
        filename=file.filename or "avatar.png",
        data=data,
        content_type=content_type,
    )
    user = await update_user(
        db,
        current_user,
        UserUpdate(avatar_object_key=object_key, avatar_content_type=content_type),
    )
    if old_key and old_key != object_key:
        delete_object(old_key)
    return _to_user_read(user)


@router.delete("/me/avatar", response_model=UserRead)
async def delete_my_avatar(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> UserRead:
    old_key = current_user.avatar_object_key
    user = await update_user(
        db,
        current_user,
        UserUpdate(avatar_object_key=None, avatar_content_type=None),
    )
    delete_object(old_key)
    return _to_user_read(user)


@router.get("/me/avatar")
async def get_my_avatar(current_user: User = Depends(get_current_user)) -> Response:
    if not current_user.avatar_object_key:
        raise HTTPException(status_code=404, detail="No profile photo")
    data, stored_type = get_object_bytes(current_user.avatar_object_key)
    media_type = current_user.avatar_content_type or stored_type or "image/jpeg"
    return Response(
        content=data,
        media_type=media_type,
        headers={"Cache-Control": "private, max-age=300"},
    )

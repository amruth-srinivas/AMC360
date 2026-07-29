from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, require_roles
from app.core.db import get_db
from app.models.entities import RoleEnum, User
from app.schemas.common import MessageResponse, UserCreate, UserRead, UserUpdate
from app.services.crud import create_user, delete_user, get_required, list_rows, update_user


router = APIRouter(prefix="/users", tags=["users"])


@router.get("", response_model=list[UserRead])
async def list_users(
    _: User = Depends(require_roles(RoleEnum.ADMIN)),
    db: AsyncSession = Depends(get_db),
) -> list[UserRead]:
    return [UserRead.model_validate(item) for item in await list_rows(db, User)]


@router.post("", response_model=UserRead)
async def add_user(
    payload: UserCreate,
    _: User = Depends(require_roles(RoleEnum.ADMIN)),
    db: AsyncSession = Depends(get_db),
) -> UserRead:
    return UserRead.model_validate(await create_user(db, payload))


@router.get("/{user_id}", response_model=UserRead)
async def get_user(
    user_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> UserRead:
    if current_user.role != RoleEnum.ADMIN and current_user.id != user_id:
        raise HTTPException(status_code=403, detail="Insufficient permissions")
    return UserRead.model_validate(await get_required(db, User, user_id))


@router.put("/{user_id}", response_model=UserRead)
async def edit_user(
    user_id: int,
    payload: UserUpdate,
    _: User = Depends(require_roles(RoleEnum.ADMIN)),
    db: AsyncSession = Depends(get_db),
) -> UserRead:
    user = await get_required(db, User, user_id)
    return UserRead.model_validate(await update_user(db, user, payload))


@router.delete("/{user_id}", response_model=MessageResponse)
async def remove_user(
    user_id: int,
    current_user: User = Depends(require_roles(RoleEnum.ADMIN)),
    db: AsyncSession = Depends(get_db),
) -> MessageResponse:
    if current_user.id == user_id:
        raise HTTPException(status_code=400, detail="You cannot delete your own account")
    user = await get_required(db, User, user_id)
    await delete_user(db, user)
    return MessageResponse(message="User deleted")

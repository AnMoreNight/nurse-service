from fastapi import APIRouter, Depends, Request, Query
from sqlalchemy.ext.asyncio import AsyncSession
from models.schemas import UserCreate, UserInvite, UserUpdate, UserSortOrder
from controller.user_controller import UserController
from db.database import get_db
from middleware.auth import get_current_user, require_company_admin
from uuid import UUID
from typing import Optional

router = APIRouter(prefix="/users", tags=["Users"])

@router.post("")
async def create_user(req: UserCreate, request: Request, db: AsyncSession = Depends(get_db)):
    user = await require_company_admin(request, db)  # Admin only
    return await UserController.create_user(
        db, user["company_id"], req.email, req.password, req.role, req.name,
        req.profession, req.job_title, req.display_color, req.join_date, req.left_date
    )

@router.post("/invite")
async def invite_user(req: UserInvite, request: Request, db: AsyncSession = Depends(get_db)):
    user = await require_company_admin(request, db)  # Admin only
    return await UserController.invite_user(db, user["company_id"], req.email, req.role)

@router.get("")
async def get_users(request: Request, company_id: Optional[UUID] = Query(None), db: AsyncSession = Depends(get_db)):
    user = await get_current_user(request, db)
    # SUPER_ADMIN can specify company_id for impersonation, others use their own
    effective_company_id = company_id if (user["role"] == "SUPER_ADMIN" and company_id) else user["company_id"]
    
    # NORMAL_USER can only see themselves
    filter_by_user = user["user_id"] if user["role"] == "NORMAL_USER" else None
    
    return await UserController.get_users(db, effective_company_id, filter_by_user)

@router.get("/{user_id}")
async def get_user(user_id: UUID, request: Request, db: AsyncSession = Depends(get_db)):
    user = await get_current_user(request, db)
    return await UserController.get_user(db, user_id, user["company_id"])

@router.put("/{user_id}")
async def update_user(user_id: UUID, req: UserUpdate, request: Request, db: AsyncSession = Depends(get_db)):
    user = await require_company_admin(request, db)  # Admin only
    return await UserController.update_user(
        db, user_id, user["company_id"],
        name=req.name, profession=req.profession, job_title=req.job_title,
        display_color=req.display_color, avatar_url=req.avatar_url, role=req.role,
        is_active=req.is_active, join_date=req.join_date, left_date=req.left_date
    )

@router.put("/sort-order")
async def update_sort_orders(orders: list[UserSortOrder], request: Request, db: AsyncSession = Depends(get_db)):
    user = await require_company_admin(request, db)  # Admin only
    sort_data = [{"user_id": str(o.user_id), "sort_order": o.sort_order} for o in orders]
    return await UserController.update_sort_orders(db, user["company_id"], sort_data)

@router.delete("/{user_id}")
async def delete_user(user_id: UUID, request: Request, db: AsyncSession = Depends(get_db)):
    user = await require_company_admin(request, db)  # Admin only
    return await UserController.deactivate_user(db, user_id, user["company_id"])

from fastapi import APIRouter, Depends, Request, Query, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from models.schemas import UserCreate, UserInvite, UserUpdate, UserSortOrder, UserCreateByAdmin, AssignCompanyAdmin, RemoveCompanyAdmin
from controller.user_controller import UserController
from db.database import get_db
from middleware.auth import get_current_user, require_company_admin, require_super_admin
from uuid import UUID
from typing import Optional

router = APIRouter(prefix="/users", tags=["Users"])

@router.post("")
async def create_user(req: UserCreate, request: Request, db: AsyncSession = Depends(get_db)):
    user = await require_company_admin(request, db)  # Admin only
    # Ensure admin has a company_id to assign to new users
    if not user["company_id"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot create users without a company. SUPER_ADMIN should use /users/admin/create endpoint."
        )
    return await UserController.create_user(
        db, user["company_id"], req.email, req.password, req.role, req.name,
        req.profession, req.job_title, req.display_color, req.join_date, req.left_date
    )

@router.post("/invite")
async def invite_user(req: UserInvite, request: Request, db: AsyncSession = Depends(get_db)):
    user = await require_company_admin(request, db)  # Admin only
    return await UserController.invite_user(db, user["company_id"], req.email, req.role)

@router.get("/all-users")
async def get_all_users(
    request: Request, 
    company_id: Optional[UUID] = Query(None),
    page: Optional[int] = Query(None),
    page_size: Optional[int] = Query(25),
    no_pagination: bool = Query(False),
    db: AsyncSession = Depends(get_db)
):
    """Get all users (including admins) with optional pagination. Requires admin access."""
    user = await get_current_user(request, db)
    
    # SUPER_ADMIN: can see all users or filter by company
    # COMPANY_ADMIN: can only see their company's users
    if user["role"] == "SUPER_ADMIN":
        effective_company_id = company_id  # None means all users
    elif user["role"] == "COMPANY_ADMIN":
        effective_company_id = user["company_id"]
    else:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admins can access this endpoint"
        )
    
    return await UserController.get_all_users(
        db, effective_company_id, page, page_size, no_pagination
    )

@router.get("")
async def get_users(request: Request, company_id: Optional[UUID] = Query(None), db: AsyncSession = Depends(get_db)):
    user = await get_current_user(request, db)
    
    # SUPER_ADMIN: None = all users, or specific company_id if provided
    # COMPANY_ADMIN/NORMAL_USER: their own company only
    if user["role"] == "SUPER_ADMIN":
        effective_company_id = company_id  # None means all users
    else:
        effective_company_id = user["company_id"]
    
    # All users can see all staff in their company (team collaboration requirement)
    return await UserController.get_users(db, effective_company_id, None)

@router.put("/sort-order")
async def update_sort_orders(orders: list[UserSortOrder], request: Request, db: AsyncSession = Depends(get_db)):
    user = await require_company_admin(request, db)  # Admin only
    sort_data = [{"user_id": str(o.user_id), "sort_order": o.sort_order} for o in orders]
    return await UserController.update_sort_orders(db, user["company_id"], sort_data)

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
        is_active=req.is_active, join_date=req.join_date, left_date=req.left_date,
        default_holiday_weekdays=req.default_holiday_weekdays
    )

@router.delete("/{user_id}")
async def delete_user(user_id: UUID, request: Request, db: AsyncSession = Depends(get_db)):
    user = await require_company_admin(request, db)  # Admin only
    return await UserController.delete_user(db, user_id, user["company_id"])

@router.post("/{user_id}/resign")
async def resign_user(user_id: UUID, request: Request, db: AsyncSession = Depends(get_db)):
    """Soft delete for resignation - preserves employment schedules, removes only future ones"""
    user = await require_company_admin(request, db)  # Admin only
    body = await request.json() if request.headers.get("content-type") == "application/json" else {}
    resignation_date = body.get("resignation_date")
    return await UserController.resign_user(db, user_id, user["company_id"], resignation_date)

# SUPER_ADMIN only endpoints
@router.post("/admin/create")
async def create_user_by_admin(req: UserCreateByAdmin, request: Request, db: AsyncSession = Depends(get_db)):
    """SUPER_ADMIN creates a user for any company"""
    await require_super_admin(request, db)
    return await UserController.create_user_by_admin(
        db, req.company_id, req.email, req.password, req.role, req.name,
        req.profession, req.job_title, req.display_color, req.join_date, req.left_date
    )

@router.post("/admin/assign-company-admin")
async def assign_company_admin(req: AssignCompanyAdmin, request: Request, db: AsyncSession = Depends(get_db)):
    """SUPER_ADMIN assigns a user as COMPANY_ADMIN for a specific company"""
    await require_super_admin(request, db)
    return await UserController.assign_company_admin(db, req.company_id, req.user_id)

@router.post("/admin/remove-company-admin")
async def remove_company_admin(req: RemoveCompanyAdmin, request: Request, db: AsyncSession = Depends(get_db)):
    """SUPER_ADMIN removes company admin role (user becomes NORMAL_USER, company remains)"""
    await require_super_admin(request, db)
    return await UserController.remove_company_admin(db, req.user_id)

@router.get("/admin/company-admins/{company_id}")
async def get_company_admins(company_id: UUID, request: Request, db: AsyncSession = Depends(get_db)):
    """SUPER_ADMIN gets all company admins for a specific company"""
    await require_super_admin(request, db)
    return await UserController.get_company_admins(db, company_id)

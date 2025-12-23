from fastapi import APIRouter, Depends, Request
from models.schemas import UserCreate, UserInvite, UserUpdate, UserSortOrder
from controller.user_controller import UserController
from middleware.auth import require_role, get_current_user
from uuid import UUID

router = APIRouter(prefix="/users", tags=["Users"])

@router.post("", dependencies=[Depends(require_role("SystemAdmin", "CompanyAdmin"))])
async def create_user(req: UserCreate, request: Request):
    user = await get_current_user(request)
    company_id = UUID(user['company_id'])
    return await UserController.create_user(
        company_id, req.email, req.password, req.role, req.name, 
        req.profession, req.job_title, req.display_color
    )

@router.post("/invite", dependencies=[Depends(require_role("SystemAdmin", "CompanyAdmin"))])
async def invite_user(req: UserInvite, request: Request):
    user = await get_current_user(request)
    company_id = UUID(user['company_id'])
    return await UserController.invite_user(company_id, req.email, req.role)

@router.get("", dependencies=[Depends(require_role("SystemAdmin", "CompanyAdmin", "User"))])
async def get_users(request: Request):
    user = await get_current_user(request)
    company_id = UUID(user['company_id'])
    return await UserController.get_users(company_id)

@router.get("/{user_id}", dependencies=[Depends(require_role("SystemAdmin", "CompanyAdmin", "User"))])
async def get_user(user_id: UUID, request: Request):
    user = await get_current_user(request)
    company_id = UUID(user['company_id'])
    return await UserController.get_user(user_id, company_id)

@router.patch("/{user_id}", dependencies=[Depends(require_role("SystemAdmin", "CompanyAdmin"))])
async def update_user(user_id: UUID, req: UserUpdate, request: Request):
    user = await get_current_user(request)
    company_id = UUID(user['company_id'])
    updates = {k: v for k, v in req.dict(exclude_unset=True).items()}
    return await UserController.update_user(user_id, company_id, **updates)

@router.post("/sort-order", dependencies=[Depends(require_role("SystemAdmin", "CompanyAdmin"))])
async def update_sort_orders(sort_orders: list[UserSortOrder], request: Request):
    user = await get_current_user(request)
    company_id = UUID(user['company_id'])
    return await UserController.update_sort_orders(company_id, [s.dict() for s in sort_orders])

@router.delete("/{user_id}", dependencies=[Depends(require_role("SystemAdmin", "CompanyAdmin"))])
async def delete_user(user_id: UUID, request: Request):
    user = await get_current_user(request)
    company_id = UUID(user['company_id'])
    return await UserController.delete_user(user_id, company_id)

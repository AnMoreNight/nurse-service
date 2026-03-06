from fastapi import APIRouter, Depends, Request
from sqlalchemy.ext.asyncio import AsyncSession
from models.schemas import LoginRequest, PasswordResetRequest, PasswordResetConfirm, InvitationAccept, ChangePasswordRequest, UpdateProfileRequest
from controller.auth_controller import AuthController
from db.database import get_db
from middleware.auth import get_current_user

router = APIRouter(prefix="/auth", tags=["Authentication"])

@router.post("/login")
async def login(req: LoginRequest, db: AsyncSession = Depends(get_db)):
    return await AuthController.login(db, req.login_id, req.password)

@router.post("/password-reset/request")
async def request_password_reset(req: PasswordResetRequest, db: AsyncSession = Depends(get_db)):
    return await AuthController.request_password_reset(db, req.login_id)

@router.post("/password-reset/confirm")
async def reset_password(req: PasswordResetConfirm, db: AsyncSession = Depends(get_db)):
    return await AuthController.reset_password(db, req.token, req.new_password)

@router.post("/invitation/accept")
async def accept_invitation(req: InvitationAccept, db: AsyncSession = Depends(get_db)):
    return await AuthController.accept_invitation(db, req.token, req.password, req.name)

@router.get("/profile")
async def get_profile(request: Request, db: AsyncSession = Depends(get_db)):
    """Get current user's profile"""
    user = await get_current_user(request, db)
    return await AuthController.get_profile(db, user["user_id"])

@router.put("/profile")
async def update_profile(req: UpdateProfileRequest, request: Request, db: AsyncSession = Depends(get_db)):
    """Update current user's profile (name and email)"""
    user = await get_current_user(request, db)
    return await AuthController.update_profile(db, user["user_id"], req.name, req.login_id)

@router.post("/change-password")
async def change_password(req: ChangePasswordRequest, request: Request, db: AsyncSession = Depends(get_db)):
    """Change current user's password"""
    user = await get_current_user(request, db)
    return await AuthController.change_password(db, user["user_id"], req.current_password, req.new_password)

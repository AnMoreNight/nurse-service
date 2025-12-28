from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from models.schemas import LoginRequest, PasswordResetRequest, PasswordResetConfirm, InvitationAccept
from controller.auth_controller import AuthController
from db.database import get_db

router = APIRouter(prefix="/auth", tags=["Authentication"])

@router.post("/login")
async def login(req: LoginRequest, db: AsyncSession = Depends(get_db)):
    return await AuthController.login(db, req.email, req.password)

@router.post("/password-reset/request")
async def request_password_reset(req: PasswordResetRequest, db: AsyncSession = Depends(get_db)):
    return await AuthController.request_password_reset(db, req.email)

@router.post("/password-reset/confirm")
async def reset_password(req: PasswordResetConfirm, db: AsyncSession = Depends(get_db)):
    return await AuthController.reset_password(db, req.token, req.new_password)

@router.post("/invitation/accept")
async def accept_invitation(req: InvitationAccept, db: AsyncSession = Depends(get_db)):
    return await AuthController.accept_invitation(db, req.token, req.password, req.name)

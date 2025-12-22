from fastapi import APIRouter, Depends, Request
from models.schemas import LoginRequest, PasswordResetRequest, PasswordResetConfirm, InvitationAccept
from controller.auth_controller import AuthController

router = APIRouter(prefix="/auth", tags=["Authentication"])

@router.post("/login")
async def login(req: LoginRequest):
    return await AuthController.login(req.email, req.password)

@router.post("/password-reset/request")
async def request_password_reset(req: PasswordResetRequest):
    return await AuthController.request_password_reset(req.email)

@router.post("/password-reset/confirm")
async def reset_password(req: PasswordResetConfirm):
    return await AuthController.reset_password(req.token, req.new_password)

@router.post("/invitation/accept")
async def accept_invitation(req: InvitationAccept):
    return await AuthController.accept_invitation(req.token, req.password, req.name)

from fastapi import Request, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from models.orm import User
from utils.utils import verify_access_token
from uuid import UUID

async def get_current_user(request: Request, db: AsyncSession) -> dict:
    """Extract and verify the current user from the request token."""
    auth_header = request.headers.get("Authorization")
    
    if not auth_header or not auth_header.startswith("Bearer "):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Missing or invalid authorization header")
    
    token = auth_header.split(" ")[1]
    payload = verify_access_token(token)
    
    if not payload:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired token")
    
    # Return user info from token
    user = {
        "user_id": UUID(payload.get("user_id")),
        "company_id": UUID(payload.get("company_id")) if payload.get("company_id") else None,
        "role": payload.get("role"),
        "email": payload.get("email")
    }
    
    # Security check: Non-SUPER_ADMIN users MUST have a company_id
    if user["role"] != "SUPER_ADMIN" and not user["company_id"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, 
            detail="Your account is not properly configured. Please contact system administrator to assign you to a company."
        )
    
    return user

async def require_super_admin(request: Request, db: AsyncSession) -> dict:
    """Require the current user to be a super admin."""
    user = await get_current_user(request, db)
    
    if user["role"] != "SUPER_ADMIN":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Super admin access required")
    
    return user

async def require_company_admin(request: Request, db: AsyncSession) -> dict:
    """Require the current user to be at least a company admin."""
    user = await get_current_user(request, db)
    
    if user["role"] not in ["SUPER_ADMIN", "COMPANY_ADMIN"]:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin access required")
    
    # Security check: COMPANY_ADMIN must have a company_id
    if user["role"] == "COMPANY_ADMIN" and not user["company_id"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, 
            detail="Company admin account is not properly configured. Contact system administrator."
        )
    
    return user

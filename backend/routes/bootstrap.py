from fastapi import APIRouter, HTTPException, status, Header, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from pydantic import BaseModel, field_validator
from models.orm import Company, User
from models.schemas import validate_login_id
from db.database import get_db
from uuid import uuid4
from datetime import datetime
import os

router = APIRouter(prefix="/bootstrap", tags=["Bootstrap"])

class BootstrapAdmin(BaseModel):
    login_id: str
    password: str
    name: str
    company_name: str | None = None

    @field_validator('login_id')
    @classmethod
    def validate_login_id_field(cls, v):
        return validate_login_id(v)

@router.post("/create-admin")
async def create_first_admin(
    data: BootstrapAdmin, 
    x_bootstrap_secret: str = Header(...),
    db: AsyncSession = Depends(get_db)
):
    """
    Create the first admin user. Requires BOOTSTRAP_SECRET header.
    - If company_name is provided: Creates company + COMPANY_ADMIN
    - If company_name is not provided: Creates pure SUPER_ADMIN (no company)
    This route can only be used when no users exist in the system.
    """
    bootstrap_secret = os.getenv("BOOTSTRAP_SECRET")
    
    if not bootstrap_secret or x_bootstrap_secret != bootstrap_secret:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Invalid bootstrap secret")
    
    # Check if any users exist
    result = await db.execute(select(func.count(User.user_id)))
    existing_users = result.scalar()
    
    if existing_users > 0:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Admin already exists")
    
    # Determine role and company based on company_name
    if data.company_name:
        # Create company
        company = Company(name=data.company_name)
        db.add(company)
        await db.flush()
        
        user = User(
            company_id=company.company_id,
            login_id=data.login_id,
            password_hash=data.password,
            role="COMPANY_ADMIN",
            name=data.name,
            is_active=True
        )
        company_id = str(company.company_id)
    else:
        user = User(
            company_id=None,
            login_id=data.login_id,
            password_hash=data.password,
            role="SUPER_ADMIN",
            name=data.name,
            is_active=True
        )
        company_id = None
    
    db.add(user)
    await db.flush()
    user_id = str(user.user_id)
    await db.commit()

    return {
        "message": f"{user.role} created successfully",
        "user_id": user_id,
        "company_id": company_id,
        "login_id": user.login_id,
        "role": user.role
    }

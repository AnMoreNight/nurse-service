from fastapi import APIRouter, HTTPException, status, Header, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from pydantic import BaseModel, EmailStr
from models.orm import Company, User
from utils.utils import hash_password
from db.database import get_db
from uuid import uuid4
from datetime import datetime
import os

router = APIRouter(prefix="/bootstrap", tags=["Bootstrap"])

class BootstrapAdmin(BaseModel):
    email: EmailStr
    password: str
    name: str
    company_name: str

@router.post("/create-admin")
async def create_first_admin(
    data: BootstrapAdmin, 
    x_bootstrap_secret: str = Header(...),
    db: AsyncSession = Depends(get_db)
):
    """
    Create the first SuperAdmin user. Requires BOOTSTRAP_SECRET header.
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
    
    # Create company
    company = Company(name=data.company_name)
    db.add(company)
    await db.flush()
    
    # Create super admin user
    hashed_password = hash_password(data.password)
    user = User(
        company_id=company.company_id,
        email=data.email,
        password_hash=hashed_password,
        role="SUPER_ADMIN",
        name=data.name,
        is_active=True
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)
    
    return {
        "message": "SuperAdmin created successfully",
        "user_id": str(user.user_id),
        "company_id": str(company.company_id),
        "email": user.email,
        "role": user.role
    }

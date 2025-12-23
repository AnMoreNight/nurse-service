from fastapi import APIRouter, HTTPException, status, Header
from pydantic import BaseModel, EmailStr
from db.db import get_pool
from utils.utils import hash_password
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
async def create_first_admin(data: BootstrapAdmin, x_bootstrap_secret: str = Header(...)):
    """
    Create the first SystemAdmin user. Requires BOOTSTRAP_SECRET header.
    This route can only be used when no users exist in the system.
    """
    bootstrap_secret = os.getenv("BOOTSTRAP_SECRET")
    
    if not bootstrap_secret or x_bootstrap_secret != bootstrap_secret:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Invalid bootstrap secret")
    
    pool = get_pool()
    async with pool.acquire() as conn:
        existing_users = await conn.fetchval("SELECT COUNT(*) FROM users")
        if existing_users > 0:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Admin already exists")
        
        company_id = uuid4()
        await conn.execute(
            "INSERT INTO companies (company_id, name, created_at, updated_at) VALUES ($1, $2, $3, $3)",
            company_id, data.company_name, datetime.utcnow()
        )
        
        user_id = uuid4()
        hashed_password = hash_password(data.password)
        await conn.execute(
            """INSERT INTO users (user_id, company_id, email, password_hash, role, name, is_active, created_at, updated_at)
               VALUES ($1, $2, $3, $4, 'SystemAdmin', $5, true, $6, $6)""",
            user_id, company_id, data.email, hashed_password, data.name, datetime.utcnow()
        )
        
        return {
            "message": "SystemAdmin created successfully",
            "user_id": str(user_id),
            "company_id": str(company_id),
            "email": data.email,
            "role": "SystemAdmin"
        }

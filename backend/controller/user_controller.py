from db.db import get_pool
from utils.utils import hash_password
from fastapi import HTTPException, status
from uuid import UUID, uuid4
from datetime import datetime, timedelta
import secrets

class UserController:
    @staticmethod
    async def create_user(company_id: UUID, email: str, password: str, role: str, name: str, profession: str = None, job_title: str = None, display_color: str = None):
        pool = get_pool()
        user_id = uuid4()
        hashed = hash_password(password)
        
        async with pool.acquire() as conn:
            try:
                await conn.execute(
                    """INSERT INTO users (user_id, company_id, email, password_hash, role, name, profession, job_title, display_color, is_active, created_at, updated_at)
                       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, true, $10, $10)""",
                    user_id, company_id, email, hashed, role, name, profession, job_title, display_color, datetime.utcnow()
                )
                return {"user_id": str(user_id), "email": email}
            except:
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Email already exists")
    
    @staticmethod
    async def invite_user(company_id: UUID, email: str, role: str):
        pool = get_pool()
        token = secrets.token_urlsafe(32)
        expires_at = datetime.utcnow() + timedelta(days=7)
        
        async with pool.acquire() as conn:
            await conn.execute(
                """INSERT INTO user_invitations (invitation_id, company_id, email, role, token, expires_at, created_at)
                   VALUES ($1, $2, $3, $4, $5, $6, $7)""",
                uuid4(), company_id, email, role, token, expires_at, datetime.utcnow()
            )
            return {"message": "Invitation sent", "token": token}
    
    @staticmethod
    async def get_users(company_id: UUID):
        pool = get_pool()
        async with pool.acquire() as conn:
            rows = await conn.fetch(
                """SELECT user_id, company_id, email, role, name, profession, job_title, display_color, avatar_url, sort_order, is_active, created_at
                   FROM users WHERE company_id = $1 ORDER BY sort_order NULLS LAST, created_at""",
                company_id
            )
            return [dict(row) for row in rows]
    
    @staticmethod
    async def get_user(user_id: UUID, company_id: UUID):
        pool = get_pool()
        async with pool.acquire() as conn:
            row = await conn.fetchrow(
                """SELECT user_id, company_id, email, role, name, profession, job_title, display_color, avatar_url, sort_order, is_active, created_at
                   FROM users WHERE user_id = $1 AND company_id = $2""",
                user_id, company_id
            )
            if not row:
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
            return dict(row)
    
    @staticmethod
    async def update_user(user_id: UUID, company_id: UUID, **updates):
        pool = get_pool()
        set_clause = ", ".join([f"{k} = ${i+3}" for i, k in enumerate(updates.keys())])
        values = list(updates.values())
        
        async with pool.acquire() as conn:
            result = await conn.execute(
                f"UPDATE users SET {set_clause}, updated_at = $1 WHERE user_id = $2 AND company_id = ${len(values)+3}",
                datetime.utcnow(), user_id, *values, company_id
            )
            if result == "UPDATE 0":
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
            return {"message": "User updated"}
    
    @staticmethod
    async def update_sort_orders(company_id: UUID, sort_orders: list):
        pool = get_pool()
        async with pool.acquire() as conn:
            async with conn.transaction():
                for item in sort_orders:
                    await conn.execute(
                        "UPDATE users SET sort_order = $1 WHERE user_id = $2 AND company_id = $3",
                        item['sort_order'], item['user_id'], company_id
                    )
            return {"message": "Sort orders updated"}
    
    @staticmethod
    async def delete_user(user_id: UUID, company_id: UUID):
        pool = get_pool()
        async with pool.acquire() as conn:
            result = await conn.execute("UPDATE users SET is_active = false WHERE user_id = $1 AND company_id = $2", user_id, company_id)
            if result == "UPDATE 0":
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
            return {"message": "User deactivated"}

from db.db import get_pool
from utils.utils import hash_password, verify_password, create_access_token
from fastapi import HTTPException, status
from uuid import UUID, uuid4
from datetime import datetime, timedelta
import secrets

class AuthController:
    @staticmethod
    async def login(email: str, password: str):
        pool = get_pool()
        async with pool.acquire() as conn:
            user = await conn.fetchrow(
                "SELECT user_id, company_id, email, password_hash, role, name, is_active FROM users WHERE email = $1",
                email
            )
            
            if not user or not verify_password(password, user['password_hash']):
                raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")
            
            if not user['is_active']:
                raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Account is inactive")
            
            token = create_access_token({
                "user_id": str(user['user_id']),
                "company_id": str(user['company_id']) if user['company_id'] else None,
                "role": user['role'],
                "email": user['email']
            })
            
            return {
                "access_token": token,
                "token_type": "bearer",
                "user": {
                    "user_id": str(user['user_id']),
                    "email": user['email'],
                    "role": user['role'],
                    "name": user['name']
                }
            }
    
    @staticmethod
    async def request_password_reset(email: str):
        pool = get_pool()
        async with pool.acquire() as conn:
            user = await conn.fetchrow("SELECT user_id FROM users WHERE email = $1", email)
            if not user:
                return {"message": "If email exists, reset link sent"}
            
            token = secrets.token_urlsafe(32)
            expires_at = datetime.utcnow() + timedelta(hours=1)
            
            await conn.execute(
                "INSERT INTO password_reset_tokens (token_id, user_id, token, expires_at) VALUES ($1, $2, $3, $4)",
                uuid4(), user['user_id'], token, expires_at
            )
            
            return {"message": "If email exists, reset link sent", "token": token}
    
    @staticmethod
    async def reset_password(token: str, new_password: str):
        pool = get_pool()
        async with pool.acquire() as conn:
            reset = await conn.fetchrow(
                "SELECT user_id FROM password_reset_tokens WHERE token = $1 AND expires_at > $2 AND used_at IS NULL",
                token, datetime.utcnow()
            )
            
            if not reset:
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid or expired token")
            
            hashed = hash_password(new_password)
            await conn.execute("UPDATE users SET password_hash = $1 WHERE user_id = $2", hashed, reset['user_id'])
            await conn.execute("UPDATE password_reset_tokens SET used_at = $1 WHERE token = $2", datetime.utcnow(), token)
            
            return {"message": "Password reset successful"}
    
    @staticmethod
    async def accept_invitation(token: str, password: str, name: str):
        pool = get_pool()
        async with pool.acquire() as conn:
            invite = await conn.fetchrow(
                "SELECT invitation_id, company_id, email, role FROM user_invitations WHERE token = $1 AND expires_at > $2 AND accepted_at IS NULL",
                token, datetime.utcnow()
            )
            
            if not invite:
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid or expired invitation")
            
            hashed = hash_password(password)
            user_id = uuid4()
            
            await conn.execute(
                """INSERT INTO users (user_id, company_id, email, password_hash, role, name, is_active, created_at, updated_at)
                   VALUES ($1, $2, $3, $4, $5, $6, true, $7, $7)""",
                user_id, invite['company_id'], invite['email'], hashed, invite['role'], name, datetime.utcnow()
            )
            
            await conn.execute("UPDATE user_invitations SET accepted_at = $1 WHERE invitation_id = $2", datetime.utcnow(), invite['invitation_id'])
            
            return {"message": "Account created successfully", "user_id": str(user_id)}

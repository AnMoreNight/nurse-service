from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from models.orm import User, Company
from utils.utils import hash_password, verify_password, create_access_token
from fastapi import HTTPException, status
from uuid import UUID, uuid4
from datetime import datetime, timedelta
import secrets

class AuthController:
    @staticmethod
    async def login(db: AsyncSession, email: str, password: str):
        # Single query: fetch user with company eagerly loaded
        result = await db.execute(
            select(User).options(
                selectinload(User.company)
            ).where(User.email == email)
        )
        user = result.scalar_one_or_none()

        if not user or not verify_password(password, user.password_hash):
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")

        if not user.is_active:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Account is inactive")

        company_name = user.company.name if user.company else None
        
        token = create_access_token({
            "user_id": str(user.user_id),
            "company_id": str(user.company_id) if user.company_id else None,
            "role": user.role,
            "email": user.email
        })
        
        return {
            "access_token": token,
            "token_type": "bearer",
            "user": {
                "user_id": str(user.user_id),
                "company_id": str(user.company_id) if user.company_id else None,
                "company_name": company_name,
                "email": user.email,
                "role": user.role,
                "name": user.name
            }
        }
    
    @staticmethod
    async def request_password_reset(db: AsyncSession, email: str):
        from models.orm import PasswordResetToken
        from services.email_service import email_service
        
        result = await db.execute(select(User).where(User.email == email))
        user = result.scalar_one_or_none()
        
        if not user:
            # Return success message even if user doesn't exist (security best practice)
            return {"message": "If email exists, reset link sent"}
        
        token = secrets.token_urlsafe(32)
        expires_at = datetime.utcnow() + timedelta(hours=1)
        
        reset_token = PasswordResetToken(
            user_id=user.user_id,
            token=token,
            expires_at=expires_at
        )
        db.add(reset_token)
        await db.commit()
        
        # Send password reset email
        try:
            await email_service.send_password_reset_email(
                email=user.email,
                reset_token=token,
                user_name=user.name
            )
        except Exception as e:
            # Log error but don't fail the request
            print(f"Failed to send password reset email: {e}")
        
        return {"message": "If email exists, reset link sent"}
    
    @staticmethod
    async def reset_password(db: AsyncSession, token: str, new_password: str):
        from models.orm import PasswordResetToken
        
        result = await db.execute(
            select(PasswordResetToken).where(
                PasswordResetToken.token == token,
                PasswordResetToken.expires_at > datetime.utcnow(),
                PasswordResetToken.used_at.is_(None)
            )
        )
        reset_token = result.scalar_one_or_none()
        
        if not reset_token:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid or expired token")
        
        # Update user password
        user_result = await db.execute(select(User).where(User.user_id == reset_token.user_id))
        user = user_result.scalar_one_or_none()
        
        if user:
            user.password_hash = hash_password(new_password)
            reset_token.used_at = datetime.utcnow()
            await db.commit()
        
        return {"message": "Password reset successful"}
    
    @staticmethod
    async def accept_invitation(db: AsyncSession, token: str, password: str, name: str):
        from models.orm import UserInvitation
        
        result = await db.execute(
            select(UserInvitation).where(
                UserInvitation.token == token,
                UserInvitation.expires_at > datetime.utcnow(),
                UserInvitation.accepted_at.is_(None)
            )
        )
        invite = result.scalar_one_or_none()
        
        if not invite:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid or expired invitation")
        
        # Create user
        new_user = User(
            company_id=invite.company_id,
            email=invite.email,
            password_hash=hash_password(password),
            role=invite.role,
            name=name,
            is_active=True
        )
        db.add(new_user)
        
        invite.accepted_at = datetime.utcnow()
        await db.flush()
        user_id = str(new_user.user_id)
        await db.commit()

        return {"message": "Account created successfully", "user_id": user_id}


    @staticmethod
    async def get_profile(db: AsyncSession, user_id: UUID):
        """Get user profile"""
        result = await db.execute(
            select(User).where(User.user_id == user_id)
        )
        user = result.scalar_one_or_none()
        
        if not user:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
        
        return {
            "user_id": str(user.user_id),
            "email": user.email,
            "name": user.name,
            "role": user.role,
            "company_id": str(user.company_id) if user.company_id else None,
            "profession": user.profession,
            "job_title": user.job_title,
            "display_color": user.display_color,
            "avatar_url": user.avatar_url,
            "join_date": str(user.join_date) if user.join_date else None,
            "left_date": str(user.left_date) if user.left_date else None,
            "created_at": user.created_at.isoformat() if user.created_at else None
        }
    
    @staticmethod
    async def update_profile(db: AsyncSession, user_id: UUID, name: str = None, email: str = None):
        """Update user profile (name and email)"""
        result = await db.execute(
            select(User).where(User.user_id == user_id)
        )
        user = result.scalar_one_or_none()
        
        if not user:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
        
        # Check if email is already taken by another user
        if email and email != user.email:
            existing = await db.execute(
                select(User).where(User.email == email, User.user_id != user_id)
            )
            if existing.scalar_one_or_none():
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Email already in use"
                )
            user.email = email
        
        if name:
            user.name = name
        
        user.updated_at = datetime.utcnow()
        await db.commit()
        
        return {"message": "Profile updated successfully"}
    
    @staticmethod
    async def change_password(db: AsyncSession, user_id: UUID, current_password: str, new_password: str):
        """Change user password"""
        result = await db.execute(
            select(User).where(User.user_id == user_id)
        )
        user = result.scalar_one_or_none()
        
        if not user:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
        
        # Verify current password
        if not verify_password(current_password, user.password_hash):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Current password is incorrect"
            )
        
        # Update password
        user.password_hash = hash_password(new_password)
        user.updated_at = datetime.utcnow()
        await db.commit()
        
        return {"message": "Password changed successfully"}
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from models.orm import User, Company
from utils.utils import create_access_token
from fastapi import HTTPException, status
from uuid import UUID, uuid4
from datetime import datetime, timedelta
import secrets

class AuthController:
    @staticmethod
    async def login(db: AsyncSession, login_id: str, password: str):
        result = await db.execute(
            select(User).options(
                selectinload(User.company)
            ).where(User.login_id == login_id)
        )
        user = result.scalar_one_or_none()

        if not user:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="このログインIDは登録されていません")

        if user.password_hash != password:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="パスワードが間違っています。管理者にお問い合わせください")

        if not user.is_active:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="アカウントが無効です")

        company_name = user.company.name if user.company else None
        
        token = create_access_token({
            "user_id": str(user.user_id),
            "company_id": str(user.company_id) if user.company_id else None,
            "role": user.role,
            "login_id": user.login_id
        })
        
        return {
            "access_token": token,
            "token_type": "bearer",
            "user": {
                "user_id": str(user.user_id),
                "company_id": str(user.company_id) if user.company_id else None,
                "company_name": company_name,
                "login_id": user.login_id,
                "role": user.role,
                "name": user.name
            }
        }
    
    @staticmethod
    async def request_password_reset(db: AsyncSession, login_id: str):
        from models.orm import PasswordResetToken
        from services.email_service import email_service
        
        result = await db.execute(select(User).where(User.login_id == login_id))
        user = result.scalar_one_or_none()
        
        if not user:
            return {"message": "If login_id exists, reset link sent"}
        
        token = secrets.token_urlsafe(32)
        expires_at = datetime.utcnow() + timedelta(hours=1)
        
        reset_token = PasswordResetToken(
            user_id=user.user_id,
            token=token,
            expires_at=expires_at
        )
        db.add(reset_token)
        await db.commit()
        
        try:
            await email_service.send_password_reset_email(
                email=user.login_id,
                reset_token=token,
                user_name=user.name
            )
        except Exception as e:
            print(f"Failed to send password reset email: {e}")
        
        return {"message": "If login_id exists, reset link sent"}
    
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
            user.password_hash = new_password
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
        
        new_user = User(
            company_id=invite.company_id,
            login_id=invite.login_id,
            password_hash=password,
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
            "login_id": user.login_id,
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
    async def update_profile(db: AsyncSession, user_id: UUID, name: str = None, login_id: str = None):
        """Update user profile (name and login_id)"""
        result = await db.execute(
            select(User).where(User.user_id == user_id)
        )
        user = result.scalar_one_or_none()
        
        if not user:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
        
        if login_id and login_id != user.login_id:
            existing = await db.execute(
                select(User).where(User.login_id == login_id, User.user_id != user_id)
            )
            if existing.scalar_one_or_none():
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="入力されたログインIDは既に使用されています。別のIDを指定してください。"
                )
            user.login_id = login_id
        
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
        if user.password_hash != current_password:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="現在のパスワードが正しくありません"
            )

        # Update password
        user.password_hash = new_password
        user.updated_at = datetime.utcnow()
        await db.commit()

        return {"message": "Password changed successfully"}
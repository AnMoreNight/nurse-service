from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update, delete, case
from models.orm import User, UserInvitation
from utils.utils import hash_password
from fastapi import HTTPException, status
from uuid import UUID, uuid4
from datetime import datetime, timedelta
from typing import Optional
import secrets

class UserController:
    @staticmethod
    async def create_user(db: AsyncSession, company_id: UUID, email: str, password: str, role: str, 
                         name: str, profession: str = None, job_title: str = None, 
                         display_color: str = None, join_date: str = None, left_date: str = None):
        # Check if email exists
        existing = await db.execute(select(User).where(User.email == email))
        if existing.scalar_one_or_none():
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Email already exists")
        
        new_user = User(
            company_id=company_id,
            email=email,
            password_hash=hash_password(password),
            role=role,
            name=name,
            profession=profession,
            job_title=job_title,
            display_color=display_color,
            join_date=datetime.strptime(join_date, "%Y-%m-%d").date() if join_date else None,
            left_date=datetime.strptime(left_date, "%Y-%m-%d").date() if left_date else None,
            is_active=True
        )
        db.add(new_user)
        await db.commit()
        await db.refresh(new_user)
        
        return {
            "user_id": str(new_user.user_id),
            "email": new_user.email,
            "role": new_user.role,
            "name": new_user.name
        }
    
    @staticmethod
    async def invite_user(db: AsyncSession, company_id: UUID, email: str, role: str):
        token = secrets.token_urlsafe(32)
        expires_at = datetime.utcnow() + timedelta(days=7)
        
        invite = UserInvitation(
            company_id=company_id,
            email=email,
            role=role,
            token=token,
            expires_at=expires_at
        )
        db.add(invite)
        await db.commit()
        
        return {"message": "Invitation sent", "token": token}
    
    @staticmethod
    async def get_users(db: AsyncSession, company_id: Optional[UUID] = None, filter_by_user: Optional[UUID] = None):
        query = select(User)
        
        # Filter by company if company_id is provided (None means get all users for SUPER_ADMIN)
        if company_id is not None:
            query = query.where(User.company_id == company_id)
        
        # NORMAL_USER can only see themselves
        if filter_by_user:
            query = query.where(User.user_id == filter_by_user)
        
        # Exclude SUPER_ADMIN and COMPANY_ADMIN from user lists (they shouldn't appear in schedules/shifts)
        # Only return NORMAL_USER role users for scheduling purposes
        query = query.where(User.role == 'NORMAL_USER')
        
        result = await db.execute(query.order_by(User.sort_order, User.name))
        users = result.scalars().all()
        
        return [
            {
                "user_id": str(u.user_id),
                "company_id": str(u.company_id) if u.company_id else None,
                "email": u.email,
                "role": u.role,
                "name": u.name,
                "profession": u.profession,
                "job_title": u.job_title,
                "display_color": u.display_color,
                "avatar_url": u.avatar_url,
                "sort_order": u.sort_order,
                "is_active": u.is_active,
                "join_date": str(u.join_date) if u.join_date else None,
                "left_date": str(u.left_date) if u.left_date else None,
                "created_at": u.created_at.isoformat() if u.created_at else None
            }
            for u in users
        ]
    
    @staticmethod
    async def get_user(db: AsyncSession, user_id: UUID, company_id: UUID):
        result = await db.execute(
            select(User).where(User.user_id == user_id, User.company_id == company_id)
        )
        user = result.scalar_one_or_none()
        
        if not user:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
        
        return {
            "user_id": str(user.user_id),
            "company_id": str(user.company_id) if user.company_id else None,
            "email": user.email,
            "role": user.role,
            "name": user.name,
            "profession": user.profession,
            "job_title": user.job_title,
            "display_color": user.display_color,
            "avatar_url": user.avatar_url,
            "sort_order": user.sort_order,
            "is_active": user.is_active,
            "join_date": str(user.join_date) if user.join_date else None,
            "left_date": str(user.left_date) if user.left_date else None,
            "created_at": user.created_at.isoformat() if user.created_at else None
        }
    
    @staticmethod
    async def update_user(db: AsyncSession, user_id: UUID, company_id: UUID, **updates):
        result = await db.execute(
            select(User).where(User.user_id == user_id, User.company_id == company_id)
        )
        user = result.scalar_one_or_none()
        
        if not user:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
        
        for key, value in updates.items():
            if value is not None and hasattr(user, key):
                if key in ['join_date', 'left_date'] and isinstance(value, str):
                    value = datetime.strptime(value, "%Y-%m-%d").date() if value else None
                setattr(user, key, value)
        
        user.updated_at = datetime.utcnow()
        await db.commit()
        
        return {"message": "User updated"}
    
    @staticmethod
    async def update_sort_orders(db: AsyncSession, company_id: UUID, sort_orders: list):
        # Bulk update using case statement for better performance
        
        # Create case mapping for sort_order
        when_clauses = {UUID(item['user_id']): item['sort_order'] for item in sort_orders}
        
        # Single UPDATE query with CASE statement
        await db.execute(
            update(User)
            .where(
                User.user_id.in_([UUID(item['user_id']) for item in sort_orders]),
                User.company_id == company_id
            )
            .values(sort_order=case(when_clauses, value=User.user_id))
        )
        
        await db.commit()
        return {"message": "Sort orders updated"}
    
    @staticmethod
    async def deactivate_user(db: AsyncSession, user_id: UUID, company_id: UUID):
        result = await db.execute(
            select(User).where(User.user_id == user_id, User.company_id == company_id)
        )
        user = result.scalar_one_or_none()
        
        if not user:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
        
        user.is_active = False
        user.left_date = datetime.utcnow().date()
        await db.commit()
        
        return {"message": "User deactivated"}
    
    @staticmethod
    async def create_user_by_admin(db: AsyncSession, company_id: UUID, email: str, password: str, 
                                   role: str, name: str, profession: str = None, 
                                   job_title: str = None, display_color: str = None, 
                                   join_date: str = None, left_date: str = None):
        """Create user by admin with explicit company_id - used by SUPER_ADMIN"""
        # Check if email exists
        existing = await db.execute(select(User).where(User.email == email))
        if existing.scalar_one_or_none():
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Email already exists")
        
        new_user = User(
            company_id=company_id,
            email=email,
            password_hash=hash_password(password),
            role=role,
            name=name,
            profession=profession,
            job_title=job_title,
            display_color=display_color,
            join_date=datetime.strptime(join_date, "%Y-%m-%d").date() if join_date else None,
            left_date=datetime.strptime(left_date, "%Y-%m-%d").date() if left_date else None,
            is_active=True
        )
        db.add(new_user)
        await db.commit()
        await db.refresh(new_user)
        
        return {
            "user_id": str(new_user.user_id),
            "company_id": str(new_user.company_id),
            "email": new_user.email,
            "role": new_user.role,
            "name": new_user.name
        }
    
    @staticmethod
    async def assign_company_admin(db: AsyncSession, company_id: UUID, user_id: UUID):
        """Assign a user as COMPANY_ADMIN for a specific company"""
        result = await db.execute(
            select(User).where(User.user_id == user_id)
        )
        user = result.scalar_one_or_none()
        
        if not user:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
        
        # Update user's company and role
        user.company_id = company_id
        user.role = "COMPANY_ADMIN"
        user.updated_at = datetime.utcnow()
        
        await db.commit()
        await db.refresh(user)
        
        return {
            "message": "Company admin assigned successfully",
            "user_id": str(user.user_id),
            "company_id": str(user.company_id),
            "role": user.role
        }
    
    @staticmethod
    async def remove_company_admin(db: AsyncSession, user_id: UUID):
        """Remove company admin role from a user (user becomes NORMAL_USER, company remains)"""
        result = await db.execute(
            select(User).where(User.user_id == user_id)
        )
        user = result.scalar_one_or_none()
        
        if not user:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
        
        if user.role != "COMPANY_ADMIN":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST, 
                detail="User is not a company admin"
            )
        
        # Change role to NORMAL_USER but keep the company_id
        user.role = "NORMAL_USER"
        user.updated_at = datetime.utcnow()
        
        await db.commit()
        await db.refresh(user)
        
        return {
            "message": "Company admin role removed. User is now NORMAL_USER",
            "user_id": str(user.user_id),
            "company_id": str(user.company_id) if user.company_id else None,
            "role": user.role
        }
    
    @staticmethod
    async def get_company_admins(db: AsyncSession, company_id: UUID):
        """Get all company admins for a specific company"""
        result = await db.execute(
            select(User).where(
                User.company_id == company_id,
                User.role == "COMPANY_ADMIN"
            ).order_by(User.name)
        )
        admins = result.scalars().all()
        
        return [
            {
                "user_id": str(admin.user_id),
                "company_id": str(admin.company_id),
                "email": admin.email,
                "name": admin.name,
                "role": admin.role,
                "is_active": admin.is_active,
                "created_at": admin.created_at.isoformat() if admin.created_at else None
            }
            for admin in admins
        ]

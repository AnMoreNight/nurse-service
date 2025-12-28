from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update, delete
from models.orm import ScheduleStatus
from fastapi import HTTPException, status
from uuid import UUID
from datetime import datetime

class StatusController:
    @staticmethod
    async def create_status(db: AsyncSession, company_id: UUID, name: str, color: str):
        new_status = ScheduleStatus(
            company_id=company_id,
            name=name,
            color=color
        )
        db.add(new_status)
        await db.commit()
        await db.refresh(new_status)
        
        return {
            "status_id": str(new_status.status_id),
            "company_id": str(new_status.company_id),
            "name": new_status.name,
            "color": new_status.color,
            "is_active": new_status.is_active,
            "is_default": new_status.is_default,
            "sort_order": new_status.sort_order
        }
    
    @staticmethod
    async def get_statuses(db: AsyncSession, company_id: UUID):
        result = await db.execute(
            select(ScheduleStatus)
            .where(ScheduleStatus.company_id == company_id)
            .order_by(ScheduleStatus.sort_order, ScheduleStatus.name)
        )
        statuses = result.scalars().all()
        
        return [
            {
                "status_id": str(s.status_id),
                "company_id": str(s.company_id),
                "name": s.name,
                "color": s.color,
                "is_active": s.is_active,
                "is_default": s.is_default,
                "sort_order": s.sort_order
            }
            for s in statuses
        ]
    
    @staticmethod
    async def update_status(db: AsyncSession, status_id: UUID, company_id: UUID, **updates):
        result = await db.execute(
            select(ScheduleStatus).where(
                ScheduleStatus.status_id == status_id,
                ScheduleStatus.company_id == company_id
            )
        )
        status_obj = result.scalar_one_or_none()
        
        if not status_obj:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Status not found")
        
        for key, value in updates.items():
            if value is not None and hasattr(status_obj, key):
                setattr(status_obj, key, value)
        
        await db.commit()
        return {"message": "Status updated"}
    
    @staticmethod
    async def delete_status(db: AsyncSession, status_id: UUID, company_id: UUID):
        result = await db.execute(
            select(ScheduleStatus).where(
                ScheduleStatus.status_id == status_id,
                ScheduleStatus.company_id == company_id
            )
        )
        status_obj = result.scalar_one_or_none()
        
        if not status_obj:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Status not found")
        
        if status_obj.is_default:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Cannot delete default status")
        
        await db.delete(status_obj)
        await db.commit()
        return {"message": "Status deleted"}

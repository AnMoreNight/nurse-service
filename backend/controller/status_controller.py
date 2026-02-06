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
        await db.flush()
        result_data = {
            "status_id": str(new_status.status_id),
            "company_id": str(new_status.company_id),
            "name": new_status.name,
            "color": new_status.color,
            "is_active": new_status.is_active,
            "is_default": new_status.is_default,
            "sort_order": new_status.sort_order
        }
        await db.commit()

        return result_data
    
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
    
    @staticmethod
    async def bulk_update_statuses(db: AsyncSession, company_id: UUID, status_items: list):
        """
        Bulk update statuses - creates new, updates existing, and deletes removed ones.
        All operations are done in a single transaction.
        """
        # Get all existing statuses for this company
        result = await db.execute(
            select(ScheduleStatus).where(ScheduleStatus.company_id == company_id)
        )
        existing_statuses = {str(s.status_id): s for s in result.scalars().all()}
        
        # Track which statuses are in the update
        updated_status_ids = set()
        created_statuses = []
        
        # Process each status item
        for idx, item in enumerate(status_items):
            status_id = str(item.status_id) if item.status_id else None
            
            if status_id and status_id in existing_statuses:
                # Update existing status
                status_obj = existing_statuses[status_id]
                status_obj.name = item.name
                status_obj.color = item.color
                if item.sort_order is not None:
                    status_obj.sort_order = item.sort_order
                else:
                    status_obj.sort_order = idx
                updated_status_ids.add(status_id)
            else:
                # Create new status
                new_status = ScheduleStatus(
                    company_id=company_id,
                    name=item.name,
                    color=item.color,
                    sort_order=item.sort_order if item.sort_order is not None else idx
                )
                db.add(new_status)
                created_statuses.append(new_status)
        
        # Delete statuses that are not in the update (except default ones)
        for status_id, status_obj in existing_statuses.items():
            if status_id not in updated_status_ids and not status_obj.is_default:
                await db.delete(status_obj)
        
        # Flush to get IDs for newly created statuses without extra refresh queries
        await db.flush()
        await db.commit()

        # Build result from in-memory objects instead of re-querying
        all_statuses_list = []
        # Add updated existing statuses
        for status_id, status_obj in existing_statuses.items():
            if status_id in updated_status_ids:
                all_statuses_list.append(status_obj)
            # Default statuses that weren't in the update are also kept
            elif status_obj.is_default:
                all_statuses_list.append(status_obj)
        # Add newly created statuses
        all_statuses_list.extend(created_statuses)

        # Sort by sort_order, then name
        all_statuses_list.sort(key=lambda s: (s.sort_order or 0, s.name or ''))

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
            for s in all_statuses_list
        ]

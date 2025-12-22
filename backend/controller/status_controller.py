from db.db import get_pool
from fastapi import HTTPException, status
from uuid import UUID, uuid4
from datetime import datetime

class StatusController:
    @staticmethod
    async def create_status(company_id: UUID, name: str, color: str):
        pool = get_pool()
        status_id = uuid4()
        
        async with pool.acquire() as conn:
            max_order = await conn.fetchval(
                "SELECT COALESCE(MAX(sort_order), 0) FROM schedule_statuses WHERE company_id = $1",
                company_id
            )
            
            await conn.execute(
                """INSERT INTO schedule_statuses (status_id, company_id, name, color, is_active, is_default, sort_order, created_at)
                   VALUES ($1, $2, $3, $4, true, false, $5, $6)""",
                status_id, company_id, name, color, max_order + 1, datetime.utcnow()
            )
            return {"status_id": str(status_id), "name": name}
    
    @staticmethod
    async def get_statuses(company_id: UUID):
        pool = get_pool()
        async with pool.acquire() as conn:
            rows = await conn.fetch(
                """SELECT status_id, company_id, name, color, is_active, is_default, sort_order, created_at
                   FROM schedule_statuses WHERE company_id = $1 AND is_active = true ORDER BY sort_order""",
                company_id
            )
            return [dict(row) for row in rows]
    
    @staticmethod
    async def update_status(status_id: UUID, company_id: UUID, **updates):
        pool = get_pool()
        set_clause = ", ".join([f"{k} = ${i+3}" for i, k in enumerate(updates.keys())])
        values = list(updates.values())
        
        async with pool.acquire() as conn:
            result = await conn.execute(
                f"UPDATE schedule_statuses SET {set_clause} WHERE status_id = $1 AND company_id = $2",
                status_id, company_id, *values
            )
            if result == "UPDATE 0":
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Status not found")
            return {"message": "Status updated"}
    
    @staticmethod
    async def delete_status(status_id: UUID, company_id: UUID):
        pool = get_pool()
        async with pool.acquire() as conn:
            is_default = await conn.fetchval(
                "SELECT is_default FROM schedule_statuses WHERE status_id = $1 AND company_id = $2",
                status_id, company_id
            )
            
            if is_default:
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Cannot delete default status")
            
            result = await conn.execute(
                "UPDATE schedule_statuses SET is_active = false WHERE status_id = $1 AND company_id = $2",
                status_id, company_id
            )
            if result == "UPDATE 0":
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Status not found")
            return {"message": "Status deleted"}

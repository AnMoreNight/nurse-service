from db.db import get_pool
from fastapi import HTTPException, status
from uuid import UUID, uuid4
from datetime import datetime

class CompanyController:
    @staticmethod
    async def create_company(name: str):
        pool = get_pool()
        company_id = uuid4()
        async with pool.acquire() as conn:
            await conn.execute(
                "INSERT INTO companies (company_id, name, created_at, updated_at) VALUES ($1, $2, $3, $3)",
                company_id, name, datetime.utcnow()
            )
            
            # Create default statuses
            default_statuses = [
                ("通常訪問（看護）", "#4CAF50", 1),
                ("通常訪問（リハ）", "#2196F3", 2),
                ("緊急訪問", "#F44336", 3),
                ("その他", "#9E9E9E", 4),
                ("キャンセル", "#757575", 5)
            ]
            
            for name, color, order in default_statuses:
                await conn.execute(
                    """INSERT INTO schedule_statuses (status_id, company_id, name, color, is_active, is_default, sort_order, created_at)
                       VALUES ($1, $2, $3, $4, true, true, $5, $6)""",
                    uuid4(), company_id, name, color, order, datetime.utcnow()
                )
            
            return {"company_id": str(company_id), "name": name}
    
    @staticmethod
    async def get_companies():
        pool = get_pool()
        async with pool.acquire() as conn:
            rows = await conn.fetch("SELECT company_id, name, created_at FROM companies ORDER BY created_at DESC")
            return [dict(row) for row in rows]
    
    @staticmethod
    async def get_company(company_id: UUID):
        pool = get_pool()
        async with pool.acquire() as conn:
            row = await conn.fetchrow("SELECT company_id, name, created_at FROM companies WHERE company_id = $1", company_id)
            if not row:
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Company not found")
            return dict(row)
    
    @staticmethod
    async def delete_company(company_id: UUID):
        pool = get_pool()
        async with pool.acquire() as conn:
            result = await conn.execute("DELETE FROM companies WHERE company_id = $1", company_id)
            if result == "DELETE 0":
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Company not found")
            return {"message": "Company deleted"}

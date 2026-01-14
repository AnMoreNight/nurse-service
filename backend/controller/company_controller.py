from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from models.orm import Company
from fastapi import HTTPException, status
from uuid import UUID
from datetime import datetime

class CompanyController:
    @staticmethod
    async def create_company(db: AsyncSession, name: str):
        company = Company(name=name, is_active=True)
        db.add(company)
        await db.commit()
        await db.refresh(company)
        return company

    @staticmethod
    async def get_companies(db: AsyncSession):
        result = await db.execute(select(Company).order_by(Company.name))
        companies = result.scalars().all()
        return companies

    @staticmethod
    async def get_company(db: AsyncSession, company_id: UUID):
        result = await db.execute(select(Company).where(Company.company_id == company_id))
        company = result.scalar_one_or_none()
        if not company:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Company not found")
        return company

    @staticmethod
    async def update_company(db: AsyncSession, company_id: UUID, name: str = None, is_active: bool = None):
        result = await db.execute(select(Company).where(Company.company_id == company_id))
        company = result.scalar_one_or_none()
        
        if not company:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Company not found")
        
        if name is not None:
            company.name = name
        if is_active is not None:
            company.is_active = is_active
        company.updated_at = datetime.utcnow()
        
        await db.commit()
        await db.refresh(company)
        return company

    @staticmethod
    async def delete_company(db: AsyncSession, company_id: UUID):
        result = await db.execute(select(Company).where(Company.company_id == company_id))
        company = result.scalar_one_or_none()
        
        if not company:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Company not found")
        
        await db.delete(company)
        await db.commit()
        return {"message": "Company deleted"}

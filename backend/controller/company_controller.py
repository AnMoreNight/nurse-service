from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete
from models.orm import Company, CompanySetting
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

    @staticmethod
    async def get_setting(db: AsyncSession, company_id: UUID, setting_key: str):
        """Get a specific company setting by key"""
        result = await db.execute(
            select(CompanySetting).where(
                CompanySetting.company_id == company_id,
                CompanySetting.setting_key == setting_key
            )
        )
        setting = result.scalar_one_or_none()
        if setting:
            return {"key": setting.setting_key, "value": setting.setting_value}
        return None

    @staticmethod
    async def get_all_settings(db: AsyncSession, company_id: UUID):
        """Get all settings for a company"""
        result = await db.execute(
            select(CompanySetting).where(CompanySetting.company_id == company_id)
        )
        settings = result.scalars().all()
        return {setting.setting_key: setting.setting_value for setting in settings}

    @staticmethod
    async def upsert_setting(db: AsyncSession, company_id: UUID, setting_key: str, setting_value: any):
        """Create or update a company setting"""
        # Check if setting exists
        result = await db.execute(
            select(CompanySetting).where(
                CompanySetting.company_id == company_id,
                CompanySetting.setting_key == setting_key
            )
        )
        setting = result.scalar_one_or_none()
        
        if setting:
            # Update existing setting
            setting.setting_value = setting_value
            setting.updated_at = datetime.utcnow()
        else:
            # Create new setting
            setting = CompanySetting(
                company_id=company_id,
                setting_key=setting_key,
                setting_value=setting_value
            )
            db.add(setting)
        
        await db.commit()
        await db.refresh(setting)
        return {"key": setting.setting_key, "value": setting.setting_value}

    @staticmethod
    async def delete_setting(db: AsyncSession, company_id: UUID, setting_key: str):
        """Delete a company setting"""
        await db.execute(
            delete(CompanySetting).where(
                CompanySetting.company_id == company_id,
                CompanySetting.setting_key == setting_key
            )
        )
        await db.commit()
        return {"message": "Setting deleted"}

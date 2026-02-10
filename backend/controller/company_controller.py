from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete
from models.orm import (
    Company, CompanySetting, User, Patient, Schedule, ScheduleStatus,
    ScheduleAssignment, Shift, WeeklyOffRule, UserInvitation,
    PasswordResetToken, AuditLog, RecurringRule
)
from fastapi import HTTPException, status
from uuid import UUID
from datetime import datetime

class CompanyController:
    @staticmethod
    async def create_company(db: AsyncSession, name: str):
        company = Company(name=name, is_active=True)
        db.add(company)
        await db.flush()
        await db.commit()
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
        return company

    @staticmethod
    async def delete_company(db: AsyncSession, company_id: UUID):
        result = await db.execute(select(Company).where(Company.company_id == company_id))
        company = result.scalar_one_or_none()

        if not company:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Company not found")

        # Get all user_ids for this company (needed for user-linked tables)
        user_result = await db.execute(select(User.user_id).where(User.company_id == company_id))
        user_ids = [row[0] for row in user_result.all()]

        # Get all schedule_ids for this company (needed for assignments)
        schedule_result = await db.execute(select(Schedule.schedule_id).where(Schedule.company_id == company_id))
        schedule_ids = [row[0] for row in schedule_result.all()]

        # Get all recurring_rule_ids for this company's schedules
        rule_result = await db.execute(
            select(Schedule.recurring_rule_id).where(
                Schedule.company_id == company_id,
                Schedule.recurring_rule_id.isnot(None)
            ).distinct()
        )
        rule_ids = [row[0] for row in rule_result.all()]

        # Delete in dependency order (children first)
        if schedule_ids:
            await db.execute(delete(ScheduleAssignment).where(ScheduleAssignment.schedule_id.in_(schedule_ids)))
        # Also delete assignments where company users are assigned to external schedules
        if user_ids:
            await db.execute(delete(ScheduleAssignment).where(ScheduleAssignment.user_id.in_(user_ids)))

        if user_ids:
            await db.execute(delete(PasswordResetToken).where(PasswordResetToken.user_id.in_(user_ids)))
            await db.execute(delete(AuditLog).where(AuditLog.user_id.in_(user_ids)))

        await db.execute(delete(AuditLog).where(AuditLog.company_id == company_id))
        await db.execute(delete(Shift).where(Shift.company_id == company_id))
        await db.execute(delete(WeeklyOffRule).where(WeeklyOffRule.company_id == company_id))
        await db.execute(delete(Schedule).where(Schedule.company_id == company_id))

        if rule_ids:
            await db.execute(delete(RecurringRule).where(RecurringRule.rule_id.in_(rule_ids)))

        await db.execute(delete(ScheduleStatus).where(ScheduleStatus.company_id == company_id))
        await db.execute(delete(Patient).where(Patient.company_id == company_id))
        await db.execute(delete(CompanySetting).where(CompanySetting.company_id == company_id))
        await db.execute(delete(UserInvitation).where(UserInvitation.company_id == company_id))
        await db.execute(delete(User).where(User.company_id == company_id))
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

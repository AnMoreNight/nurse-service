from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update, delete, and_
from models.orm import Shift, WeeklyOffRule, User
from fastapi import HTTPException, status
from uuid import UUID, uuid4
from datetime import datetime, date
from utils.constants import normalize_shift_type
import csv
import io

class ShiftController:
    @staticmethod
    async def create_shift(db: AsyncSession, company_id: UUID, user_id: UUID, 
                          shift_date: str, shift_type: str):
        # Normalize shift type from frontend format to backend format
        normalized_type = normalize_shift_type(shift_type)
        existing = await db.execute(
            select(Shift).where(
                Shift.user_id == user_id,
                Shift.shift_date == datetime.strptime(shift_date, "%Y-%m-%d").date()
            )
        )
        existing_shift = existing.scalar_one_or_none()
        
        if existing_shift:
            existing_shift.shift_type = normalized_type
            await db.commit()
            return {"shift_id": str(existing_shift.shift_id), "message": "Shift updated"}
        
        shift = Shift(
            company_id=company_id,
            user_id=user_id,
            shift_date=datetime.strptime(shift_date, "%Y-%m-%d").date(),
            shift_type=normalized_type
        )
        db.add(shift)
        await db.commit()
        await db.refresh(shift)
        
        return {"shift_id": str(shift.shift_id), "message": "Shift created"}
    
    @staticmethod
    async def get_shifts(db: AsyncSession, company_id: UUID, start_date: str = None, 
                        end_date: str = None, user_id: UUID = None):
        query = select(Shift).where(Shift.company_id == company_id)
        
        if start_date:
            query = query.where(Shift.shift_date >= datetime.strptime(start_date, "%Y-%m-%d").date())
        if end_date:
            query = query.where(Shift.shift_date <= datetime.strptime(end_date, "%Y-%m-%d").date())
        if user_id:
            query = query.where(Shift.user_id == user_id)
        
        query = query.order_by(Shift.shift_date)
        result = await db.execute(query)
        shifts = result.scalars().all()
        
        return [
            {
                "shift_id": str(s.shift_id),
                "company_id": str(s.company_id),
                "user_id": str(s.user_id),
                "shift_date": str(s.shift_date),
                "shift_type": s.shift_type,
                "is_auto_reflected": s.is_auto_reflected,
                "memo": s.memo,
                "created_at": s.created_at.isoformat() if s.created_at else None
            }
            for s in shifts
        ]
    
    @staticmethod
    async def update_shift(db: AsyncSession, shift_id: UUID, company_id: UUID, shift_type: str):
        normalized_type = normalize_shift_type(shift_type)
        result = await db.execute(
            select(Shift).where(Shift.shift_id == shift_id, Shift.company_id == company_id)
        )
        shift = result.scalar_one_or_none()
        
        if not shift:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Shift not found")
        
        shift.shift_type = normalized_type
        await db.commit()
        return {"message": "Shift updated"}
    
    @staticmethod
    async def delete_shift(db: AsyncSession, shift_id: UUID, company_id: UUID):
        result = await db.execute(
            select(Shift).where(Shift.shift_id == shift_id, Shift.company_id == company_id)
        )
        shift = result.scalar_one_or_none()
        
        if not shift:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Shift not found")
        
        await db.delete(shift)
        await db.commit()
        return {"message": "Shift deleted"}
    
    @staticmethod
    async def bulk_create_shifts(db: AsyncSession, company_id: UUID, user_id: UUID, shifts: list):
        created_ids = []
        for shift_data in shifts:
            shift = Shift(
                company_id=company_id,
                user_id=user_id,
                shift_date=datetime.strptime(shift_data['shift_date'], "%Y-%m-%d").date(),
                shift_type=shift_data['shift_type']
            )
            db.add(shift)
            await db.flush()
            created_ids.append(str(shift.shift_id))
        
        await db.commit()
        return {"message": f"Created {len(created_ids)} shifts", "shift_ids": created_ids}
    
    @staticmethod
    async def create_weekly_off_rule(db: AsyncSession, company_id: UUID, user_id: UUID, 
                                    day_of_week: int, shift_type: str):
        rule = WeeklyOffRule(
            company_id=company_id,
            user_id=user_id,
            day_of_week=day_of_week,
            shift_type=shift_type
        )
        db.add(rule)
        await db.commit()
        await db.refresh(rule)
        
        return {"rule_id": str(rule.rule_id), "message": "Weekly off rule created"}
    
    @staticmethod
    async def get_weekly_off_rules(db: AsyncSession, company_id: UUID, user_id: UUID = None):
        query = select(WeeklyOffRule).where(WeeklyOffRule.company_id == company_id)
        if user_id:
            query = query.where(WeeklyOffRule.user_id == user_id)
        
        result = await db.execute(query)
        rules = result.scalars().all()
        
        return [
            {
                "rule_id": str(r.rule_id),
                "company_id": str(r.company_id),
                "user_id": str(r.user_id),
                "day_of_week": r.day_of_week,
                "shift_type": r.shift_type
            }
            for r in rules
        ]
    
    @staticmethod
    async def apply_weekly_off_rules(db: AsyncSession, company_id: UUID, year: int, month: int):
        # Get all rules for this company
        rules_result = await db.execute(
            select(WeeklyOffRule).where(WeeklyOffRule.company_id == company_id)
        )
        rules = rules_result.scalars().all()
        
        if not rules:
            return {"message": "No rules to apply"}
        
        # Calculate all dates in the month
        from calendar import monthrange
        days_in_month = monthrange(year, month)[1]
        
        created_count = 0
        for day in range(1, days_in_month + 1):
            current_date = date(year, month, day)
            weekday = current_date.weekday()  # 0=Monday, 6=Sunday
            
            for rule in rules:
                if rule.day_of_week == weekday:
                    # Create shift if not exists
                    existing = await db.execute(
                        select(Shift).where(
                            Shift.user_id == rule.user_id,
                            Shift.shift_date == current_date
                        )
                    )
                    if not existing.scalar_one_or_none():
                        shift = Shift(
                            company_id=company_id,
                            user_id=rule.user_id,
                            shift_date=current_date,
                            shift_type=rule.shift_type,
                            is_auto_reflected=True
                        )
                        db.add(shift)
                        created_count += 1
        
        await db.commit()
        return {"message": f"Applied {created_count} shifts from weekly rules"}
    
    @staticmethod
    async def export_shifts_csv(db: AsyncSession, company_id: UUID, start_date: str, end_date: str):
        shifts = await ShiftController.get_shifts(db, company_id, start_date, end_date)
        
        # Get user names
        user_result = await db.execute(
            select(User).where(User.company_id == company_id)
        )
        users = {str(u.user_id): u.name for u in user_result.scalars().all()}
        
        output = io.StringIO()
        writer = csv.writer(output)
        writer.writerow(['Date', 'Staff', 'Shift Type'])
        
        for s in shifts:
            user_name = users.get(s['user_id'], 'Unknown')
            writer.writerow([s['shift_date'], user_name, s['shift_type']])
        
        return output.getvalue()

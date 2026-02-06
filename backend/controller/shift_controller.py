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
        await db.flush()
        shift_id = str(shift.shift_id)
        await db.commit()

        return {"shift_id": shift_id, "message": "Shift created"}
    
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
        new_shifts = [
            Shift(
                company_id=company_id,
                user_id=user_id,
                shift_date=datetime.strptime(shift_data['shift_date'], "%Y-%m-%d").date(),
                shift_type=shift_data['shift_type']
            )
            for shift_data in shifts
        ]
        db.add_all(new_shifts)
        await db.flush()  # Single flush to get all IDs
        created_ids = [str(s.shift_id) for s in new_shifts]
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
        await db.flush()
        rule_id = str(rule.rule_id)
        await db.commit()

        return {"rule_id": rule_id, "message": "Weekly off rule created"}
    
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

        from calendar import monthrange
        days_in_month = monthrange(year, month)[1]
        month_start = date(year, month, 1)
        month_end = date(year, month, days_in_month)

        # Batch-query all existing shifts for this month in one query
        # instead of querying per day per rule (N+1 problem)
        user_ids = list({rule.user_id for rule in rules})
        existing_result = await db.execute(
            select(Shift.user_id, Shift.shift_date).where(
                Shift.company_id == company_id,
                Shift.user_id.in_(user_ids),
                Shift.shift_date >= month_start,
                Shift.shift_date <= month_end
            )
        )
        existing_shifts = {(row.user_id, row.shift_date) for row in existing_result.all()}

        # Build all new shifts in memory, then add in batch
        new_shifts = []
        for day in range(1, days_in_month + 1):
            current_date = date(year, month, day)
            weekday = current_date.weekday()

            for rule in rules:
                if rule.day_of_week == weekday:
                    if (rule.user_id, current_date) not in existing_shifts:
                        new_shifts.append(Shift(
                            company_id=company_id,
                            user_id=rule.user_id,
                            shift_date=current_date,
                            shift_type=rule.shift_type,
                            is_auto_reflected=True
                        ))

        if new_shifts:
            db.add_all(new_shifts)
        await db.commit()
        return {"message": f"Applied {len(new_shifts)} shifts from weekly rules"}
    
    @staticmethod
    async def export_shifts_csv(db: AsyncSession, company_id: UUID, start_date: str, end_date: str):
        from sqlalchemy.orm import selectinload

        # Single query: fetch shifts with user data joined
        query = select(Shift).options(
            selectinload(Shift.user)
        ).where(Shift.company_id == company_id)

        if start_date:
            query = query.where(Shift.shift_date >= datetime.strptime(start_date, "%Y-%m-%d").date())
        if end_date:
            query = query.where(Shift.shift_date <= datetime.strptime(end_date, "%Y-%m-%d").date())

        query = query.order_by(Shift.shift_date)
        result = await db.execute(query)
        shifts = result.scalars().all()

        output = io.StringIO()
        writer = csv.writer(output)
        writer.writerow(['日付', 'スタッフ', 'シフト種別'])

        shift_type_japanese = {
            'Workday': '出勤',
            'ScheduledDayOff': '公休',
            'NightDuty1': '夜間待機1',
            'NightDuty2': '夜間待機2',
            'NightDuty1DayOff': '夜間待機1（休）',
            'NightDuty2DayOff': '夜間待機2（休）',
        }

        for s in shifts:
            user_name = s.user.name if s.user else 'Unknown'
            shift_type_jp = shift_type_japanese.get(s.shift_type, s.shift_type)
            date_str = str(s.shift_date)
            date_parts = date_str.split('-')
            date_jp = f"{date_parts[0]}年{int(date_parts[1])}月{int(date_parts[2])}日"
            writer.writerow([date_jp, user_name, shift_type_jp])

        return output.getvalue()

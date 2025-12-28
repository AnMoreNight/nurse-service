from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update, delete, and_
from sqlalchemy.orm import selectinload
from models.orm import Schedule, ScheduleAssignment, RecurringRule, User
from fastapi import HTTPException, status
from uuid import UUID, uuid4
from datetime import datetime, date
from typing import Optional
import csv
import io

class ScheduleController:
    @staticmethod
    async def create_schedule(db: AsyncSession, company_id: UUID, patient_id: Optional[UUID], 
                             patient_name: str, visit_address: str, start_time: datetime, 
                             end_time: datetime, status_id: UUID, memo: str, 
                             assigned_user_ids: list[UUID], recurring_rule: dict = None):
        
        recurring_rule_id = None
        recurring_series_id = uuid4() if recurring_rule else None
        
        # Create recurring rule if provided
        if recurring_rule:
            rule = RecurringRule(
                frequency=recurring_rule.get('frequency'),
                day_of_week=recurring_rule.get('day_of_week'),
                week_of_month=recurring_rule.get('week_of_month'),
                day_of_week_monthly=recurring_rule.get('day_of_week_monthly'),
                month_of_year=recurring_rule.get('month_of_year'),
                day_of_month=recurring_rule.get('day_of_month'),
                interval=recurring_rule.get('interval', 1),
                start_date=datetime.strptime(recurring_rule.get('start_date'), "%Y-%m-%d").date() if recurring_rule.get('start_date') else None,
                end_date=datetime.strptime(recurring_rule.get('end_date'), "%Y-%m-%d").date() if recurring_rule.get('end_date') else None
            )
            db.add(rule)
            await db.flush()
            recurring_rule_id = rule.rule_id
        
        # Create schedule
        schedule = Schedule(
            company_id=company_id,
            patient_id=patient_id,
            patient_name=patient_name,
            visit_address=visit_address,
            start_time=start_time,
            end_time=end_time,
            status_id=status_id,
            memo=memo,
            recurring_rule_id=recurring_rule_id,
            recurring_series_id=recurring_series_id,
            recurrence_index=0,
            is_exception=False
        )
        db.add(schedule)
        await db.flush()
        
        # Create assignments
        for user_id in assigned_user_ids:
            assignment = ScheduleAssignment(
                schedule_id=schedule.schedule_id,
                user_id=user_id
            )
            db.add(assignment)
        
        await db.commit()
        
        return {
            "schedule_id": str(schedule.schedule_id),
            "recurring_series_id": str(recurring_series_id) if recurring_series_id else None
        }
    
    @staticmethod
    async def get_schedules(db: AsyncSession, company_id: UUID, start_date: str = None, 
                           end_date: str = None, patient_name: str = None):
        query = select(Schedule).options(
            selectinload(Schedule.assignments).selectinload(ScheduleAssignment.user)
        ).where(Schedule.company_id == company_id)
        
        if start_date and end_date:
            query = query.where(
                Schedule.start_time >= start_date,
                Schedule.end_time <= end_date
            )
        
        if patient_name:
            query = query.where(Schedule.patient_name.ilike(f"%{patient_name}%"))
        
        query = query.order_by(Schedule.start_time)
        result = await db.execute(query)
        schedules = result.scalars().all()
        
        return [
            {
                "schedule_id": str(s.schedule_id),
                "company_id": str(s.company_id),
                "patient_id": str(s.patient_id) if s.patient_id else None,
                "patient_name": s.patient_name,
                "visit_address": s.visit_address,
                "start_time": s.start_time.isoformat() if s.start_time else None,
                "end_time": s.end_time.isoformat() if s.end_time else None,
                "status_id": str(s.status_id) if s.status_id else None,
                "memo": s.memo,
                "recurring_series_id": str(s.recurring_series_id) if s.recurring_series_id else None,
                "is_exception": s.is_exception,
                "created_at": s.created_at.isoformat() if s.created_at else None,
                "assigned_users": [
                    {
                        "user_id": str(a.user.user_id),
                        "email": a.user.email,
                        "role": a.user.role,
                        "name": a.user.name,
                        "profession": a.user.profession,
                        "display_color": a.user.display_color,
                        "avatar_url": a.user.avatar_url
                    }
                    for a in s.assignments if a.user
                ]
            }
            for s in schedules
        ]
    
    @staticmethod
    async def update_schedule(db: AsyncSession, schedule_id: UUID, company_id: UUID, 
                             update_scope: str = "this", **updates):
        result = await db.execute(
            select(Schedule).where(
                Schedule.schedule_id == schedule_id,
                Schedule.company_id == company_id
            )
        )
        schedule = result.scalar_one_or_none()
        
        if not schedule:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Schedule not found")
        
        assigned_user_ids = updates.pop('assigned_user_ids', None)
        
        if update_scope == "this":
            # Update only this occurrence
            for key, value in updates.items():
                if value is not None and hasattr(schedule, key):
                    setattr(schedule, key, value)
            
            if assigned_user_ids is not None:
                # Remove existing assignments and add new ones
                await db.execute(
                    delete(ScheduleAssignment).where(ScheduleAssignment.schedule_id == schedule_id)
                )
                for user_id in assigned_user_ids:
                    db.add(ScheduleAssignment(schedule_id=schedule_id, user_id=user_id))
        
        elif update_scope == "future" and schedule.recurring_series_id:
            schedule.is_exception = True
        
        elif update_scope == "all" and schedule.recurring_series_id:
            # Update all occurrences in the series
            all_in_series = await db.execute(
                select(Schedule).where(
                    Schedule.recurring_series_id == schedule.recurring_series_id,
                    Schedule.company_id == company_id
                )
            )
            series_schedules = all_in_series.scalars().all()
            
            for s in series_schedules:
                for key, value in updates.items():
                    if value is not None and hasattr(s, key):
                        setattr(s, key, value)
                
                if assigned_user_ids is not None:
                    await db.execute(
                        delete(ScheduleAssignment).where(ScheduleAssignment.schedule_id == s.schedule_id)
                    )
                    for user_id in assigned_user_ids:
                        db.add(ScheduleAssignment(schedule_id=s.schedule_id, user_id=user_id))
        
        schedule.updated_at = datetime.utcnow()
        await db.commit()
        return {"message": "Schedule updated"}
    
    @staticmethod
    async def delete_schedule(db: AsyncSession, schedule_id: UUID, company_id: UUID):
        result = await db.execute(
            select(Schedule).where(
                Schedule.schedule_id == schedule_id,
                Schedule.company_id == company_id
            )
        )
        schedule = result.scalar_one_or_none()
        
        if not schedule:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Schedule not found")
        
        await db.delete(schedule)
        await db.commit()
        return {"message": "Schedule deleted"}
    
    @staticmethod
    async def copy_schedule(db: AsyncSession, schedule_id: UUID, company_id: UUID):
        result = await db.execute(
            select(Schedule).where(
                Schedule.schedule_id == schedule_id,
                Schedule.company_id == company_id
            )
        )
        schedule = result.scalar_one_or_none()
        
        if not schedule:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Schedule not found")
        
        return {
            "patient_name": schedule.patient_name,
            "visit_address": schedule.visit_address
        }
    
    @staticmethod
    async def export_schedules_csv(db: AsyncSession, company_id: UUID, start_date: str = None, end_date: str = None):
        schedules = await ScheduleController.get_schedules(db, company_id, start_date, end_date)
        
        output = io.StringIO()
        writer = csv.writer(output)
        writer.writerow(['Schedule ID', 'Patient Name', 'Address', 'Start Time', 'End Time', 'Assigned Staff', 'Memo'])
        
        for s in schedules:
            staff_names = ", ".join([u['name'] for u in s['assigned_users']])
            writer.writerow([
                s['schedule_id'], s['patient_name'], s['visit_address'],
                s['start_time'], s['end_time'], staff_names, s['memo']
            ])
        
        return output.getvalue()

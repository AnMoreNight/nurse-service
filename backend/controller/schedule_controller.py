from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update, delete, and_
from sqlalchemy.orm import selectinload
from models.orm import Schedule, ScheduleAssignment, RecurringRule, User
from fastapi import HTTPException, status
from uuid import UUID, uuid4
from datetime import datetime, date, timedelta
from typing import Optional
import csv
import io
from utils.recurrence import expand_recurring_schedule

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
            # Handle week_of_month - normalize to array format or None
            week_of_month_val = recurring_rule.get('week_of_month')
            if week_of_month_val is not None:
                if isinstance(week_of_month_val, list):
                    # Empty list should be None for day-of-month mode
                    week_of_month_val = week_of_month_val if len(week_of_month_val) > 0 else None
                else:
                    week_of_month_val = [week_of_month_val]
            
            # Handle day_of_week - empty arrays should be None
            day_of_week_val = recurring_rule.get('day_of_week')
            if day_of_week_val is not None and isinstance(day_of_week_val, list) and len(day_of_week_val) == 0:
                day_of_week_val = None

            print(f"[DEBUG] Creating recurring rule - frequency: {recurring_rule.get('frequency')}, week_of_month: {week_of_month_val}, day_of_month: {recurring_rule.get('day_of_month')}")

            rule = RecurringRule(
                frequency=recurring_rule.get('frequency'),
                day_of_week=day_of_week_val,
                week_of_month=week_of_month_val,
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
                           end_date: str = None, patient_name: str = None, filter_by_user: UUID = None):
        from sqlalchemy.orm import joinedload
        
        query = select(Schedule).options(
            joinedload(Schedule.assignments).joinedload(ScheduleAssignment.user),
            joinedload(Schedule.recurring_rule)
        ).where(Schedule.company_id == company_id)
        
        # Apply patient name filter to base schedules
        if patient_name:
            query = query.where(Schedule.patient_name.ilike(f"%{patient_name}%"))
        
        # For NORMAL_USER, only show schedules they're assigned to
        if filter_by_user:
            query = query.join(Schedule.assignments).where(ScheduleAssignment.user_id == filter_by_user)
        
        # For recurring schedules, we need to query ALL base schedules
        # and expand them, not filter by date at query level
        query = query.order_by(Schedule.start_time)
        result = await db.execute(query)
        all_schedules = result.unique().scalars().all()
        
        # Filter to get only base schedules for recurring series
        # For recurring schedules: only keep those with recurrence_index=0 (the base schedule)
        # For non-recurring or exceptions: keep all
        seen_series = set()
        base_schedules = []
        for s in all_schedules:
            # If it has a recurring_rule_id and recurring_series_id and is not an exception
            # Only keep the first one we see for each recurring_series_id (the base schedule)
            if s.recurring_rule_id and s.recurring_series_id and not s.is_exception:
                series_key = str(s.recurring_series_id)
                if series_key not in seen_series:
                    seen_series.add(series_key)
                    base_schedules.append(s)
            else:
                # Non-recurring schedules or exceptions - keep all
                base_schedules.append(s)
        
        # Parse date range for expansion
        if start_date and end_date:
            try:
                query_start = datetime.strptime(start_date, "%Y-%m-%d").date()
                query_end = datetime.strptime(end_date, "%Y-%m-%d").date()
            except ValueError:
                # If parsing fails, default to reasonable range
                query_start = date.today() - timedelta(days=30)
                query_end = date.today() + timedelta(days=365)
        else:
            # Default: 1 month before to 1 year ahead
            query_start = date.today() - timedelta(days=30)
            query_end = date.today() + timedelta(days=365)
        
        # Safety limit: cap at 1 year expansion
        if (query_end - query_start).days > 365:
            query_end = query_start + timedelta(days=365)
        
        expanded_schedules = []
        
        # Collect exception dates by recurring_series_id
        # Exceptions are schedules that have recurring_series_id but is_exception=True
        exception_dates_by_series = {}
        for s in base_schedules:
            if s.is_exception and s.recurring_series_id:
                series_id = str(s.recurring_series_id)
                if series_id not in exception_dates_by_series:
                    exception_dates_by_series[series_id] = []
                # Get the date of this exception
                exception_date = s.start_time.date() if isinstance(s.start_time, datetime) else s.start_time
                exception_dates_by_series[series_id].append(exception_date.isoformat())
        
        for s in base_schedules:
            # Build base schedule dict
            schedule_dict = {
                "schedule_id": str(s.schedule_id),
                "company_id": str(s.company_id),
                "patient_id": str(s.patient_id) if s.patient_id else None,
                "patient_name": s.patient_name,
                "visit_address": s.visit_address,
                "status_id": str(s.status_id) if s.status_id else None,
                "memo": s.memo,
                "recurring_series_id": str(s.recurring_series_id) if s.recurring_series_id else None,
                "recurring_rule": {
                    "frequency": s.recurring_rule.frequency,
                    "day_of_week": s.recurring_rule.day_of_week,
                    "week_of_month": s.recurring_rule.week_of_month,
                    "day_of_week_monthly": s.recurring_rule.day_of_week_monthly,
                    "month_of_year": s.recurring_rule.month_of_year,
                    "day_of_month": s.recurring_rule.day_of_month,
                    "interval": s.recurring_rule.interval,
                    "start_date": s.recurring_rule.start_date.isoformat() if s.recurring_rule.start_date else None,
                    "end_date": s.recurring_rule.end_date.isoformat() if s.recurring_rule.end_date else None,
                } if s.recurring_rule else None,
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
            
            # Check if this is a recurring schedule (not an exception)
            if s.recurring_rule_id and s.recurring_rule and not s.is_exception:
                rule = s.recurring_rule
                
                # Get excluded dates for this series (exception dates)
                series_id = str(s.recurring_series_id) if s.recurring_series_id else None
                excluded_dates = exception_dates_by_series.get(series_id, []) if series_id else []
                
                # Build rule dict for expansion
                rule_dict = {
                    'frequency': rule.frequency,
                    'day_of_week': rule.day_of_week,
                    'week_of_month': rule.week_of_month,
                    'day_of_week_monthly': rule.day_of_week_monthly,
                    'month_of_year': rule.month_of_year,
                    'day_of_month': rule.day_of_month,
                    'interval': rule.interval,
                    'start_date': rule.start_date.isoformat() if rule.start_date else None,
                    'end_date': rule.end_date.isoformat() if rule.end_date else None
                }
                
                # Expand recurring schedule into instances
                try:
                    instances = expand_recurring_schedule(
                        base_date=s.start_time.date() if isinstance(s.start_time, datetime) else s.start_time,
                        start_time=s.start_time,
                        end_time=s.end_time,
                        rule=rule_dict,
                        query_start=query_start,
                        query_end=query_end,
                        excluded_dates=excluded_dates  # Exclude dates that have exceptions
                    )
                    
                    # Add each instance as a separate schedule
                    for idx, instance in enumerate(instances):
                        instance_dict = schedule_dict.copy()
                        instance_dict['start_time'] = instance['start_time'].isoformat()
                        instance_dict['end_time'] = instance['end_time'].isoformat()
                        instance_dict['date'] = instance['date'].isoformat()
                        # Add unique identifier for each occurrence
                        instance_dict['occurrence_index'] = idx
                        expanded_schedules.append(instance_dict)
                
                except Exception as e:
                    # If expansion fails, log and include base schedule
                    print(f"Recurrence expansion error for schedule {s.schedule_id}: {e}")
                    # Fall back to base schedule
                    schedule_dict['start_time'] = s.start_time.isoformat() if s.start_time else None
                    schedule_dict['end_time'] = s.end_time.isoformat() if s.end_time else None
                    expanded_schedules.append(schedule_dict)
            else:
                # Non-recurring schedule or exception - add as-is if within date range
                schedule_dict['start_time'] = s.start_time.isoformat() if s.start_time else None
                schedule_dict['end_time'] = s.end_time.isoformat() if s.end_time else None
                
                # Filter by date range if specified
                if start_date and end_date:
                    schedule_date = s.start_time.date() if isinstance(s.start_time, datetime) else s.start_time
                    if query_start <= schedule_date <= query_end:
                        expanded_schedules.append(schedule_dict)
                else:
                    expanded_schedules.append(schedule_dict)
        
        # Sort by start time
        expanded_schedules.sort(key=lambda x: x['start_time'] if x['start_time'] else '')
        
        return expanded_schedules
    
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
        recurring_rule_data = updates.pop('recurring_rule', None)
        
        # Handle adding recurrence to a non-recurring schedule
        if recurring_rule_data and not schedule.recurring_rule_id:
            # Create new recurring rule
            week_of_month_val = recurring_rule_data.get('week_of_month')
            if week_of_month_val is not None:
                if isinstance(week_of_month_val, list):
                    week_of_month_val = week_of_month_val if len(week_of_month_val) > 0 else None
                else:
                    week_of_month_val = [week_of_month_val]
            
            # Handle day_of_week - empty arrays should be None
            day_of_week_val = recurring_rule_data.get('day_of_week')
            if day_of_week_val is not None and isinstance(day_of_week_val, list) and len(day_of_week_val) == 0:
                day_of_week_val = None
            
            rule = RecurringRule(
                frequency=recurring_rule_data.get('frequency'),
                day_of_week=day_of_week_val,
                week_of_month=week_of_month_val,
                day_of_week_monthly=recurring_rule_data.get('day_of_week_monthly'),
                month_of_year=recurring_rule_data.get('month_of_year'),
                day_of_month=recurring_rule_data.get('day_of_month'),
                interval=recurring_rule_data.get('interval', 1),
                start_date=datetime.strptime(recurring_rule_data.get('start_date'), "%Y-%m-%d").date() if recurring_rule_data.get('start_date') else None,
                end_date=datetime.strptime(recurring_rule_data.get('end_date'), "%Y-%m-%d").date() if recurring_rule_data.get('end_date') else None
            )
            db.add(rule)
            await db.flush()
            
            # Update schedule with new recurring rule
            schedule.recurring_rule_id = rule.rule_id
            schedule.recurring_series_id = uuid4()
            schedule.is_exception = False
            
            # Also update other fields
            for key, value in updates.items():
                if value is not None and hasattr(schedule, key):
                    setattr(schedule, key, value)
            
            if assigned_user_ids is not None:
                await db.execute(
                    delete(ScheduleAssignment).where(ScheduleAssignment.schedule_id == schedule_id)
                )
                for user_id in assigned_user_ids:
                    db.add(ScheduleAssignment(schedule_id=schedule_id, user_id=user_id))
            
            await db.commit()
            return {"message": "Schedule updated with recurrence", "schedule_id": str(schedule_id)}
        
        if update_scope == "this":
            # Check if this is a recurring schedule (not an exception) with a new occurrence date
            occurrence_date = None
            if 'start_time' in updates and updates['start_time']:
                new_start_time = updates['start_time']
                if isinstance(new_start_time, datetime):
                    occurrence_date = new_start_time.date()
                elif isinstance(new_start_time, str):
                    occurrence_date = datetime.fromisoformat(new_start_time.replace('Z', '+00:00')).date()
            
            # If this is a recurring schedule (has rule), create an exception
            if schedule.recurring_rule_id and not schedule.is_exception and occurrence_date:
                # Create a new exception schedule for this specific occurrence
                exception_schedule = Schedule(
                    company_id=schedule.company_id,
                    patient_id=schedule.patient_id,
                    patient_name=updates.get('patient_name', schedule.patient_name),
                    visit_address=updates.get('visit_address', schedule.visit_address),
                    start_time=updates.get('start_time', schedule.start_time),
                    end_time=updates.get('end_time', schedule.end_time),
                    status_id=updates.get('status_id', schedule.status_id),
                    memo=updates.get('memo', schedule.memo),
                    recurring_rule_id=None,  # No recurring rule for exceptions
                    recurring_series_id=schedule.recurring_series_id,  # Same series
                    recurrence_index=0,
                    is_exception=True  # Mark as exception
                )
                db.add(exception_schedule)
                await db.flush()
                
                # Add assignments to exception
                if assigned_user_ids is not None:
                    user_ids_to_assign = assigned_user_ids
                else:
                    user_ids_to_assign = [a.user_id for a in schedule.assignments]
                
                for user_id in user_ids_to_assign:
                    db.add(ScheduleAssignment(schedule_id=exception_schedule.schedule_id, user_id=user_id))
                
                await db.commit()
                return {"message": "Schedule updated", "schedule_id": str(exception_schedule.schedule_id)}
            else:
                # Non-recurring or already an exception - update directly
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
        
        elif update_scope == "future" and schedule.recurring_series_id and schedule.recurring_rule_id:
            # Split the recurring series: end the old one and create a new one from this point forward
            
            # Get the original recurring rule
            rule_result = await db.execute(
                select(RecurringRule).where(RecurringRule.rule_id == schedule.recurring_rule_id)
            )
            original_rule = rule_result.scalar_one_or_none()
            
            if original_rule:
                # Step 1: Update the original rule to end before this occurrence
                # Set end_date to one day before the current schedule's start date
                occurrence_date = schedule.start_time.date() if isinstance(schedule.start_time, datetime) else schedule.start_time
                day_before = occurrence_date - timedelta(days=1)
                original_rule.end_date = day_before
                
                # Step 2: Create a new recurring rule starting from this occurrence
                new_rule = RecurringRule(
                    frequency=original_rule.frequency,
                    day_of_week=updates.pop('day_of_week', original_rule.day_of_week),
                    week_of_month=updates.pop('week_of_month', original_rule.week_of_month),
                    day_of_week_monthly=updates.pop('day_of_week_monthly', original_rule.day_of_week_monthly),
                    month_of_year=updates.pop('month_of_year', original_rule.month_of_year),
                    day_of_month=updates.pop('day_of_month', original_rule.day_of_month),
                    interval=updates.pop('interval', original_rule.interval),
                    start_date=occurrence_date,
                    end_date=original_rule.end_date  # Keep the same overall end date
                )
                db.add(new_rule)
                await db.flush()
                
                # Step 3: Create a new base schedule for the new series
                new_series_id = uuid4()
                new_schedule = Schedule(
                    company_id=schedule.company_id,
                    patient_id=schedule.patient_id,
                    patient_name=updates.get('patient_name', schedule.patient_name),
                    visit_address=updates.get('visit_address', schedule.visit_address),
                    start_time=updates.get('start_time', schedule.start_time),
                    end_time=updates.get('end_time', schedule.end_time),
                    status_id=updates.get('status_id', schedule.status_id),
                    memo=updates.get('memo', schedule.memo),
                    recurring_rule_id=new_rule.rule_id,
                    recurring_series_id=new_series_id,
                    recurrence_index=0,
                    is_exception=False
                )
                db.add(new_schedule)
                await db.flush()
                
                # Step 4: Copy staff assignments to new schedule
                if assigned_user_ids is not None:
                    user_ids_to_assign = assigned_user_ids
                else:
                    # Copy from original schedule
                    user_ids_to_assign = [a.user_id for a in schedule.assignments]
                
                for user_id in user_ids_to_assign:
                    db.add(ScheduleAssignment(schedule_id=new_schedule.schedule_id, user_id=user_id))

        
        elif update_scope == "all" and schedule.recurring_series_id:
            # Update all occurrences in the series
            all_in_series = await db.execute(
                select(Schedule).where(
                    Schedule.recurring_series_id == schedule.recurring_series_id,
                    Schedule.company_id == company_id
                )
            )
            series_schedules = all_in_series.scalars().all()
            series_schedule_ids = [s.schedule_id for s in series_schedules]
            
            for s in series_schedules:
                for key, value in updates.items():
                    if value is not None and hasattr(s, key):
                        setattr(s, key, value)
            
            if assigned_user_ids is not None:
                await db.execute(
                    delete(ScheduleAssignment).where(
                        ScheduleAssignment.schedule_id.in_(series_schedule_ids)
                    )
                )
                
                new_assignments = [
                    ScheduleAssignment(schedule_id=schedule_id, user_id=user_id)
                    for schedule_id in series_schedule_ids
                    for user_id in assigned_user_ids
                ]
                db.add_all(new_assignments)
        
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


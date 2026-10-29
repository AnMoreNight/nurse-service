from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update, delete, and_, or_
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
    async def bulk_create_special_instruction(
        db: AsyncSession, company_id: UUID, patient_name: str, visit_address: str,
        start_date_str: str, start_time_str: str, end_time_str: str,
        status_id: UUID, memo: str, assigned_user_ids: list[UUID], days: int = 14
    ):
        base_date = datetime.strptime(start_date_str, "%Y-%m-%d").date()
        created_ids = []

        for day_offset in range(days):
            current_date = base_date + timedelta(days=day_offset)
            start_dt = datetime.combine(current_date, datetime.strptime(start_time_str, "%H:%M").time())
            end_dt = datetime.combine(current_date, datetime.strptime(end_time_str, "%H:%M").time())

            schedule = Schedule(
                company_id=company_id,
                patient_name=patient_name,
                visit_address=visit_address,
                start_time=start_dt,
                end_time=end_dt,
                status_id=status_id,
                memo=memo,
                is_exception=False,
            )
            db.add(schedule)
            await db.flush()

            for user_id in assigned_user_ids:
                db.add(ScheduleAssignment(schedule_id=schedule.schedule_id, user_id=user_id))

            created_ids.append(str(schedule.schedule_id))

        await db.commit()
        return {
            "created_count": len(created_ids),
            "schedule_ids": created_ids,
            "start_date": start_date_str,
            "end_date": str(base_date + timedelta(days=days - 1)),
        }

    @staticmethod
    async def bulk_create_recurring(
        db: AsyncSession, company_id: UUID, patient_name: str, visit_address: str,
        start_date_str: str, start_time_str: str, end_time_str: str,
        day_of_week: list[int], status_id: UUID, memo: str, assigned_user_ids: list[UUID]
    ):
        base_date = datetime.strptime(start_date_str, "%Y-%m-%d").date()
        start_time_obj = datetime.strptime(start_time_str, "%H:%M").time()
        end_time_obj = datetime.strptime(end_time_str, "%H:%M").time()

        normalized_days = sorted({int(d) for d in (day_of_week or []) if 0 <= int(d) <= 6})
        if not normalized_days:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="day_of_week must contain at least one weekday"
            )

        # Use JS weekday convention to match frontend: 0=Sun .. 6=Sat
        base_js_dow = (base_date.weekday() + 1) % 7
        created_series = []

        for dow in normalized_days:
            offset = (dow - base_js_dow) % 7
            series_start_date = base_date + timedelta(days=offset)
            start_dt = datetime.combine(series_start_date, start_time_obj)
            end_dt = datetime.combine(series_start_date, end_time_obj)

            # Create one independent weekly series per weekday so future updates
            # only affect that weekday's schedules.
            rule = RecurringRule(
                frequency="weekly",
                day_of_week=[dow],
                interval=1,
                start_date=series_start_date,
                end_date=None,
            )
            db.add(rule)
            await db.flush()

            recurring_series_id = uuid4()
            schedule = Schedule(
                company_id=company_id,
                patient_name=patient_name,
                visit_address=visit_address,
                start_time=start_dt,
                end_time=end_dt,
                status_id=status_id,
                memo=memo,
                recurring_rule_id=rule.rule_id,
                recurring_series_id=recurring_series_id,
                recurrence_index=0,
                is_exception=False,
            )
            db.add(schedule)
            await db.flush()

            for user_id in assigned_user_ids:
                db.add(ScheduleAssignment(schedule_id=schedule.schedule_id, user_id=user_id))

            created_series.append({
                "schedule_id": str(schedule.schedule_id),
                "recurring_series_id": str(recurring_series_id),
                "day_of_week": dow,
            })

        await db.commit()

        # Backward-compatible fields retained (first created series)
        first = created_series[0]
        return {
            "created_count": len(created_series),
            "items": created_series,
            "schedule_id": first["schedule_id"],
            "recurring_series_id": first["recurring_series_id"],
        }

    @staticmethod
    async def get_schedules(db: AsyncSession, company_id: UUID, start_date: str = None,
                           end_date: str = None, patient_name: str = None, filter_by_user: UUID = None):
        # Parse date range early for DB-level filtering
        if start_date and end_date:
            try:
                query_start = datetime.strptime(start_date, "%Y-%m-%d").date()
                query_end = datetime.strptime(end_date, "%Y-%m-%d").date()
            except ValueError:
                query_start = date.today() - timedelta(days=30)
                query_end = date.today() + timedelta(days=365)
        else:
            query_start = date.today() - timedelta(days=30)
            query_end = date.today() + timedelta(days=365)

        # Safety limit: cap at 3 years expansion (search may span the past 2 years)
        if (query_end - query_start).days > 3 * 365:
            query_end = query_start + timedelta(days=3 * 365)

        # Use selectinload instead of joinedload to avoid cartesian product
        # selectinload issues separate IN queries which is faster for 1-to-many
        query = select(Schedule).options(
            selectinload(Schedule.assignments).selectinload(ScheduleAssignment.user),
            selectinload(Schedule.recurring_rule)
        ).where(Schedule.company_id == company_id)

        # Apply patient name filter to base schedules
        if patient_name:
            query = query.where(Schedule.patient_name.ilike(f"%{patient_name}%"))

        # For NORMAL_USER, only show schedules they're assigned to
        if filter_by_user:
            query = query.join(Schedule.assignments).where(ScheduleAssignment.user_id == filter_by_user)

        # DB-level date filtering:
        # - Recurring base schedules (has recurring_rule_id, not exception): always load for expansion
        # - Non-recurring and exceptions: filter by date range at DB level
        query = query.where(
            or_(
                and_(Schedule.recurring_rule_id.isnot(None), Schedule.is_exception == False),
                and_(
                    Schedule.start_time >= datetime.combine(query_start, datetime.min.time()),
                    Schedule.start_time <= datetime.combine(query_end, datetime.max.time())
                )
            )
        )

        query = query.order_by(Schedule.start_time)
        result = await db.execute(query)
        all_schedules = result.scalars().all()

        # Single-pass dedup: for recurring bases, keep one per series (prefer by series_id, then pattern)
        seen_series = set()
        base_schedules = []
        for s in all_schedules:
            if s.recurring_rule_id and s.recurring_series_id and not s.is_exception:
                series_key = str(s.recurring_series_id)
                if series_key in seen_series:
                    continue
                seen_series.add(series_key)
            base_schedules.append(s)

        expanded_schedules = []

        # Collect exception dates by recurring_series_id
        exception_dates_by_series = {}
        for s in base_schedules:
            if s.is_exception and s.recurring_series_id:
                series_id = str(s.recurring_series_id)
                if series_id not in exception_dates_by_series:
                    exception_dates_by_series[series_id] = []
                exception_date = s.start_time.date() if isinstance(s.start_time, datetime) else s.start_time
                exception_dates_by_series[series_id].append(exception_date.isoformat())

        for s in base_schedules:
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
                        "login_id": a.user.login_id,
                        "role": a.user.role,
                        "name": a.user.name,
                        "profession": a.user.profession,
                        "display_color": a.user.display_color,
                        "avatar_url": a.user.avatar_url
                    }
                    for a in s.assignments if a.user
                ]
            }

            # Skip deleted exception placeholders
            if s.is_exception and s.memo == "__deleted__":
                continue

            if s.recurring_rule_id and s.recurring_rule and not s.is_exception:
                rule = s.recurring_rule

                series_id = str(s.recurring_series_id) if s.recurring_series_id else None
                excluded_dates = exception_dates_by_series.get(series_id, []) if series_id else []

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

                try:
                    instances = expand_recurring_schedule(
                        base_date=s.start_time.date() if isinstance(s.start_time, datetime) else s.start_time,
                        start_time=s.start_time,
                        end_time=s.end_time,
                        rule=rule_dict,
                        query_start=query_start,
                        query_end=query_end,
                        excluded_dates=excluded_dates
                    )

                    for idx, instance in enumerate(instances):
                        instance_dict = schedule_dict.copy()
                        instance_dict['start_time'] = instance['start_time'].isoformat()
                        instance_dict['end_time'] = instance['end_time'].isoformat()
                        instance_dict['date'] = instance['date'].isoformat()
                        instance_dict['occurrence_index'] = idx
                        expanded_schedules.append(instance_dict)

                except Exception:
                    schedule_dict['start_time'] = s.start_time.isoformat() if s.start_time else None
                    schedule_dict['end_time'] = s.end_time.isoformat() if s.end_time else None
                    expanded_schedules.append(schedule_dict)
            else:
                # Non-recurring or exception - already filtered by DB, add directly
                schedule_dict['start_time'] = s.start_time.isoformat() if s.start_time else None
                schedule_dict['end_time'] = s.end_time.isoformat() if s.end_time else None
                expanded_schedules.append(schedule_dict)

        expanded_schedules.sort(key=lambda x: x['start_time'] if x['start_time'] else '')

        return expanded_schedules
    
    @staticmethod
    async def update_schedule(db: AsyncSession, schedule_id: UUID, company_id: UUID,
                             update_scope: str = "this", occurrence_date: Optional[str] = None, **updates):
        result = await db.execute(
            select(Schedule).options(
                selectinload(Schedule.assignments),
                selectinload(Schedule.recurring_rule)
            ).where(
                Schedule.schedule_id == schedule_id,
                Schedule.company_id == company_id
            )
        )
        schedule = result.scalar_one_or_none()

        if not schedule:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Schedule not found")

        # If this is an exception schedule and scope is "future" or "all",
        # find the base schedule in the same series to operate on
        if schedule.is_exception and schedule.recurring_series_id and update_scope in ("future", "all"):
            base_result = await db.execute(
                select(Schedule).options(
                    selectinload(Schedule.assignments),
                    selectinload(Schedule.recurring_rule)
                ).where(
                    Schedule.recurring_series_id == schedule.recurring_series_id,
                    Schedule.company_id == company_id,
                    Schedule.is_exception == False,
                    Schedule.recurring_rule_id.isnot(None)
                ).limit(1)
            )
            base_schedule = base_result.scalar_one_or_none()
            if base_schedule:
                schedule = base_schedule

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

            # If this was an exception in a recurring series, create a deleted placeholder
            # to preserve the exclusion so the original series doesn't regenerate this date
            old_series_id = schedule.recurring_series_id
            if schedule.is_exception and old_series_id:
                placeholder = Schedule(
                    company_id=schedule.company_id,
                    patient_name=schedule.patient_name,
                    start_time=schedule.start_time,
                    end_time=schedule.end_time,
                    status_id=schedule.status_id,
                    memo="__deleted__",
                    recurring_series_id=old_series_id,
                    is_exception=True,
                )
                db.add(placeholder)

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
            # Determine the new occurrence date from the incoming start_time (if changed)
            new_occurrence_date = None
            if 'start_time' in updates and updates['start_time']:
                new_start_time = updates['start_time']
                if isinstance(new_start_time, datetime):
                    new_occurrence_date = new_start_time.date()
                elif isinstance(new_start_time, str):
                    new_occurrence_date = datetime.fromisoformat(new_start_time.replace('Z', '+00:00')).date()

            # Determine the date of the occurrence actually being edited (before this
            # update), so we can tell whether it's being moved to a different date.
            # Expanded (virtual) occurrences all share the base schedule's schedule_id,
            # so schedule.start_time is only correct for the anchor occurrence - the
            # client must tell us which date it clicked on via occurrence_date.
            original_occurrence_date = None
            if occurrence_date:
                try:
                    original_occurrence_date = datetime.strptime(occurrence_date, "%Y-%m-%d").date()
                except (ValueError, TypeError):
                    original_occurrence_date = None
            if not original_occurrence_date:
                original_occurrence_date = schedule.start_time.date() if isinstance(schedule.start_time, datetime) else schedule.start_time

            # If this is a recurring schedule (has rule), create an exception
            if schedule.recurring_rule_id and not schedule.is_exception and new_occurrence_date:
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

                # If the occurrence moved to a different date, the base recurrence rule
                # would otherwise keep regenerating the original date too. Add a deleted
                # placeholder exception to exclude it, same as delete_schedule() does.
                if original_occurrence_date and original_occurrence_date != new_occurrence_date:
                    deleted_placeholder = Schedule(
                        company_id=schedule.company_id,
                        patient_id=schedule.patient_id,
                        patient_name=schedule.patient_name,
                        visit_address=schedule.visit_address,
                        start_time=datetime.combine(original_occurrence_date, datetime.min.time()),
                        end_time=datetime.combine(original_occurrence_date, datetime.min.time()),
                        status_id=None,
                        memo="__deleted__",
                        recurring_rule_id=None,
                        recurring_series_id=schedule.recurring_series_id,
                        recurrence_index=0,
                        is_exception=True
                    )
                    db.add(deleted_placeholder)

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
                # Determine occurrence_date from the update's start_time (the date the user clicked on),
                # NOT from the base schedule's start_time
                occurrence_date = None
                if 'start_time' in updates and updates['start_time']:
                    new_start = updates['start_time']
                    if isinstance(new_start, datetime):
                        occurrence_date = new_start.date()
                    elif isinstance(new_start, str):
                        occurrence_date = datetime.fromisoformat(new_start.replace('Z', '+00:00')).date()

                if not occurrence_date:
                    occurrence_date = schedule.start_time.date() if isinstance(schedule.start_time, datetime) else schedule.start_time

                # Save original end_date BEFORE modifying the rule
                original_end_date = original_rule.end_date

                # Step 1: Update the original rule to end before this occurrence
                day_before = occurrence_date - timedelta(days=1)
                original_rule.end_date = day_before

                # Step 2: Create a new recurring rule starting from this occurrence
                # Use recurring_rule_data from the request if available, otherwise copy from original rule
                rd = recurring_rule_data or {}

                # Handle week_of_month normalization
                new_week_of_month = rd.get('week_of_month', original_rule.week_of_month)
                if new_week_of_month is not None:
                    if isinstance(new_week_of_month, list):
                        new_week_of_month = new_week_of_month if len(new_week_of_month) > 0 else None
                    else:
                        new_week_of_month = [new_week_of_month]

                # Handle day_of_week - empty arrays should be None
                new_day_of_week = rd.get('day_of_week', original_rule.day_of_week)
                if new_day_of_week is not None and isinstance(new_day_of_week, list) and len(new_day_of_week) == 0:
                    new_day_of_week = None

                # For end_date: use request data if provided, otherwise preserve original end date
                new_end_date = original_end_date
                if rd.get('end_date'):
                    try:
                        new_end_date = datetime.strptime(rd['end_date'], "%Y-%m-%d").date()
                    except (ValueError, TypeError):
                        new_end_date = original_end_date

                # Legacy bulk-recurring data may store multiple weekdays in one weekly series.
                # When editing "future" from one occurrence, split only that weekday into
                # the updated series and keep the remaining weekdays unchanged.
                original_days = sorted(set(original_rule.day_of_week or []))
                requested_days_raw = rd.get('day_of_week', original_rule.day_of_week)
                if requested_days_raw is None:
                    requested_days = []
                elif isinstance(requested_days_raw, list):
                    requested_days = sorted(set(requested_days_raw))
                else:
                    requested_days = [requested_days_raw]

                clicked_day = (occurrence_date.weekday() + 1) % 7
                split_by_clicked_weekday = (
                    original_rule.frequency == "weekly"
                    and len(original_days) > 1
                    and rd.get('frequency', original_rule.frequency) == "weekly"
                    and requested_days == original_days
                    and clicked_day in original_days
                )

                effective_new_day_of_week = [clicked_day] if split_by_clicked_weekday else new_day_of_week

                new_rule = RecurringRule(
                    frequency=rd.get('frequency', original_rule.frequency),
                    day_of_week=effective_new_day_of_week,
                    week_of_month=new_week_of_month,
                    day_of_week_monthly=rd.get('day_of_week_monthly', original_rule.day_of_week_monthly),
                    month_of_year=rd.get('month_of_year', original_rule.month_of_year),
                    day_of_month=rd.get('day_of_month', original_rule.day_of_month),
                    interval=rd.get('interval', original_rule.interval),
                    start_date=occurrence_date,
                    end_date=new_end_date
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

                remaining_days = [d for d in original_days if d != clicked_day] if split_by_clicked_weekday else []
                remaining_series_id = None

                if remaining_days:
                    remaining_rule = RecurringRule(
                        frequency=original_rule.frequency,
                        day_of_week=remaining_days,
                        week_of_month=original_rule.week_of_month,
                        day_of_week_monthly=original_rule.day_of_week_monthly,
                        month_of_year=original_rule.month_of_year,
                        day_of_month=original_rule.day_of_month,
                        interval=original_rule.interval,
                        start_date=occurrence_date,
                        end_date=original_end_date,
                    )
                    db.add(remaining_rule)
                    await db.flush()

                    remaining_series_id = uuid4()
                    remaining_start = datetime.combine(occurrence_date, schedule.start_time.time())
                    remaining_end = datetime.combine(occurrence_date, schedule.end_time.time())

                    remaining_schedule = Schedule(
                        company_id=schedule.company_id,
                        patient_id=schedule.patient_id,
                        patient_name=schedule.patient_name,
                        visit_address=schedule.visit_address,
                        start_time=remaining_start,
                        end_time=remaining_end,
                        status_id=schedule.status_id,
                        memo=schedule.memo,
                        recurring_rule_id=remaining_rule.rule_id,
                        recurring_series_id=remaining_series_id,
                        recurrence_index=0,
                        is_exception=False,
                    )
                    db.add(remaining_schedule)
                    await db.flush()

                    for user_id in [a.user_id for a in schedule.assignments]:
                        db.add(ScheduleAssignment(schedule_id=remaining_schedule.schedule_id, user_id=user_id))

                # Step 5: Migrate exceptions from old series to new series
                # Exceptions on/after occurrence_date belong to the new series now
                old_series_id = schedule.recurring_series_id
                if old_series_id:
                    exceptions_result = await db.execute(
                        select(Schedule).where(
                            Schedule.recurring_series_id == old_series_id,
                            Schedule.is_exception == True,
                            Schedule.schedule_id != schedule.schedule_id
                        )
                    )
                    for exc in exceptions_result.scalars().all():
                        exc_date = exc.start_time.date() if isinstance(exc.start_time, datetime) else exc.start_time
                        if exc_date >= occurrence_date:
                            if remaining_series_id:
                                exc_dow = (exc_date.weekday() + 1) % 7
                                exc.recurring_series_id = remaining_series_id if exc_dow in remaining_days else new_series_id
                            else:
                                exc.recurring_series_id = new_series_id

        
        elif update_scope == "future" and schedule.is_exception and not schedule.recurring_rule_id:
            # Exception schedule (cut from a recurring series) - treat as a single-day update
            for key, value in updates.items():
                if value is not None and hasattr(schedule, key):
                    setattr(schedule, key, value)

            if assigned_user_ids is not None:
                await db.execute(
                    delete(ScheduleAssignment).where(ScheduleAssignment.schedule_id == schedule_id)
                )
                for user_id in assigned_user_ids:
                    db.add(ScheduleAssignment(schedule_id=schedule_id, user_id=user_id))

        elif update_scope == "all" and schedule.recurring_series_id:
            all_in_series = await db.execute(
                select(Schedule).where(
                    Schedule.recurring_series_id == schedule.recurring_series_id,
                    Schedule.company_id == company_id
                )
            )
            # Deleted-occurrence placeholders only mark excluded dates; leave them untouched
            series_schedules = [s for s in all_in_series.scalars().all() if s.memo != "__deleted__"]
            series_schedule_ids = [s.schedule_id for s in series_schedules]

            for s in series_schedules:
                for key, value in updates.items():
                    if value is None or not hasattr(s, key):
                        continue
                    if key in ('start_time', 'end_time') and isinstance(value, datetime):
                        # Apply only the new time of day; each record keeps its own date so
                        # the series anchor and moved occurrences don't collapse onto one day
                        value = datetime.combine(getattr(s, key).date(), value.time())
                    setattr(s, key, value)

            # Apply recurrence rule changes (e.g. weekly -> biweekly) to the series rule
            if recurring_rule_data and schedule.recurring_rule:
                rule = schedule.recurring_rule
                week_of_month_val = recurring_rule_data.get('week_of_month')
                if week_of_month_val is not None:
                    if isinstance(week_of_month_val, list):
                        week_of_month_val = week_of_month_val if len(week_of_month_val) > 0 else None
                    else:
                        week_of_month_val = [week_of_month_val]

                day_of_week_val = recurring_rule_data.get('day_of_week')
                if day_of_week_val is not None and isinstance(day_of_week_val, list) and len(day_of_week_val) == 0:
                    day_of_week_val = None

                rule.frequency = recurring_rule_data.get('frequency', rule.frequency)
                rule.interval = recurring_rule_data.get('interval', 1)
                rule.day_of_week = day_of_week_val
                rule.week_of_month = week_of_month_val
                rule.day_of_week_monthly = recurring_rule_data.get('day_of_week_monthly')
                rule.day_of_month = recurring_rule_data.get('day_of_month')
                # Keep the existing end date unless a new one is given (a split series must stay ended)
                if recurring_rule_data.get('end_date'):
                    rule.end_date = datetime.strptime(recurring_rule_data['end_date'], "%Y-%m-%d").date()

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
    async def delete_schedule(db: AsyncSession, schedule_id: UUID, company_id: UUID,
                              delete_scope: str = "this", occurrence_date: str = None):
        result = await db.execute(
            select(Schedule).options(
                selectinload(Schedule.assignments),
                selectinload(Schedule.recurring_rule)
            ).where(
                Schedule.schedule_id == schedule_id,
                Schedule.company_id == company_id
            )
        )
        schedule = result.scalar_one_or_none()

        if not schedule:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Schedule not found")

        # If this is an exception and scope is "future" or "all", find the base schedule
        if schedule.is_exception and schedule.recurring_series_id and delete_scope in ("future", "all"):
            base_result = await db.execute(
                select(Schedule).options(
                    selectinload(Schedule.assignments),
                    selectinload(Schedule.recurring_rule)
                ).where(
                    Schedule.recurring_series_id == schedule.recurring_series_id,
                    Schedule.company_id == company_id,
                    Schedule.is_exception == False,
                    Schedule.recurring_rule_id.isnot(None)
                ).limit(1)
            )
            base_schedule = base_result.scalar_one_or_none()
            if base_schedule:
                schedule = base_schedule

        # Non-recurring or exception with "this" scope: just delete it
        if not schedule.recurring_rule_id or (schedule.is_exception and delete_scope == "this"):
            await db.delete(schedule)
            await db.commit()
            return {"message": "Schedule deleted"}

        # Recurring schedule: handle by scope
        if delete_scope == "this":
            # Create an exception schedule for this date so the base occurrence is excluded
            occ_date = None
            if occurrence_date:
                occ_date = datetime.strptime(occurrence_date, "%Y-%m-%d").date()
            elif schedule.start_time:
                occ_date = schedule.start_time.date() if isinstance(schedule.start_time, datetime) else schedule.start_time

            if occ_date:
                # Create a cancelled exception — it excludes this date from expansion
                # and won't display because start_time == end_time signals a deleted occurrence
                exception_schedule = Schedule(
                    company_id=schedule.company_id,
                    patient_id=schedule.patient_id,
                    patient_name=schedule.patient_name,
                    visit_address=schedule.visit_address,
                    start_time=datetime.combine(occ_date, datetime.min.time()),
                    end_time=datetime.combine(occ_date, datetime.min.time()),
                    status_id=None,
                    memo="__deleted__",
                    recurring_rule_id=None,
                    recurring_series_id=schedule.recurring_series_id,
                    recurrence_index=0,
                    is_exception=True
                )
                db.add(exception_schedule)
                await db.commit()
                return {"message": "Occurrence deleted"}
            # Safety: don't fall through to delete-all for "this" scope
            return {"message": "No occurrence date provided"}

        elif delete_scope == "future":
            # End the recurring rule at the occurrence date
            occ_date = None
            if occurrence_date:
                occ_date = datetime.strptime(occurrence_date, "%Y-%m-%d").date()
            elif schedule.start_time:
                occ_date = schedule.start_time.date() if isinstance(schedule.start_time, datetime) else schedule.start_time



            if not occ_date:

                return {"message": "No occurrence date provided"}

            # If recurring_rule relationship is missing, reload it explicitly
            if not schedule.recurring_rule and schedule.recurring_rule_id:

                rule_result = await db.execute(
                    select(RecurringRule).where(RecurringRule.rule_id == schedule.recurring_rule_id)
                )
                rule_obj = rule_result.scalar_one_or_none()
            else:
                rule_obj = schedule.recurring_rule

            if not rule_obj:
                # No recurring rule found — cannot modify future occurrences, return safely

                return {"message": "Recurring rule not found"}

            # Use the schedule's actual start date as the reference for the first occurrence,
            # NOT rule.start_date which may have been modified by previous updates
            base_date = schedule.start_time.date() if isinstance(schedule.start_time, datetime) else schedule.start_time


            # If deleting from on or before the schedule's base date,
            # there are no past occurrences to preserve — delete entire series
            if occ_date <= base_date:
                # Delete all exceptions in this series
                await db.execute(
                    delete(Schedule).where(
                        Schedule.recurring_series_id == schedule.recurring_series_id,
                        Schedule.company_id == company_id,
                        Schedule.is_exception == True
                    )
                )
                # Clean up the orphaned recurring rule
                await db.delete(rule_obj)
                await db.delete(schedule)
                await db.commit()
                return {"message": "Recurring series deleted"}

            # Set rule end_date to one day before the occurrence (to exclude the occurrence date itself)
            day_before = occ_date - timedelta(days=1)
            rule_obj.end_date = day_before

            # Explicitly add to session to ensure the change is tracked and committed
            db.add(rule_obj)

            # Delete any exceptions that fall on or after the occurrence date
            series_exceptions = await db.execute(
                select(Schedule).where(
                    Schedule.recurring_series_id == schedule.recurring_series_id,
                    Schedule.company_id == company_id,
                    Schedule.is_exception == True
                )
            )
            for exc in series_exceptions.scalars().all():
                exc_date = exc.start_time.date() if isinstance(exc.start_time, datetime) else exc.start_time
                if exc_date >= occ_date:
                    await db.delete(exc)

            await db.commit()

            return {"message": "Future occurrences deleted"}

        elif delete_scope == "all":
            # Explicit "all" scope: delete entire series
            if schedule.recurring_series_id:
                await db.execute(
                    delete(Schedule).where(
                        Schedule.recurring_series_id == schedule.recurring_series_id,
                        Schedule.company_id == company_id
                    )
                )
            else:
                await db.delete(schedule)

            await db.commit()
            return {"message": "Schedule deleted"}

        # Unknown scope — don't delete anything
        return {"message": "Unknown delete scope"}
    
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
        # Add BOM for UTF-8 to prevent garbling in Excel
        output.write('\ufeff')
        writer = csv.writer(output)
        writer.writerow(['Schedule ID', 'Patient Name', 'Address', 'Start Time', 'End Time', 'Assigned Staff', 'Memo'])
        
        for s in schedules:
            staff_names = ", ".join([u['name'] for u in s['assigned_users']])
            writer.writerow([
                s['schedule_id'], s['patient_name'], s['visit_address'],
                s['start_time'], s['end_time'], staff_names, s['memo']
            ])
        
        return output.getvalue()

    @staticmethod
    async def cleanup_duplicate_schedules(db: AsyncSession, company_id: UUID):
        """
        Remove duplicate recurring base schedules that have the same pattern.
        Keeps the oldest schedule and removes newer duplicates.
        """

        # Get all recurring schedules (base schedules only)
        query = select(Schedule).options(
            selectinload(Schedule.assignments).selectinload(ScheduleAssignment.user),
            selectinload(Schedule.recurring_rule)
        ).where(
            Schedule.company_id == company_id,
            Schedule.recurring_rule_id.isnot(None),
            Schedule.is_exception == False
        ).order_by(Schedule.created_at)

        result = await db.execute(query)
        all_schedules = result.unique().scalars().all()

        # Group schedules by their effective pattern
        seen_patterns = {}
        duplicates_to_delete = []

        for s in all_schedules:
            if not s.recurring_rule:
                continue

            # Create a pattern key based on the schedule's effective recurrence pattern
            rule = s.recurring_rule
            time_str = s.start_time.strftime('%H:%M') if s.start_time else ''
            end_time_str = s.end_time.strftime('%H:%M') if s.end_time else ''

            # Get assigned user IDs
            assigned_ids = tuple(sorted([str(a.user_id) for a in s.assignments]))

            pattern_key = (
                s.patient_name,
                time_str,
                end_time_str,
                assigned_ids,
                rule.frequency,
                tuple(sorted(rule.day_of_week or [])),
                tuple(sorted(rule.week_of_month or [])) if rule.week_of_month else None,
                rule.day_of_week_monthly,
                rule.day_of_month,
                rule.interval
            )

            if pattern_key in seen_patterns:
                # This is a duplicate
                duplicates_to_delete.append(s)
            else:
                seen_patterns[pattern_key] = s

        # Delete duplicates
        deleted_count = 0
        for dup in duplicates_to_delete:
            # Delete assignments first
            await db.execute(
                delete(ScheduleAssignment).where(ScheduleAssignment.schedule_id == dup.schedule_id)
            )
            # Delete the recurring rule if no other schedule uses it
            if dup.recurring_rule_id:
                other_schedules = await db.execute(
                    select(Schedule).where(
                        Schedule.recurring_rule_id == dup.recurring_rule_id,
                        Schedule.schedule_id != dup.schedule_id
                    )
                )
                if not other_schedules.scalars().first():
                    await db.execute(
                        delete(RecurringRule).where(RecurringRule.rule_id == dup.recurring_rule_id)
                    )
            # Delete the schedule
            await db.delete(dup)
            deleted_count += 1

        await db.commit()

        return {
            "message": f"Cleanup complete. Removed {deleted_count} duplicate schedules.",
            "deleted_count": deleted_count,
            "kept_count": len(seen_patterns)
        }


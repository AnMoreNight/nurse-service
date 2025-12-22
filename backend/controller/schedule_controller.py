from db.db import get_pool
from fastapi import HTTPException, status
from uuid import UUID, uuid4
from datetime import datetime, date
from typing import Optional
import csv
import io

class ScheduleController:
    @staticmethod
    async def create_schedule(company_id: UUID, patient_id: Optional[UUID], patient_name: str, visit_address: str, 
                             start_time: datetime, end_time: datetime, status_id: UUID, memo: str, 
                             assigned_user_ids: list[UUID], recurring_rule: dict = None):
        pool = get_pool()
        schedule_id = uuid4()
        recurring_rule_id = None
        recurring_series_id = uuid4() if recurring_rule else None
        
        async with pool.acquire() as conn:
            async with conn.transaction():
                if recurring_rule:
                    recurring_rule_id = uuid4()
                    await conn.execute(
                        """INSERT INTO recurring_rules (rule_id, frequency, day_of_week, week_of_month, day_of_week_monthly, 
                           month_of_year, day_of_month, interval, start_date, end_date, created_at)
                           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)""",
                        recurring_rule_id, recurring_rule.get('frequency'), recurring_rule.get('day_of_week'),
                        recurring_rule.get('week_of_month'), recurring_rule.get('day_of_week_monthly'),
                        recurring_rule.get('month_of_year'), recurring_rule.get('day_of_month'),
                        recurring_rule.get('interval', 1), recurring_rule.get('start_date'),
                        recurring_rule.get('end_date'), datetime.utcnow()
                    )
                
                await conn.execute(
                    """INSERT INTO schedules (schedule_id, company_id, patient_id, patient_name, visit_address, start_time, 
                       end_time, status_id, memo, recurring_rule_id, recurring_series_id, recurrence_index, is_exception, created_at, updated_at)
                       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 0, false, $12, $12)""",
                    schedule_id, company_id, patient_id, patient_name, visit_address, start_time, end_time, 
                    status_id, memo, recurring_rule_id, recurring_series_id, datetime.utcnow()
                )
                
                for user_id in assigned_user_ids:
                    await conn.execute(
                        "INSERT INTO schedule_assignments (schedule_id, user_id, assigned_at) VALUES ($1, $2, $3)",
                        schedule_id, user_id, datetime.utcnow()
                    )
                
                return {"schedule_id": str(schedule_id), "recurring_series_id": str(recurring_series_id) if recurring_series_id else None}
    
    @staticmethod
    async def get_schedules(company_id: UUID, start_date: str = None, end_date: str = None, patient_name: str = None):
        pool = get_pool()
        async with pool.acquire() as conn:
            query = """
                SELECT s.schedule_id, s.company_id, s.patient_id, s.patient_name, s.visit_address, 
                       s.start_time, s.end_time, s.status_id, s.memo, s.recurring_series_id, s.is_exception, s.created_at
                FROM schedules s
                WHERE s.company_id = $1
            """
            params = [company_id]
            
            if start_date and end_date:
                query += " AND s.start_time >= $2 AND s.end_time <= $3"
                params.extend([start_date, end_date])
            
            if patient_name:
                query += f" AND s.patient_name ILIKE ${len(params)+1}"
                params.append(f"%{patient_name}%")
            
            query += " ORDER BY s.start_time"
            
            rows = await conn.fetch(query, *params)
            schedules = []
            
            for row in rows:
                users = await conn.fetch(
                    """SELECT u.user_id, u.email, u.role, u.name, u.profession, u.display_color, u.avatar_url
                       FROM users u JOIN schedule_assignments sa ON u.user_id = sa.user_id
                       WHERE sa.schedule_id = $1""",
                    row['schedule_id']
                )
                
                schedules.append({
                    **dict(row),
                    "assigned_users": [dict(u) for u in users]
                })
            
            return schedules
    
    @staticmethod
    async def update_schedule(schedule_id: UUID, company_id: UUID, update_scope: str = "this", **updates):
        pool = get_pool()
        async with pool.acquire() as conn:
            async with conn.transaction():
                schedule = await conn.fetchrow(
                    "SELECT recurring_series_id, start_time FROM schedules WHERE schedule_id = $1 AND company_id = $2",
                    schedule_id, company_id
                )
                
                if not schedule:
                    raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Schedule not found")
                
                if update_scope == "this":
                    set_clause = ", ".join([f"{k} = ${i+3}" for i, k in enumerate(updates.keys()) if k != 'assigned_user_ids'])
                    values = [v for k, v in updates.items() if k != 'assigned_user_ids']
                    
                    if values:
                        await conn.execute(
                            f"UPDATE schedules SET {set_clause}, updated_at = $1 WHERE schedule_id = $2 AND company_id = ${len(values)+3}",
                            datetime.utcnow(), schedule_id, *values, company_id
                        )
                    
                    if 'assigned_user_ids' in updates:
                        await conn.execute("DELETE FROM schedule_assignments WHERE schedule_id = $1", schedule_id)
                        for user_id in updates['assigned_user_ids']:
                            await conn.execute(
                                "INSERT INTO schedule_assignments (schedule_id, user_id, assigned_at) VALUES ($1, $2, $3)",
                                schedule_id, user_id, datetime.utcnow()
                            )
                
                elif update_scope == "future" and schedule['recurring_series_id']:
                    await conn.execute(
                        "UPDATE schedules SET is_exception = true WHERE schedule_id = $1",
                        schedule_id
                    )
                    # Update future occurrences logic here
                
                return {"message": "Schedule updated"}
    
    @staticmethod
    async def delete_schedule(schedule_id: UUID, company_id: UUID):
        pool = get_pool()
        async with pool.acquire() as conn:
            result = await conn.execute("DELETE FROM schedules WHERE schedule_id = $1 AND company_id = $2", schedule_id, company_id)
            if result == "DELETE 0":
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Schedule not found")
            return {"message": "Schedule deleted"}
    
    @staticmethod
    async def copy_schedule(schedule_id: UUID, company_id: UUID):
        pool = get_pool()
        async with pool.acquire() as conn:
            schedule = await conn.fetchrow(
                "SELECT patient_name, visit_address FROM schedules WHERE schedule_id = $1 AND company_id = $2",
                schedule_id, company_id
            )
            if not schedule:
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Schedule not found")
            return {"patient_name": schedule['patient_name'], "visit_address": schedule['visit_address']}
    
    @staticmethod
    async def export_schedules_csv(company_id: UUID, start_date: str = None, end_date: str = None):
        schedules = await ScheduleController.get_schedules(company_id, start_date, end_date)
        
        output = io.StringIO()
        writer = csv.writer(output)
        writer.writerow(['Schedule ID', 'Patient Name', 'Address', 'Start Time', 'End Time', 'Assigned Staff', 'Memo'])
        
        for s in schedules:
            staff_names = ", ".join([u['name'] for u in s['assigned_users']])
            writer.writerow([
                str(s['schedule_id']), s['patient_name'], s['visit_address'], 
                s['start_time'], s['end_time'], staff_names, s['memo']
            ])
        
        return output.getvalue()

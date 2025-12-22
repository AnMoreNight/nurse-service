from db.db import get_pool
from fastapi import HTTPException, status
from uuid import UUID, uuid4
from datetime import datetime, date, timedelta
import csv
import io

class ShiftController:
    @staticmethod
    async def create_shift(company_id: UUID, user_id: UUID, shift_date: str, shift_type: str):
        pool = get_pool()
        shift_id = uuid4()
        
        async with pool.acquire() as conn:
            await conn.execute(
                """INSERT INTO shifts (shift_id, company_id, user_id, shift_date, shift_type, is_auto_reflected, created_at, updated_at)
                   VALUES ($1, $2, $3, $4, $5, false, $6, $6)""",
                shift_id, company_id, user_id, shift_date, shift_type, datetime.utcnow()
            )
            return {"shift_id": str(shift_id)}
    
    @staticmethod
    async def get_shifts(company_id: UUID, user_id: UUID = None, start_date: str = None, end_date: str = None):
        pool = get_pool()
        async with pool.acquire() as conn:
            query = """
                SELECT shift_id, company_id, user_id, shift_date, shift_type, is_auto_reflected, memo, created_at
                FROM shifts WHERE company_id = $1
            """
            params = [company_id]
            
            if user_id:
                query += f" AND user_id = ${len(params)+1}"
                params.append(user_id)
            
            if start_date and end_date:
                query += f" AND shift_date >= ${len(params)+1} AND shift_date <= ${len(params)+2}"
                params.extend([start_date, end_date])
            
            query += " ORDER BY shift_date, user_id"
            
            rows = await conn.fetch(query, *params)
            return [dict(row) for row in rows]
    
    @staticmethod
    async def update_shift(shift_id: UUID, company_id: UUID, shift_type: str):
        pool = get_pool()
        async with pool.acquire() as conn:
            result = await conn.execute(
                "UPDATE shifts SET shift_type = $1, is_auto_reflected = false, updated_at = $2 WHERE shift_id = $3 AND company_id = $4",
                shift_type, datetime.utcnow(), shift_id, company_id
            )
            if result == "UPDATE 0":
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Shift not found")
            return {"message": "Shift updated"}
    
    @staticmethod
    async def delete_shift(shift_id: UUID, company_id: UUID):
        pool = get_pool()
        async with pool.acquire() as conn:
            result = await conn.execute("DELETE FROM shifts WHERE shift_id = $1 AND company_id = $2", shift_id, company_id)
            if result == "DELETE 0":
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Shift not found")
            return {"message": "Shift deleted"}
    
    @staticmethod
    async def create_weekly_off_rule(company_id: UUID, user_id: UUID, day_of_week: str, shift_type: str):
        pool = get_pool()
        rule_id = uuid4()
        
        async with pool.acquire() as conn:
            await conn.execute(
                """INSERT INTO weekly_off_rules (rule_id, company_id, user_id, day_of_week, shift_type, is_active, created_at)
                   VALUES ($1, $2, $3, $4, $5, true, $6)""",
                rule_id, company_id, user_id, day_of_week, shift_type, datetime.utcnow()
            )
            return {"rule_id": str(rule_id)}
    
    @staticmethod
    async def get_weekly_off_rules(company_id: UUID, user_id: UUID = None):
        pool = get_pool()
        async with pool.acquire() as conn:
            if user_id:
                rows = await conn.fetch(
                    """SELECT rule_id, company_id, user_id, day_of_week, shift_type, is_active, created_at
                       FROM weekly_off_rules WHERE company_id = $1 AND user_id = $2 AND is_active = true""",
                    company_id, user_id
                )
            else:
                rows = await conn.fetch(
                    """SELECT rule_id, company_id, user_id, day_of_week, shift_type, is_active, created_at
                       FROM weekly_off_rules WHERE company_id = $1 AND is_active = true""",
                    company_id
                )
            return [dict(row) for row in rows]
    
    @staticmethod
    async def apply_weekly_off_rules(company_id: UUID, start_date: str, end_date: str):
        pool = get_pool()
        async with pool.acquire() as conn:
            rules = await conn.fetch(
                "SELECT user_id, day_of_week, shift_type FROM weekly_off_rules WHERE company_id = $1 AND is_active = true",
                company_id
            )
            
            day_map = {"Sun": 6, "Mon": 0, "Tue": 1, "Wed": 2, "Thu": 3, "Fri": 4, "Sat": 5}
            start = datetime.strptime(start_date, "%Y-%m-%d").date()
            end = datetime.strptime(end_date, "%Y-%m-%d").date()
            
            async with conn.transaction():
                for rule in rules:
                    current = start
                    target_weekday = day_map[rule['day_of_week']]
                    
                    while current <= end:
                        if current.weekday() == target_weekday:
                            existing = await conn.fetchval(
                                "SELECT shift_id FROM shifts WHERE company_id = $1 AND user_id = $2 AND shift_date = $3",
                                company_id, rule['user_id'], current
                            )
                            
                            if not existing:
                                await conn.execute(
                                    """INSERT INTO shifts (shift_id, company_id, user_id, shift_date, shift_type, is_auto_reflected, created_at, updated_at)
                                       VALUES ($1, $2, $3, $4, $5, true, $6, $6)""",
                                    uuid4(), company_id, rule['user_id'], current, rule['shift_type'], datetime.utcnow()
                                )
                        current += timedelta(days=1)
            
            return {"message": "Weekly off rules applied"}
    
    @staticmethod
    async def export_shifts_csv(company_id: UUID, start_date: str = None, end_date: str = None):
        shifts = await ShiftController.get_shifts(company_id, start_date=start_date, end_date=end_date)
        
        output = io.StringIO()
        writer = csv.writer(output)
        writer.writerow(['Shift ID', 'User ID', 'Date', 'Shift Type', 'Auto Reflected', 'Memo'])
        
        for s in shifts:
            writer.writerow([
                str(s['shift_id']), str(s['user_id']), s['shift_date'], 
                s['shift_type'], s['is_auto_reflected'], s.get('memo', '')
            ])
        
        return output.getvalue()

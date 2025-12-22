from db.db import get_pool
from fastapi import HTTPException, status
from uuid import UUID, uuid4
from datetime import datetime

class PatientController:
    @staticmethod
    async def create_patient(company_id: UUID, name: str, address: str = None, phone: str = None, notes: str = None):
        pool = get_pool()
        patient_id = uuid4()
        
        async with pool.acquire() as conn:
            await conn.execute(
                """INSERT INTO patients (patient_id, company_id, name, address, phone, notes, is_active, created_at, updated_at)
                   VALUES ($1, $2, $3, $4, $5, $6, true, $7, $7)""",
                patient_id, company_id, name, address, phone, notes, datetime.utcnow()
            )
            return {"patient_id": str(patient_id), "name": name}
    
    @staticmethod
    async def get_patients(company_id: UUID, search: str = None):
        pool = get_pool()
        async with pool.acquire() as conn:
            if search:
                rows = await conn.fetch(
                    """SELECT patient_id, company_id, name, address, phone, notes, is_active, created_at
                       FROM patients WHERE company_id = $1 AND name ILIKE $2 ORDER BY created_at DESC""",
                    company_id, f"%{search}%"
                )
            else:
                rows = await conn.fetch(
                    """SELECT patient_id, company_id, name, address, phone, notes, is_active, created_at
                       FROM patients WHERE company_id = $1 ORDER BY created_at DESC""",
                    company_id
                )
            return [dict(row) for row in rows]
    
    @staticmethod
    async def get_patient(patient_id: UUID, company_id: UUID):
        pool = get_pool()
        async with pool.acquire() as conn:
            row = await conn.fetchrow(
                """SELECT patient_id, company_id, name, address, phone, notes, is_active, created_at
                   FROM patients WHERE patient_id = $1 AND company_id = $2""",
                patient_id, company_id
            )
            if not row:
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Patient not found")
            return dict(row)
    
    @staticmethod
    async def update_patient(patient_id: UUID, company_id: UUID, **updates):
        pool = get_pool()
        set_clause = ", ".join([f"{k} = ${i+3}" for i, k in enumerate(updates.keys())])
        values = list(updates.values())
        
        async with pool.acquire() as conn:
            result = await conn.execute(
                f"UPDATE patients SET {set_clause}, updated_at = $1 WHERE patient_id = $2 AND company_id = ${len(values)+3}",
                datetime.utcnow(), patient_id, *values, company_id
            )
            if result == "UPDATE 0":
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Patient not found")
            return {"message": "Patient updated"}
    
    @staticmethod
    async def delete_patient(patient_id: UUID, company_id: UUID):
        pool = get_pool()
        async with pool.acquire() as conn:
            result = await conn.execute("UPDATE patients SET is_active = false WHERE patient_id = $1 AND company_id = $2", patient_id, company_id)
            if result == "UPDATE 0":
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Patient not found")
            return {"message": "Patient deactivated"}

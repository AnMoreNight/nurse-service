from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update
from models.orm import Patient
from fastapi import HTTPException, status
from uuid import UUID
from datetime import datetime

class PatientController:
    @staticmethod
    async def create_patient(db: AsyncSession, company_id: UUID, name: str, address: str = None, 
                            phone: str = None, notes: str = None):
        patient = Patient(
            company_id=company_id,
            name=name,
            address=address,
            phone=phone,
            notes=notes
        )
        db.add(patient)
        await db.flush()
        result_data = {
            "patient_id": str(patient.patient_id),
            "company_id": str(patient.company_id),
            "name": patient.name,
            "address": patient.address,
            "phone": patient.phone,
            "notes": patient.notes,
            "is_active": patient.is_active,
            "created_at": patient.created_at.isoformat() if patient.created_at else None
        }
        await db.commit()

        return result_data
    
    @staticmethod
    async def get_patients(db: AsyncSession, company_id: UUID, search: str = None):
        query = select(Patient).where(Patient.company_id == company_id, Patient.is_active == True)
        
        if search:
            query = query.where(Patient.name.ilike(f"%{search}%"))
        
        query = query.order_by(Patient.name)
        result = await db.execute(query)
        patients = result.scalars().all()
        
        return [
            {
                "patient_id": str(p.patient_id),
                "company_id": str(p.company_id),
                "name": p.name,
                "address": p.address,
                "phone": p.phone,
                "notes": p.notes,
                "is_active": p.is_active,
                "created_at": p.created_at.isoformat() if p.created_at else None
            }
            for p in patients
        ]
    
    @staticmethod
    async def get_patient(db: AsyncSession, patient_id: UUID, company_id: UUID):
        result = await db.execute(
            select(Patient).where(Patient.patient_id == patient_id, Patient.company_id == company_id)
        )
        patient = result.scalar_one_or_none()
        
        if not patient:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Patient not found")
        
        return {
            "patient_id": str(patient.patient_id),
            "company_id": str(patient.company_id),
            "name": patient.name,
            "address": patient.address,
            "phone": patient.phone,
            "notes": patient.notes,
            "is_active": patient.is_active,
            "created_at": patient.created_at.isoformat() if patient.created_at else None
        }
    
    @staticmethod
    async def update_patient(db: AsyncSession, patient_id: UUID, company_id: UUID, **updates):
        result = await db.execute(
            select(Patient).where(Patient.patient_id == patient_id, Patient.company_id == company_id)
        )
        patient = result.scalar_one_or_none()
        
        if not patient:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Patient not found")
        
        for key, value in updates.items():
            if value is not None and hasattr(patient, key):
                setattr(patient, key, value)
        
        await db.commit()
        return {"message": "Patient updated"}
    
    @staticmethod
    async def delete_patient(db: AsyncSession, patient_id: UUID, company_id: UUID):
        result = await db.execute(
            select(Patient).where(Patient.patient_id == patient_id, Patient.company_id == company_id)
        )
        patient = result.scalar_one_or_none()
        
        if not patient:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Patient not found")
        
        patient.is_active = False
        await db.commit()
        return {"message": "Patient deleted"}

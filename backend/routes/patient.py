from fastapi import APIRouter, Depends, Request, Query
from sqlalchemy.ext.asyncio import AsyncSession
from models.schemas import PatientCreate, PatientUpdate
from controller.patient_controller import PatientController
from db.database import get_db
from middleware.auth import get_current_user
from uuid import UUID
from typing import Optional

router = APIRouter(prefix="/patients", tags=["Patients"])

@router.post("")
async def create_patient(req: PatientCreate, request: Request, db: AsyncSession = Depends(get_db)):
    user = await get_current_user(request, db)
    return await PatientController.create_patient(
        db, user["company_id"], req.name, req.address, req.phone, req.notes
    )

@router.get("")
async def get_patients(request: Request, search: Optional[str] = Query(None), db: AsyncSession = Depends(get_db)):
    user = await get_current_user(request, db)
    return await PatientController.get_patients(db, user["company_id"], search)

@router.get("/{patient_id}")
async def get_patient(patient_id: UUID, request: Request, db: AsyncSession = Depends(get_db)):
    user = await get_current_user(request, db)
    return await PatientController.get_patient(db, patient_id, user["company_id"])

@router.put("/{patient_id}")
async def update_patient(patient_id: UUID, req: PatientUpdate, request: Request, db: AsyncSession = Depends(get_db)):
    user = await get_current_user(request, db)
    return await PatientController.update_patient(
        db, patient_id, user["company_id"],
        name=req.name, address=req.address, phone=req.phone, notes=req.notes, is_active=req.is_active
    )

@router.delete("/{patient_id}")
async def delete_patient(patient_id: UUID, request: Request, db: AsyncSession = Depends(get_db)):
    user = await get_current_user(request, db)
    return await PatientController.delete_patient(db, patient_id, user["company_id"])

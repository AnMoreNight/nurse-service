from fastapi import APIRouter, Depends, Request, Query
from models.schemas import PatientCreate, PatientUpdate
from controller.patient_controller import PatientController
from middleware.auth import require_role, get_current_user
from uuid import UUID
from typing import Optional

router = APIRouter(prefix="/patients", tags=["Patients"])

@router.post("", dependencies=[Depends(require_role("CompanyAdmin"))])
async def create_patient(req: PatientCreate, request: Request):
    user = await get_current_user(request)
    company_id = UUID(user['company_id'])
    return await PatientController.create_patient(company_id, req.name, req.address, req.phone, req.notes)

@router.get("", dependencies=[Depends(require_role("SuperAdmin", "CompanyAdmin", "NormalUser"))])
async def get_patients(request: Request, search: Optional[str] = Query(None)):
    user = await get_current_user(request)
    company_id = UUID(user['company_id'])
    return await PatientController.get_patients(company_id, search)

@router.get("/{patient_id}", dependencies=[Depends(require_role("SuperAdmin", "CompanyAdmin", "NormalUser"))])
async def get_patient(patient_id: UUID, request: Request):
    user = await get_current_user(request)
    company_id = UUID(user['company_id'])
    return await PatientController.get_patient(patient_id, company_id)

@router.patch("/{patient_id}", dependencies=[Depends(require_role("CompanyAdmin"))])
async def update_patient(patient_id: UUID, req: PatientUpdate, request: Request):
    user = await get_current_user(request)
    company_id = UUID(user['company_id'])
    updates = {k: v for k, v in req.dict(exclude_unset=True).items()}
    return await PatientController.update_patient(patient_id, company_id, **updates)

@router.delete("/{patient_id}", dependencies=[Depends(require_role("CompanyAdmin"))])
async def delete_patient(patient_id: UUID, request: Request):
    user = await get_current_user(request)
    company_id = UUID(user['company_id'])
    return await PatientController.delete_patient(patient_id, company_id)

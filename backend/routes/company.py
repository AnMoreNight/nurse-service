from fastapi import APIRouter, Depends, Request
from models.schemas import CompanyCreate, CompanyResponse
from controller.company_controller import CompanyController
from middleware.auth import require_role
from uuid import UUID

router = APIRouter(prefix="/companies", tags=["Companies"])

@router.post("", dependencies=[Depends(require_role("SystemAdmin"))])
async def create_company(req: CompanyCreate, request: Request):
    return await CompanyController.create_company(req.name)

@router.get("", dependencies=[Depends(require_role("SystemAdmin"))])
async def get_companies(request: Request):
    return await CompanyController.get_companies()

@router.get("/{company_id}", dependencies=[Depends(require_role("SystemAdmin"))])
async def get_company(company_id: UUID, request: Request):
    return await CompanyController.get_company(company_id)

@router.delete("/{company_id}", dependencies=[Depends(require_role("SystemAdmin"))])
async def delete_company(company_id: UUID, request: Request):
    return await CompanyController.delete_company(company_id)

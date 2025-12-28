from fastapi import APIRouter, Depends, Request
from sqlalchemy.ext.asyncio import AsyncSession
from models.schemas import CompanyCreate
from controller.company_controller import CompanyController
from db.database import get_db
from middleware.auth import get_current_user, require_super_admin
from uuid import UUID

router = APIRouter(prefix="/companies", tags=["Companies"])

@router.post("")
async def create_company(req: CompanyCreate, request: Request, db: AsyncSession = Depends(get_db)):
    await require_super_admin(request, db)
    return await CompanyController.create_company(db, req.name)

@router.get("")
async def get_companies(request: Request, db: AsyncSession = Depends(get_db)):
    await require_super_admin(request, db)
    return await CompanyController.get_companies(db)

@router.get("/{company_id}")
async def get_company(company_id: UUID, request: Request, db: AsyncSession = Depends(get_db)):
    user = await get_current_user(request, db)
    return await CompanyController.get_company(db, company_id)

@router.put("/{company_id}")
async def update_company(company_id: UUID, req: CompanyCreate, request: Request, db: AsyncSession = Depends(get_db)):
    await require_super_admin(request, db)
    return await CompanyController.update_company(db, company_id, name=req.name)

@router.delete("/{company_id}")
async def delete_company(company_id: UUID, request: Request, db: AsyncSession = Depends(get_db)):
    await require_super_admin(request, db)
    return await CompanyController.delete_company(db, company_id)

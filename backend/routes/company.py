from fastapi import APIRouter, Depends, Request, Body, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from models.schemas import CompanyCreate, CompanyUpdate
from controller.company_controller import CompanyController
from db.database import get_db
from middleware.auth import get_current_user, require_super_admin
from uuid import UUID
from typing import Any

router = APIRouter(prefix="/companies", tags=["Companies"])

@router.post("")
async def create_company(req: CompanyCreate, request: Request, db: AsyncSession = Depends(get_db)):
    await require_super_admin(request, db)
    return await CompanyController.create_company(db, name=req.name)

@router.get("")
async def get_companies(request: Request, db: AsyncSession = Depends(get_db)):
    await require_super_admin(request, db)
    return await CompanyController.get_companies(db)

@router.get("/{company_id}")
async def get_company(company_id: UUID, request: Request, db: AsyncSession = Depends(get_db)):
    user = await get_current_user(request, db)
    return await CompanyController.get_company(db, company_id)

@router.patch("/{company_id}")
async def update_company(company_id: UUID, req: CompanyUpdate, request: Request, db: AsyncSession = Depends(get_db)):
    await require_super_admin(request, db)
    return await CompanyController.update_company(
        db,
        company_id,
        name=req.name,
        is_active=req.is_active
    )

@router.delete("/{company_id}")
async def delete_company(company_id: UUID, request: Request, db: AsyncSession = Depends(get_db)):
    await require_super_admin(request, db)
    return await CompanyController.delete_company(db, company_id)

# Company Settings endpoints
@router.get("/{company_id}/settings")
async def get_all_company_settings(company_id: UUID, request: Request, db: AsyncSession = Depends(get_db)):
    """Get all settings for a company"""
    user = await get_current_user(request, db)
    # Verify user has access to this company
    if user["role"] != "SuperAdmin" and user.get("company_id") != company_id:
        raise HTTPException(status_code=403, detail="Access denied")
    return await CompanyController.get_all_settings(db, company_id)

@router.get("/{company_id}/settings/{setting_key}")
async def get_company_setting(company_id: UUID, setting_key: str, request: Request, db: AsyncSession = Depends(get_db)):
    """Get a specific company setting"""
    user = await get_current_user(request, db)
    # Verify user has access to this company
    if user["role"] != "SuperAdmin" and user.get("company_id") != company_id:
        raise HTTPException(status_code=403, detail="Access denied")
    setting = await CompanyController.get_setting(db, company_id, setting_key)
    if not setting:
        raise HTTPException(status_code=404, detail="Setting not found")
    return setting

@router.put("/{company_id}/settings/{setting_key}")
async def upsert_company_setting(
    company_id: UUID, 
    setting_key: str, 
    setting_value: Any = Body(...),
    request: Request = None, 
    db: AsyncSession = Depends(get_db)
):
    """Create or update a company setting"""
    user = await get_current_user(request, db)
    # Verify user has access to this company and is an admin
    if user["role"] == "NormalUser":
        raise HTTPException(status_code=403, detail="Admin access required")
    if user["role"] != "SuperAdmin" and user.get("company_id") != company_id:
        raise HTTPException(status_code=403, detail="Access denied")
    return await CompanyController.upsert_setting(db, company_id, setting_key, setting_value)

@router.delete("/{company_id}/settings/{setting_key}")
async def delete_company_setting(company_id: UUID, setting_key: str, request: Request, db: AsyncSession = Depends(get_db)):
    """Delete a company setting"""
    user = await get_current_user(request, db)
    # Verify user has access to this company and is an admin
    if user["role"] == "NormalUser":
        raise HTTPException(status_code=403, detail="Admin access required")
    if user["role"] != "SuperAdmin" and user.get("company_id") != company_id:
        raise HTTPException(status_code=403, detail="Access denied")
    return await CompanyController.delete_setting(db, company_id, setting_key)

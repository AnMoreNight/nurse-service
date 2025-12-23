from fastapi import APIRouter, Depends, Request, Query, Response
from models.schemas import ShiftCreate, ShiftUpdate, WeeklyOffRuleCreate
from controller.shift_controller import ShiftController
from middleware.auth import require_role, get_current_user
from uuid import UUID
from typing import Optional

router = APIRouter(prefix="/shifts", tags=["Shifts"])

@router.post("", dependencies=[Depends(require_role("CompanyAdmin"))])
async def create_shift(req: ShiftCreate, request: Request):
    user = await get_current_user(request)
    company_id = UUID(user['company_id'])
    return await ShiftController.create_shift(company_id, req.user_id, req.shift_date, req.shift_type)

@router.get("", dependencies=[Depends(require_role("SystemAdmin", "CompanyAdmin", "User"))])
async def get_shifts(
    request: Request,
    user_id: Optional[UUID] = Query(None),
    start_date: Optional[str] = Query(None),
    end_date: Optional[str] = Query(None)
):
    user = await get_current_user(request)
    company_id = UUID(user['company_id'])
    return await ShiftController.get_shifts(company_id, user_id, start_date, end_date)

@router.patch("/{shift_id}", dependencies=[Depends(require_role("CompanyAdmin"))])
async def update_shift(shift_id: UUID, req: ShiftUpdate, request: Request):
    user = await get_current_user(request)
    company_id = UUID(user['company_id'])
    return await ShiftController.update_shift(shift_id, company_id, req.shift_type)

@router.delete("/{shift_id}", dependencies=[Depends(require_role("CompanyAdmin"))])
async def delete_shift(shift_id: UUID, request: Request):
    user = await get_current_user(request)
    company_id = UUID(user['company_id'])
    return await ShiftController.delete_shift(shift_id, company_id)

@router.post("/weekly-off-rules", dependencies=[Depends(require_role("CompanyAdmin"))])
async def create_weekly_off_rule(req: WeeklyOffRuleCreate, request: Request):
    user = await get_current_user(request)
    company_id = UUID(user['company_id'])
    return await ShiftController.create_weekly_off_rule(company_id, req.user_id, req.day_of_week, req.shift_type)

@router.get("/weekly-off-rules", dependencies=[Depends(require_role("CompanyAdmin"))])
async def get_weekly_off_rules(request: Request, user_id: Optional[UUID] = Query(None)):
    user = await get_current_user(request)
    company_id = UUID(user['company_id'])
    return await ShiftController.get_weekly_off_rules(company_id, user_id)

@router.post("/apply-weekly-rules", dependencies=[Depends(require_role("CompanyAdmin"))])
async def apply_weekly_off_rules(request: Request, start_date: str = Query(...), end_date: str = Query(...)):
    user = await get_current_user(request)
    company_id = UUID(user['company_id'])
    return await ShiftController.apply_weekly_off_rules(company_id, start_date, end_date)

@router.get("/export/csv", dependencies=[Depends(require_role("CompanyAdmin"))])
async def export_shifts_csv(
    request: Request,
    start_date: Optional[str] = Query(None),
    end_date: Optional[str] = Query(None)
):
    user = await get_current_user(request)
    company_id = UUID(user['company_id'])
    csv_data = await ShiftController.export_shifts_csv(company_id, start_date, end_date)
    return Response(content=csv_data, media_type="text/csv", headers={"Content-Disposition": "attachment; filename=shifts.csv"})

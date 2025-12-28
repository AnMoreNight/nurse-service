from fastapi import APIRouter, Depends, Request, Query, Response
from sqlalchemy.ext.asyncio import AsyncSession
from models.schemas import ShiftCreate, ShiftUpdate, ShiftBulkCreate, WeeklyOffRuleCreate
from controller.shift_controller import ShiftController
from db.database import get_db
from middleware.auth import get_current_user
from uuid import UUID
from typing import Optional

router = APIRouter(prefix="/shifts", tags=["Shifts"])

@router.post("")
async def create_shift(req: ShiftCreate, request: Request, db: AsyncSession = Depends(get_db)):
    user = await get_current_user(request, db)
    return await ShiftController.create_shift(db, user["company_id"], req.user_id, req.shift_date, req.shift_type)

@router.get("")
async def get_shifts(
    request: Request,
    start_date: Optional[str] = Query(None),
    end_date: Optional[str] = Query(None),
    user_id: Optional[UUID] = Query(None),
    db: AsyncSession = Depends(get_db)
):
    user = await get_current_user(request, db)
    return await ShiftController.get_shifts(db, user["company_id"], start_date, end_date, user_id)

@router.put("/{shift_id}")
async def update_shift(shift_id: UUID, req: ShiftUpdate, request: Request, db: AsyncSession = Depends(get_db)):
    user = await get_current_user(request, db)
    return await ShiftController.update_shift(db, shift_id, user["company_id"], req.shift_type)

@router.delete("/{shift_id}")
async def delete_shift(shift_id: UUID, request: Request, db: AsyncSession = Depends(get_db)):
    user = await get_current_user(request, db)
    return await ShiftController.delete_shift(db, shift_id, user["company_id"])

@router.post("/bulk")
async def bulk_create_shifts(req: ShiftBulkCreate, request: Request, db: AsyncSession = Depends(get_db)):
    user = await get_current_user(request, db)
    return await ShiftController.bulk_create_shifts(db, user["company_id"], req.user_id, req.shifts)

@router.post("/weekly-off-rules")
async def create_weekly_off_rule(req: WeeklyOffRuleCreate, request: Request, db: AsyncSession = Depends(get_db)):
    user = await get_current_user(request, db)
    # Convert day_of_week string to int
    day_map = {"Sunday": 6, "Monday": 0, "Tuesday": 1, "Wednesday": 2, "Thursday": 3, "Friday": 4, "Saturday": 5}
    day_int = day_map.get(req.day_of_week, 0)
    return await ShiftController.create_weekly_off_rule(db, user["company_id"], req.user_id, day_int, req.shift_type)

@router.get("/weekly-off-rules")
async def get_weekly_off_rules(
    request: Request,
    user_id: Optional[UUID] = Query(None),
    db: AsyncSession = Depends(get_db)
):
    user = await get_current_user(request, db)
    return await ShiftController.get_weekly_off_rules(db, user["company_id"], user_id)

@router.post("/apply-weekly-rules")
async def apply_weekly_rules(year: int, month: int, request: Request, db: AsyncSession = Depends(get_db)):
    user = await get_current_user(request, db)
    return await ShiftController.apply_weekly_off_rules(db, user["company_id"], year, month)

@router.get("/export/csv")
async def export_shifts_csv(
    request: Request,
    start_date: str = Query(...),
    end_date: str = Query(...),
    db: AsyncSession = Depends(get_db)
):
    user = await get_current_user(request, db)
    csv_content = await ShiftController.export_shifts_csv(db, user["company_id"], start_date, end_date)
    return Response(
        content=csv_content,
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=shifts.csv"}
    )

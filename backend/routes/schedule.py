from fastapi import APIRouter, Depends, Request, Query, Response
from sqlalchemy.ext.asyncio import AsyncSession
from models.schemas import ScheduleCreate, ScheduleUpdate, ScheduleCopy
from controller.schedule_controller import ScheduleController
from db.database import get_db
from middleware.auth import get_current_user
from uuid import UUID
from typing import Optional

router = APIRouter(prefix="/schedules", tags=["Schedules"])

@router.post("")
async def create_schedule(req: ScheduleCreate, request: Request, db: AsyncSession = Depends(get_db)):
    user = await get_current_user(request, db)
    # SUPER_ADMIN can specify company_id for impersonation, others use their own
    company_id = req.company_id if (user["role"] == "SUPER_ADMIN" and req.company_id) else user["company_id"]
    recurring_rule = req.recurring_rule.model_dump() if req.recurring_rule else None
    return await ScheduleController.create_schedule(
        db, company_id, req.patient_id, req.patient_name, req.visit_address,
        req.start_time, req.end_time, req.status_id, req.memo, req.assigned_user_ids, recurring_rule
    )

@router.get("")
async def get_schedules(
    request: Request,
    start_date: Optional[str] = Query(None),
    end_date: Optional[str] = Query(None),
    patient_name: Optional[str] = Query(None),
    company_id: Optional[UUID] = Query(None),
    db: AsyncSession = Depends(get_db)
):
    user = await get_current_user(request, db)
    # SUPER_ADMIN can specify company_id for impersonation, others use their own
    effective_company_id = company_id if (user["role"] == "SUPER_ADMIN" and company_id) else user["company_id"]
    return await ScheduleController.get_schedules(db, effective_company_id, start_date, end_date, patient_name)

@router.put("/{schedule_id}")
async def update_schedule(schedule_id: UUID, req: ScheduleUpdate, request: Request, db: AsyncSession = Depends(get_db)):
    user = await get_current_user(request, db)
    update_data = req.model_dump(exclude_unset=True)
    update_scope = update_data.pop('update_scope', 'this')
    # SUPER_ADMIN can specify company_id for impersonation, others use their own
    company_id = update_data.pop('company_id', None)
    effective_company_id = company_id if (user["role"] == "SUPER_ADMIN" and company_id) else user["company_id"]
    return await ScheduleController.update_schedule(db, schedule_id, effective_company_id, update_scope, **update_data)

@router.delete("/{schedule_id}")
async def delete_schedule(schedule_id: UUID, request: Request, db: AsyncSession = Depends(get_db)):
    user = await get_current_user(request, db)
    return await ScheduleController.delete_schedule(db, schedule_id, user["company_id"])

@router.get("/{schedule_id}/copy")
async def copy_schedule(schedule_id: UUID, request: Request, db: AsyncSession = Depends(get_db)):
    user = await get_current_user(request, db)
    return await ScheduleController.copy_schedule(db, schedule_id, user["company_id"])

@router.get("/export/csv")
async def export_schedules_csv(
    request: Request,
    start_date: Optional[str] = Query(None),
    end_date: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db)
):
    user = await get_current_user(request, db)
    csv_content = await ScheduleController.export_schedules_csv(db, user["company_id"], start_date, end_date)
    return Response(
        content=csv_content,
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=schedules.csv"}
    )

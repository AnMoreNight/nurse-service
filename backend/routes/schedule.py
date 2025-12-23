from fastapi import APIRouter, Depends, Request, Query, Response
from models.schemas import ScheduleCreate, ScheduleUpdate
from controller.schedule_controller import ScheduleController
from middleware.auth import require_role, get_current_user
from uuid import UUID
from typing import Optional

router = APIRouter(prefix="/schedules", tags=["Schedules"])

@router.post("", dependencies=[Depends(require_role("CompanyAdmin"))])
async def create_schedule(req: ScheduleCreate, request: Request):
    user = await get_current_user(request)
    company_id = UUID(user['company_id'])
    return await ScheduleController.create_schedule(
        company_id, req.patient_id, req.patient_name, req.visit_address,
        req.start_time, req.end_time, req.status_id, req.memo,
        req.assigned_user_ids, req.recurring_rule.dict() if req.recurring_rule else None
    )

@router.get("", dependencies=[Depends(require_role("SystemAdmin", "CompanyAdmin", "User"))])
async def get_schedules(
    request: Request,
    start_date: Optional[str] = Query(None),
    end_date: Optional[str] = Query(None),
    patient_name: Optional[str] = Query(None)
):
    user = await get_current_user(request)
    company_id = UUID(user['company_id'])
    return await ScheduleController.get_schedules(company_id, start_date, end_date, patient_name)

@router.patch("/{schedule_id}", dependencies=[Depends(require_role("CompanyAdmin"))])
async def update_schedule(schedule_id: UUID, req: ScheduleUpdate, request: Request):
    user = await get_current_user(request)
    company_id = UUID(user['company_id'])
    updates = {k: v for k, v in req.dict(exclude_unset=True).items() if k != 'update_scope'}
    return await ScheduleController.update_schedule(schedule_id, company_id, req.update_scope, **updates)

@router.delete("/{schedule_id}", dependencies=[Depends(require_role("CompanyAdmin"))])
async def delete_schedule(schedule_id: UUID, request: Request):
    user = await get_current_user(request)
    company_id = UUID(user['company_id'])
    return await ScheduleController.delete_schedule(schedule_id, company_id)

@router.get("/{schedule_id}/copy", dependencies=[Depends(require_role("CompanyAdmin"))])
async def copy_schedule(schedule_id: UUID, request: Request):
    user = await get_current_user(request)
    company_id = UUID(user['company_id'])
    return await ScheduleController.copy_schedule(schedule_id, company_id)

@router.get("/export/csv", dependencies=[Depends(require_role("CompanyAdmin"))])
async def export_schedules_csv(
    request: Request,
    start_date: Optional[str] = Query(None),
    end_date: Optional[str] = Query(None)
):
    user = await get_current_user(request)
    company_id = UUID(user['company_id'])
    csv_data = await ScheduleController.export_schedules_csv(company_id, start_date, end_date)
    return Response(content=csv_data, media_type="text/csv", headers={"Content-Disposition": "attachment; filename=schedules.csv"})

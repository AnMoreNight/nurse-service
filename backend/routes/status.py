from fastapi import APIRouter, Depends, Request
from models.schemas import ScheduleStatusCreate, ScheduleStatusUpdate
from controller.status_controller import StatusController
from middleware.auth import require_role, get_current_user
from uuid import UUID

router = APIRouter(prefix="/statuses", tags=["Schedule Statuses"])

@router.post("", dependencies=[Depends(require_role("CompanyAdmin"))])
async def create_status(req: ScheduleStatusCreate, request: Request):
    user = await get_current_user(request)
    company_id = UUID(user['company_id'])
    return await StatusController.create_status(company_id, req.name, req.color)

@router.get("", dependencies=[Depends(require_role("SystemAdmin", "CompanyAdmin", "User"))])
async def get_statuses(request: Request):
    user = await get_current_user(request)
    company_id = UUID(user['company_id'])
    return await StatusController.get_statuses(company_id)

@router.patch("/{status_id}", dependencies=[Depends(require_role("CompanyAdmin"))])
async def update_status(status_id: UUID, req: ScheduleStatusUpdate, request: Request):
    user = await get_current_user(request)
    company_id = UUID(user['company_id'])
    updates = {k: v for k, v in req.dict(exclude_unset=True).items()}
    return await StatusController.update_status(status_id, company_id, **updates)

@router.delete("/{status_id}", dependencies=[Depends(require_role("CompanyAdmin"))])
async def delete_status(status_id: UUID, request: Request):
    user = await get_current_user(request)
    company_id = UUID(user['company_id'])
    return await StatusController.delete_status(status_id, company_id)

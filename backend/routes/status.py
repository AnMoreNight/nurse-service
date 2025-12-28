from fastapi import APIRouter, Depends, Request
from sqlalchemy.ext.asyncio import AsyncSession
from models.schemas import ScheduleStatusCreate, ScheduleStatusUpdate
from controller.status_controller import StatusController
from db.database import get_db
from middleware.auth import get_current_user
from uuid import UUID

router = APIRouter(prefix="/statuses", tags=["Schedule Statuses"])

@router.post("")
async def create_status(req: ScheduleStatusCreate, request: Request, db: AsyncSession = Depends(get_db)):
    user = await get_current_user(request, db)
    return await StatusController.create_status(db, user["company_id"], req.name, req.color)

@router.get("")
async def get_statuses(request: Request, db: AsyncSession = Depends(get_db)):
    user = await get_current_user(request, db)
    return await StatusController.get_statuses(db, user["company_id"])

@router.put("/{status_id}")
async def update_status(status_id: UUID, req: ScheduleStatusUpdate, request: Request, db: AsyncSession = Depends(get_db)):
    user = await get_current_user(request, db)
    return await StatusController.update_status(
        db, status_id, user["company_id"],
        name=req.name, color=req.color, is_active=req.is_active, sort_order=req.sort_order
    )

@router.delete("/{status_id}")
async def delete_status(status_id: UUID, request: Request, db: AsyncSession = Depends(get_db)):
    user = await get_current_user(request, db)
    return await StatusController.delete_status(db, status_id, user["company_id"])

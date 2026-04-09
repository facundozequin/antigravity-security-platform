from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from fastapi.responses import FileResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc
from app.db.database import get_db
from app.db.models import SecurityReport, ReportSchedule, User
from app.auth.jwt import get_current_user
from app.services.report_generator import ReportGeneratorService
from app.services.scheduler import SchedulerService
from pydantic import BaseModel
from typing import Optional, List
import os
import asyncio
from datetime import datetime

router = APIRouter(prefix="/api/reports", tags=["reports"])

class ScheduleCreate(BaseModel):
    report_type: str
    frequency: str # Cron
    config: Optional[dict] = None

class ReportResponse(BaseModel):
    id: int
    report_type: str
    status: str
    created_at: datetime
    file_path: Optional[str] = None

    class Config:
        from_attributes = True

@router.get("/", response_model=List[ReportResponse])
async def get_reports(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """List historical security reports"""
    result = await db.execute(select(SecurityReport).order_by(desc(SecurityReport.created_at)).limit(50))
    return result.scalars().all()

@router.post("/manual")
async def trigger_manual_report(
    report_type: str = "manual",
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Trigger an asynchronous manual report generation"""
    report = SecurityReport(
        report_type=report_type,
        status="pending"
    )
    db.add(report)
    await db.commit()
    await db.refresh(report)
    
    # Run in background
    asyncio.create_task(ReportGeneratorService.generate_report(report.id))
    
    return {"message": "Report generation started", "report_id": report.id}

@router.get("/download/{report_id}")
async def download_report(
    report_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Download a generated PDF report"""
    report = await db.get(SecurityReport, report_id)
    if not report or not report.file_path:
        raise HTTPException(status_code=404, detail="Report not found or not ready")
    
    if not os.path.exists(report.file_path):
        raise HTTPException(status_code=404, detail="Physical report file missing")
    
    return FileResponse(
        report.file_path, 
        media_type="application/pdf",
        filename=os.path.basename(report.file_path)
    )

@router.get("/schedules")
async def get_schedules(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """List active report schedules"""
    result = await db.execute(select(ReportSchedule).where(ReportSchedule.user_id == current_user.id))
    return result.scalars().all()

@router.post("/schedules")
async def create_schedule(
    data: ScheduleCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Create a new recurring report schedule"""
    schedule = ReportSchedule(
        user_id=current_user.id,
        report_type=data.report_type,
        frequency=data.frequency,
        config=data.config
    )
    db.add(schedule)
    await db.commit()
    await db.refresh(schedule)
    
    # Register in active scheduler
    SchedulerService.add_job(schedule)
    
    return schedule

@router.delete("/schedules/{schedule_id}")
async def delete_schedule(
    schedule_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Remove a report schedule"""
    schedule = await db.get(ReportSchedule, schedule_id)
    if not schedule or schedule.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Schedule not found")
    
    await db.delete(schedule)
    await db.commit()
    
    # Remove from active scheduler
    SchedulerService.remove_job(schedule_id)
    
    return {"message": "Schedule removed"}

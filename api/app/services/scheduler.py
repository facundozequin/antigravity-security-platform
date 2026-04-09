from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger
from app.db.database import AsyncSessionLocal
from app.db.models import ReportSchedule, SecurityReport
from app.services.report_generator import ReportGeneratorService
from sqlalchemy import select
import logging
import asyncio

logger = logging.getLogger(__name__)

class SchedulerService:
    _scheduler = AsyncIOScheduler()
    _is_initialized = False

    @classmethod
    async def initialize(cls):
        """Startup logic to load schedules from DB"""
        if cls._is_initialized:
            return

        logger.info("Scheduler: Initializing security report engine...")
        cls._scheduler.start()
        
        async with AsyncSessionLocal() as db:
            result = await db.execute(select(ReportSchedule).where(ReportSchedule.is_active == True))
            schedules = result.scalars().all()
            
            for schedule in schedules:
                try:
                    cls.add_job(schedule)
                except Exception as e:
                    logger.error(f"Scheduler: Failed to load job {schedule.id}: {e}")
        
        cls._is_initialized = True
        logger.info(f"Scheduler: Loaded {len(schedules)} active report jobs")

    @classmethod
    def add_job(cls, schedule: ReportSchedule):
        """Register a cron job into the running scheduler"""
        job_id = f"report_{schedule.id}"
        
        # Remove if exists to avoid duplication on refresh
        if cls._scheduler.get_job(job_id):
            cls._scheduler.remove_job(job_id)

        cls._scheduler.add_job(
            cls._run_scheduled_report,
            trigger=CronTrigger.from_crontab(schedule.frequency),
            id=job_id,
            args=[schedule.id, schedule.report_type],
            replace_existing=True
        )
        logger.info(f"Scheduler: Registered {schedule.report_type} job (ID: {job_id}) with cron '{schedule.frequency}'")

    @classmethod
    def remove_job(cls, schedule_id: int):
        job_id = f"report_{schedule_id}"
        if cls._scheduler.get_job(job_id):
            cls._scheduler.remove_job(job_id)

    @staticmethod
    async def _run_scheduled_report(schedule_id: int, report_type: str):
        """Job handler executed by APScheduler"""
        logger.info(f"Scheduler: Triggering scheduled {report_type} report (Schedule: {schedule_id})")
        
        async with AsyncSessionLocal() as db:
            # 1. Create a new report record
            report = SecurityReport(
                report_type=report_type,
                status="pending"
            )
            db.add(report)
            await db.commit()
            await db.refresh(report)
            
            # 2. Update schedule last_run
            schedule = await db.get(ReportSchedule, schedule_id)
            if schedule:
                schedule.last_run = asyncio.get_event_loop().time() # Placeholder, we use datetime usually
                from datetime import datetime
                schedule.last_run = datetime.utcnow()
                await db.commit()

            # 3. Fire and forget the heavy generation task
            asyncio.create_task(ReportGeneratorService.generate_report(report.id))

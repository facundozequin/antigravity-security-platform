from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc
from app.db.database import get_db
from app.db.models import SecurityAlert
from app.services.alerts import AlertService
from app.auth.dependencies import require_admin, require_viewer
from typing import List
from pydantic import BaseModel
from datetime import datetime

router = APIRouter(prefix="/api/alerts", tags=["alerts"])

class AlertHistoryEntry(BaseModel):
    id: int
    timestamp: datetime
    source: str
    type: str
    severity: str
    client_ip: Optional[str]
    message: str
    count: int
    risk_score: int
    notified: bool
    last_seen: datetime

    class Config:
        from_attributes = True

@router.get("/history", response_model=List[AlertHistoryEntry])
async def get_alerts_history(db: AsyncSession = Depends(get_db), current_user = Depends(require_viewer)):
    stmt = select(SecurityAlert).order_by(desc(SecurityAlert.last_seen)).limit(100)
    result = await db.execute(stmt)
    return result.scalars().all()

@router.post("/test")
async def test_alerts(db: AsyncSession = Depends(get_db), current_user = Depends(require_admin)):
    # Trigger a dummy HIGH severity alert to test Telegram + Persistence
    await AlertService.trigger_alert(
        db, 
        source="SYSTEM", 
        alert_type="Connectivity Test", 
        severity="HIGH", 
        ip="127.0.0.1", 
        message="Manual alert test from administrator dashboard.",
        risk_score=0
    )
    return {"status": "ok", "message": "High-priority test alert triggered (check Telegram/History)"}

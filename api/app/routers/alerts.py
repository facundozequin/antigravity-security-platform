from fastapi import APIRouter
from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime

router = APIRouter(prefix="/api/alerts", tags=["alerts"])

class AlertEntry(BaseModel):
    timestamp: datetime
    type: str
    severity: str
    message: str
    channel: str

MOCK_ALERTS = [
    {"timestamp": datetime.now(), "type": "WAF", "severity": "CRITICAL", "message": "Massive block from 45.33.32.156", "channel": "Telegram"},
    {"timestamp": datetime.now(), "type": "Fail2Ban", "severity": "WARNING", "message": "IP 103.21.244.0 banned", "channel": "Telegram"},
]

@router.get("/history", response_model=List[AlertEntry])
async def get_alerts_history():
    return MOCK_ALERTS

@router.post("/test")
async def test_alerts():
    # Send a real or mock alert to Telegram
    return {"status": "ok", "message": "Test alert sent"}

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from app.db.database import get_db
from app.services.threat_intel import ThreatIntelService
from app.db.models import SystemSetting
from sqlalchemy import select
from typing import List

router = APIRouter(prefix="/api/threat-intel", tags=["threat-intel"])

@router.get("/ip/{ip}")
async def analyze_ip(ip: str, db: AsyncSession = Depends(get_db)):
    return await ThreatIntelService.analyze_ip(ip, db)

@router.get("/history")
async def get_history(db: AsyncSession = Depends(get_db)):
    # In a real scenario, we might store previous searches in DB.
    # For now, we return empty list or latest detected IPs from WAF logs
    # or just a placeholder for now as we didn't add a search history table yet.
    return []

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc
from app.db.database import AsyncSessionLocal
from app.db.models import IPReputationCache, RemediationAction
from app.services.profile import ProfileService
from typing import List, Optional

router = APIRouter(prefix="/api/profiles", tags=["Intel"])

async def get_db():
    async with AsyncSessionLocal() as db:
        yield db

@router.get("/stats/intel")
async def get_intel_provider_status():
    """Returns status of external intelligence providers (Circuit Breaker status)"""
    return await ProfileService.get_intel_status()

@router.get("/")
async def list_profiles(
    db: AsyncSession = Depends(get_db),
    limit: int = 50,
    offset: int = 0,
    search: Optional[str] = None
):
    stmt = select(IPReputationCache)
    if search:
        stmt = stmt.filter(IPReputationCache.client_ip.contains(search))
    
    stmt = stmt.order_by(desc(IPReputationCache.avg_risk_score)).limit(limit).offset(offset)
    result = await db.execute(stmt)
    profiles = result.scalars().all()
    return profiles

@router.get("/{ip}/insight")
async def get_ip_insight(
    ip: str,
    timeframe: str = "24h",
    db: AsyncSession = Depends(get_db)
):
    """
    Fused analysis for Dual-Axis Risk-Volume Chart.
    Combines ClickHouse Volume with Postgres Risk scores.
    """
    analytics = await ProfileService.get_fused_ip_analytics(db, ip, timeframe)
    profile = await ProfileService.get_or_create_profile(db, ip)
    
    return {
        "ip": ip,
        "profile": profile,
        "analytics": analytics
    }

@router.post("/{ip}/reset")
async def reset_ip_strikes(
    ip: str,
    db: AsyncSession = Depends(get_db)
):
    profile = await ProfileService.get_or_create_profile(db, ip)
    profile.waf_strikes = 0
    profile.auth_strikes = 0
    profile.ai_strikes = 0
    profile.is_repeat_offender = False
    await db.commit()
    return {"status": "success", "message": f"Strikes reset for {ip}"}

@router.get("/remediation/{ip}/history")
async def get_remediation_history(
    ip: str,
    db: AsyncSession = Depends(get_db)
):
    stmt = select(RemediationAction).filter_by(client_ip=ip).order_by(desc(RemediationAction.created_at))
    result = await db.execute(stmt)
    return result.scalars().all()

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import List, Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update, delete
from app.db.database import get_db
from app.db.models import RecommendedAction, RemediationAction, SecurityWhitelist
from app.auth.dependencies import require_operator, require_admin
from app.services.remediation import RemediationService
from app.client import agent_client
from datetime import datetime

router = APIRouter(prefix="/api/remediation", tags=["remediation"])

class WhitelistCreate(BaseModel):
    ip_or_cidr: str
    comment: Optional[str] = None

class RecommendationResponse(BaseModel):
    id: int
    ip: str
    description: str
    risk_score: int
    confidence_score: int
    status: str
    created_at: datetime
    class Config:
        from_attributes = True

# --- Recommendations ---

@router.get("/recommendations", response_model=List[RecommendationResponse])
async def get_recommendations(db: AsyncSession = Depends(get_db)):
    stmt = select(RecommendedAction).filter_by(status="PENDING").order_by(RecommendedAction.created_at.desc())
    result = await db.execute(stmt)
    return result.scalars().all()

@router.post("/recommendations/{rec_id}/approve")
async def approve_recommendation(rec_id: int, db: AsyncSession = Depends(get_db), current_user = Depends(require_operator)):
    stmt = select(RecommendedAction).filter_by(id=rec_id)
    result = await db.execute(stmt)
    rec = result.scalars().first()
    if not rec:
        raise HTTPException(status_code=404, detail="Recommendation not found")
    
    # Execute block
    action = await RemediationService.execute_block(
        db, 
        rec.ip, 
        f"Approved Recommendation: {rec.description}", 
        source="ai_manual"
    )
    
    if action:
        rec.status = "APPROVED"
        await db.commit()
        return {"status": "ok", "message": f"IP {rec.ip} blocked successfully"}
    
    raise HTTPException(status_code=500, detail="Failed to execute block")

@router.post("/recommendations/{rec_id}/reject")
async def reject_recommendation(rec_id: int, db: AsyncSession = Depends(get_db), current_user = Depends(require_operator)):
    stmt = select(RecommendedAction).filter_by(id=rec_id)
    result = await db.execute(stmt)
    rec = result.scalars().first()
    if not rec:
        raise HTTPException(status_code=404, detail="Recommendation not found")
    
    rec.status = "REJECTED"
    await db.commit()
    return {"status": "ok"}

# --- Active Blocks ---

@router.get("/blocks")
async def get_active_blocks(db: AsyncSession = Depends(get_db)):
    stmt = select(RemediationAction).filter_by(is_active=True).order_by(RemediationAction.created_at.desc())
    result = await db.execute(stmt)
    return result.scalars().all()

@router.delete("/blocks/{ip}")
async def unblock_ip(ip: str, db: AsyncSession = Depends(get_db), current_user = Depends(require_operator)):
    # 1. Agent Unban
    agent_client.unban_ip(ip)
    
    # 2. Update DB
    stmt = update(RemediationAction).where(RemediationAction.ip == ip).values(is_active=False)
    await db.execute(stmt)
    await db.commit()
    
    return {"status": "ok", "message": f"IP {ip} unblocked"}

# --- Whitelist ---

@router.get("/whitelist")
async def get_whitelist(db: AsyncSession = Depends(get_db)):
    stmt = select(SecurityWhitelist).order_by(SecurityWhitelist.added_at.desc())
    result = await db.execute(stmt)
    return result.scalars().all()

@router.post("/whitelist")
async def add_to_whitelist(item: WhitelistCreate, db: AsyncSession = Depends(get_db), current_user = Depends(require_admin)):
    obj = SecurityWhitelist(ip_or_cidr=item.ip_or_cidr, comment=item.comment)
    db.add(obj)
    await db.commit()
    return obj

@router.delete("/whitelist/{item_id}")
async def remove_from_whitelist(item_id: int, db: AsyncSession = Depends(get_db), current_user = Depends(require_admin)):
    stmt = delete(SecurityWhitelist).where(SecurityWhitelist.id == item_id)
    await db.execute(stmt)
    await db.commit()
    return {"status": "ok"}

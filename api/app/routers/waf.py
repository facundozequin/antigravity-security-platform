from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.db.database import get_db
from app.db.models import WafRule
from app.auth.dependencies import require_operator
from app.client import agent_client
import httpx
import os

CH_HOST = os.getenv("CH_HOST", "localhost")
CH_PORT = os.getenv("CH_PORT", "8123")
CH_USER = os.getenv("CH_USER", "default")
CH_PASS = os.getenv("CH_PASS", "")

router = APIRouter(prefix="/api/waf", tags=["waf"])

class WafRuleCreate(BaseModel):
    name: str
    rule_content: str
    enabled: bool = True

class WafRuleResponse(WafRuleCreate):
    id: int

    class Config:
        from_attributes = True

class WafEvent(BaseModel):
    timestamp: datetime
    rule_id: int
    client_ip: str
    uri: str

@router.get("/rules", response_model=List[WafRuleResponse])
async def get_waf_rules(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(WafRule))
    return result.scalars().all()

@router.post("/rules", response_model=WafRuleResponse)
async def create_waf_rule(rule: WafRuleCreate, db: AsyncSession = Depends(get_db), current_user = Depends(require_operator)):
    db_rule = WafRule(**rule.dict())
    db.add(db_rule)
    await db.commit()
    await db.refresh(db_rule)
    
    # Sync with agent
    if db_rule.enabled:
        agent_client.sync_config(
            target="waf",
            filename=f"{db_rule.name}.conf",
            content=db_rule.rule_content,
            reload_after=True
        )
    
    return db_rule

@router.patch("/rules/{rule_id}", response_model=WafRuleResponse)
async def toggle_rule(rule_id: int, enabled: bool, db: AsyncSession = Depends(get_db), current_user = Depends(require_operator)):
    result = await db.execute(select(WafRule).filter(WafRule.id == rule_id))
    db_rule = result.scalars().first()
    if not db_rule:
        raise HTTPException(status_code=404, detail="Rule not found")
    
    db_rule.enabled = enabled
    await db.commit()
    await db.refresh(db_rule)
    
    # Sync with agent
    agent_client.sync_config(
        target="waf",
        filename=f"{db_rule.name}.conf",
        content=db_rule.rule_content if db_rule.enabled else "# Disabled",
        reload_after=True
    )
    
    return db_rule

@router.delete("/rules/{rule_id}")
async def delete_waf_rule(rule_id: int, db: AsyncSession = Depends(get_db), current_user = Depends(require_operator)):
    result = await db.execute(select(WafRule).filter(WafRule.id == rule_id))
    db_rule = result.scalars().first()
    if not db_rule:
        raise HTTPException(status_code=404, detail="Rule not found")
    
    name = db_rule.name
    await db.delete(db_rule)
    await db.commit()
    
    # Remove from agent
    agent_client.sync_config(
        target="waf",
        filename=f"{name}.conf",
        content="# Deleted",
        reload_after=True
    )
    
    return {"status": "ok"}

@router.get("/events", response_model=List[WafEvent])
async def get_waf_events():
    # Fetch from ClickHouse
    try:
        async with httpx.AsyncClient() as client:
            resp = await client.post(
                f"http://{CH_HOST}:{CH_PORT}",
                params={"query": 'SELECT timestamp, rule_id, client_ip, uri FROM nginx_logs WHERE rule_id != 0 ORDER BY timestamp DESC LIMIT 100 FORMAT JSON'},
                auth=(CH_USER, CH_PASS)
            )
            data = resp.json()
            return data.get("data", [])
    except Exception as e:
        print(f"ClickHouse Error: {e}")
        return []

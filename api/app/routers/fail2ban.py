from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update, delete
from app.db.database import get_db
from app.db.models import Fail2BanJail
from app.auth.dependencies import require_operator
from app.client import agent_client

router = APIRouter(prefix="/api/fail2ban", tags=["fail2ban"])

class JailConfigCreate(BaseModel):
    name: str
    log_path: str
    maxretry: int = 5
    findtime: int = 600
    bantime: int = 3600
    enabled: bool = True

class JailConfigResponse(JailConfigCreate):
    id: int

class BanRequest(BaseModel):
    ip: str
    reason: Optional[str] = "Manual ban"

class UnbanRequest(BaseModel):
    ip: str

from app.services.alerts import AlertService

@router.get("/bans")
async def get_bans():
    return agent_client.get_fail2ban_bans()

@router.post("/ban")
async def ban_ip(req: BanRequest, db: AsyncSession = Depends(get_db), current_user = Depends(require_operator)):
    res = agent_client.ban_ip(req.ip, req.reason)
    await AlertService.notify_fail2ban_ban(req.ip, "manual", db)
    return res

@router.post("/unban")
async def unban_ip(req: UnbanRequest, db: AsyncSession = Depends(get_db), current_user = Depends(require_operator)):
    res = agent_client.unban_ip(req.ip)
    await AlertService.send_telegram_alert(f"🔓 *IP Unbanned*\n\n*IP:* `{req.ip}`", db)
    return res

@router.get("/jails", response_model=List[JailConfigResponse])
async def get_jails(db: AsyncSession = Depends(get_db)):
    # Combine DB config with live agent status
    db_jails = (await db.execute(select(Fail2BanJail))).scalars().all()
    try:
        live_jails = agent_client.get_fail2ban_jails()
        # Merge currently_banned status into response
        res = []
        for dj in db_jails:
            jail_data = dj.__dict__.copy()
            live = next((lj for lj in live_jails if lj.name == dj.name), None)
            jail_data['currently_banned'] = live.currently_banned if live else 0
            res.append(jail_data)
        return res
    except Exception:
        return db_jails

@router.post("/jails", response_model=JailConfigResponse)
async def create_jail(jail: JailConfigCreate, db: AsyncSession = Depends(get_db), current_user = Depends(require_operator)):
    new_jail = Fail2BanJail(**jail.dict())
    db.add(new_jail)
    await db.commit()
    await db.refresh(new_jail)
    
    # Generate jail config and sync
    jail_content = f"""
[{new_jail.name}]
enabled = {'true' if new_jail.enabled else 'false'}
logpath = {new_jail.log_path}
maxretry = {new_jail.maxretry}
findtime = {new_jail.findtime}
bantime = {new_jail.bantime}
"""
    agent_client.sync_config(target="fail2ban", filename=f"{new_jail.name}.conf", content=jail_content, reload_after=True)
    
    return new_jail

@router.delete("/jails/{jail_id}")
async def delete_jail(jail_id: int, db: AsyncSession = Depends(get_db), current_user = Depends(require_operator)):
    result = await db.execute(select(Fail2BanJail).filter(Fail2BanJail.id == jail_id))
    jail = result.scalars().first()
    if not jail:
        raise HTTPException(status_code=404, detail="Jail not found")
    
    jail_name = jail.name
    await db.delete(jail)
    await db.commit()
    
    # Send empty config to "delete" it (or support proper deletion in agent)
    # For now, disable it by writing disabled config
    jail_content = f"""
[{jail_name}]
enabled = false
"""
    agent_client.sync_config(target="fail2ban", filename=f"{jail_name}.conf", content=jail_content, reload_after=True)

    return {"status": "ok"}


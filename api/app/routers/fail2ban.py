from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime

router = APIRouter(prefix="/api/fail2ban", tags=["fail2ban"])

class BanRequest(BaseModel):
    ip: str
    reason: Optional[str] = None

class BanResponse(BaseModel):
    ip: str
    jail: str
    banned_at: datetime
    ban_time: int
    reason: str
    country: str

class JailConfig(BaseModel):
    name: str
    enabled: bool
    maxretry: int
    bantime: int
    findtime: int
    currently_banned: int

MOCK_BANS = [
    {"ip": "45.33.32.156", "jail": "nginx-http-auth", "banned_at": datetime.now(), "ban_time": 3600, "reason": "Too many 401s", "country": "US"},
    {"ip": "103.21.244.0", "jail": "fail2ban-nginx-limit", "banned_at": datetime.now(), "ban_time": 86400, "reason": "Rate limit exceeded", "country": "CN"},
]

MOCK_JAILS = [
    {"name": "nginx-http-auth", "enabled": True, "maxretry": 5, "bantime": 3600, "findtime": 600, "currently_banned": 12},
    {"name": "nginx-botsearch", "enabled": True, "maxretry": 2, "bantime": 86400, "findtime": 3600, "currently_banned": 4},
    {"name": "sshd", "enabled": True, "maxretry": 3, "bantime": 3600, "findtime": 600, "currently_banned": 7},
]

@router.get("/bans", response_model=List[BanResponse])
async def get_bans():
    return MOCK_BANS

@router.post("/ban")
async def ban_ip(req: BanRequest):
    # Here we would call agent_client.ban_ip
    return {"status": "ok", "message": f"IP {req.ip} banned"}

@router.delete("/ban/{ip}")
async def unban_ip(ip: str):
    # Here we would call agent_client.unban_ip
    return {"status": "ok", "message": f"IP {ip} unbanned"}

@router.get("/jails", response_model=List[JailConfig])
async def get_jails():
    return MOCK_JAILS

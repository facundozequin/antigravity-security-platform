from fastapi import APIRouter
from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime

router = APIRouter(prefix="/api/waf", tags=["waf"])

class WafRule(BaseModel):
    id: int
    name: str
    enabled: bool
    severity: str

class WafEvent(BaseModel):
    timestamp: datetime
    rule_id: int
    client_ip: str
    uri: str

MOCK_WAF_RULES = [
    {"id": 941100, "name": "XSS Detection", "enabled": True, "severity": "CRITICAL"},
    {"id": 942100, "name": "SQL Injection", "enabled": True, "severity": "CRITICAL"},
    {"id": 920230, "name": "Multiple URL Encoding", "enabled": False, "severity": "WARNING"},
]

MOCK_WAF_EVENTS = [
    {"timestamp": datetime.now(), "rule_id": 942100, "client_ip": "103.21.244.0", "uri": "/login?user=' OR 1=1"},
    {"timestamp": datetime.now(), "rule_id": 941100, "client_ip": "45.33.32.156", "uri": "/search?q=<script>alert(1)</script>"},
]

@router.get("/rules", response_model=List[WafRule])
async def get_waf_rules():
    return MOCK_WAF_RULES

@router.patch("/rules/{id}")
async def toggle_rule(id: int, enabled: bool):
    return {"status": "ok", "message": f"Rule {id} {'enabled' if enabled else 'disabled'}"}

@router.get("/events", response_model=List[WafEvent])
async def get_waf_events():
    return MOCK_WAF_EVENTS

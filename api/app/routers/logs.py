from fastapi import APIRouter, Query
from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime
import random

router = APIRouter(prefix="/api/logs", tags=["logs"])

class LogEntry(BaseModel):
    timestamp: datetime
    source: str
    level: str
    message: str

def generate_mock_log():
    sources = ["nginx-access", "nginx-error", "modsecurity", "fail2ban"]
    levels = ["INFO", "WARN", "ERROR", "CRITICAL"]
    ips = ["192.168.1.1", "103.21.244.0", "45.33.32.156", "8.8.8.8"]
    source = random.choice(sources)
    level = random.choice(levels)
    ip = random.choice(ips)
    
    if source == "nginx-access":
        msg = f"{ip} - GET /api/v1/resource 200 0.045s"
    elif source == "modsecurity":
        msg = f"[id \"942100\"] SQL Injection attempt from {ip}"
    else:
        msg = f"Event from {source} involving {ip}"
        
    return {
        "timestamp": datetime.now(),
        "source": source,
        "level": level,
        "message": msg
    }

@router.get("", response_model=List[LogEntry])
async def get_logs(source: Optional[str] = None, page: int = 1):
    # In real implementation, query ClickHouse
    logs = [generate_mock_log() for _ in range(20)]
    if source and source != "all":
        logs = [l for l in logs if l["source"] == source]
    return logs

from fastapi import APIRouter
from pydantic import BaseModel
from typing import Optional

router = APIRouter(prefix="/api/settings", tags=["settings"])

class GlobalSettings(BaseModel):
    virusTotalApiKey: str
    abuseIpdbApiKey: str
    telegramBotToken: str
    telegramChatId: str
    logRetentionDays: int
    autoBanMaliciousIps: bool
    aiAnalysisEnabled: bool
    pollingInterval: int

@router.get("", response_model=GlobalSettings)
async def get_settings():
    # Load from DB or .env
    return {
        "virusTotalApiKey": "********************************",
        "abuseIpdbApiKey": "********************************",
        "telegramBotToken": "",
        "telegramChatId": "",
        "logRetentionDays": 30,
        "autoBanMaliciousIps": True,
        "aiAnalysisEnabled": True,
        "pollingInterval": 5000,
    }

@router.put("")
async def update_settings(settings: GlobalSettings):
    # Save to DB or .env
    return {"status": "ok", "message": "Settings updated"}

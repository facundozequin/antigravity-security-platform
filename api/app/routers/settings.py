from fastapi import APIRouter, Depends
from pydantic import BaseModel
from typing import Optional, List
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.db.database import get_db
from app.db.models import SystemSetting, AIProviderConfig
from app.auth.dependencies import require_admin

router = APIRouter(prefix="/api/settings", tags=["settings"])

class GlobalSettings(BaseModel):
    VIRUSTOTAL_API_KEY: str = ""
    ABUSEIPDB_API_KEY: str = ""
    TELEGRAM_BOT_TOKEN: str = ""
    TELEGRAM_CHAT_ID: str = ""
    TELEGRAM_ALERTS_ENABLED: bool = False
    LOG_RETENTION_DAYS: int = 30
    AUTO_BAN_MALICIOUS_IPS: bool = True
    AI_ANALYSIS_ENABLED: bool = True
    POLLING_INTERVAL: int = 5000
    REMEDIATION_AUTO_BLOCK_ENABLED: bool = False
    EMERGENCY_REMEDIATION_STOP: bool = False
    REMEDIATION_MAX_BLOCKS_PER_MIN: int = 5
    REMEDIATION_DEFAULT_BLOCK_MINS: int = 15

class AIProviderConfigResponse(BaseModel):
    id: int
    name: str
    provider_type: str
    model: str
    is_active: bool

    class Config:
        from_attributes = True

@router.get("", response_model=GlobalSettings)
async def get_settings(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(SystemSetting))
    settings_dict = {s.key: s.value for s in result.scalars().all()}
    
    return GlobalSettings(
        VIRUSTOTAL_API_KEY=settings_dict.get("VIRUSTOTAL_API_KEY", "********************************"),
        ABUSEIPDB_API_KEY=settings_dict.get("ABUSEIPDB_API_KEY", "********************************"),
        TELEGRAM_BOT_TOKEN=settings_dict.get("TELEGRAM_BOT_TOKEN", ""),
        TELEGRAM_CHAT_ID=settings_dict.get("TELEGRAM_CHAT_ID", ""),
        TELEGRAM_ALERTS_ENABLED=settings_dict.get("TELEGRAM_ALERTS_ENABLED", "False") == "True",
        LOG_RETENTION_DAYS=int(settings_dict.get("LOG_RETENTION_DAYS", 30)),
        AUTO_BAN_MALICIOUS_IPS=settings_dict.get("AUTO_BAN_MALICIOUS_IPS", "True") == "True",
        AI_ANALYSIS_ENABLED=settings_dict.get("AI_ANALYSIS_ENABLED", "True") == "True",
        POLLING_INTERVAL=int(settings_dict.get("POLLING_INTERVAL", 5000)),
        REMEDIATION_AUTO_BLOCK_ENABLED=settings_dict.get("REMEDIATION_AUTO_BLOCK_ENABLED", "False") == "True",
        EMERGENCY_REMEDIATION_STOP=settings_dict.get("EMERGENCY_REMEDIATION_STOP", "False") == "True",
        REMEDIATION_MAX_BLOCKS_PER_MIN=int(settings_dict.get("REMEDIATION_MAX_BLOCKS_PER_MIN", 5)),
        REMEDIATION_DEFAULT_BLOCK_MINS=int(settings_dict.get("REMEDIATION_DEFAULT_BLOCK_MINS", 15)),
    )

@router.put("")
async def update_settings(settings: GlobalSettings, db: AsyncSession = Depends(get_db), current_user = Depends(require_admin)):
    for key, value in settings.dict().items():
        result = await db.execute(select(SystemSetting).filter(SystemSetting.key == key))
        db_setting = result.scalars().first()
        if db_setting:
            db_setting.value = str(value)
        else:
            db.add(SystemSetting(key=key, value=str(value)))
    
    await db.commit()
    return {"status": "ok", "message": "Settings updated"}

@router.get("/providers", response_model=List[AIProviderConfigResponse])
async def get_ai_providers(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(AIProviderConfig))
    return result.scalars().all()

class AIProviderCreate(BaseModel):
    name: str
    provider_type: str
    api_key: Optional[str] = None
    model: str
    endpoint_url: Optional[str] = None

@router.post("/providers")
async def create_provider(provider: AIProviderCreate, db: AsyncSession = Depends(get_db), current_user = Depends(require_admin)):
    db_provider = AIProviderConfig(**provider.dict())
    db.add(db_provider)
    await db.commit()
    await db.refresh(db_provider)
    return db_provider

@router.put("/providers/{provider_id}/activate")
async def activate_provider(provider_id: int, db: AsyncSession = Depends(get_db), current_user = Depends(require_admin)):
    # Deactivate all others
    from sqlalchemy import update
    await db.execute(update(AIProviderConfig).values(is_active=False))
    
    # Activate this one
    result = await db.execute(select(AIProviderConfig).filter(AIProviderConfig.id == provider_id))
    db_provider = result.scalars().first()
    if db_provider:
        db_provider.is_active = True
        await db.commit()
        return {"status": "ok", "message": f"Provider {db_provider.name} activated"}
    return {"status": "error", "message": "Provider not found"}

@router.delete("/providers/{provider_id}")
async def delete_provider(provider_id: int, db: AsyncSession = Depends(get_db), current_user = Depends(require_admin)):
    result = await db.execute(select(AIProviderConfig).filter(AIProviderConfig.id == provider_id))
    db_provider = result.scalars().first()
    if db_provider:
        await db.delete(db_provider)
        await db.commit()
        return {"status": "ok"}
    return {"status": "error", "message": "Provider not found"}

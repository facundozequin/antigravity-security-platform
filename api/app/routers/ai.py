from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import List, Optional
from sqlalchemy.ext.asyncio import AsyncSession
from app.db.database import get_db
from app.services.ai_service import AIService
from app.auth.dependencies import require_viewer

from app.db.models import AIReport, AIInsight
from sqlalchemy import select
from typing import List, Optional, Any

router = APIRouter(prefix="/api/ai", tags=["ai"])

class AIRequest(BaseModel):
    logs: Optional[List[str]] = None
    input: Optional[str] = None

class AIResponse(BaseModel):
    role: str
    content: str

@router.get("/reports")
async def get_ai_reports(db: AsyncSession = Depends(get_db), current_user = Depends(require_viewer)):
    result = await db.execute(select(AIReport).order_by(AIReport.timestamp.desc()).limit(10))
    return result.scalars().all()

@router.get("/reports/{report_id}/insights")
async def get_report_insights(report_id: int, db: AsyncSession = Depends(get_db), current_user = Depends(require_viewer)):
    result = await db.execute(select(AIInsight).filter_by(report_id=report_id))
    return result.scalars().all()

@router.post("/analyze", response_model=AIResponse)
async def analyze_logs(req: AIRequest, db: AsyncSession = Depends(get_db), current_user = Depends(require_viewer)):
    provider = await AIService.get_active_provider(db)
    if not provider:
        raise HTTPException(status_code=400, detail="AI Not configured")
    
    prompt = f"Analyze these security logs and identify any threats:\n\n{'\n'.join(req.logs or [])}"
    content = await provider.generate(prompt)
    
    return {"role": "assistant", "content": content}

@router.post("/chat", response_model=AIResponse)
async def chat_with_ai(req: AIRequest, db: AsyncSession = Depends(get_db), current_user = Depends(require_viewer)):
    provider = await AIService.get_active_provider(db)
    if not provider:
        raise HTTPException(status_code=400, detail="AI Not configured")
    
    content = await provider.generate(req.input or "Hello")
    return {"role": "assistant", "content": content}

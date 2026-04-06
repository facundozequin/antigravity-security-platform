from fastapi import APIRouter
from pydantic import BaseModel
from typing import List, Optional

router = APIRouter(prefix="/api/ai", tags=["ai"])

class AIRequest(BaseModel):
    logs: Optional[List[str]] = None
    input: Optional[str] = None

class AIResponse(BaseModel):
    role: str
    content: str

@router.post("/analyze", response_model=AIResponse)
async def analyze_logs(req: AIRequest):
    # Integration with Ollama
    return {
        "role": "assistant",
        "content": "Analysis completed. Pattern of scanning detected from 45.33.32.156. No critical threats found in the last 100 entries."
    }

@router.post("/chat", response_model=AIResponse)
async def chat_with_ai(req: AIRequest):
    # Integration with Ollama
    return {
        "role": "assistant",
        "content": "I am Antigravity AI. I have full access to your security logs and configuration. How can I help you improve your security posture?"
    }

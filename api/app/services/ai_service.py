from app.services.ai_provider import OllamaProvider, OpenAIProvider, GeminiProvider
from app.db.models import AIProviderConfig
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

class AIService:
    @staticmethod
    async def get_active_provider(db: AsyncSession):
        result = await db.execute(select(AIProviderConfig).filter(AIProviderConfig.is_active == True))
        config = result.scalars().first()
        
        if not config:
            return None
        
        if config.provider_type == "ollama":
            return OllamaProvider(model=config.model, endpoint=config.endpoint_url or "http://ollama:11434")
        elif config.provider_type == "openai":
            return OpenAIProvider(api_key=config.api_key, model=config.model)
        elif config.provider_type == "gemini":
            return GeminiProvider(api_key=config.api_key, model=config.model)
        
        return None

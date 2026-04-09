from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.db.models import AIProviderConfig
from abc import ABC, abstractmethod

class AIProvider(ABC):
    @abstractmethod
    async def generate(self, prompt: str, **kwargs) -> str:
        pass

import httpx
import json

class OllamaProvider(AIProvider):
    def __init__(self, endpoint: str, model: str):
        self.endpoint = endpoint
        self.model = model

    async def generate(self, prompt: str, **kwargs) -> str:
        async with httpx.AsyncClient(timeout=60.0) as client:
            try:
                response = await client.post(
                    f"{self.endpoint}/api/generate",
                    json={
                        "model": self.model,
                        "prompt": prompt,
                        "stream": False
                    }
                )
                response.raise_for_status()
                return response.json().get("response", "Error: No response from AI")
            except Exception as e:
                return f"Error connecting to Ollama: {str(e)}"

class OpenAIProvider(AIProvider):
    def __init__(self, api_key: str, model: str):
        self.api_key = api_key
        self.model = model

    async def generate(self, prompt: str, **kwargs) -> str:
        # Placeholder for real OpenAI call
        return f"Response from OpenAI ({self.model}): Not implemented yet. Please use Ollama for now."

class GeminiProvider(AIProvider):
    def __init__(self, api_key: str, model: str):
        self.api_key = api_key
        self.model = model

    async def generate(self, prompt: str, **kwargs) -> str:
        # Placeholder for real Gemini call
        return f"Response from Gemini ({self.model}): Not implemented yet. Please use Ollama for now."

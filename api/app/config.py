import os
from dotenv import load_dotenv

# Load from .env if present
load_dotenv()

class Settings:
    # API Keys
    ABUSEIPDB_API_KEY = os.getenv("ABUSEIPDB_API_KEY")
    
    # Intelligence Config
    INTEL_CACHE_TTL_HOURS = int(os.getenv("INTEL_CACHE_TTL_HOURS", "24"))
    INTEL_TIMEOUT_SECONDS = int(os.getenv("INTEL_TIMEOUT_SECONDS", "5"))
    INTEL_MAX_RETRIES = int(os.getenv("INTEL_MAX_RETRIES", "2"))
    
    # Circuit Breaker Config
    CIRCUIT_BREAKER_THRESHOLD = int(os.getenv("CIRCUIT_BREAKER_THRESHOLD", "5"))
    CIRCUIT_BREAKER_COOLDOWN_MINUTES = int(os.getenv("CIRCUIT_BREAKER_COOLDOWN_MINUTES", "15"))
    
    # Risk Fusion Weights
    RISK_WEIGHT_INTERNAL = float(os.getenv("RISK_WEIGHT_INTERNAL", "0.7"))
    RISK_WEIGHT_EXTERNAL = float(os.getenv("RISK_WEIGHT_EXTERNAL", "0.3"))

# Global Settings Instance
settings = Settings()

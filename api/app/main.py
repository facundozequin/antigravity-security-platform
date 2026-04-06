from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from app.client import agent_client
from app.routers import fail2ban, waf, logs, threat_intel, ai, alerts, settings
import os

app = FastAPI(title="Security Platform API")

# CORS for Frontend
origins = [
    "http://localhost",
    "http://localhost:3000",
    "*"
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include Routers
app.include_router(fail2ban.router)
app.include_router(waf.router)
app.include_router(logs.router)
app.include_router(threat_intel.router)
app.include_router(ai.router)
app.include_router(alerts.router)
app.include_router(settings.router)

@app.on_event("startup")
async def startup_event():
    # Pre-connect
    try:
        agent_client.connect()
        print("Connected to Agent RPC")
    except Exception as e:
        print(f"Failed to connect to agent: {e}")

@app.get("/")
def read_root():
    return {"status": "ok", "service": "Security Platform API"}

@app.get("/api/health")
def health_check():
    agent_status = agent_client.ping()
    return {
        "api": "online",
        "agent": agent_status
    }

@app.get("/api/sites")
def list_sites():
    return agent_client.list_sites()

@app.get("/api/sites/{filename}")
def get_site(filename: str):
    try:
        return agent_client.get_site_config(filename)
    except Exception as e:
        raise HTTPException(status_code=404, detail=str(e))

@app.get("/api/stats/traffic")
def get_traffic_stats():
    # Mock data for dashboard
    return {
        "requests_per_second": 15,
        "total_requests_24h": 12500,
        "error_rate": 0.02,
        "attacks_blocked_24h": 342,
        "ips_currently_banned": 24,
        "security_score": 92
    }


from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from app.client import agent_client
import os

app = FastAPI(title="Nginx Admin API")

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
    return {"status": "ok", "service": "Nginx Admin API"}

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
    # MVP: Mocked or simple query.
    # In full implementation, this uses clickhouse_connect
    return {
        "requests_per_second": 15,
        "total_requests_24h": 12500,
        "error_rate": 0.02
    }

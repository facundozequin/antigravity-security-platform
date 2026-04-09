from fastapi import FastAPI, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.client import agent_client
from app.routers import fail2ban, waf, logs, threat_intel, ai, alerts, settings, auth, nginx, remediation, profiles, reports
from app.db.database import engine, Base, AsyncSessionLocal
from app.db.models import User
from app.auth.jwt import get_password_hash
import os
import contextlib

import asyncio
from app.services.log_analytics import LogAnalyticsService
from app.services.profile import ProfileService

async def run_strike_decay():
    """Background task to decay strikes every 12 hours"""
    while True:
        try:
            async with AsyncSessionLocal() as db:
                await ProfileService.decay_behavior_metrics(db)
            # Run every 12 hours
            await asyncio.sleep(43200)
        except Exception as e:
            await asyncio.sleep(300)

@contextlib.asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    
    # Start Background Services
    from app.services.scheduler import SchedulerService
    asyncio.create_task(SchedulerService.initialize())
    asyncio.create_task(LogAnalyticsService.run_analysis_cycle())
    asyncio.create_task(run_strike_decay())
    
    # Create default admin if not exists
    async with AsyncSessionLocal() as db:
        result = await db.execute(select(User).filter_by(username="admin"))
        if not result.scalars().first():
            admin_user = User(
                username="admin",
                email="admin@admin.com",
                hashed_password=get_password_hash("admin"),
                role="admin"
            )
            db.add(admin_user)
            await db.commit()
    
    try:
        agent_client.connect()
        print("Connected to Agent RPC")
    except Exception as e:
        print(f"Failed to connect to agent: {e}")
        
    yield
    # Shutdown logic if any

app = FastAPI(title="Security Platform API", lifespan=lifespan)

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
app.include_router(auth.router)
app.include_router(fail2ban.router)
app.include_router(waf.router)
app.include_router(nginx.router)
app.include_router(logs.router)
app.include_router(threat_intel.router)
app.include_router(ai.router)
app.include_router(alerts.router)
app.include_router(settings.router)
app.include_router(remediation.router)
app.include_router(profiles.router)
app.include_router(reports.router)

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


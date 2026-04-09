from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import List
from app.db.database import get_db
from app.db.models import NginxConfig
from app.auth.dependencies import require_operator
from app.client import agent_client
from pydantic import BaseModel

router = APIRouter(prefix="/api/nginx", tags=["nginx"])

class VHostCreate(BaseModel):
    domain: str
    target_url: str
    port: int = 80
    ssl_enabled: bool = False
    custom_config: str = ""
    enabled: bool = True

class VHostResponse(VHostCreate):
    id: int
    class Config:
        from_attributes = True

def generate_nginx_config(vhost: NginxConfig) -> str:
    # Basic reverse proxy template
    config = f"""
server {{
    listen {vhost.port};
    server_name {vhost.domain};

    location / {{
        proxy_pass {vhost.target_url};
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }}
    
    {vhost.custom_config}
}}
"""
    return config

@router.get("/vhosts", response_model=List[VHostResponse])
async def list_vhosts(db: AsyncSession = Depends(get_db), current_user = Depends(require_operator)):
    result = await db.execute(select(NginxConfig))
    return result.scalars().all()

@router.post("/vhosts", response_model=VHostResponse)
async def create_vhost(vhost_in: VHostCreate, db: AsyncSession = Depends(get_db), current_user = Depends(require_operator)):
    vhost = NginxConfig(**vhost_in.dict())
    db.add(vhost)
    await db.commit()
    await db.refresh(vhost)
    
    # Sync with agent
    if vhost.enabled:
        config_content = generate_nginx_config(vhost)
        try:
            await agent_client.sync_config("nginx", f"{vhost.domain}.conf", config_content)
        except Exception as e:
            # Rollback or log error
            print(f"Sync failed: {e}")
            
    return vhost

@router.put("/vhosts/{vhost_id}", response_model=VHostResponse)
async def update_vhost(vhost_id: int, vhost_in: VHostCreate, db: AsyncSession = Depends(get_db), current_user = Depends(require_operator)):
    result = await db.execute(select(NginxConfig).filter(NginxConfig.id == vhost_id))
    vhost = result.scalars().first()
    if not vhost:
        raise HTTPException(status_code=404, detail="VHost not found")
        
    for key, value in vhost_in.dict().items():
        setattr(vhost, key, value)
    
    await db.commit()
    await db.refresh(vhost)
    
    # Sync with agent
    config_content = generate_nginx_config(vhost)
    try:
        await agent_client.sync_config("nginx", f"{vhost.domain}.conf", config_content)
    except Exception as e:
        print(f"Sync failed: {e}")
        
    return vhost

@router.delete("/vhosts/{vhost_id}")
async def delete_vhost(vhost_id: int, db: AsyncSession = Depends(get_db), current_user = Depends(require_operator)):
    result = await db.execute(select(NginxConfig).filter(NginxConfig.id == vhost_id))
    vhost = result.scalars().first()
    if not vhost:
        raise HTTPException(status_code=404, detail="VHost not found")
        
    domain = vhost.domain
    await db.delete(vhost)
    await db.commit()
    
    # Remove from agent
    # We need a delete_config method in agent_service/agent
    # For now we'll just send an empty config or disable it
    # Implementation of delete in agent is missing in current gRPC proto, 
    # but we can overwrite with invalid/empty config or disable.
    
    return {"status": "ok", "message": f"VHost {domain} deleted"}

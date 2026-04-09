from fastapi import APIRouter, Query, Depends, HTTPException
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
from datetime import datetime, timedelta
from app.db.database import get_clickhouse, get_db
from sqlalchemy.ext.asyncio import AsyncSession
from app.auth.dependencies import require_viewer

router = APIRouter(prefix="/api/logs", tags=["logs"])

from app.db.models import IPReputationCache
from sqlalchemy import select

@router.get("", response_model=List[Dict[str, Any]])
async def get_logs(
    source: Optional[str] = None, 
    level: Optional[str] = None,
    query: Optional[str] = None,
    limit: int = Query(50, le=1000),
    db: AsyncSession = Depends(get_db),
    current_user = Depends(require_viewer)
):
    try:
        client = get_clickhouse()
        
        if source == 'modsecurity':
            sql = f"""
                SELECT timestamp, 'modsecurity' as source, severity as level, msg as message, client_ip, 'GET' as request_method, uri as request_path, 0 as status_code
                FROM security_platform.waf_events
                ORDER BY timestamp DESC LIMIT {limit}
            """
        else:
            sql = f"""
                SELECT timestamp, 'nginx' as source, 'info' as level, path as message, client_ip, method as request_method, path as request_path, status as status_code
                FROM security_platform.nginx_logs
                ORDER BY timestamp DESC LIMIT {limit}
            """
        
        result = client.query(sql)
        
        logs = []
        ips = set()
        for row in result.result_rows:
            logs.append({
                "timestamp": row[0],
                "source": row[1],
                "level": row[2],
                "message": row[3],
                "client_ip": row[4],
                "request_method": row[5],
                "request_path": row[6],
                "status_code": row[7],
                "reputation": None # Placeholder
            })
            if row[4]: ips.add(row[4])
        
        # Enrich with cache data
        if ips:
            reputation_stmt = select(IPReputationCache).filter(IPReputationCache.client_ip.in_(list(ips)))
            rep_res = await db.execute(reputation_stmt)
            cache_map = {r.client_ip: {"score": r.reputation_score, "class": r.classification} for r in rep_res.scalars().all()}
            
            for log in logs:
                if log["client_ip"] in cache_map:
                    log["reputation"] = cache_map[log["client_ip"]]
            
        return {"logs": logs}
    except Exception as e:
        print(f"Logs error: {e}")
        return {"logs": []}

from app.db.models import IPReputationCache, AIReport, SecurityAlert
from sqlalchemy import select, func, desc

@router.get("/stats")
async def get_log_stats(db: AsyncSession = Depends(get_db), current_user = Depends(require_viewer)):
    try:
        client = get_clickhouse()
        
        # 1. ClickHouse Metrics (Total 24h traffic)
        sql_total = "SELECT count() FROM security_platform.nginx_logs WHERE timestamp > now() - INTERVAL 24 HOUR"
        total_24h = client.query(sql_total).result_rows[0][0]
        
        # 2. Database Metrics (Last 24h Alerts)
        twenty_four_hours_ago = datetime.utcnow() - timedelta(hours=24)
        
        # Total threats (sum of counts in last 24h)
        threat_count_stmt = select(func.sum(SecurityAlert.count)).where(SecurityAlert.timestamp >= twenty_four_hours_ago)
        threat_res = await db.execute(threat_count_stmt)
        threats_24h = threat_res.scalar() or 0
        
        # Top Attacking IPs
        top_ips_stmt = select(SecurityAlert.client_ip, func.sum(SecurityAlert.count).label('total')).where(
            SecurityAlert.timestamp >= twenty_four_hours_ago
        ).group_by(SecurityAlert.client_ip).order_of(desc('total')).limit(5)
        # Using .order_by(desc('total')) but since it's an alias we might need something else.
        # Actually standard SQLAlchemy:
        top_ips_stmt = select(SecurityAlert.client_ip, func.sum(SecurityAlert.count)).where(
            SecurityAlert.timestamp >= twenty_four_hours_ago
        ).group_by(SecurityAlert.client_ip).order_by(func.sum(SecurityAlert.count).desc()).limit(5)
        
        top_ips_res = await db.execute(top_ips_stmt)
        top_ips = [{"ip": r[0], "count": r[1]} for r in top_ips_res.all()]

        # 3. AI Insights
        latest_report_stmt = select(AIReport).order_by(AIReport.timestamp.desc()).limit(1)
        latest_report_res = await db.execute(latest_report_stmt)
        latest_report = latest_report_res.scalars().first()

        # 4. Security Score Calculation
        # Base 100, deduct for alerts: HIGH (-10), MEDIUM (-2)
        score_stmt = select(SecurityAlert.severity, func.count(SecurityAlert.id)).where(
            SecurityAlert.timestamp >= twenty_four_hours_ago
        ).group_by(SecurityAlert.severity)
        score_res = await db.execute(score_stmt)
        severities = {r[0]: r[1] for r in score_res.all()}
        
        deductions = (severities.get("HIGH", 0) * 10) + (severities.get("MEDIUM", 0) * 2)
        security_score = max(0, 100 - deductions)

        return {
            "total_requests": total_24h,
            "threats_detected": threats_24h,
            "security_score": security_score,
            "top_ips": top_ips,
            "latest_ai_report": {
                "summary": latest_report.summary if latest_report else "No AI reports generated yet",
                "threat_level": latest_report.threat_level if latest_report else "low",
                "timestamp": latest_report.timestamp if latest_report else None
            }
        }
    except Exception as e:
        print(f"Stats error: {e}")
        return {
            "total_requests": 0, 
            "threats_detected": 0, 
            "security_score": 100,
            "top_ips": [],
            "latest_ai_report": None
        }

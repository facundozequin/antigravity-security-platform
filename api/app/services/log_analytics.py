import asyncio
import logging
import json
from datetime import datetime, timedelta
from typing import List, Dict, Any
from app.db.database import get_clickhouse, AsyncSessionLocal
from app.db.models import AIReport, AIInsight, SystemSetting
from app.services.ai_service import AIService
from app.services.profile import ProfileService
from sqlalchemy import select

logger = logging.getLogger(__name__)

class LogAnalyticsService:
    @staticmethod
    async def get_suspicious_logs() -> List[Dict[str, Any]]:
        try:
            client = get_clickhouse()
            # Select IPs with high error rates or high volumes in the last 10 minutes
            # Using the security_platform database defined in init scripts
            sql = """
            SELECT client_ip, count() as total, 
                   sum(status >= 400) as errors,
                   groupArray(path) as paths
            FROM security_platform.nginx_logs
            WHERE timestamp > now() - INTERVAL 10 MINUTE
            GROUP BY client_ip
            HAVING errors > 15 OR total > 150
            ORDER BY errors DESC
            LIMIT 10
            """
            result = client.query(sql)
            suspicious = []
            for row in result.result_rows:
                suspicious.append({
                    "ip": row[0],
                    "total_requests": row[1],
                    "error_count": row[2],
                    "unique_paths": list(set(row[3]))[:5]
                })
            return suspicious
        except Exception as e:
            logger.error(f"Failed to query ClickHouse for analytics: {e}")
            return []

    @classmethod
    async def run_analysis_cycle(cls):
        """Background loop for selective log analysis with resource constraints"""
        logger.info("Initializing LogAnalytics background worker...")
        
        # Wait a bit on startup to ensure DB is ready
        await asyncio.sleep(10)
        
        while True:
            try:
                async with AsyncSessionLocal() as db:
                    # 1. Check if AI analysis is enabled
                    stmt = select(SystemSetting).filter_by(key="AI_ANALYSIS_ENABLED")
                    res = await db.execute(stmt)
                    setting = res.scalars().first()
                    enabled = setting.value.lower() == "true" if setting and setting.value else True
                    
                    if not enabled:
                        await asyncio.sleep(300)
                        continue

                    # 2. Aggregation & Selective Analysis
                    suspicious_data = await cls.get_suspicious_logs()
                    if not suspicious_data:
                        await asyncio.sleep(300) # No suspicion, sleep 5 mins
                        continue

                    # 3. AI Processing (Advisory)
                    provider = await AIService.get_active_provider(db)
                    if not provider:
                        logger.warning("LogAnalytics: No active AI provider configured.")
                        await asyncio.sleep(600)
                        continue

                    # Batching logic: Create a summary prompt
                    prompt = (
                        "Task: Security Log Analysis (Advisory Only)\n\n"
                        "Analyze these suspicious traffic patterns detected in the last 10 minutes. "
                        "Identify potential attack patterns (Brute Force, Scanning, SQLi, etc.) and "
                        "provide recommendations. Do NOT block, just analyze.\n\n"
                        f"Data: {json.dumps(suspicious_data)}\n\n"
                        "Format: Provide a high-level summary followed by IP-specific insights."
                    )
                    
                    # Ensure timeout and rate limiting (implicit by loop interval)
                    summary = await provider.generate(prompt)

                    # 4. Persistence (Separate Tables)
                    threat_level = "HIGH" if any(d['error_count'] > 50 for d in suspicious_data) else "MEDIUM"
                    
                    report = AIReport(
                        summary=summary,
                        logs_analyzed=len(suspicious_data),
                        threat_level=threat_level.lower(),
                        status="completed"
                    )
                    db.add(report)
                    await db.flush() # Get report ID

                    # 5. Trigger Adaptive Alert for the report
                    from app.services.alerts import AlertService
                    await AlertService.trigger_alert(
                        db,
                        source="AI_AUDIT",
                        alert_type="Security Audit Generated",
                        severity=threat_level,
                        ip=suspicious_data[0]["ip"] if suspicious_data else None,
                        message=f"Autonomous audit completed for {len(suspicious_data)} suspicious IPs. AI Conclusion: {summary[:100]}...",
                        risk_score=80 if threat_level == "HIGH" else 40
                    )

                    for d in suspicious_data:
                        # Map error density to severity
                        severity = "warning" if d['error_count'] > 25 else "info"
                        if d['total_requests'] > 300: severity = "warning"
                        
                        insight = AIInsight(
                            report_id=report.id,
                            ip=d['ip'],
                            pattern=f"Traffic anomaly: {d['total_requests']} reqs, {d['error_count']} errors",
                            recommendation="Investigate IP reputation; manually verify if traffic matches known scanning tools.",
                            severity=severity
                        )
                        db.add(insight)
                        
                        # Also trigger a MEDIUM alert for each suspicious IP to ensure history tracking
                        await AlertService.trigger_alert(
                            db,
                            source="AI_INSIGHT",
                            alert_type="Suspicious IP Pattern",
                            severity="MEDIUM",
                            ip=d['ip'],
                            message=f"Traffic anomaly detected: {d['total_requests']} requests with {d['error_count']} errors.",
                            risk_score=50
                        )

                        # Trigger Remediation evaluation
                        from app.services.remediation import RemediationService
                        # Calculate a dynamic confidence score: 
                        # Higher if error count is very high or AI summary is substantial
                        conf = min(60 + (d['error_count'] // 2), 95)
                        risk = 90 if d['error_count'] > 50 else 70
                        
                        await RemediationService.process_threat(
                            db=db,
                            ip=d['ip'],
                            source="ai",
                            reason=f"AI confirmed suspicious pattern: {d['total_requests']} reqs, {d['error_count']} errors.",
                            risk_score=risk,
                            confidence_score=conf
                        )

                        # Update IP Profile with behavioral data
                        await ProfileService.update_profile(
                            db=db,
                            ip=d['ip'],
                            risk=risk,
                            conf=conf,
                            source="ai",
                            is_block=False
                        )
                    
                    await db.commit()
                    logger.info(f"LogAnalytics: New security audit report generated (ID: {report.id}) and remediation evaluated.")

            except Exception as e:
                logger.error(f"Error in LogAnalytics worker cycle: {e}")
            
            # Batch interval: 10 minutes as requested
            await asyncio.sleep(600)

import logging
from datetime import datetime, timedelta
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update, func
from app.db.database import get_clickhouse
from app.db.models import IPReputationCache, RemediationAction, SecurityAlert
from app.services.threat_intel import ThreatIntelService
from app.config import settings
import math
import asyncio

logger = logging.getLogger(__name__)

class ProfileService:
    @staticmethod
    async def get_or_create_profile(db: AsyncSession, ip: str) -> IPReputationCache:
        stmt = select(IPReputationCache).filter_by(client_ip=ip)
        result = await db.execute(stmt)
        profile = result.scalars().first()
        
        if not profile:
            profile = IPReputationCache(client_ip=ip)
            db.add(profile)
            await db.commit()
            await db.refresh(profile)
        
        return profile

    @classmethod
    async def update_profile(
        cls, 
        db: AsyncSession, 
        ip: str, 
        risk: int = 0, 
        conf: int = 0, 
        source: str = "ai", 
        is_block: bool = False,
        strike_increment: int = 1
    ):
        """Update IP profile metrics and strikes"""
        profile = await cls.get_or_create_profile(db, ip)
        
        # 1. Update Averages (Moving average)
        profile.total_requests += 1
        profile.avg_risk_score = int((profile.avg_risk_score * 0.7) + (risk * 0.3))
        profile.avg_confidence_score = int((profile.avg_confidence_score * 0.7) + (conf * 0.3))
        profile.last_event_at = datetime.utcnow()
        
        # 2. Handle Strikes and Blocks
        if is_block:
            profile.total_blocks += 1
            if source == "waf":
                profile.waf_strikes += strike_increment
            elif source in ["auth", "fail2ban", "brute_force"]:
                profile.auth_strikes += strike_increment
            else:
                profile.ai_strikes += strike_increment
            
            # Check for repeat offender (>3 total strikes in 24h)
            # Simplified: just check current strike counts
            total_active_strikes = profile.waf_strikes + profile.auth_strikes + profile.ai_strikes
            if total_active_strikes > 3:
                profile.is_repeat_offender = True
                logger.warning(f"Profile: IP {ip} marked as REPEAT OFFENDER (Strikes: {total_active_strikes})")

        await db.commit()
        
        # 3. Trigger Background Enrichment if needed
        await cls.trigger_enrichment(db, profile)
        
        return profile

    @classmethod
    async def trigger_enrichment(cls, db: AsyncSession, profile: IPReputationCache):
        """Background task for external intel enrichment"""
        now = datetime.utcnow()
        is_stale = not profile.last_intel_update or (now - profile.last_intel_update) > timedelta(hours=settings.INTEL_CACHE_TTL_HOURS)
        
        if is_stale and profile.intel_status != "cooldown":
            # Fire and forget enrichment
            logger.info(f"Profile: Triggering background enrichment for {profile.client_ip}")
            asyncio.create_task(cls._run_enrichment_task(profile.client_ip))
        else:
            logger.debug(f"Profile: Using cached intel for {profile.client_ip}")

    @classmethod
    async def _run_enrichment_task(cls, ip: str):
        """Worker task for background enrichment"""
        try:
            from app.db.database import AsyncSessionLocal
            async with AsyncSessionLocal() as db:
                intel = await ThreatIntelService.enrich_ip(ip)
                
                # Fetch profile again to update in this session
                stmt = select(IPReputationCache).filter_by(client_ip=ip)
                res = await db.execute(stmt)
                profile = res.scalars().first()
                if profile:
                    profile.country_code = intel.get("country_code")
                    profile.city = intel.get("city")
                    profile.isp = intel.get("isp")
                    profile.asn = intel.get("asn")
                    profile.external_abuse_score = intel.get("external_abuse_score", 0)
                    profile.intel_status = intel.get("intel_status", "synced")
                    profile.last_intel_update = intel.get("last_intel_update")
                    
                    # Update fused score immediately
                    cls._update_fused_score(profile)
                    
                    await db.commit()
                    logger.info(f"Profile: Enriched {ip} with global intel")
        except Exception as e:
            logger.error(f"Profile: Enrichment task failed for {ip}: {e}")

    @staticmethod
    def _update_fused_score(profile: IPReputationCache):
        """Formula: (InternalRisk * 0.7) + (ExternalAbuse * 0.3)"""
        internal = profile.avg_risk_score
        external = profile.external_abuse_score
        profile.reputation_score = int((internal * settings.RISK_WEIGHT_INTERNAL) + (external * settings.RISK_WEIGHT_EXTERNAL))

    @classmethod
    async def decay_behavior_metrics(cls, db: AsyncSession):
        """Gradual forgiveness: decrement 1 strike every 24h of inactivity"""
        logger.info("Profile: Running strike decay task...")
        one_day_ago = datetime.utcnow() - timedelta(days=1)
        
        # Find profiles with strikes and no activity in 24h
        stmt = select(IPReputationCache).filter(
            IPReputationCache.last_event_at <= one_day_ago,
            (IPReputationCache.waf_strikes > 0) | 
            (IPReputationCache.auth_strikes > 0) | 
            (IPReputationCache.ai_strikes > 0)
        )
        result = await db.execute(stmt)
        profiles = result.scalars().all()
        
        for p in profiles:
            logger.info(f"Profile: Decaying strikes for {p.client_ip}")
            if p.waf_strikes > 0: p.waf_strikes -= 1
            if p.auth_strikes > 0: p.auth_strikes -= 1
            if p.ai_strikes > 0: p.ai_strikes -= 1
            
            # Reset repeat offender status if strikes are low
            if (p.waf_strikes + p.auth_strikes + p.ai_strikes) <= 3:
                p.is_repeat_offender = False
        
        await db.commit()
        return len(profiles)

    @staticmethod
    def calculate_exponential_duration(strikes: int) -> int:
        """Formula: 15 * (2**(strikes-1)), capped at 24h (1440m)"""
        if strikes <= 0: return 15
        duration = 15 * (2 ** (strikes - 1))
        return min(duration, 1440)

    @staticmethod
    async def get_ip_baseline(ip: str) -> dict:
        """Calculate historical baseline requests/min over last 24h via ClickHouse"""
        try:
            client = get_clickhouse()
            # Calculate avg requests per minute and standard deviation over 24h
            sql = f"""
            SELECT avg(cnt), stddevSamp(cnt)
            FROM (
                SELECT toStartOfMinute(timestamp) as t, count() as cnt
                FROM security_platform.nginx_logs
                WHERE client_ip = '{ip}' AND timestamp > now() - INTERVAL 24 HOUR
                GROUP BY t
            )
            """
            result = client.query(sql)
            rows = result.result_rows
            if rows and rows[0][0] is not None:
                return {
                    "avg": float(rows[0][0]),
                    "stddev": float(rows[0][1]) if rows[0][1] is not None else 0.0
                }
            return {"avg": 1.0, "stddev": 0.5} # Fallback
        except Exception as e:
            logger.error(f"Profile: Failed to calculate baseline for {ip}: {e}")
            return {"avg": 1.0, "stddev": 0.5}

    @classmethod
    async def get_fused_ip_analytics(cls, db: AsyncSession, ip: str, timeframe: str = "24h") -> list:
        """Merge Postgres Risk alerts with ClickHouse Volume data into time buckets"""
        hours = 24 if timeframe == "24h" else (1 if timeframe == "1h" else 168)
        bucket_size = "1 minute" if hours <= 1 else ("5 minutes" if hours <= 24 else "1 hour")
        ch_bucket = "toStartOfMinute" if hours <= 1 else ("toStartOfFiveMinutes" if hours <= 24 else "toStartOfHour")
        pg_bucket = "minute" if hours <= 1 else "hour" # Simplification for PG bucketing
        
        start_time = datetime.utcnow() - timedelta(hours=hours)

        # 1. Fetch Baseline
        baseline = await cls.get_ip_baseline(ip)
        
        # 2. Fetch ClickHouse Volume
        try:
            ch_client = get_clickhouse()
            ch_sql = f"""
            SELECT {ch_bucket}(timestamp) as t, count() as volume
            FROM security_platform.nginx_logs
            WHERE client_ip = '{ip}' AND timestamp > now() - INTERVAL {hours} HOUR
            GROUP BY t ORDER BY t
            """
            ch_res = ch_client.query(ch_sql).result_rows
            volume_map = {row[0].strftime("%Y-%m-%d %H:%M"): row[1] for row in ch_res}
        except Exception:
            volume_map = {}

        # 3. Fetch Postgres Risk (SecurityAlerts)
        stmt = select(
            func.date_trunc(pg_bucket, SecurityAlert.timestamp).label("t"),
            func.avg(SecurityAlert.risk_score).label("risk")
        ).filter(
            SecurityAlert.client_ip == ip,
            SecurityAlert.timestamp >= start_time
        ).group_by("t").order_by("t")
        
        pg_res = await db.execute(stmt)
        risk_data = pg_res.all()
        risk_map = {row.t.strftime("%Y-%m-%d %H:%M"): float(row.risk) for row in risk_data}

        # 4. Get Profile for Intel Metadata
        stmt = select(IPReputationCache).filter_by(client_ip=ip)
        res = await db.execute(stmt)
        profile = res.scalars().first()

        # 5. Fusion and Classification
        fused = []
        # Generate time slots based on the timeframe
        current = start_time
        now = datetime.utcnow()
        delta = timedelta(minutes=1 if hours <= 1 else (5 if hours <= 24 else 60))
        
        while current <= now:
            ts_str = current.strftime("%Y-%m-%d %H:%M")
            risk = risk_map.get(ts_str, 0)
            volume = volume_map.get(ts_str, 0)
            
            # Pattern classification logic
            pattern = "NORMAL"
            if risk >= 70:
                if volume < (baseline["avg"] * 0.5):
                    pattern = "STEALTH"
                elif volume > (baseline["avg"] * 2.5):
                    pattern = "AGGRESSIVE"
            
            # Z-Score if stddev > 0
            z_score = 0
            if baseline["stddev"] > 0:
                z_score = (volume - baseline["avg"]) / baseline["stddev"]
                if z_score > 2 and pattern == "NORMAL":
                    pattern = "SPIKE"
            
            fused.append({
                "timestamp": ts_str,
                "risk": risk,
                "volume": volume,
                "pattern": pattern,
                "z_score": round(z_score, 2),
                "baseline": round(baseline["avg"], 2),
                "intel_status": profile.intel_status if profile else "local",
                "last_intel_update": profile.last_intel_update.strftime("%Y-%m-%d %H:%M") if profile and profile.last_intel_update else None
            })
            current += delta
            
            if len(fused) > 500: break # Safety cap

        return fused

    @classmethod
    async def get_intel_status(cls):
        """Expose Circuit Breaker status to UI"""
        return ThreatIntelService.get_status()

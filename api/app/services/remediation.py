import logging
import asyncio
from datetime import datetime, timedelta
from typing import Optional, List, Dict, Any
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from app.db.models import (
    RemediationAction, 
    RecommendedAction, 
    SecurityWhitelist, 
    SystemSetting,
    SecurityAlert
)
from app.client import agent_client
from app.services.profile import ProfileService
import ipaddress

logger = logging.getLogger(__name__)

class RemediationService:
    PRIVATE_NETWORKS = [
        ipaddress.ip_network("127.0.0.0/8"),
        ipaddress.ip_network("10.0.0.0/8"),
        ipaddress.ip_network("172.16.0.0/12"),
        ipaddress.ip_network("192.168.0.0/16"),
    ]

    @classmethod
    def is_protected_ip(cls, ip_str: str) -> bool:
        """Check if IP is localhost, private, or docker internal"""
        try:
            ip = ipaddress.ip_address(ip_str)
            for network in cls.PRIVATE_NETWORKS:
                if ip in network:
                    return True
            return False
        except ValueError:
            return False

    @staticmethod
    async def is_whitelisted(db: AsyncSession, ip: str) -> bool:
        """Check user-defined whitelist"""
        stmt = select(SecurityWhitelist).filter(SecurityWhitelist.ip_or_cidr == ip)
        result = await db.execute(stmt)
        return result.scalars().first() is not None

    @staticmethod
    async def check_rate_limit(db: AsyncSession) -> bool:
        """Enforce max 5 blocks per minute"""
        one_minute_ago = datetime.utcnow() - timedelta(minutes=1)
        stmt = select(func.count(RemediationAction.id)).filter(
            RemediationAction.created_at >= one_minute_ago,
            RemediationAction.action_type == "BLOCK"
        )
        result = await db.execute(stmt)
        count = result.scalar()
        return (count or 0) < 5

    @classmethod
    async def process_threat(
        self, 
        db: AsyncSession, 
        ip: str, 
        source: str, 
        reason: str, 
        risk_score: int, 
        confidence_score: int
    ):
        """Decision engine with behavioral weighing"""
        if not ip or self.is_protected_ip(ip):
            return

        if await self.is_whitelisted(db, ip):
            return

        # 1. Fetch IP Behavioral Profile
        profile = await ProfileService.get_or_create_profile(db, ip)
        
        # 2. Calculate Weighted Risk (60% Current, 40% History)
        weighted_risk = int((risk_score * 0.6) + (profile.avg_risk_score * 0.4))
        
        # 3. Check for Repeat Offender (Aggressive Threshold)
        effective_threshold = 90
        if profile.is_repeat_offender:
            effective_threshold = 75
            logger.info(f"Remediation: Lowering threshold to {effective_threshold} for Repeat Offender {ip}")

        # 4. Check Settings
        stmt = select(SystemSetting).filter_by(key="EMERGENCY_REMEDIATION_STOP")
        res = await db.execute(stmt)
        if (res.scalars().first() or "").value.lower() == "true":
            return

        stmt = select(SystemSetting).filter_by(key="REMEDIATION_AUTO_BLOCK_ENABLED")
        res = await db.execute(stmt)
        auto_enabled = (res.scalars().first() or "").value.lower() == "true"

        # 5. Automated Decision
        if auto_enabled and weighted_risk >= effective_threshold and confidence_score >= 70:
            if await self.check_rate_limit(db):
                return await self.execute_block(db, ip, reason, source, risk_score, confidence_score)

        return await self.create_recommendation(db, ip, reason, weighted_risk, confidence_score)

    @classmethod
    async def execute_block(
        cls, 
        db: AsyncSession, 
        ip: str, 
        reason: str, 
        source: str, 
        risk: int = 0, 
        conf: int = 0
    ):
        """Execute block with Adaptive Duration and Profiles"""
        try:
            # 1. Update Profile & Strikes
            # Brute force weighting: +2 strikes
            strike_inc = 2 if "brute" in reason.lower() else 1
            profile = await ProfileService.update_profile(
                db, ip, risk=risk, conf=conf, source=source, is_block=True, strike_increment=strike_inc
            )
            
            # 2. Get relevant strike count
            strikes = profile.ai_strikes
            if source == "waf": strikes = profile.waf_strikes
            elif source in ["auth", "fail2ban"]: strikes = profile.auth_strikes
            
            # 3. Calculate Exponential Duration
            duration = ProfileService.calculate_exponential_duration(strikes)
            
            logger.info(f"Remediation: Adaptive BLOCK on {ip} for {duration}m (Strikes: {strikes}). Reason: {reason}")
            
            # 4. Call Agent
            agent_client.ban_ip(ip, f"[ADAPTIVE-{source.upper()}] {reason}")
            
            # 5. Log Action
            expires_at = datetime.utcnow() + timedelta(minutes=duration)
            action = RemediationAction(
                ip=ip,
                source=source,
                reason=reason,
                duration_mins=duration,
                strike_count=strikes,
                expires_at=expires_at,
                is_active=True
            )
            db.add(action)
            await db.commit()
            return action
        except Exception as e:
            logger.error(f"Remediation: Adaptive block failed on {ip}: {e}")
            return None

    @staticmethod
    async def create_recommendation(db: AsyncSession, ip: str, reason: str, risk: int, conf: int):
        """Create a recommended action for the UI"""
        # Check if one already exists for this IP
        stmt = select(RecommendedAction).filter_by(ip=ip, status="PENDING")
        res = await db.execute(stmt)
        if res.scalars().first():
            return None

        rec = RecommendedAction(
            ip=ip,
            description=reason,
            risk_score=risk,
            confidence_score=conf,
            status="PENDING"
        )
        db.add(rec)
        await db.commit()
        logger.info(f"Remediation: Created recommendation for {ip} (Risk: {risk}, Conf: {conf})")
        return rec

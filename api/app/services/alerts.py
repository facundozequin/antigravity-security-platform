import httpx
from typing import Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, func
from app.db.models import SystemSetting, SecurityAlert
import logging
from datetime import datetime, timedelta

logger = logging.getLogger(__name__)

class AlertService:
    @staticmethod
    async def get_setting(db: AsyncSession, key: str) -> Optional[str]:
        result = await db.execute(select(SystemSetting).filter_by(key=key))
        setting = result.scalars().first()
        return setting.value if setting else None

    @classmethod
    async def trigger_alert(cls, db: AsyncSession, source: str, alert_type: str, severity: str, ip: str, message: str, risk_score: int = 0):
        # 1. Store/Update in SecurityAlert Table
        # Check for aggregation (same IP, same type, within last 10 minutes)
        ten_mins_ago = datetime.utcnow() - timedelta(minutes=10)
        stmt = select(SecurityAlert).where(
            and_(
                SecurityAlert.client_ip == ip,
                SecurityAlert.type == alert_type,
                SecurityAlert.last_seen >= ten_mins_ago
            )
        )
        result = await db.execute(stmt)
        existing_alert = result.scalars().first()

        if existing_alert:
            existing_alert.count += 1
            existing_alert.last_seen = datetime.utcnow()
            event = existing_alert
        else:
            event = SecurityAlert(
                source=source,
                type=alert_type,
                severity=severity,
                client_ip=ip,
                message=message,
                risk_score=risk_score,
                count=1
            )
            db.add(event)
        
        await db.commit()
        await db.refresh(event)

        # 2. Notification Rules
        should_notify = False
        
        if severity == "HIGH":
            # HIGH: Always trigger immediate notification (subject to 5m throttle)
            should_notify = True
        elif severity == "MEDIUM":
            # MEDIUM: Notify if 3+ times in current window
            if event.count >= 3:
                should_notify = True
        elif severity == "LOW":
            # LOW: Never notify
            should_notify = False

        if should_notify:
            # 3. Throttling (Max 1 alert per IP every 5 minutes)
            five_mins_ago = datetime.utcnow() - timedelta(minutes=5)
            # Check if we SENT a notification for this IP in last 5 mins
            throttle_stmt = select(SecurityAlert).where(
                and_(
                    SecurityAlert.client_ip == ip,
                    SecurityAlert.notified == True,
                    SecurityAlert.timestamp >= five_mins_ago
                )
            )
            throttle_res = await db.execute(throttle_stmt)
            already_notified = throttle_res.scalars().first()

            if not already_notified:
                # 4. Send Telegram
                content = f"⚠️ *{event.type} Detected* ({event.count} events)\n"
                content += f"📍 *IP:* `{event.client_ip}`\n"
                content += f"🔥 *Risk Score:* `{event.risk_score}`\n"
                content += f"📄 *Reason:* {event.message}"
                
                success = await cls.send_telegram_alert(content, db)
                if success:
                    event.notified = True
                    await db.commit()

    @classmethod
    async def send_telegram_alert(cls, content: str, db: AsyncSession) -> bool:
        token = await cls.get_setting(db, "TELEGRAM_BOT_TOKEN")
        chat_id = await cls.get_setting(db, "TELEGRAM_CHAT_ID")
        enabled = await cls.get_setting(db, "TELEGRAM_ALERTS_ENABLED")

        if not enabled or enabled.lower() != "true" or not token or not chat_id:
            return False

        url = f"https://api.telegram.org/bot{token}/sendMessage"
        payload = {
            "chat_id": chat_id,
            "text": f"🛡️ *Antigravity SOC Alert*\n\n{content}",
            "parse_mode": "Markdown"
        }

        async with httpx.AsyncClient() as client:
            try:
                resp = await client.post(url, json=payload)
                return resp.status_code == 200
            except Exception as e:
                logger.error(f"Failed to send telegram alert: {e}")
                return False

    @classmethod
    async def notify_waf_block(cls, ip: str, rule: str, risk_score: int, db: AsyncSession):
        await cls.trigger_alert(db, "WAF", "Web Attack", "HIGH", ip, f"Security rule triggered: {rule}", risk_score)

    @classmethod
    async def notify_fail2ban_ban(cls, ip: str, jail: str, db: AsyncSession):
        await cls.trigger_alert(db, "Fail2Ban", "IP Banned", "MEDIUM", ip, f"Repeated failures in jail: {jail}", 50)

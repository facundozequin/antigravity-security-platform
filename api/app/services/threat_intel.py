import logging
import httpx
import asyncio
from datetime import datetime, timedelta
from typing import Optional, Dict, Any
from app.config import settings

logger = logging.getLogger(__name__)

class IntelStatus:
    ACTIVE = "active"
    DISABLED = "disabled"
    COOLDOWN = "cooldown"
    ERROR = "error"

class BaseIntelProvider:
    def __init__(self, name: str):
        self.name = name
        self.failures = 0
        self.last_failure_at: Optional[datetime] = None
        self.status = IntelStatus.ACTIVE
        
    def _check_circuit_breaker(self):
        if self.status == IntelStatus.COOLDOWN:
            if datetime.utcnow() > self.last_failure_at + timedelta(minutes=settings.CIRCUIT_BREAKER_COOLDOWN_MINUTES):
                logger.info(f"Intel: Circuit Breaker RESET for {self.name}")
                self.status = IntelStatus.ACTIVE
                self.failures = 0
            else:
                return False
        return self.status == IntelStatus.ACTIVE

    def _record_failure(self):
        self.failures += 1
        self.last_failure_at = datetime.utcnow()
        logger.warning(f"Intel: Provider {self.name} failure ({self.failures}/{settings.CIRCUIT_BREAKER_THRESHOLD})")
        
        if self.failures >= settings.CIRCUIT_BREAKER_THRESHOLD:
            self.status = IntelStatus.COOLDOWN
            logger.error(f"Intel: Circuit Breaker TRIPPED for {self.name}. Cooldown: {settings.CIRCUIT_BREAKER_COOLDOWN_MINUTES}m")

    def _record_success(self):
        if self.failures > 0:
            logger.info(f"Intel: Provider {self.name} recovered after {self.failures} failures")
        self.failures = 0
        self.status = IntelStatus.ACTIVE

class AbuseIPDBProvider(BaseIntelProvider):
    def __init__(self):
        super().__init__("AbuseIPDB")
        self.api_key = settings.ABUSEIPDB_API_KEY
        if not self.api_key:
            self.status = IntelStatus.DISABLED
            logger.warning("Intel: AbuseIPDB disabled (Missing API Key)")

    async def fetch(self, ip: str) -> Optional[Dict[str, Any]]:
        if not self._check_circuit_breaker():
            return None
            
        url = "https://api.abuseipdb.com/api/v2/check"
        headers = {
            "Accept": "application/json",
            "Key": self.api_key
        }
        params = {
            "ipAddress": ip,
            "maxAgeInDays": 90
        }

        try:
            start_time = datetime.utcnow()
            async with httpx.AsyncClient(timeout=settings.INTEL_TIMEOUT_SECONDS) as client:
                response = await client.get(url, headers=headers, params=params)
                latency = (datetime.utcnow() - start_time).total_seconds()
                
                if response.status_code == 200:
                    self._record_success()
                    data = response.json().get("data", {})
                    logger.debug(f"Intel: AbuseIPDB success for {ip} ({latency:.2f}s)")
                    return {
                        "abuse_score": data.get("abuseConfidenceScore", 0),
                        "total_reports": data.get("totalReports", 0),
                        "last_reported_at": data.get("lastReportedAt")
                    }
                else:
                    logger.error(f"Intel: AbuseIPDB API error {response.status_code}: {response.text}")
                    self._record_failure()
                    return None
        except Exception as e:
            logger.error(f"Intel: AbuseIPDB request failed: {e}")
            self._record_failure()
            return None

class GeoIPProvider(BaseIntelProvider):
    def __init__(self):
        super().__init__("GeoIP")

    async def fetch(self, ip: str) -> Optional[Dict[str, Any]]:
        if not self._check_circuit_breaker():
            return None

        # Using ip-api.com (Free tier: 45 req/min)
        url = f"http://ip-api.com/json/{ip}?fields=status,message,countryCode,city,isp,as,mobile,proxy,hosting"
        
        try:
            start_time = datetime.utcnow()
            async with httpx.AsyncClient(timeout=settings.INTEL_TIMEOUT_SECONDS) as client:
                response = await client.get(url)
                latency = (datetime.utcnow() - start_time).total_seconds()
                
                if response.status_code == 200:
                    data = response.json()
                    if data.get("status") == "success":
                        self._record_success()
                        logger.debug(f"Intel: GeoIP success for {ip} ({latency:.2f}s)")
                        return {
                            "country_code": data.get("countryCode"),
                            "city": data.get("city"),
                            "isp": data.get("isp"),
                            "asn": data.get("as"),
                            "is_datacenter": data.get("hosting", False) or data.get("proxy", False)
                        }
                    else:
                        logger.error(f"Intel: ip-api error: {data.get('message')}")
                        return None
                else:
                    self._record_failure()
                    return None
        except Exception as e:
            logger.error(f"Intel: GeoIP request failed: {e}")
            self._record_failure()
            return None

class ThreatIntelService:
    _abuse_provider = AbuseIPDBProvider()
    _geo_provider = GeoIPProvider()

    @classmethod
    def get_status(cls):
        return {
            "abuseipdb": cls._abuse_provider.status,
            "geoip": cls._geo_provider.status
        }

    @classmethod
    async def enrich_ip(cls, ip: str) -> Dict[str, Any]:
        """Orchestrate async enrichment from providers"""
        logger.info(f"Intel: Starting enrichment for {ip}")
        
        # Run concurrently for speed
        results = await asyncio.gather(
            cls._abuse_provider.fetch(ip),
            cls._geo_provider.fetch(ip),
            return_exceptions=True
        )
        
        abuse_data = results[0] if isinstance(results[0], dict) else {}
        geo_data = results[1] if isinstance(results[1], dict) else {}
        
        return {
            "country_code": geo_data.get("country_code"),
            "city": geo_data.get("city"),
            "isp": geo_data.get("isp"),
            "asn": geo_data.get("asn"),
            "external_abuse_score": abuse_data.get("abuse_score", 0),
            "is_datacenter": geo_data.get("is_datacenter", False),
            "intel_status": "synced" if (abuse_data or geo_data) else "error",
            "last_intel_update": datetime.utcnow()
        }

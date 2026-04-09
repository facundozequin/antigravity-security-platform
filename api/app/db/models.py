from sqlalchemy import Column, Integer, String, Boolean, Text, ForeignKey, DateTime
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.db.database import Base

class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, index=True, nullable=False)
    email = Column(String, unique=True, index=True, nullable=False)
    hashed_password = Column(String, nullable=False)
    role = Column(String, default="viewer") # admin, operator, viewer
    created_at = Column(DateTime(timezone=True), server_default=func.now())

class NginxConfig(Base):
    __tablename__ = "nginx_configs"
    id = Column(Integer, primary_key=True, index=True)
    domain = Column(String, unique=True, index=True, nullable=False)
    target_url = Column(String, nullable=False)
    port = Column(Integer, default=80)
    ssl_enabled = Column(Boolean, default=False)
    custom_config = Column(Text, nullable=True)
    enabled = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

class WafRule(Base):
    __tablename__ = "waf_rules"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, index=True, nullable=False)
    rule_content = Column(Text, nullable=False)
    enabled = Column(Boolean, default=True)

class Fail2BanJail(Base):
    __tablename__ = "fail2ban_jails"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, index=True, nullable=False)
    log_path = Column(String, nullable=False)
    maxretry = Column(Integer, default=5)
    findtime = Column(Integer, default=600)
    bantime = Column(Integer, default=3600)
    enabled = Column(Boolean, default=True)

class AIProviderConfig(Base):
    __tablename__ = "ai_providers"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False) # e.g. "Ollama", "OpenAI"
    provider_type = Column(String, nullable=False) # "ollama", "openai", "gemini"
    api_key = Column(String, nullable=True)
    model = Column(String, nullable=False)
    endpoint_url = Column(String, nullable=True)
    is_active = Column(Boolean, default=False)

class SystemSetting(Base):
    __tablename__ = "system_settings"
    key = Column(String, primary_key=True, index=True)
    value = Column(String, nullable=False)
    description = Column(String, nullable=True)

class IPReputationCache(Base):
    __tablename__ = "ip_reputation_cache"
    client_ip = Column(String, primary_key=True, index=True)
    reputation_score = Column(Integer, default=0)
    classification = Column(String, nullable=True)
    provider_data = Column(Text, nullable=True) # JSON
    total_requests = Column(Integer, default=0)
    total_blocks = Column(Integer, default=0)
    avg_risk_score = Column(Integer, default=0)
    avg_confidence_score = Column(Integer, default=0)
    waf_strikes = Column(Integer, default=0)
    auth_strikes = Column(Integer, default=0)
    ai_strikes = Column(Integer, default=0)
    is_repeat_offender = Column(Boolean, default=False)
    
    # Phase 19: External Intel
    country_code = Column(String(5), nullable=True)
    city = Column(String(100), nullable=True)
    isp = Column(String(255), nullable=True)
    asn = Column(String(50), nullable=True)
    external_abuse_score = Column(Integer, default=0)
    intel_status = Column(String, default="local") # local, synced, cooldown, error
    last_intel_update = Column(DateTime(timezone=True), nullable=True)
    
    last_event_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), index=True)

class AIReport(Base):
    __tablename__ = "ai_reports"
    id = Column(Integer, primary_key=True, index=True)
    timestamp = Column(DateTime(timezone=True), server_default=func.now(), index=True)
    summary = Column(Text, nullable=False)
    threat_level = Column(String, default="low") # low, medium, high
    logs_analyzed = Column(Integer, default=0)
    status = Column(String, default="completed")

class AIInsight(Base):
    __tablename__ = "ai_insights"
    id = Column(Integer, primary_key=True, index=True)
    report_id = Column(Integer, ForeignKey("ai_reports.id"))
    ip = Column(String, index=True)
    pattern = Column(String, nullable=True)
    recommendation = Column(Text, nullable=True)
    severity = Column(String, default="info")

class SecurityAlert(Base):
    __tablename__ = "security_alerts"
    id = Column(Integer, primary_key=True, index=True)
    timestamp = Column(DateTime(timezone=True), server_default=func.now(), index=True)
    source = Column(String, nullable=False) # WAF, Fail2Ban, AI
    type = Column(String, nullable=False) # e.g. SQLi, Brute Force
    severity = Column(String, nullable=False) # LOW, MEDIUM, HIGH
    client_ip = Column(String, index=True, nullable=True)
    message = Column(Text, nullable=False)
    count = Column(Integer, default=1)
    risk_score = Column(Integer, default=0)
    notified = Column(Boolean, default=False) # Whether it was sent to Telegram
    last_seen = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

class SecurityWhitelist(Base):
    __tablename__ = "security_whitelist"
    id = Column(Integer, primary_key=True, index=True)
    ip_or_cidr = Column(String, unique=True, index=True, nullable=False)
    comment = Column(String, nullable=True)
    added_at = Column(DateTime(timezone=True), server_default=func.now())

class RemediationAction(Base):
    __tablename__ = "remediation_actions"
    id = Column(Integer, primary_key=True, index=True)
    ip = Column(String, index=True, nullable=False)
    action_type = Column(String, default="BLOCK")
    source = Column(String, nullable=False) # waf, fail2ban, ai
    reason = Column(String, nullable=False)
    duration_mins = Column(Integer, default=15)
    strike_count = Column(Integer, default=1)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    expires_at = Column(DateTime(timezone=True), nullable=True)
    is_active = Column(Boolean, default=True)

class RecommendedAction(Base):
    __tablename__ = "recommended_actions"
    id = Column(Integer, primary_key=True, index=True)
    ip = Column(String, index=True, nullable=False)
    action_type = Column(String, default="BLOCK")
    description = Column(Text, nullable=False)
    risk_score = Column(Integer, default=0)
    confidence_score = Column(Integer, default=0)
    status = Column(String, default="PENDING") # PENDING, APPROVED, REJECTED
    created_at = Column(DateTime(timezone=True), server_default=func.now())

class SecurityReport(Base):
    __tablename__ = "security_reports"

    id = Column(Integer, primary_key=True, index=True)
    report_type = Column(String) # daily, weekly, monthly, manual
    status = Column(String, default="pending") # pending, ready, failed
    file_path = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    ai_summary = Column(Text, nullable=True)
    stats_json = Column(JSON, nullable=True) # Aggregated stats (top IPs, etc)

class ReportSchedule(Base):
    __tablename__ = "report_schedules"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    report_type = Column(String)
    frequency = Column(String) # Cron expression
    is_active = Column(Boolean, default=True)
    config = Column(JSON, nullable=True) # Filters, recipients, etc
    last_run = Column(DateTime, nullable=True)
    next_run = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

CREATE DATABASE IF NOT EXISTS security_platform;

CREATE TABLE IF NOT EXISTS security_platform.nginx_logs (
    timestamp DateTime,
    client_ip String,
    method String,
    path String,
    status UInt16,
    size UInt32,
    referer String,
    user_agent String,
    request_time Float32
) ENGINE = MergeTree()
ORDER BY (timestamp, client_ip);

CREATE TABLE IF NOT EXISTS security_platform.waf_events (
    timestamp DateTime,
    client_ip String,
    uri String,
    rule_id UInt32,
    msg String,
    severity String,
    data String
) ENGINE = MergeTree()
ORDER BY (timestamp, rule_id);

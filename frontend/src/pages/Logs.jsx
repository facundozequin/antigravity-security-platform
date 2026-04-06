import React, { useState, useEffect, useRef } from 'react';
import { api } from '../services/api';

const SOURCES = ['all', 'nginx-access', 'nginx-error', 'modsecurity', 'fail2ban'];

const MOCK_LOGS = [
    { timestamp: new Date().toISOString(), source: 'nginx-access', level: 'INFO', message: '192.168.1.1 - GET /api/users 200 0.023s' },
    { timestamp: new Date(Date.now() - 1000).toISOString(), source: 'modsecurity', level: 'WARN', message: '[id "942100"] SQL injection attempt blocked from 103.21.244.0' },
    { timestamp: new Date(Date.now() - 2000).toISOString(), source: 'fail2ban', level: 'INFO', message: 'Ban 185.220.101.21 (nginx-botsearch)' },
    { timestamp: new Date(Date.now() - 3000).toISOString(), source: 'nginx-error', level: 'ERROR', message: '2026/04/06 11:00:01 [error] 500 upstream timed out' },
    { timestamp: new Date(Date.now() - 4000).toISOString(), source: 'nginx-access', level: 'INFO', message: '10.0.0.5 - POST /login 401 0.005s' },
    { timestamp: new Date(Date.now() - 5000).toISOString(), source: 'modsecurity', level: 'CRITICAL', message: '[id "941100"] XSS attempt detected from 45.33.32.156' },
    { timestamp: new Date(Date.now() - 6000).toISOString(), source: 'nginx-access', level: 'INFO', message: '10.0.0.1 - GET /health 200 0.001s' },
    { timestamp: new Date(Date.now() - 7000).toISOString(), source: 'fail2ban', level: 'INFO', message: 'Unban 192.99.15.44' },
];

const LEVEL_COLORS = {
    INFO: 'var(--text-secondary)',
    WARN: 'var(--warning)',
    ERROR: 'var(--error)',
    CRITICAL: '#ff4444',
};

const SOURCE_COLORS = {
    'nginx-access': '#6366f1',
    'nginx-error': '#ef4444',
    'modsecurity': '#f59e0b',
    'fail2ban': '#10b981',
};

export default function Logs() {
    const [logs, setLogs] = useState([]);
    const [source, setSource] = useState('all');
    const [search, setSearch] = useState('');
    const [loading, setLoading] = useState(true);
    const [autoScroll, setAutoScroll] = useState(true);
    const [paused, setPaused] = useState(false);
    const bottomRef = useRef(null);

    useEffect(() => {
        const fetchLogs = async () => {
            try {
                const data = await api.getLogs(1, { source }).catch(() => MOCK_LOGS);
                setLogs(Array.isArray(data) ? data : data.logs || MOCK_LOGS);
            } finally {
                setLoading(false);
            }
        };
        fetchLogs();
    }, [source]);

    // Simulate live streaming
    useEffect(() => {
        if (paused) return;
        const SAMPLES = [
            { source: 'nginx-access', level: 'INFO', message: () => `${randomIp()} - GET /api/data ${randomStatus()} ${(Math.random() * 0.1).toFixed(3)}s` },
            { source: 'fail2ban', level: 'WARN', message: () => `Ban ${randomIp()} (nginx-http-auth)` },
            { source: 'modsecurity', level: 'WARN', message: () => `[id "942100"] Suspicious request from ${randomIp()}` },
            { source: 'nginx-error', level: 'ERROR', message: () => `upstream connect error from ${randomIp()}` },
        ];
        const interval = setInterval(() => {
            const sample = SAMPLES[Math.floor(Math.random() * SAMPLES.length)];
            const newLog = { timestamp: new Date().toISOString(), source: sample.source, level: sample.level, message: sample.message() };
            setLogs(prev => [...prev.slice(-200), newLog]);
        }, 2000);
        return () => clearInterval(interval);
    }, [paused]);

    useEffect(() => {
        if (autoScroll && bottomRef.current) {
            bottomRef.current.scrollIntoView({ behavior: 'smooth' });
        }
    }, [logs, autoScroll]);

    const randomIp = () => `${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}`;
    const randomStatus = () => [200, 200, 200, 304, 401, 403, 404, 500][Math.floor(Math.random() * 8)];

    const filtered = logs.filter(log =>
        (source === 'all' || log.source === source) &&
        (search === '' || log.message.toLowerCase().includes(search.toLowerCase()))
    );

    const exportLogs = () => {
        const content = filtered.map(l => `[${l.timestamp}] [${l.source}] [${l.level}] ${l.message}`).join('\n');
        const blob = new Blob([content], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a'); a.href = url; a.download = 'logs.txt'; a.click();
    };

    if (loading) return <div className="loading"><div className="spinner"></div></div>;

    return (
        <div>
            <h1 className="page-title"><span className="icon">📝</span> Logs Centralizados</h1>

            {/* Toolbar */}
            <div style={{ display: 'flex', gap: '12px', marginBottom: '16px', flexWrap: 'wrap', alignItems: 'center' }}>
                <select value={source} onChange={e => setSource(e.target.value)} style={{ padding: '8px 14px', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--bg-secondary)', color: 'var(--text-primary)', fontSize: '0.9rem' }}>
                    {SOURCES.map(s => <option key={s} value={s}>{s === 'all' ? 'Todas las fuentes' : s}</option>)}
                </select>
                <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar en logs..." style={{ flex: 1, minWidth: '200px', padding: '8px 14px', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--bg-secondary)', color: 'var(--text-primary)', fontSize: '0.9rem' }} />
                <button onClick={() => setPaused(p => !p)} style={{ padding: '8px 16px', borderRadius: '8px', border: `1px solid ${paused ? 'var(--success)' : 'var(--warning)'}`, background: 'transparent', color: paused ? 'var(--success)' : 'var(--warning)', cursor: 'pointer', fontWeight: 500 }}>
                    {paused ? '▶ Reanudar' : '⏸ Pausar'}
                </button>
                <button onClick={() => setAutoScroll(a => !a)} style={{ padding: '8px 16px', borderRadius: '8px', border: '1px solid var(--border-color)', background: autoScroll ? 'var(--accent-primary)' : 'transparent', color: 'var(--text-primary)', cursor: 'pointer' }}>
                    Auto-scroll {autoScroll ? 'ON' : 'OFF'}
                </button>
                <button onClick={exportLogs} style={{ padding: '8px 16px', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'transparent', color: 'var(--text-secondary)', cursor: 'pointer' }}>
                    ⬇️ Exportar
                </button>
            </div>

            {/* Log Viewer */}
            <div style={{ background: '#0a0a0f', border: '1px solid var(--border-color)', borderRadius: '12px', height: '600px', overflowY: 'auto', padding: '16px', fontFamily: "'JetBrains Mono', 'Fira Code', monospace", fontSize: '0.8rem', lineHeight: '1.8' }}>
                {filtered.map((log, i) => (
                    <div key={i} style={{ display: 'flex', gap: '12px', padding: '2px 0', borderBottom: '1px solid rgba(255,255,255,0.02)' }}>
                        <span style={{ color: 'var(--text-muted)', flexShrink: 0, fontSize: '0.75rem' }}>
                            {new Date(log.timestamp).toLocaleTimeString()}
                        </span>
                        <span style={{ color: SOURCE_COLORS[log.source] || 'var(--text-secondary)', flexShrink: 0, minWidth: '110px' }}>
                            [{log.source}]
                        </span>
                        <span style={{ color: LEVEL_COLORS[log.level] || 'var(--text-primary)', flexShrink: 0, minWidth: '60px' }}>
                            [{log.level}]
                        </span>
                        <span style={{ color: 'var(--text-primary)', wordBreak: 'break-all' }}>{log.message}</span>
                    </div>
                ))}
                <div ref={bottomRef} />
            </div>
            <div style={{ marginTop: '8px', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                {filtered.length} líneas mostradas
            </div>
        </div>
    );
}

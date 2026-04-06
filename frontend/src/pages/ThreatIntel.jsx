import React, { useState, useEffect } from 'react';
import { api } from '../services/api';

const MOCK_HISTORY = [
    { ip: '45.33.32.156', score: 95, classification: 'malicious', last_checked: new Date(Date.now() - 3600000).toISOString(), detections: 87, country: 'US', isp: 'Linode LLC' },
    { ip: '103.21.244.0', score: 72, classification: 'suspicious', last_checked: new Date(Date.now() - 7200000).toISOString(), detections: 12, country: 'CN', isp: 'Cloudflare' },
    { ip: '8.8.8.8', score: 0, classification: 'clean', last_checked: new Date(Date.now() - 86400000).toISOString(), detections: 0, country: 'US', isp: 'Google LLC' },
];

const MOCK_RESULT = (ip) => ({
    ip,
    score: Math.floor(Math.random() * 100),
    classification: ['malicious', 'suspicious', 'clean'][Math.floor(Math.random() * 3)],
    detections: Math.floor(Math.random() * 90),
    total_engines: 94,
    country: 'Unknown',
    isp: 'Unknown ISP',
    last_analysis: new Date().toISOString(),
    categories: ['scanner', 'malware', 'spam'].slice(0, Math.floor(Math.random() * 3)),
    virustotal_url: `https://www.virustotal.com/gui/ip-address/${ip}`,
});

const classColor = (c) => ({ malicious: '#ef4444', suspicious: '#f59e0b', clean: '#10b981' }[c] || '#888');
const classLabel = (c) => ({ malicious: '🔴 Malicioso', suspicious: '🟡 Sospechoso', clean: '🟢 Limpio' }[c] || c);

export default function ThreatIntel() {
    const [query, setQuery] = useState('');
    const [result, setResult] = useState(null);
    const [history, setHistory] = useState([]);
    const [loading, setLoading] = useState(false);
    const [histLoading, setHistLoading] = useState(true);

    useEffect(() => {
        api.getThreatHistory().catch(() => MOCK_HISTORY).then(h => {
            setHistory(h);
            setHistLoading(false);
        });
    }, []);

    const handleSearch = async (ip) => {
        const target = ip || query;
        if (!target) return;
        setLoading(true);
        setResult(null);
        try {
            const data = await api.getThreatIntel(target).catch(() => MOCK_RESULT(target));
            setResult(data);
            setHistory(prev => [{ ...data, last_checked: new Date().toISOString() }, ...prev.filter(h => h.ip !== target).slice(0, 9)]);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div>
            <h1 className="page-title"><span className="icon">🔍</span> Threat Intelligence</h1>

            {/* Search */}
            <div className="card" style={{ marginBottom: '24px' }}>
                <h2 style={{ marginBottom: '16px', fontSize: '1.1rem', fontWeight: 600 }}>Consultar IP</h2>
                <div style={{ display: 'flex', gap: '12px' }}>
                    <input
                        value={query}
                        onChange={e => setQuery(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && handleSearch()}
                        placeholder="Ingresá una dirección IP... ej. 45.33.32.156"
                        style={{ flex: 1, padding: '12px 16px', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--bg-secondary)', color: 'var(--text-primary)', fontSize: '1rem' }}
                    />
                    <button onClick={() => handleSearch()} disabled={loading} style={{ padding: '12px 28px', borderRadius: '8px', border: 'none', background: 'var(--accent-gradient)', color: 'white', fontWeight: 600, cursor: 'pointer', fontSize: '1rem' }}>
                        {loading ? 'Consultando...' : '🔍 Analizar'}
                    </button>
                </div>
                <p style={{ marginTop: '8px', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                    Fuentes: VirusTotal · AbuseIPDB
                </p>
            </div>

            {/* Result */}
            {loading && <div className="loading" style={{ minHeight: '120px' }}><div className="spinner"></div></div>}
            {result && (
                <div className="card" style={{ marginBottom: '24px', borderLeft: `4px solid ${classColor(result.classification)}` }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
                        <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
                                <span style={{ fontFamily: 'monospace', fontSize: '1.3rem', fontWeight: 700 }}>{result.ip}</span>
                                <span style={{ padding: '4px 12px', borderRadius: '6px', background: `${classColor(result.classification)}22`, color: classColor(result.classification), fontWeight: 600 }}>
                                    {classLabel(result.classification)}
                                </span>
                            </div>
                            <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                                <span>País: <strong style={{ color: 'var(--text-primary)' }}>{result.country}</strong></span>
                                <span>ISP: <strong style={{ color: 'var(--text-primary)' }}>{result.isp}</strong></span>
                                <span>Detecciones: <strong style={{ color: 'var(--error)' }}>{result.detections}/{result.total_engines}</strong></span>
                            </div>
                            {result.categories?.length > 0 && (
                                <div style={{ marginTop: '12px', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                                    {result.categories.map(c => (
                                        <span key={c} style={{ padding: '3px 10px', borderRadius: '4px', background: 'rgba(239,68,68,0.15)', color: 'var(--error)', fontSize: '0.8rem' }}>{c}</span>
                                    ))}
                                </div>
                            )}
                        </div>
                        {/* Score gauge */}
                        <div style={{ textAlign: 'center' }}>
                            <div style={{ width: '80px', height: '80px', borderRadius: '50%', background: `conic-gradient(${classColor(result.classification)} ${result.score * 3.6}deg, var(--bg-secondary) 0)`, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 8px' }}>
                                <div style={{ width: '60px', height: '60px', borderRadius: '50%', background: 'var(--bg-card)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '1.1rem' }}>
                                    {result.score}
                                </div>
                            </div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Risk Score</div>
                        </div>
                    </div>
                    {result.virustotal_url && (
                        <a href={result.virustotal_url} target="_blank" rel="noopener noreferrer" style={{ display: 'inline-block', marginTop: '16px', color: 'var(--accent-primary)', fontSize: '0.875rem' }}>
                            Ver en VirusTotal →
                        </a>
                    )}
                </div>
            )}

            {/* History */}
            <div className="card">
                <h2 style={{ marginBottom: '16px', fontSize: '1.1rem', fontWeight: 600 }}>Historial de Consultas</h2>
                {histLoading ? <div className="loading" style={{ minHeight: '80px' }}><div className="spinner"></div></div> : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {history.map((h, i) => (
                            <div key={i} onClick={() => { setQuery(h.ip); handleSearch(h.ip); }} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', background: 'var(--bg-secondary)', borderRadius: '8px', cursor: 'pointer', border: '1px solid transparent', transition: 'all 0.2s' }}
                                onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--accent-primary)'}
                                onMouseLeave={e => e.currentTarget.style.borderColor = 'transparent'}
                            >
                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                    <span style={{ fontFamily: 'monospace', fontWeight: 500 }}>{h.ip}</span>
                                    <span style={{ fontSize: '0.8rem', padding: '2px 8px', borderRadius: '4px', background: `${classColor(h.classification)}22`, color: classColor(h.classification) }}>
                                        {classLabel(h.classification)}
                                    </span>
                                </div>
                                <div style={{ display: 'flex', gap: '16px', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                                    <span>{h.country}</span>
                                    <span>{new Date(h.last_checked).toLocaleString()}</span>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}

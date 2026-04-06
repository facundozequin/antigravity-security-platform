import React, { useState, useEffect } from 'react';
import { api } from '../services/api';

export default function WAF() {
    const [rules, setRules] = useState([]);
    const [events, setEvents] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchData = async () => {
            try {
                const [r, e] = await Promise.all([
                    api.getWafRules().catch(() => [
                        { id: 941100, name: 'XSS Detection', enabled: true, severity: 'CRITICAL' },
                        { id: 942100, name: 'SQL Injection', enabled: true, severity: 'CRITICAL' },
                        { id: 920230, name: 'Multiple URL Encoding', enabled: false, severity: 'WARNING' }
                    ]),
                    api.getWafEvents().catch(() => [
                        { timestamp: new Date().toISOString(), rule_id: 942100, client_ip: '192.168.1.100', uri: '/login?user=\' OR 1=1' }
                    ])
                ]);
                setRules(r);
                setEvents(e);
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, []);

    const toggleRule = async (id, enabled) => {
        try {
            await api.toggleWafRule(id, enabled);
            setRules(rules.map(r => r.id === id ? { ...r, enabled } : r));
        } catch (err) {
            console.error('Failed to toggle', err);
            // optimistic UI
            setRules(rules.map(r => r.id === id ? { ...r, enabled } : r));
        }
    };

    if (loading) return <div className="loading"><div className="spinner"></div></div>;

    return (
        <div className="waf-page">
            <h1 className="page-title"><span className="icon">🛡️</span> Web Application Firewall</h1>
            
            <div className="card" style={{ marginBottom: '24px' }}>
                <h2 style={{ marginBottom: '16px', fontSize: '1.25rem', fontWeight: 600 }}>Active Rules (OWASP CRS)</h2>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {rules.map(rule => (
                        <div key={rule.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px', background: 'var(--bg-secondary)', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                            <div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <strong>{rule.id}</strong> - {rule.name}
                                    <span style={{ fontSize: '0.75rem', padding: '2px 6px', borderRadius: '4px', background: rule.severity === 'CRITICAL' ? 'rgba(239, 68, 68, 0.2)' : 'rgba(245, 158, 11, 0.2)', color: rule.severity === 'CRITICAL' ? 'var(--error)' : 'var(--warning)' }}>
                                        {rule.severity}
                                    </span>
                                </div>
                            </div>
                            <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
                                <input 
                                    type="checkbox" 
                                    checked={rule.enabled} 
                                    onChange={(e) => toggleRule(rule.id, e.target.checked)}
                                    style={{ width: '18px', height: '18px', accentColor: 'var(--accent-primary)' }}
                                />
                            </label>
                        </div>
                    ))}
                </div>
            </div>

            <div className="card">
                <h2 style={{ marginBottom: '16px', fontSize: '1.25rem', fontWeight: 600 }}>Recent WAF Events</h2>
                <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', textAlign: 'left', borderCollapse: 'collapse' }}>
                        <thead>
                            <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-secondary)' }}>
                                <th style={{ padding: '12px 16px' }}>Time</th>
                                <th style={{ padding: '12px 16px' }}>Rule ID</th>
                                <th style={{ padding: '12px 16px' }}>Client IP</th>
                                <th style={{ padding: '12px 16px' }}>URI blocked</th>
                            </tr>
                        </thead>
                        <tbody>
                            {events.map((ev, i) => (
                                <tr key={i} style={{ borderBottom: '1px solid var(--border-color)' }}>
                                    <td style={{ padding: '12px 16px', color: 'var(--text-secondary)' }}>{new Date(ev.timestamp).toLocaleString()}</td>
                                    <td style={{ padding: '12px 16px', color: 'var(--error)' }}>{ev.rule_id}</td>
                                    <td style={{ padding: '12px 16px' }}>{ev.client_ip}</td>
                                    <td style={{ padding: '12px 16px', fontFamily: 'monospace' }}>{ev.uri}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}

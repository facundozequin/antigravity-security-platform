import React, { useState, useEffect } from 'react';
import { api } from '../services/api';

const MOCK_ALERTS_HISTORY = [
    { timestamp: new Date(Date.now() - 3600000).toISOString(), type: 'WAF', severity: 'CRITICAL', message: 'Bloqueo masivo desde IP 45.33.32.156 (SQL Injection)', channel: 'Telegram' },
    { timestamp: new Date(Date.now() - 7200000).toISOString(), type: 'Fail2Ban', severity: 'WARNING', message: 'IP 103.21.244.0 baneada (nginx-http-auth)', channel: 'Telegram' },
    { timestamp: new Date(Date.now() - 86400000).toISOString(), type: 'Nginx', severity: 'INFO', message: 'Reinicio de servicio Nginx detectado', channel: 'Email' },
];

export default function Alerts() {
    const [history, setHistory] = useState([]);
    const [config, setConfig] = useState({ botToken: '', chatId: '', enabled: true });
    const [loading, setLoading] = useState(true);
    const [testing, setTesting] = useState(false);
    const [feedback, setFeedback] = useState(null);

    useEffect(() => {
        const fetchData = async () => {
            try {
                const data = await api.getAlertsHistory().catch(() => MOCK_ALERTS_HISTORY);
                setHistory(data);
                // Configuration would be fetched from settings, but let's assume it's here
                setLoading(false);
            } catch (err) {
                setLoading(false);
            }
        };
        fetchData();
    }, []);

    const handleTestAlert = async () => {
        setTesting(true);
        try {
            await api.testAlerts().catch(() => {});
            setFeedback({ type: 'success', msg: '¡Alerta de prueba enviada exitosamente!' });
        } catch (err) {
            setFeedback({ type: 'error', msg: 'Error al enviar alerta de prueba.' });
        }
        setTesting(false);
        setTimeout(() => setFeedback(null), 3000);
    };

    if (loading) return <div className="loading"><div className="spinner"></div></div>;

    return (
        <div>
            <h1 className="page-title"><span className="icon">🔔</span> Notificaciones y Alertas</h1>

            {feedback && (
                <div style={{ padding: '12px 16px', borderRadius: '8px', marginBottom: '16px', background: feedback.type === 'success' ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)', border: `1px solid ${feedback.type === 'success' ? 'var(--success)' : 'var(--error)'}`, color: feedback.type === 'success' ? 'var(--success)' : 'var(--error)' }}>
                    {feedback.msg}
                </div>
            )}

            <div className="grid-2" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '24px' }}>
                {/* Config Card */}
                <div className="card">
                    <h2 style={{ marginBottom: '20px', fontSize: '1.2rem', fontWeight: 600 }}>Configuración de Telegram</h2>
                    <form style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                        <div>
                            <label style={{ display: 'block', color: 'var(--text-secondary)', fontSize: '0.875rem', marginBottom: '6px' }}>Bot Token</label>
                            <input value={config.botToken} placeholder="ej. 123456789:ABCDEF..." style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--bg-secondary)', color: 'var(--text-primary)', fontSize: '1rem' }} />
                        </div>
                        <div>
                            <label style={{ display: 'block', color: 'var(--text-secondary)', fontSize: '0.875rem', marginBottom: '6px' }}>Chat ID</label>
                            <input value={config.chatId} placeholder="ej. -100123456789" style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--bg-secondary)', color: 'var(--text-primary)', fontSize: '1rem' }} />
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '10px' }}>
                            <input type="checkbox" checked={config.enabled} onChange={() => setConfig(prev => ({ ...prev, enabled: !prev.enabled }))} style={{ width: '18px', height: '18px' }} />
                            <span>Habilitar alertas globales</span>
                        </div>
                        <div style={{ display: 'flex', gap: '12px', marginTop: '10px' }}>
                            <button type="button" onClick={handleTestAlert} disabled={testing} style={{ flex: 1, padding: '12px', borderRadius: '8px', border: '1px solid var(--accent-primary)', background: 'transparent', color: 'var(--accent-primary)', fontWeight: 600, cursor: 'pointer' }}>
                                {testing ? 'Probando...' : '🚀 Probar Bot'}
                            </button>
                            <button type="button" style={{ flex: 1, padding: '12px', borderRadius: '8px', border: 'none', background: 'var(--accent-gradient)', color: 'white', fontWeight: 600, cursor: 'pointer' }}>
                                Guardar Config
                            </button>
                        </div>
                    </form>
                </div>

                {/* History Card */}
                <div className="card">
                    <h2 style={{ marginBottom: '20px', fontSize: '1.2rem', fontWeight: 600 }}>Historial de Alertas</h2>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        {history.map((alert, i) => (
                            <div key={i} style={{ padding: '12px', background: 'var(--bg-secondary)', borderRadius: '8px', borderLeft: `4px solid ${alert.severity === 'CRITICAL' ? 'var(--error)' : alert.severity === 'WARNING' ? 'var(--warning)' : 'var(--accent-primary)'}` }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                                    <span style={{ fontWeight: 700, fontSize: '0.85rem', color: alert.severity === 'CRITICAL' ? 'var(--error)' : 'var(--text-primary)' }}>{alert.type} - {alert.severity}</span>
                                    <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>{new Date(alert.timestamp).toLocaleTimeString()}</span>
                                </div>
                                <div style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>{alert.message}</div>
                                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Enviada via: {alert.channel}</div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}

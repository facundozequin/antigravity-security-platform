import React, { useState, useEffect } from 'react';
import { api } from '../services/api';

export default function Alerts() {
    const [history, setHistory] = useState([]);
    const [config, setConfig] = useState({ 
        TELEGRAM_BOT_TOKEN: '', 
        TELEGRAM_CHAT_ID: '', 
        TELEGRAM_ALERTS_ENABLED: false 
    });
    const [loading, setLoading] = useState(true);
    const [testing, setTesting] = useState(false);
    const [feedback, setFeedback] = useState(null);

    const fetchData = async () => {
        try {
            const [alertsHistory, globalSettings] = await Promise.all([
                api.getAlertsHistory().catch(() => []),
                api.getSettings().catch(() => ({}))
            ]);
            setHistory(alertsHistory);
            setConfig(prev => ({
                ...prev,
                TELEGRAM_BOT_TOKEN: globalSettings.TELEGRAM_BOT_TOKEN || '',
                TELEGRAM_CHAT_ID: globalSettings.TELEGRAM_CHAT_ID || '',
                TELEGRAM_ALERTS_ENABLED: !!globalSettings.TELEGRAM_ALERTS_ENABLED
            }));
        } catch (err) {
            console.error('Failed to fetch alert data:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
        const interval = setInterval(fetchData, 30000); // 30s refresh
        return () => clearInterval(interval);
    }, []);

    const handleSaveConfig = async () => {
        try {
            // We fetch existing settings to not overwrite other fields
            const current = await api.getSettings();
            await api.updateSettings({
                ...current,
                ...config
            });
            setFeedback({ type: 'success', msg: 'Configuración guardada correctamente.' });
        } catch (err) {
            setFeedback({ type: 'error', msg: 'Error al guardar la configuración.' });
        }
        setTimeout(() => setFeedback(null), 3000);
    };

    const handleTestAlert = async () => {
        setTesting(true);
        try {
            const res = await api.testAlerts();
            setFeedback({ type: 'success', msg: res.message || 'Alerta de prueba activada.' });
        } catch (err) {
            setFeedback({ type: 'error', msg: 'Error al activar prueba: verifica la configuración.' });
        }
        setTesting(false);
        setTimeout(() => setFeedback(null), 3000);
    };

    if (loading) return <div className="loading"><div className="spinner"></div></div>;

    return (
        <div>
            <h1 className="page-title"><span className="icon">🔔</span> Alerts & Notifications</h1>

            {feedback && (
                <div style={{ padding: '12px 16px', borderRadius: '8px', marginBottom: '16px', background: feedback.type === 'success' ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)', border: `1px solid ${feedback.type === 'success' ? 'var(--success)' : 'var(--error)'}`, color: feedback.type === 'success' ? 'var(--success)' : 'var(--error)' }}>
                    {feedback.msg}
                </div>
            )}

            <div className="grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1.5fr', gap: '24px' }}>
                {/* Config Card */}
                <div className="card">
                    <h2 style={{ marginBottom: '20px', fontSize: '1.2rem', fontWeight: 600 }}>Telegram Bot Integration</h2>
                    <form style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                        <div>
                            <label style={{ display: 'block', color: 'var(--text-secondary)', fontSize: '0.875rem', marginBottom: '6px' }}>Bot Token</label>
                            <input 
                                type="password"
                                value={config.TELEGRAM_BOT_TOKEN} 
                                onChange={(e) => setConfig({...config, TELEGRAM_BOT_TOKEN: e.target.value})}
                                placeholder="123456789:ABCDEF..." 
                                style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--bg-secondary)', color: 'var(--text-primary)', fontSize: '1rem' }} 
                            />
                        </div>
                        <div>
                            <label style={{ display: 'block', color: 'var(--text-secondary)', fontSize: '0.875rem', marginBottom: '6px' }}>Chat ID</label>
                            <input 
                                value={config.TELEGRAM_CHAT_ID} 
                                onChange={(e) => setConfig({...config, TELEGRAM_CHAT_ID: e.target.value})}
                                placeholder="-100123456789" 
                                style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--bg-secondary)', color: 'var(--text-primary)', fontSize: '1rem' }} 
                            />
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '10px' }}>
                            <input 
                                type="checkbox" 
                                checked={config.TELEGRAM_ALERTS_ENABLED} 
                                onChange={() => setConfig(prev => ({ ...prev, TELEGRAM_ALERTS_ENABLED: !prev.TELEGRAM_ALERTS_ENABLED }))} 
                                style={{ width: '18px', height: '18px' }} 
                            />
                            <span>Enable Global Security Notifications</span>
                        </div>
                        <div style={{ display: 'flex', gap: '12px', marginTop: '10px' }}>
                            <button type="button" onClick={handleTestAlert} disabled={testing} style={{ flex: 1, padding: '12px', borderRadius: '8px', border: '1px solid var(--accent-primary)', background: 'transparent', color: 'var(--accent-primary)', fontWeight: 600, cursor: 'pointer' }}>
                                {testing ? 'Testing...' : '🚀 Test Bot'}
                            </button>
                            <button type="button" onClick={handleSaveConfig} style={{ flex: 1, padding: '12px', borderRadius: '8px', border: 'none', background: 'var(--accent-gradient)', color: 'white', fontWeight: 600, cursor: 'pointer' }}>
                                Save Changes
                            </button>
                        </div>
                    </form>
                    <div style={{ marginTop: '20px', padding: '12px', borderRadius: '8px', background: 'var(--bg-secondary)', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                        <strong>Note:</strong> High severity alerts are sent immediately. Medium alerts are aggregated to prevent spam.
                    </div>
                </div>

                {/* History Card */}
                <div className="card">
                    <h2 style={{ marginBottom: '20px', fontSize: '1.2rem', fontWeight: 600 }}>Security Audit Trail</h2>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', maxHeight: '600px', overflowY: 'auto', paddingRight: '8px' }}>
                        {history.length > 0 ? history.map((alert, i) => (
                            <div key={i} style={{ padding: '12px', background: 'var(--bg-secondary)', borderRadius: '8px', borderLeft: `4px solid ${alert.severity === 'HIGH' ? 'var(--error)' : alert.severity === 'MEDIUM' ? 'var(--warning)' : 'var(--accent-primary)'}` }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                        <span className={`badge ${alert.severity.toLowerCase()}`} style={{ fontSize: '0.65rem', padding: '2px 6px' }}>{alert.severity}</span>
                                        <span style={{ fontWeight: 700, fontSize: '0.85rem' }}>{alert.source} / {alert.type}</span>
                                    </div>
                                    <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>{new Date(alert.last_seen).toLocaleString()}</span>
                                </div>
                                <div style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: '8px' }}>{alert.message}</div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                                        Occurrences: <strong>{alert.count}</strong> • Target: {alert.client_ip || 'Internal'}
                                    </div>
                                    {alert.notified && <span style={{ fontSize: '0.7rem', color: 'var(--success)' }}>✔ Notified via Telegram</span>}
                                </div>
                            </div>
                        )) : (
                            <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
                                <p>No security alerts recorded yet.</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}

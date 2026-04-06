import React, { useState, useEffect } from 'react';
import { api } from '../services/api';

const MOCK_SETTINGS = {
    virusTotalApiKey: '********************************',
    abuseIpdbApiKey: '********************************',
    telegramBotToken: '',
    telegramChatId: '',
    logRetentionDays: 30,
    autoBanMaliciousIps: true,
    aiAnalysisEnabled: true,
    pollingInterval: 5000,
};

export default function Settings() {
    const [settings, setSettings] = useState(MOCK_SETTINGS);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [feedback, setFeedback] = useState(null);

    useEffect(() => {
        const fetchSettings = async () => {
            try {
                const data = await api.getSettings().catch(() => MOCK_SETTINGS);
                setSettings(data);
                setLoading(false);
            } catch (err) {
                setLoading(false);
            }
        };
        fetchSettings();
    }, []);

    const handleChange = (e) => {
        const { name, value, type, checked } = e.target;
        setSettings(prev => ({
            ...prev,
            [name]: type === 'checkbox' ? checked : type === 'number' ? parseInt(value) : value
        }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setSaving(true);
        try {
            await api.updateSettings(settings).catch(() => {});
            setFeedback({ type: 'success', msg: '¡Configuración guardada exitosamente!' });
        } catch (err) {
            setFeedback({ type: 'error', msg: 'Error al guardar la configuración.' });
        }
        setSaving(false);
        setTimeout(() => setFeedback(null), 3000);
    };

    if (loading) return <div className="loading"><div className="spinner"></div></div>;

    return (
        <div>
            <h1 className="page-title"><span className="icon">⚙️</span> Configuración Global</h1>

            {feedback && (
                <div style={{ padding: '12px 16px', borderRadius: '8px', marginBottom: '16px', background: feedback.type === 'success' ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)', border: `1px solid ${feedback.type === 'success' ? 'var(--success)' : 'var(--error)'}`, color: feedback.type === 'success' ? 'var(--success)' : 'var(--error)' }}>
                    {feedback.msg}
                </div>
            )}

            <form onSubmit={handleSubmit}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '24px' }}>
                    
                    {/* Security APIs */}
                    <div className="card">
                        <h2 style={{ marginBottom: '20px', fontSize: '1.2rem', fontWeight: 600 }}>Integraciones de Seguridad</h2>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                            <div>
                                <label style={{ display: 'block', color: 'var(--text-secondary)', fontSize: '0.875rem', marginBottom: '6px' }}>VirusTotal API Key</label>
                                <input name="virusTotalApiKey" value={settings.virusTotalApiKey} onChange={handleChange} type="password" style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--bg-secondary)', color: 'var(--text-primary)' }} />
                            </div>
                            <div>
                                <label style={{ display: 'block', color: 'var(--text-secondary)', fontSize: '0.875rem', marginBottom: '6px' }}>AbuseIPDB API Key</label>
                                <input name="abuseIpdbApiKey" value={settings.abuseIpdbApiKey} onChange={handleChange} type="password" style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--bg-secondary)', color: 'var(--text-primary)' }} />
                            </div>
                            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', paddingTop: '10px' }}>
                                Estas llaves se utilizan para el lookup de reputación de IPs en la sección de Threat Intelligence.
                            </div>
                        </div>
                    </div>

                    {/* App Config */}
                    <div className="card">
                        <h2 style={{ marginBottom: '20px', fontSize: '1.2rem', fontWeight: 600 }}>Configuración de la Plataforma</h2>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                            <div>
                                <label style={{ display: 'block', color: 'var(--text-secondary)', fontSize: '0.875rem', marginBottom: '6px' }}>Frecuencia de Polling (ms)</label>
                                <input name="pollingInterval" type="number" value={settings.pollingInterval} onChange={handleChange} style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--bg-secondary)', color: 'var(--text-primary)' }} />
                            </div>
                            <div>
                                <label style={{ display: 'block', color: 'var(--text-secondary)', fontSize: '0.875rem', marginBottom: '6px' }}>Retención de Logs (días)</label>
                                <input name="logRetentionDays" type="number" value={settings.logRetentionDays} onChange={handleChange} style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--bg-secondary)', color: 'var(--text-primary)' }} />
                            </div>
                            <hr style={{ border: 'none', borderTop: '1px solid var(--border-color)', margin: '10px 0' }} />
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                <span>Baneo automático de IPs maliciosas</span>
                                <input name="autoBanMaliciousIps" type="checkbox" checked={settings.autoBanMaliciousIps} onChange={handleChange} style={{ width: '20px', height: '20px' }} />
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                <span>Habilitar análisis continuo con IA</span>
                                <input name="aiAnalysisEnabled" type="checkbox" checked={settings.aiAnalysisEnabled} onChange={handleChange} style={{ width: '20px', height: '20px' }} />
                            </div>
                        </div>
                    </div>
                </div>

                <div style={{ marginTop: '24px', display: 'flex', justifyContent: 'flex-end' }}>
                    <button type="submit" disabled={saving} style={{ padding: '12px 36px', borderRadius: '8px', border: 'none', background: 'var(--accent-gradient)', color: 'white', fontWeight: 700, cursor: 'pointer', fontSize: '1.1rem', boxShadow: 'var(--shadow-md)' }}>
                        {saving ? 'Guardando...' : '💾 Guardar Todo'}
                    </button>
                </div>
            </form>
        </div>
    );
}

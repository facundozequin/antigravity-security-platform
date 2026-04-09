import React, { useState, useEffect } from 'react';
import { api } from '../services/api';

const MOCK_SETTINGS = {
    VIRUSTOTAL_API_KEY: '********************************',
    ABUSEIPDB_API_KEY: '********************************',
    TELEGRAM_BOT_TOKEN: '',
    TELEGRAM_CHAT_ID: '',
    TELEGRAM_ALERTS_ENABLED: false,
    LOG_RETENTION_DAYS: 30,
    AUTO_BAN_MALICIOUS_IPS: true,
    AI_ANALYSIS_ENABLED: true,
    POLLING_INTERVAL: 5000,
};

export default function Settings() {
    const [settings, setSettings] = useState(MOCK_SETTINGS);
    const [providers, setProviders] = useState([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [feedback, setFeedback] = useState(null);
    const [showAIModal, setShowAIModal] = useState(false);
    const [newProvider, setNewProvider] = useState({ name: '', provider_type: 'ollama', model: 'llama3', api_key: '', endpoint_url: 'http://ollama:11434' });

    const fetchData = async () => {
        try {
            const [s, p] = await Promise.all([
                api.getSettings().catch(() => MOCK_SETTINGS),
                api.getAIProviders().catch(() => [])
            ]);
            setSettings(s);
            setProviders(p);
            setLoading(false);
        } catch (err) {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
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

    const handleAddProvider = async (e) => {
        e.preventDefault();
        try {
            await api.saveAIProvider(newProvider);
            setShowAIModal(false);
            fetchData();
        } catch (err) {
            alert('Error al agregar proveedor');
        }
    };

    const handleActivateProvider = async (id) => {
        try {
            await api.activateAIProvider(id);
            fetchData();
        } catch (err) {
            alert('Error al activar proveedor');
        }
    };

    const handleDeleteProvider = async (id) => {
        if (!window.confirm('¿Eliminar este proveedor?')) return;
        try {
            await api.deleteAIProvider(id);
            fetchData();
        } catch (err) {
            alert('Error al eliminar proveedor');
        }
    };

    if (loading) return <div className="loading"><div className="spinner"></div></div>;

    return (
        <div className="settings-page">
            <h1 className="page-title"><span className="icon">⚙️</span> Configuración Global</h1>

            {feedback && (
                <div style={{ padding: '12px 16px', borderRadius: '8px', marginBottom: '16px', background: feedback.type === 'success' ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)', border: `1px solid ${feedback.type === 'success' ? 'var(--success)' : 'var(--error)'}`, color: feedback.type === 'success' ? 'var(--success)' : 'var(--error)' }}>
                    {feedback.msg}
                </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '24px' }}>
                
                {/* General Settings Form */}
                <form onSubmit={handleSubmit} style={{ display: 'contents' }}>
                    <div className="card">
                        <h2 style={{ marginBottom: '20px', fontSize: '1.2rem', fontWeight: 600 }}>Integraciones de Seguridad</h2>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                            <div>
                                <label>VirusTotal API Key</label>
                                <input name="VIRUSTOTAL_API_KEY" value={settings.VIRUSTOTAL_API_KEY} onChange={handleChange} type="password" />
                            </div>
                            <div>
                                <label>AbuseIPDB API Key</label>
                                <input name="ABUSEIPDB_API_KEY" value={settings.ABUSEIPDB_API_KEY} onChange={handleChange} type="password" />
                            </div>
                        </div>

                        <h2 style={{ margin: '30px 0 20px', fontSize: '1.2rem', fontWeight: 600 }}>Alertas Telegram</h2>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                <span>Activar Alertas</span>
                                <input name="TELEGRAM_ALERTS_ENABLED" type="checkbox" checked={settings.TELEGRAM_ALERTS_ENABLED} onChange={handleChange} style={{ width: '20px', height: '20px' }} />
                            </div>
                            <div>
                                <label>Bot Token</label>
                                <input name="TELEGRAM_BOT_TOKEN" value={settings.TELEGRAM_BOT_TOKEN} onChange={handleChange} placeholder="botXXXX:YYYY" />
                            </div>
                            <div>
                                <label>Chat ID</label>
                                <input name="TELEGRAM_CHAT_ID" value={settings.TELEGRAM_CHAT_ID} onChange={handleChange} placeholder="-100XXXXXXXX" />
                            </div>
                        </div>

                        <h2 style={{ margin: '30px 0 20px', fontSize: '1.2rem', fontWeight: 600 }}>Retención y Escaneo</h2>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                            <div>
                                <label>Retención de Logs (días)</label>
                                <input name="LOG_RETENTION_DAYS" type="number" value={settings.LOG_RETENTION_DAYS} onChange={handleChange} />
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                <span>Baneo automático (Fail2Ban)</span>
                                <input name="AUTO_BAN_MALICIOUS_IPS" type="checkbox" checked={settings.AUTO_BAN_MALICIOUS_IPS} onChange={handleChange} style={{ width: '20px', height: '20px' }} />
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                <div style={{ display: 'flex', flexDirection: 'column' }}>
                                    <span>Análisis Autónomo (IA)</span>
                                    <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Analiza ráfagas 4xx/5xx cada 10m</span>
                                </div>
                                <input name="AI_ANALYSIS_ENABLED" type="checkbox" checked={settings.AI_ANALYSIS_ENABLED} onChange={handleChange} style={{ width: '20px', height: '20px' }} />
                            </div>
                            <button type="submit" disabled={saving} className="btn-primary" style={{ marginTop: '10px' }}>
                                {saving ? 'Guardando...' : 'Guardar Configuración'}
                            </button>
                        </div>
                    </div>
                </form>

                {/* AI Providers Management */}
                <div className="card">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                        <h2 style={{ fontSize: '1.2rem', fontWeight: 600 }}>Proveedores de IA</h2>
                        <button onClick={() => setShowAIModal(true)} className="btn-small">+ Agregar</button>
                    </div>
                    
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        {providers.length === 0 ? (
                            <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '20px' }}>No hay proveedores configurados.</p>
                        ) : (
                            providers.map(p => (
                                <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px', background: 'var(--bg-secondary)', borderRadius: '8px', border: p.is_active ? '1px solid var(--accent-primary)' : '1px solid var(--border-color)' }}>
                                    <div>
                                        <div style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}>
                                            {p.name}
                                            {p.is_active && <span style={{ fontSize: '0.6rem', background: 'var(--accent-primary)', color: 'white', padding: '2px 6px', borderRadius: '4px' }}>ACTIVO</span>}
                                        </div>
                                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{p.provider_type} / {p.model}</div>
                                    </div>
                                    <div style={{ display: 'flex', gap: '8px' }}>
                                        {!p.is_active && <button onClick={() => handleActivateProvider(p.id)} className="btn-small">Activar</button>}
                                        <button onClick={() => handleDeleteProvider(p.id)} className="btn-small btn-danger">×</button>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                    <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '20px' }}>
                        La IA se utiliza para analizar patrones de ataque en los logs de Nginx y ModSecurity.
                    </p>
                </div>
            </div>

            {showAIModal && (
                <div className="modal-overlay">
                    <div className="modal-content card" style={{ width: '450px' }}>
                        <h2>Agregar Proveedor de IA</h2>
                        <form onSubmit={handleAddProvider} style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginTop: '20px' }}>
                            <div>
                                <label>Nombre del Perfil</label>
                                <input required value={newProvider.name} onChange={e => setNewProvider({...newProvider, name: e.target.value})} placeholder="Ollama Local" />
                            </div>
                            <div>
                                <label>Tipo de Proveedor</label>
                                <select value={newProvider.provider_type} onChange={e => setNewProvider({...newProvider, provider_type: e.target.value})} style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--bg-primary)', color: 'var(--text-primary)' }}>
                                    <option value="ollama">Ollama</option>
                                    <option value="openai">OpenAI</option>
                                    <option value="gemini">Gemini</option>
                                </select>
                            </div>
                            <div>
                                <label>Modelo</label>
                                <input required value={newProvider.model} onChange={e => setNewProvider({...newProvider, model: e.target.value})} placeholder="llama3 / gpt-4" />
                            </div>
                            {(newProvider.provider_type === 'openai' || newProvider.provider_type === 'gemini') && (
                                <div>
                                    <label>API Key</label>
                                    <input required type="password" value={newProvider.api_key} onChange={e => setNewProvider({...newProvider, api_key: e.target.value})} />
                                </div>
                            )}
                            {newProvider.provider_type === 'ollama' && (
                                <div>
                                    <label>Endpoint URL</label>
                                    <input required value={newProvider.endpoint_url} onChange={e => setNewProvider({...newProvider, endpoint_url: e.target.value})} />
                                </div>
                            )}
                            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '10px' }}>
                                <button type="button" onClick={() => setShowAIModal(false)} className="btn-secondary">Cancelar</button>
                                <button type="submit" className="btn-primary">Agregar</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            <style>{`
                .btn-primary { background: var(--accent-gradient); color: white; border: none; padding: 10px 20px; border-radius: 8px; cursor: pointer; font-weight: 600; }
                .btn-secondary { background: var(--bg-secondary); color: var(--text-primary); border: 1px solid var(--border-color); padding: 10px 20px; border-radius: 8px; cursor: pointer; }
                .btn-small { padding: 4px 12px; border-radius: 6px; font-size: 0.8rem; border: 1px solid var(--border-color); background: var(--bg-secondary); color: var(--text-primary); cursor: pointer; }
                .btn-danger { color: var(--error); border-color: var(--error); }
                .modal-overlay { position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.7); display: flex; align-items: center; justify-content: center; z-index: 1000; }
                .modal-content { padding: 30px; }
                label { display: block; font-size: 0.85rem; color: var(--text-secondary); margin-bottom: 6px; }
                input, select { width: 100%; padding: 10px; border-radius: 8px; border: 1px solid var(--border-color); background: var(--bg-primary); color: var(--text-primary); }
            `}</style>
        </div>
    );
}

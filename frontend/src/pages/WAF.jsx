import React, { useState, useEffect } from 'react';
import { api } from '../services/api';

export default function WAF() {
    const [rules, setRules] = useState([]);
    const [events, setEvents] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [newRule, setNewRule] = useState({ name: '', rule_content: '', enabled: true });

    const fetchData = async () => {
        try {
            const [r, e] = await Promise.all([
                api.getWafRules(),
                api.getWafEvents()
            ]);
            setRules(r);
            setEvents(e);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
        const interval = setInterval(fetchData, 10000);
        return () => clearInterval(interval);
    }, []);

    const toggleRule = async (id, enabled) => {
        try {
            await api.toggleWafRule(id, enabled);
            setRules(rules.map(r => r.id === id ? { ...r, enabled } : r));
        } catch (err) {
            console.error('Failed to toggle', err);
        }
    };

    const handleSaveRule = async (e) => {
        e.preventDefault();
        try {
            await api.saveWafRule(newRule);
            setShowModal(false);
            setNewRule({ name: '', rule_content: '', enabled: true });
            fetchData();
        } catch (err) {
            alert('Error saving rule');
        }
    };

    const deleteRule = async (id) => {
        if (!window.confirm('¿Eliminar regla?')) return;
        try {
            await api.deleteWafRule(id);
            fetchData();
        } catch (err) {
            alert('Error deleting rule');
        }
    };

    if (loading) return <div className="loading"><div className="spinner"></div></div>;

    return (
        <div className="waf-page">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                <h1 className="page-title"><span className="icon">🛡️</span> Web Application Firewall</h1>
                <button onClick={() => setShowModal(true)} className="btn-primary">+ Nueva Regla Custom</button>
            </div>

            <div className="grid-2">
                <div className="card">
                    <h2 style={{ marginBottom: '16px', fontSize: '1.25rem' }}>Reglas Activas</h2>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        {rules.length === 0 ? (
                            <p style={{ color: 'var(--text-muted)' }}>No hay reglas custom configuradas.</p>
                        ) : (
                            rules.map(rule => (
                                <div key={rule.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px', background: 'var(--bg-secondary)', borderRadius: '8px' }}>
                                    <div>
                                        <strong>{rule.name}</strong>
                                        <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontFamily: 'monospace' }}>rule_{rule.id}.conf</div>
                                    </div>
                                    <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                                        <input type="checkbox" checked={rule.enabled} onChange={(e) => toggleRule(rule.id, e.target.checked)} />
                                        <button onClick={() => deleteRule(rule.id)} className="btn-small btn-danger">×</button>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>

                <div className="card">
                    <h2 style={{ marginBottom: '16px', fontSize: '1.25rem' }}>Eventos Recientes</h2>
                    <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
                        {events.length === 0 ? (
                            <p style={{ color: 'var(--text-muted)' }}>No hay ataques detectados recientemente.</p>
                        ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                {events.map((ev, i) => (
                                    <div key={i} style={{ padding: '12px', background: 'var(--bg-secondary)', borderRadius: '8px', borderLeft: '4px solid var(--error)' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', marginBottom: '4px' }}>
                                            <span style={{ color: 'var(--error)', fontWeight: 'bold' }}>BLOCK {ev.rule_id}</span>
                                            <span style={{ color: 'var(--text-muted)' }}>{new Date(ev.timestamp).toLocaleTimeString()}</span>
                                        </div>
                                        <div style={{ fontSize: '0.85rem' }}>{ev.client_ip} → <span style={{ fontFamily: 'monospace' }}>{ev.uri}</span></div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {showModal && (
                <div className="modal-overlay">
                    <div className="modal-content card" style={{ width: '600px' }}>
                        <h2>Nueva Regla ModSecurity</h2>
                        <form onSubmit={handleSaveRule} style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginTop: '20px' }}>
                            <div>
                                <label>Nombre Descriptivo</label>
                                <input required value={newRule.name} onChange={e => setNewRule({...newRule, name: e.target.value})} placeholder="Block SQLMap" />
                            </div>
                            <div>
                                <label>Contenido de la Regla (ModSecurity Syntax)</label>
                                <textarea 
                                    required 
                                    rows={6} 
                                    value={newRule.rule_content} 
                                    onChange={e => setNewRule({...newRule, rule_content: e.target.value})} 
                                    placeholder='SecRule REQUEST_HEADERS:User-Agent "sqlmap" "id:1000,phase:1,deny,status:403"'
                                    style={{ fontFamily: 'monospace' }}
                                ></textarea>
                            </div>
                            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                                <button type="button" onClick={() => setShowModal(false)} className="btn-secondary">Cancelar</button>
                                <button type="submit" className="btn-primary">Sincronizar Regla</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            <style>{`
                .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; }
                .btn-primary { background: var(--accent-gradient); color: white; border: none; padding: 10px 20px; border-radius: 8px; cursor: pointer; font-weight: 600; }
                .btn-secondary { background: var(--bg-secondary); color: var(--text-primary); border: 1px solid var(--border-color); padding: 10px 20px; border-radius: 8px; cursor: pointer; }
                .btn-small { padding: 4px 8px; border-radius: 4px; font-size: 0.8rem; border: 1px solid var(--border-color); background: var(--bg-secondary); cursor: pointer; }
                .btn-danger { color: var(--error); border-color: var(--error); }
                .modal-overlay { position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.7); display: flex; align-items: center; justify-content: center; z-index: 1000; }
                .modal-content { padding: 30px; }
                label { display: block; font-size: 0.85rem; color: var(--text-secondary); margin-bottom: 6px; }
                input, textarea { width: 100%; padding: 10px; border-radius: 8px; border: 1px solid var(--border-color); background: var(--bg-primary); color: var(--text-primary); }
            `}</style>
        </div>
    );
}

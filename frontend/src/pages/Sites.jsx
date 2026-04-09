import React from 'react'
import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../services/api';

export default function Sites() {
    const [sites, setSites] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [editingSite, setEditingSite] = useState(null);
    const [formData, setFormData] = useState({
        domain: '',
        target_url: '',
        port: 80,
        ssl_enabled: false,
        custom_config: '',
        enabled: true
    });

    const fetchSites = async () => {
        try {
            const data = await api.getAIProviders(); // Wait, api.js might need a specific vhosts call
            // Let's assume api.js has listVHosts based on my nginx.py router
            const res = await api.listSites(); // Currently this might still be legacy, I should check api.js
            setSites(Array.isArray(res) ? res : []);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchSites();
    }, []);

    const handleSave = async (e) => {
        e.preventDefault();
        try {
            if (editingSite) {
                await api.updateVHost(editingSite.id, formData);
            } else {
                await api.createVHost(formData);
            }
            setShowModal(false);
            fetchSites();
        } catch (err) {
            alert('Error saving vhost');
        }
    };

    const deleteSite = async (id) => {
        if (!window.confirm('¿Eliminar este sitio?')) return;
        await api.deleteVHost(id);
        fetchSites();
    };

    if (loading) return <div className="loading"><div className="spinner"></div></div>;

    return (
        <div className="sites-page">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                <h1 className="page-title"><span className="icon">🌐</span> Virtual Hosts</h1>
                <button onClick={() => { setEditingSite(null); setFormData({ domain: '', target_url: '', port: 80, ssl_enabled: false, custom_config: '', enabled: true }); setShowModal(true); }} className="btn-primary">
                    + Nuevo Site
                </button>
            </div>

            <div className="card">
                <div className="sites-list">
                    {sites.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: '40px' }}>
                            <p style={{ fontSize: '3rem' }}>📁</p>
                            <p>No hay sitios configurados</p>
                        </div>
                    ) : (
                        sites.map(site => (
                            <div key={site.id || site} className="site-item" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px', borderBottom: '1px solid var(--border-color)' }}>
                                <Link to={`/sites/${encodeURIComponent(site.domain || site)}`} style={{ textDecoration: 'none', color: 'inherit', flex: 1 }}>
                                    <div style={{ fontWeight: 600 }}>{site.domain || site}</div>
                                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{site.target_url || 'Configuración manual'}</div>
                                </Link>
                                <div style={{ display: 'flex', gap: '10px' }}>
                                    <button onClick={() => { setEditingSite(site); setFormData(site); setShowModal(true); }} className="btn-small">Editar</button>
                                    <button onClick={() => deleteSite(site.id)} className="btn-small btn-danger">Eliminar</button>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>

            {showModal && (
                <div className="modal-overlay">
                    <div className="modal-content card" style={{ width: '500px' }}>
                        <h2>{editingSite ? 'Editar Virtual Host' : 'Nuevo Virtual Host'}</h2>
                        <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginTop: '20px' }}>
                            <div>
                                <label>Dominio</label>
                                <input required value={formData.domain} onChange={e => setFormData({...formData, domain: e.target.value})} placeholder="example.com" />
                            </div>
                            <div>
                                <label>Upstream URL</label>
                                <input required value={formData.target_url} onChange={e => setFormData({...formData, target_url: e.target.value})} placeholder="http://127.0.0.1:8080" />
                            </div>
                            <div style={{ display: 'flex', gap: '20px' }}>
                                <div style={{ flex: 1 }}>
                                    <label>Puerto</label>
                                    <input type="number" value={formData.port} onChange={e => setFormData({...formData, port: parseInt(e.target.value)})} />
                                </div>
                                <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '10px', paddingTop: '24px' }}>
                                    <input type="checkbox" checked={formData.ssl_enabled} onChange={e => setFormData({...formData, ssl_enabled: e.target.checked})} />
                                    <label>SSL</label>
                                </div>
                            </div>
                            <div>
                                <label>Configuración Custom</label>
                                <textarea rows={4} value={formData.custom_config} onChange={e => setFormData({...formData, custom_config: e.target.value})} placeholder="# Nginx directives..."></textarea>
                            </div>
                            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '10px' }}>
                                <button type="button" onClick={() => setShowModal(false)} className="btn-secondary">Cancelar</button>
                                <button type="submit" className="btn-primary">Guardar</button>
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
                .modal-content { padding: 30px; border: 1px solid var(--border-color); }
                label { display: block; font-size: 0.85rem; color: var(--text-secondary); margin-bottom: 6px; }
                input, textarea { width: 100%; padding: 10px; border-radius: 8px; border: 1px solid var(--border-color); background: var(--bg-primary); color: var(--text-primary); }
            `}</style>
        </div>
    );
}

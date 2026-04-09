import React, { useState, useEffect } from 'react';
import { api } from '../services/api';

export default function Fail2Ban() {
    const [bans, setBans] = useState([]);
    const [jails, setJails] = useState([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('bans');
    const [banIpInput, setBanIpInput] = useState('');
    const [banReason, setBanReason] = useState('');
    const [feedback, setFeedback] = useState(null);
    
    // Jail Form State
    const [editingJail, setEditingJail] = useState({
        name: '', log_path: '/var/log/nginx/access.log', maxretry: 5, findtime: 600, bantime: 3600, enabled: true
    });

    useEffect(() => {
        const fetchData = async () => {
            try {
                const [b, j] = await Promise.all([
                    api.getFail2BanBans().catch(() => []),
                    api.getFail2BanJails().catch(() => []),
                ]);
                setBans(Array.isArray(b) ? b : []);
                setJails(Array.isArray(j) ? j : []);
            } finally {
                setLoading(false);
            }
        };
        fetchData();
        const interval = setInterval(fetchData, 10000); // Poll every 10s
        return () => clearInterval(interval);
    }, []);

    const handleBan = async (e) => {
        e.preventDefault();
        if (!banIpInput) return;
        try {
            await api.banIp(banIpInput, banReason).catch(() => {});
            setBans(prev => [{
                ip: banIpInput, jail: 'manual', banned_at: new Date().toISOString(),
                ban_time: 3600, reason: banReason || 'Manual ban', country: '?'
            }, ...prev]);
            setFeedback({ type: 'success', msg: `IP ${banIpInput} baneada correctamente.` });
            setBanIpInput(''); setBanReason('');
        } catch {
            setFeedback({ type: 'error', msg: 'Error al banear IP.' });
        }
        setTimeout(() => setFeedback(null), 3000);
    };

    const handleUnban = async (ip) => {
        try {
            await api.unbanIp(ip).catch(() => {});
            setBans(prev => prev.filter(b => b.ip !== ip));
            setFeedback({ type: 'success', msg: `IP ${ip} desbaneada.` });
        } catch {
            setFeedback({ type: 'error', msg: 'Error al desbanear.' });
        }
        setTimeout(() => setFeedback(null), 3000);
    };

    const timeRemaining = (bannedAt, banTime) => {
        const end = new Date(bannedAt).getTime() + (banTime || 3600) * 1000;
        const diff = Math.max(0, end - Date.now());
        const h = Math.floor(diff / 3600000);
        const m = Math.floor((diff % 3600000) / 60000);
        return diff === 0 ? 'Expired' : `${h}h ${m}m`;
    };

    const handleSaveJail = async (e) => {
        e.preventDefault();
        try {
            const saved = await api.saveFail2BanJail(editingJail);
            // Replace or append
            setJails(prev => {
                const filtered = prev.filter(j => j.name !== saved.name);
                return [...filtered, saved];
            });
            setFeedback({ type: 'success', msg: `Jail ${saved.name} guardada exitosamente.` });
            setActiveTab('jails');
            setEditingJail({ name: '', log_path: '/var/log/nginx/access.log', maxretry: 5, findtime: 600, bantime: 3600, enabled: true });
        } catch {
            setFeedback({ type: 'error', msg: 'Error al guardar Jail' });
        }
        setTimeout(() => setFeedback(null), 3000);
    };

    const handleDeleteJail = async (id, name) => {
        try {
            await api.deleteFail2BanJail(id);
            setJails(prev => prev.filter(j => j.id !== id));
            setFeedback({ type: 'success', msg: `Jail ${name} eliminada.` });
        } catch {
            setFeedback({ type: 'error', msg: 'Error al eliminar Jail' });
        }
        setTimeout(() => setFeedback(null), 3000);
    };

    const openEditJail = (jail) => {
        setEditingJail(jail);
        setActiveTab('edit-jail');
    };

    if (loading) return <div className="loading"><div className="spinner"></div></div>;

    return (
        <div>
            <h1 className="page-title"><span className="icon">🚫</span> Fail2Ban — IP Management</h1>

            {feedback && (
                <div style={{ padding: '12px 16px', borderRadius: '8px', marginBottom: '16px', background: feedback.type === 'success' ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)', border: `1px solid ${feedback.type === 'success' ? 'var(--success)' : 'var(--error)'}`, color: feedback.type === 'success' ? 'var(--success)' : 'var(--error)' }}>
                    {feedback.msg}
                </div>
            )}

            {/* Stats */}
            <div className="stats-grid" style={{ marginBottom: '24px' }}>
                {[
                    { label: 'IPs Baneadas', value: bans.length, color: '#ef4444' },
                    { label: 'Jails Activas', value: jails.filter(j => j.enabled).length, color: '#6366f1' },
                    { label: 'Total Banned (jails)', value: jails.reduce((a, j) => a + (j.currently_banned || 0), 0), color: '#f59e0b' },
                ].map(s => (
                    <div key={s.label} className="card stats-card">
                        <div className="label">{s.label}</div>
                        <div className="value" style={{ background: `linear-gradient(135deg, ${s.color}, ${s.color}aa)`, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>{s.value}</div>
                    </div>
                ))}
            </div>

            {/* Tabs */}
            <div style={{ display: 'flex', gap: '8px', marginBottom: '20px', flexWrap: 'wrap' }}>
                {['bans', 'jails', 'manual-ban', 'edit-jail'].map(tab => (
                    <button key={tab} onClick={() => setActiveTab(tab)} style={{ padding: '8px 20px', borderRadius: '8px', border: 'none', cursor: 'pointer', fontWeight: 500, background: activeTab === tab ? 'var(--accent-gradient)' : 'var(--bg-card)', color: activeTab === tab ? 'white' : 'var(--text-secondary)' }}>
                        {tab === 'bans' ? '🚫 IPs Baneadas' : tab === 'jails' ? '⚙️ Jails' : tab === 'manual-ban' ? '➕ Banear IP' : '📝 Editor de Jails'}
                    </button>
                ))}
            </div>

            {activeTab === 'bans' && (
                <div className="card">
                    <h2 style={{ marginBottom: '16px', fontSize: '1.1rem', fontWeight: 600 }}>IPs Actualmente Baneadas</h2>
                    <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', textAlign: 'left', borderCollapse: 'collapse' }}>
                            <thead>
                                <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                                    {['IP', 'País', 'Jail', 'Motivo', 'Tiempo Rest.', 'Acción'].map(h => (
                                        <th key={h} style={{ padding: '12px 16px' }}>{h}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {bans.map((ban, i) => (
                                    <tr key={i} style={{ borderBottom: '1px solid var(--border-color)' }}>
                                        <td style={{ padding: '12px 16px', fontFamily: 'monospace', color: 'var(--error)' }}>{ban.ip}</td>
                                        <td style={{ padding: '12px 16px', color: 'var(--text-secondary)' }}>{ban.country || 'Unknown'}</td>
                                        <td style={{ padding: '12px 16px' }}><span style={{ background: 'rgba(99,102,241,0.15)', color: 'var(--accent-primary)', padding: '2px 8px', borderRadius: '4px', fontSize: '0.8rem' }}>{ban.jail}</span></td>
                                        <td style={{ padding: '12px 16px', color: 'var(--text-secondary)' }}>{ban.reason}</td>
                                        <td style={{ padding: '12px 16px', color: 'var(--warning)' }}>{timeRemaining(ban.banned_at, ban.ban_time)}</td>
                                        <td style={{ padding: '12px 16px' }}>
                                            <button onClick={() => handleUnban(ban.ip)} style={{ padding: '6px 14px', borderRadius: '6px', border: '1px solid var(--success)', background: 'transparent', color: 'var(--success)', cursor: 'pointer', fontSize: '0.85rem' }}>
                                                Desbanear
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {activeTab === 'jails' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {jails.map(jail => (
                        <div key={jail.name} className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                                    <strong>{jail.name}</strong>
                                    <span style={{ fontSize: '0.75rem', padding: '2px 8px', borderRadius: '4px', background: jail.enabled ? 'rgba(16,185,129,0.15)' : 'rgba(85,85,102,0.3)', color: jail.enabled ? 'var(--success)' : 'var(--text-muted)' }}>
                                        {jail.enabled ? 'Activo' : 'Inactivo'}
                                    </span>
                                </div>
                                <div style={{ display: 'flex', gap: '24px', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                                    <span>maxretry: <strong style={{ color: 'var(--text-primary)' }}>{jail.maxretry}</strong></span>
                                    <span>bantime: <strong style={{ color: 'var(--text-primary)' }}>{jail.bantime}s</strong></span>
                                    <span>findtime: <strong style={{ color: 'var(--text-primary)' }}>{jail.findtime}s</strong></span>
                                    <span>currently banned: <strong style={{ color: 'var(--error)' }}>{jail.currently_banned || 0}</strong></span>
                                </div>
                            </div>
                            <div style={{ display: 'flex', gap: '8px' }}>
                                <button onClick={() => openEditJail(jail)} className="btn small">Editar</button>
                                {jail.id && <button onClick={() => handleDeleteJail(jail.id, jail.name)} className="btn small error">Eliminar</button>}
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {activeTab === 'manual-ban' && (
                <div className="card" style={{ maxWidth: '480px' }}>
                    <h2 style={{ marginBottom: '20px', fontSize: '1.1rem', fontWeight: 600 }}>Banear IP manualmente</h2>
                    <form onSubmit={handleBan} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                        <div>
                            <label style={{ display: 'block', color: 'var(--text-secondary)', fontSize: '0.875rem', marginBottom: '6px' }}>Dirección IP</label>
                            <input value={banIpInput} onChange={e => setBanIpInput(e.target.value)} placeholder="ej. 192.168.1.100" style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--bg-secondary)', color: 'var(--text-primary)', fontSize: '1rem' }} />
                        </div>
                        <div>
                            <label style={{ display: 'block', color: 'var(--text-secondary)', fontSize: '0.875rem', marginBottom: '6px' }}>Motivo (opcional)</label>
                            <input value={banReason} onChange={e => setBanReason(e.target.value)} placeholder="ej. Actividad sospechosa" style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--bg-secondary)', color: 'var(--text-primary)', fontSize: '1rem' }} />
                        </div>
                        <button type="submit" style={{ padding: '12px', borderRadius: '8px', border: 'none', background: 'linear-gradient(135deg, #ef4444, #dc2626)', color: 'white', fontWeight: 600, cursor: 'pointer', fontSize: '1rem' }}>
                            🚫 Banear IP
                        </button>
                    </form>
                </div>
            )}

            {activeTab === 'edit-jail' && (
                <div className="card" style={{ maxWidth: '600px' }}>
                    <h2 style={{ marginBottom: '20px', fontSize: '1.1rem', fontWeight: 600 }}>{editingJail.id ? `Editar Jail: ${editingJail.name}` : 'Crear Nueva Jail'}</h2>
                    <form onSubmit={handleSaveJail} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                        <div style={{ display: 'flex', gap: '16px' }}>
                            <div style={{ flex: 1 }}>
                                <label style={{ display: 'block', color: 'var(--text-secondary)', fontSize: '0.875rem', marginBottom: '6px' }}>Nombre</label>
                                <input required value={editingJail.name} readOnly={!!editingJail.id} onChange={e => setEditingJail({...editingJail, name: e.target.value})} placeholder="ej. wp-login" style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--bg-secondary)', color: 'var(--text-primary)', fontSize: '1rem' }} />
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', marginTop: '24px' }}>
                                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
                                    <input type="checkbox" checked={editingJail.enabled} onChange={e => setEditingJail({...editingJail, enabled: e.target.checked})} style={{ width: '18px', height: '18px' }} />
                                    Activar Jail inmediatamente
                                </label>
                            </div>
                        </div>
                        <div>
                            <label style={{ display: 'block', color: 'var(--text-secondary)', fontSize: '0.875rem', marginBottom: '6px' }}>Log Path (Ruta de registros a escanear)</label>
                            <input required value={editingJail.log_path} onChange={e => setEditingJail({...editingJail, log_path: e.target.value})} placeholder="/var/log/nginx/access.log" style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--bg-secondary)', color: 'var(--text-primary)', fontSize: '1rem' }} />
                        </div>
                        <div style={{ display: 'flex', gap: '16px' }}>
                            <div style={{ flex: 1 }}>
                                <label style={{ display: 'block', color: 'var(--text-secondary)', fontSize: '0.875rem', marginBottom: '6px' }}>Max Retry</label>
                                <input required type="number" value={editingJail.maxretry} onChange={e => setEditingJail({...editingJail, maxretry: parseInt(e.target.value)})} style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--bg-secondary)', color: 'var(--text-primary)' }} />
                            </div>
                            <div style={{ flex: 1 }}>
                                <label style={{ display: 'block', color: 'var(--text-secondary)', fontSize: '0.875rem', marginBottom: '6px' }}>Find Time (s)</label>
                                <input required type="number" value={editingJail.findtime} onChange={e => setEditingJail({...editingJail, findtime: parseInt(e.target.value)})} style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--bg-secondary)', color: 'var(--text-primary)' }} />
                            </div>
                            <div style={{ flex: 1 }}>
                                <label style={{ display: 'block', color: 'var(--text-secondary)', fontSize: '0.875rem', marginBottom: '6px' }}>Ban Time (s)</label>
                                <input required type="number" value={editingJail.bantime} onChange={e => setEditingJail({...editingJail, bantime: parseInt(e.target.value)})} style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--bg-secondary)', color: 'var(--text-primary)' }} />
                            </div>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '16px' }}>
                            <button type="button" className="btn small" onClick={() => setActiveTab('jails')}>Cancelar</button>
                            <button type="submit" className="btn primary">💾 Guardar Jail</button>
                        </div>
                    </form>
                </div>
            )}
        </div>
    );
}

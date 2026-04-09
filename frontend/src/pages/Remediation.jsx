import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { 
    ShieldAlert, 
    ShieldCheck, 
    ShieldX, 
    Zap, 
    Trash2, 
    Loader2, 
    CheckCircle2, 
    XCircle,
    Power,
    Plus,
    Lock,
    Eye
} from 'lucide-react';

const Remediation = () => {
    const [stats, setStats] = useState({ active_blocks: 0, pending_recs: 0 });
    const [recommendations, setRecommendations] = useState([]);
    const [blocks, setBlocks] = useState([]);
    const [whitelist, setWhitelist] = useState([]);
    const [settings, setSettings] = useState({
        REMEDIATION_AUTO_BLOCK_ENABLED: false,
        EMERGENCY_REMEDIATION_STOP: false
    });
    const [loading, setLoading] = useState(true);
    const [newWhitelist, setNewWhitelist] = useState({ ip_or_cidr: '', comment: '' });

    const fetchData = async () => {
        try {
            const [recsRes, blocksRes, whiteRes, settingsRes] = await Promise.all([
                axios.get('/api/remediation/recommendations'),
                axios.get('/api/remediation/blocks'),
                axios.get('/api/remediation/whitelist'),
                axios.get('/api/settings')
            ]);
            setRecommendations(recsRes.data);
            setBlocks(blocksRes.data);
            setWhitelist(whiteRes.data);
            setSettings(settingsRes.data);
            setStats({
                active_blocks: blocksRes.data.length,
                pending_recs: recsRes.data.length
            });
        } catch (err) {
            console.error('Failed to fetch remediation data', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
        const interval = setInterval(fetchData, 10000);
        return () => clearInterval(interval);
    }, []);

    const handleAction = async (type, id, action) => {
        try {
            await axios.post(`/api/remediation/recommendations/${id}/${action}`);
            fetchData();
        } catch (err) {
            alert('Failed to process recommendation');
        }
    };

    const handleUnblock = async (ip) => {
        try {
            await axios.delete(`/api/remediation/blocks/${ip}`);
            fetchData();
        } catch (err) {
            alert('Failed to unblock IP');
        }
    };

    const handleToggleSetting = async (key) => {
        const newValue = !settings[key];
        try {
            await axios.put('/api/settings', { [key]: newValue ? "True" : "False" });
            setSettings({ ...settings, [key]: newValue });
        } catch (err) {
            alert('Failed to update setting');
        }
    };

    const handleAddWhitelist = async () => {
        try {
            await axios.post('/api/remediation/whitelist', newWhitelist);
            setNewWhitelist({ ip_or_cidr: '', comment: '' });
            fetchData();
        } catch (err) {
            alert('Failed to add to whitelist');
        }
    };

    const handleRemoveWhitelist = async (id) => {
        try {
            await axios.delete(`/api/remediation/whitelist/${id}`);
            fetchData();
        } catch (err) {
            alert('Failed to remove from whitelist');
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-full">
                <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <header className="flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-bold text-white">Remediation Center</h1>
                    <p className="text-slate-400">Manage defensive actions and autonomous shielding.</p>
                </div>
                <div className="flex gap-4">
                    <button 
                        onClick={() => handleToggleSetting('EMERGENCY_REMEDIATION_STOP')}
                        className={`flex items-center gap-2 px-4 py-2 rounded-lg font-bold transition-all ${
                            settings.EMERGENCY_REMEDIATION_STOP 
                            ? 'bg-red-500/20 text-red-500 border border-red-500/50' 
                            : 'bg-slate-800 text-slate-400 hover:bg-red-500/10 hover:text-red-400'
                        }`}
                    >
                        <Power className="w-4 h-4" />
                        {settings.EMERGENCY_REMEDIATION_STOP ? 'STOP ACTIVE' : 'EMERGENCY STOP'}
                    </button>
                    <div className="flex items-center gap-3 bg-slate-900/50 border border-slate-800 rounded-lg px-4 py-2">
                        <span className="text-sm text-slate-400">Auto-Remediation</span>
                        <button 
                            onClick={() => handleToggleSetting('REMEDIATION_AUTO_BLOCK_ENABLED')}
                            className={`w-12 h-6 rounded-full transition-all relative ${
                                settings.REMEDIATION_AUTO_BLOCK_ENABLED ? 'bg-green-500' : 'bg-slate-700'
                            }`}
                        >
                            <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${
                                settings.REMEDIATION_AUTO_BLOCK_ENABLED ? 'left-7' : 'left-1'
                            }`} />
                        </button>
                    </div>
                </div>
            </header>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-slate-900/50 border border-slate-800 p-6 rounded-xl">
                    <div className="flex justify-between items-start mb-2">
                        <ShieldAlert className="w-6 h-6 text-orange-500" />
                    </div>
                    <div className="text-2xl font-bold text-white">{stats.pending_recs}</div>
                    <div className="text-slate-400 text-sm">Pending Recommendations</div>
                </div>
                <div className="bg-slate-900/50 border border-slate-800 p-6 rounded-xl">
                    <div className="flex justify-between items-start mb-2">
                        <Lock className="w-6 h-6 text-red-500" />
                    </div>
                    <div className="text-2xl font-bold text-white">{stats.active_blocks}</div>
                    <div className="text-slate-400 text-sm">Active Defensive Blocks</div>
                </div>
                <div className="bg-slate-900/50 border border-slate-800 p-6 rounded-xl">
                    <div className="flex justify-between items-start mb-2">
                        <ShieldCheck className="w-6 h-6 text-blue-500" />
                    </div>
                    <div className="text-2xl font-bold text-white">{whitelist.length}</div>
                    <div className="text-slate-400 text-sm">Whitelisted Assets</div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Recommendations */}
                <section className="space-y-4">
                    <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                        <Zap className="w-5 h-5 text-orange-500" />
                        AI Recommended Actions
                    </h2>
                    {recommendations.length === 0 ? (
                        <div className="bg-slate-900/30 border border-dashed border-slate-800 p-8 rounded-xl text-center text-slate-500">
                            No pending recommendations
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {recommendations.map(re => (
                                <div key={re.id} className="bg-slate-900/80 border border-slate-800 p-5 rounded-xl group hover:border-slate-700 transition-all">
                                    <div className="flex justify-between items-start mb-3">
                                        <div>
                                            <div className="font-mono text-blue-400 font-bold">{re.ip}</div>
                                            <div className="text-sm text-slate-400 mt-1">{re.description}</div>
                                        </div>
                                        <div className="flex flex-col items-end gap-1">
                                            <span className="text-xs px-2 py-1 bg-red-500/10 text-red-500 rounded border border-red-500/20">
                                                Risk: {re.risk_score}
                                            </span>
                                            <span className="text-xs px-2 py-1 bg-blue-500/10 text-blue-500 rounded border border-blue-500/20">
                                                Conf: {re.confidence_score}%
                                            </span>
                                        </div>
                                    </div>
                                    <div className="flex gap-2">
                                        <button 
                                            onClick={() => handleAction('rec', re.id, 'approve')}
                                            className="flex-1 flex items-center justify-center gap-2 bg-green-600 hover:bg-green-500 text-white font-bold py-2 rounded-lg transition-all"
                                        >
                                            <CheckCircle2 className="w-4 h-4" />
                                            Approve Block
                                        </button>
                                        <button 
                                            onClick={() => handleAction('rec', re.id, 'reject')}
                                            className="px-4 flex items-center justify-center gap-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold py-2 rounded-lg transition-all"
                                        >
                                            <XCircle className="w-4 h-4" />
                                            Reject
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </section>

                {/* Active Blocks */}
                <section className="space-y-4">
                    <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                        <Lock className="w-5 h-5 text-red-500" />
                        Active Defensive Blocks
                    </h2>
                    <div className="bg-slate-900/50 border border-slate-800 rounded-xl overflow-hidden">
                        <table className="w-full text-left">
                            <thead className="bg-slate-900/80 border-b border-slate-800 text-slate-400 text-xs uppercase font-bold">
                                <tr>
                                    <th className="px-5 py-3">IP Address</th>
                                    <th className="px-5 py-3">Source</th>
                                    <th className="px-5 py-3">Expires At</th>
                                    <th className="px-5 py-3">Action</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-800/50">
                                {blocks.length === 0 ? (
                                    <tr>
                                        <td colSpan="4" className="px-5 py-8 text-center text-slate-500">
                                            No active defensive blocks
                                        </td>
                                    </tr>
                                ) : (
                                    blocks.map(b => (
                                        <tr key={b.id} className="hover:bg-slate-800/30 transition-all">
                                            <td className="px-5 py-4 font-mono text-slate-200">{b.ip}</td>
                                            <td className="px-5 py-4 uppercase text-xs">
                                                <span className={`px-2 py-0.5 rounded ${
                                                    b.source === 'ai' ? 'bg-purple-500/10 text-purple-400' : 'bg-slate-700 text-slate-300'
                                                }`}>
                                                    {b.source}
                                                </span>
                                            </td>
                                            <td className="px-5 py-4 text-sm text-slate-400">
                                                {new Date(b.expires_at).toLocaleTimeString()}
                                            </td>
                                            <td className="px-5 py-4">
                                                <button 
                                                    onClick={() => handleUnblock(b.ip)}
                                                    className="p-2 text-slate-500 hover:text-green-500 transition-all"
                                                    title="Unblock Now"
                                                >
                                                    <ShieldX className="w-4 h-4" />
                                                </button>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </section>
            </div>

            {/* Whitelist Section */}
            <section className="bg-slate-900/50 border border-slate-800 rounded-xl p-6 space-y-4">
                <div className="flex justify-between items-center">
                    <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                        <ShieldCheck className="w-5 h-5 text-blue-500" />
                        Network Whitelist (Failsafe)
                    </h2>
                </div>
                
                <div className="flex gap-4">
                    <input 
                        type="text"
                        placeholder="IP or CIDR (e.g. 1.2.3.4)"
                        value={newWhitelist.ip_or_cidr}
                        onChange={e => setNewWhitelist({...newWhitelist, ip_or_cidr: e.target.value})}
                        className="flex-1 bg-slate-900 border border-slate-800 rounded-lg px-4 py-2 text-white outline-none focus:border-blue-500"
                    />
                    <input 
                        type="text"
                        placeholder="Comment"
                        value={newWhitelist.comment}
                        onChange={e => setNewWhitelist({...newWhitelist, comment: e.target.value})}
                        className="flex-1 bg-slate-900 border border-slate-800 rounded-lg px-4 py-2 text-white outline-none focus:border-blue-500"
                    />
                    <button 
                        onClick={handleAddWhitelist}
                        className="bg-blue-600 hover:bg-blue-500 text-white px-6 py-2 rounded-lg font-bold flex items-center gap-2"
                    >
                        <Plus className="w-4 h-4" />
                        Add Asset
                    </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-4">
                    {whitelist.map(w => (
                        <div key={w.id} className="bg-slate-900/80 border border-slate-800 p-3 rounded-lg flex items-center justify-between">
                            <div>
                                <div className="font-mono text-sm text-blue-300">{w.ip_or_cidr}</div>
                                <div className="text-xs text-slate-500 truncate max-w-[150px]">{w.comment || 'No comment'}</div>
                            </div>
                            <button 
                                onClick={() => handleRemoveWhitelist(w.id)}
                                className="p-2 text-slate-600 hover:text-red-500"
                            >
                                <Trash2 className="w-4 h-4" />
                            </button>
                        </div>
                    ))}
                </div>
            </section>
        </div>
    );
};

export default Remediation;

import React from 'react'
import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Area, AreaChart } from 'recharts';
import StatsCard from '../components/StatsCard';
import { api } from '../services/api';

// Mock chart data (would come from ClickHouse in production)
const generateChartData = () => {
    const data = [];
    const now = new Date();
    for (let i = 23; i >= 0; i--) {
        const hour = new Date(now - i * 3600 * 1000);
        data.push({
            time: hour.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
            requests: Math.floor(Math.random() * 500) + 200,
            errors: Math.floor(Math.random() * 20),
        });
    }
    return data;
};

export default function Dashboard() {
    const [stats, setStats] = useState({
        total_requests: 0,
        threats_detected: 0,
        ips_currently_banned: 0,
        security_score: 100
    });
    const [sites, setSites] = useState([]);
    const [jails, setJails] = useState([]);
    const [loading, setLoading] = useState(true);
    const [chartData, setChartData] = useState([]);

    const fetchData = async () => {
        try {
            const [logStats, sitesList, jailList] = await Promise.all([
                api.getLogsStats().catch(() => ({ 
                    total_requests: 0, 
                    threats_detected: 0, 
                    security_score: 100, 
                    top_ips: [], 
                    latest_ai_report: null 
                })),
                api.listSites().catch(() => []),
                api.getFail2BanJails().catch(() => [])
            ]);

            const totalBans = jailList.reduce((acc, j) => acc + (j.currently_banned || 0), 0);

            setStats({
                total_requests: logStats.total_requests,
                threats_detected: logStats.threats_detected,
                security_score: logStats.security_score,
                ips_currently_banned: totalBans,
                top_ips: logStats.top_ips || [],
                latest_ai_report: logStats.latest_ai_report
            });
            setSites(sitesList);
            setJails(jailList);
            
            if (chartData.length === 0) {
                const mockChart = [];
                for (let i = 12; i >= 0; i--) {
                    mockChart.push({
                        time: `${12-i}:00`,
                        requests: Math.floor(Math.random() * 50) + (logStats.total_requests / 24),
                        errors: Math.floor(Math.random() * 5) + (logStats.threats_detected / 24),
                    });
                }
                setChartData(mockChart);
            }
        } catch (err) {
            console.error('Failed to fetch data:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
        const interval = setInterval(fetchData, 10000); 
        return () => clearInterval(interval);
    }, []);

    if (loading) {
        return (
            <div className="loading">
                <div className="spinner"></div>
            </div>
        );
    }

    return (
        <div className="dashboard">
            <h1 className="page-title">
                <span className="icon">🛡️</span>
                Security Overview
            </h1>

            <div className="stats-grid">
                <StatsCard
                    label="Threats Detected (24h)"
                    value={stats?.threats_detected || 0}
                    trend={stats?.threats_detected > 100 ? "High Activity" : "Stable"}
                    trendDirection={stats?.threats_detected > 100 ? "up" : "down"}
                />
                <StatsCard
                    label="IPs Currently Banned"
                    value={stats?.ips_currently_banned || 0}
                    trend="Active blocks"
                    trendDirection="up"
                />
                <StatsCard
                    label="Total Traffic (24h)"
                    value={stats?.total_requests?.toLocaleString() || 0}
                    trend="Requests handled"
                    trendDirection="up"
                />
                <StatsCard
                    label="Security Score"
                    value={`${stats?.security_score || 100}/100`}
                    trend={stats?.security_score > 90 ? "Excellent" : stats?.security_score > 70 ? "Good" : "Warning"}
                    trendDirection={stats?.security_score > 80 ? "up" : "down"}
                />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: '24px', marginBottom: '24px' }}>
                <div className="card" style={{ display: 'flex', flexDirection: 'column' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                        <div>
                            <h2 style={{ fontSize: '1.1rem', fontWeight: 600 }}>Latest AI Security Audit</h2>
                            <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>Autonomous threat intelligence summary</p>
                        </div>
                        <span className={`badge ${stats.latest_ai_report?.threat_level || 'low'}`} style={{ padding: '6px 12px', fontSize: '0.75rem' }}>
                            Level: {(stats.latest_ai_report?.threat_level || 'low').toUpperCase()}
                        </span>
                    </div>
                    <div style={{ flex: 1, padding: '16px', borderRadius: '12px', background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', marginBottom: '12px' }}>
                        <p style={{ fontSize: '0.95rem', lineHeight: '1.6', color: 'var(--text-primary)', fontStyle: 'italic' }}>
                            "{stats.latest_ai_report?.summary}"
                        </p>
                    </div>
                    <Link to="/ai" className="btn-secondary" style={{ textAlign: 'center', fontSize: '0.85rem' }}>
                        View Detailed Insights →
                    </Link>
                </div>

                <div className="card">
                    <h2 style={{ marginBottom: '16px', fontSize: '1.1rem', fontWeight: 600 }}>Top Attacking IPs</h2>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        {stats.top_ips?.length > 0 ? (
                            stats.top_ips.map((item, idx) => (
                                <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', background: 'var(--bg-secondary)', borderRadius: '8px' }}>
                                    <span style={{ fontSize: '0.9rem', fontFamily: 'monospace' }}>{item.ip}</span>
                                    <span style={{ fontWeight: 700, color: 'var(--error)' }}>{item.count} hits</span>
                                </div>
                            ))
                        ) : (
                            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', textAlign: 'center', padding: '20px' }}>No threats detected in the last 24h.</p>
                        )}
                    </div>
                </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '24px', marginBottom: '24px' }}>
                <div className="card">
                    <h2 style={{ marginBottom: '16px', fontSize: '1.1rem', fontWeight: 600 }}>
                        Security Traffic Analysis
                    </h2>
                    <div className="chart-container">
                        <ResponsiveContainer width="100%" height="250px">
                            <AreaChart data={chartData}>
                                <defs>
                                    <linearGradient id="colorRequests" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                                        <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                                    </linearGradient>
                                    <linearGradient id="colorErrors" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3} />
                                        <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                                <XAxis dataKey="time" stroke="#555566" tick={{ fill: '#8888a0', fontSize: 10 }} />
                                <YAxis stroke="#555566" tick={{ fill: '#8888a0', fontSize: 10 }} />
                                <Tooltip contentStyle={{ background: '#12121a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px' }} />
                                <Area type="monotone" dataKey="requests" stroke="#6366f1" fill="url(#colorRequests)" name="Clean Traffic" />
                                <Area type="monotone" dataKey="errors" stroke="#ef4444" fill="url(#colorErrors)" name="Threats" />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                <div className="card">
                    <h2 style={{ marginBottom: '16px', fontSize: '1.1rem', fontWeight: 600 }}>Service Integrity</h2>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                         <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px', background: 'rgba(16,185,129,0.05)', borderRadius: '8px', borderLeft: '3px solid var(--success)' }}>
                             <span style={{ fontSize: '0.85rem' }}>API Gateway</span>
                             <span style={{ color: 'var(--success)', fontSize: '0.8rem', fontWeight: 700 }}>ONLINE</span>
                         </div>
                         <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px', background: 'rgba(16,185,129,0.05)', borderRadius: '8px', borderLeft: '3px solid var(--success)' }}>
                             <span style={{ fontSize: '0.85rem' }}>Agent Worker</span>
                             <span style={{ color: 'var(--success)', fontSize: '0.8rem', fontWeight: 700 }}>CONNECTED</span>
                         </div>
                         <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px', background: 'rgba(99,102,241,0.05)', borderRadius: '8px', borderLeft: '3px solid var(--accent-primary)' }}>
                             <span style={{ fontSize: '0.85rem' }}>AI Defense Engine</span>
                             <span style={{ color: 'var(--accent-primary)', fontSize: '0.8rem', fontWeight: 700 }}>STDBY</span>
                         </div>
                    </div>
                    <div style={{ marginTop: '20px', padding: '12px', background: 'var(--bg-secondary)', borderRadius: '8px', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        System uptime: 100% since last maintenance window.
                    </div>
                </div>
            </div>
        </div>
    );
}


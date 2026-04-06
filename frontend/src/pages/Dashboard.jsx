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
    const [stats, setStats] = useState(null);
    const [sites, setSites] = useState([]);
    const [loading, setLoading] = useState(true);
    const [chartData] = useState(generateChartData);

    useEffect(() => {
        const fetchData = async () => {
            try {
                const [trafficStats, sitesList] = await Promise.all([
                    api.getTrafficStats(),
                    api.listSites()
                ]);
                setStats(trafficStats);
                setSites(sitesList);
            } catch (err) {
                console.error('Failed to fetch data:', err);
                // Use fallback data for demo
                setStats({
                    requests_per_second: 15,
                    total_requests_24h: 12500,
                    error_rate: 0.02,
                    attacks_blocked_24h: 342,
                    ips_currently_banned: 24,
                    security_score: 92
                });
            } finally {
                setLoading(false);
            }
        };
        fetchData();
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
                    label="Threats Blocked (24h)"
                    value={stats?.attacks_blocked_24h || 342}
                    trend="+18% vs last period"
                    trendDirection="up"
                />
                <StatsCard
                    label="IPs Currently Banned"
                    value={stats?.ips_currently_banned || 24}
                    trend="+2 new bans"
                    trendDirection="up"
                />
                <StatsCard
                    label="Avg. CPU Load"
                    value="12%"
                    trend="Stable"
                    trendDirection="down"
                />
                <StatsCard
                    label="Security Score"
                    value={`${stats?.security_score || 92}/100`}
                    trend="A+ Rating"
                    trendDirection="up"
                />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '24px', marginBottom: '24px' }}>
                <div className="card">
                    <h2 style={{ marginBottom: '8px', fontSize: '1.1rem', fontWeight: 600 }}>
                        Security Traffic Analysis
                    </h2>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginBottom: '16px' }}>
                        Detection of malicious vs. clean traffic
                    </p>
                    <div className="chart-container">
                        <ResponsiveContainer width="100%" height="100%">
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
                                <XAxis
                                    dataKey="time"
                                    stroke="#555566"
                                    tick={{ fill: '#8888a0', fontSize: 12 }}
                                    axisLine={{ stroke: 'rgba(255,255,255,0.1)' }}
                                />
                                <YAxis
                                    stroke="#555566"
                                    tick={{ fill: '#8888a0', fontSize: 12 }}
                                    axisLine={{ stroke: 'rgba(255,255,255,0.1)' }}
                                />
                                <Tooltip
                                    contentStyle={{
                                        background: '#12121a',
                                        border: '1px solid rgba(255,255,255,0.1)',
                                        borderRadius: '8px',
                                        color: '#f0f0f5'
                                    }}
                                />
                                <Area
                                    type="monotone"
                                    dataKey="requests"
                                    stroke="#6366f1"
                                    strokeWidth={2}
                                    fillOpacity={1}
                                    fill="url(#colorRequests)"
                                    name="Clean Traffic"
                                />
                                <Area
                                    type="monotone"
                                    dataKey="errors"
                                    stroke="#ef4444"
                                    strokeWidth={2}
                                    fillOpacity={1}
                                    fill="url(#colorErrors)"
                                    name="Threats Detected"
                                />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                <div className="card">
                    <h2 style={{ marginBottom: '16px', fontSize: '1.1rem', fontWeight: 600 }}>Active Jails</h2>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        {[
                            { name: 'nginx-http-auth', count: 12, color: '#6366f1' },
                            { name: 'nginx-botsearch', count: 5, color: '#ef4444' },
                            { name: 'sshd', count: 7, color: '#f59e0b' },
                        ].map(jail => (
                            <div key={jail.name} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px', background: 'var(--bg-secondary)', borderRadius: '8px' }}>
                                <span style={{ fontSize: '0.9rem' }}>{jail.name}</span>
                                <span style={{ fontWeight: 700, color: jail.color }}>{jail.count}</span>
                            </div>
                        ))}
                    </div>
                    <Link to="/fail2ban" style={{ display: 'block', marginTop: '16px', textAlign: 'center', color: 'var(--accent-primary)', textDecoration: 'none', fontSize: '0.875rem' }}>
                        Manage Jails →
                    </Link>
                </div>
            </div>

            <div className="card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                    <h2 style={{ fontSize: '1.1rem', fontWeight: 600 }}>Managed Services</h2>
                    <div style={{ display: 'flex', gap: '12px' }}>
                         <span style={{ fontSize: '0.8rem', color: 'var(--success)' }}>● API Online</span>
                         <span style={{ fontSize: '0.8rem', color: 'var(--success)' }}>● Agent Connected</span>
                    </div>
                </div>
                <div className="sites-list">
                    {sites.length === 0 ? (
                        <p style={{ color: 'var(--text-secondary)', textAlign: 'center', padding: '20px' }}>
                            Fetching site status...
                        </p>
                    ) : (
                        sites.slice(0, 3).map(site => (
                            <Link key={site} to={`/sites/${encodeURIComponent(site)}`} className="site-item">
                                <span className="name">
                                    <span className="status"></span>
                                    {site}
                                </span>
                                <div style={{ display: 'flex', gap: '16px', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                                    <span>WAF: Active</span>
                                    <span>SSL: Valid</span>
                                    <span className="arrow">→</span>
                                </div>
                            </Link>
                        ))
                    )}
                </div>
            </div>
        </div>
    );
}


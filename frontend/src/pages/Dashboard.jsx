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
                    error_rate: 0.02
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
                <span className="icon">📊</span>
                Dashboard
            </h1>

            <div className="stats-grid">
                <StatsCard
                    label="Requests / Second"
                    value={stats?.requests_per_second || 0}
                    trend="+12% vs last hour"
                    trendDirection="up"
                />
                <StatsCard
                    label="Total Requests (24h)"
                    value={(stats?.total_requests_24h || 0).toLocaleString()}
                    trend="+5% vs yesterday"
                    trendDirection="up"
                />
                <StatsCard
                    label="Error Rate"
                    value={`${((stats?.error_rate || 0) * 100).toFixed(1)}%`}
                    trend="-0.3% vs last hour"
                    trendDirection="down"
                />
            </div>

            <div className="card">
                <h2 style={{ marginBottom: '8px', fontSize: '1.1rem', fontWeight: 600 }}>
                    Traffic Overview - Last 24 Hours
                </h2>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginBottom: '16px' }}>
                    Requests and errors per hour
                </p>
                <div className="chart-container">
                    <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={chartData}>
                            <defs>
                                <linearGradient id="colorRequests" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
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
                            />
                            <Line
                                type="monotone"
                                dataKey="errors"
                                stroke="#ef4444"
                                strokeWidth={2}
                                dot={false}
                            />
                        </AreaChart>
                    </ResponsiveContainer>
                </div>
            </div>

            <div className="card" style={{ marginTop: '24px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                    <h2 style={{ fontSize: '1.1rem', fontWeight: 600 }}>Active Sites</h2>
                    <Link to="/sites" style={{ color: 'var(--accent-primary)', textDecoration: 'none', fontSize: '0.875rem' }}>
                        View all →
                    </Link>
                </div>
                <div className="sites-list">
                    {sites.length === 0 ? (
                        <p style={{ color: 'var(--text-secondary)', textAlign: 'center', padding: '20px' }}>
                            No sites configured yet
                        </p>
                    ) : (
                        sites.slice(0, 5).map(site => (
                            <Link key={site} to={`/sites/${encodeURIComponent(site)}`} className="site-item">
                                <span className="name">
                                    <span className="status"></span>
                                    {site}
                                </span>
                                <span className="arrow">→</span>
                            </Link>
                        ))
                    )}
                </div>
            </div>
        </div>
    );
}

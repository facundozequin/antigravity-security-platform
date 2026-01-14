import React from 'react'
export default function StatsCard({ label, value, trend, trendDirection }) {
    return (
        <div className="card stats-card">
            <div className="label">{label}</div>
            <div className="value">{value}</div>
            {trend && (
                <div className={`trend ${trendDirection}`}>
                    <span>{trendDirection === 'up' ? '↑' : '↓'}</span>
                    <span>{trend}</span>
                </div>
            )}
        </div>
    );
}

import React from 'react'
import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../services/api';

export default function Sites() {
    const [sites, setSites] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        const fetchSites = async () => {
            try {
                const data = await api.listSites();
                setSites(data);
            } catch (err) {
                setError('Failed to load sites');
                console.error(err);
            } finally {
                setLoading(false);
            }
        };
        fetchSites();
    }, []);

    if (loading) {
        return (
            <div className="loading">
                <div className="spinner"></div>
            </div>
        );
    }

    return (
        <div className="sites-page">
            <h1 className="page-title">
                <span className="icon">🌐</span>
                Sites Configuration
            </h1>

            {error && (
                <div className="card" style={{ borderColor: 'var(--error)', marginBottom: '24px' }}>
                    <p style={{ color: 'var(--error)' }}>⚠️ {error}</p>
                </div>
            )}

            <div className="card">
                <p style={{ color: 'var(--text-secondary)', marginBottom: '20px' }}>
                    Manage your Nginx server configurations. Click on a site to view its configuration.
                </p>

                <div className="sites-list">
                    {sites.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: '40px' }}>
                            <p style={{ fontSize: '3rem', marginBottom: '16px' }}>📁</p>
                            <p style={{ color: 'var(--text-secondary)' }}>No configuration files found</p>
                            <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginTop: '8px' }}>
                                Add .conf files to /etc/nginx/sites-enabled/
                            </p>
                        </div>
                    ) : (
                        sites.map(site => (
                            <Link
                                key={site}
                                to={`/sites/${encodeURIComponent(site)}`}
                                className="site-item"
                            >
                                <span className="name">
                                    <span className="status"></span>
                                    <span>{site}</span>
                                </span>
                                <span className="arrow">→</span>
                            </Link>
                        ))
                    )}
                </div>
            </div>

            <style>{`
        .sites-page .sites-list .site-item .name {
          display: flex;
          align-items: center;
          gap: 12px;
        }
      `}</style>
        </div>
    );
}

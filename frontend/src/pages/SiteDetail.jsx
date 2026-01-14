import React from 'react'
import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import ConfigViewer from '../components/ConfigViewer';
import { api } from '../services/api';

export default function SiteDetail() {
    const { filename } = useParams();
    const [config, setConfig] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        const fetchConfig = async () => {
            try {
                const data = await api.getSite(filename);
                setConfig(data);
            } catch (err) {
                setError(err.message);
            } finally {
                setLoading(false);
            }
        };
        fetchConfig();
    }, [filename]);

    if (loading) {
        return (
            <div className="loading">
                <div className="spinner"></div>
            </div>
        );
    }

    return (
        <div className="site-detail">
            <div style={{ marginBottom: '24px' }}>
                <Link
                    to="/sites"
                    style={{
                        color: 'var(--text-secondary)',
                        textDecoration: 'none',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '8px',
                        marginBottom: '12px',
                        transition: 'color var(--transition-fast)'
                    }}
                    onMouseOver={(e) => e.target.style.color = 'var(--accent-primary)'}
                    onMouseOut={(e) => e.target.style.color = 'var(--text-secondary)'}
                >
                    ← Back to Sites
                </Link>
                <h1 className="page-title">
                    <span className="icon">📄</span>
                    {decodeURIComponent(filename)}
                </h1>
            </div>

            {error ? (
                <div className="card" style={{ borderColor: 'var(--error)' }}>
                    <h3 style={{ color: 'var(--error)', marginBottom: '8px' }}>Error Loading Configuration</h3>
                    <p style={{ color: 'var(--text-secondary)' }}>{error}</p>
                </div>
            ) : (
                <>
                    <div className="card" style={{ marginBottom: '24px', padding: '16px 20px' }}>
                        <div style={{ display: 'flex', gap: '32px', flexWrap: 'wrap' }}>
                            <div>
                                <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem', textTransform: 'uppercase' }}>
                                    Format
                                </span>
                                <p style={{ fontWeight: 500 }}>{config?.format_type || 'nginx-conf'}</p>
                            </div>
                            <div>
                                <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem', textTransform: 'uppercase' }}>
                                    Lines
                                </span>
                                <p style={{ fontWeight: 500 }}>{config?.content?.split('\n').length || 0}</p>
                            </div>
                        </div>
                    </div>

                    <ConfigViewer
                        filename={config?.filename || filename}
                        content={config?.content}
                    />
                </>
            )}
        </div>
    );
}

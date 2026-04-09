import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';

export default function Reports() {
    const { token } = useAuth();
    const [reports, setReports] = useState([]);
    const [schedules, setSchedules] = useState([]);
    const [loading, setLoading] = useState(true);
    const [generating, setGenerating] = useState(false);
    
    const [newSchedule, setNewSchedule] = useState({
        report_type: 'daily',
        frequency: '0 0 * * *' // Default daily at midnight
    });

    useEffect(() => {
        fetchData();
        const interval = setInterval(fetchData, 10000); // Polling for status updates
        return () => clearInterval(interval);
    }, []);

    const fetchData = async () => {
        try {
            const [reportsRes, schedulesRes] = await Promise.all([
                axios.get('/api/reports/', { headers: { Authorization: `Bearer ${token}` } }),
                axios.get('/api/reports/schedules', { headers: { Authorization: `Bearer ${token}` } })
            ]);
            setReports(reportsRes.data);
            setSchedules(schedulesRes.data);
            setLoading(false);
        } catch (err) {
            console.error("Failed to fetch reports:", err);
        }
    };

    const handleManualReport = async () => {
        setGenerating(true);
        try {
            await axios.post('/api/reports/manual', {}, { headers: { Authorization: `Bearer ${token}` } });
            fetchData();
        } catch (err) {
            alert("Failed to trigger report generation");
        } finally {
            setGenerating(false);
        }
    };

    const handleCreateSchedule = async (e) => {
        e.preventDefault();
        try {
            await axios.post('/api/reports/schedules', newSchedule, { headers: { Authorization: `Bearer ${token}` } });
            fetchData();
        } catch (err) {
            alert("Failed to create schedule");
        }
    };

    const handleDeleteSchedule = async (id) => {
        try {
            await axios.delete(`/api/reports/schedules/${id}`, { headers: { Authorization: `Bearer ${token}` } });
            fetchData();
        } catch (err) {
            alert("Failed to delete schedule");
        }
    };

    const handleDownload = async (reportId, filename) => {
        try {
            const response = await axios.get(`/api/reports/download/${reportId}`, {
                headers: { Authorization: `Bearer ${token}` },
                responseType: 'blob'
            });
            const url = window.URL.createObjectURL(new Blob([response.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', filename || `report_${reportId}.pdf`);
            document.body.appendChild(link);
            link.click();
        } catch (err) {
            alert("Download failed. Report might still be processing.");
        }
    };

    if (loading) return <div className="p-6">Loading Reporting Center...</div>;

    return (
        <div className="reports-container">
            <header className="page-header">
                <div>
                    <h1>Forensic Reporting Center</h1>
                    <p className="subtitle">Automated security audits and AI-driven executive forensics</p>
                </div>
                <button 
                    className="btn btn-primary" 
                    onClick={handleManualReport}
                    disabled={generating}
                >
                    {generating ? '🚀 Generating...' : '📄 Generate On-Demand Report'}
                </button>
            </header>

            <div className="reports-grid">
                {/* Schedules Section */}
                <section className="glass-card schedule-section">
                    <div className="card-header">
                        <h2><span className="icon">📅</span> Automated Schedules</h2>
                    </div>
                    
                    <form className="schedule-form" onSubmit={handleCreateSchedule}>
                        <div className="form-group">
                            <label>Report Frequency</label>
                            <select 
                                value={newSchedule.report_type}
                                onChange={(e) => setNewSchedule({...newSchedule, report_type: e.target.value})}
                            >
                                <option value="daily">Daily Audit</option>
                                <option value="weekly">Weekly Forensic</option>
                                <option value="monthly">Monthly Summary</option>
                            </select>
                        </div>
                        <div className="form-group">
                            <label>Cron Expression</label>
                            <input 
                                type="text" 
                                value={newSchedule.frequency}
                                onChange={(e) => setNewSchedule({...newSchedule, frequency: e.target.value})}
                                placeholder="0 0 * * *"
                            />
                        </div>
                        <button type="submit" className="btn btn-secondary">Add Schedule</button>
                    </form>

                    <div className="schedule-list">
                        {schedules.map(s => (
                            <div key={s.id} className="schedule-item">
                                <div className="schedule-info">
                                    <span className="badge badge-info">{s.report_type.toUpperCase()}</span>
                                    <code>{s.frequency}</code>
                                </div>
                                <button className="btn-icon delete" onClick={() => handleDeleteSchedule(s.id)}>🗑️</button>
                            </div>
                        ))}
                        {schedules.length === 0 && <p className="empty-state">No active schedules found.</p>}
                    </div>
                </section>

                {/* History Section */}
                <section className="glass-card history-section">
                    <div className="card-header">
                        <h2><span className="icon">📜</span> Report History</h2>
                    </div>
                    
                    <div className="report-list">
                        <table className="data-table">
                            <thead>
                                <tr>
                                    <th>Report ID</th>
                                    <th>Type</th>
                                    <th>Status</th>
                                    <th>Generated At</th>
                                    <th>Action</th>
                                </tr>
                            </thead>
                            <tbody>
                                {reports.map(r => (
                                    <tr key={r.id}>
                                        <td>#{r.id}</td>
                                        <td><span className={`type-tag ${r.report_type}`}>{r.report_type}</span></td>
                                        <td>
                                            <span className={`status-pill ${r.status}`}>
                                                {r.status === 'processing' && <span className="spinner">⌛</span>}
                                                {r.status}
                                            </span>
                                        </td>
                                        <td>{new Date(r.created_at).toLocaleString()}</td>
                                        <td>
                                            {r.status === 'ready' && (
                                                <button 
                                                    className="btn-link"
                                                    onClick={() => handleDownload(r.id, `antigravity_report_${r.id}.pdf`)}
                                                >
                                                    ⬇️ Download
                                                </button>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                        {reports.length === 0 && <p className="empty-state">No reports generated yet.</p>}
                    </div>
                </section>
            </div>

            <style>{`
                .reports-container {
                    padding: 24px;
                    color: var(--text-primary);
                }

                .page-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 32px;
                }

                .subtitle {
                    color: var(--text-secondary);
                    font-size: 0.95rem;
                }

                .reports-grid {
                    display: grid;
                    grid-template-columns: 350px 1fr;
                    gap: 24px;
                }

                .glass-card {
                    background: var(--bg-card);
                    border: 1px solid var(--border-color);
                    border-radius: var(--border-radius-lg);
                    padding: 24px;
                }

                .card-header h2 {
                    font-size: 1.25rem;
                    margin-bottom: 20px;
                    display: flex;
                    align-items: center;
                    gap: 12px;
                }

                .schedule-form {
                    display: flex;
                    flex-direction: column;
                    gap: 16px;
                    padding-bottom: 24px;
                    border-bottom: 1px solid var(--border-color);
                    margin-bottom: 24px;
                }

                .form-group label {
                    display: block;
                    font-size: 0.85rem;
                    color: var(--text-secondary);
                    margin-bottom: 8px;
                }

                .form-group input, .form-group select {
                    width: 100%;
                    background: var(--bg-body);
                    border: 1px solid var(--border-color);
                    color: var(--text-primary);
                    padding: 10px;
                    border-radius: var(--border-radius-sm);
                }

                .schedule-list {
                    display: flex;
                    flex-direction: column;
                    gap: 12px;
                }

                .schedule-item {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    background: var(--bg-body);
                    padding: 12px;
                    border-radius: var(--border-radius-sm);
                }

                .schedule-info {
                    display: flex;
                    align-items: center;
                    gap: 12px;
                }

                .badge {
                    font-size: 0.7rem;
                    font-weight: 700;
                    padding: 4px 8px;
                    border-radius: 4px;
                }

                .badge-info { background: var(--accent-blue); color: white; }

                .status-pill {
                    padding: 4px 10px;
                    border-radius: 99px;
                    font-size: 0.8rem;
                    text-transform: capitalize;
                }

                .status-pill.ready { background: rgba(34, 197, 94, 0.1); color: #22c55e; border: 1px solid #22c55e; }
                .status-pill.processing { background: rgba(59, 130, 246, 0.1); color: #3b82f6; border: 1px solid #3b82f6; }
                .status-pill.pending { background: rgba(100, 116, 139, 0.1); color: #64748b; border: 1px solid #64748b; }
                .status-pill.failed { background: rgba(239, 68, 68, 0.1); color: #ef4444; border: 1px solid #ef4444; }

                .type-tag {
                    font-size: 0.75rem;
                    font-weight: 600;
                    padding: 2px 6px;
                    border-radius: 4px;
                    background: var(--bg-body);
                }

                .empty-state {
                    text-align: center;
                    color: var(--text-muted);
                    padding: 32px 0;
                    font-style: italic;
                }

                .btn-link {
                    background: none;
                    border: none;
                    color: #3b82f6;
                    cursor: pointer;
                    font-weight: 600;
                }

                .btn-link:hover { text-decoration: underline; }

                .spinner {
                    display: inline-block;
                    animation: spin 2s linear infinite;
                    margin-right: 6px;
                }

                @keyframes spin {
                    from { transform: rotate(0deg); }
                    to { transform: rotate(360deg); }
                }

                @media (max-width: 1024px) {
                    .reports-grid { grid-template-columns: 1fr; }
                }
            `}</style>
        </div>
    );
}

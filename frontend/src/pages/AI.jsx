import React, { useState, useEffect, useRef } from 'react';
import { api } from '../services/api';

const MOCK_CHAT = [
    { role: 'assistant', content: '¡Hola! Soy el asistente de seguridad de Antigravity. Puedo ayudarte a analizar logs, explicar ataques o recomendar reglas. También puedes revisar los reportes automáticos en la pestaña "Security Audits".' }
];

export default function AI() {
    const [activeTab, setActiveTab] = useState('chat'); // 'chat' or 'audits'
    const [messages, setMessages] = useState(MOCK_CHAT);
    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(false);
    const [reports, setReports] = useState([]);
    const [selectedReport, setSelectedReport] = useState(null);
    const [insights, setInsights] = useState([]);
    const chatEndRef = useRef(null);

    const scrollToBottom = () => {
        chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(() => {
        if (activeTab === 'chat') scrollToBottom();
    }, [messages, activeTab]);

    useEffect(() => {
        if (activeTab === 'audits') {
            loadReports();
        }
    }, [activeTab]);

    const loadReports = async () => {
        setLoading(true);
        try {
            const data = await api.getAIReports();
            setReports(data || []);
        } catch (err) {
            console.error("Failed to load reports", err);
        } finally {
            setLoading(false);
        }
    };

    const loadReportDetails = async (report) => {
        setSelectedReport(report);
        setLoading(true);
        try {
            const data = await api.getAIReportInsights(report.id);
            setInsights(data || []);
        } catch (err) {
            setInsights([]);
        } finally {
            setLoading(false);
        }
    };

    const handleSend = async (e) => {
        e.preventDefault();
        if (!input.trim() || loading) return;

        const userMsg = { role: 'user', content: input };
        setMessages(prev => [...prev, userMsg]);
        setInput('');
        setLoading(true);

        try {
            const data = await api.chatWithAI(input);
            setMessages(prev => [...prev, { role: 'assistant', content: data.content }]);
        } catch (err) {
            setMessages(prev => [...prev, { role: 'assistant', content: "Error de conexión con el servicio de IA." }]);
        } finally {
            setLoading(false);
        }
    };

    const renderChat = () => (
        <div className="card" style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '20px', overflow: 'hidden' }}>
            <div style={{ flex: 1, overflowY: 'auto', padding: '10px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {messages.map((msg, i) => (
                    <div key={i} style={{ 
                        alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start',
                        maxWidth: '80%',
                        padding: '12px 16px',
                        borderRadius: '12px',
                        background: msg.role === 'user' ? 'var(--accent-gradient)' : 'var(--bg-secondary)',
                        color: msg.role === 'user' ? 'white' : 'var(--text-primary)',
                        border: '1px solid var(--border-color)',
                        boxShadow: 'var(--shadow-sm)'
                    }}>
                        <div style={{ fontSize: '0.7rem', marginBottom: '4px', opacity: 0.7, fontWeight: 700 }}>
                            {msg.role === 'user' ? 'VOS' : 'ANTIGRAVITY AI'}
                        </div>
                        <div style={{ lineHeight: 1.5, fontSize: '0.95rem' }}>{msg.content}</div>
                    </div>
                ))}
                {loading && (
                    <div className="skeleton" style={{ width: '40%', height: '60px', borderRadius: '12px' }}></div>
                )}
                <div ref={chatEndRef} />
            </div>

            <form onSubmit={handleSend} style={{ display: 'flex', gap: '10px', borderTop: '1px solid var(--border-color)', paddingTop: '20px' }}>
                <input 
                    value={input}
                    onChange={e => setInput(e.target.value)}
                    placeholder="Escribí tu consulta sobre seguridad..."
                    style={{ flex: 1, padding: '12px 16px', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--bg-primary)', color: 'var(--text-primary)' }}
                />
                <button disabled={loading} className="btn-save">Enviar</button>
            </form>
        </div>
    );

    const renderAudits = () => (
        <div style={{ display: 'grid', gridTemplateColumns: '350px 1fr', gap: '24px', height: '100%', overflow: 'hidden' }}>
            {/* Sidebar List */}
            <div className="card" style={{ padding: '0', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                <div style={{ padding: '16px', borderBottom: '1px solid var(--border-color)' }}>
                    <h3 style={{ margin: 0, fontSize: '0.9rem' }}>Reportes Automáticos</h3>
                </div>
                <div style={{ flex: 1, overflowY: 'auto' }}>
                    {reports.length === 0 && !loading && <div style={{ padding: '20px', opacity: 0.5, textAlign: 'center' }}>No hay reportes generados.</div>}
                    {reports.map(report => (
                        <div 
                            key={report.id} 
                            onClick={() => loadReportDetails(report)}
                            className={`report-item ${selectedReport?.id === report.id ? 'active' : ''}`}
                        >
                            <div style={{ fontWeight: 600, fontSize: '0.85rem' }}>Audit #{report.id}</div>
                            <div style={{ fontSize: '0.75rem', opacity: 0.7 }}>{new Date(report.timestamp).toLocaleString()}</div>
                            <span className={`badge badge-${report.threat_level}`}>{report.threat_level.toUpperCase()}</span>
                        </div>
                    ))}
                </div>
            </div>

            {/* Content Detail */}
            <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '20px', overflowY: 'auto' }}>
                {!selectedReport ? (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', opacity: 0.4 }}>
                        <span style={{ fontSize: '3rem' }}>📁</span>
                        <p>Seleccioná un reporte para ver los detalles</p>
                    </div>
                ) : (
                    <>
                        <div style={{ borderBottom: '1px solid var(--border-color)', pb: '16px' }}>
                            <h2 style={{ fontSize: '1.2rem', margin: '0 0 10px 0' }}>Resultados del Reporte #{selectedReport.id}</h2>
                            <div className={`badge badge-${selectedReport.threat_level}`} style={{ display: 'inline-block' }}>Nivel de Amenaza: {selectedReport.threat_level.toUpperCase()}</div>
                        </div>

                        <div>
                            <h3 style={{ fontSize: '1rem', mb: '10px' }}>Resumen Ejecutivo</h3>
                            <div style={{ 
                                padding: '16px', 
                                background: 'var(--bg-secondary)', 
                                borderRadius: '8px', 
                                border: '1px solid var(--border-color)',
                                lineHeight: 1.6,
                                whiteSpace: 'pre-wrap',
                                fontSize: '0.9rem'
                            }}>
                                {selectedReport.summary}
                            </div>
                        </div>

                        <div>
                            <h3 style={{ fontSize: '1rem', mb: '10px' }}>Security Recommendations (Advisory)</h3>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                {insights.map(insight => (
                                    <div key={insight.id} style={{ 
                                        padding: '16px', 
                                        borderRadius: '8px', 
                                        borderLeft: `4px solid var(--${insight.severity === 'warning' ? 'warning' : 'info'})`,
                                        background: 'rgba(255,255,255,0.02)',
                                        border: '1px solid var(--border-color)',
                                        borderLeftWidth: '4px'
                                    }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                                            <span style={{ fontWeight: 700, color: 'var(--accent-primary)' }}>IP: {insight.ip}</span>
                                            <span className={`badge badge-${insight.severity}`}>{insight.severity.toUpperCase()}</span>
                                        </div>
                                        <div style={{ fontSize: '0.85rem', fontWeight: 600, mb: '5px' }}>Pattern: {insight.pattern}</div>
                                        <div style={{ fontSize: '0.85rem', opacity: 0.8 }}><strong>Recommendation:</strong> {insight.recommendation}</div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </>
                )}
            </div>
        </div>
    );

    return (
        <div style={{ height: 'calc(100vh - 120px)', display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <h1 className="page-title" style={{ margin: 0 }}><span className="icon">🤖</span> Intelligence Hub</h1>
                <div className="tabs" style={{ background: 'var(--bg-secondary)', padding: '4px', borderRadius: '10px', display: 'flex', gap: '4px' }}>
                    <button 
                        onClick={() => setActiveTab('chat')}
                        className={`tab-btn ${activeTab === 'chat' ? 'active' : ''}`}
                    >💬 Advisory Chat</button>
                    <button 
                        onClick={() => setActiveTab('audits')}
                        className={`tab-btn ${activeTab === 'audits' ? 'active' : ''}`}
                    >📋 Security Audits</button>
                </div>
            </div>

            {activeTab === 'chat' ? renderChat() : renderAudits()}

            <style>{`
                .tab-btn {
                    padding: 8px 16px;
                    border: none;
                    background: transparent;
                    color: var(--text-secondary);
                    cursor: pointer;
                    border-radius: 8px;
                    font-weight: 600;
                    font-size: 0.85rem;
                    transition: all 0.2s;
                }
                .tab-btn.active {
                    background: var(--bg-primary);
                    color: var(--accent-primary);
                    box-shadow: var(--shadow-sm);
                }
                .report-item {
                    padding: 16px;
                    border-bottom: 1px solid var(--border-color);
                    cursor: pointer;
                    transition: all 0.2s;
                }
                .report-item:hover {
                    background: var(--bg-card-hover);
                }
                .report-item.active {
                    background: var(--bg-card-hover);
                    border-left: 3px solid var(--accent-primary);
                }
                .badge-low { background: rgba(0, 255, 100, 0.1); color: #00ff64; border: 1px solid rgba(0, 255, 100, 0.2); }
                .badge-medium { background: rgba(255, 165, 0, 0.1); color: #ffa500; border: 1px solid rgba(255, 165, 0, 0.2); }
                .badge-high { background: rgba(255, 0, 0, 0.1); color: #ff0000; border: 1px solid rgba(255, 0, 0, 0.2); }
                .badge-info { background: rgba(0, 150, 255, 0.1); color: #0096ff; border: 1px solid rgba(0, 150, 255, 0.2); }
                .badge-warning { background: rgba(255, 100, 0, 0.1); color: #ff6400; border: 1px solid rgba(255, 100, 0, 0.2); }
            `}</style>
        </div>
    );
}

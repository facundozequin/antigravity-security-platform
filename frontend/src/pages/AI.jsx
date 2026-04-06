import React, { useState, useEffect, useRef } from 'react';
import { api } from '../services/api';

const MOCK_CHAT = [
    { role: 'assistant', content: 'Hola! Soy el asistente de seguridad de Antigravity. Puedo ayudarte a analizar logs, explicar ataques detectados por el WAF o recomendar reglas de seguridad. ¿En qué puedo ayudarte hoy?' }
];

export default function AI() {
    const [messages, setMessages] = useState(MOCK_CHAT);
    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(false);
    const chatEndRef = useRef(null);

    const scrollToBottom = () => {
        chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    const handleSend = async (e) => {
        e.preventDefault();
        if (!input.trim() || loading) return;

        const userMsg = { role: 'user', content: input };
        setMessages(prev => [...prev, userMsg]);
        setInput('');
        setLoading(true);

        try {
            // Simulated AI response
            setTimeout(() => {
                let aiContent = "Analizando tu solicitud...";
                if (input.toLowerCase().includes("log")) {
                    aiContent = "He analizado los últimos 100 logs. He detectado un patrón de escaneo de directorios desde la IP 45.33.32.156. Recomiendo activar una regla de rate limiting para esa IP.";
                } else if (input.toLowerCase().includes("waf")) {
                    aiContent = "Las reglas del WAF (ModSecurity) están funcionando correctamente. El 80% de los ataques bloqueados hoy fueron intentos de SQL Injection. Te sugiero revisar la regla 942100.";
                } else {
                    aiContent = "Entendido. Como plataforma de seguridad, monitoreo constantemente el tráfico. ¿Te gustaría que profundice en algún evento reciente o que analice alguna configuración específica?";
                }
                
                setMessages(prev => [...prev, { role: 'assistant', content: aiContent }]);
                setLoading(false);
            }, 1500);
        } catch (err) {
            setMessages(prev => [...prev, { role: 'assistant', content: "Lo siento, hubo un error al procesar tu solicitud con el servicio de IA local." }]);
            setLoading(false);
        }
    };

    const runAction = (action) => {
        setInput(action);
        // We trigger the click on the form submit basically
    };

    return (
        <div style={{ height: 'calc(100vh - 120px)', display: 'flex', flexDirection: 'column' }}>
            <h1 className="page-title"><span className="icon">🤖</span> Análisis con IA (Ollama)</h1>

            <div className="card" style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '20px', overflow: 'hidden' }}>
                {/* Actions Bar */}
                <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                    <button onClick={() => runAction("Analizar últimos logs")} className="btn-action">🔍 Analizar Logs</button>
                    <button onClick={() => runAction("Explicar último ataque")} className="btn-action">🛡️ Explicar Ataque</button>
                    <button onClick={() => runAction("Recomendar reglas WAF")} className="btn-action">📝 Recomendar Reglas</button>
                </div>

                <div style={{ flex: 1, overflowY: 'auto', padding: '10px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    {messages.map((msg, i) => (
                        <div key={i} style={{ 
                            alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start',
                            maxWidth: '80%',
                            padding: '12px 16px',
                            borderRadius: '12px',
                            background: msg.role === 'user' ? 'var(--accent-gradient)' : 'var(--bg-secondary)',
                            color: msg.role === 'user' ? 'white' : 'var(--text-primary)',
                            border: msg.role === 'assistant' ? '1px solid var(--border-color)' : 'none',
                            boxShadow: 'var(--shadow-sm)'
                        }}>
                            <div style={{ fontSize: '0.7rem', marginBottom: '4px', opacity: 0.7, fontWeight: 700 }}>
                                {msg.role === 'user' ? 'VOS' : 'ANTIGRAVITY AI'}
                            </div>
                            <div style={{ lineHeight: 1.5, fontSize: '0.95rem' }}>{msg.content}</div>
                        </div>
                    ))}
                    {loading && (
                        <div style={{ alignSelf: 'flex-start', background: 'var(--bg-secondary)', padding: '12px 16px', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
                            <div className="spinner" style={{ width: '20px', height: '20px', borderWidth: '2px' }}></div>
                        </div>
                    )}
                    <div ref={chatEndRef} />
                </div>

                <form onSubmit={handleSend} style={{ display: 'flex', gap: '10px', borderTop: '1px solid var(--border-color)', paddingTop: '20px' }}>
                    <input 
                        value={input}
                        onChange={e => setInput(e.target.value)}
                        placeholder="Preguntale algo a la IA sobre la seguridad de tu sistema..."
                        style={{ flex: 1, padding: '12px 16px', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--bg-primary)', color: 'var(--text-primary)' }}
                    />
                    <button disabled={loading} style={{ padding: '0 24px', borderRadius: '8px', border: 'none', background: 'var(--accent-gradient)', color: 'white', fontWeight: 600, cursor: 'pointer' }}>
                        Enviar
                    </button>
                </form>
            </div>

            <style>{`
                .btn-action {
                    padding: 8px 16px;
                    border-radius: 20px;
                    border: 1px solid var(--border-color);
                    background: var(--bg-secondary);
                    color: var(--text-secondary);
                    cursor: pointer;
                    font-size: 0.85rem;
                    transition: all 0.2s;
                }
                .btn-action:hover {
                    background: var(--bg-card-hover);
                    color: var(--text-primary);
                    border-color: var(--accent-primary);
                }
            `}</style>
        </div>
    );
}

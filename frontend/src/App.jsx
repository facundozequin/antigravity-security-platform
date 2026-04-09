import React from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import Sites from './pages/Sites';
import SiteDetail from './pages/SiteDetail';
import WAF from './pages/WAF';
import Fail2Ban from './pages/Fail2Ban';
import Logs from './pages/Logs';
import ThreatIntel from './pages/ThreatIntel';
import AI from './pages/AI';
import Alerts from './pages/Alerts';
import Remediation from './pages/Remediation';
import Intelligence from './pages/Intelligence';
import Reports from './pages/Reports';
import Settings from './pages/Settings';
import Login from './pages/Login';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Navigate } from 'react-router-dom';

const ProtectedRoute = ({ children }) => {
    const { token, loading } = useAuth();
    if (loading) return <div className="loading-screen">Loading...</div>;
    if (!token) return <Navigate to="/login" replace />;
    return children;
};

function App() {
    return (
        <AuthProvider>
            <BrowserRouter>
                <Routes>
                    <Route path="/login" element={<Login />} />
                    <Route path="/" element={
                        <ProtectedRoute>
                            <Layout />
                        </ProtectedRoute>
                    }>
                        <Route index element={<Dashboard />} />
                        <Route path="sites" element={<Sites />} />
                        <Route path="sites/:filename" element={<SiteDetail />} />
                        <Route path="waf" element={<WAF />} />
                        <Route path="fail2ban" element={<Fail2Ban />} />
                        <Route path="logs" element={<Logs />} />
                        <Route path="threat-intel" element={<ThreatIntel />} />
                        <Route path="ai" element={<AI />} />
                        <Route path="remediation" element={<Remediation />} />
                        <Route path="alerts" element={<Alerts />} />
                        <Route path="settings" element={<Settings />} />
                        <Route path="reports" element={<Reports />} />
                    </Route>
                </Routes>
            </BrowserRouter>
        </AuthProvider>
    );
}

export default App;

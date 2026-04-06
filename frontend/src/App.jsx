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
import Settings from './pages/Settings';

function App() {
    return (
        <BrowserRouter>
            <Routes>
                <Route path="/" element={<Layout />}>
                    <Route index element={<Dashboard />} />
                    <Route path="sites" element={<Sites />} />
                    <Route path="sites/:filename" element={<SiteDetail />} />
                    <Route path="waf" element={<WAF />} />
                    <Route path="fail2ban" element={<Fail2Ban />} />
                    <Route path="logs" element={<Logs />} />
                    <Route path="threat-intel" element={<ThreatIntel />} />
                    <Route path="ai" element={<AI />} />
                    <Route path="alerts" element={<Alerts />} />
                    <Route path="settings" element={<Settings />} />
                </Route>
            </Routes>
        </BrowserRouter>
    );
}

export default App;

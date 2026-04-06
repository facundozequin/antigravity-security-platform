const API_BASE = import.meta.env.VITE_API_URL || '';

export const api = {
    async health() {
        const res = await fetch(`${API_BASE}/api/health`);
        return res.json();
    },

    async listSites() {
        const res = await fetch(`${API_BASE}/api/sites`);
        return res.json();
    },

    async getSite(filename) {
        const res = await fetch(`${API_BASE}/api/sites/${encodeURIComponent(filename)}`);
        if (!res.ok) throw new Error('Site not found');
        return res.json();
    },

    async getTrafficStats() {
        const res = await fetch(`${API_BASE}/api/stats/traffic`);
        return res.json();
    },

    // WAF
    async getWafRules() {
        const res = await fetch(`${API_BASE}/api/waf/rules`);
        return res.json();
    },
    async toggleWafRule(id, enabled) {
        const res = await fetch(`${API_BASE}/api/waf/rules/${id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ enabled })
        });
        return res.json();
    },
    async getWafEvents() {
        const res = await fetch(`${API_BASE}/api/waf/events`);
        return res.json();
    },

    // Fail2Ban
    async getFail2BanBans() {
        const res = await fetch(`${API_BASE}/api/fail2ban/bans`);
        return res.json();
    },
    async banIp(ip, reason) {
        const res = await fetch(`${API_BASE}/api/fail2ban/ban`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ip, reason })
        });
        return res.json();
    },
    async unbanIp(ip) {
        const res = await fetch(`${API_BASE}/api/fail2ban/ban/${ip}`, {
            method: 'DELETE'
        });
        return res.json();
    },
    async getFail2BanJails() {
        const res = await fetch(`${API_BASE}/api/fail2ban/jails`);
        return res.json();
    },

    // Logs
    async getLogs(page = 1, filters = {}) {
        const query = new URLSearchParams({ page, source: filters.source || '' }).toString();
        const res = await fetch(`${API_BASE}/api/logs?${query}`);
        return res.json();
    },

    // Threat Intel
    async getThreatIntel(ip) {
        const res = await fetch(`${API_BASE}/api/threat-intel/ip/${ip}`);
        return res.json();
    },
    async getThreatHistory() {
        const res = await fetch(`${API_BASE}/api/threat-intel/history`);
        return res.json();
    },

    // AI
    async analyzeLogs(logs) {
        const res = await fetch(`${API_BASE}/api/ai/analyze`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ logs })
        });
        return res.json();
    },

    // Alerts
    async getAlertsHistory() {
        const res = await fetch(`${API_BASE}/api/alerts/history`);
        return res.json();
    },
    async testAlerts() {
        const res = await fetch(`${API_BASE}/api/alerts/test`, { method: 'POST' });
        return res.json();
    },

    // Settings
    async getSettings() {
        const res = await fetch(`${API_BASE}/api/settings`);
        return res.json();
    },
    async updateSettings(settings) {
        const res = await fetch(`${API_BASE}/api/settings`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(settings)
        });
        return res.json();
    }
};


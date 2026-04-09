const API_BASE = import.meta.env.VITE_API_URL || '';

async function fetchWithAuth(url, options = {}) {
    const token = localStorage.getItem('token');
    const headers = { ...options.headers };
    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }
    const res = await fetch(url, { ...options, headers });
    if (res.status === 401) {
        localStorage.removeItem('token');
        window.location.href = '/login';
        throw new Error('Unauthorized');
    }
    return res;
}

export const api = {
    async login(username, password) {
        const formData = new URLSearchParams();
        formData.append('username', username);
        formData.append('password', password);
        
        const res = await fetch(`${API_BASE}/api/auth/token`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: formData
        });
        if (!res.ok) throw new Error('Login failed');
        return res.json();
    },

    async health() {
        const res = await fetchWithAuth(`${API_BASE}/api/health`);
        return res.json();
    },

    async listSites() {
        const res = await fetchWithAuth(`${API_BASE}/api/nginx/vhosts`);
        return res.json();
    },

    async createVHost(vhost) {
        const res = await fetchWithAuth(`${API_BASE}/api/nginx/vhosts`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(vhost)
        });
        return res.json();
    },

    async updateVHost(id, vhost) {
        const res = await fetchWithAuth(`${API_BASE}/api/nginx/vhosts/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(vhost)
        });
        return res.json();
    },

    async deleteVHost(id) {
        const res = await fetchWithAuth(`${API_BASE}/api/nginx/vhosts/${id}`, {
            method: 'DELETE'
        });
        return res.json();
    },

    async getSite(filename) {
        const res = await fetchWithAuth(`${API_BASE}/api/sites/${encodeURIComponent(filename)}`);
        if (!res.ok) throw new Error('Site not found');
        return res.json();
    },

    async getTrafficStats() {
        const res = await fetchWithAuth(`${API_BASE}/api/stats/traffic`);
        return res.json();
    },

    // WAF
    async getWafRules() {
        const res = await fetchWithAuth(`${API_BASE}/api/waf/rules`);
        return res.json();
    },
    async toggleWafRule(id, enabled) {
        const res = await fetchWithAuth(`${API_BASE}/api/waf/rules/${id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ enabled })
        });
        return res.json();
    },
    async getWafEvents() {
        const res = await fetchWithAuth(`${API_BASE}/api/waf/events`);
        return res.json();
    },

    async saveWafRule(rule) {
        const res = await fetchWithAuth(`${API_BASE}/api/waf/rules`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(rule)
        });
        return res.json();
    },

    async deleteWafRule(id) {
        const res = await fetchWithAuth(`${API_BASE}/api/waf/rules/${id}`, {
            method: 'DELETE'
        });
        return res.json();
    },

    // Fail2Ban
    async getFail2BanBans() {
        const res = await fetchWithAuth(`${API_BASE}/api/fail2ban/bans`);
        return res.json();
    },
    async banIp(ip, reason) {
        const res = await fetchWithAuth(`${API_BASE}/api/fail2ban/ban`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ip, reason })
        });
        return res.json();
    },
    async unbanIp(ip) {
        const res = await fetchWithAuth(`${API_BASE}/api/fail2ban/unban`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ip })
        });
        return res.json();
    },
    async getFail2BanJails() {
        const res = await fetchWithAuth(`${API_BASE}/api/fail2ban/jails`);
        return res.json();
    },
    async saveFail2BanJail(jail) {
        const res = await fetchWithAuth(`${API_BASE}/api/fail2ban/jails`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(jail)
        });
        return res.json();
    },
    async deleteFail2BanJail(id) {
        const res = await fetchWithAuth(`${API_BASE}/api/fail2ban/jails/${id}`, {
            method: 'DELETE'
        });
        return res.json();
    },

    // Logs
    async getLogs(page = 1, filters = {}) {
        const query = new URLSearchParams({ 
            limit: 50,
            offset: (page - 1) * 50,
            source: filters.source || '',
            level: filters.level || '',
            q: filters.q || ''
        }).toString();
        const res = await fetchWithAuth(`${API_BASE}/api/logs?${query}`);
        return res.json();
    },

    async getLogsStats() {
        const res = await fetchWithAuth(`${API_BASE}/api/logs/stats`);
        return res.json();
    },

    // Threat Intel
    async getThreatIntel(ip) {
        const res = await fetchWithAuth(`${API_BASE}/api/threat-intel/ip/${ip}`);
        return res.json();
    },
    async getThreatHistory() {
        const res = await fetchWithAuth(`${API_BASE}/api/threat-intel/history`);
        return res.json();
    },

    // AI
    async analyzeLogs(logs) {
        const res = await fetchWithAuth(`${API_BASE}/api/ai/analyze`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ logs })
        });
        return res.json();
    },

    async chatWithAI(input) {
        const res = await fetchWithAuth(`${API_BASE}/api/ai/chat`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ input })
        });
        return res.json();
    },

    async getAIReports() {
        const res = await fetchWithAuth(`${API_BASE}/api/ai/reports`);
        return res.json();
    },

    async getAIReportInsights(reportId) {
        const res = await fetchWithAuth(`${API_BASE}/api/ai/reports/${reportId}/insights`);
        return res.json();
    },

    async getAIProviders() {
        const res = await fetchWithAuth(`${API_BASE}/api/settings/providers`);
        return res.json();
    },

    async saveAIProvider(provider) {
        const res = await fetchWithAuth(`${API_BASE}/api/settings/providers`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(provider)
        });
        return res.json();
    },

    async activateAIProvider(id) {
        const res = await fetchWithAuth(`${API_BASE}/api/settings/providers/${id}/activate`, {
            method: 'PUT'
        });
        return res.json();
    },

    async deleteAIProvider(id) {
        const res = await fetchWithAuth(`${API_BASE}/api/settings/providers/${id}`, {
            method: 'DELETE'
        });
        return res.json();
    },

    // Alerts
    async getAlertsHistory() {
        const res = await fetchWithAuth(`${API_BASE}/api/alerts/history`);
        return res.json();
    },
    async testAlerts() {
        const res = await fetchWithAuth(`${API_BASE}/api/alerts/test`, { method: 'POST' });
        return res.json();
    },

    // Settings
    async getSettings() {
        const res = await fetchWithAuth(`${API_BASE}/api/settings`);
        return res.json();
    },
    async updateSettings(settings) {
        const res = await fetchWithAuth(`${API_BASE}/api/settings`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(settings)
        });
        return res.json();
    }
};


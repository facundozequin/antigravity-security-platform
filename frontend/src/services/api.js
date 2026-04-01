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
    }
};

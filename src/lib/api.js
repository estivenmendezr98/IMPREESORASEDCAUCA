// Cliente API para conectarse al backend PostgreSQL local
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

class ApiClient {
    async request(endpoint, options = {}) {
        const url = `${API_URL}${endpoint}`;
        const config = {
            ...options,
            headers: {
                'Content-Type': 'application/json',
                ...options.headers,
            },
        };

        // Add Authorization header if token exists
        try {
            const stored = localStorage.getItem('impresiones_app_auth');
            if (stored) {
                const session = JSON.parse(stored);
                if (session && session.access_token) {
                    config.headers['Authorization'] = `Bearer ${session.access_token}`;
                }
            }
        } catch (e) {
            // ignore error reading token
        }

        try {
            const response = await fetch(url, config);
            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`HTTP error! status: ${response.status} - ${errorText}`);
            }
            return await response.json();
        } catch (error) {
            console.error('API request failed:', error);
            throw error;
        }
    }

    // Users
    async getUsers() {
        return this.request('/users');
    }

    async login(email, password) {
        return this.request('/login', {
            method: 'POST',
            body: JSON.stringify({ email, password })
        });
    }

    async getUser(id) {
        return this.request(`/users/${id}`);
    }

    async updateUser(id, data) {
        return this.request(`/users/${id}`, {
            method: 'PUT',
            body: JSON.stringify(data)
        });
    }

    async deleteUser(id) {
        return this.request(`/users/${id}`, {
            method: 'DELETE'
        });
    }

    async getUserTotals() {
        return this.request('/users/totals');
    }

    async getUserMonthly(id, year) {
        const yearParam = year || new Date().getFullYear();
        return this.request(`/users/${id}/monthly/${yearParam}`);
    }

    async getUserPrinters(id) {
        return this.request(`/users/${id}/printers`);
    }

    // Role-based User Management
    async getAdmins() {
        return this.request('/users/admins');
    }

    async getReaders() {
        return this.request('/users/readers');
    }

    async createUser(data) {
        return this.request('/users', {
            method: 'POST',
            body: JSON.stringify(data)
        });
    }

    // Dashboard
    async getDashboardStats() {
        return this.request('/dashboard/stats');
    }

    // Printers
    async getPrinters() {
        return this.request('/printers');
    }

    async getPrintersByOffice(office) {
        const endpoint = office ? `/printers/office/${office}` : '/printers/office';
        return this.request(endpoint);
    }

    async getPrinterUsers(id) {
        return this.request(`/printers/${id}/users`);
    }

    // Prints
    async getMonthlyPrints(filters = {}) {
        const params = new URLSearchParams(filters);
        return this.request(`/prints/monthly?${params}`);
    }

    async getRawPrints(filters = {}) {
        const params = new URLSearchParams(filters);
        return this.request(`/prints/raw?${params}`);
    }

    // Reporting methods
    async getReportTrends(startDate, endDate) {
        const params = new URLSearchParams();
        if (startDate) params.append('startDate', startDate);
        if (endDate) params.append('endDate', endDate);
        return this.request(`/reports/trends?${params}`);
    }

    async getReportUsers(startDate, endDate) {
        const params = new URLSearchParams();
        if (startDate) params.append('startDate', startDate);
        if (endDate) params.append('endDate', endDate);
        return this.request(`/reports/users?${params}`);
    }

    async getReportDetailedMonthly(filters) {
        const params = new URLSearchParams();
        if (filters.startDate) params.append('startDate', filters.startDate);
        if (filters.endDate) params.append('endDate', filters.endDate);
        if (filters.office) params.append('office', filters.office);
        if (filters.includeInactive) params.append('includeInactive', 'true');

        return this.request(`/reports/detailed-monthly?${params}`);
    }

    async getExportReport(filters) {
        const params = new URLSearchParams();
        if (filters.startDate) params.append('startDate', filters.startDate);
        if (filters.endDate) params.append('endDate', filters.endDate);
        if (filters.office) params.append('office', filters.office);
        if (filters.includeInactive) params.append('includeInactive', 'true');

        const url = `${API_URL}/reports/export?${params}`;
        const headers = { 'Content-Type': 'application/json' };

        // Add Authorization header manually since this doesn't use request() helper directly
        // primarily because we need a BLOB response not JSON.
        try {
            const stored = localStorage.getItem('impresiones_app_auth');
            if (stored) {
                const session = JSON.parse(stored);
                if (session && session.access_token) {
                    headers['Authorization'] = `Bearer ${session.access_token}`;
                }
            }
        } catch (e) { }

        const response = await fetch(url, { headers });
        if (!response.ok) throw new Error('Error downloading export');
        return await response.blob();
    }

    // Imports
    async getImportLog(startDate, endDate) {
        const params = new URLSearchParams();
        if (startDate) params.append('startDate', startDate);
        if (endDate) params.append('endDate', endDate);
        return this.request(`/imports/log?${params}`);
    }

    async getImportBatch(batchId) {
        return this.request(`/imports/batch/${batchId}`);
    }

    async deleteImport(batchId) {
        return this.request(`/imports/${batchId}`, {
            method: 'DELETE'
        });
    }

    // ============================================================================
    // GESTIÓN DE IMPRESORAS (CRUD)
    // ============================================================================

    async createPrinter(data) {
        return this.request('/printers', {
            method: 'POST',
            body: JSON.stringify(data),
        });
    }

    async updatePrinter(id, data) {
        return this.request(`/printers/${id}`, {
            method: 'PUT',
            body: JSON.stringify(data),
        });
    }

    async deletePrinter(id) {
        return this.request(`/printers/${id}`, {
            method: 'DELETE',
        });
    }

    async assignPrinterUsers(printerId, userIds) {
        return this.request(`/printers/${printerId}/assignments`, {
            method: 'POST',
            body: JSON.stringify({ userIds }),
        });
    }

    async removePrinterAssignment(assignmentId) {
        return this.request(`/assignments/${assignmentId}`, {
            method: 'DELETE',
        });
    }

    async getAssignments() {
        return this.request('/assignments');
    }
}

export const apiClient = new ApiClient();
export default apiClient;

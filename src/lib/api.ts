

export interface User {
    id: string;
    email: string;
    full_name: string;
    role: 'superadmin' | 'admin' | 'reader' | 'user';
    office?: string;
    department?: string;
    status?: string;
    created_at?: string;
}

export interface PrintRecord {
    id: string;
    user_id: string;
    report_timestamp: string;
    print_total: number;
    copy_total: number;
    scan_total: number;
    fax_total: number;
}

export interface MonthlyPrint {
    id?: string;
    user_id: string;
    year: number;
    month: number;
    print_total: number | string;
    copy_total: number | string;
    scan_total: number | string;
    fax_total: number | string;
    created_at?: string;
}

export interface DashboardStats {
    total_users: number;
    active_users: number;
    total_prints_month: number;
    total_copies_month: number;
    last_import: string;
}

export interface Printer {
    id: string;
    name: string;
    ip_address: string;
    model: string;
    office: string;
    status: string;
    location_details?: string;
    serial?: string;
}

export interface UserTotal {
    user_id: string;
    full_name: string | null;
    office: string | null;
    total_prints: number;
    total_copies: number;
    total_scans: number;
    total_fax: number;
    last_activity: string | null;
}

const API_URL = import.meta.env.VITE_API_URL || '/api';

export class ApiClient {
    private async request(endpoint: string, options: RequestInit = {}): Promise<any> {
        const url = `${API_URL}${endpoint}`;
        const headers: HeadersInit = {
            'Content-Type': 'application/json',
            ...(options.headers as any),
        };

        // Add Authorization header if token exists
        try {
            const stored = localStorage.getItem('impresiones_app_auth');
            if (stored) {
                const session = JSON.parse(stored);
                if (session && session.access_token) {
                    (headers as any)['Authorization'] = `Bearer ${session.access_token}`;
                }
            }
        } catch (e) {
            // ignore error reading token
        }

        const config: RequestInit = {
            ...options,
            headers,
        };

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
    async getUsers(): Promise<User[]> {
        return this.request('/users');
    }

    async login(email: string, password: string): Promise<{ user: User; session: { access_token: string } }> {
        return this.request('/login', {
            method: 'POST',
            body: JSON.stringify({ email, password })
        });
    }

    async getUser(id: string): Promise<User> {
        return this.request(`/users/${id}`);
    }

    async updateUser(id: string, data: Partial<User>): Promise<User> {
        return this.request(`/users/${id}`, {
            method: 'PUT',
            body: JSON.stringify(data)
        });
    }

    async deleteUser(id: string): Promise<{ success: boolean }> {
        return this.request(`/users/${id}`, {
            method: 'DELETE'
        });
    }

    async getUserTotals(): Promise<UserTotal[]> {
        return this.request('/users/totals');
    }

    async getUserMonthly(id: string, year?: number): Promise<MonthlyPrint[]> {
        const yearParam = year || new Date().getFullYear();
        return this.request(`/users/${id}/monthly/${yearParam}`);
    }

    async getUserMonthlyAll(id: string): Promise<MonthlyPrint[]> {
        return this.request(`/users/${id}/monthly-all`);
    }

    async getUserPrinters(id: string): Promise<Printer[]> {
        return this.request(`/users/${id}/printers`);
    }

    // Role-based User Management
    async getAdmins(): Promise<User[]> {
        return this.request('/users/admins');
    }

    async getReaders(): Promise<User[]> {
        return this.request('/users/readers');
    }

    async createUser(data: Partial<User>): Promise<{ success: boolean; user: User }> {
        return this.request('/users', {
            method: 'POST',
            body: JSON.stringify(data)
        });
    }

    // Dashboard
    async getDashboardStats(): Promise<DashboardStats> {
        return this.request('/dashboard/stats');
    }

    // Printers
    async getPrinters(): Promise<Printer[]> {
        return this.request('/printers');
    }

    async getPrintersByOffice(office?: string): Promise<Printer[]> {
        const endpoint = office ? `/printers/office/${office}` : '/printers/office';
        return this.request(endpoint);
    }

    async getPrinterUsers(id: string): Promise<User[]> {
        return this.request(`/printers/${id}/users`);
    }

    // Prints
    async getMonthlyPrints(filters: any = {}): Promise<MonthlyPrint[]> {
        const params = new URLSearchParams(filters);
        return this.request(`/prints/monthly?${params}`);
    }

    async getRawPrints(filters: any = {}): Promise<any[]> {
        const params = new URLSearchParams(filters);
        return this.request(`/prints/raw?${params}`);
    }

    // Reporting methods
    async getReportTrends(startDate?: string, endDate?: string): Promise<any[]> {
        const params = new URLSearchParams();
        if (startDate) params.append('startDate', startDate);
        if (endDate) params.append('endDate', endDate);
        return this.request(`/reports/trends?${params}`);
    }

    async getReportUsers(startDate?: string, endDate?: string): Promise<any[]> {
        const params = new URLSearchParams();
        if (startDate) params.append('startDate', startDate);
        if (endDate) params.append('endDate', endDate);
        return this.request(`/reports/users?${params}`);
    }

    async getReportDetailedMonthly(filters: any): Promise<any[]> {
        const params = new URLSearchParams();
        if (filters.startDate) params.append('startDate', filters.startDate);
        if (filters.endDate) params.append('endDate', filters.endDate);
        if (filters.office) params.append('office', filters.office);
        if (filters.includeInactive) params.append('includeInactive', 'true');

        return this.request(`/reports/detailed-monthly?${params}`);
    }

    async getExportReport(filters: any): Promise<Blob> {
        const params = new URLSearchParams();
        if (filters.startDate) params.append('startDate', filters.startDate);
        if (filters.endDate) params.append('endDate', filters.endDate);
        if (filters.office) params.append('office', filters.office);
        if (filters.includeInactive) params.append('includeInactive', 'true');

        const url = `${API_URL}/reports/export?${params}`;
        const headers: HeadersInit = { 'Content-Type': 'application/json' };

        // Add Authorization header manually since this doesn't use request() helper directly
        // primarily because we need a BLOB response not JSON.
        try {
            const stored = localStorage.getItem('impresiones_app_auth');
            if (stored) {
                const session = JSON.parse(stored);
                if (session && session.access_token) {
                    (headers as any)['Authorization'] = `Bearer ${session.access_token}`;
                }
            }
        } catch (e) { }

        const response = await fetch(url, { headers });
        if (!response.ok) throw new Error('Error downloading export');
        return await response.blob();
    }

    // Imports
    async getImportLog(startDate?: string, endDate?: string): Promise<any[]> {
        const params = new URLSearchParams();
        if (startDate) params.append('startDate', startDate);
        if (endDate) params.append('endDate', endDate);
        return this.request(`/imports/log?${params}`);
    }

    async getImportBatch(batchId: string): Promise<any> {
        return this.request(`/imports/batch/${batchId}`);
    }

    async deleteImport(batchId: string): Promise<{ success: boolean; message: string; rawDeleted: number }> {
        return this.request(`/imports/${batchId}`, {
            method: 'DELETE'
        });
    }

    // ============================================================================
    // GESTIÓN DE IMPRESORAS (CRUD)
    // ============================================================================

    async createPrinter(data: Partial<Printer>): Promise<Printer> {
        return this.request('/printers', {
            method: 'POST',
            body: JSON.stringify(data),
        });
    }

    async updatePrinter(id: string, data: Partial<Printer>): Promise<Printer> {
        return this.request(`/printers/${id}`, {
            method: 'PUT',
            body: JSON.stringify(data),
        });
    }

    async deletePrinter(id: string): Promise<{ message: string }> {
        return this.request(`/printers/${id}`, {
            method: 'DELETE',
        });
    }

    async assignPrinterUsers(printerId: string, userIds: string[]): Promise<any> {
        return this.request(`/printers/${printerId}/assignments`, {
            method: 'POST',
            body: JSON.stringify({ userIds }),
        });
    }

    async removePrinterAssignment(assignmentId: string): Promise<any> {
        return this.request(`/assignments/${assignmentId}`, {
            method: 'DELETE',
        });
    }

    async getAssignments(): Promise<any[]> {
        return this.request('/assignments');
    }

    async exportDatabaseSQL(): Promise<Blob> {
        const url = `${API_URL}/admin/export-sql`;
        const headers: HeadersInit = {};

        try {
            const stored = localStorage.getItem('impresiones_app_auth');
            if (stored) {
                const session = JSON.parse(stored);
                if (session && session.access_token) {
                    (headers as any)['Authorization'] = `Bearer ${session.access_token}`;
                }
            }
        } catch (e) { }

        const response = await fetch(url, { headers });
        if (!response.ok) {
            throw new Error(`Error exporting database: ${response.statusText}`);
        }
        return response.blob();
    }
}

export const apiClient = new ApiClient();
export default apiClient;

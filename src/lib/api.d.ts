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

export class ApiClient {
    login(email: string, password: string): Promise<{ user: User; session: { access_token: string } }>;
    getUsers(): Promise<User[]>;
    getUser(id: string): Promise<User>;
    createUser(data: Partial<User>): Promise<{ success: boolean; user: User }>;
    updateUser(id: string, data: Partial<User>): Promise<User>;
    deleteUser(id: string): Promise<{ success: boolean }>;
    getUserTotals(): Promise<UserTotal[]>;
    getAdmins(): Promise<User[]>;
    getReaders(): Promise<User[]>;
    getMonthlyPrints(filters?: any): Promise<MonthlyPrint[]>;
    getDashboardStats(): Promise<DashboardStats>;
    getPrinters(): Promise<Printer[]>;
    getPrintersByOffice(office?: string): Promise<Printer[]>;
    getPrinterUsers(id: string): Promise<User[]>;
    getImportLog(startDate?: string, endDate?: string): Promise<any[]>;
    getReportDetailedMonthly(filters: any): Promise<any[]>;
    getReportTrends(startDate?: string, endDate?: string): Promise<any[]>;
    getReportUsers(startDate?: string, endDate?: string): Promise<any[]>;
    createPrinter(data: Partial<Printer>): Promise<Printer>;
    updatePrinter(id: string, data: Partial<Printer>): Promise<Printer>;
    deletePrinter(id: string): Promise<{ message: string }>;
    assignPrinterUsers(printerId: string, userIds: string[]): Promise<any>;
}

export const apiClient: ApiClient;
export default apiClient;

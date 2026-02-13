import axios from 'axios';

// Automatically determine URL based on environment or default to local backend
const API_URL = import.meta.env.VITE_API_URL || `http://${window.location.hostname}:8000/api`;

const api = axios.create({
    baseURL: API_URL,
    headers: {
        'Content-Type': 'application/json',
    },
});

// Request interceptor to add the auth token header to every request
api.interceptors.request.use(async (config) => {
    try {
        // Dynamically import supabase to avoid circular dependencies if any
        const { supabase } = await import('../lib/supabase');
        const { data: { session } } = await supabase.auth.getSession();

        if (session?.access_token) {
            config.headers.Authorization = `Bearer ${session.access_token}`;
        }
    } catch (error) {
        console.error("Error attaching auth token", error);
    }
    return config;
});

// Response interceptor to handle 401s (Token expired or backend auth failed)
// Response interceptor to handle 401s (Token expired or backend auth failed)
api.interceptors.response.use(
    (response) => response,
    async (error) => {
        if (error.response?.status === 401) {
            console.warn("Unauthorized! Redirecting to login...");

            // Avoid infinite loops if we are already at login
            if (window.location.pathname.includes('/login')) {
                return Promise.reject(error);
            }

            try {
                const { supabase } = await import('../lib/supabase');
                await supabase.auth.signOut();
            } catch (e) {
                console.error("Error signing out", e);
            }

            // Force hard redirect to login
            window.location.href = '/login';
        }
        return Promise.reject(error);
    }
);

export const clientsService = {
    getAll: () => api.get('/clients/'),
    getById: (id) => api.get(`/clients/${id}`),
    create: (data) => api.post('/clients/', data),
    update: (id, data) => api.put(`/clients/${id}`, data),
    delete: (id) => api.delete(`/clients/${id}`),
};

export const productsService = {
    getAll: (activeOnly = true) => api.get(`/products/?active_only=${activeOnly}`),
    create: (data) => api.post('/products/', data),
    update: (id, data) => api.put(`/products/${id}`, data),
};

export const ordersService = {
    getAll: (params) => api.get('/orders/', { params }),
    getById: (id) => api.get(`/orders/${id}`),
    create: (data) => api.post('/orders/', data),
    update: (id, data) => api.put(`/orders/${id}`, data),
    updateStatus: (id, data) => api.patch(`/orders/${id}/status`, data),
    delete: (id) => api.delete(`/orders/${id}`),
};

export const expensesService = {
    getAll: (params) => api.get('/expenses/', { params }),
    create: (data) => api.post('/expenses/', data),
    update: (id, data) => api.put(`/expenses/${id}`, data),
    delete: (id) => api.delete(`/expenses/${id}`),
};

export const suppliersService = {
    getAll: () => api.get('/suppliers/'),
    create: (data) => api.post('/suppliers/', data),
    update: (id, data) => api.put(`/suppliers/${id}`, data),
    delete: (id) => api.delete(`/suppliers/${id}`),
};

export const reportsService = {
    getDashboard: () => api.get('/reports/dashboard'),
    getWhatsappSummary: (date) => api.get(`/reports/whatsapp-summary?date_str=${date || ''}`),
    getClientReport: (clientId, startDate, endDate) => api.get('/reports/client-report', { params: { client_id: clientId, start_date: startDate, end_date: endDate } }),
    getVendorReport: (vendorId, startDate, endDate) => api.get('/reports/vendor-report', { params: { vendor_id: vendorId, start_date: startDate, end_date: endDate } }),
};

export const paymentMethodsService = {
    getAll: () => api.get('/payment-methods/'),
    create: (data) => api.post('/payment-methods/', data),
    update: (id, data) => api.put(`/payment-methods/${id}`, data),
    delete: (id) => api.delete(`/payment-methods/${id}`),
};

export const transfersService = {
    getAll: () => api.get('/transfers/'),
    create: (data) => api.post('/transfers/', data),
    getBalances: () => api.get('/transfers/balances'),
    update: (id, data) => api.put(`/transfers/${id}`, data),
    delete: (id) => api.delete(`/transfers/${id}`),
};

export const receivablesService = {
    getAccounts: () => api.get('/receivables/accounts'),
    getHistory: () => api.get('/receivables/history'),
    registerPayment: (data) => api.post('/receivables/payments', data),
    deletePayment: (id) => api.delete(`/receivables/payments/${id}`),
    updatePayment: (id, data) => api.put(`/receivables/payments/${id}`, data)
};

export default api;

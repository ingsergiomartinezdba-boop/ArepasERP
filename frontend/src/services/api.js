import axios from 'axios';

// Automatically determine URL based on environment or default to local backend
const API_URL = import.meta.env.VITE_API_URL || `http://${window.location.hostname}:8000/api`;

const api = axios.create({
    baseURL: API_URL,
    headers: {
        'Content-Type': 'application/json',
    },
});

export const clientsService = {
    getAll: () => api.get('/clients/'),
    getById: (id) => api.get(`/clients/${id}`),
    create: (data) => api.post('/clients/', data),
    update: (id, data) => api.put(`/clients/${id}`, data),
};

export const productsService = {
    getAll: (activeOnly = true) => api.get(`/products/?active_only=${activeOnly}`),
    create: (data) => api.post('/products/', data),
    update: (id, data) => api.put(`/products/${id}`, data),
};

export const ordersService = {
    getAll: () => api.get('/orders/'),
    getById: (id) => api.get(`/orders/${id}`),
    create: (data) => api.post('/orders/', data),
    update: (id, data) => api.put(`/orders/${id}`, data),
    updateStatus: (id, data) => api.patch(`/orders/${id}/status`, data),
};

export const expensesService = {
    getAll: () => api.get('/expenses/'),
    create: (data) => api.post('/expenses/', data),
    delete: (id) => api.delete(`/expenses/${id}`),
};

export const reportsService = {
    getDashboard: () => api.get('/reports/dashboard'),
    getWhatsappSummary: (date) => api.get(`/reports/whatsapp-summary?date_str=${date || ''}`),
};

export const paymentMethodsService = {
    getAll: () => api.get('/payment-methods/'),
    create: (data) => api.post('/payment-methods/', data),
    update: (id, data) => api.put(`/payment-methods/${id}`, data),
    delete: (id) => api.delete(`/payment-methods/${id}`),
};

export default api;

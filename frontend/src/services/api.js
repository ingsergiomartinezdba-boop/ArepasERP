import axios from 'axios';

// Usa proxy de Vite en dev (evita CORS); en producción usa VITE_API_URL
const API_URL = import.meta.env.VITE_API_URL || '/api';

const api = axios.create({
    baseURL: API_URL,
    // withCredentials: el navegador envía la cookie HttpOnly `arepaserp_session`
    // que setea POST /api/auth/login. El JWT ya no se lee de localStorage.
    withCredentials: true,
    headers: {
        'Content-Type': 'application/json',
    },
});

// Compatibilidad: si todavía hay un token en localStorage (sesión legada
// previa al cambio), lo mandamos también por Authorization header. La cookie
// HttpOnly tiene prioridad en el backend; este header es solo fallback.
api.interceptors.request.use((config) => {
    const token = localStorage.getItem('token');
    if (token) config.headers.Authorization = `Bearer ${token}`;
    return config;
});

// Response interceptor — manejar 401 limpiando el estado local y forzando login
api.interceptors.response.use(
    (response) => response,
    (error) => {
        if (error.response?.status === 401 && !window.location.pathname.includes('/login')) {
            localStorage.removeItem('token');
            localStorage.removeItem('user');
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
    getPreciosCliente: (id) => api.get(`/clients/${id}/precios`),
    setPreciosCliente: (id, items) => api.put(`/clients/${id}/precios`, items),
};

export const productsService = {
    getAll: (activeOnly = true) => api.get(`/products/?active_only=${activeOnly}`),
    create: (data) => api.post('/products/', data),
    update: (id, data) => api.put(`/products/${id}`, data),
    getInsumos: (id) => api.get(`/products/${id}/insumos`),
    getAllInsumos: () => api.get('/products/insumos/all'),
    saveInsumos: (id, data) => api.put(`/products/${id}/insumos`, data),
    calcularCosto: (id) => api.get(`/products/${id}/costo`),
    aplicarCosto: (id) => api.post(`/products/${id}/costo/aplicar`),
};

export const ordersService = {
    getAll: (params) => api.get('/orders/', { params }),
    getById: (id) => api.get(`/orders/${id}`),
    create: (data) => api.post('/orders/', data),
    update: (id, data) => api.put(`/orders/${id}`, data),
    updateStatus: (id, data) => api.patch(`/orders/${id}/status`, data),
    delete: (id) => api.delete(`/orders/${id}`),
    recalcularInsumos: () => api.post('/orders/recalcular-insumos'),
};

export const expensesService = {
    getAll: (params) => api.get('/expenses/', { params }),
    getCuentasPorPagar: () => api.get('/expenses/cuentas-por-pagar'),
    getCategorias: () => api.get('/expenses/categorias'),
    updateCategoriaTipoCosto: (id, tipo_costo) => api.patch(`/expenses/categorias/${id}/tipo-costo`, { tipo_costo }),
    create: (data) => api.post('/expenses/', data),
    update: (id, data) => api.put(`/expenses/${id}`, data),
    anular: (id) => api.patch(`/expenses/${id}/anular`),
    reactivar: (id) => api.patch(`/expenses/${id}/reactivar`),
    delete: (id) => api.delete(`/expenses/${id}`),
    getAbonos: (id) => api.get(`/expenses/${id}/abonos`),
    crearAbono: (id, data) => api.post(`/expenses/${id}/abonos`, data),
    eliminarAbono: (id, abonoId) => api.delete(`/expenses/${id}/abonos/${abonoId}`),
    // Adjuntos
    getAdjuntos: (id) => api.get(`/expenses/${id}/adjuntos`),
    uploadAdjunto: (id, file, notas) => {
        const fd = new FormData();
        fd.append('file', file);
        if (notas) fd.append('notas', notas);
        return api.post(`/expenses/${id}/adjuntos`, fd, { headers: { 'Content-Type': 'multipart/form-data' } });
    },
    eliminarAdjunto: (id, adjId) => api.delete(`/expenses/${id}/adjuntos/${adjId}`),
    downloadAdjunto: (id, adjId) => api.get(`/expenses/${id}/adjuntos/${adjId}/download`, { responseType: 'blob' }),
    // Widgets / KPIs
    getWidgets: (periodo) => api.get('/expenses/widgets', { params: periodo ? { periodo } : {} }),
    // Export
    export: (params, format) => api.get('/expenses/export', { params: { ...params, format }, responseType: 'blob' }),
};

export const suppliersService = {
    getAll: () => api.get('/suppliers/'),
    create: (data) => api.post('/suppliers/', data),
    update: (id, data) => api.put(`/suppliers/${id}`, data),
    delete: (id) => api.delete(`/suppliers/${id}`),
    // Multi-proveedor por insumo
    getInsumos: (supplierId) => api.get(`/suppliers/${supplierId}/insumos`),
    asignarInsumo: (supplierId, data) => api.post(`/suppliers/${supplierId}/insumos`, data),
    desasignarInsumo: (supplierId, insumoId) => api.delete(`/suppliers/${supplierId}/insumos/${insumoId}`),
    previewImpacto: (supplierId, insumoId, costo) =>
        api.get(`/suppliers/${supplierId}/insumos/${insumoId}/preview`, { params: costo != null ? { costo } : {} }),
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
    toggle: (id) => api.patch(`/payment-methods/${id}/toggle`),
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

export const inventoryService = {
    getAll: () => api.get('/inventory/'),
    getStock: (productoId) => api.get(`/inventory/${productoId}`),
    registrarMovimiento: (data) => api.post('/inventory/entrada', data),
    ajustar: (data) => api.post('/inventory/ajuste', data),
    getMovimientos: (params) => api.get('/inventory/movimientos/', { params }),
};

export const insumosService = {
    getAll: (activoOnly = false, proveedorId = null) => api.get('/insumos/', { params: { activo_only: activoOnly, ...(proveedorId ? { proveedor_id: proveedorId } : {}) } }),
    getById: (id) => api.get(`/insumos/${id}`),
    create: (data) => api.post('/insumos/', data),
    update: (id, data) => api.put(`/insumos/${id}`, data),
    delete: (id) => api.delete(`/insumos/${id}`),
    ajustar: (id, data) => api.post(`/insumos/${id}/ajuste`, data),
    getMovimientos: (id) => api.get(`/insumos/${id}/movimientos`),
    getStock: () => api.get('/insumos/stock/resumen'),
};

export const productionService = {
    // Cocción legacy: insumo → masa (mantener compatibilidad)
    getProcesos: (params) => api.get('/production/proceso', { params }),
    crearProceso: (data) => api.post('/production/proceso', data),
    eliminarProceso: (id) => api.delete(`/production/proceso/${id}`),
    // Producción final: masa → arepas
    getDetalles: (params) => api.get('/production/detalle', { params }),
    crearDetalle: (data) => api.post('/production/detalle', data),
    eliminarDetalle: (id) => api.delete(`/production/detalle/${id}`),
    // Lotes de producción con costos
    getLotes: (params) => api.get('/production/lotes', { params }),
    crearLote: (data) => api.post('/production/lotes', data),
    eliminarLote: (id) => api.delete(`/production/lotes/${id}`),
    // Recetas de cocción
    getRecetas: (soloActivas) => api.get('/production/recetas', { params: { solo_activas: soloActivas ?? false } }),
    crearReceta: (data) => api.post('/production/recetas', data),
    actualizarReceta: (id, data) => api.put(`/production/recetas/${id}`, data),
    eliminarReceta: (id) => api.delete(`/production/recetas/${id}`),
    // Cocciones (ejecución de recetas)
    getCocciones: (params) => api.get('/production/cocciones', { params }),
    ejecutarCoccion: (data) => api.post('/production/cocciones', data),
    actualizarCoccion: (id, data) => api.patch(`/production/cocciones/${id}`, data),
    eliminarCoccion: (id) => api.delete(`/production/cocciones/${id}`),
};

export const analyticsService = {
    forecastMasa:  ()          => api.get('/analytics/forecast-masa'),
    ventas:        (dias = 30) => api.get(`/analytics/ventas?dias=${dias}`),
    productosTop:  (dias = 30) => api.get(`/analytics/productos-top?dias=${dias}`),
    clientesTop:   (dias = 30) => api.get(`/analytics/clientes-top?dias=${dias}`),
    rentabilidad:  (dias = 30) => api.get(`/analytics/rentabilidad?dias=${dias}`),
};

export const costosService = {
    // Facturas de servicios
    getFacturas:     (params)      => api.get('/costos/facturas-servicio', { params }),
    crearFactura:    (data)        => api.post('/costos/facturas-servicio', data),
    actualizarFactura: (id, data)  => api.put(`/costos/facturas-servicio/${id}`, data),
    eliminarFactura: (id)          => api.delete(`/costos/facturas-servicio/${id}`),
    // Costos de producción
    getCostoProceso:  (id)         => api.get(`/costos/coccion/${id}`),
    patchConsumos:    (id, data)   => api.patch(`/costos/coccion/${id}/consumos`, data),
    getHistorial:     (dias = 30)  => api.get(`/costos/historial?dias=${dias}`),
    getIndicadores:   (periodo)    => api.get('/costos/indicadores', { params: periodo ? { periodo } : {} }),
};

// ── RBAC — Roles, Permisos y Usuarios ────────────────────────

export const rolesService = {
    // Permisos del sistema
    getPermisos:        (modulo)  => api.get('/roles/permisos', { params: modulo ? { modulo } : {} }),

    // Roles CRUD
    getRoles:           ()        => api.get('/roles/'),
    getRol:             (id)      => api.get(`/roles/${id}`),
    crearRol:           (data)    => api.post('/roles/', data),
    actualizarRol:      (id, data)=> api.put(`/roles/${id}`, data),
    eliminarRol:        (id)      => api.delete(`/roles/${id}`),

    // Permisos de un rol
    getPermisosRol:     (id)      => api.get(`/roles/${id}/permisos`),
    asignarPermisos:    (id, ids) => api.put(`/roles/${id}/permisos`, { permiso_ids: ids }),

    // Usuarios CRUD administrativo
    getUsuarios:        ()        => api.get('/roles/usuarios/'),
    crearUsuario:       (data)    => api.post('/roles/usuarios/', data),
    actualizarUsuario:  (id, data)=> api.put(`/roles/usuarios/${id}`, data),
    desactivarUsuario:  (id)      => api.delete(`/roles/usuarios/${id}`),
    eliminarUsuario:    (id)      => api.delete(`/roles/usuarios/${id}`, { params: { hard: true } }),
};

export const configService = {
    getHorarioCorte: ()       => api.get('/config/horario-corte'),
    setHorarioCorte: (hora)   => api.put('/config/horario-corte', { hora }),
};

// ── Cash Flow (Flujo de Caja) ───────────────────────────────
export const cashFlowService = {
    dashboard:    ()                        => api.get('/cash-flow/dashboard'),
    timeline:     (params)                  => api.get('/cash-flow/timeline',    { params }),
    categorias:   (params)                  => api.get('/cash-flow/categorias',  { params }),
    proyecciones: (semanas = 4)             => api.get('/cash-flow/proyecciones',{ params: { semanas } }),
    alertas:      ()                        => api.get('/cash-flow/alertas'),
    saldosMediosPago: ()                    => api.get('/cash-flow/saldos-medios-pago'),
    categoriasIngreso: ()                   => api.get('/cash-flow/categorias-ingreso'),
    export:       (params, format)          => api.get('/cash-flow/export',
                                                       { params: { ...params, format }, responseType: 'blob' }),
    // CRUD ingresos manuales
    listIngresosManuales: (params)          => api.get('/cash-flow/ingresos-manuales', { params }),
    crearIngresoManual:   (data)            => api.post('/cash-flow/ingresos-manuales', data),
    actualizarIngresoManual: (id, data)     => api.put(`/cash-flow/ingresos-manuales/${id}`, data),
    anularIngresoManual:  (id)              => api.delete(`/cash-flow/ingresos-manuales/${id}`),
    // Movimientos por medio de pago (vista unificada de fuentes)
    movimientosPorMedio:  (params)          => api.get('/cash-flow/movimientos-por-medio', { params }),
};

export default api;

export const parametrosService = {
    // Unidades de medida
    getUnidades:     (activo)         => api.get('/parametros/unidades', { params: activo != null ? { activo } : {} }),
    crearUnidad:     (data)           => api.post('/parametros/unidades', data),
    actualizarUnidad:(codigo, data)   => api.put(`/parametros/unidades/${codigo}`, data),
    eliminarUnidad:  (codigo)         => api.delete(`/parametros/unidades/${codigo}`),
    // Parámetros del sistema
    getParametros:     (categoria)    => api.get('/parametros/parametros', { params: categoria ? { categoria } : {} }),
    actualizarParametro:(clave, data) => api.put(`/parametros/parametros/${clave}`, data),
    crearParametro:    (data)         => api.post('/parametros/parametros', data),
    eliminarParametro: (clave)        => api.delete(`/parametros/parametros/${clave}`),
    // Tipos de producto
    getTiposProducto:    (activo)       => api.get('/parametros/tipos-producto', { params: activo != null ? { activo } : {} }),
    crearTipoProducto:   (data)         => api.post('/parametros/tipos-producto', data),
    actualizarTipoProducto:(codigo,data) => api.put(`/parametros/tipos-producto/${codigo}`, data),
    eliminarTipoProducto:(codigo)        => api.delete(`/parametros/tipos-producto/${codigo}`),
    // Tipos de cliente
    getTiposCliente:    (activo)       => api.get('/parametros/tipos-cliente', { params: activo != null ? { activo } : {} }),
    crearTipoCliente:   (data)         => api.post('/parametros/tipos-cliente', data),
    actualizarTipoCliente:(codigo,data) => api.put(`/parametros/tipos-cliente/${codigo}`, data),
    eliminarTipoCliente:(codigo)        => api.delete(`/parametros/tipos-cliente/${codigo}`),
    // Módulos (catálogo de dominios que tienen categorías)
    getModulos:           (activo)        => api.get('/parametros/modulos', { params: activo != null ? { activo } : {} }),
    // Categorías genéricas (filtran por ?modulo=gastos|ingresos|...). Incluyen subcategorías embebidas.
    getCategorias:        (params={})     => api.get('/parametros/categorias', { params }),
    crearCategoria:       (data)          => api.post('/parametros/categorias', data),
    actualizarCategoria:  (id, data)      => api.put(`/parametros/categorias/${id}`, data),
    eliminarCategoria:    (id)            => api.delete(`/parametros/categorias/${id}`),
    // Subcategorías genéricas
    getSubcategorias:     (params={})     => api.get('/parametros/subcategorias', { params }),
    crearSubcategoria:    (data)          => api.post('/parametros/subcategorias', data),
    actualizarSubcategoria:(id, data)     => api.put(`/parametros/subcategorias/${id}`, data),
    eliminarSubcategoria: (id)            => api.delete(`/parametros/subcategorias/${id}`),
};

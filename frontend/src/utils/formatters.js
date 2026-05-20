/**
 * Utility functions for formatting data across the application.
 * Zona horaria canónica: America/Bogota (UTC-5, sin DST)
 */

const TZ = 'America/Bogota';

/**
 * Retorna la fecha actual en America/Bogota como string YYYY-MM-DD.
 * Usar SIEMPRE en lugar de new Date().toISOString().split('T')[0]
 * para evitar desfases cuando son las 7pm+ UTC (medianoche en Bogotá).
 */
export const todayBogota = () =>
    new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(new Date());

/**
 * Convierte cualquier Date o string ISO a YYYY-MM-DD en zona Bogotá.
 * @param {Date|string} date
 * @returns {string} YYYY-MM-DD
 */
export const toDateBogota = (date) => {
    const d = date instanceof Date ? date : new Date(date);
    return new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(d);
};

/**
 * Formatea una fecha a dd/mm/yyyy en zona Bogotá para mostrar al usuario.
 * Acepta YYYY-MM-DD (sin hora) o ISO con hora.
 * @param {string|Date} dateInput
 * @returns {string} dd/mm/yyyy
 */
export const formatDateDisplay = (dateInput) => {
    if (!dateInput) return 'N/A';
    try {
        // YYYY-MM-DD sin hora: parsear como fecha local de Bogotá, sin conversión UTC
        if (typeof dateInput === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateInput)) {
            const [y, m, d] = dateInput.split('-');
            return `${d}/${m}/${y}`;
        }
        // Con hora (ISO): convertir a Bogotá y formatear
        const d = new Date(dateInput);
        if (isNaN(d.getTime())) return 'Fecha inválida';
        return new Intl.DateTimeFormat('es-CO', {
            timeZone: TZ,
            day: '2-digit', month: '2-digit', year: 'numeric',
        }).format(d);
    } catch {
        return 'Error fecha';
    }
};

/**
 * Formats a number as Colombian Peso (COP)
 * @param {number|string} value - The value to format
 * @returns {string} Formatted currency string
 */
export const formatCurrency = (value) => {
    const num = parseFloat(value) || 0;
    return new Intl.NumberFormat('es-CO', {
        style: 'currency',
        currency: 'COP',
        maximumFractionDigits: 0
    }).format(num);
};

/**
 * Formats a date string or object to dd/mm/yyyy in America/Bogota timezone.
 * @param {string|Date} dateInput - The date to format
 * @returns {string} Formatted date string dd/mm/yyyy
 */
export const formatDate = (dateInput) => formatDateDisplay(dateInput);

/**
 * Formatea fecha + hora a dd/mm/yyyy HH:mm en zona Bogotá.
 * Para timestamps con hora. Si el input es YYYY-MM-DD sin hora,
 * devuelve solo la fecha.
 * @param {string|Date} dateInput
 * @returns {string} dd/mm/yyyy HH:mm
 */
export const formatDateTime = (dateInput) => {
    if (!dateInput) return 'N/A';
    try {
        if (typeof dateInput === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateInput)) {
            return formatDateDisplay(dateInput);
        }
        const d = dateInput instanceof Date ? dateInput : new Date(dateInput);
        if (isNaN(d.getTime())) return 'Fecha inválida';
        return new Intl.DateTimeFormat('es-CO', {
            timeZone: TZ,
            day: '2-digit', month: '2-digit', year: 'numeric',
            hour: '2-digit', minute: '2-digit', hour12: false,
        }).format(d).replace(',', '');
    } catch {
        return 'Error fecha';
    }
};

/**
 * Formato largo: "viernes, 12 de marzo de 2026". Para encabezados/saludos.
 * Para tablas y listados usar formatDate.
 * @param {string|Date} dateInput
 * @returns {string}
 */
export const formatDateLong = (dateInput) => {
    if (!dateInput) return 'N/A';
    try {
        const d = dateInput instanceof Date ? dateInput : new Date(dateInput);
        if (isNaN(d.getTime())) return 'Fecha inválida';
        return new Intl.DateTimeFormat('es-CO', {
            timeZone: TZ,
            weekday: 'long', day: '2-digit', month: 'long', year: 'numeric',
        }).format(d);
    } catch {
        return 'Error fecha';
    }
};

/**
 * Returns consistent label and color class for statuses
 * @param {string} status - The status key
 * @returns {object} { label, colorClass }
 */
export const formatStatus = (status) => {
    const s = (status || '').toLowerCase();
    const statuses = {
        'pagado': { label: 'PAGADO', colorClass: 'text-success' },
        'pendiente': { label: 'PENDIENTE', colorClass: 'text-danger' },
        'parcial': { label: 'PARCIAL', colorClass: 'text-primary' },
        'cancelado': { label: 'CANCELADO', colorClass: 'text-danger' },
        'credito': { label: 'CRÉDITO', colorClass: 'text-danger' }
    };

    return statuses[s] || { label: s.toUpperCase(), colorClass: 'text-muted' };
};

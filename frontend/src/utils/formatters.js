/**
 * Utility functions for formatting data across the application.
 */

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
 * Formats a date string or object to dd/mm/yyyy
 * @param {string|Date} dateInput - The date to format
 * @returns {string} Formatted date string
 */
export const formatDate = (dateInput) => {
    if (!dateInput) return 'N/A';

    try {
        // If it's a YYYY-MM-DD string, handle it manually to avoid timezone shifts
        if (typeof dateInput === 'string' && dateInput.length === 10 && dateInput.includes('-')) {
            const [year, month, day] = dateInput.split('-');
            return `${day}/${month}/${year}`;
        }

        const date = new Date(dateInput);
        if (isNaN(date.getTime())) return 'Fecha Inválida';

        // Use UTC methods to avoid local timezone shifts for date-only strings
        const day = String(date.getUTCDate()).padStart(2, '0');
        const month = String(date.getUTCMonth() + 1).padStart(2, '0');
        const year = date.getUTCFullYear();

        return `${day}/${month}/${year}`;
    } catch (e) {
        return 'Error Fecha';
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

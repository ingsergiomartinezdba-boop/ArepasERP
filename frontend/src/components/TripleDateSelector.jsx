import React from 'react';

/**
 * TripleDateSelector Component
 * 
 * Un selector de fecha de tres columnas (Día / Mes / Año) con diseño estandarizado.
 * 
 * @param {string} value - Fecha en formato YYYY-MM-DD
 * @param {Function} onChange - Función que recibe la nueva fecha en formato YYYY-MM-DD
 */
export default function TripleDateSelector({ value, onChange }) {
    // Ensure we have a valid initial state if value is empty or invalid
    const getInitialDate = () => {
        const now = new Date();
        const y = String(now.getFullYear());
        const m = String(now.getMonth() + 1).padStart(2, '0');
        const d = String(now.getDate()).padStart(2, '0');
        return [y, m, d];
    };

    const dateParts = (value || '').split('-');
    const [year, month, day] = dateParts.length === 3 ? dateParts : getInitialDate();

    // Logic for dynamic days in month
    const daysInMonth = new Date(parseInt(year), parseInt(month), 0).getDate();

    // If current selected day is higher than max days in month, we'll need to adjust it
    const currentDay = parseInt(day);
    const validDay = currentDay > daysInMonth ? String(daysInMonth).padStart(2, '0') : day;

    const handleDatePartChange = (part, newVal) => {
        let y = year;
        let m = month;
        let d = validDay;

        if (part === 'year') {
            y = newVal;
            // Re-check days in month for the new year (leap year)
            const newDays = new Date(parseInt(y), parseInt(m), 0).getDate();
            if (parseInt(d) > newDays) d = String(newDays).padStart(2, '0');
        }
        if (part === 'month') {
            m = newVal;
            // Re-check days in month for the new month
            const newDays = new Date(parseInt(y), parseInt(m), 0).getDate();
            if (parseInt(d) > newDays) d = String(newDays).padStart(2, '0');
        }
        if (part === 'day') d = newVal;

        onChange(`${y}-${m}-${d}`);
    };

    const months = [
        { val: '01', label: 'Ene' },
        { val: '02', label: 'Feb' },
        { val: '03', label: 'Mar' },
        { val: '04', label: 'Abr' },
        { val: '05', label: 'May' },
        { val: '06', label: 'Jun' },
        { val: '07', label: 'Jul' },
        { val: '08', label: 'Ago' },
        { val: '09', label: 'Sep' },
        { val: '10', label: 'Oct' },
        { val: '11', label: 'Nov' },
        { val: '12', label: 'Dic' }
    ];

    const containerStyle = {
        display: 'inline-flex',
        alignItems: 'center',
        backgroundColor: 'rgba(0, 0, 0, 0.2)',
        border: '2px solid var(--primary)',
        borderRadius: 'var(--radius)',
        padding: '0 0.5rem',
        height: '42px',
        color: 'white',
        fontWeight: 'bold'
    };

    const selectStyle = {
        backgroundColor: 'transparent',
        border: 'none',
        color: 'white',
        fontWeight: 'bold',
        fontSize: '0.95rem',
        padding: '0 0.25rem',
        cursor: 'pointer',
        outline: 'none',
        textAlign: 'center',
        width: 'auto',
        minWidth: '40px'
    };

    const separatorStyle = {
        color: 'var(--primary)',
        fontWeight: '900',
        fontSize: '1.2rem',
        margin: '0 0.25rem'
    };

    return (
        <div style={containerStyle}>
            {/* Día */}
            <select
                style={selectStyle}
                value={validDay}
                onChange={(e) => handleDatePartChange('day', e.target.value)}
            >
                {Array.from({ length: daysInMonth }, (_, i) => i + 1).map(d => {
                    const val = String(d).padStart(2, '0');
                    return <option key={val} value={val} style={{ backgroundColor: '#333' }}>{val}</option>;
                })}
            </select>

            <span style={separatorStyle}>/</span>

            {/* Mes */}
            <select
                style={{ ...selectStyle, minWidth: '60px' }}
                value={month}
                onChange={(e) => handleDatePartChange('month', e.target.value)}
            >
                {months.map(m => (
                    <option key={m.val} value={m.val} style={{ backgroundColor: '#333' }}>{m.label}</option>
                ))}
            </select>

            <span style={separatorStyle}>/</span>

            {/* Año */}
            <select
                style={{ ...selectStyle, minWidth: '65px' }}
                value={year}
                onChange={(e) => handleDatePartChange('year', e.target.value)}
            >
                {[2024, 2025, 2026, 2027, 2028, 2029, 2030].map(y => (
                    <option key={y} value={String(y)} style={{ backgroundColor: '#333' }}>{y}</option>
                ))}
            </select>
        </div>
    );
}

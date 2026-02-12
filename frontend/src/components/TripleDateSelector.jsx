import React from 'react';

/**
 * TripleDateSelector Component
 * 
 * Un selector de fecha premium de tres columnas (Día / Mes / Año) estandarizado.
 * 
 * @param {string} value - Fecha en formato YYYY-MM-DD
 * @param {Function} onChange - Función que recibe la nueva fecha en formato YYYY-MM-DD
 * @param {object} style - Estilos adicionales para el contenedor
 */
export default function TripleDateSelector({ value, onChange, style = {} }) {
    // Manejo de fecha inicial
    const getInitialDate = () => {
        const now = new Date();
        const y = String(now.getFullYear());
        const m = String(now.getMonth() + 1).padStart(2, '0');
        const d = String(now.getDate()).padStart(2, '0');
        return [y, m, d];
    };

    const dateParts = (value || '').split('-');
    const [year, month, day] = dateParts.length === 3 ? dateParts : getInitialDate();

    // Lógica de días dinámicos por mes
    const daysInMonth = new Date(parseInt(year), parseInt(month), 0).getDate();
    const validDay = parseInt(day) > daysInMonth ? String(daysInMonth).padStart(2, '0') : day;

    const handleDatePartChange = (part, newVal) => {
        let y = year;
        let m = month;
        let d = validDay;

        if (part === 'year') y = newVal;
        if (part === 'month') m = newVal;
        if (part === 'day') d = newVal;

        // Validar que el día no exceda el máximo del mes al cambiar mes/año
        const newMaxDays = new Date(parseInt(y), parseInt(m), 0).getDate();
        if (parseInt(d) > newMaxDays) d = String(newMaxDays).padStart(2, '0');

        onChange(`${y}-${m}-${d}`);
    };

    const months = [
        { v: '01', l: 'Ene' }, { v: '02', l: 'Feb' }, { v: '03', l: 'Mar' },
        { v: '04', l: 'Abr' }, { v: '05', l: 'May' }, { v: '06', l: 'Jun' },
        { v: '07', l: 'Jul' }, { v: '08', l: 'Ago' }, { v: '09', l: 'Sep' },
        { v: '10', l: 'Oct' }, { v: '11', l: 'Nov' }, { v: '12', l: 'Dic' }
    ];

    const selectStyle = {
        background: 'transparent',
        outline: 'none',
        textAlign: 'center',
        fontWeight: 'bold',
        cursor: 'pointer',
        fontSize: '1.3rem',
        border: 'none',
        color: 'white',
        WebkitAppearance: 'none',
        MozAppearance: 'none',
        appearance: 'none',
        padding: 0
    };

    const separatorStyle = {
        color: 'var(--primary)',
        fontWeight: '900',
        fontSize: '1.3rem'
    };

    return (
        <div
            className="flex bg-card rounded border border-input items-center"
            style={{
                padding: '0.4rem 0.6rem',
                minWidth: '320px',
                justifyContent: 'center',
                gap: '4px',
                ...style
            }}
        >
            {/* Día */}
            <select
                style={{ ...selectStyle, width: '70px' }}
                value={validDay}
                onChange={(e) => handleDatePartChange('day', e.target.value)}
            >
                {Array.from({ length: 31 }, (_, i) => i + 1).map(d => {
                    const val = String(d).padStart(2, '0');
                    return <option key={val} value={val}>{val}</option>;
                })}
            </select>

            <span style={separatorStyle}>/</span>

            {/* Mes */}
            <select
                style={{ ...selectStyle, width: '90px' }}
                value={month}
                onChange={(e) => handleDatePartChange('month', e.target.value)}
            >
                {months.map(m => (
                    <option key={m.v} value={m.v}>{m.l}</option>
                ))}
            </select>

            <span style={separatorStyle}>/</span>

            {/* Año */}
            <select
                style={{ ...selectStyle, width: '100px' }}
                value={year}
                onChange={(e) => handleDatePartChange('year', e.target.value)}
            >
                {[2024, 2025, 2026, 2027, 2028].map(y => (
                    <option key={y} value={String(y)}>{y}</option>
                ))}
            </select>
        </div>
    );
}

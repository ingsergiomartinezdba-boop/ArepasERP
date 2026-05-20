import { todayBogota } from '../utils/formatters';

/**
 * TripleDateSelector — Selector de fecha dd/mm/yyyy en zona America/Bogota.
 *
 * Props:
 *   value    {string}   Fecha en formato YYYY-MM-DD (valor interno canónico)
 *   onChange {Function} Recibe la nueva fecha en formato YYYY-MM-DD
 *   label    {string}   Etiqueta opcional encima del selector
 *   required {boolean}  Si el campo es obligatorio
 *   style    {object}   Estilos adicionales para el contenedor
 *
 * Zona horaria: America/Bogota — la fecha inicial usa todayBogota() para
 * evitar el desfase UTC que ocurre entre las 7pm y medianoche UTC.
 *
 * Formato visible: dd / mmm / yyyy  (día primero, colombiano)
 * Formato enviado al backend: YYYY-MM-DD
 */
export default function TripleDateSelector({ value, onChange, label, required = false, style = {} }) {

    // Fecha inicial: Bogotá, no UTC
    const parsedValue = () => {
        if (value && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
            const [y, m, d] = value.split('-');
            return { year: y, month: m, day: d };
        }
        const today = todayBogota(); // YYYY-MM-DD en Bogotá
        const [y, m, d] = today.split('-');
        return { year: y, month: m, day: d };
    };

    const { year, month, day } = parsedValue();

    // Días válidos para el mes/año actual
    const daysInMonth = new Date(parseInt(year), parseInt(month), 0).getDate();
    const safeDay = parseInt(day) > daysInMonth
        ? String(daysInMonth).padStart(2, '0')
        : day;

    const emit = (newYear, newMonth, newDay) => {
        const maxDays = new Date(parseInt(newYear), parseInt(newMonth), 0).getDate();
        const clampedDay = parseInt(newDay) > maxDays
            ? String(maxDays).padStart(2, '0')
            : newDay;
        onChange(`${newYear}-${newMonth}-${clampedDay}`);
    };

    const months = [
        { v: '01', l: 'Ene' }, { v: '02', l: 'Feb' }, { v: '03', l: 'Mar' },
        { v: '04', l: 'Abr' }, { v: '05', l: 'May' }, { v: '06', l: 'Jun' },
        { v: '07', l: 'Jul' }, { v: '08', l: 'Ago' }, { v: '09', l: 'Sep' },
        { v: '10', l: 'Oct' }, { v: '11', l: 'Nov' }, { v: '12', l: 'Dic' },
    ];

    const years = [2023, 2024, 2025, 2026, 2027, 2028];

    const selectBase = {
        background: 'transparent',
        border: 'none',
        outline: 'none',
        color: 'var(--text-primary)',
        fontFamily: 'var(--font)',
        fontWeight: '600',
        fontSize: '0.9rem',
        cursor: 'pointer',
        textAlign: 'center',
        WebkitAppearance: 'none',
        MozAppearance: 'none',
        appearance: 'none',
        padding: '0',
        minWidth: 0,
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', ...style }}>
            {label && (
                <label style={{
                    display: 'block',
                    fontSize: '0.8rem',
                    fontWeight: 600,
                    color: 'var(--text-secondary)',
                    letterSpacing: '0.02em',
                    whiteSpace: 'nowrap',
                }}>
                    {label}{required && <span style={{ color: 'var(--danger)', marginLeft: 3 }}>*</span>}
                </label>
            )}

            <div
                style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    height: '38px',
                    padding: '0 10px',
                    background: 'var(--bg-elevated)',
                    border: '1px solid var(--border-default)',
                    borderRadius: 'var(--r-md)',
                    transition: 'border-color var(--transition), box-shadow var(--transition)',
                    width: '100%',
                    boxSizing: 'border-box',
                }}
                onFocusCapture={e => {
                    e.currentTarget.style.borderColor = 'var(--brand)';
                    e.currentTarget.style.boxShadow = '0 0 0 3px var(--brand-muted)';
                }}
                onBlurCapture={e => {
                    e.currentTarget.style.borderColor = 'var(--border-default)';
                    e.currentTarget.style.boxShadow = 'none';
                }}
            >
                {/* Día — flex 1 para ocupar espacio proporcional */}
                <select
                    style={{ ...selectBase, flex: '1 1 0', minWidth: 28 }}
                    value={safeDay}
                    onChange={e => emit(year, month, e.target.value)}
                    aria-label="Día"
                >
                    {Array.from({ length: 31 }, (_, i) => {
                        const v = String(i + 1).padStart(2, '0');
                        return <option key={v} value={v}>{v}</option>;
                    })}
                </select>

                <span style={{ color: 'var(--brand)', fontWeight: 700, fontSize: '0.9rem', flexShrink: 0, userSelect: 'none' }}>/</span>

                {/* Mes */}
                <select
                    style={{ ...selectBase, flex: '1.5 1 0', minWidth: 36 }}
                    value={month}
                    onChange={e => emit(year, e.target.value, safeDay)}
                    aria-label="Mes"
                >
                    {months.map(m => (
                        <option key={m.v} value={m.v}>{m.l}</option>
                    ))}
                </select>

                <span style={{ color: 'var(--brand)', fontWeight: 700, fontSize: '0.9rem', flexShrink: 0, userSelect: 'none' }}>/</span>

                {/* Año */}
                <select
                    style={{ ...selectBase, flex: '2 1 0', minWidth: 46 }}
                    value={year}
                    onChange={e => emit(e.target.value, month, safeDay)}
                    aria-label="Año"
                >
                    {years.map(y => (
                        <option key={y} value={String(y)}>{y}</option>
                    ))}
                </select>
            </div>
        </div>
    );
}

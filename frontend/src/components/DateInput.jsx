import { useRef } from 'react';

export default function DateInput({ value, onChange, required, style = {}, height = 42 }) {
    const ref = useRef();

    const display = (() => {
        if (!value) return 'dd/mm/yyyy';
        const [y, m, d] = value.split('-');
        return d && m && y ? `${d}/${m}/${y}` : 'dd/mm/yyyy';
    })();

    const open = () => {
        try { ref.current?.showPicker(); } catch { ref.current?.click(); }
    };

    return (
        <div style={{ position: 'relative', display: 'inline-block', ...style }}>
            <button
                type="button"
                onClick={open}
                style={{
                    height, padding: '0 12px',
                    background: 'var(--bg-secondary)',
                    border: '1px solid var(--border)',
                    borderRadius: 9,
                    fontSize: 14, fontWeight: 600,
                    color: value ? 'var(--text-secondary)' : 'var(--text-muted)',
                    cursor: 'pointer',
                    display: 'flex', alignItems: 'center',
                    whiteSpace: 'nowrap',
                    minWidth: 130,
                }}
            >
                {display}
            </button>

            <input
                ref={ref}
                type="date"
                value={value || ''}
                onChange={e => onChange(e.target.value)}
                required={required}
                style={{ position: 'absolute', opacity: 0, pointerEvents: 'none', width: 0, height: 0, top: 0, left: 0 }}
            />
        </div>
    );
}

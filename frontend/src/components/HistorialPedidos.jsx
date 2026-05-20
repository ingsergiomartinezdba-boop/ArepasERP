import { useEffect, useMemo, useState } from 'react';
import { Package, Search, Calendar, ChevronDown, X } from 'lucide-react';
import api from '../services/api';
import { formatDate } from '../utils/formatters';

const ESTADOS = {
    pendiente:  { label: 'Pendiente',  color: '#f59e0b' },
    por_cobrar: { label: 'Por pagar',  color: '#3b82f6' },
    pagado:     { label: 'Pagado',     color: '#22c55e' },
    cancelado:  { label: 'Cancelado',  color: '#ef4444' },
};

const fmt = (n) => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(n ?? 0);
const fmtDate = (d) => d ? formatDate(d) : '—';

// Helpers para filtro de fecha con formato dd/mm/yyyy
const ymdToDmy = (ymd) => {
    if (!ymd) return '';
    const [y, m, d] = ymd.split('-');
    return `${d}/${m}/${y}`;
};
// Acepta dd/mm/yyyy y devuelve yyyy-mm-dd, o null si incompleto/ inválido
const dmyToYmd = (dmy) => {
    if (!dmy) return '';
    const m = dmy.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if (!m) return null;
    const [_, dd, mm, yyyy] = m;
    const day = +dd, month = +mm, year = +yyyy;
    if (month < 1 || month > 12 || day < 1 || day > 31 || year < 1900) return null;
    return `${yyyy}-${mm}-${dd}`;
};
// Formatea mientras el usuario escribe: auto-inserta "/" en posiciones 2 y 5
const maskDmyInput = (raw) => {
    const digits = raw.replace(/\D/g, '').slice(0, 8);
    const parts = [digits.slice(0, 2), digits.slice(2, 4), digits.slice(4, 8)].filter(Boolean);
    return parts.join('/');
};

export default function HistorialPedidos() {
    const [pedidos, setPedidos]   = useState([]);
    const [loading, setLoading]   = useState(true);
    const [error, setError]       = useState('');
    const [expandido, setExpandido] = useState(null); // pedido id expandido

    // Filtros
    const [filtroEstado, setFiltroEstado] = useState('');   // '' = todos
    const [fechaDesde, setFechaDesde]     = useState('');
    const [fechaHasta, setFechaHasta]     = useState('');
    const [busqueda, setBusqueda]         = useState('');

    useEffect(() => {
        api.get('/portal/mis-pedidos')
            .then(r => setPedidos(r.data))
            .catch(() => setError('No se pudo cargar el historial'))
            .finally(() => setLoading(false));
    }, []);

    const filtrados = useMemo(() => {
        let rows = pedidos;
        if (filtroEstado)  rows = rows.filter(p => p.estado === filtroEstado);
        if (fechaDesde)    rows = rows.filter(p => p.fecha >= fechaDesde);
        if (fechaHasta)    rows = rows.filter(p => p.fecha <= fechaHasta + 'T23:59:59');
        if (busqueda) {
            const q = busqueda.toLowerCase();
            rows = rows.filter(p =>
                String(p.id).includes(q)
                || (p.observaciones || '').toLowerCase().includes(q)
                || (p.items || []).some(it => it.nombre.toLowerCase().includes(q))
            );
        }
        return rows;
    }, [pedidos, filtroEstado, fechaDesde, fechaHasta, busqueda]);

    const resumen = useMemo(() => ({
        total:   filtrados.reduce((s, p) => s + (p.total || 0), 0),
        pagado:  filtrados.reduce((s, p) => s + (p.monto_pagado || 0), 0),
        saldo:   filtrados.reduce((s, p) => s + (p.saldo || 0), 0),
        count:   filtrados.length,
    }), [filtrados]);

    const limpiarFiltros = () => {
        setFiltroEstado(''); setFechaDesde(''); setFechaHasta(''); setBusqueda('');
    };
    const hayFiltro = !!(filtroEstado || fechaDesde || fechaHasta || busqueda);

    const estadosConDatos = Object.keys(ESTADOS).filter(k => pedidos.some(p => p.estado === k));

    if (loading) {
        return <div style={{ textAlign: 'center', padding: 48 }}><div className="spinner" /></div>;
    }
    if (error) {
        return <div style={{ padding: 18, color: '#fca5a5', background: 'rgba(239,68,68,0.08)', borderRadius: 10 }}>{error}</div>;
    }

    return (
        <div>
            {/* Resumen de la lista filtrada */}
            <div style={{
                display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))',
                gap: 8, marginBottom: 12,
            }}>
                <Chip label="Pedidos"   value={resumen.count} />
                <Chip label="Total"     value={fmt(resumen.total)} />
                <Chip label="Pagado"    value={fmt(resumen.pagado)} color="#22c55e" />
                <Chip label="Por pagar" value={fmt(resumen.saldo)}  color={resumen.saldo > 0 ? '#f59e0b' : undefined} />
            </div>

            {/* Filtros */}
            <div style={{
                background: 'rgba(255,255,255,0.03)',
                border: '1px solid rgba(255,255,255,0.07)',
                borderRadius: 12, padding: 14, marginBottom: 12,
            }}>
                {/* Cabecera: título + limpiar */}
                <div style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    marginBottom: 12,
                }}>
                    <span style={{
                        fontSize: 10, fontWeight: 700, letterSpacing: '0.1em',
                        textTransform: 'uppercase', color: 'rgba(255,221,25,0.55)',
                    }}>Filtros</span>
                    {hayFiltro && (
                        <button onClick={limpiarFiltros} style={{
                            background: 'rgba(239,68,68,0.08)', color: '#fca5a5',
                            border: '1px solid rgba(239,68,68,0.25)', borderRadius: 6,
                            padding: '3px 10px', fontSize: 11, fontWeight: 600, cursor: 'pointer',
                            display: 'flex', alignItems: 'center', gap: 4,
                        }}>
                            <X size={11} /> Limpiar
                        </button>
                    )}
                </div>

                {/* Buscador */}
                <FilterLabel>Búsqueda</FilterLabel>
                <div style={{ position: 'relative', marginBottom: 14 }}>
                    <Search size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'rgba(255,255,255,0.4)' }} />
                    <input
                        type="text"
                        value={busqueda}
                        onChange={e => setBusqueda(e.target.value)}
                        placeholder="# pedido, producto u observación…"
                        style={inputStyle({ paddingLeft: 34 })}
                    />
                </div>

                {/* Fechas */}
                <FilterLabel>Rango de fechas</FilterLabel>
                <div style={{
                    display: 'grid', gridTemplateColumns: '1fr 1fr',
                    gap: 10, marginBottom: 14,
                }}>
                    <DateInput label="Desde" value={fechaDesde} onChange={setFechaDesde} />
                    <DateInput label="Hasta" value={fechaHasta} onChange={setFechaHasta} />
                </div>

                {/* Estados */}
                <FilterLabel>Estado</FilterLabel>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    <button onClick={() => setFiltroEstado('')} style={pillStyle(filtroEstado === '')}>
                        Todos
                    </button>
                    {estadosConDatos.map(k => (
                        <button key={k} onClick={() => setFiltroEstado(k)}
                            style={pillStyle(filtroEstado === k, ESTADOS[k].color)}>
                            {ESTADOS[k].label}
                        </button>
                    ))}
                </div>
            </div>

            {/* Lista */}
            {filtrados.length === 0 ? (
                <div style={{
                    padding: 32, textAlign: 'center',
                    background: 'rgba(255,255,255,0.03)',
                    border: '1px dashed rgba(255,255,255,0.1)',
                    borderRadius: 12, color: 'rgba(255,255,255,0.5)', fontSize: 13,
                }}>
                    {hayFiltro ? 'No hay pedidos con esos filtros.' : 'Aún no tienes pedidos registrados.'}
                </div>
            ) : (
                <div style={{ display: 'grid', gap: 8 }}>
                    {filtrados.map(p => {
                        const est = ESTADOS[p.estado] ?? { label: p.estado, color: 'rgba(255,255,255,0.4)' };
                        const abierto = expandido === p.id;
                        return (
                            <div key={p.id} style={{
                                background: 'rgba(255,255,255,0.03)',
                                border: `1px solid ${abierto ? 'rgba(255,221,25,0.25)' : 'rgba(255,255,255,0.07)'}`,
                                borderRadius: 10, overflow: 'hidden', transition: 'border-color 0.15s',
                            }}>
                                <button
                                    onClick={() => setExpandido(abierto ? null : p.id)}
                                    style={{
                                        width: '100%', padding: '12px 14px', background: 'transparent', border: 'none',
                                        display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap',
                                        cursor: 'pointer', textAlign: 'left',
                                    }}
                                >
                                    <Package size={15} style={{ color: 'rgba(255,221,25,0.5)' }} />
                                    <span style={{ fontWeight: 800, color: '#fff', fontSize: 14 }}>#{p.id}</span>
                                    <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)' }}>{fmtDate(p.fecha)}</span>
                                    <span style={{
                                        fontSize: 10, fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase',
                                        padding: '2px 8px', borderRadius: 20,
                                        background: est.color + '22', color: est.color,
                                    }}>
                                        {est.label}
                                    </span>
                                    <span style={{ marginLeft: 'auto', fontWeight: 700, color: '#fff', fontSize: 14 }}>
                                        {fmt(p.total)}
                                    </span>
                                    {p.saldo > 0 && (
                                        <span style={{ fontSize: 11, fontWeight: 700, color: '#f59e0b' }}>
                                            Por pagar {fmt(p.saldo)}
                                        </span>
                                    )}
                                    <ChevronDown size={14} style={{
                                        color: 'rgba(255,221,25,0.5)',
                                        transform: abierto ? 'rotate(180deg)' : 'none',
                                        transition: 'transform 0.2s',
                                    }} />
                                </button>

                                {abierto && (
                                    <div style={{
                                        padding: '4px 14px 14px',
                                        borderTop: '1px solid rgba(255,255,255,0.05)',
                                        background: 'rgba(255,255,255,0.01)',
                                    }}>
                                        {p.items?.length > 0 && (
                                            <table style={{ width: '100%', fontSize: 12, marginTop: 10, borderCollapse: 'collapse' }}>
                                                <thead>
                                                    <tr>
                                                        {['Producto', 'Cant.', 'Precio', 'Subtotal'].map(h => (
                                                            <th key={h} style={{
                                                                textAlign: 'left', padding: '6px 8px',
                                                                color: 'rgba(255,221,25,0.55)',
                                                                fontWeight: 700, fontSize: 10, letterSpacing: '0.06em', textTransform: 'uppercase',
                                                                borderBottom: '1px solid rgba(255,255,255,0.05)',
                                                            }}>{h}</th>
                                                        ))}
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {p.items.map((it, i) => (
                                                        <tr key={i} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                                                            <td style={{ padding: '6px 8px', color: 'rgba(255,255,255,0.85)' }}>{it.nombre}</td>
                                                            <td style={{ padding: '6px 8px', color: 'rgba(255,255,255,0.55)' }}>{it.cantidad}</td>
                                                            <td style={{ padding: '6px 8px', color: 'rgba(255,255,255,0.55)' }}>{fmt(it.precio)}</td>
                                                            <td style={{ padding: '6px 8px', fontWeight: 700, color: '#fff' }}>{fmt(it.subtotal)}</td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        )}

                                        <div style={{
                                            display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))',
                                            gap: 8, marginTop: 10, fontSize: 12,
                                        }}>
                                            {p.valor_domicilio > 0 && (
                                                <Info label="Domicilio" value={fmt(p.valor_domicilio)} />
                                            )}
                                            <Info label="Pagado" value={fmt(p.monto_pagado)} color="#22c55e" />
                                            {p.saldo > 0 && <Info label="Por pagar" value={fmt(p.saldo)} color="#f59e0b" />}
                                        </div>

                                        {p.observaciones && (
                                            <div style={{
                                                marginTop: 10, padding: 10, borderRadius: 8,
                                                background: 'rgba(255,255,255,0.03)',
                                                fontSize: 12, color: 'rgba(255,255,255,0.65)', fontStyle: 'italic',
                                            }}>
                                                <strong style={{ color: 'rgba(255,221,25,0.6)', fontStyle: 'normal' }}>Observaciones:</strong>{' '}
                                                {p.observaciones}
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}

function Chip({ label, value, color }) {
    return (
        <div style={{
            background: 'rgba(255,255,255,0.03)',
            border: '1px solid rgba(255,255,255,0.07)',
            borderRadius: 10, padding: '8px 12px',
        }}>
            <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.35)' }}>
                {label}
            </div>
            <div style={{ fontSize: 15, fontWeight: 800, color: color || '#fff', marginTop: 2 }}>{value}</div>
        </div>
    );
}

function Info({ label, value, color }) {
    return (
        <div style={{ display: 'flex', gap: 6, alignItems: 'baseline' }}>
            <span style={{ color: 'rgba(255,255,255,0.45)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{label}:</span>
            <span style={{ color: color || '#fff', fontWeight: 700 }}>{value}</span>
        </div>
    );
}

function pillStyle(active, activeColor) {
    return {
        padding: '5px 14px', borderRadius: 999,
        border: '1px solid',
        borderColor: active ? (activeColor || 'rgba(255,221,25,0.4)') : 'rgba(255,255,255,0.08)',
        background:  active ? ((activeColor || '#ffdd19') + '18') : 'rgba(255,255,255,0.02)',
        color:       active ? (activeColor || '#ffdd19') : 'rgba(255,255,255,0.55)',
        fontSize: 11, fontWeight: 700, cursor: 'pointer',
        textTransform: 'uppercase', letterSpacing: '0.04em',
        transition: 'all 0.15s',
    };
}

function inputStyle({ paddingLeft = 12 } = {}) {
    return {
        width: '100%',
        padding: `8px 12px 8px ${paddingLeft}px`,
        background: 'rgba(255,255,255,0.04)',
        color: '#fff',
        border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: 8,
        fontSize: 13,
        outline: 'none',
    };
}

const miniLabelStyle = {
    display: 'block',
    fontSize: 10,
    fontWeight: 600,
    color: 'rgba(255,255,255,0.4)',
    letterSpacing: '0.04em',
    marginBottom: 4,
};

function FilterLabel({ children }) {
    return (
        <div style={{
            fontSize: 11, fontWeight: 700,
            color: 'rgba(255,255,255,0.45)',
            textTransform: 'uppercase', letterSpacing: '0.06em',
            marginBottom: 6,
        }}>{children}</div>
    );
}

/**
 * Input de fecha con formato dd/mm/yyyy (independiente del locale del navegador).
 * Estado interno: texto crudo con máscara. Al escribir una fecha válida se
 * dispara onChange con el valor en formato yyyy-mm-dd (el que usa el filtro).
 */
function DateInput({ label, value, onChange }) {
    const [text, setText] = useState(ymdToDmy(value));

    // Si el padre resetea (ej. "Limpiar filtros"), sincronizar.
    useEffect(() => {
        setText(ymdToDmy(value));
    }, [value]);

    const handleChange = (e) => {
        const masked = maskDmyInput(e.target.value);
        setText(masked);
        if (!masked) { onChange(''); return; }
        const ymd = dmyToYmd(masked);
        if (ymd) onChange(ymd);
    };

    const esValida = !text || dmyToYmd(text);

    return (
        <div>
            <span style={miniLabelStyle}>{label}</span>
            <div style={{ position: 'relative' }}>
                <Calendar size={12} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'rgba(255,255,255,0.35)' }} />
                <input
                    type="text"
                    inputMode="numeric"
                    placeholder="dd/mm/aaaa"
                    value={text}
                    onChange={handleChange}
                    maxLength={10}
                    style={{
                        ...inputStyle({ paddingLeft: 30 }),
                        borderColor: esValida ? 'rgba(255,255,255,0.08)' : 'rgba(239,68,68,0.4)',
                    }}
                />
            </div>
        </div>
    );
}

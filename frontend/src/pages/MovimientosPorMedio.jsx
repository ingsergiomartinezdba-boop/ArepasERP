import { useState, useEffect, useMemo } from 'react';
import { cashFlowService, paymentMethodsService } from '../services/api';
import { Wallet, Search, X, TrendingUp, TrendingDown, ArrowRightLeft, ShoppingCart, Receipt, PlusCircle, RefreshCw } from 'lucide-react';
import { todayBogota, formatDate, formatCurrency } from '../utils/formatters';

const TIPO_CFG = {
    pedido:         { label: 'Pedido',         icon: ShoppingCart,   color: '#10b981' },
    gasto:          { label: 'Gasto',          icon: Receipt,        color: '#ef4444' },
    movimiento:     { label: 'Movimiento',     icon: ArrowRightLeft, color: '#8b5cf6' },
    ingreso_manual: { label: 'Ingreso manual', icon: PlusCircle,     color: '#ffdd19' },
};

const firstDayOfMonth = () => {
    const t = new Date(todayBogota());
    return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-01`;
};

export default function MovimientosPorMedio() {
    const [items, setItems]                = useState([]);
    const [totales, setTotales]            = useState({ ingresos: 0, egresos: 0, neto: 0 });
    const [methods, setMethods]            = useState([]);
    const [loading, setLoading]            = useState(false);
    const [refreshing, setRefreshing]      = useState(false);

    // Filtros
    const [startDate, setStartDate]        = useState(firstDayOfMonth());
    const [endDate, setEndDate]            = useState(todayBogota());
    const [selectedMedios, setSelectedMedios] = useState(new Set());
    const [selectedTipos, setSelectedTipos]   = useState(new Set());
    const [search, setSearch]              = useState('');

    useEffect(() => {
        paymentMethodsService.getAll()
            .then(r => setMethods((r.data || []).filter(m => m.activo !== false)))
            .catch(() => {});
    }, []);

    useEffect(() => {
        load();
    }, [startDate, endDate, selectedMedios, selectedTipos]);

    const load = async (silent = false) => {
        if (silent) setRefreshing(true); else setLoading(true);
        try {
            const params = { start_date: startDate, end_date: endDate };
            if (selectedMedios.size) params.medio_pago_ids = [...selectedMedios].join(',');
            if (selectedTipos.size)  params.tipos          = [...selectedTipos].join(',');
            const res = await cashFlowService.movimientosPorMedio(params);
            setItems(res.data.items || []);
            setTotales(res.data.totales || { ingresos: 0, egresos: 0, neto: 0 });
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    const toggleMedio = (id) => {
        const next = new Set(selectedMedios);
        if (next.has(id)) next.delete(id); else next.add(id);
        setSelectedMedios(next);
    };

    const toggleTipo = (t) => {
        const next = new Set(selectedTipos);
        if (next.has(t)) next.delete(t); else next.add(t);
        setSelectedTipos(next);
    };

    const clearFilters = () => {
        setSelectedMedios(new Set());
        setSelectedTipos(new Set());
        setSearch('');
        setStartDate(firstDayOfMonth());
        setEndDate(todayBogota());
    };

    const hasActiveFilter = selectedMedios.size || selectedTipos.size || search;

    const itemsFiltrados = useMemo(() => {
        const q = search.trim().toLowerCase();
        if (!q) return items;
        return items.filter(it =>
            (it.descripcion || '').toLowerCase().includes(q) ||
            (it.contraparte || '').toLowerCase().includes(q) ||
            (it.medio_pago?.nombre || '').toLowerCase().includes(q)
        );
    }, [items, search]);

    const totalesFiltrados = useMemo(() => {
        let ing = 0, egr = 0;
        for (const it of itemsFiltrados) {
            if (it.sentido === 'ingreso') ing += it.monto;
            else egr += it.monto;
        }
        return { ingresos: ing, egresos: egr, neto: ing - egr };
    }, [itemsFiltrados]);

    return (
        <div style={{ maxWidth: 1200, margin: '0 auto' }}>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18, flexWrap: 'wrap', gap: 12 }}>
                <div>
                    <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)' }}>Módulo · Caja</div>
                    <h1 style={{ margin: 0, fontSize: 22, fontWeight: 900, display: 'flex', alignItems: 'center', gap: 8 }}>
                        <Wallet size={20} color="#ffdd19" /> Movimientos por Medio de Pago
                    </h1>
                </div>
                <button onClick={() => load(true)} disabled={refreshing}
                    className="btn btn-secondary"
                    style={{ padding: '6px 12px', fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <RefreshCw size={14} style={{ animation: refreshing ? 'spin 1s linear infinite' : 'none' }} /> Refrescar
                </button>
            </div>

            {/* KPIs */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 10, marginBottom: 14 }}>
                <div className="card p-3 mb-0" style={{ borderTop: '3px solid #10b981' }}>
                    <div className="flex items-center gap-1 text-muted text-xs mb-1">
                        <TrendingUp size={13} color="#10b981" /> Ingresos
                    </div>
                    <div className="text-xl font-bold" style={{ color: '#10b981' }}>{formatCurrency(totalesFiltrados.ingresos)}</div>
                </div>
                <div className="card p-3 mb-0" style={{ borderTop: '3px solid #ef4444' }}>
                    <div className="flex items-center gap-1 text-muted text-xs mb-1">
                        <TrendingDown size={13} color="#ef4444" /> Egresos
                    </div>
                    <div className="text-xl font-bold" style={{ color: '#ef4444' }}>{formatCurrency(totalesFiltrados.egresos)}</div>
                </div>
                <div className="card p-3 mb-0" style={{ borderTop: `3px solid ${totalesFiltrados.neto >= 0 ? '#10b981' : '#ef4444'}` }}>
                    <div className="flex items-center gap-1 text-muted text-xs mb-1">
                        <Wallet size={13} /> Saldo neto del período
                    </div>
                    <div className="text-xl font-bold" style={{ color: totalesFiltrados.neto >= 0 ? '#10b981' : '#ef4444' }}>{formatCurrency(totalesFiltrados.neto)}</div>
                </div>
                <div className="card p-3 mb-0" style={{ borderTop: '3px solid #8b5cf6' }}>
                    <div className="flex items-center gap-1 text-muted text-xs mb-1">
                        <ArrowRightLeft size={13} color="#8b5cf6" /> Movimientos
                    </div>
                    <div className="text-xl font-bold">{itemsFiltrados.length}</div>
                </div>
            </div>

            {/* Filtros */}
            <div className="card" style={{ padding: '12px 14px', marginBottom: 12 }}>
                {/* Rango de fechas + búsqueda */}
                <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', marginBottom: 12 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <label style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600 }}>Desde</label>
                        <input type="date" className="form-control" value={startDate} onChange={e => setStartDate(e.target.value)}
                            style={{ width: 150, padding: '5px 8px', fontSize: 13 }} />
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <label style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600 }}>Hasta</label>
                        <input type="date" className="form-control" value={endDate} onChange={e => setEndDate(e.target.value)}
                            style={{ width: 150, padding: '5px 8px', fontSize: 13 }} />
                    </div>
                    <div style={{ flex: 1, minWidth: 200, display: 'flex', alignItems: 'center', gap: 6, background: 'var(--bg-secondary)', borderRadius: 8, padding: '5px 10px', border: '1px solid var(--border)' }}>
                        <Search size={14} color="var(--text-muted)" />
                        <input type="text" placeholder="Buscar descripción, contraparte, medio..."
                            value={search} onChange={e => setSearch(e.target.value)}
                            style={{ border: 'none', background: 'transparent', outline: 'none', flex: 1, color: 'var(--text)', fontSize: 13 }} />
                    </div>
                    {hasActiveFilter && (
                        <button onClick={clearFilters}
                            style={{ padding: '5px 12px', borderRadius: 8, border: '1px solid rgba(239,68,68,0.35)',
                                background: 'rgba(239,68,68,0.08)', color: '#f87171', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
                            <X size={12} style={{ marginRight: 4 }} /> Limpiar
                        </button>
                    )}
                </div>

                {/* Chips de tipos */}
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', alignSelf: 'center', marginRight: 4 }}>Tipo:</span>
                    {Object.entries(TIPO_CFG).map(([key, cfg]) => {
                        const active = selectedTipos.has(key);
                        const Icon = cfg.icon;
                        return (
                            <button key={key} onClick={() => toggleTipo(key)}
                                style={{
                                    display: 'flex', alignItems: 'center', gap: 5,
                                    padding: '4px 10px', borderRadius: 999, fontSize: 12, fontWeight: 700, cursor: 'pointer',
                                    border: `1px solid ${active ? cfg.color : 'var(--border)'}`,
                                    background: active ? `${cfg.color}22` : 'transparent',
                                    color: active ? cfg.color : 'var(--text-muted)',
                                }}>
                                <Icon size={12} /> {cfg.label}
                            </button>
                        );
                    })}
                </div>

                {/* Chips de medios de pago */}
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', alignSelf: 'center', marginRight: 4 }}>Medio:</span>
                    {methods.map(m => {
                        const active = selectedMedios.has(m.id);
                        return (
                            <button key={m.id} onClick={() => toggleMedio(m.id)}
                                style={{
                                    padding: '4px 10px', borderRadius: 999, fontSize: 12, fontWeight: 700, cursor: 'pointer',
                                    border: `1px solid ${active ? '#ffdd19' : 'var(--border)'}`,
                                    background: active ? 'rgba(255,221,25,0.15)' : 'transparent',
                                    color: active ? '#ffdd19' : 'var(--text-muted)',
                                }}>
                                {m.nombre}
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* Tabla */}
            <div className="card overflow-x-auto">
                <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 720 }}>
                    <thead>
                        <tr style={{ borderBottom: '1px solid var(--border)', textAlign: 'left' }}>
                            <th className="p-3">Fecha</th>
                            <th className="p-3">Tipo</th>
                            <th className="p-3">Medio</th>
                            <th className="p-3">Descripción</th>
                            <th className="p-3">Contraparte</th>
                            <th className="p-3 text-right">Ingreso</th>
                            <th className="p-3 text-right">Egreso</th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            <tr><td colSpan="7" className="p-4 text-center">Cargando…</td></tr>
                        ) : itemsFiltrados.length === 0 ? (
                            <tr><td colSpan="7" className="p-4 text-center text-muted">No hay movimientos en los filtros aplicados.</td></tr>
                        ) : itemsFiltrados.map(it => {
                            const cfg = TIPO_CFG[it.tipo] || { label: it.tipo, icon: Wallet, color: 'var(--text)' };
                            const Icon = cfg.icon;
                            return (
                                <tr key={it.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                                    <td className="p-3 text-sm text-muted" style={{ whiteSpace: 'nowrap' }}>{formatDate(it.fecha)}</td>
                                    <td className="p-3">
                                        <span style={{
                                            display: 'inline-flex', alignItems: 'center', gap: 4,
                                            padding: '2px 8px', borderRadius: 999, fontSize: 11, fontWeight: 700,
                                            background: `${cfg.color}22`, color: cfg.color,
                                            border: `1px solid ${cfg.color}55`,
                                        }}>
                                            <Icon size={10} /> {cfg.label}
                                        </span>
                                    </td>
                                    <td className="p-3 text-sm" style={{ fontWeight: 600 }}>{it.medio_pago?.nombre}</td>
                                    <td className="p-3 text-sm">{it.descripcion}</td>
                                    <td className="p-3 text-sm text-muted">{it.contraparte || '—'}</td>
                                    <td className="p-3 text-right" style={{ color: '#10b981', fontWeight: 700 }}>
                                        {it.sentido === 'ingreso' ? formatCurrency(it.monto) : ''}
                                    </td>
                                    <td className="p-3 text-right" style={{ color: '#ef4444', fontWeight: 700 }}>
                                        {it.sentido === 'egreso' ? formatCurrency(it.monto) : ''}
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                    {itemsFiltrados.length > 0 && (
                        <tfoot>
                            <tr style={{ borderTop: '2px solid var(--border)', fontWeight: 800 }}>
                                <td colSpan="5" className="p-3 text-right text-muted">TOTALES</td>
                                <td className="p-3 text-right" style={{ color: '#10b981' }}>{formatCurrency(totalesFiltrados.ingresos)}</td>
                                <td className="p-3 text-right" style={{ color: '#ef4444' }}>{formatCurrency(totalesFiltrados.egresos)}</td>
                            </tr>
                        </tfoot>
                    )}
                </table>
            </div>
        </div>
    );
}

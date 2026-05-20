import { useState, useEffect } from 'react';
import { insumosService, suppliersService, ordersService, parametrosService } from '../services/api';
import { Package, Plus, RefreshCw, SlidersHorizontal, History, X, Save, Edit, Trash2, RotateCcw } from 'lucide-react';
import { toast } from 'sonner';
import { formatDateTime } from '../utils/formatters';

const fmtQty = (n, unidad) => `${Number(n).toFixed(2)} ${unidad || ''}`;
const fmtDate = (d) => d ? formatDateTime(d) : '—';
const fmtCurrency = (v) => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(v || 0);

const TIPO_BADGE = {
    entrada: { label: 'Entrada', color: '#22c55e' },
    salida:  { label: 'Salida',  color: '#ef4444' },
    ajuste:  { label: 'Ajuste',  color: '#ffdd19' },
};

// UNIDADES default. Se sobrescribe en runtime con lo que devuelva /api/parametros/unidades.
const UNIDADES_DEFAULT = ['kg', 'gramo', 'tonelada', 'litro', 'ml', 'cm3', 'unidad'];

const EMPTY_INSUMO = { nombre: '', unidad_medida: 'kg', costo_unitario: '', activo: true, proveedor_id: '', unidades_por_paquete: '', costo_paquete: '', cantidad_inicial: '' };

export default function Inventory() {
    const [unidadesDb, setUnidadesDb] = useState(null);
    const UNIDADES = unidadesDb || UNIDADES_DEFAULT;
    useEffect(() => {
        parametrosService.getUnidades(true)
            .then(r => setUnidadesDb(r.data.map(u => u.codigo)))
            .catch(() => {});
    }, []);
    const [insumos, setInsumos]       = useState([]);
    const [movs, setMovs]             = useState([]);
    const [proveedores, setProveedores] = useState([]);
    const [loading, setLoading]       = useState(true);
    const [tab, setTab]               = useState('stock');
    const [selectedId, setSelectedId] = useState(null);

    // Modal insumo (crear/editar)
    const [insumoModal, setInsumoModal] = useState(null); // null | 'new' | 'edit'
    const [insumoForm, setInsumoForm]   = useState(EMPTY_INSUMO);

    // Modal ajuste
    const [ajusteModal, setAjusteModal] = useState(null); // null | { insumo }
    const [ajusteForm, setAjusteForm]   = useState({ cantidad: '', notas: '' });
    const [saving, setSaving]           = useState(false);

    useEffect(() => { loadAll(); loadProveedores(); }, []);

    const loadAll = async () => {
        setLoading(true);
        try {
            const res = await insumosService.getAll();
            setInsumos(res.data);
        } catch { toast.error('Error cargando insumos'); }
        finally { setLoading(false); }
    };

    const loadProveedores = async () => {
        try {
            const res = await suppliersService.getAll();
            setProveedores(res.data);
        } catch { /* silencioso */ }
    };

    const loadMovimientos = async (insumoId) => {
        try {
            const res = await insumosService.getMovimientos(insumoId);
            setMovs(res.data);
            setSelectedId(insumoId);
            setTab('movimientos');
        } catch { toast.error('Error cargando movimientos'); }
    };

    // ── CRUD insumos ────────────────────────────────────────
    const openNew = () => { setInsumoForm(EMPTY_INSUMO); setInsumoModal('new'); };
    const openEdit = (ins) => {
        const udsPaq = ins.unidades_por_paquete ?? '';
        const costoU = ins.costo_unitario ?? '';
        const costoPaq = ins.costo_paquete != null
            ? String(Math.round(parseFloat(ins.costo_paquete)))
            : (udsPaq && costoU ? String(Math.round(parseFloat(costoU) * parseFloat(udsPaq))) : '');
        setInsumoForm({ nombre: ins.nombre, unidad_medida: ins.unidad_medida, costo_unitario: costoU, activo: ins.activo, proveedor_id: ins.proveedor_id ?? '', unidades_por_paquete: udsPaq, costo_paquete: costoPaq });
        setInsumoModal(ins.id);
    };

    const saveInsumo = async (e) => {
        e.preventDefault();
        if (!insumoForm.nombre.trim()) return toast.error('Nombre requerido');
        setSaving(true);
        try {
            const { cantidad_inicial, costo_paquete: _cp, ...rest } = insumoForm;
            const data = { ...rest, costo_unitario: parseFloat(rest.costo_unitario) || 0, unidades_por_paquete: rest.unidades_por_paquete !== '' ? parseFloat(rest.unidades_por_paquete) : null };
            if (insumoModal === 'new') {
                const created = await insumosService.create(data);
                const qty = parseFloat(cantidad_inicial);
                if (qty > 0) {
                    await insumosService.ajustar(created.data.id, { cantidad: qty, notas: 'Stock inicial' });
                }
                toast.success('Insumo creado');
            } else {
                await insumosService.update(insumoModal, data);
                toast.success('Insumo actualizado');
            }
            setInsumoModal(null);
            loadAll();
        } catch (err) {
            toast.error(err.response?.data?.detail || 'Error al guardar');
        } finally { setSaving(false); }
    };

    const deleteInsumo = async (id) => {
        if (!confirm('¿Eliminar este insumo? Se borrarán sus movimientos.')) return;
        try {
            await insumosService.delete(id);
            toast.success('Insumo eliminado');
            loadAll();
        } catch (err) { toast.error(err.response?.data?.detail || 'No se puede eliminar el insumo'); }
    };

    // ── Ajuste manual ────────────────────────────────────────
    const openAjuste = (ins) => { setAjusteModal(ins); setAjusteForm({ cantidad: '', notas: '' }); };

    const saveAjuste = async (e) => {
        e.preventDefault();
        const qty = parseFloat(ajusteForm.cantidad);
        if (isNaN(qty) || qty === 0) return toast.error('Ingresa una cantidad distinta de 0');
        setSaving(true);
        try {
            await insumosService.ajustar(ajusteModal.id, { cantidad: qty, notas: ajusteForm.notas });
            toast.success('Stock ajustado');
            setAjusteModal(null);
            loadAll();
        } catch (err) {
            toast.error(err.response?.data?.detail || 'Error al ajustar');
        } finally { setSaving(false); }
    };

    // KPIs
    const totalInsumos = insumos.length;
    const conStock = insumos.filter(i => Number(i.cantidad_actual) > 0).length;
    const sinStock = insumos.filter(i => Number(i.cantidad_actual) <= 0).length;
    const selectedInsumo = insumos.find(i => i.id === selectedId);

    return (
        <div>
            {/* Header */}
            <div className="page-header flex justify-between items-center mb-6">
                <div>
                    <h1 className="m-0">Inventario de Insumos</h1>
                    <p className="text-muted" style={{ fontSize: '0.85rem', marginTop: 2 }}>Control de stock por unidad de medida</p>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                    <button className="btn btn-secondary" onClick={loadAll} style={{ width: 'auto', padding: '0.5rem 0.8rem' }} title="Actualizar">
                        <RefreshCw size={15} />
                    </button>
                    <button className="btn btn-secondary" onClick={async () => {
                        try {
                            const r = await ordersService.recalcularInsumos();
                            toast.success(`Sincronizado: ${r.data.pedidos_procesados} pedido(s) procesados`);
                            loadAll();
                        } catch {
                            toast.error('Error al sincronizar insumos');
                        }
                    }} style={{ width: 'auto', padding: '0.5rem 0.9rem', display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }} title="Sincronizar consumo de insumos desde pedidos existentes">
                        <RotateCcw size={15} /> Sincronizar pedidos
                    </button>
                    <button className="btn btn-primary" onClick={openNew} style={{ width: 'auto', padding: '0.5rem 1rem', display: 'flex', alignItems: 'center', gap: 6 }}>
                        <Plus size={16} /> Nuevo Insumo
                    </button>
                </div>
            </div>

            {/* KPIs */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
                {[
                    { label: 'Total Insumos', value: totalInsumos, color: 'var(--brand)' },
                    { label: 'Con Stock',     value: conStock,     color: '#22c55e' },
                    { label: 'Sin Stock',     value: sinStock,     color: '#ef4444' },
                ].map(({ label, value, color }) => (
                    <div key={label} className="card mb-0">
                        <div className="text-muted" style={{ fontSize: '0.78rem', marginBottom: 4 }}>{label}</div>
                        <div style={{ fontSize: '1.6rem', fontWeight: 700, color }}>{value}</div>
                    </div>
                ))}
            </div>

            {/* Tabs */}
            <div style={{ display: 'flex', gap: 4, marginBottom: 16 }}>
                <button onClick={() => setTab('stock')} className={`btn ${tab === 'stock' ? 'btn-primary' : 'btn-secondary'}`} style={{ width: 'auto', padding: '0.4rem 0.9rem', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Package size={14} /> Stock Actual
                </button>
                <button onClick={() => tab !== 'movimientos' && selectedId && setTab('movimientos')} className={`btn ${tab === 'movimientos' ? 'btn-primary' : 'btn-secondary'}`} style={{ width: 'auto', padding: '0.4rem 0.9rem', display: 'flex', alignItems: 'center', gap: 6, opacity: selectedId ? 1 : 0.5 }}>
                    <History size={14} /> Movimientos {selectedInsumo ? `— ${selectedInsumo.nombre}` : ''}
                </button>
            </div>

            {loading ? <p className="text-muted">Cargando…</p> : tab === 'stock' ? (

                /* ── Tabla Stock ── */
                <div className="card overflow-x-auto">
                    <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 600 }}>
                        <thead>
                            <tr style={{ borderBottom: '1px solid var(--border)', textAlign: 'left' }}>
                                <th className="p-3">Insumo</th>
                                <th className="p-3">Unidad</th>
                                <th className="p-3 text-right">Stock Actual</th>
                                <th className="p-3 text-right">Costo Paquete</th>
                                <th className="p-3 text-right">Costo / Unidad</th>
                                <th className="p-3 text-center">Estado</th>
                                <th className="p-3 text-center">Acciones</th>
                            </tr>
                        </thead>
                        <tbody>
                            {insumos.length === 0 && (
                                <tr><td colSpan={6} className="p-4 text-center text-muted">No hay insumos. Crea el primero.</td></tr>
                            )}
                            {insumos.map(ins => {
                                // cantidad_actual está en unidades base. Si tiene unidades_por_paquete, mostramos también equivalente en paquetes.
                                const stock = Number(ins.cantidad_actual);
                                const udsPorPaq = Number(ins.unidades_por_paquete) || 0;
                                const paquetes = udsPorPaq > 0 ? (stock / udsPorPaq) : null;
                                const color = stock <= 0 ? '#ef4444' : stock < 5 ? '#ffdd19' : '#22c55e';
                                const estado = stock <= 0 ? 'Agotado' : stock < 5 ? 'Bajo' : 'OK';
                                const costoPaqueteShow = ins.costo_paquete != null
                                    ? Number(ins.costo_paquete)
                                    : (udsPorPaq > 0 ? ins.costo_unitario * udsPorPaq : ins.costo_unitario);
                                return (
                                    <tr key={ins.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', opacity: ins.activo ? 1 : 0.5 }}>
                                        <td className="p-3 font-bold">{ins.nombre}</td>
                                        <td className="p-3 text-muted" style={{ fontSize: '0.85rem', textTransform: 'uppercase' }}>{ins.unidad_medida}</td>
                                        <td className="p-3 text-right font-bold" style={{ color }}>
                                            {fmtQty(stock, ins.unidad_medida)}
                                            {paquetes !== null && <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 400 }}>{paquetes.toFixed(1)} paquetes</div>}
                                        </td>
                                        <td className="p-3 text-right text-muted" style={{ fontSize: '0.85rem' }}>
                                            {fmtCurrency(costoPaqueteShow)}
                                            {udsPorPaq > 0 && (
                                                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                                                    {udsPorPaq} {ins.unidad_medida === 'unidad' ? 'uds' : ins.unidad_medida}
                                                </div>
                                            )}
                                        </td>
                                        <td className="p-3 text-right" style={{ fontSize: '0.85rem', fontWeight: 600 }}>
                                            {fmtCurrency(ins.costo_unitario)}
                                            <span style={{ fontSize: '0.7rem', marginLeft: 2, color: 'var(--text-muted)' }}>
                                                /{ins.unidad_medida === 'unidad' ? 'ud' : ins.unidad_medida}
                                            </span>
                                        </td>
                                        <td className="p-3 text-center">
                                            <span style={{ fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', padding: '0.2rem 0.6rem', borderRadius: 999, border: `1px solid ${color}`, color }}>{estado}</span>
                                        </td>
                                        <td className="p-3">
                                            <div style={{ display: 'flex', gap: 4, justifyContent: 'center' }}>
                                                <button onClick={() => loadMovimientos(ins.id)} className="btn btn-secondary" style={{ padding: '0.3rem 0.5rem' }} title="Ver movimientos"><History size={13} /></button>
                                                <button onClick={() => openAjuste(ins)} className="btn btn-secondary" style={{ padding: '0.3rem 0.5rem' }} title="Ajustar stock"><SlidersHorizontal size={13} /></button>
                                                <button onClick={() => openEdit(ins)} className="btn btn-secondary" style={{ padding: '0.3rem 0.5rem' }} title="Editar"><Edit size={13} /></button>
                                                <button onClick={() => deleteInsumo(ins.id)} className="btn btn-secondary text-danger" style={{ padding: '0.3rem 0.5rem' }} title="Eliminar"><Trash2 size={13} /></button>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>

            ) : (

                /* ── Tabla Movimientos ── */
                <div className="card overflow-x-auto">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                        <h3 className="m-0" style={{ fontSize: '1rem' }}>Movimientos — {selectedInsumo?.nombre}</h3>
                        <button onClick={() => setTab('stock')} className="btn btn-secondary" style={{ width: 'auto', padding: '0.3rem 0.7rem', fontSize: '0.8rem' }}><X size={13} /> Cerrar</button>
                    </div>
                    <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 500 }}>
                        <thead>
                            <tr style={{ borderBottom: '1px solid var(--border)', textAlign: 'left' }}>
                                <th className="p-3">Fecha</th>
                                <th className="p-3 text-center">Tipo</th>
                                <th className="p-3 text-right">Cantidad</th>
                                <th className="p-3 text-right">Costo Total</th>
                                <th className="p-3">Origen</th>
                                <th className="p-3">Notas</th>
                            </tr>
                        </thead>
                        <tbody>
                            {movs.length === 0 && (
                                <tr><td colSpan={6} className="p-4 text-center text-muted">Sin movimientos registrados.</td></tr>
                            )}
                            {movs.map(m => {
                                const badge = TIPO_BADGE[m.tipo] || { label: m.tipo, color: '#6b7280' };
                                return (
                                    <tr key={m.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                                        <td className="p-3 text-muted" style={{ fontSize: '0.82rem' }}>{fmtDate(m.fecha)}</td>
                                        <td className="p-3 text-center">
                                            <span style={{ fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', padding: '0.2rem 0.6rem', borderRadius: 999, border: `1px solid ${badge.color}`, color: badge.color }}>{badge.label}</span>
                                        </td>
                                        <td className="p-3 text-right font-bold">{Number(m.cantidad).toFixed(2)} {selectedInsumo?.unidad_medida}</td>
                                        <td className="p-3 text-right text-muted" style={{ fontSize: '0.85rem' }}>{m.costo_total ? fmtCurrency(m.costo_total) : '—'}</td>
                                        <td className="p-3 text-muted" style={{ fontSize: '0.82rem', textTransform: 'capitalize' }}>{m.origen || '—'}</td>
                                        <td className="p-3 text-muted" style={{ fontSize: '0.82rem' }}>{m.notas || '—'}</td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            )}

            {/* ── Modal Crear / Editar Insumo ── */}
            {insumoModal !== null && (
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', zIndex: 100, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', overflowY: 'auto', padding: 16 }}>
                    <div className="card" style={{ width: '100%', maxWidth: 420, margin: 'auto', position: 'relative', maxHeight: 'calc(100vh - 32px)', overflowY: 'auto' }}>
                        <button onClick={() => setInsumoModal(null)} className="btn-close-modal"><X size={18} /></button>
                        <h2 className="m-0 mb-4">{insumoModal === 'new' ? 'Nuevo Insumo' : 'Editar Insumo'}</h2>
                        <form onSubmit={saveInsumo} className="flex flex-col gap-3">
                            <div className="form-group">
                                <label>Nombre *</label>
                                <input className="form-control" value={insumoForm.nombre}
                                    onChange={e => setInsumoForm({ ...insumoForm, nombre: e.target.value })}
                                    placeholder="Ej: Maíz, Mantequilla" required />
                            </div>
                            <div className="form-group">
                                <label>Unidad de Medida *</label>
                                <select className="form-control" value={insumoForm.unidad_medida}
                                    onChange={e => setInsumoForm({ ...insumoForm, unidad_medida: e.target.value })}>
                                    {UNIDADES.map(u => <option key={u} value={u}>{u}</option>)}
                                </select>
                            </div>
                            <div className="form-group">
                                <label>Costo total del paquete ($)</label>
                                <input type="number" className="form-control" value={insumoForm.costo_paquete}
                                    onChange={e => {
                                        const cp = e.target.value;
                                        const cu = cp && insumoForm.unidades_por_paquete > 0
                                            ? (parseFloat(cp) / parseFloat(insumoForm.unidades_por_paquete)).toFixed(4)
                                            : '';
                                        setInsumoForm({ ...insumoForm, costo_paquete: cp, costo_unitario: cu });
                                    }}
                                    placeholder="Ej: 45000" min="0" step="1" />
                                <small style={{ color: 'var(--text-muted)', fontSize: '0.75rem', marginTop: 4, display: 'block' }}>
                                    Lo que pagas por UN paquete/presentación completo.
                                </small>
                            </div>
                            <div className="form-group">
                                <label>Contenido del paquete ({insumoForm.unidad_medida || 'unidad'} por paquete)</label>
                                <input type="number" className="form-control" value={insumoForm.unidades_por_paquete}
                                    onChange={e => {
                                        const pk = e.target.value;
                                        const cu = pk > 0 && insumoForm.costo_paquete
                                            ? (parseFloat(insumoForm.costo_paquete) / parseFloat(pk)).toFixed(4)
                                            : '';
                                        setInsumoForm({ ...insumoForm, unidades_por_paquete: pk, costo_unitario: cu });
                                    }}
                                    placeholder={`Ej: 50 ${insumoForm.unidad_medida || 'unidad'} por bulto`}
                                    min="0.001" step="0.001" />
                                <small style={{ color: 'var(--text-muted)', fontSize: '0.75rem', marginTop: 4, display: 'block' }}>
                                    Cuántas {insumoForm.unidad_medida || 'unidades'} hay dentro de un paquete. Deja vacío si se compra suelto.
                                </small>
                            </div>
                            <div className="form-group">
                                <label>Costo por {insumoForm.unidad_medida || 'unidad'} ($) — calculado</label>
                                <input type="number" className="form-control" value={insumoForm.costo_unitario}
                                    readOnly
                                    style={{ background: 'var(--bg-elevated)', color: 'var(--brand)', fontWeight: 700, cursor: 'default' }}
                                    placeholder="Se calcula automáticamente" />
                                {insumoForm.costo_unitario > 0 && (
                                    <small style={{ color: 'var(--text-muted)', fontSize: '0.78rem', marginTop: 4, display: 'block' }}>
                                        {fmtCurrency(parseFloat(insumoForm.costo_unitario))} por {insumoForm.unidad_medida}
                                    </small>
                                )}
                            </div>
                            {insumoModal === 'new' && (
                                <div className="form-group">
                                    <label>Cantidad inicial ({insumoForm.unidad_medida || 'unidad'})</label>
                                    <input type="number" className="form-control" value={insumoForm.cantidad_inicial}
                                        onChange={e => setInsumoForm({ ...insumoForm, cantidad_inicial: e.target.value })}
                                        placeholder="Ej: 100 (dejar vacío si no hay stock)"
                                        min="0" step="0.001" />
                                </div>
                            )}
                            <div className="form-group">
                                <label>Proveedor</label>
                                <select className="form-control" value={insumoForm.proveedor_id ?? ''}
                                    onChange={e => setInsumoForm({ ...insumoForm, proveedor_id: e.target.value ? parseInt(e.target.value) : null })}>
                                    <option value="">— Sin proveedor —</option>
                                    {proveedores.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
                                </select>
                            </div>
                            <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: '0.88rem' }}>
                                <input type="checkbox" checked={insumoForm.activo}
                                    onChange={e => setInsumoForm({ ...insumoForm, activo: e.target.checked })}
                                    style={{ width: 15, height: 15, accentColor: 'var(--brand)' }} />
                                Activo
                            </label>
                            <div className="flex gap-2 justify-end mt-2">
                                <button type="button" className="btn btn-secondary" onClick={() => setInsumoModal(null)}>Cancelar</button>
                                <button type="submit" className="btn btn-primary" disabled={saving} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                    <Save size={14} /> {saving ? 'Guardando…' : 'Guardar'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* ── Modal Ajuste ── */}
            {ajusteModal && (
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', zIndex: 100, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', overflowY: 'auto', padding: 16 }}>
                    <div className="card" style={{ width: '100%', maxWidth: 380, margin: 'auto', position: 'relative', maxHeight: 'calc(100vh - 32px)', overflowY: 'auto' }}>
                        <button onClick={() => setAjusteModal(null)} className="btn-close-modal"><X size={18} /></button>
                        <h2 className="m-0 mb-1">Ajustar Stock</h2>
                        <p className="text-muted mb-4" style={{ fontSize: '0.85rem' }}>
                            <strong style={{ color: 'white' }}>{ajusteModal.nombre}</strong> — stock actual: <strong style={{ color: 'white' }}>{fmtQty(ajusteModal.cantidad_actual, ajusteModal.unidad_medida)}</strong>
                        </p>
                        <form onSubmit={saveAjuste} className="flex flex-col gap-3">
                            <div className="form-group">
                                <label>Cantidad ({ajusteModal.unidad_medida})</label>
                                <input type="number" className="form-control" value={ajusteForm.cantidad}
                                    onChange={e => setAjusteForm({ ...ajusteForm, cantidad: e.target.value })}
                                    placeholder="Positivo = entrada, negativo = salida" step="0.01" required />
                                <small className="text-muted" style={{ fontSize: '0.75rem' }}>Usa número positivo para agregar, negativo para descontar</small>
                            </div>
                            <div className="form-group">
                                <label>Notas</label>
                                <input className="form-control" value={ajusteForm.notas}
                                    onChange={e => setAjusteForm({ ...ajusteForm, notas: e.target.value })}
                                    placeholder="Conteo físico, merma, devolución…" />
                            </div>
                            <div className="flex gap-2 justify-end mt-2">
                                <button type="button" className="btn btn-secondary" onClick={() => setAjusteModal(null)}>Cancelar</button>
                                <button type="submit" className="btn btn-primary" disabled={saving} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                    <Save size={14} /> {saving ? 'Guardando…' : 'Ajustar'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}

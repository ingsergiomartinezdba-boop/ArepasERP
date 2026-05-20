import { useState, useEffect, useCallback } from 'react';
import { suppliersService, insumosService } from '../services/api';
import { Plus, Edit, Trash2, Phone, Mail, MapPin, Save, X, Package, ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';
import { formatDate } from '../utils/formatters';

const fmtMoney = (v) => v == null
    ? '—'
    : new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(v);

export default function Suppliers() {
    const [suppliers, setSuppliers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [editingId, setEditingId] = useState(null); // null | 'new' | id
    const [detailId, setDetailId] = useState(null);   // id del proveedor en vista detalle
    const [form, setForm] = useState({
        nombre: '', contacto: '', telefono: '', email: '', direccion: ''
    });

    useEffect(() => { loadSuppliers(); }, []);

    const loadSuppliers = async () => {
        setLoading(true);
        try {
            const res = await suppliersService.getAll();
            setSuppliers(res.data);
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            if (editingId && editingId !== 'new') {
                await suppliersService.update(editingId, form);
                toast.success('Proveedor actualizado');
            } else {
                await suppliersService.create(form);
                toast.success('Proveedor creado');
            }
            setForm({ nombre: '', contacto: '', telefono: '', email: '', direccion: '' });
            setEditingId(null);
            loadSuppliers();
        } catch (error) {
            toast.error('Error al guardar proveedor');
            console.error(error);
        }
    };

    const handleEdit = (supplier) => {
        setForm({
            nombre: supplier.nombre,
            contacto: supplier.contacto || '',
            telefono: supplier.telefono || '',
            email: supplier.email || '',
            direccion: supplier.direccion || ''
        });
        setEditingId(supplier.id);
    };

    const handleNew = () => {
        setForm({ nombre: '', contacto: '', telefono: '', email: '', direccion: '' });
        setEditingId('new');
    };

    const handleDelete = async (id) => {
        if (!confirm('¿Seguro que desea eliminar este proveedor? Si tiene gastos asociados no se podrá eliminar.')) return;
        try {
            await suppliersService.delete(id);
            loadSuppliers();
        } catch (error) {
            const msg = error.response?.data?.detail || 'No se puede eliminar: Probablemente tenga gastos asociados.';
            toast.error(msg);
        }
    };

    // ── Vista detalle (insumos que vende) ─────────────────────────────────
    if (detailId) {
        const supplier = suppliers.find(s => s.id === detailId);
        return <SupplierDetail supplier={supplier} onBack={() => setDetailId(null)} />;
    }

    // ── Vista edición / creación ──────────────────────────────────────────
    if (editingId) {
        return (
            <div style={{ position: 'relative' }}>
                <button onClick={() => setEditingId(null)} className="btn-close-modal" style={{ top: 0, right: 0 }}>
                    <X size={18} />
                </button>
                <div className="mb-6">
                    <h1 className="m-0">{editingId !== 'new' ? 'Editar Proveedor' : 'Nuevo Proveedor'}</h1>
                </div>
                <div className="card">
                    <form onSubmit={handleSubmit}>
                        <div className="form-group">
                            <label>Nombre Empresa *</label>
                            <input className="form-control" value={form.nombre}
                                onChange={e => setForm({ ...form, nombre: e.target.value })}
                                required placeholder="Ej: Distribuidora de Harinas S.A.S." />
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="form-group">
                                <label>Persona de Contacto</label>
                                <input className="form-control" value={form.contacto}
                                    onChange={e => setForm({ ...form, contacto: e.target.value })}
                                    placeholder="Ej: Carlos Gómez" />
                            </div>
                            <div className="form-group">
                                <label>Teléfono</label>
                                <input type="tel" className="form-control" value={form.telefono}
                                    onChange={e => setForm({ ...form, telefono: e.target.value })}
                                    placeholder="Ej: 3001234567" />
                            </div>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="form-group">
                                <label>Email</label>
                                <input type="email" className="form-control" value={form.email}
                                    onChange={e => setForm({ ...form, email: e.target.value })}
                                    placeholder="contacto@empresa.com" />
                            </div>
                            <div className="form-group">
                                <label>Dirección</label>
                                <input className="form-control" value={form.direccion}
                                    onChange={e => setForm({ ...form, direccion: e.target.value })}
                                    placeholder="Ej: Calle 10 #20-30" />
                            </div>
                        </div>
                        <div className="mt-8">
                            <button type="submit" className="btn btn-primary font-bold" style={{ width: 'auto', padding: '0.8rem 2rem' }}>
                                <Save size={20} style={{ marginRight: 8 }} />
                                {editingId !== 'new' ? 'Guardar Cambios' : 'Crear Proveedor'}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        );
    }

    return (
        <div>
            <div className="page-header flex justify-between items-center mb-6">
                <h1 className="m-0">Proveedores</h1>
                <button onClick={handleNew} className="btn btn-primary"
                    style={{ width: 'auto', padding: '0.6rem 1.2rem', display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Plus size={20} /> Nuevo Proveedor
                </button>
            </div>

            <div className="card overflow-x-auto">
                <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '900px' }}>
                    <thead>
                        <tr style={{ borderBottom: '1px solid var(--border)', textAlign: 'left' }}>
                            <th className="p-3">ID</th>
                            <th className="p-3">Empresa</th>
                            <th className="p-3">Contacto</th>
                            <th className="p-3">Detalles</th>
                            <th className="p-3 text-center">Acciones</th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            <tr><td colSpan="5" className="p-4 text-center">Cargando...</td></tr>
                        ) : suppliers.length === 0 ? (
                            <tr><td colSpan="5" className="p-4 text-center text-muted">No hay proveedores registrados.</td></tr>
                        ) : (
                            suppliers.map(supplier => (
                                <tr key={supplier.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                                    <td className="p-3 text-muted">#{supplier.id}</td>
                                    <td className="p-3">
                                        <div className="font-bold">{supplier.nombre}</div>
                                        {supplier.direccion && (
                                            <div className="text-xs text-muted flex items-center gap-1 mt-1">
                                                <MapPin size={10} /> {supplier.direccion}
                                            </div>
                                        )}
                                    </td>
                                    <td className="p-3">
                                        {supplier.contacto && <div className="text-sm font-semibold">{supplier.contacto}</div>}
                                        {supplier.telefono && (
                                            <div className="text-xs text-muted flex items-center gap-1">
                                                <Phone size={10} /> {supplier.telefono}
                                            </div>
                                        )}
                                    </td>
                                    <td className="p-3">
                                        {supplier.email ? (
                                            <div className="flex items-center gap-1 text-sm text-primary">
                                                <Mail size={12} /> {supplier.email}
                                            </div>
                                        ) : <span className="text-muted text-xs">-</span>}
                                    </td>
                                    <td className="p-3 text-center">
                                        <div className="flex justify-center gap-2">
                                            <button onClick={() => setDetailId(supplier.id)}
                                                className="btn btn-secondary" style={{ padding: '0.4rem' }}
                                                title="Insumos que vende">
                                                <Package size={16} />
                                            </button>
                                            <button onClick={() => handleEdit(supplier)}
                                                className="btn btn-secondary" style={{ padding: '0.4rem' }} title="Editar">
                                                <Edit size={16} />
                                            </button>
                                            <button onClick={() => handleDelete(supplier.id)}
                                                className="btn btn-secondary text-danger"
                                                style={{ padding: '0.4rem' }} title="Eliminar">
                                                <Trash2 size={16} />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}


// ════════════════════════════════════════════════════════════════════════════
// SupplierDetail — pestaña "Insumos que vende" con preview de impacto en costo
// ════════════════════════════════════════════════════════════════════════════
function SupplierDetail({ supplier, onBack }) {
    const [rows, setRows] = useState([]);
    const [loading, setLoading] = useState(true);
    const [allInsumos, setAllInsumos] = useState([]);
    const [showAssign, setShowAssign] = useState(false);

    const load = useCallback(async () => {
        if (!supplier) return;
        setLoading(true);
        try {
            const [rIns, rAll] = await Promise.all([
                suppliersService.getInsumos(supplier.id),
                insumosService.getAll(true),
            ]);
            setRows(rIns.data);
            setAllInsumos(rAll.data);
        } catch (err) {
            console.error(err);
            toast.error('Error cargando insumos del proveedor');
        } finally {
            setLoading(false);
        }
    }, [supplier]);

    useEffect(() => { load(); }, [load]);

    const handleDesasignar = async (insumoId, nombre) => {
        if (!confirm(`¿Desactivar la relación con "${nombre}"? No se borra el historial.`)) return;
        try {
            await suppliersService.desasignarInsumo(supplier.id, insumoId);
            toast.success('Relación desactivada');
            load();
        } catch (err) {
            toast.error(err.response?.data?.detail || 'Error al desasignar');
        }
    };

    if (!supplier) return null;

    const insumosDisponibles = allInsumos.filter(i => !rows.some(r => r.insumo_id === i.id && r.activo));

    return (
        <div>
            <div className="flex items-center gap-3 mb-6">
                <button onClick={onBack} className="btn btn-secondary"
                    style={{ width: 36, height: 36, padding: 0, borderRadius: '50%' }}>
                    <ArrowLeft size={17} />
                </button>
                <div style={{ minWidth: 0 }}>
                    <h1 className="m-0">{supplier.nombre}</h1>
                    <p className="text-muted" style={{ fontSize: '0.85rem', marginTop: 2 }}>
                        Insumos que vende — gestión de costos por proveedor
                    </p>
                </div>
            </div>

            <div className="card mb-4" style={{ padding: '0.75rem 1rem',
                background: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.25)' }}>
                <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', lineHeight: 1.5, margin: 0 }}>
                    <strong style={{ color: '#60a5fa' }}>ℹ️ Cómo afecta al costo:</strong>{' '}
                    El costo unitario global de cada insumo se calcula como{' '}
                    <strong>promedio ponderado por compras</strong> de TODOS los proveedores.
                    Asignar un proveedor aquí no mueve el promedio — solo lo hace registrar un gasto real.
                </p>
            </div>

            <div className="card overflow-x-auto">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                    <h3 className="m-0" style={{ fontSize: '1rem' }}>Insumos asignados</h3>
                    <button onClick={() => setShowAssign(true)} className="btn btn-primary"
                        style={{ width: 'auto', padding: '0.5rem 1rem', display: 'flex', alignItems: 'center', gap: 6 }}
                        disabled={insumosDisponibles.length === 0}>
                        <Plus size={14} /> Asignar insumo existente
                    </button>
                </div>

                <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 700 }}>
                    <thead>
                        <tr style={{ borderBottom: '1px solid var(--border)', textAlign: 'left' }}>
                            <th className="p-3">Insumo</th>
                            <th className="p-3 text-right">Último costo / unidad (este proveedor)</th>
                            <th className="p-3 text-right">Promedio ponderado (global)</th>
                            <th className="p-3 text-right">Diferencial</th>
                            <th className="p-3">Última compra</th>
                            <th className="p-3 text-center">Acciones</th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            <tr><td colSpan="6" className="p-4 text-center">Cargando…</td></tr>
                        ) : rows.length === 0 ? (
                            <tr><td colSpan="6" className="p-4 text-center text-muted">Este proveedor aún no vende insumos registrados.</td></tr>
                        ) : rows.map(r => {
                            const ultimo = r.ultimo_costo_unitario;
                            const prom   = r.costo_promedio_insumo;
                            const delta  = (ultimo != null && prom != null && prom > 0)
                                ? ((ultimo - prom) / prom) * 100 : null;
                            const deltaColor = delta == null ? 'var(--text-muted)'
                                : delta > 2 ? '#ef4444' : delta < -2 ? '#22c55e' : 'var(--text-muted)';
                            return (
                                <tr key={r.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', opacity: r.activo ? 1 : 0.45 }}>
                                    <td className="p-3">
                                        <div className="font-bold">{r.insumo_nombre}</div>
                                        <div className="text-xs text-muted">{r.unidad_medida}</div>
                                    </td>
                                    <td className="p-3 text-right font-bold">{fmtMoney(ultimo)}</td>
                                    <td className="p-3 text-right text-muted">{fmtMoney(prom)}</td>
                                    <td className="p-3 text-right font-bold" style={{ color: deltaColor }}>
                                        {delta == null ? '—' : `${delta > 0 ? '+' : ''}${delta.toFixed(1)}%`}
                                    </td>
                                    <td className="p-3 text-muted" style={{ fontSize: '0.82rem' }}>
                                        {r.ultima_compra_fecha ? formatDate(r.ultima_compra_fecha) : '—'}
                                    </td>
                                    <td className="p-3 text-center">
                                        {r.activo ? (
                                            <button onClick={() => handleDesasignar(r.insumo_id, r.insumo_nombre)}
                                                className="btn btn-secondary text-danger"
                                                style={{ padding: '0.3rem 0.5rem' }} title="Desactivar relación">
                                                <Trash2 size={13} />
                                            </button>
                                        ) : <span className="text-xs text-muted">Inactivo</span>}
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>

            {showAssign && (
                <AssignInsumoModal
                    supplier={supplier}
                    insumosDisponibles={insumosDisponibles}
                    onClose={() => setShowAssign(false)}
                    onSaved={() => { setShowAssign(false); load(); }}
                />
            )}
        </div>
    );
}


// ════════════════════════════════════════════════════════════════════════════
// AssignInsumoModal — asignar insumo existente + preview impacto
// ════════════════════════════════════════════════════════════════════════════
function AssignInsumoModal({ supplier, insumosDisponibles, onClose, onSaved }) {
    const [insumoId, setInsumoId] = useState('');
    const [costoRef, setCostoRef] = useState('');
    const [udsPaq, setUdsPaq] = useState('');
    const [preview, setPreview] = useState(null);
    const [saving, setSaving] = useState(false);

    const insumoSel = insumosDisponibles.find(i => i.id === parseInt(insumoId));

    useEffect(() => {
        if (!insumoId) { setPreview(null); return; }
        const costo = costoRef !== '' ? parseFloat(costoRef) : null;
        suppliersService.previewImpacto(supplier.id, insumoId, costo)
            .then(r => setPreview(r.data))
            .catch(() => setPreview(null));
    }, [insumoId, costoRef, supplier.id]);

    useEffect(() => {
        if (insumoSel && udsPaq === '') {
            setUdsPaq(insumoSel.unidades_por_paquete != null ? String(insumoSel.unidades_por_paquete) : '');
        }
    }, [insumoSel]); // eslint-disable-line react-hooks/exhaustive-deps

    const handleSave = async () => {
        if (!insumoId) return toast.error('Selecciona un insumo');
        setSaving(true);
        try {
            await suppliersService.asignarInsumo(supplier.id, {
                insumo_id: parseInt(insumoId),
                costo_unitario_referencia: costoRef !== '' ? parseFloat(costoRef) : null,
                unidades_por_paquete: udsPaq !== '' ? parseFloat(udsPaq) : null,
            });
            toast.success('Insumo asignado al proveedor');
            onSaved();
        } catch (err) {
            toast.error(err.response?.data?.detail || 'Error al asignar');
        } finally {
            setSaving(false);
        }
    };

    const delta = preview?.delta_pct;
    const deltaColor = delta == null ? 'var(--text-muted)'
        : delta > 2 ? '#ef4444' : delta < -2 ? '#22c55e' : 'var(--text-muted)';

    return (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', zIndex: 100,
            display: 'flex', alignItems: 'flex-start', justifyContent: 'center', overflowY: 'auto', padding: 16 }}>
            <div className="card" style={{ width: '100%', maxWidth: 460, margin: 'auto', position: 'relative' }}>
                <button onClick={onClose} className="btn-close-modal"><X size={18} /></button>
                <h2 className="m-0 mb-1">Asignar insumo a {supplier.nombre}</h2>
                <p className="text-muted mb-4" style={{ fontSize: '0.82rem' }}>
                    Selecciona un insumo existente. El costo de referencia es opcional y no altera el promedio global.
                </p>

                <div className="form-group">
                    <label>Insumo *</label>
                    <select className="form-control" value={insumoId}
                        onChange={e => { setInsumoId(e.target.value); setUdsPaq(''); }}>
                        <option value="">— Selecciona —</option>
                        {insumosDisponibles.map(i => (
                            <option key={i.id} value={i.id}>{i.nombre} ({i.unidad_medida})</option>
                        ))}
                    </select>
                </div>

                {insumoSel && (
                    <>
                        <div className="form-group">
                            <label>Costo de referencia por {insumoSel.unidad_medida} (opcional)</label>
                            <input type="number" className="form-control" value={costoRef}
                                onChange={e => setCostoRef(e.target.value)}
                                placeholder={`Ej: ${preview?.costo_promedio_actual ? Math.round(preview.costo_promedio_actual) : 'precio orientativo'}`}
                                min="0" step="1" />
                            <small className="text-muted" style={{ fontSize: '0.72rem' }}>
                                Solo informativo. El promedio global se moverá cuando registres un gasto real.
                            </small>
                        </div>

                        <div className="form-group">
                            <label>Unidades por paquete (opcional)</label>
                            <input type="number" className="form-control" value={udsPaq}
                                onChange={e => setUdsPaq(e.target.value)}
                                placeholder={insumoSel.unidades_por_paquete != null
                                    ? `Hereda ${insumoSel.unidades_por_paquete} del insumo`
                                    : 'Si este proveedor vende otra presentación'}
                                min="0.001" step="0.001" />
                        </div>
                    </>
                )}

                {preview && (
                    <div style={{ padding: '0.8rem 1rem', borderRadius: 8, marginTop: 8,
                        background: 'rgba(139,92,246,0.06)', border: '1px solid rgba(139,92,246,0.25)' }}>
                        <p style={{ fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase',
                            letterSpacing: 1, color: 'var(--brand)', margin: '0 0 8px 0' }}>
                            📊 Impacto en costo
                        </p>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, fontSize: '0.85rem' }}>
                            <div>
                                <div className="text-muted text-xs">Promedio ponderado actual</div>
                                <div className="font-bold">{fmtMoney(preview.costo_promedio_actual)}</div>
                            </div>
                            <div>
                                <div className="text-muted text-xs">Proveedores actuales</div>
                                <div className="font-bold">{preview.proveedores_actuales}</div>
                            </div>
                            {preview.costo_referencia != null && (
                                <>
                                    <div>
                                        <div className="text-muted text-xs">Tu referencia</div>
                                        <div className="font-bold">{fmtMoney(preview.costo_referencia)}</div>
                                    </div>
                                    <div>
                                        <div className="text-muted text-xs">Diferencial vs. promedio</div>
                                        <div className="font-bold" style={{ color: deltaColor }}>
                                            {delta == null ? '—' : `${delta > 0 ? '+' : ''}${delta.toFixed(1)}%`}
                                        </div>
                                    </div>
                                </>
                            )}
                        </div>
                    </div>
                )}

                <div className="flex gap-2 justify-end mt-4">
                    <button type="button" className="btn btn-secondary" onClick={onClose}>Cancelar</button>
                    <button type="button" className="btn btn-primary" disabled={saving || !insumoId}
                        onClick={handleSave} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <Save size={14} /> {saving ? 'Guardando…' : 'Asignar'}
                    </button>
                </div>
            </div>
        </div>
    );
}

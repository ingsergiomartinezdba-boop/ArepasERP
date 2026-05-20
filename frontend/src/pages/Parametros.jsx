import { useEffect, useState } from 'react';
import { parametrosService } from '../services/api';
import { Plus, Edit2, Trash2, Save, X, Settings, Ruler, Package, Users, Sliders, Check, FolderTree, ChevronDown, ChevronRight, Tag } from 'lucide-react';
import { toast } from 'sonner';

const TABS = [
    { id: 'unidades',           label: 'Unidades de medida',  icon: Ruler },
    { id: 'parametros',         label: 'Configuración',       icon: Sliders },
    { id: 'tipos_producto',     label: 'Tipos de producto',   icon: Package },
    { id: 'tipos_cliente',      label: 'Tipos de cliente',    icon: Users },
    { id: 'categorias',         label: 'Categorías',          icon: FolderTree },
];

export default function Parametros() {
    const [tab, setTab] = useState('unidades');
    return (
        <div>
            <div className="page-header">
                <h1 style={{ display: 'flex', alignItems: 'center', gap: 10, margin: 0 }}>
                    <Settings size={22} /> Parámetros del sistema
                </h1>
                <p className="page-subtitle">Catálogos y valores parametrizables — los cambios se aplican sin redeploy</p>
            </div>

            <div style={{ display: 'flex', gap: 6, marginBottom: 18, borderBottom: '1px solid var(--border)' }}>
                {TABS.map(t => {
                    const Icon = t.icon;
                    return (
                        <button key={t.id}
                            onClick={() => setTab(t.id)}
                            style={{
                                background: tab === t.id ? 'var(--bg-secondary)' : 'transparent',
                                border: 'none',
                                borderBottom: tab === t.id ? '2px solid #ffdd19' : '2px solid transparent',
                                padding: '10px 14px',
                                fontSize: 13,
                                fontWeight: 700,
                                color: tab === t.id ? 'var(--text-primary)' : 'var(--text-secondary)',
                                cursor: 'pointer',
                                display: 'flex', alignItems: 'center', gap: 6,
                            }}>
                            <Icon size={14} /> {t.label}
                        </button>
                    );
                })}
            </div>

            {tab === 'unidades'         && <TabUnidades />}
            {tab === 'parametros'       && <TabParametros />}
            {tab === 'tipos_producto'   && <TabTipos kind="tipos_producto" />}
            {tab === 'tipos_cliente'    && <TabTipos kind="tipos_cliente" />}
            {tab === 'categorias'       && <TabCategorias />}
        </div>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// TAB: Unidades de medida
// ─────────────────────────────────────────────────────────────────────────────
function TabUnidades() {
    const [rows, setRows] = useState([]);
    const [loading, setLoading] = useState(true);
    const [editing, setEditing] = useState(null);
    const [creating, setCreating] = useState(false);

    const load = async () => {
        setLoading(true);
        try { const r = await parametrosService.getUnidades(); setRows(r.data); }
        catch { toast.error('Error cargando unidades'); }
        finally { setLoading(false); }
    };

    useEffect(() => { load(); }, []);

    const handleSave = async (data) => {
        try {
            if (editing) {
                await parametrosService.actualizarUnidad(editing.codigo, data);
                toast.success('Unidad actualizada');
            } else {
                await parametrosService.crearUnidad(data);
                toast.success('Unidad creada');
            }
            setEditing(null); setCreating(false); load();
        } catch (e) {
            toast.error(e.response?.data?.detail || 'Error guardando');
        }
    };

    const handleDelete = async (codigo) => {
        if (!confirm(`¿Eliminar la unidad '${codigo}'?`)) return;
        try {
            await parametrosService.eliminarUnidad(codigo);
            toast.success('Unidad eliminada');
            load();
        } catch (e) {
            toast.error(e.response?.data?.detail || 'No se puede eliminar');
        }
    };

    const grupos = ['peso', 'volumen', 'unidad'];

    return (
        <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                    Las unidades del sistema (kg, gramo, litro, etc.) no se pueden eliminar pero sí desactivar.
                    Conversiones entre unidades del mismo grupo se calculan automáticamente.
                </div>
                <button className="btn btn-primary" onClick={() => setCreating(true)}>
                    <Plus size={14} /> Nueva unidad
                </button>
            </div>

            {(editing || creating) && (
                <UnidadForm
                    initial={editing || { codigo: '', nombre: '', grupo: 'peso', factor_base: 1, activo: true }}
                    isEdit={!!editing}
                    onCancel={() => { setEditing(null); setCreating(false); }}
                    onSave={handleSave}
                />
            )}

            {grupos.map(g => {
                const items = rows.filter(r => r.grupo === g);
                if (!items.length) return null;
                return (
                    <div key={g} style={{ marginBottom: 18 }}>
                        <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-tertiary)', marginBottom: 6 }}>
                            Grupo {g}
                        </div>
                        <div className="table-container">
                            <table className="data-table">
                                <thead>
                                    <tr>
                                        <th>Código</th>
                                        <th>Nombre</th>
                                        <th style={{ textAlign: 'right' }}>Factor (a unidad base)</th>
                                        <th>Estado</th>
                                        <th>Acciones</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {items.map(u => (
                                        <tr key={u.codigo} style={{ opacity: u.activo ? 1 : 0.5 }}>
                                            <td style={{ fontFamily: 'monospace', fontWeight: 700 }}>{u.codigo}</td>
                                            <td>{u.nombre}</td>
                                            <td style={{ textAlign: 'right', fontFamily: 'monospace' }}>{u.factor_base}</td>
                                            <td>
                                                {u.activo
                                                    ? <span style={{ color: '#22c55e', fontSize: 12, fontWeight: 600 }}>● Activa</span>
                                                    : <span style={{ color: 'var(--text-tertiary)', fontSize: 12 }}>○ Inactiva</span>}
                                                {u.sistema && <span style={{ marginLeft: 8, fontSize: 11, color: '#a78bfa' }}>sistema</span>}
                                            </td>
                                            <td>
                                                <button className="btn btn-secondary" style={{ padding: '4px 8px' }} onClick={() => setEditing(u)}>
                                                    <Edit2 size={12} />
                                                </button>
                                                {!u.sistema && (
                                                    <button className="btn btn-secondary" style={{ padding: '4px 8px', marginLeft: 4, color: 'var(--danger)' }} onClick={() => handleDelete(u.codigo)}>
                                                        <Trash2 size={12} />
                                                    </button>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                );
            })}
            {loading && <div style={{ textAlign: 'center', padding: 20 }}>Cargando…</div>}
        </div>
    );
}

function UnidadForm({ initial, isEdit, onCancel, onSave }) {
    const [data, setData] = useState(initial);
    return (
        <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 8, padding: 14, marginBottom: 14 }}>
            <div style={{ fontWeight: 700, marginBottom: 10 }}>{isEdit ? 'Editar unidad' : 'Nueva unidad'}</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 10 }}>
                <div>
                    <label className="form-label">Código *</label>
                    <input className="form-control" value={data.codigo} disabled={isEdit}
                        placeholder="kg, lb, arroba…"
                        onChange={e => setData({ ...data, codigo: e.target.value.toLowerCase().trim() })} />
                </div>
                <div>
                    <label className="form-label">Nombre *</label>
                    <input className="form-control" value={data.nombre}
                        placeholder="Kilogramo, Arroba, etc."
                        onChange={e => setData({ ...data, nombre: e.target.value })} />
                </div>
                <div>
                    <label className="form-label">Grupo *</label>
                    <select className="form-control" value={data.grupo}
                        onChange={e => setData({ ...data, grupo: e.target.value })}>
                        <option value="peso">peso</option>
                        <option value="volumen">volumen</option>
                        <option value="unidad">unidad</option>
                    </select>
                </div>
                <div>
                    <label className="form-label">Factor a unidad base *</label>
                    <input type="number" step="any" className="form-control" value={data.factor_base}
                        onChange={e => setData({ ...data, factor_base: parseFloat(e.target.value) || 0 })} />
                    <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginTop: 2 }}>
                        Base: kg (peso), litro (volumen), unidad (unidad). Ej: gramo = 0.001, arroba = 12.5.
                    </div>
                </div>
            </div>
            <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 10 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
                    <input type="checkbox" checked={data.activo} onChange={e => setData({ ...data, activo: e.target.checked })} />
                    Activa
                </label>
                <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
                    <button className="btn btn-secondary" onClick={onCancel}><X size={13} /> Cancelar</button>
                    <button className="btn btn-primary" onClick={() => onSave(data)}><Save size={13} /> Guardar</button>
                </div>
            </div>
        </div>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// TAB: Parámetros del sistema (valores escalares)
// ─────────────────────────────────────────────────────────────────────────────
function TabParametros() {
    const [rows, setRows] = useState([]);
    const [edits, setEdits] = useState({});  // {clave: nuevo_valor}

    const load = async () => {
        try { const r = await parametrosService.getParametros(); setRows(r.data); }
        catch { toast.error('Error cargando parámetros'); }
    };

    useEffect(() => { load(); }, []);

    const save = async (clave) => {
        if (edits[clave] == null) return;
        try {
            await parametrosService.actualizarParametro(clave, { valor: String(edits[clave]) });
            toast.success(`Guardado ${clave}`);
            setEdits(prev => { const c = { ...prev }; delete c[clave]; return c; });
            load();
        } catch (e) {
            toast.error(e.response?.data?.detail || 'Error guardando');
        }
    };

    const categorias = [...new Set(rows.map(r => r.categoria))].sort();

    return (
        <div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 12 }}>
                Parámetros que afectan la operación. Los cambios entran en vigor al guardar (sin reiniciar el backend).
            </div>
            {categorias.map(cat => (
                <div key={cat} style={{ marginBottom: 18 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-tertiary)', marginBottom: 6 }}>
                        {cat}
                    </div>
                    <div className="table-container">
                        <table className="data-table">
                            <thead>
                                <tr>
                                    <th style={{ width: '40%' }}>Parámetro</th>
                                    <th style={{ width: '20%' }}>Valor</th>
                                    <th style={{ width: '15%' }}>Tipo</th>
                                    <th>Descripción</th>
                                    <th></th>
                                </tr>
                            </thead>
                            <tbody>
                                {rows.filter(r => r.categoria === cat).map(p => {
                                    const editado = edits[p.clave] != null;
                                    const valor = editado ? edits[p.clave] : p.valor;
                                    return (
                                        <tr key={p.clave}>
                                            <td>
                                                <div style={{ fontWeight: 600 }}>{p.nombre}</div>
                                                <div style={{ fontSize: 11, color: 'var(--text-tertiary)', fontFamily: 'monospace' }}>{p.clave}</div>
                                            </td>
                                            <td>
                                                <input
                                                    className="form-control"
                                                    type={['numero', 'porcentaje'].includes(p.tipo) ? 'number' : 'text'}
                                                    step="any"
                                                    value={valor}
                                                    onChange={e => setEdits(prev => ({ ...prev, [p.clave]: e.target.value }))}
                                                    style={{ fontSize: 13 }}
                                                />
                                                {p.min_valor != null && p.max_valor != null && (
                                                    <div style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>
                                                        {p.min_valor} – {p.max_valor}
                                                    </div>
                                                )}
                                            </td>
                                            <td>
                                                <span style={{ fontSize: 11, padding: '2px 8px', background: 'var(--bg-tertiary)', borderRadius: 4 }}>
                                                    {p.tipo}
                                                </span>
                                            </td>
                                            <td style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{p.descripcion}</td>
                                            <td>
                                                {editado && (
                                                    <button className="btn btn-primary" style={{ padding: '4px 10px' }} onClick={() => save(p.clave)}>
                                                        <Check size={12} /> Guardar
                                                    </button>
                                                )}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            ))}
        </div>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// TAB genérico: tipos_producto / tipos_cliente
// ─────────────────────────────────────────────────────────────────────────────
function TabTipos({ kind }) {
    const isProducto = kind === 'tipos_producto';
    const getAll = isProducto ? parametrosService.getTiposProducto    : parametrosService.getTiposCliente;
    const create = isProducto ? parametrosService.crearTipoProducto    : parametrosService.crearTipoCliente;
    const update = isProducto ? parametrosService.actualizarTipoProducto : parametrosService.actualizarTipoCliente;
    const remove = isProducto ? parametrosService.eliminarTipoProducto : parametrosService.eliminarTipoCliente;
    const titulo = isProducto ? 'Tipos de producto' : 'Tipos de cliente';

    const [rows, setRows] = useState([]);
    const [editing, setEditing] = useState(null);
    const [creating, setCreating] = useState(false);

    const load = async () => {
        try { const r = await getAll(); setRows(r.data); }
        catch { toast.error(`Error cargando ${titulo}`); }
    };
    useEffect(() => { load(); }, [kind]);

    const handleSave = async (data) => {
        try {
            if (editing) await update(editing.codigo, data);
            else         await create(data);
            toast.success('Guardado');
            setEditing(null); setCreating(false); load();
        } catch (e) {
            toast.error(e.response?.data?.detail || 'Error');
        }
    };
    const handleDelete = async (codigo) => {
        if (!confirm(`¿Eliminar '${codigo}'? Los registros existentes mantendrán el texto pero ya no podrá seleccionarse en formularios nuevos.`)) return;
        try { await remove(codigo); toast.success('Eliminado'); load(); }
        catch (e) { toast.error(e.response?.data?.detail || 'Error'); }
    };

    return (
        <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                    Estos códigos aparecen en los selectores de formularios. Crear / editar no afecta a registros viejos.
                </div>
                <button className="btn btn-primary" onClick={() => setCreating(true)}>
                    <Plus size={14} /> Nuevo
                </button>
            </div>

            {(editing || creating) && (
                <TipoForm
                    initial={editing || { codigo: '', nombre: '', descripcion: '', color: '', orden: 0, activo: true }}
                    isEdit={!!editing}
                    onCancel={() => { setEditing(null); setCreating(false); }}
                    onSave={handleSave}
                />
            )}

            <div className="table-container">
                <table className="data-table">
                    <thead>
                        <tr>
                            <th>Código</th>
                            <th>Nombre</th>
                            <th>Descripción</th>
                            <th>Orden</th>
                            <th>Estado</th>
                            <th>Acciones</th>
                        </tr>
                    </thead>
                    <tbody>
                        {rows.map(t => (
                            <tr key={t.codigo} style={{ opacity: t.activo ? 1 : 0.5 }}>
                                <td style={{ fontFamily: 'monospace', fontWeight: 700 }}>
                                    {t.color && <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: t.color, marginRight: 6 }} />}
                                    {t.codigo}
                                </td>
                                <td>{t.nombre}</td>
                                <td style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{t.descripcion || '—'}</td>
                                <td>{t.orden}</td>
                                <td>
                                    {t.activo
                                        ? <span style={{ color: '#22c55e', fontSize: 12, fontWeight: 600 }}>● Activo</span>
                                        : <span style={{ color: 'var(--text-tertiary)', fontSize: 12 }}>○ Inactivo</span>}
                                </td>
                                <td>
                                    <button className="btn btn-secondary" style={{ padding: '4px 8px' }} onClick={() => setEditing(t)}>
                                        <Edit2 size={12} />
                                    </button>
                                    <button className="btn btn-secondary" style={{ padding: '4px 8px', marginLeft: 4, color: 'var(--danger)' }} onClick={() => handleDelete(t.codigo)}>
                                        <Trash2 size={12} />
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

function TipoForm({ initial, isEdit, onCancel, onSave }) {
    const [d, setD] = useState(initial);
    return (
        <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 8, padding: 14, marginBottom: 14 }}>
            <div style={{ fontWeight: 700, marginBottom: 10 }}>{isEdit ? 'Editar' : 'Nuevo'}</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 80px', gap: 10 }}>
                <div>
                    <label className="form-label">Código *</label>
                    <input className="form-control" value={d.codigo} disabled={isEdit}
                        onChange={e => setD({ ...d, codigo: e.target.value.toLowerCase().trim().replace(/\s+/g, '_') })} />
                </div>
                <div>
                    <label className="form-label">Nombre *</label>
                    <input className="form-control" value={d.nombre} onChange={e => setD({ ...d, nombre: e.target.value })} />
                </div>
                <div>
                    <label className="form-label">Color (hex opcional)</label>
                    <input className="form-control" value={d.color || ''} placeholder="#a78bfa" onChange={e => setD({ ...d, color: e.target.value })} />
                </div>
                <div>
                    <label className="form-label">Orden</label>
                    <input type="number" className="form-control" value={d.orden} onChange={e => setD({ ...d, orden: parseInt(e.target.value) || 0 })} />
                </div>
                <div style={{ gridColumn: '1 / -1' }}>
                    <label className="form-label">Descripción</label>
                    <input className="form-control" value={d.descripcion || ''} onChange={e => setD({ ...d, descripcion: e.target.value })} />
                </div>
            </div>
            <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 10 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
                    <input type="checkbox" checked={d.activo} onChange={e => setD({ ...d, activo: e.target.checked })} />
                    Activo
                </label>
                <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
                    <button className="btn btn-secondary" onClick={onCancel}><X size={13} /> Cancelar</button>
                    <button className="btn btn-primary" onClick={() => onSave(d)}><Save size={13} /> Guardar</button>
                </div>
            </div>
        </div>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// TAB: Categorías (genérico multi-módulo — gastos, ingresos, productos, etc.)
// ─────────────────────────────────────────────────────────────────────────────
function TabCategorias() {
    const [modulos, setModulos] = useState([]);
    const [modulo, setModulo]   = useState('gastos');
    const [cats, setCats]       = useState([]);
    const [loading, setLoading] = useState(true);
    const [expanded, setExpanded] = useState({});           // { [catId]: true }
    const [catModal, setCatModal] = useState(null);          // { mode:'new'|'edit', data:{} }
    const [subModal, setSubModal] = useState(null);          // { mode:'new'|'edit', categoria_id, data:{} }

    const loadModulos = async () => {
        try {
            const r = await parametrosService.getModulos(true);
            setModulos(r.data);
        } catch { toast.error('Error cargando módulos'); }
    };

    const loadCats = async () => {
        setLoading(true);
        try {
            const r = await parametrosService.getCategorias({ modulo });
            setCats(r.data);
        } catch (e) {
            toast.error(e.response?.data?.detail || 'Error cargando categorías');
        } finally { setLoading(false); }
    };

    useEffect(() => { loadModulos(); }, []);
    useEffect(() => { loadCats(); /* recarga al cambiar módulo */ }, [modulo]);

    const toggleExpand = (id) => setExpanded(prev => ({ ...prev, [id]: !prev[id] }));

    // ── CRUD categoría ──
    const saveCat = async (data) => {
        try {
            if (catModal.mode === 'edit') {
                await parametrosService.actualizarCategoria(catModal.data.id, data);
                toast.success('Categoría actualizada');
            } else {
                await parametrosService.crearCategoria({ ...data, modulo_codigo: modulo });
                toast.success('Categoría creada');
            }
            setCatModal(null); loadCats();
        } catch (e) { toast.error(e.response?.data?.detail || 'Error guardando'); }
    };

    const deleteCat = async (cat) => {
        if (!confirm(`¿Eliminar la categoría "${cat.nombre}"?`)) return;
        try {
            await parametrosService.eliminarCategoria(cat.id);
            toast.success('Categoría eliminada');
            loadCats();
        } catch (e) { toast.error(e.response?.data?.detail || 'No se puede eliminar'); }
    };

    const toggleActivoCat = async (cat) => {
        try {
            await parametrosService.actualizarCategoria(cat.id, { activo: !cat.activo });
            loadCats();
        } catch (e) { toast.error(e.response?.data?.detail || 'Error'); }
    };

    // ── CRUD subcategoría ──
    const saveSub = async (data) => {
        try {
            if (subModal.mode === 'edit') {
                await parametrosService.actualizarSubcategoria(subModal.data.id, data);
                toast.success('Subcategoría actualizada');
            } else {
                await parametrosService.crearSubcategoria({ ...data, categoria_id: subModal.categoria_id });
                toast.success('Subcategoría creada');
            }
            setSubModal(null); loadCats();
        } catch (e) { toast.error(e.response?.data?.detail || 'Error guardando'); }
    };

    const deleteSub = async (sub) => {
        if (!confirm(`¿Eliminar la subcategoría "${sub.nombre}"?\nLos gastos asociados se desvincularán (no se eliminan).`)) return;
        try {
            await parametrosService.eliminarSubcategoria(sub.id);
            toast.success('Subcategoría eliminada');
            loadCats();
        } catch (e) { toast.error(e.response?.data?.detail || 'No se puede eliminar'); }
    };

    const toggleActivoSub = async (sub) => {
        try {
            await parametrosService.actualizarSubcategoria(sub.id, { activo: !sub.activo });
            loadCats();
        } catch (e) { toast.error(e.response?.data?.detail || 'Error'); }
    };

    return (
        <div>
            <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end', marginBottom: 12, flexWrap: 'wrap' }}>
                <div style={{ flex: '0 0 auto' }}>
                    <label className="form-label" style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>Módulo</label>
                    <select className="form-control" value={modulo} onChange={e => setModulo(e.target.value)}
                        style={{ minWidth: 200 }}>
                        {modulos.map(m => (
                            <option key={m.codigo} value={m.codigo}>{m.icono ? `${m.icono} ` : ''}{m.nombre}</option>
                        ))}
                    </select>
                </div>
                <div style={{ flex: 1, fontSize: 12, color: 'var(--text-secondary)' }}>
                    Categorías y subcategorías son reutilizables por cualquier módulo. Las categorías marcadas como
                    "sistema" no se pueden borrar pero sí desactivar.
                </div>
                <button className="btn btn-primary" onClick={() => setCatModal({ mode: 'new', data: { nombre: '', tipo: 'variable', tipo_costo: null, icono: '', color: '', orden: 0, activo: true } })}>
                    <Plus size={14} /> Nueva categoría
                </button>
            </div>

            {loading ? (
                <div style={{ textAlign: 'center', padding: 30, color: 'var(--text-tertiary)' }}>Cargando…</div>
            ) : cats.length === 0 ? (
                <div style={{ textAlign: 'center', padding: 30, color: 'var(--text-tertiary)', fontSize: 13 }}>
                    Sin categorías para este módulo. Crea la primera con "Nueva categoría".
                </div>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {cats.map(cat => {
                        const isOpen = !!expanded[cat.id];
                        const Caret = isOpen ? ChevronDown : ChevronRight;
                        return (
                            <div key={cat.id} style={{
                                background: 'var(--bg-secondary)', border: '1px solid var(--border)',
                                borderRadius: 8, overflow: 'hidden', opacity: cat.activo ? 1 : 0.55,
                            }}>
                                {/* Encabezado categoría */}
                                <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px',
                                    borderLeft: `4px solid ${cat.color || 'transparent'}` }}>
                                    <button onClick={() => toggleExpand(cat.id)} style={{
                                        background: 'none', border: 'none', cursor: 'pointer',
                                        color: 'var(--text-secondary)', padding: 2, display: 'flex' }}>
                                        <Caret size={16} />
                                    </button>
                                    <div style={{ fontSize: 18 }}>{cat.icono || '📁'}</div>
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <div style={{ fontWeight: 700, fontSize: 14 }}>{cat.nombre}</div>
                                        <div style={{ fontSize: 11, color: 'var(--text-tertiary)', display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 2 }}>
                                            <span>{(cat.subcategorias || []).length} sub</span>
                                            {cat.tipo && <span>· tipo: {cat.tipo}</span>}
                                            {cat.tipo_costo && <span>· costo: <strong style={{ color: cat.tipo_costo === 'directo' ? '#22c55e' : '#a78bfa' }}>{cat.tipo_costo}</strong></span>}
                                            {cat.sistema && <span style={{ color: '#a78bfa' }}>· sistema</span>}
                                            {!cat.activo && <span style={{ color: 'var(--danger)' }}>· INACTIVA</span>}
                                        </div>
                                    </div>
                                    <button onClick={() => setSubModal({ mode: 'new', categoria_id: cat.id, data: { nombre: '', icono: '', color: '', orden: 0, activo: true } })}
                                        className="btn btn-secondary" style={{ padding: '4px 10px', fontSize: 12 }}>
                                        <Plus size={12} /> Sub
                                    </button>
                                    <button onClick={() => setCatModal({ mode: 'edit', data: cat })}
                                        className="btn btn-secondary" style={{ padding: '4px 8px' }} title="Editar">
                                        <Edit2 size={13} />
                                    </button>
                                    <button onClick={() => toggleActivoCat(cat)}
                                        className="btn btn-secondary" style={{ padding: '4px 8px',
                                        color: cat.activo ? '#22c55e' : 'var(--text-tertiary)' }}
                                        title={cat.activo ? 'Desactivar' : 'Activar'}>
                                        <Check size={13} />
                                    </button>
                                    {!cat.sistema && (
                                        <button onClick={() => deleteCat(cat)} className="btn btn-secondary"
                                            style={{ padding: '4px 8px', color: 'var(--danger)' }} title="Eliminar">
                                            <Trash2 size={13} />
                                        </button>
                                    )}
                                </div>

                                {/* Subcategorías expandidas */}
                                {isOpen && (
                                    <div style={{ background: 'var(--bg-elevated)', borderTop: '1px solid var(--border)',
                                        padding: '8px 14px 10px 50px' }}>
                                        {(cat.subcategorias || []).length === 0 ? (
                                            <div style={{ fontSize: 12, color: 'var(--text-tertiary)', padding: '6px 0' }}>
                                                Sin subcategorías — usa el botón "Sub" para agregar la primera.
                                            </div>
                                        ) : (
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                                                {cat.subcategorias.map(sub => (
                                                    <div key={sub.id} style={{
                                                        display: 'flex', alignItems: 'center', gap: 8, padding: '6px 8px',
                                                        background: 'var(--bg-secondary)', borderRadius: 6,
                                                        opacity: sub.activo ? 1 : 0.5,
                                                        borderLeft: `3px solid ${sub.color || 'transparent'}`,
                                                    }}>
                                                        <span style={{ fontSize: 14 }}>{sub.icono || '·'}</span>
                                                        <span style={{ flex: 1, fontSize: 13, fontWeight: 500 }}>{sub.nombre}</span>
                                                        {sub.sistema && <Tag size={10} style={{ color: '#a78bfa' }} />}
                                                        {!sub.activo && <span style={{ fontSize: 10, color: 'var(--danger)', fontWeight: 700 }}>INACTIVA</span>}
                                                        <button onClick={() => setSubModal({ mode: 'edit', categoria_id: cat.id, data: sub })}
                                                            className="btn btn-secondary" style={{ padding: '2px 6px', fontSize: 11 }} title="Editar">
                                                            <Edit2 size={11} />
                                                        </button>
                                                        <button onClick={() => toggleActivoSub(sub)}
                                                            className="btn btn-secondary" style={{ padding: '2px 6px',
                                                            color: sub.activo ? '#22c55e' : 'var(--text-tertiary)' }}
                                                            title={sub.activo ? 'Desactivar' : 'Activar'}>
                                                            <Check size={11} />
                                                        </button>
                                                        {!sub.sistema && (
                                                            <button onClick={() => deleteSub(sub)} className="btn btn-secondary"
                                                                style={{ padding: '2px 6px', color: 'var(--danger)' }} title="Eliminar">
                                                                <Trash2 size={11} />
                                                            </button>
                                                        )}
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}

            {catModal && (
                <CategoriaForm
                    initial={catModal.data}
                    mode={catModal.mode}
                    modulo={modulo}
                    onCancel={() => setCatModal(null)}
                    onSave={saveCat}
                />
            )}
            {subModal && (
                <SubcategoriaForm
                    initial={subModal.data}
                    mode={subModal.mode}
                    onCancel={() => setSubModal(null)}
                    onSave={saveSub}
                />
            )}
        </div>
    );
}

function CategoriaForm({ initial, mode, modulo, onCancel, onSave }) {
    const [d, setD] = useState({
        nombre: initial.nombre || '',
        tipo: initial.tipo || 'variable',
        tipo_costo: initial.tipo_costo ?? null,
        icono: initial.icono || '',
        color: initial.color || '',
        orden: initial.orden ?? 0,
        activo: initial.activo ?? true,
    });
    const isGastos = modulo === 'gastos';
    return (
        <Modal title={mode === 'edit' ? 'Editar categoría' : 'Nueva categoría'} onCancel={onCancel}
            onSave={() => onSave(d)} disabled={!d.nombre.trim()}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <Field label="Nombre *">
                    <input className="form-control" value={d.nombre}
                        onChange={e => setD({ ...d, nombre: e.target.value })} autoFocus />
                </Field>
                <Field label="Tipo">
                    <input className="form-control" value={d.tipo || ''}
                        placeholder="ej: fijo, variable, insumo"
                        onChange={e => setD({ ...d, tipo: e.target.value })} />
                </Field>
                <Field label="Icono (emoji)">
                    <input className="form-control" value={d.icono || ''}
                        placeholder="📦 💡 🏠"
                        onChange={e => setD({ ...d, icono: e.target.value })} />
                </Field>
                <Field label="Color (hex)">
                    <input className="form-control" value={d.color || ''}
                        placeholder="#8b5cf6"
                        onChange={e => setD({ ...d, color: e.target.value })} />
                </Field>
                <Field label="Orden">
                    <input type="number" className="form-control" value={d.orden}
                        onChange={e => setD({ ...d, orden: parseInt(e.target.value) || 0 })} />
                </Field>
                {isGastos && (
                    <Field label="Tipo de costo (gastos)">
                        <select className="form-control" value={d.tipo_costo ?? ''}
                            onChange={e => setD({ ...d, tipo_costo: e.target.value || null })}>
                            <option value="">— Sin clasificar —</option>
                            <option value="directo">Directo</option>
                            <option value="indirecto">Indirecto</option>
                        </select>
                    </Field>
                )}
            </div>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, marginTop: 10 }}>
                <input type="checkbox" checked={d.activo}
                    onChange={e => setD({ ...d, activo: e.target.checked })} />
                Activa
            </label>
        </Modal>
    );
}

function SubcategoriaForm({ initial, mode, onCancel, onSave }) {
    const [d, setD] = useState({
        nombre: initial.nombre || '',
        icono: initial.icono || '',
        color: initial.color || '',
        orden: initial.orden ?? 0,
        activo: initial.activo ?? true,
    });
    return (
        <Modal title={mode === 'edit' ? 'Editar subcategoría' : 'Nueva subcategoría'} onCancel={onCancel}
            onSave={() => onSave(d)} disabled={!d.nombre.trim()}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <Field label="Nombre *">
                    <input className="form-control" value={d.nombre}
                        onChange={e => setD({ ...d, nombre: e.target.value })} autoFocus />
                </Field>
                <Field label="Orden">
                    <input type="number" className="form-control" value={d.orden}
                        onChange={e => setD({ ...d, orden: parseInt(e.target.value) || 0 })} />
                </Field>
                <Field label="Icono (emoji)">
                    <input className="form-control" value={d.icono || ''}
                        placeholder="⚡ 🔥 💧"
                        onChange={e => setD({ ...d, icono: e.target.value })} />
                </Field>
                <Field label="Color (hex)">
                    <input className="form-control" value={d.color || ''}
                        placeholder="#06b6d4"
                        onChange={e => setD({ ...d, color: e.target.value })} />
                </Field>
            </div>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, marginTop: 10 }}>
                <input type="checkbox" checked={d.activo}
                    onChange={e => setD({ ...d, activo: e.target.checked })} />
                Activa
            </label>
        </Modal>
    );
}

function Modal({ title, children, onCancel, onSave, disabled }) {
    return (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)',
            zIndex: 200, display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
            padding: 24, overflowY: 'auto' }}>
            <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)',
                borderRadius: 10, padding: 20, width: '100%', maxWidth: 540, margin: 'auto' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                    <h3 style={{ margin: 0, fontSize: 16 }}>{title}</h3>
                    <button onClick={onCancel} style={{ background: 'none', border: 'none',
                        cursor: 'pointer', color: 'var(--text-muted)' }}><X size={16} /></button>
                </div>
                {children}
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
                    <button className="btn btn-secondary" onClick={onCancel}>Cancelar</button>
                    <button className="btn btn-primary" onClick={onSave} disabled={disabled}>
                        <Save size={13} /> Guardar
                    </button>
                </div>
            </div>
        </div>
    );
}

function Field({ label, children }) {
    return (
        <div>
            <label className="form-label" style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{label}</label>
            {children}
        </div>
    );
}

import { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { expensesService, suppliersService, paymentMethodsService, insumosService, costosService, parametrosService } from '../services/api';

// Emoji por nombre de categoría
const getCatEmoji = (nombre = '') => {
    const n = nombre.toLowerCase();
    if (n.includes('insumo'))    return '📦';
    if (n.includes('servicio'))  return '💡';
    if (n.includes('arriendo'))  return '🏠';
    if (n.includes('nómina') || n.includes('nomina')) return '👥';
    if (n.includes('transport')) return '🚚';
    if (n.includes('manten'))    return '🔧';
    if (n.includes('producc'))   return '⚙️';
    if (n.includes('administ'))  return '📁';
    if (n.includes('impuest'))   return '📋';
    return '✨';
};
import { useNavigate } from 'react-router-dom';
import DateInput from '../components/DateInput';
import { Save, ArrowLeft, Clock, Wallet, DollarSign, FileText, Tag,
         CheckCircle, Package, Plus, X, Trash2, Flame, Droplets, Zap, Layers, Truck } from 'lucide-react';
import { toast } from 'sonner';
import { todayBogota } from '../utils/formatters';


const ESTADO_PAGO_OPTIONS = [
    { value: 'pagado',  label: 'Pagado',  icon: CheckCircle, desc: 'Descuenta del medio de pago' },
    { value: 'credito', label: 'Crédito', icon: Clock,       desc: 'Queda como cuenta por pagar' },
];

const UNIDADES_DEFAULT = ['kg', 'gramo', 'tonelada', 'litro', 'ml', 'cm3', 'unidad'];

const fmtValor = (raw) => {
    if (!raw) return '';
    const n = parseInt(String(raw).replace(/\D/g, ''), 10);
    return isNaN(n) ? '' : new Intl.NumberFormat('es-CO').format(n);
};

const parseNum = (v) => parseFloat(String(v).replace(/[^\d.]/g, '')) || 0;

// Línea vacía de insumo
const emptyLine = () => ({ id: Date.now() + Math.random(), insumo_id: '', cantidad: '', valor_unitario: '' });

// ── Estilos ───────────────────────────────────────────────────────────────────
const STYLES = `
    .ef-wrap       { max-width: 720px; margin: 0 auto; }
    .ef-header     { display: flex; align-items: center; justify-content: space-between;
                     gap: 12px; margin-bottom: 24px; flex-wrap: wrap; }
    .ef-header-left { display: flex; align-items: center; gap: 12px; min-width: 0; }
    .ef-header-left h1 { margin: 0; font-size: 1.375rem; white-space: nowrap;
                          overflow: hidden; text-overflow: ellipsis; }
    .ef-row-2      { display: grid; grid-template-columns: 1fr auto; gap: 16px; align-items: end; }
    .ef-cat-grid   { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; }
    .ef-estado     { display: flex; gap: 12px; }
    .ef-summary    { display: flex; align-items: center; justify-content: space-between;
                     gap: 16px; flex-wrap: nowrap; }
    .ef-summary-val { white-space: nowrap; }

    /* Tabla de insumos */
    .ins-table     { width: 100%; border-collapse: collapse; }
    .ins-table th  { font-size: 0.68rem; font-weight: 700; text-transform: uppercase;
                     letter-spacing: 0.06em; color: var(--text-muted); padding: 0 8px 8px;
                     text-align: left; }
    .ins-table td  { padding: 4px 4px; vertical-align: top; }
    .ins-table td.td-insumo  { width: 35%; }
    .ins-table td.td-cant    { width: 16%; }
    .ins-table td.td-vu      { width: 20%; }
    .ins-table td.td-total   { width: 22%; }
    .ins-table td.td-del     { width: 32px; text-align: center; padding-top: 6px; }
    .ins-new-row   { background: rgba(139,92,246,0.04); border-radius: 8px;
                     padding: 0.7rem 0.85rem; border: 1px dashed rgba(139,92,246,0.3); }
    .ins-new-grid  { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }

    @media (max-width: 768px) {
        .ef-header-left h1 { font-size: 1.125rem; }
        .ef-cat-grid { grid-template-columns: repeat(4, 1fr); }
    }
    @media (max-width: 580px) {
        .ins-table th, .ins-table td { padding-left: 2px; padding-right: 2px; font-size: 0.78rem; }
        .ins-table td.td-insumo { width: 32%; }
        .ins-table td.td-cant   { width: 15%; }
        .ins-table td.td-vu     { width: 18%; }
        .ins-table td.td-total  { width: 20%; }
        .ins-new-grid  { grid-template-columns: 1fr; }
    }
    @media (max-width: 520px) {
        .ef-row-2    { grid-template-columns: 1fr; }
        .ef-cat-grid { grid-template-columns: repeat(4, 1fr); gap: 6px; }
        .ef-cat-btn  { padding: 8px 4px !important; font-size: 0.68rem !important; }
        .ef-estado   { flex-direction: column; gap: 8px; }
        .ef-summary  { flex-direction: column; align-items: flex-start; gap: 4px; }
        .ef-summary-val { font-size: 1.125rem !important; }
        .ef-save-label  { display: none; }
    }
    @media (max-width: 360px) {
        .ef-cat-grid { gap: 4px; }
        .ef-cat-btn  { padding: 6px 2px !important; }
    }
`;

// ── Componente principal ──────────────────────────────────────────────────────
export default function ExpenseForm() {
    const navigate = useNavigate();

    const [suppliers, setSuppliers]           = useState([]);
    const [paymentMethods, setPaymentMethods] = useState([]);
    const [insumos, setInsumos]               = useState([]);
    const [categorias, setCategorias]         = useState([]);
    const [unidadesDb, setUnidadesDb]         = useState(null);
    const UNIDADES = unidadesDb || UNIDADES_DEFAULT;
    useEffect(() => {
        parametrosService.getUnidades(true)
            .then(r => setUnidadesDb(r.data.map(u => u.codigo)))
            .catch(() => {});
    }, []);
    const [loading, setLoading]               = useState(false);

    // Formulario principal
    const [form, setForm] = useState({
        categoria_id:    null,   // se asigna cuando cargan las categorías
        subcategoria_id: '',     // opcional
        fecha:           todayBogota(),
        proveedor_id:    '',
        estado_pago:     'pagado',
        medio_pago_id:   '',
        observaciones:   '',
        valorSimple:     '',
    });
    const set = (key, val) => setForm(f => ({ ...f, [key]: val }));

    // Líneas de insumo (múltiples)
    const [lines, setLines] = useState([emptyLine()]);

    // Campos extra para servicios públicos
    const [servicioTipo, setServicioTipo]     = useState('gas');
    const [servicioConsumo, setServicioConsumo] = useState('');

    // Modal nuevo proveedor
    const [showNewProveedor, setShowNewProveedor] = useState(false);
    const [newProv, setNewProv]   = useState({ nombre: '', telefono: '', email: '', direccion: '' });
    const [creatingProv, setCreatingProv] = useState(false);

    // Panel crear nuevo insumo inline
    const [showNewInsumo, setShowNewInsumo] = useState(false);
    const [newInsumo, setNewInsumo]         = useState({ nombre: '', unidad_medida: 'kg', costo_unitario: '', proveedor_id: '', unidades_por_paquete: '' });
    const [creatingInsumo, setCreatingInsumo] = useState(false);

    useEffect(() => {
        Promise.all([
            suppliersService.getAll(),
            paymentMethodsService.getAll(),
            insumosService.getAll(true),
            expensesService.getCategorias(),
        ]).then(([sRes, pmRes, insRes, catRes]) => {
            setSuppliers(sRes.data);
            setPaymentMethods(pmRes.data.filter(m => m.activo !== false));
            setInsumos(insRes.data);
            const cats = catRes.data;
            setCategorias(cats);
            const defCat = cats.find(c => c.nombre.toLowerCase().includes('otro')) || cats[cats.length - 1];
            if (defCat) set('categoria_id', defCat.id);
        }).catch(console.error);
    }, []);

    // ─── Líneas helpers ───
    const setLine = useCallback((id, key, val) => {
        setLines(prev => prev.map(l => l.id === id ? { ...l, [key]: val } : l));
    }, []);
    const addLine = () => setLines(prev => [...prev, emptyLine()]);
    const removeLine = (id) => setLines(prev => prev.length > 1 ? prev.filter(l => l.id !== id) : prev);

    // Categoría seleccionada actualmente — debe ir ANTES del useEffect que depende de esInsumo
    const catActual  = categorias.find(c => c.id === form.categoria_id);
    const esInsumo   = catActual?.nombre?.toLowerCase().includes('insumo') ?? false;
    const esServicio = catActual?.nombre?.toLowerCase().includes('servicio') ?? false;
    // Subcategorías disponibles para la categoría actual (solo activas)
    const subcategorias = (catActual?.subcategorias || []).filter(s => s.activo !== false);
    // Si la subcategoría seleccionada ya no pertenece a la categoría actual, limpiarla
    useEffect(() => {
        if (form.subcategoria_id && !subcategorias.some(s => s.id === parseInt(form.subcategoria_id))) {
            set('subcategoria_id', '');
        }
    }, [form.categoria_id]);  // eslint-disable-line react-hooks/exhaustive-deps

    const totalLines = esInsumo
        ? lines.reduce((acc, l) => acc + parseNum(l.cantidad) * parseNum(l.valor_unitario), 0)
        : 0;

    // ─── Crear proveedor al vuelo ───
    const handleCreateProveedor = async () => {
        if (!newProv.nombre.trim()) { toast.error('El nombre del proveedor es requerido'); return; }
        setCreatingProv(true);
        try {
            const res = await suppliersService.create({
                nombre:    newProv.nombre.trim(),
                telefono:  newProv.telefono  || null,
                email:     newProv.email     || null,
                direccion: newProv.direccion || null,
                activo:    true,
            });
            const created = res.data;
            setSuppliers(prev => [...prev, created]);
            set('proveedor_id', String(created.id));
            setShowNewProveedor(false);
            setNewProv({ nombre: '', telefono: '', email: '', direccion: '' });
            toast.success(`Proveedor "${created.nombre}" creado`);
        } catch (err) {
            toast.error(err.response?.data?.detail || 'Error al crear proveedor');
        } finally {
            setCreatingProv(false);
        }
    };

    // ─── Crear insumo al vuelo ───
    const handleCreateInsumo = async () => {
        if (!newInsumo.nombre.trim()) return toast.error('Nombre del insumo requerido');
        setCreatingInsumo(true);
        try {
            const res = await insumosService.create({
                nombre: newInsumo.nombre.trim(),
                unidad_medida: newInsumo.unidad_medida,
                costo_unitario: parseFloat(newInsumo.costo_unitario) || 0,
                activo: true,
                proveedor_id: newInsumo.proveedor_id ? parseInt(newInsumo.proveedor_id) : null,
                unidades_por_paquete: newInsumo.unidades_por_paquete !== '' ? parseFloat(newInsumo.unidades_por_paquete) : null,
            });
            const created = res.data;
            setInsumos(prev => [...prev, created]);
            // Asignar al primer campo vacío
            setLines(prev => {
                const firstEmpty = prev.findIndex(l => !l.insumo_id);
                if (firstEmpty >= 0) {
                    return prev.map((l, i) => i === firstEmpty ? { ...l, insumo_id: String(created.id) } : l);
                }
                return [...prev, { ...emptyLine(), insumo_id: String(created.id) }];
            });
            setShowNewInsumo(false);
            setNewInsumo({ nombre: '', unidad_medida: 'kg', costo_unitario: '', proveedor_id: '', unidades_por_paquete: '' });
            toast.success(`Insumo "${created.nombre}" creado`);
        } catch (err) {
            toast.error(err.response?.data?.detail || 'Error al crear insumo');
        } finally {
            setCreatingInsumo(false);
        }
    };

    // ─── Submit ───
    const handleSubmit = async (e) => {
        e?.preventDefault();

        if (form.estado_pago === 'pagado' && !form.medio_pago_id) {
            toast.warning('Selecciona el medio de pago');
            return;
        }

        if (esInsumo) {
            // Validar cada línea
            for (const l of lines) {
                if (!l.insumo_id) { toast.warning('Selecciona el insumo en cada línea'); return; }
                if (!(parseNum(l.cantidad) > 0)) { toast.warning('La cantidad debe ser mayor a 0 en cada línea'); return; }
                if (parseNum(l.valor_unitario) < 0) { toast.warning('El valor unitario no puede ser negativo'); return; }
            }
            if (totalLines <= 0) { toast.warning('El valor total debe ser mayor a 0'); return; }
        } else {
            // Gasto simple: tomar el campo valorRaw del form
            if (!form.valorSimple || parseNum(form.valorSimple) <= 0) {
                toast.warning('El valor debe ser mayor a 0');
                return;
            }
        }

        setLoading(true);
        try {
            if (esInsumo) {
                await Promise.all(lines.map(l => {
                    const cant = parseNum(l.cantidad);
                    const vu   = parseNum(l.valor_unitario);
                    return expensesService.create({
                        valor:           cant * vu,
                        fecha:           form.fecha,
                        categoria_id:    form.categoria_id,
                        subcategoria_id: form.subcategoria_id ? parseInt(form.subcategoria_id) : null,
                        proveedor_id:    form.proveedor_id ? parseInt(form.proveedor_id) : null,
                        medio_pago_id:   (form.estado_pago === 'pagado' && form.medio_pago_id)
                                             ? parseInt(form.medio_pago_id) : null,
                        estado_pago:     form.estado_pago,
                        insumo_id:       parseInt(l.insumo_id),
                        cantidad_insumo: cant,
                    });
                }));
                toast.success(lines.length > 1
                    ? `${lines.length} gastos de insumo registrados`
                    : 'Gasto registrado correctamente');
            } else {
                const valor = parseNum(form.valorSimple);
                await expensesService.create({
                    valor,
                    fecha:           form.fecha,
                    categoria_id:    form.categoria_id,
                    subcategoria_id: form.subcategoria_id ? parseInt(form.subcategoria_id) : null,
                    proveedor_id:    form.proveedor_id ? parseInt(form.proveedor_id) : null,
                    medio_pago_id:   (form.estado_pago === 'pagado' && form.medio_pago_id)
                                         ? parseInt(form.medio_pago_id) : null,
                    estado_pago:     form.estado_pago,
                });

                // ── Auto-generar factura_servicio si es Servicios Públicos ──
                if (esServicio && valor > 0) {
                    const periodo = form.fecha.slice(0, 7); // YYYY-MM
                    const consumo = parseFloat(servicioConsumo) || null;
                    await costosService.crearFactura({
                        tipo:        servicioTipo,
                        periodo,
                        valor,
                        consumo,
                        unidad:      servicioTipo === 'luz' ? 'kWh' : 'm3',
                        proveedor_id: form.proveedor_id ? parseInt(form.proveedor_id) : null,
                        notas:       form.observaciones || null,
                    });
                    const cuMsg = consumo && consumo > 0
                        ? ` · Costo unitario: $${new Intl.NumberFormat('es-CO').format(Math.round(valor / consumo))}/${servicioTipo === 'luz' ? 'kWh' : 'm³'}`
                        : '';
                    toast.success(`Gasto + factura de ${servicioTipo} registrados${cuMsg}`);
                } else {
                    toast.success('Gasto registrado correctamente');
                }
            }
            navigate('/expenses');
        } catch (err) {
            console.error(err);
            toast.error(err.response?.data?.detail || 'Error al guardar gasto');
        } finally {
            setLoading(false);
        }
    };

    const Spinner = () => (
        <span style={{ width:15, height:15, border:'2px solid rgba(0,0,0,0.2)',
            borderTopColor:'#000', borderRadius:'50%',
            animation:'spin 0.6s linear infinite', display:'inline-block', flexShrink:0 }} />
    );

    // Valor mostrado en resumen
    const valorResumen = esInsumo ? totalLines : parseNum(form.valorSimple);

    return (
        <div className="ef-wrap">
            <style>{STYLES}</style>

            {/* ══ MODAL CREAR INSUMO ══ */}
            {showNewInsumo && createPortal(
                <div onClick={() => setShowNewInsumo(false)}
                    style={{ position:'fixed', inset:0, zIndex:9000,
                        background:'rgba(0,0,0,0.55)', display:'flex',
                        alignItems:'center', justifyContent:'center', padding:16 }}>
                    <div onClick={e => e.stopPropagation()}
                        style={{ background:'var(--bg-card)', borderRadius:14,
                            width:'100%', maxWidth:420, boxShadow:'0 24px 64px rgba(0,0,0,0.4)',
                            border:'1px solid var(--border-default)', overflow:'hidden' }}>

                        {/* Header modal */}
                        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between',
                            padding:'1rem 1.25rem', borderBottom:'1px solid var(--border-subtle)',
                            background:'rgba(139,92,246,0.08)' }}>
                            <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                                <Package size={16} style={{ color:'var(--brand)' }}/>
                                <span style={{ fontWeight:700, fontSize:'0.95rem' }}>Crear nuevo insumo</span>
                            </div>
                            <button type="button" onClick={() => setShowNewInsumo(false)}
                                style={{ background:'none', border:'none', cursor:'pointer',
                                    color:'var(--text-muted)', padding:4, borderRadius:6,
                                    display:'flex', alignItems:'center' }}>
                                <X size={18}/>
                            </button>
                        </div>

                        {/* Body modal */}
                        <div style={{ padding:'1.25rem', display:'flex', flexDirection:'column', gap:14 }}>
                            <div className="ins-new-grid">
                                <div className="form-group" style={{ marginBottom:0 }}>
                                    <label>Nombre *</label>
                                    <input value={newInsumo.nombre} autoFocus
                                        onChange={e => setNewInsumo(n => ({ ...n, nombre: e.target.value }))}
                                        placeholder="Ej: Maíz, Queso, Aceite"
                                        onKeyDown={e => e.key === 'Enter' && handleCreateInsumo()} />
                                </div>
                                <div className="form-group" style={{ marginBottom:0 }}>
                                    <label>Unidad de medida</label>
                                    <select value={newInsumo.unidad_medida}
                                        onChange={e => setNewInsumo(n => ({ ...n, unidad_medida: e.target.value }))}>
                                        {UNIDADES.map(u => <option key={u} value={u}>{u}</option>)}
                                    </select>
                                </div>
                            </div>
                            <div className="form-group" style={{ marginBottom:0 }}>
                                <label>Proveedor</label>
                                <select value={newInsumo.proveedor_id}
                                    onChange={e => setNewInsumo(n => ({ ...n, proveedor_id: e.target.value }))}>
                                    <option value="">— Sin proveedor —</option>
                                    {suppliers.map(s => <option key={s.id} value={s.id}>{s.nombre}</option>)}
                                </select>
                            </div>
                            <div className="form-group" style={{ marginBottom:0 }}>
                                <label>Contenido del paquete ({newInsumo.unidad_medida || 'unidad'} por paquete)</label>
                                <input type="number" value={newInsumo.unidades_por_paquete}
                                    onChange={e => setNewInsumo(n => ({ ...n, unidades_por_paquete: e.target.value }))}
                                    placeholder={`Ej: 50 ${newInsumo.unidad_medida || 'unidad'} por bulto`}
                                    min="0.001" step="0.001" />
                                <small style={{ color:'var(--text-muted)', fontSize:'0.72rem', marginTop:4, display:'block' }}>
                                    Deja vacío si se compra suelto por {newInsumo.unidad_medida || 'unidad'}.
                                </small>
                            </div>
                        </div>

                        {/* Footer modal */}
                        <div style={{ display:'flex', gap:10, padding:'0 1.25rem 1.25rem' }}>
                            <button type="button" onClick={() => setShowNewInsumo(false)}
                                className="btn btn-secondary" style={{ flex:1 }}>
                                Cancelar
                            </button>
                            <button type="button" onClick={handleCreateInsumo} disabled={creatingInsumo}
                                className="btn btn-primary" style={{ flex:2, display:'flex', alignItems:'center', justifyContent:'center', gap:6 }}>
                                {creatingInsumo ? <Spinner /> : <Save size={14}/>}
                                {creatingInsumo ? 'Creando…' : `Crear insumo`}
                            </button>
                        </div>
                    </div>
                </div>
            , document.body)}

            {/* ══ MODAL CREAR PROVEEDOR ══ */}
            {showNewProveedor && createPortal(
                <div onClick={() => setShowNewProveedor(false)}
                    style={{ position:'fixed', inset:0, zIndex:9000,
                        background:'rgba(0,0,0,0.55)', display:'flex',
                        alignItems:'center', justifyContent:'center', padding:16 }}>
                    <div onClick={e => e.stopPropagation()}
                        style={{ background:'var(--bg-card)', borderRadius:14,
                            width:'100%', maxWidth:420,
                            boxShadow:'0 24px 64px rgba(0,0,0,0.4)',
                            border:'1px solid var(--border-default)', overflow:'hidden' }}>

                        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between',
                            padding:'1rem 1.25rem', borderBottom:'1px solid var(--border-subtle)',
                            background:'rgba(16,185,129,0.07)' }}>
                            <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                                <Truck size={16} style={{ color:'var(--success)' }}/>
                                <span style={{ fontWeight:700, fontSize:'0.95rem' }}>Nuevo proveedor</span>
                            </div>
                            <button type="button" onClick={() => setShowNewProveedor(false)}
                                style={{ background:'none', border:'none', cursor:'pointer',
                                    color:'var(--text-muted)', padding:4, display:'flex' }}>
                                <X size={18}/>
                            </button>
                        </div>

                        <div style={{ padding:'1.25rem', display:'flex', flexDirection:'column', gap:12 }}>
                            <div className="form-group" style={{ marginBottom:0 }}>
                                <label>Nombre *</label>
                                <input autoFocus value={newProv.nombre}
                                    onChange={e => setNewProv(p => ({ ...p, nombre: e.target.value }))}
                                    placeholder="Ej: Gases del Sur, Acueducto Bogotá"
                                    onKeyDown={e => e.key === 'Enter' && handleCreateProveedor()} />
                            </div>
                            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
                                <div className="form-group" style={{ marginBottom:0 }}>
                                    <label>Teléfono</label>
                                    <input value={newProv.telefono}
                                        onChange={e => setNewProv(p => ({ ...p, telefono: e.target.value }))}
                                        placeholder="Ej: 3001234567" />
                                </div>
                                <div className="form-group" style={{ marginBottom:0 }}>
                                    <label>Email</label>
                                    <input type="email" value={newProv.email}
                                        onChange={e => setNewProv(p => ({ ...p, email: e.target.value }))}
                                        placeholder="correo@ejemplo.com" />
                                </div>
                            </div>
                            <div className="form-group" style={{ marginBottom:0 }}>
                                <label>Dirección</label>
                                <input value={newProv.direccion}
                                    onChange={e => setNewProv(p => ({ ...p, direccion: e.target.value }))}
                                    placeholder="Opcional" />
                            </div>
                        </div>

                        <div style={{ display:'flex', gap:10, padding:'0 1.25rem 1.25rem' }}>
                            <button type="button" onClick={() => setShowNewProveedor(false)}
                                className="btn btn-secondary" style={{ flex:1 }}>
                                Cancelar
                            </button>
                            <button type="button" onClick={handleCreateProveedor} disabled={creatingProv}
                                className="btn btn-primary"
                                style={{ flex:2, display:'flex', alignItems:'center', justifyContent:'center', gap:6,
                                    background:'var(--success)', borderColor:'var(--success)' }}>
                                {creatingProv ? <Spinner /> : <Save size={14}/>}
                                {creatingProv ? 'Creando…' : 'Crear proveedor'}
                            </button>
                        </div>
                    </div>
                </div>
            , document.body)}

            {/* ══ HEADER ══ */}
            <div className="ef-header">
                <div className="ef-header-left">
                    <button type="button" onClick={() => navigate('/expenses')} className="btn btn-secondary"
                        style={{ width:36, height:36, padding:0, borderRadius:'var(--r-full)', flexShrink:0 }}>
                        <ArrowLeft size={17} />
                    </button>
                    <div style={{ minWidth:0 }}>
                        <h1>Nuevo Gasto</h1>
                        <p className="page-subtitle">Registra un egreso operativo</p>
                    </div>
                </div>
                <button type="button" onClick={handleSubmit} className="btn btn-primary" disabled={loading} style={{ flexShrink:0 }}>
                    {loading ? <Spinner /> : <Save size={16} />}
                    <span className="ef-save-label">Guardar</span>
                </button>
            </div>

            <form onSubmit={handleSubmit} style={{ display:'flex', flexDirection:'column', gap:'var(--sp-5)' }}>

                {/* ─── 1. Categoría ─── */}
                <SectionCard color="var(--info)" icon={<FileText size={13}/>} title="Categoría">
                    <div className="ef-cat-grid">
                        {categorias.map(cat => {
                            const active   = form.categoria_id === cat.id;
                            const isInsumo = cat.tipo === 'insumo';
                            const clr      = isInsumo ? 'var(--brand)' : 'var(--info)';
                            const bg       = isInsumo ? 'var(--brand-muted)' : 'var(--info-bg)';
                            const emoji    = getCatEmoji(cat.nombre);
                            return (
                                <button key={cat.id} type="button" className="ef-cat-btn"
                                    onClick={() => {
                                        set('categoria_id', cat.id);
                                        set('subcategoria_id', '');
                                        setLines([emptyLine()]);
                                        setShowNewInsumo(false);
                                    }}
                                    style={{
                                        display:'flex', flexDirection:'column', alignItems:'center', gap:4,
                                        padding:'10px 6px', borderRadius:'var(--r-md)',
                                        border:`1px solid ${active ? clr : 'var(--border-subtle)'}`,
                                        background: active ? bg : 'var(--bg-elevated)',
                                        color: active ? clr : 'var(--text-secondary)',
                                        fontFamily:'var(--font)', fontWeight: active ? 700 : 500,
                                        fontSize:'0.72rem', cursor:'pointer', transition:'all var(--transition)',
                                        lineHeight:1.2, minHeight:54, justifyContent:'center',
                                    }}>
                                    <span style={{ fontSize:'1.1rem', lineHeight:1 }}>{cat.icono || emoji}</span>
                                    {cat.nombre}
                                </button>
                            );
                        })}
                    </div>

                    {/* ─── Subcategoría (opcional, dinámica) ─── */}
                    {subcategorias.length > 0 && (
                        <div className="form-group" style={{ marginTop: 14, marginBottom: 0 }}>
                            <label style={{ display: 'block', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)', marginBottom: 6 }}>
                                Subcategoría <span style={{ color: 'var(--text-tertiary)', fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>(opcional)</span>
                            </label>
                            <select className="form-control"
                                value={form.subcategoria_id || ''}
                                onChange={e => set('subcategoria_id', e.target.value)}>
                                <option value="">— Sin subcategoría —</option>
                                {subcategorias.map(s => (
                                    <option key={s.id} value={s.id}>{s.icono ? `${s.icono} ` : ''}{s.nombre}</option>
                                ))}
                            </select>
                        </div>
                    )}

                    {/* ─── Sección Insumos múltiples ─── */}
                    {esInsumo && (
                        <div style={{
                            marginTop:16, padding:'1rem', borderRadius:10,
                            background:'rgba(139,92,246,0.06)', border:'1px solid rgba(139,92,246,0.25)',
                            display:'flex', flexDirection:'column', gap:14,
                        }}>
                            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:8 }}>
                                <p style={{ fontSize:'0.7rem', fontWeight:700, textTransform:'uppercase',
                                    letterSpacing:1, color:'var(--brand)', margin:0 }}>
                                    📦 Detalle de insumos → se registra en Inventario
                                </p>
                                <button type="button" onClick={() => setShowNewInsumo(true)}
                                    className="btn btn-secondary"
                                    style={{ height:30, padding:'0 10px', fontSize:'0.75rem', flexShrink:0,
                                        display:'flex', alignItems:'center', gap:4 }}>
                                    <Plus size={13}/> Crear Insumo
                                </button>
                            </div>

                            {/* Panel fecha + proveedor (cuando es insumo, van aquí) */}
                            <div className="ef-row-2">
                                <div className="form-group" style={{ marginBottom:0 }}>
                                    <label style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                                        Proveedor
                                        <button type="button" onClick={() => setShowNewProveedor(true)}
                                            style={{ background:'none', border:'none', cursor:'pointer',
                                                color:'var(--success)', fontSize:'0.72rem', fontWeight:700,
                                                display:'flex', alignItems:'center', gap:3, padding:0 }}>
                                            <Plus size={11}/> Nuevo
                                        </button>
                                    </label>
                                    <select value={form.proveedor_id} onChange={e => set('proveedor_id', e.target.value)}>
                                        <option value="">— Sin proveedor —</option>
                                        {suppliers.map(s => <option key={s.id} value={s.id}>{s.nombre}</option>)}
                                    </select>
                                </div>
                                <div><label style={{ display: 'block', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)', marginBottom: 6 }}>Fecha</label><DateInput value={form.fecha} onChange={v => set('fecha', v)} required height={42} /></div>
                            </div>

                            {/* ─── Aviso semántico ─── */}
                            <div style={{
                                padding:'0.55rem 0.75rem', borderRadius:8,
                                background:'rgba(59,130,246,0.08)', border:'1px solid rgba(59,130,246,0.25)',
                                fontSize:'0.72rem', color:'var(--text-secondary)', lineHeight:1.4,
                            }}>
                                <strong style={{ color:'#60a5fa' }}>ℹ️ Cómo registrar:</strong>{' '}
                                Para insumos con paquete (ej: bulto, caja), <strong>cantidad = nº de paquetes</strong> y <strong>vlr. unit. = precio por paquete</strong>.
                                Para insumos sueltos, cantidad = unidades base.
                            </div>

                            {/* ─── Tabla de líneas ─── */}
                            <table className="ins-table">
                                <thead>
                                    <tr>
                                        <th className="td-insumo">Insumo</th>
                                        <th className="td-cant">Cantidad</th>
                                        <th className="td-vu">Vlr. unit.</th>
                                        <th className="td-total">Total</th>
                                        <th className="td-del"></th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {lines.map((line) => {
                                        const insumoSel  = insumos.find(i => i.id === parseInt(line.insumo_id));
                                        const cant       = parseNum(line.cantidad);
                                        const vu         = parseNum(line.valor_unitario);
                                        const lineTotal  = cant * vu;
                                        const udsPorPaq  = Number(insumoSel?.unidades_por_paquete) || 0;
                                        const tienePaq   = udsPorPaq > 0;
                                        const unidadInput = tienePaq ? 'paquete' : (insumoSel?.unidad_medida || 'unidad');
                                        const stockEnPaq = tienePaq && insumoSel
                                            ? Number(insumoSel.cantidad_actual) / udsPorPaq
                                            : null;
                                        const cantBase   = tienePaq ? cant * udsPorPaq : cant;
                                        const cuBase     = tienePaq && udsPorPaq > 0 ? vu / udsPorPaq : vu;

                                        return (
                                            <tr key={line.id}>
                                                <td className="td-insumo">
                                                    <select value={line.insumo_id}
                                                        onChange={e => setLine(line.id, 'insumo_id', e.target.value)}
                                                        style={{ borderColor: line.insumo_id ? 'var(--brand)' : undefined,
                                                            fontSize:'0.82rem' }}>
                                                        <option value="">— Insumo —</option>
                                                        {insumos.map(i => (
                                                            <option key={i.id} value={i.id}>
                                                                {i.nombre} ({i.unidad_medida})
                                                            </option>
                                                        ))}
                                                    </select>
                                                    {insumoSel && (
                                                        <div style={{ fontSize:'0.68rem', color:'var(--text-muted)',
                                                            marginTop:2, paddingLeft:2 }}>
                                                            Stock: {Number(insumoSel.cantidad_actual).toFixed(1)} {insumoSel.unidad_medida}
                                                            {tienePaq && stockEnPaq !== null && (
                                                                <> · {stockEnPaq.toFixed(1)} paq</>
                                                            )}
                                                        </div>
                                                    )}
                                                    {insumoSel && tienePaq && (
                                                        <div style={{ fontSize:'0.66rem', color:'#60a5fa',
                                                            marginTop:1, paddingLeft:2, fontWeight:600 }}>
                                                            1 paquete = {udsPorPaq} {insumoSel.unidad_medida}
                                                        </div>
                                                    )}
                                                </td>
                                                <td className="td-cant">
                                                    <input type="number" value={line.cantidad}
                                                        onChange={e => setLine(line.id, 'cantidad', e.target.value)}
                                                        placeholder={tienePaq ? '# paq' : '0'}
                                                        min="0.01" step="0.01"
                                                        style={{ fontSize:'0.85rem' }} />
                                                    {insumoSel && (
                                                        <div style={{ fontSize:'0.65rem', color:'var(--text-muted)', marginTop:2, paddingLeft:2 }}>
                                                            {unidadInput}{cant > 1 && tienePaq ? 's' : ''}
                                                            {tienePaq && cant > 0 && (
                                                                <span style={{ color:'#22c55e', fontWeight:600 }}>
                                                                    {' '}= {cantBase.toFixed(1)} {insumoSel.unidad_medida}
                                                                </span>
                                                            )}
                                                        </div>
                                                    )}
                                                </td>
                                                <td className="td-vu">
                                                    <input type="number" value={line.valor_unitario}
                                                        onChange={e => setLine(line.id, 'valor_unitario', e.target.value)}
                                                        placeholder={tienePaq ? '$ / paq' : '$ / ud'}
                                                        min="0" max="50000000" step="1"
                                                        style={{ fontSize:'0.85rem' }} />
                                                    {insumoSel && vu > 0 && tienePaq && (
                                                        <div style={{ fontSize:'0.65rem', color:'var(--text-muted)', marginTop:2, paddingLeft:2 }}>
                                                            = ${new Intl.NumberFormat('es-CO').format(Math.round(cuBase))}/{insumoSel.unidad_medida}
                                                        </div>
                                                    )}
                                                </td>
                                                <td className="td-total">
                                                    <div style={{ fontSize:'0.85rem', fontWeight:600,
                                                        color: lineTotal > 0 ? 'white' : 'var(--text-muted)',
                                                        paddingTop:8, textAlign:'right', fontVariantNumeric:'tabular-nums' }}>
                                                        {lineTotal > 0
                                                            ? `$${new Intl.NumberFormat('es-CO').format(lineTotal)}`
                                                            : '—'}
                                                    </div>
                                                </td>
                                                <td className="td-del">
                                                    <button type="button"
                                                        onClick={() => removeLine(line.id)}
                                                        disabled={lines.length === 1}
                                                        style={{ background:'none', border:'none', cursor: lines.length === 1 ? 'not-allowed' : 'pointer',
                                                            color: lines.length === 1 ? 'var(--text-muted)' : 'var(--danger)',
                                                            padding:4, borderRadius:4, opacity: lines.length === 1 ? 0.3 : 1 }}>
                                                        <Trash2 size={14}/>
                                                    </button>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>

                            {/* Botón agregar línea */}
                            <button type="button" onClick={addLine}
                                style={{ display:'flex', alignItems:'center', gap:6, background:'none',
                                    border:'1px dashed rgba(139,92,246,0.4)', borderRadius:8,
                                    padding:'8px 12px', cursor:'pointer', color:'var(--brand)',
                                    fontSize:'0.82rem', fontWeight:600, width:'100%', justifyContent:'center',
                                    transition:'background 0.15s' }}
                                onMouseEnter={e => e.currentTarget.style.background='rgba(139,92,246,0.08)'}
                                onMouseLeave={e => e.currentTarget.style.background='none'}>
                                <Plus size={14}/> Agregar otro insumo
                            </button>

                            {/* Total */}
                            {totalLines > 0 && (
                                <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between',
                                    padding:'0.6rem 0.85rem', borderRadius:8,
                                    background:'rgba(139,92,246,0.18)', border:'1px solid rgba(139,92,246,0.4)' }}>
                                    <span style={{ display:'flex', alignItems:'center', gap:8 }}>
                                        <Package size={15} style={{ color:'var(--brand)' }}/>
                                        <span style={{ fontSize:'0.82rem', color:'var(--text-muted)' }}>
                                            {lines.length} insumo{lines.length !== 1 ? 's' : ''} · Total
                                        </span>
                                    </span>
                                    <strong style={{ fontSize:'1.05rem', color:'white', letterSpacing:'-0.01em' }}>
                                        ${new Intl.NumberFormat('es-CO').format(totalLines)}
                                    </strong>
                                </div>
                            )}
                        </div>
                    )}
                </SectionCard>

                {/* ─── 2. Valor del gasto (solo si NO es insumo) ─── */}
                {!esInsumo && (
                    <SectionCard color="var(--brand)" icon={<Tag size={13}/>} title="Valor del gasto">
                        <div className="form-group">
                            <label htmlFor="ef-valor">Valor total *</label>
                            <ValorInput
                                id="ef-valor"
                                value={fmtValor(form.valorSimple)}
                                onChange={e => set('valorSimple', e.target.value.replace(/\D/g, ''))}
                                hasValue={!!form.valorSimple}
                            />
                        </div>

                        {/* ── Campos extra para Servicios Públicos ── */}
                        {esServicio && (
                            <div style={{ marginTop: 16, padding: '14px 16px', borderRadius: 10,
                                background: 'rgba(255,221,25,0.06)', border: '1px solid rgba(255,221,25,0.25)',
                                display: 'flex', flexDirection: 'column', gap: 14 }}>

                                {/* Tipo de servicio */}
                                <div>
                                    <p style={{ fontSize: '0.68rem', fontWeight: 700, textTransform: 'uppercase',
                                        letterSpacing: 1, color: '#ffdd19', marginBottom: 10 }}>
                                        💡 Detalle del servicio → genera factura de costo automáticamente
                                    </p>
                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(90px, 1fr))', gap: 8 }}>
                                        {[
                                            { v: 'gas',  label: 'Gas',   icon: Flame,    color: '#f97316', unit: 'm³' },
                                            { v: 'agua', label: 'Agua',  icon: Droplets, color: '#3b82f6', unit: 'm³' },
                                            { v: 'luz',  label: 'Luz',   icon: Zap,      color: '#ffdd19', unit: 'kWh' },
                                            { v: 'otro', label: 'Otro',  icon: Layers,   color: '#8b5cf6', unit: '—' },
                                        ].map(({ v, label, icon: Icon, color, unit }) => {
                                            const active = servicioTipo === v;
                                            return (
                                                <button key={v} type="button"
                                                    onClick={() => { setServicioTipo(v); setServicioConsumo(''); }}
                                                    style={{ display: 'flex', flexDirection: 'column', alignItems: 'center',
                                                        gap: 5, padding: '10px 6px', borderRadius: 10,
                                                        border: `1.5px solid ${active ? color : 'var(--border-subtle)'}`,
                                                        background: active ? `${color}18` : 'var(--bg-elevated)',
                                                        color: active ? color : 'var(--text-secondary)',
                                                        cursor: 'pointer', fontWeight: active ? 800 : 500,
                                                        fontSize: '0.75rem', transition: 'all 0.15s' }}>
                                                    <Icon size={18} />
                                                    {label}
                                                    <span style={{ fontSize: '0.62rem', opacity: 0.7 }}>{unit}</span>
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>

                                {/* Consumo */}
                                <div className="form-group" style={{ marginBottom: 0 }}>
                                    <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                        Consumo ({servicioTipo === 'luz' ? 'kWh' : 'm³'})
                                        <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', fontWeight: 400 }}>
                                            — opcional, permite calcular costo unitario
                                        </span>
                                    </label>
                                    <input type="number" step="0.001" min="0"
                                        value={servicioConsumo}
                                        onChange={e => setServicioConsumo(e.target.value)}
                                        placeholder={`Ej: ${servicioTipo === 'agua' ? '50' : servicioTipo === 'gas' ? '100' : servicioTipo === 'luz' ? '800' : '—'}`} />
                                </div>

                                {/* Preview costo unitario */}
                                {form.valorSimple && servicioConsumo && parseFloat(servicioConsumo) > 0 && (
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                        padding: '10px 14px', background: 'rgba(255,221,25,0.1)',
                                        border: '1px solid rgba(255,221,25,0.3)', borderRadius: 8 }}>
                                        <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                                            Costo unitario calculado:
                                        </span>
                                        <strong style={{ fontSize: 15, color: '#ffdd19' }}>
                                            ${new Intl.NumberFormat('es-CO').format(
                                                Math.round(parseNum(form.valorSimple) / parseFloat(servicioConsumo))
                                            )} / {servicioTipo === 'luz' ? 'kWh' : 'm³'}
                                        </strong>
                                    </div>
                                )}
                            </div>
                        )}

                        <div className="ef-row-2" style={{ marginTop: 14 }}>
                            <div className="form-group" style={{ marginBottom:0 }}>
                                <label style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                                    Proveedor
                                    <button type="button" onClick={() => setShowNewProveedor(true)}
                                        style={{ background:'none', border:'none', cursor:'pointer',
                                            color:'var(--success)', fontSize:'0.72rem', fontWeight:700,
                                            display:'flex', alignItems:'center', gap:3, padding:0 }}>
                                        <Plus size={11}/> Nuevo
                                    </button>
                                </label>
                                <select value={form.proveedor_id} onChange={e => set('proveedor_id', e.target.value)}>
                                    <option value="">— Sin proveedor —</option>
                                    {suppliers.map(s => <option key={s.id} value={s.id}>{s.nombre}</option>)}
                                </select>
                            </div>
                            <div><label style={{ display: 'block', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)', marginBottom: 6 }}>Fecha</label><DateInput value={form.fecha} onChange={v => set('fecha', v)} required height={42} /></div>
                        </div>
                    </SectionCard>
                )}

                {/* ─── 3. Estado de Pago ─── */}
                <SectionCard color="var(--success)" icon={<Wallet size={13}/>} title="Estado de pago">
                    <div className="form-group">
                        <div className="ef-estado">
                            {ESTADO_PAGO_OPTIONS.map(opt => {
                                const Icon   = opt.icon;
                                const active = form.estado_pago === opt.value;
                                const clr    = opt.value === 'pagado' ? 'var(--success)' : 'var(--danger)';
                                const bg     = opt.value === 'pagado' ? 'var(--success-bg)' : 'var(--danger-bg)';
                                const brd    = opt.value === 'pagado' ? 'rgba(34,197,94,0.35)' : 'rgba(244,63,94,0.35)';
                                return (
                                    <button key={opt.value} type="button"
                                        onClick={() => { set('estado_pago', opt.value); if (opt.value==='credito') set('medio_pago_id',''); }}
                                        style={{ flex:1, display:'flex', alignItems:'center', gap:'var(--sp-3)',
                                            padding:'var(--sp-4)', borderRadius:'var(--r-md)',
                                            border:`1px solid ${active ? brd : 'var(--border-subtle)'}`,
                                            background: active ? bg : 'var(--bg-elevated)',
                                            color: active ? clr : 'var(--text-secondary)',
                                            fontFamily:'var(--font)', cursor:'pointer',
                                            transition:'all var(--transition)', textAlign:'left', minHeight:56 }}>
                                        <Icon size={20} style={{ flexShrink:0 }}/>
                                        <div>
                                            <div style={{ fontWeight:700, fontSize:'0.875rem', lineHeight:1.2 }}>{opt.label}</div>
                                            <div style={{ fontSize:'0.69rem', opacity:0.72, marginTop:2, fontWeight:400 }}>{opt.desc}</div>
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                    {form.estado_pago === 'pagado' && (
                        <div className="form-group" style={{ marginBottom:0, padding:'var(--sp-4)',
                            background:'var(--bg-base)', borderRadius:'var(--r-md)',
                            border:'1px solid var(--border-subtle)', animation:'fadeIn 150ms ease' }}>
                            <label style={{ display:'flex', alignItems:'center', gap:'var(--sp-2)' }}>
                                <DollarSign size={14} style={{ color:'var(--brand)', flexShrink:0 }}/>
                                Medio de pago *
                            </label>
                            <select value={form.medio_pago_id} onChange={e => set('medio_pago_id', e.target.value)}
                                required={form.estado_pago==='pagado'}>
                                <option value="">— Selecciona el medio —</option>
                                {paymentMethods.map(m => <option key={m.id} value={m.id}>{m.nombre}</option>)}
                            </select>
                        </div>
                    )}
                </SectionCard>

                {/* ─── 4. Observaciones ─── */}
                <div className="card">
                    <div className="form-group" style={{ marginBottom:0 }}>
                        <label>Observaciones</label>
                        <textarea value={form.observaciones} onChange={e => set('observaciones', e.target.value)}
                            placeholder="Número de factura, referencia, acuerdos..." rows={3} />
                    </div>
                </div>

                {/* ─── Resumen ─── */}
                {valorResumen > 0 && (
                    <div style={{ padding:'var(--sp-4) var(--sp-5)', background:'var(--brand-muted)',
                        border:'1px solid var(--border-brand)', borderRadius:'var(--r-md)', animation:'fadeIn 200ms ease' }}>
                        <div className="ef-summary">
                            <div style={{ minWidth:0 }}>
                                <p style={{ fontSize:'0.72rem', color:'var(--text-tertiary)', marginBottom:3,
                                    overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                                    {getCatEmoji(catActual?.nombre)} {catActual?.nombre}
                                    {esInsumo && lines.length > 1 && (
                                        <span> · {lines.length} insumos</span>
                                    )}
                                    {' · '}{form.estado_pago === 'pagado' ? '✅ Pagado' : '⏳ Crédito'}
                                </p>
                            </div>
                            <div className="ef-summary-val" style={{ fontSize:'1.375rem', fontWeight:800,
                                color:'var(--brand)', letterSpacing:'-0.02em', fontVariantNumeric:'tabular-nums' }}>
                                ${new Intl.NumberFormat('es-CO').format(valorResumen)}
                            </div>
                        </div>
                    </div>
                )}

                <button type="submit" className="btn btn-primary btn-lg w-full" disabled={loading}
                    style={{ marginBottom:'var(--sp-8)' }}>
                    {loading ? <><Spinner /> Guardando...</> : <><Save size={18} /> Guardar Gasto</>}
                </button>
            </form>
        </div>
    );
}

// ── Sub-componentes ───────────────────────────────────────────────────────────
function SectionCard({ color, icon, title, children }) {
    return (
        <div className="card" style={{ borderTop:`3px solid ${color}`, paddingTop:'var(--sp-5)' }}>
            <p style={{ fontSize:'0.68rem', fontWeight:700, letterSpacing:'0.1em',
                textTransform:'uppercase', color, marginBottom:'var(--sp-5)',
                display:'flex', alignItems:'center', gap:'var(--sp-2)' }}>
                {icon} {title}
            </p>
            {children}
        </div>
    );
}

function ValorInput({ id, value, onChange, hasValue }) {
    return (
        <div style={{ display:'flex', alignItems:'center', gap:'var(--sp-3)', height:52,
            padding:'0 var(--sp-4)', background:'var(--bg-elevated)',
            border:'1px solid var(--border-default)', borderRadius:'var(--r-md)',
            transition:'border-color var(--transition), box-shadow var(--transition)' }}
            onFocusCapture={e => { e.currentTarget.style.borderColor='var(--brand)'; e.currentTarget.style.boxShadow='0 0 0 3px var(--brand-muted)'; }}
            onBlurCapture={e => { e.currentTarget.style.borderColor='var(--border-default)'; e.currentTarget.style.boxShadow='none'; }}>
            <span style={{ fontSize:'1.2rem', fontWeight:800, color:'var(--success)', lineHeight:1 }}>$</span>
            <input id={id} inputMode="numeric" value={value} onChange={onChange} placeholder="0" required
                style={{ flex:1, height:'100%', background:'transparent', border:'none', outline:'none',
                    fontSize:'1.5rem', fontWeight:800, color:'var(--text-primary)',
                    fontVariantNumeric:'tabular-nums', letterSpacing:'-0.02em', minWidth:0 }} />
            {hasValue && <span style={{ fontSize:'0.72rem', color:'var(--text-tertiary)', flexShrink:0 }}>COP</span>}
        </div>
    );
}

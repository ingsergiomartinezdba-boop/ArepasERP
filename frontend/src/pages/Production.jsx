import React, { useState, useEffect, useMemo } from 'react';
import {
    productionService, productsService, inventoryService,
    insumosService, ordersService,
} from '../services/api';
import {
    FlaskConical, Layers, Plus, Trash2, RefreshCw, X, Save,
    ChevronRight, DollarSign, Package, Calculator, Edit2,
    ArrowRight, Wheat, ShoppingBag, AlertTriangle, CheckCircle,
    Info, ChevronDown, ChevronUp, Play, BookOpen, Calendar,
} from 'lucide-react';
import { toast } from 'sonner';

// ── Formatters ────────────────────────────────────────────────────────────────
import { UNIDADES, GRUPOS, convertir, toKg as _toKg, FMT_KG } from '../utils/units';
import { formatDateTime, todayBogota, toDateBogota } from '../utils/formatters';
import DateInput from '../components/DateInput';

// YYYY-MM-DD del input → ISO anclado a mediodía Bogotá para no perder el día
// al pasar por timestamptz (UTC) en el backend.
const fechaToIsoBogota = (yyyyMmDd) => (yyyyMmDd ? `${yyyyMmDd}T12:00:00-05:00` : null);

const FMT_COP = (n) => `$${Number(n).toLocaleString('es-CO', { minimumFractionDigits: 0 })}`;
const round2  = (n) => Math.round(n * 100) / 100;

// ─────────────────────────────────────────────────────────────────────────────
export default function Production() {
    const [tab, setTab]               = useState('cocciones');
    const [productos, setProductos]   = useState([]);
    const [insumos, setInsumos]       = useState([]);
    const [stock, setStock]           = useState({});
    const [recetas, setRecetas]       = useState([]);
    const [cocciones, setCocciones]   = useState([]);
    const [detalles, setDetalles]     = useState([]);
    const [lotes, setLotes]           = useState([]);
    const [pedidos, setPedidos]       = useState([]);
    const [prodInsumos, setProdInsumos] = useState([]);  // todas las filas producto_insumos
    const [loading, setLoading]       = useState(true);

    const [modal, setModal]           = useState(null);  // 'receta' | 'coccion' | 'produccion' | 'lote'
    const [editReceta, setEditReceta] = useState(null);  // receta a editar (null = nueva)
    const [form, setForm]             = useState({});
    const [saving, setSaving]         = useState(false);
    const [deleting, setDeleting]     = useState(null);

    useEffect(() => { loadAll(); }, []);

    const loadAll = async () => {
        setLoading(true);
        try {
            const [recRes, cocRes, detRes, lotRes, prodRes, invRes, insRes, pedRes, piRes] =
                await Promise.allSettled([
                    productionService.getRecetas(false),
                    productionService.getCocciones({ limit: 100 }),
                    productionService.getDetalles({ limit: 100 }),
                    productionService.getLotes({ limit: 100 }),
                    productsService.getAll(false),
                    inventoryService.getAll(),
                    insumosService.getAll(true),
                    ordersService.getAll({ estado: 'pendiente,por_cobrar', limit: 100 }),
                    productsService.getAllInsumos(),
                ]);
            if (recRes.status === 'fulfilled') setRecetas(recRes.value.data);
            if (cocRes.status === 'fulfilled') setCocciones(cocRes.value.data);
            if (detRes.status === 'fulfilled') setDetalles(detRes.value.data);
            if (lotRes.status === 'fulfilled') setLotes(lotRes.value.data);
            if (prodRes.status === 'fulfilled') setProductos(prodRes.value.data);
            if (invRes.status === 'fulfilled') {
                const m = {};
                invRes.value.data.forEach(r => { m[r.producto_id] = Number(r.cantidad); });
                setStock(m);
            }
            if (insRes.status === 'fulfilled') setInsumos(insRes.value.data);
            if (pedRes.status === 'fulfilled') setPedidos(pedRes.value.data || []);
            if (piRes.status === 'fulfilled') setProdInsumos(piRes.value.data || []);
        } catch {
            toast.error('Error cargando producción');
        } finally {
            setLoading(false);
        }
    };

    // ── Cálculo demanda pendiente ─────────────────────────────────────────────
    // Pedidos pendientes = aún no producidos (necesitan masa)
    const pedidosPendientes = useMemo(() =>
        pedidos.filter(o => o.estado === 'pendiente'),
    [pedidos]);

    // IDs de insumos clasificados como "masa" (los que son salida de alguna receta)
    const idsMasaInsumos = useMemo(() => {
        const ids = new Set();
        recetas.forEach(r => { if (r.insumo_salida_id) ids.add(r.insumo_salida_id); });
        return ids;
    }, [recetas]);

    // Mapa: producto_id → kg de masa que consume por unidad
    // (suma de cantidades de producto_insumos cuyo insumo está en idsMasaInsumos)
    const masaKgPorProducto = useMemo(() => {
        const mapa = {};
        prodInsumos.forEach(pi => {
            if (idsMasaInsumos.has(pi.insumo_id)) {
                mapa[pi.producto_id] = (mapa[pi.producto_id] || 0) + Number(pi.cantidad || 0);
            }
        });
        return mapa;
    }, [prodInsumos, idsMasaInsumos]);

    const demandaPorProducto = useMemo(() => {
        const mapa = {};
        pedidosPendientes.forEach(o => {
            (o.items || []).forEach(item => {
                const prod = productos.find(p => p.id === item.producto_id);
                if (!prod) return;
                const masaPorUd = masaKgPorProducto[prod.id] || 0;
                if (!mapa[prod.id]) mapa[prod.id] = { id: prod.id, nombre: prod.nombre, masa_por_ud: masaPorUd, unidades: 0, masa_kg: 0 };
                mapa[prod.id].unidades += item.cantidad;
                mapa[prod.id].masa_kg  += item.cantidad * masaPorUd;
            });
        });
        return Object.values(mapa).sort((a, b) => b.masa_kg - a.masa_kg);
    }, [pedidosPendientes, productos, masaKgPorProducto]);

    const masaComprometida = useMemo(() => demandaPorProducto.reduce((s, d) => s + d.masa_kg, 0), [demandaPorProducto]);

    // Stock total de masa = SUM(cantidad_actual) de insumos clasificados como masa.
    // Este valor YA refleja el balance neto: cocciones suman, lotes de
    // producción descuentan vía movimientos_insumos. No restar consumo de
    // pedidos por_cobrar — eso sería doble conteo.
    const stockMasaTotal = useMemo(() =>
        insumos
            .filter(i => idsMasaInsumos.has(i.id))
            .reduce((s, i) => s + Number(i.cantidad_actual || 0), 0),
    [insumos, idsMasaInsumos]);
    // Masa disponible HOY = stock real del insumo (no se descuenta histórico)
    const masaRestante = stockMasaTotal;
    // Sobrante después de cubrir pedidos pendientes (libre para nuevos pedidos)
    const masaLibre = masaRestante - masaComprometida;

    const { masaCocinadaHoy, coccionesHoy } = useMemo(() => {
        const hoy = new Date().toDateString();
        const hoyItems = cocciones.filter(c => new Date(c.fecha).toDateString() === hoy);
        return {
            masaCocinadaHoy: hoyItems.reduce((s, c) => s + Number(c.masa_obtenida_kg), 0),
            coccionesHoy: hoyItems.length,
        };
    }, [cocciones]);

    const avgCosto = useMemo(() => {
        const total = lotes.reduce((s, l) => s + Number(l.costo_total || 0), 0);
        const uds   = lotes.reduce((s, l) => s + Number(l.cantidad_producida || 0), 0);
        return uds > 0 ? total / uds : 0;
    }, [lotes]);

    // ── Abrir modales ─────────────────────────────────────────────────────────
    const openNuevaReceta = () => {
        setEditReceta(null);
        setForm({
            nombre: '', descripcion: '',
            insumo_salida_id: '',
            rendimiento: 180,            // % — masa = insumo_base × rendimiento/100
            masa_salida_kg: '',          // calculado automáticamente o manual
            lineas: [{ insumo_id: '', cantidad: '', unidad: '', es_base: true }],
        });
        setModal('receta');
    };
    const openEditarReceta = (r) => {
        setEditReceta(r);
        // Estimar rendimiento desde masa_salida_kg y primer insumo en kg
        const lineas = r.insumos.map((i, idx) => ({ insumo_id: i.insumo_id, cantidad: i.cantidad, unidad: i.unidad, es_base: idx === 0 }));
        const baseLinea = lineas[0];
        let rendimiento = 180;
        if (baseLinea && r.masa_salida_kg) {
            const cantKg = _toKg(Number(baseLinea.cantidad), baseLinea.unidad);
            if (cantKg > 0) {
                rendimiento = round2((Number(r.masa_salida_kg) / cantKg) * 100);
            }
        }
        setForm({
            nombre: r.nombre,
            descripcion: r.descripcion || '',
            insumo_salida_id: r.insumo_salida_id || '',
            rendimiento,
            masa_salida_kg: r.masa_salida_kg,
            lineas,
        });
        setModal('receta');
    };
    const openEjecutarCoccion = (receta) => {
        if (!receta) { toast.error('Selecciona una receta primero'); return; }
        setForm({
            receta_id: receta.id,
            receta,       // objeto completo para preview
            bultos: 1,
            masa_obtenida_kg: '',
            observaciones: '',
            fecha: todayBogota(),
        });
        setModal('coccion');
    };
    const openProduccion = () => {
        setForm({ producto_consumido_id: '', cantidad_consumida_kg: '', producto_final_id: '', cantidad_producida: '', observaciones: '' });
        setModal('produccion');
    };
    const openLote = () => {
        setForm({ producto_final_id: '', cantidad_producida: '', observaciones: '', lineas: [{ insumo_id: '', cantidad: '', unidad_consumo: '' }] });
        setModal('lote');
    };

    // ── Guardar ───────────────────────────────────────────────────────────────
    const handleSave = async () => {
        setSaving(true);
        try {
            if (modal === 'receta') {
                const { nombre, descripcion, insumo_salida_id, rendimiento, masa_salida_kg, lineas } = form;
                if (!nombre.trim()) return toast.error('Ingresa el nombre de la receta');
                const lineasValidas = (lineas || []).filter(l => l.insumo_id && l.cantidad && Number(l.cantidad) > 0);
                if (!lineasValidas.length) return toast.error('Agrega al menos un insumo');
                if (!insumo_salida_id) return toast.error('Selecciona el insumo de masa de salida');

                // Usar masa_salida_kg del formulario (mantenida sincronizada con el % rendimiento).
                // Si no está definida, calcular desde el insumo base × rendimiento%.
                const insumoBase = lineasValidas.find(l => l.es_base) || lineasValidas[0];
                let masaKgCalculada = Number(masa_salida_kg) || 0;
                if (masaKgCalculada <= 0 && insumoBase && rendimiento) {
                    const cantKg = _toKg(Number(insumoBase.cantidad), insumoBase.unidad);
                    if (cantKg > 0) {
                        masaKgCalculada = round2(cantKg * (Number(rendimiento) / 100));
                    }
                }
                if (masaKgCalculada <= 0) return toast.error('No se pudo calcular la masa de salida. Verifica el insumo base y el rendimiento.');

                const payload = {
                    nombre: nombre.trim(),
                    descripcion: descripcion || null,
                    insumo_salida_id: Number(insumo_salida_id),
                    masa_salida_kg: masaKgCalculada,
                    insumos: lineasValidas.map(l => ({
                        insumo_id: Number(l.insumo_id),
                        cantidad:  Number(l.cantidad),
                        unidad:    l.unidad,
                    })),
                };
                if (editReceta) {
                    await productionService.actualizarReceta(editReceta.id, payload);
                    toast.success('Receta actualizada');
                } else {
                    await productionService.crearReceta(payload);
                    toast.success('Receta creada');
                }

            } else if (modal === 'coccion') {
                const { receta_id, bultos, masa_obtenida_kg, observaciones, fecha } = form;
                const nBultos = Number(bultos) || 1;
                if (nBultos <= 0) return toast.error('La cantidad de bultos debe ser mayor a 0');
                await productionService.ejecutarCoccion({
                    receta_id: Number(receta_id),
                    bultos: nBultos,
                    masa_obtenida_kg: masa_obtenida_kg ? Number(masa_obtenida_kg) : null,
                    observaciones: observaciones || null,
                    fecha: fechaToIsoBogota(fecha),
                });
                toast.success('Cocción registrada');

            } else if (modal === 'produccion') {
                const { producto_consumido_id, cantidad_consumida_kg, producto_final_id, cantidad_producida, observaciones } = form;
                if (!producto_consumido_id || !producto_final_id) return toast.error('Selecciona los productos');
                if (!cantidad_consumida_kg || !cantidad_producida) return toast.error('Ingresa las cantidades');
                await productionService.crearDetalle({
                    producto_consumido_id: Number(producto_consumido_id),
                    cantidad_consumida_kg: Number(cantidad_consumida_kg),
                    producto_final_id:     Number(producto_final_id),
                    cantidad_producida:    Number(cantidad_producida),
                    observaciones: observaciones || null,
                });
                toast.success('Producción registrada');

            } else {
                // lote
                const { producto_final_id, cantidad_producida, observaciones, lineas } = form;
                if (!cantidad_producida || Number(cantidad_producida) <= 0) return toast.error('Ingresa la cantidad producida');
                const lineasValidas = (lineas || []).filter(l => l.insumo_id && l.cantidad && Number(l.cantidad) > 0);
                if (!lineasValidas.length) return toast.error('Agrega al menos un insumo');
                await productionService.crearLote({
                    producto_final_id: producto_final_id ? Number(producto_final_id) : null,
                    cantidad_producida: Number(cantidad_producida),
                    observaciones: observaciones || null,
                    insumos: lineasValidas.map(l => ({
                        insumo_id:      Number(l.insumo_id),
                        cantidad:       Number(l.cantidad),
                        unidad_consumo: l.unidad_consumo || null,
                    })),
                });
                toast.success('Lote registrado');
            }

            setModal(null);
            loadAll();
        } catch (e) {
            toast.error(e.response?.data?.detail || 'Error al guardar');
        } finally {
            setSaving(false);
        }
    };

    const handleEditarFechaCoccion = async (id, yyyyMmDd) => {
        try {
            await productionService.actualizarCoccion(id, { fecha: fechaToIsoBogota(yyyyMmDd) });
            toast.success('Fecha actualizada');
            await loadAll();
        } catch (e) {
            toast.error(e.response?.data?.detail || 'Error al actualizar fecha');
            throw e;
        }
    };

    const handleDelete = async (id, tipo) => {
        const msgs = {
            receta:    '¿Eliminar esta receta?',
            coccion:   '¿Eliminar esta cocción? Se revertirán los insumos y la masa.',
            detalle:   '¿Eliminar esta producción? Se revertirá el inventario.',
            lote:      '¿Eliminar este lote? Se revertirán los insumos.',
        };
        if (!confirm(msgs[tipo] || '¿Eliminar?')) return;
        setDeleting(id + tipo);
        try {
            if (tipo === 'receta')  await productionService.eliminarReceta(id);
            else if (tipo === 'coccion')  await productionService.eliminarCoccion(id);
            else if (tipo === 'detalle') await productionService.eliminarDetalle(id);
            else await productionService.eliminarLote(id);
            toast.success('Registro eliminado');
            loadAll();
        } catch (e) {
            toast.error(e.response?.data?.detail || 'Error al eliminar', { duration: 6000 });
        } finally {
            setDeleting(null);
        }
    };

    const formatDate = (d) => d ? formatDateTime(d) : '—';

    if (loading) return <div className="page-container"><div className="loading-state">Cargando producción…</div></div>;

    const TABS = [
        { key: 'cocciones',  label: 'Cocciones',    icon: FlaskConical, count: cocciones.length },
        { key: 'produccion', label: 'Masa → Arepas', icon: Layers,       count: detalles.length },
    ];

    return (
        <div className="page-container">
            {/* ── Header ──────────────────────────────────────────────────── */}
            <div className="page-header">
                <div>
                    <h1 className="page-title">Producción</h1>
                    <p className="page-subtitle">Recetas, cocción, elaboración y costos</p>
                </div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    <button className="btn btn-secondary" onClick={loadAll}><RefreshCw size={15} /> Actualizar</button>
                    {tab === 'cocciones' && (
                        <>
                            <button className="btn btn-secondary" onClick={openNuevaReceta}><BookOpen size={15} /> Nueva Receta</button>
                            {recetas.filter(r => r.activa).length > 0 && (
                                <button className="btn btn-primary" style={{ background: '#ffdd19', borderColor: '#ffdd19' }}
                                    onClick={() => openEjecutarCoccion(recetas.filter(r => r.activa)[0])}>
                                    <Play size={15} /> Registrar Cocción
                                </button>
                            )}
                        </>
                    )}
                    {tab === 'produccion' && (
                        <button className="btn btn-primary" onClick={openProduccion}><Layers size={15} /> Registrar Producción</button>
                    )}
                </div>
            </div>

            {/* ── Flujo de Masa ────────────────────────────────────────────── */}
            {/* Flujo masa */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 28px 1fr', gap: 6, alignItems: 'stretch' }}>
                <FlowCard
                    icon={<FlaskConical size={18} />} accent="#a78bfa"
                    title="Masa disponible"
                    value={FMT_KG(stockMasaTotal)}
                    unit=""
                    sub={`Stock actual del insumo Masa · ${coccionesHoy} cocción${coccionesHoy !== 1 ? 'es' : ''} hoy`}
                />
                <ArrowCard />
                <FlowCard
                    icon={<ShoppingBag size={18} />} accent={masaLibre >= 0 ? '#ffdd19' : '#f87171'}
                    title="Masa necesaria"
                    value={FMT_KG(masaComprometida)}
                    unit=""
                    sub={`${pedidosPendientes.length} pedido${pedidosPendientes.length !== 1 ? 's' : ''} por despachar`}
                    alert={masaLibre < 0
                        ? { text: `Déficit ${FMT_KG(Math.abs(masaLibre))}`, danger: true }
                        : { text: `Sobran ${FMT_KG(masaLibre)}`, danger: false }}
                />
            </div>


            {/* ── Tabs ─────────────────────────────────────────────────────── */}
            <div style={{
                display: 'flex', gap: 2, marginBottom: 20,
                background: 'var(--bg-secondary)', borderRadius: 10,
                padding: 4, flexWrap: 'wrap',
            }}>
                {TABS.map(({ key, label, icon: Icon, count }) => (
                    <button key={key} onClick={() => setTab(key)}
                        style={{
                            display: 'flex', alignItems: 'center', gap: 6,
                            padding: '7px 14px', borderRadius: 8, fontSize: 13, fontWeight: 600,
                            border: 'none', cursor: 'pointer', transition: 'all 0.15s',
                            background: tab === key ? 'var(--brand)' : 'transparent',
                            color: tab === key ? '#fff' : 'var(--text-secondary)',
                            flex: '1 1 auto',
                            justifyContent: 'center',
                        }}>
                        <Icon size={14} /> {label}
                        <span style={{
                            background: tab === key ? 'rgba(255,255,255,0.2)' : 'var(--bg-tertiary)',
                            borderRadius: 20, padding: '1px 7px', fontSize: 11, fontWeight: 700,
                        }}>{count}</span>
                    </button>
                ))}
            </div>

            {/* ── Contenido del tab activo ──────────────────────────────────── */}
            {tab === 'cocciones' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
                    {/* Recetas integradas */}
                    <TabRecetas
                        recetas={recetas}
                        insumos={insumos}
                        deleting={deleting}
                        onEjecutar={openEjecutarCoccion}
                        onEditar={openEditarReceta}
                        onEliminar={(id) => handleDelete(id, 'receta')}
                        onNueva={openNuevaReceta}
                    />
                    {/* Historial de cocciones */}
                    <div>
                        <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                            Historial de cocciones registradas
                        </div>
                        <TablaCocciones
                            cocciones={cocciones}
                            deleting={deleting}
                            onDelete={(id) => handleDelete(id, 'coccion')}
                            formatDate={formatDate}
                            onEjecutar={() => openEjecutarCoccion(recetas.filter(r => r.activa)[0] || recetas[0])}
                            onEditarReceta={openEditarReceta}
                            onEditarFecha={handleEditarFechaCoccion}
                            recetas={recetas}
                        />
                    </div>
                    {/* Resumen de costos integrado */}
                    {cocciones.length > 0 && (
                        <ResumenCostos cocciones={cocciones} formatDate={formatDate} />
                    )}
                </div>
            )}
            {tab === 'produccion' && (
                <TabProduccion
                    detalles={detalles}
                    deleting={deleting}
                    onDelete={(id) => handleDelete(id, 'detalle')}
                    formatDate={formatDate}
                    demandaPorProducto={demandaPorProducto}
                    stock={stock}
                    onNueva={openProduccion}
                    pedidos={pedidosPendientes}
                    productos={productos}
                    masaRestante={masaRestante}
                    masaKgPorProducto={masaKgPorProducto}
                />
            )}

            {/* ── Modales ──────────────────────────────────────────────────── */}
            {modal && (
                <div className="modal-overlay" onClick={() => setModal(null)}
                    style={{ alignItems: 'flex-start', overflowY: 'auto', padding: 16 }}>
                    <div className="modal-content" onClick={e => e.stopPropagation()}
                        style={{ maxWidth: modal === 'receta' || modal === 'lote' ? 680 : 580, margin: 'auto' }}>
                        <div className="modal-header">
                            <h2 className="modal-title">
                                {modal === 'receta'    ? (editReceta ? '✏️ Editar Receta' : '📋 Nueva Receta de Cocción')
                                 : modal === 'coccion' ? '🌽 Registrar Cocción'
                                 : modal === 'produccion' ? '🫓 Producción: Masa → Arepas'
                                 : '📊 Lote de Producción — Costos'}
                            </h2>
                            <button className="modal-close" onClick={() => setModal(null)}><X size={18} /></button>
                        </div>

                        {modal === 'receta' && (
                            <RecetaForm form={form} setForm={setForm} productos={productos} insumos={insumos} />
                        )}
                        {modal === 'coccion' && (
                            <CoccionForm form={form} setForm={setForm} insumos={insumos} />
                        )}
                        {modal === 'produccion' && (
                            <ProduccionForm
                                form={form} setForm={setForm}
                                productos={productos} stock={stock}
                                demandaPorProducto={demandaPorProducto}
                                masaComprometida={masaComprometida}
                                masaKgPorProducto={masaKgPorProducto}
                            />
                        )}
                        {modal === 'lote' && (
                            <LoteForm form={form} setForm={setForm} productos={productos} insumos={insumos} />
                        )}

                        <div style={{ marginTop: 24, display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                            <button className="btn btn-secondary" onClick={() => setModal(null)}>Cancelar</button>
                            <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
                                <Save size={15} /> {saving ? 'Guardando…' : 'Guardar'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

// ── Componentes de UI auxiliares ──────────────────────────────────────────────
function FlowCard({ icon, accent, title, value, unit, sub, alert }) {
    return (
        <div style={{
            background: 'var(--bg-card)',
            border: `1px solid var(--border)`,
            borderTop: `3px solid ${accent}`,
            borderRadius: 12,
            padding: '14px 16px',
            minWidth: 0,
            display: 'flex',
            flexDirection: 'column',
            gap: 6,
        }}>
            {/* Icon + title */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                <div style={{
                    width: 30, height: 30, borderRadius: 8,
                    background: `${accent}22`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: accent, flexShrink: 0,
                }}>
                    {icon}
                </div>
                <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', lineHeight: 1.2 }}>{title}</span>
            </div>
            {/* Value */}
            <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1, letterSpacing: '-0.5px' }}>
                {value}
                {unit && <span style={{ fontSize: 12, fontWeight: 400, color: 'var(--text-secondary)', marginLeft: 4 }}>{unit}</span>}
            </div>
            {/* Sub */}
            {sub && <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{sub}</div>}
            {/* Alert badge */}
            {alert && (
                <div style={{
                    display: 'inline-flex', alignItems: 'center', gap: 4,
                    padding: '3px 8px', borderRadius: 20, fontSize: 11, fontWeight: 700,
                    background: alert.danger ? 'rgba(239,68,68,0.15)' : 'rgba(34,197,94,0.15)',
                    color: alert.danger ? '#f87171' : '#4ade80',
                    border: `1px solid ${alert.danger ? 'rgba(239,68,68,0.3)' : 'rgba(34,197,94,0.3)'}`,
                    width: 'fit-content',
                }}>
                    {alert.danger ? <AlertTriangle size={10} /> : <CheckCircle size={10} />}
                    {alert.text}
                </div>
            )}
        </div>
    );
}

function ArrowCard() {
    return (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-tertiary)' }}>
            <ChevronRight size={18} />
        </div>
    );
}

function DemandaPanel({ demanda, stock, productos, masaComprometida, masaRestante }) {
    const [open, setOpen] = useState(true);
    const hayDeficit = masaComprometida > masaRestante;
    return (
        <div style={{
            background: 'var(--bg-card)',
            border: `1px solid ${hayDeficit ? 'rgba(239,68,68,0.4)' : 'var(--border)'}`,
            borderRadius: 12, marginBottom: 20,
            overflow: 'hidden',
        }}>
            <button onClick={() => setOpen(v => !v)}
                style={{
                    width: '100%', background: hayDeficit ? 'rgba(239,68,68,0.08)' : 'var(--bg-secondary)',
                    border: 'none', cursor: 'pointer',
                    padding: '12px 18px',
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    color: 'var(--text-primary)', borderBottom: open ? '1px solid var(--border)' : 'none',
                }}>
                <span style={{ fontWeight: 700, fontSize: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
                    {hayDeficit
                        ? <AlertTriangle size={15} color="#f87171" />
                        : <CheckCircle size={15} color="#4ade80" />}
                    Demanda pendiente de producción
                    <span style={{ fontSize: 12, fontWeight: 400, color: 'var(--text-secondary)' }}>
                        {demanda.length} producto(s) · {demanda.reduce((s, d) => s + d.unidades, 0).toLocaleString()} uds
                    </span>
                </span>
                {open ? <ChevronUp size={15} color="var(--text-tertiary)" /> : <ChevronDown size={15} color="var(--text-tertiary)" />}
            </button>
            {open && (
                <div style={{ padding: '14px 18px 16px' }}>
                    {/* Totales */}
                    <div style={{
                        display: 'flex', gap: 24, flexWrap: 'wrap', alignItems: 'center',
                        paddingTop: 12, borderTop: '1px solid var(--border)', fontSize: 13,
                    }}>
                        <div>
                            <span style={{ color: 'var(--text-secondary)', fontSize: 11 }}>Masa necesaria</span>
                            <div style={{ fontWeight: 800, fontSize: 16, color: hayDeficit ? '#f87171' : '#4ade80' }}>{FMT_KG(masaComprometida)}</div>
                        </div>
                        <div>
                            <span style={{ color: 'var(--text-secondary)', fontSize: 11 }}>Masa cocinada (disponible)</span>
                            <div style={{ fontWeight: 800, fontSize: 16, color: masaRestante > 0 ? '#4ade80' : 'var(--text-secondary)' }}>{FMT_KG(masaRestante)}</div>
                        </div>
                        {hayDeficit && (
                            <div style={{
                                display: 'flex', alignItems: 'center', gap: 6,
                                padding: '6px 12px', borderRadius: 8,
                                background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.3)',
                                color: '#f87171', fontSize: 12, fontWeight: 700,
                            }}>
                                <AlertTriangle size={13} />
                                Déficit de {FMT_KG(masaComprometida - masaRestante)} — Registra una cocción
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}

// ── Tab: Lista de Recetas ─────────────────────────────────────────────────────
function TabRecetas({ recetas, insumos, deleting, onEjecutar, onEditar, onEliminar, onNueva }) {
    if (recetas.length === 0) {
        return (
            <div style={{ textAlign: 'center', padding: 48, color: 'var(--text-secondary)' }}>
                <BookOpen size={48} style={{ opacity: 0.3, marginBottom: 12 }} />
                <p style={{ fontSize: 15, fontWeight: 600 }}>No hay recetas de cocción</p>
                <p style={{ fontSize: 13, marginBottom: 20 }}>Crea tu primera receta para agilizar el registro de cocciones</p>
                <button className="btn btn-primary" onClick={onNueva}><Plus size={15} /> Crear primera receta</button>
            </div>
        );
    }

    return (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {recetas.map(r => {
                const insuficientes = r.insumos.filter(ri => {
                    const ins = insumos.find(i => i.id === ri.insumo_id);
                    if (!ins) return true;
                    const cantBase = convertir(ri.cantidad, ri.unidad, ins.unidad_medida) ?? ri.cantidad;
                    return Number(ins.cantidad_actual) < cantBase;
                });

                return (
                    <div key={r.id} style={{
                        display: 'flex', flexDirection: 'column', gap: 10,
                        padding: '12px 14px',
                        background: 'var(--bg-card)',
                        border: '1px solid var(--border)',
                        borderTop: `3px solid ${insuficientes.length > 0 ? '#f87171' : '#a78bfa'}`,
                        borderRadius: 10, opacity: r.activa ? 1 : 0.55,
                        width: 160, flexShrink: 0,
                    }}>
                        {/* Nombre + badges */}
                        <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 2 }}>
                                <span style={{ fontWeight: 700, fontSize: 13, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', flex: 1, minWidth: 0 }}>{r.nombre}</span>
                                {!r.activa && <span style={{ fontSize: 9, background: 'var(--bg-tertiary)', color: 'var(--text-tertiary)', borderRadius: 20, padding: '1px 5px', fontWeight: 700, flexShrink: 0 }}>OFF</span>}
                                {insuficientes.length > 0 && <span style={{ fontSize: 11, color: '#f87171', flexShrink: 0 }} title="Stock insuficiente">⚠</span>}
                            </div>
                            <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{FMT_KG(r.masa_salida_kg)} / bulto</div>
                        </div>

                        {/* Acciones */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                            <div style={{ display: 'flex', gap: 4 }}>
                                <button className="btn btn-secondary" style={{ padding: '4px 0', flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={() => onEditar(r)} title="Editar"><Edit2 size={12} /></button>
                                <button className="btn btn-secondary" style={{ padding: '4px 0', flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--danger)' }} onClick={() => onEliminar(r.id)} disabled={deleting === r.id + 'receta'} title="Eliminar"><Trash2 size={12} /></button>
                            </div>
                            {r.activa && (
                                <button style={{ width: '100%', padding: '6px 0', fontSize: 12, fontWeight: 700, borderRadius: 7, border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5, background: 'linear-gradient(135deg,#ffdd19,#d97706)', color: '#fff' }}
                                    onClick={() => onEjecutar(r)} title="Ejecutar Cocción">
                                    <Play size={12} /> Ejecutar
                                </button>
                            )}
                        </div>
                    </div>
                );
            })}
        </div>
    );
}

// ── Tab: Historial de Cocciones ───────────────────────────────────────────────
function TablaCocciones({ cocciones, deleting, onDelete, formatDate, onEjecutar, onEditarReceta, onEditarFecha, recetas }) {
    const [expandido, setExpandido] = useState(null);
    const [editingFechaId, setEditingFechaId] = useState(null);
    const [fechaDraft, setFechaDraft] = useState('');
    const [savingFecha, setSavingFecha] = useState(false);

    const startEditFecha = (c) => {
        setFechaDraft(c.fecha ? toDateBogota(c.fecha) : '');
        setEditingFechaId(c.id);
    };
    const cancelEditFecha = () => { setEditingFechaId(null); setFechaDraft(''); };
    const commitEditFecha = async (id) => {
        if (!fechaDraft) { toast.error('Fecha inválida'); return; }
        setSavingFecha(true);
        try {
            await onEditarFecha(id, fechaDraft);
            cancelEditFecha();
        } finally {
            setSavingFecha(false);
        }
    };

    if (cocciones.length === 0) {
        return (
            <div style={{ textAlign: 'center', padding: 48, color: 'var(--text-secondary)' }}>
                <FlaskConical size={48} style={{ opacity: 0.3, marginBottom: 12 }} />
                <p style={{ fontSize: 15, fontWeight: 600 }}>Sin cocciones registradas</p>
                {recetas.filter(r => r.activa).length > 0
                    ? <button className="btn btn-primary" style={{ background: '#ffdd19', borderColor: '#ffdd19' }} onClick={onEjecutar}><Play size={15} /> Registrar primera cocción</button>
                    : <p style={{ fontSize: 13 }}>Crea primero una receta de cocción</p>
                }
            </div>
        );
    }

    return (
        <div className="table-container">
            <table className="data-table">
                <thead>
                    <tr>
                        <th>Fecha</th>
                        <th>Receta</th>
                        <th style={{ textAlign: 'right' }}>Masa obtenida</th>
                        <th style={{ textAlign: 'right' }}>Costo total</th>
                        <th style={{ textAlign: 'right' }}>Costo / kg</th>
                        <th>Obs.</th>
                        <th></th>
                    </tr>
                </thead>
                <tbody>
                    {cocciones.map(c => (
                        <React.Fragment key={c.id}>
                            <tr style={{ cursor: 'pointer' }} onClick={() => setExpandido(expandido === c.id ? null : c.id)}>
                                <td style={{ fontSize: 13, color: 'var(--text-secondary)' }} onClick={e => e.stopPropagation()}>
                                    {editingFechaId === c.id ? (
                                        <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                                            <DateInput
                                                value={fechaDraft}
                                                onChange={setFechaDraft}
                                                height={28}
                                            />
                                            <button className="btn btn-primary"
                                                style={{ padding: '3px 6px' }}
                                                title="Guardar"
                                                disabled={savingFecha}
                                                onClick={() => commitEditFecha(c.id)}>
                                                <Save size={12} />
                                            </button>
                                            <button className="btn btn-secondary"
                                                style={{ padding: '3px 6px' }}
                                                title="Cancelar"
                                                disabled={savingFecha}
                                                onClick={cancelEditFecha}>
                                                <X size={12} />
                                            </button>
                                        </div>
                                    ) : (
                                        <span
                                            title="Click para editar fecha"
                                            style={{ cursor: 'text', borderBottom: '1px dashed var(--border)' }}
                                            onClick={() => startEditFecha(c)}>
                                            {formatDate(c.fecha)}
                                        </span>
                                    )}
                                </td>
                                <td style={{ fontWeight: 600 }}>{c.receta_nombre}</td>
                                <td style={{ textAlign: 'right', fontWeight: 700, color: 'var(--success)' }}>{FMT_KG(c.masa_obtenida_kg)}</td>
                                <td style={{ textAlign: 'right', fontWeight: 700 }}>{FMT_COP(c.costo_total || 0)}</td>
                                <td style={{ textAlign: 'right', fontSize: 12, color: 'var(--text-secondary)' }}>
                                    {c.costo_por_kg > 0 ? `${FMT_COP(c.costo_por_kg)}/kg` : '—'}
                                </td>
                                <td style={{ fontSize: 12, color: 'var(--text-tertiary)', maxWidth: 100, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.observaciones || '—'}</td>
                                <td>
                                    <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end' }}>
                                        <button className="btn btn-secondary" style={{ padding: '4px 8px' }}
                                            title="Editar fecha"
                                            onClick={e => { e.stopPropagation(); startEditFecha(c); }}>
                                            <Calendar size={14} />
                                        </button>
                                        <button className="btn btn-secondary" style={{ padding: '4px 8px' }}
                                            title="Editar receta"
                                            onClick={e => {
                                                e.stopPropagation();
                                                const r = recetas.find(rr => rr.id === c.receta_id);
                                                if (r) onEditarReceta(r);
                                                else toast.error('La receta original ya no existe');
                                            }}>
                                            <Edit2 size={14} />
                                        </button>
                                        <button className="btn btn-secondary" style={{ padding: '4px 8px', color: 'var(--danger)' }}
                                            title="Eliminar cocción"
                                            onClick={e => { e.stopPropagation(); onDelete(c.id); }}
                                            disabled={deleting === c.id + 'coccion'}>
                                            <Trash2 size={14} />
                                        </button>
                                    </div>
                                </td>
                            </tr>
                            {expandido === c.id && (
                                <tr>
                                    <td colSpan={7} style={{ padding: 0, background: 'var(--bg-secondary)' }}>
                                        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                            <thead><tr style={{ background: 'var(--bg-tertiary)' }}>
                                                <th style={{ padding: '5px 16px', fontSize: 12, fontWeight: 600 }}>Insumo</th>
                                                <th style={{ padding: '5px 16px', textAlign: 'right', fontSize: 12, fontWeight: 600 }}>Cantidad</th>
                                                <th style={{ padding: '5px 16px', textAlign: 'right', fontSize: 12, fontWeight: 600 }}>Costo unit.</th>
                                                <th style={{ padding: '5px 16px', textAlign: 'right', fontSize: 12, fontWeight: 600 }}>Subtotal</th>
                                            </tr></thead>
                                            <tbody>
                                                {(c.insumos_usados || []).map(ci => (
                                                    <tr key={ci.id}>
                                                        <td style={{ padding: '5px 16px', fontSize: 13 }}><Package size={12} style={{ marginRight: 4, color: 'var(--brand)' }} />{ci.insumo_nombre}</td>
                                                        <td style={{ padding: '5px 16px', textAlign: 'right', fontSize: 13 }}>{Number(ci.cantidad).toFixed(3)} {ci.unidad}</td>
                                                        <td style={{ padding: '5px 16px', textAlign: 'right', fontSize: 12, color: 'var(--text-secondary)' }}>{FMT_COP(ci.costo_unitario || 0)}/{ci.unidad}</td>
                                                        <td style={{ padding: '5px 16px', textAlign: 'right', fontSize: 13, fontWeight: 700 }}>{FMT_COP(ci.costo_linea || 0)}</td>
                                                    </tr>
                                                ))}
                                                <tr style={{ borderTop: '2px solid var(--border)' }}>
                                                    <td colSpan={3} style={{ padding: '6px 16px', textAlign: 'right', fontWeight: 700, fontSize: 13 }}>TOTAL</td>
                                                    <td style={{ padding: '6px 16px', textAlign: 'right', fontWeight: 800, fontSize: 14, color: 'var(--brand)' }}>{FMT_COP(c.costo_total || 0)}</td>
                                                </tr>
                                            </tbody>
                                        </table>
                                    </td>
                                </tr>
                            )}
                        </React.Fragment>
                    ))}
                </tbody>
            </table>
        </div>
    );
}

// ── Tab: Producción Masa → Arepas ─────────────────────────────────────────────
function TabProduccion({ detalles, deleting, onDelete, formatDate, demandaPorProducto, stock, onNueva, pedidos, productos, masaRestante, masaKgPorProducto = {} }) {
    // Calcular unidades ya producidas hoy por producto (de detalles de hoy)
    const hoy = new Date().toDateString();
    const producidoHoyPorProducto = {};
    detalles.forEach(d => {
        if (new Date(d.fecha).toDateString() === hoy) {
            producidoHoyPorProducto[d.producto_final_id] = (producidoHoyPorProducto[d.producto_final_id] || 0) + Number(d.cantidad_producida);
        }
    });

    const hayDemanda = demandaPorProducto.length > 0;

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

            {/* Panel de demanda desde pedidos pendientes */}
            <div style={{ borderRadius: 12, border: '1px solid var(--border)', overflow: 'hidden' }}>
                <div style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    padding: '12px 16px',
                    background: 'var(--bg-secondary)',
                    borderBottom: hayDemanda ? '1px solid var(--border)' : 'none',
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <ShoppingBag size={16} style={{ color: '#3b82f6' }} />
                        <span style={{ fontWeight: 700, fontSize: 14 }}>Demanda de pedidos pendientes</span>
                        {pedidos.length > 0 && (
                            <span style={{ fontSize: 12, background: 'rgba(59,130,246,0.15)', color: '#3b82f6', borderRadius: 20, padding: '2px 8px', fontWeight: 600 }}>
                                {pedidos.length} pedido{pedidos.length !== 1 ? 's' : ''}
                            </span>
                        )}
                    </div>
                    <button className="btn btn-primary" onClick={onNueva} style={{ fontSize: 13, padding: '6px 14px' }}>
                        <Plus size={14} /> Registrar producción
                    </button>
                </div>

                {!hayDemanda ? (
                    <div style={{ padding: '24px 16px', textAlign: 'center', color: 'var(--text-secondary)', fontSize: 13 }}>
                        <ShoppingBag size={32} style={{ opacity: 0.25, marginBottom: 8 }} />
                        <div>No hay pedidos pendientes en este momento.</div>
                    </div>
                ) : (
                    <table className="data-table" style={{ marginBottom: 0 }}>
                        <thead>
                            <tr>
                                <th>Producto</th>
                                <th style={{ textAlign: 'right' }}>Unidades pedidas</th>
                                <th style={{ textAlign: 'right' }}>Masa necesaria</th>
                                <th style={{ textAlign: 'right' }}>Stock bodega</th>
                                <th style={{ textAlign: 'right' }}>Por producir</th>
                                <th style={{ textAlign: 'right' }}>Stock masa</th>
                                <th style={{ textAlign: 'center' }}>Estado</th>
                            </tr>
                        </thead>
                        <tbody>
                            {demandaPorProducto.map(d => {
                                const masaPorUd   = masaKgPorProducto[d.id] || d.masa_por_ud || 0;
                                const masaStockKg = masaRestante ?? 0;

                                const stockProducto = stock[d.id] || 0;
                                const pendiente     = Math.max(0, d.unidades - stockProducto);
                                const masaPendKg    = pendiente * masaPorUd;
                                const masaOk        = masaStockKg >= masaPendKg;

                                return (
                                    <tr key={d.id}>
                                        <td style={{ fontWeight: 600 }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                                <div style={{ width: 8, height: 8, borderRadius: '50%', background: masaOk ? 'var(--success)' : 'var(--danger)', flexShrink: 0 }} />
                                                {d.nombre}
                                            </div>
                                            {masaPorUd > 0 && (
                                                <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 1, paddingLeft: 14 }}>
                                                    {masaPorUd} kg masa/ud
                                                </div>
                                            )}
                                        </td>
                                        <td style={{ textAlign: 'right', fontWeight: 700, color: '#3b82f6' }}>
                                            {d.unidades.toLocaleString()} uds
                                        </td>
                                        <td style={{ textAlign: 'right', color: 'var(--text-secondary)', fontSize: 13 }}>
                                            {FMT_KG(d.masa_kg)}
                                        </td>
                                        <td style={{ textAlign: 'right', color: stockProducto > 0 ? 'var(--success)' : 'var(--text-tertiary)', fontSize: 13, fontWeight: stockProducto > 0 ? 700 : 400 }}>
                                            {stockProducto > 0 ? `${stockProducto.toLocaleString()} uds` : '0'}
                                        </td>
                                        <td style={{ textAlign: 'right', fontWeight: 700, color: pendiente > 0 ? 'var(--danger)' : 'var(--success)' }}>
                                            {pendiente > 0 ? `${pendiente.toLocaleString()} uds` : <span style={{ fontSize: 13 }}>✓ Cubierto</span>}
                                        </td>
                                        <td style={{ textAlign: 'right', fontSize: 13, color: masaOk ? 'var(--success)' : 'var(--danger)', fontWeight: 600 }}>
                                            {FMT_KG(masaStockKg)}
                                        </td>
                                        <td style={{ textAlign: 'center' }}>
                                            {pendiente === 0 ? (
                                                <span className="badge badge-success">Listo</span>
                                            ) : stockProducto >= d.unidades ? (
                                                <span className="badge badge-success">Stock OK</span>
                                            ) : masaOk ? (
                                                <span className="badge badge-info">Masa OK</span>
                                            ) : (
                                                <span className="badge badge-danger">Sin masa</span>
                                            )}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                )}
            </div>

            {/* Historial de producciones */}
            <div>
                <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Historial de producciones registradas
                </div>
                {detalles.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--text-tertiary)', fontSize: 13 }}>
                        Aún no se han registrado producciones.
                    </div>
                ) : (
                    <div className="table-container">
                        <table className="data-table">
                            <thead>
                                <tr>
                                    <th>Fecha</th>
                                    <th>Masa consumida</th>
                                    <th style={{ textAlign: 'right' }}>kg masa</th>
                                    <th style={{ textAlign: 'center' }}></th>
                                    <th>Producto final</th>
                                    <th style={{ textAlign: 'right' }}>Unidades</th>
                                    <th style={{ textAlign: 'right' }}>kg/ud</th>
                                    <th></th>
                                </tr>
                            </thead>
                            <tbody>
                                {detalles.map(d => {
                                    const lbPorUd = d.cantidad_producida > 0
                                        ? (Number(d.cantidad_consumida_kg) / Number(d.cantidad_producida)).toFixed(3)
                                        : '—';
                                    return (
                                        <tr key={d.id}>
                                            <td style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{formatDate(d.fecha)}</td>
                                            <td style={{ fontWeight: 600 }}>{d.producto_consumido_nombre}</td>
                                            <td style={{ textAlign: 'right', color: 'var(--danger)' }}>{FMT_KG(d.cantidad_consumida_kg)}</td>
                                            <td style={{ textAlign: 'center' }}><ChevronRight size={14} color="var(--text-tertiary)" /></td>
                                            <td style={{ fontWeight: 600 }}>{d.producto_final_nombre}</td>
                                            <td style={{ textAlign: 'right', fontWeight: 700, color: 'var(--success)' }}>{Number(d.cantidad_producida).toLocaleString()} uds</td>
                                            <td style={{ textAlign: 'right', fontSize: 12, color: 'var(--text-secondary)' }}>{lbPorUd}</td>
                                            <td>
                                                <button className="btn btn-secondary" style={{ padding: '4px 8px', color: 'var(--danger)' }}
                                                    onClick={() => onDelete(d.id)} disabled={deleting === d.id + 'detalle'}>
                                                    <Trash2 size={14} />
                                                </button>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
}

// ── Tab: Lotes de Costos ──────────────────────────────────────────────────────
function ResumenCostos({ cocciones, formatDate }) {
    const coccionesConCosto = cocciones.filter(c => (c.costo_total || 0) > 0);

    // Totales generales
    const totalCosto     = coccionesConCosto.reduce((s, c) => s + Number(c.costo_total || 0), 0);
    const totalMasaLb    = coccionesConCosto.reduce((s, c) => s + Number(c.masa_obtenida_kg || 0), 0);
    const costoPorKgProm = totalMasaLb > 0 ? totalCosto / totalMasaLb : 0;

    // Resumen por receta
    const porReceta = {};
    coccionesConCosto.forEach(c => {
        const k = c.receta_nombre || 'Sin receta';
        if (!porReceta[k]) porReceta[k] = { nombre: k, cocciones: 0, masa_kg: 0, costo_total: 0 };
        porReceta[k].cocciones  += 1;
        porReceta[k].masa_kg    += Number(c.masa_obtenida_kg || 0);
        porReceta[k].costo_total += Number(c.costo_total || 0);
    });
    const resumenRecetas = Object.values(porReceta);

    if (cocciones.length === 0) return (
        <div style={{ textAlign: 'center', padding: 48, color: 'var(--text-secondary)' }}>
            <Calculator size={48} style={{ opacity: 0.3, marginBottom: 12 }} />
            <p style={{ fontSize: 15, fontWeight: 600 }}>Sin cocciones registradas</p>
            <p style={{ fontSize: 13 }}>Registra cocciones para ver el resumen de costos</p>
        </div>
    );

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>


        </div>
    );
}

// ── Modal: Crear / Editar Receta ──────────────────────────────────────────────
function RecetaForm({ form, setForm, productos, insumos }) {
    const upd = (k, v) => setForm(f => ({ ...f, [k]: v }));

    // Devuelve la cantidad (en kg) del insumo base de un array de líneas.
    const baseKgFromLineas = (lineas) => {
        const validas = (lineas || []).filter(l => l.insumo_id && Number(l.cantidad) > 0 && l.unidad);
        const base = validas.find(l => l.es_base) || validas[0];
        if (!base) return 0;
        return _toKg(Number(base.cantidad), base.unidad);
    };

    // Cambiar rendimiento → recalcular masa_salida_kg.
    const updRendimiento = (v) => {
        setForm(f => {
            const cantKg = baseKgFromLineas(f.lineas);
            const masa = cantKg > 0 && v !== '' ? round2(cantKg * (Number(v) / 100)) : f.masa_salida_kg;
            return { ...f, rendimiento: v, masa_salida_kg: masa };
        });
    };

    // Cambiar masa_salida_kg → recalcular rendimiento.
    const updMasaKg = (v) => {
        setForm(f => {
            const cantKg = baseKgFromLineas(f.lineas);
            const masaKg = Number(v);
            const rend = cantKg > 0 && masaKg > 0 ? round2((masaKg / cantKg) * 100) : f.rendimiento;
            return { ...f, masa_salida_kg: v, rendimiento: rend };
        });
    };

    const updLinea = (idx, k, v) => {
        setForm(f => {
            const lineas = [...f.lineas];
            if (k === 'insumo_id') {
                const ins = insumos.find(i => i.id === Number(v));
                lineas[idx] = { ...lineas[idx], [k]: v, unidad: ins?.unidad_medida || '' };
            } else {
                lineas[idx] = { ...lineas[idx], [k]: v };
            }
            // Si la línea afectada es el insumo base, mantener el % y recalcular la masa.
            const baseIdx = lineas.findIndex(l => l.es_base);
            const effectiveBaseIdx = baseIdx === -1 ? 0 : baseIdx;
            let masa = f.masa_salida_kg;
            if (idx === effectiveBaseIdx && f.rendimiento) {
                const cantKg = baseKgFromLineas(lineas);
                if (cantKg > 0) masa = round2(cantKg * (Number(f.rendimiento) / 100));
            }
            return { ...f, lineas, masa_salida_kg: masa };
        });
    };
    const addLinea    = () => setForm(f => ({ ...f, lineas: [...f.lineas, { insumo_id: '', cantidad: '', unidad: '', es_base: false }] }));
    const removeLinea = (idx) => setForm(f => ({ ...f, lineas: f.lineas.filter((_, i) => i !== idx) }));
    const setBase     = (idx) => setForm(f => {
        const lineas = f.lineas.map((l, i) => ({ ...l, es_base: i === idx }));
        const cantKg = baseKgFromLineas(lineas);
        const masa = cantKg > 0 && f.rendimiento ? round2(cantKg * (Number(f.rendimiento) / 100)) : f.masa_salida_kg;
        return { ...f, lineas, masa_salida_kg: masa };
    });

    // Live preview: base insumo × rendimiento → masa (en kg directamente)
    const lineasValidas = (form.lineas || []).filter(l => l.insumo_id && Number(l.cantidad) > 0 && l.unidad);
    const insumoBase = lineasValidas.find(l => l.es_base) || lineasValidas[0];
    const rendimiento = Number(form.rendimiento) || 180;
    let previewKg = null;
    if (insumoBase) {
        const cantKg = _toKg(Number(insumoBase.cantidad), insumoBase.unidad);
        if (cantKg > 0) previewKg = round2(cantKg * (rendimiento / 100));
    }

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* Info banner */}
            <div style={{ background: 'rgba(255,221,25,0.12)', border: '1px solid rgba(255,221,25,0.4)', borderRadius: 8, padding: '10px 14px', fontSize: 12, color: 'var(--text-primary)', display: 'flex', gap: 8 }}>
                <Info size={14} style={{ flexShrink: 0, marginTop: 1, color: '#ffdd19' }} />
                Define los insumos por <strong>1 bulto</strong>. El insumo <strong>base (maíz)</strong> determina la masa producida según el rendimiento. Al ejecutar, solo dices cuántos bultos procesaste.
            </div>

            {/* Nombre + descripción */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                <div style={{ gridColumn: '1 / -1' }}>
                    <label className="form-label">Nombre de la receta *</label>
                    <input className="form-control" value={form.nombre} placeholder="Ej: Cocción maíz estándar"
                        onChange={e => upd('nombre', e.target.value)} />
                </div>
                <div style={{ gridColumn: '1 / -1' }}>
                    <label className="form-label">Insumo de salida (masa generada)</label>
                    <select className="form-control" value={form.insumo_salida_id} onChange={e => upd('insumo_salida_id', e.target.value)}>
                        <option value="">Seleccionar…</option>
                        {insumos.map(i => <option key={i.id} value={i.id}>{i.nombre} ({i.unidad_medida})</option>)}
                    </select>
                    <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 3 }}>
                        La masa producida se sumará al stock de este insumo.
                    </div>
                </div>
                <div>
                    <label className="form-label">Rendimiento (%)</label>
                    <input type="number" className="form-control" min="1" max="500" step="any"
                        value={form.rendimiento} placeholder="180"
                        onChange={e => updRendimiento(e.target.value)} />
                    <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 3 }}>
                        Masa = insumo base × {rendimiento}%
                    </div>
                </div>
                <div>
                    <label className="form-label">Resultado por bulto (kg)</label>
                    <input type="number" className="form-control" min="0" step="any"
                        value={form.masa_salida_kg} placeholder="0.00"
                        onChange={e => updMasaKg(e.target.value)} />
                    <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 3 }}>
                        Editable — recalcula el % automáticamente
                    </div>
                </div>
                <div style={{ gridColumn: '1 / -1' }}>
                    <label className="form-label">Descripción (opcional)</label>
                    <input className="form-control" value={form.descripcion} placeholder="Notas sobre esta receta…"
                        onChange={e => upd('descripcion', e.target.value)} />
                </div>
            </div>

            {/* Insumos */}
            <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <label className="form-label" style={{ marginBottom: 0 }}>Insumos por bulto *</label>
                    <button type="button" className="btn btn-secondary" style={{ padding: '4px 10px', fontSize: 12 }} onClick={addLinea}>
                        <Plus size={13} /> Agregar insumo
                    </button>
                </div>

                {(form.lineas || []).map((l, idx) => {
                    const ins = insumos.find(i => i.id === Number(l.insumo_id));
                    const unidadesDispo = ins ? (GRUPOS[ins.unidad_medida] || [ins.unidad_medida]) : UNIDADES;
                    const esBase = !!l.es_base || (idx === 0 && !(form.lineas || []).some((x, i) => i !== 0 && x.es_base));
                    return (
                        <div key={idx} style={{
                            display: 'grid', gridTemplateColumns: '24px 1fr 100px 100px auto',
                            gap: 8, marginBottom: 8, alignItems: 'end',
                            padding: '10px 10px 10px 8px', borderRadius: 8,
                            border: `1px solid ${esBase ? 'rgba(255,221,25,0.5)' : 'var(--border)'}`,
                            background: esBase ? 'rgba(255,221,25,0.07)' : 'transparent',
                        }}>
                            {/* Base marker / toggle */}
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', paddingBottom: idx === 0 ? 22 : 0 }}>
                                <button type="button" title={esBase ? 'Insumo base (maíz)' : 'Marcar como insumo base'}
                                    onClick={() => setBase(idx)}
                                    style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: esBase ? '#ffdd19' : 'var(--text-tertiary)' }}>
                                    <Wheat size={16} />
                                </button>
                            </div>
                            <div>
                                {idx === 0 && <label style={{ fontSize: 11, color: 'var(--text-secondary)', display: 'block', marginBottom: 3 }}>Insumo {esBase && <span style={{ color: '#ffdd19', fontWeight: 700 }}>(base)</span>}</label>}
                                <select className="form-control" style={{ fontSize: 13 }} value={l.insumo_id}
                                    onChange={e => updLinea(idx, 'insumo_id', e.target.value)}>
                                    <option value="">Seleccionar…</option>
                                    {insumos.map(i => (
                                        <option key={i.id} value={i.id}>
                                            {i.nombre} (Stock: {Number(i.cantidad_actual).toFixed(2)} {i.unidad_medida})
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                {idx === 0 && <label style={{ fontSize: 11, color: 'var(--text-secondary)', display: 'block', marginBottom: 3 }}>Cantidad</label>}
                                <input type="number" className="form-control" style={{ fontSize: 13 }} min="0.001" step="any"
                                    value={l.cantidad} placeholder="0" onChange={e => updLinea(idx, 'cantidad', e.target.value)} />
                            </div>
                            <div>
                                {idx === 0 && <label style={{ fontSize: 11, color: 'var(--text-secondary)', display: 'block', marginBottom: 3 }}>Unidad</label>}
                                <select className="form-control" style={{ fontSize: 13 }} value={l.unidad || ''}
                                    onChange={e => updLinea(idx, 'unidad', e.target.value)}>
                                    <option value="">—</option>
                                    {unidadesDispo.map(u => <option key={u} value={u}>{u}</option>)}
                                </select>
                            </div>
                            <button type="button" className="btn btn-secondary" style={{ padding: '6px 8px', color: 'var(--danger)' }} onClick={() => removeLinea(idx)}>
                                <Trash2 size={14} />
                            </button>
                        </div>
                    );
                })}
            </div>

            {/* Live preview */}
            {previewKg !== null && (
                <div style={{ background: 'rgba(167,139,250,0.12)', border: '1px solid rgba(167,139,250,0.4)', borderRadius: 8, padding: '12px 16px' }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: '#a78bfa', marginBottom: 6, letterSpacing: '0.06em' }}>RESULTADO POR 1 BULTO</div>
                    <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>
                        {insumoBase.cantidad} {insumoBase.unidad}
                        <span style={{ color: 'var(--text-secondary)', fontWeight: 400 }}> × {rendimiento}% = </span>
                        <span style={{ color: '#a78bfa' }}>{previewKg} kg masa</span>
                    </div>
                </div>
            )}
        </div>
    );
}

// ── Modal: Ejecutar Cocción ───────────────────────────────────────────────────
function CoccionForm({ form, setForm, insumos = [] }) {
    const upd = (k, v) => setForm(f => ({ ...f, [k]: v }));
    const receta = form?.receta;
    const bultos = Number(form?.bultos) || 0;

    if (!receta) return (
        <div style={{ textAlign: 'center', padding: 32, color: 'var(--text-secondary)' }}>
            No hay receta seleccionada. Selecciona una desde el tab de Recetas.
        </div>
    );

    // Insumo base = marcado como es_base, o el primero
    const lineasReceta = receta.insumos || [];
    const insumoBase = lineasReceta.find(l => l.es_base) || lineasReceta[0];

    // Masa estimada desde masa_salida_kg (ya calculada con rendimiento al crear receta)
    const masaKgPorBulto = Number(receta.masa_salida_kg) || 0;
    const masaTotalKg    = bultos > 0 ? round2(masaKgPorBulto * bultos) : null;

    // Rendimiento real reconstituido: masa_kg_por_bulto / base_kg_por_bulto × 100
    let rendimientoPct = null;
    if (insumoBase && masaKgPorBulto > 0) {
        const baseKgPorBulto = _toKg(Number(insumoBase.cantidad), insumoBase.unidad);
        if (baseKgPorBulto > 0) {
            rendimientoPct = round2(masaKgPorBulto / baseKgPorBulto * 100);
        }
    }

    // Fórmula visible: bultos × qty_base × rendimiento% = masa
    let formulaStr = null;
    if (insumoBase && bultos > 0 && masaTotalKg !== null) {
        const rendDisplay = rendimientoPct ? ` × ${rendimientoPct}%` : '';
        formulaStr = `${bultos} bulto${bultos !== 1 ? 's' : ''} × ${insumoBase.cantidad} ${insumoBase.unidad}${rendDisplay} = ${masaTotalKg} kg masa`;
    }

    // Calcular cada línea de insumo: cantidad necesaria, peso en kg, costo, stock OK.
    const lineasPreview = lineasReceta.map(ri => {
        const ins = insumos.find(i => i.id === ri.insumo_id);
        const cantNec = Number(ri.cantidad) * bultos;
        const cantBase = ins ? (convertir(cantNec, ri.unidad, ins.unidad_medida) ?? cantNec) : cantNec;
        const stockDisp = ins ? Number(ins.cantidad_actual) : 0;
        const ok = bultos === 0 || stockDisp >= cantBase;

        // Peso en kg para el resumen (si la unidad es de masa). Si no aplica, queda 0.
        const pesoKg = _toKg(cantNec, ri.unidad) || 0;

        // Costo: cantidad en la unidad base del insumo × costo_unitario
        const costoUnit = ins ? Number(ins.costo_unitario || 0) : 0;
        const costoLinea = costoUnit > 0 ? round2(cantBase * costoUnit) : 0;

        return { ...ri, ins, cantNec, cantBase, stockDisp, ok, pesoKg, costoUnit, costoLinea };
    });

    const todoOk = bultos === 0 || lineasPreview.every(l => l.ok);

    // Totales sumando TODOS los insumos
    const pesoTotalKg  = lineasPreview.reduce((s, l) => s + (l.pesoKg || 0), 0);
    const costoTotal   = lineasPreview.reduce((s, l) => s + (l.costoLinea || 0), 0);
    const costoPorKg   = masaTotalKg > 0 ? round2(costoTotal / masaTotalKg) : 0;

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* Receta seleccionada */}
            <div style={{ background: 'rgba(167,139,250,0.1)', border: '1px solid rgba(167,139,250,0.35)', borderRadius: 10, padding: 14 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#a78bfa', marginBottom: 4 }}>RECETA SELECCIONADA</div>
                <div style={{ fontSize: 16, fontWeight: 700 }}>{receta.nombre}</div>
                {receta.descripcion && <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>{receta.descripcion}</div>}
                <div style={{ marginTop: 8, fontSize: 13, color: 'var(--text-secondary)' }}>
                    Produce <strong style={{ color: '#a78bfa' }}>{FMT_KG(masaKgPorBulto)}</strong> de masa por bulto
                    {rendimientoPct ? <> · Rendimiento <strong style={{ color: '#a78bfa' }}>{rendimientoPct}%</strong></> : null}
                    {receta.insumo_salida_nombre ? ` → ${receta.insumo_salida_nombre}` : ''}
                </div>
            </div>

            {/* Bultos + Fecha */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                    <label className="form-label">Cantidad de bultos a procesar *</label>
                    <input
                        type="number" className="form-control"
                        min="0.01" step="any"
                        value={form.bultos ?? ''}
                        placeholder="1"
                        onChange={e => upd('bultos', e.target.value)}
                    />
                    <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 3 }}>
                        Todos los insumos se multiplican por este valor
                    </div>
                </div>
                <div>
                    <label className="form-label">Fecha de cocción *</label>
                    <DateInput
                        value={form.fecha || ''}
                        onChange={v => upd('fecha', v)}
                        required
                        height={38}
                        style={{ display: 'block', width: '100%' }}
                    />
                    <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 3 }}>
                        Formato dd/mm/yyyy — por defecto hoy
                    </div>
                </div>
            </div>

            {/* Fórmula visual */}
            {masaTotalKg !== null && bultos > 0 && (
                <div style={{ background: 'rgba(167,139,250,0.12)', border: '1px solid rgba(167,139,250,0.4)', borderRadius: 8, padding: '12px 16px' }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: '#a78bfa', marginBottom: 6, letterSpacing: '0.06em' }}>RESULTADO ESTIMADO</div>
                    <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', wordBreak: 'break-word' }}>
                        {formulaStr || `${masaTotalKg} kg masa`}
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4 }}>
                        Total: <strong>{FMT_KG(masaTotalKg)}</strong> — se sumará al inventario de masa.
                    </div>
                </div>
            )}

            {/* Preview insumos × bultos */}
            {bultos > 0 && (
                <div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                        Insumos que se descontarán (× {bultos} bulto{bultos !== 1 ? 's' : ''})
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        {lineasPreview.map((l, i) => (
                            <div key={i} style={{
                                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                padding: '8px 12px', borderRadius: 8,
                                background: l.ok ? 'var(--bg-secondary)' : 'rgba(239,68,68,0.08)',
                                border: `1px solid ${l.ok ? 'var(--border)' : 'rgba(239,68,68,0.4)'}`,
                            }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                    {l.ok ? <CheckCircle size={14} color="var(--success)" /> : <AlertTriangle size={14} color="var(--danger)" />}
                                    <div>
                                        <div style={{ fontWeight: 600, fontSize: 14 }}>{l.insumo_nombre}</div>
                                        <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
                                            Stock: {l.stockDisp.toFixed(3)} {l.ins?.unidad_medida}
                                            {l.costoUnit > 0 && <> · {FMT_COP(l.costoUnit)}/{l.ins?.unidad_medida}</>}
                                        </div>
                                    </div>
                                </div>
                                <div style={{ textAlign: 'right' }}>
                                    <div style={{ fontWeight: 700, fontSize: 14, color: l.ok ? 'var(--text-primary)' : 'var(--danger)' }}>
                                        − {l.cantNec.toFixed(3)} {l.unidad}
                                    </div>
                                    {l.unidad !== l.ins?.unidad_medida && l.cantBase !== null && (
                                        <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>= {l.cantBase.toFixed(3)} {l.ins?.unidad_medida}</div>
                                    )}
                                    {l.costoLinea > 0 && (
                                        <div style={{ fontSize: 11, color: '#a78bfa', fontWeight: 700 }}>
                                            {FMT_COP(l.costoLinea)}
                                        </div>
                                    )}
                                    {!l.ok && (
                                        <div style={{ fontSize: 11, color: 'var(--danger)', fontWeight: 600 }}>
                                            Faltan {(l.cantBase - l.stockDisp).toFixed(3)} {l.ins?.unidad_medida}
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Resumen — peso y costo total de TODOS los insumos */}
                    {(pesoTotalKg > 0 || costoTotal > 0) && (
                        <div style={{
                            marginTop: 10, padding: '10px 14px', borderRadius: 8,
                            background: 'rgba(255,221,25,0.08)', border: '1px solid rgba(255,221,25,0.3)',
                            display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 10,
                        }}>
                            <div>
                                <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-tertiary)' }}>Peso total insumos</div>
                                <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--text-primary)' }}>{FMT_KG(pesoTotalKg)}</div>
                            </div>
                            <div>
                                <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-tertiary)' }}>Costo total insumos</div>
                                <div style={{ fontSize: 15, fontWeight: 800, color: '#ffdd19' }}>{FMT_COP(costoTotal)}</div>
                            </div>
                            {costoPorKg > 0 && (
                                <div>
                                    <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-tertiary)' }}>Costo por kg de masa</div>
                                    <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--text-primary)' }}>{FMT_COP(costoPorKg)}/kg</div>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            )}

            {!todoOk && (
                <div style={{ padding: '10px 14px', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.4)', borderRadius: 8, fontSize: 13, color: 'var(--danger)', fontWeight: 600 }}>
                    ⚠ Stock insuficiente para ejecutar esta cocción. Verifica los insumos.
                </div>
            )}

            <div>
                <label className="form-label">Observaciones</label>
                <input className="form-control" value={form.observaciones || ''} placeholder="Opcional"
                    onChange={e => upd('observaciones', e.target.value)} />
            </div>
        </div>
    );
}

// ── Modal: Producción Masa → Arepas ───────────────────────────────────────────
function ProduccionForm({ form, setForm, productos, stock, demandaPorProducto, masaComprometida, masaKgPorProducto = {} }) {
    const upd = (k, v) => setForm(f => ({ ...f, [k]: v }));

    const prodFinal     = productos.find(p => p.id === Number(form.producto_final_id));
    const prodConsumido = productos.find(p => p.id === Number(form.producto_consumido_id));
    const stockMasa     = prodConsumido ? (stock[prodConsumido.id] || 0) : null;
    const pesoKg        = prodFinal ? (masaKgPorProducto[prodFinal.id] || 0) : 0;
    const cantProd      = Number(form.cantidad_producida) || 0;
    const masaNecesaria = cantProd > 0 && pesoKg > 0 ? cantProd * pesoKg : null;
    const masaOk        = masaNecesaria !== null && stockMasa !== null ? stockMasa >= masaNecesaria : null;
    const demanda       = demandaPorProducto.find(d => d.id === prodFinal?.id);
    const kgPorUnidad   = cantProd > 0 && form.cantidad_consumida_kg ? (Number(form.cantidad_consumida_kg) / cantProd).toFixed(3) : null;

    const handleUnidades = (v) => {
        upd('cantidad_producida', v);
        const n = Number(v);
        if (n > 0 && pesoKg > 0) upd('cantidad_consumida_kg', (n * pesoKg).toFixed(3));
    };
    const handleProductoFinal = (id) => {
        upd('producto_final_id', id);
        if (form.cantidad_producida) {
            const masaPorUd = masaKgPorProducto[Number(id)] || 0;
            if (masaPorUd > 0) upd('cantidad_consumida_kg', (Number(form.cantidad_producida) * masaPorUd).toFixed(3));
        }
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* Producto final */}
            <div style={{ background: 'var(--bg-secondary)', borderRadius: 10, padding: 14 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#1d4ed8', marginBottom: 8 }}>🫓 PRODUCTO A PRODUCIR</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    <div>
                        <label className="form-label">Producto final (arepa)</label>
                        <select className="form-control" value={form.producto_final_id} onChange={e => handleProductoFinal(e.target.value)}>
                            <option value="">Seleccionar…</option>
                            {productos.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
                        </select>
                        {prodFinal && <div style={{ fontSize: 11, marginTop: 3, color: 'var(--text-tertiary)' }}>Peso/ud: {pesoKg} kg · Stock actual: {stock[prodFinal.id] || 0} uds</div>}
                    </div>
                    <div>
                        <label className="form-label" style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span>Unidades a producir</span>
                            {demanda && !form.cantidad_producida && (
                                <button type="button" style={{ fontSize: 10, color: 'var(--brand)', background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontWeight: 600 }}
                                    onClick={() => handleUnidades(String(demanda.unidades))}>
                                    Cubrir {demanda.unidades.toLocaleString()} pendientes
                                </button>
                            )}
                        </label>
                        <input type="number" className="form-control" min="1" step="1" value={form.cantidad_producida} placeholder="Ej: 200" onChange={e => handleUnidades(e.target.value)} />
                        {masaNecesaria && <div style={{ fontSize: 11, marginTop: 3, color: masaOk ? 'var(--success)' : 'var(--danger)', fontWeight: 600 }}>Masa necesaria: {FMT_KG(masaNecesaria)} {masaOk === false && '⚠ Insuficiente'}</div>}
                    </div>
                </div>
                {demanda && (
                    <div style={{ marginTop: 10, padding: '7px 10px', borderRadius: 7, background: demanda.unidades > (stock[prodFinal?.id] || 0) ? '#fef2f2' : '#f0fdf4', border: `1px solid ${demanda.unidades > (stock[prodFinal?.id] || 0) ? '#fca5a5' : '#86efac'}`, fontSize: 12 }}>
                        <strong>Demanda en pedidos:</strong> {demanda.unidades.toLocaleString()} uds · Masa req: {FMT_KG(demanda.masa_kg)} · Stock: {(stock[prodFinal?.id] || 0).toLocaleString()} uds
                    </div>
                )}
            </div>

            {/* Masa a consumir */}
            <div style={{ background: 'var(--bg-secondary)', borderRadius: 10, padding: 14 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#5b21b6', marginBottom: 8 }}>🌽 MASA A CONSUMIR</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    <div>
                        <label className="form-label">Tipo de masa</label>
                        <select className="form-control" value={form.producto_consumido_id} onChange={e => upd('producto_consumido_id', e.target.value)}>
                            <option value="">Seleccionar…</option>
                            {productos.map(p => <option key={p.id} value={p.id}>{p.nombre} — {FMT_KG(stock[p.id] || 0)}</option>)}
                        </select>
                        {stockMasa !== null && <div style={{ fontSize: 12, marginTop: 3, color: stockMasa > 0 ? 'var(--success)' : 'var(--danger)', fontWeight: 600 }}>{stockMasa > 0 ? '✓' : '✗'} Disponible: {FMT_KG(stockMasa)}</div>}
                    </div>
                    <div>
                        <label className="form-label">kg de masa a consumir</label>
                        <input type="number" className="form-control" min="0.01" step="0.01" value={form.cantidad_consumida_kg} placeholder="Auto-calculado" onChange={e => upd('cantidad_consumida_kg', e.target.value)} />
                        {kgPorUnidad && <div style={{ fontSize: 11, marginTop: 3, color: 'var(--text-tertiary)' }}>{kgPorUnidad} kg/ud</div>}
                    </div>
                </div>
                {masaOk === false && <div style={{ marginTop: 8, padding: '8px 12px', borderRadius: 7, background: '#fef2f2', border: '1px solid #fca5a5', fontSize: 12, color: 'var(--danger)', fontWeight: 600 }}>⚠ Masa insuficiente. Registra primero una cocción.</div>}
            </div>

            <div>
                <label className="form-label">Observaciones</label>
                <input className="form-control" value={form.observaciones} placeholder="Opcional" onChange={e => upd('observaciones', e.target.value)} />
            </div>
        </div>
    );
}

// ── Modal: Lote de Costos ─────────────────────────────────────────────────────
function LoteForm({ form, setForm, productos, insumos }) {
    const updRoot = (k, v) => setForm(f => ({ ...f, [k]: v }));

    const updLinea = (idx, k, v) => {
        setForm(f => {
            const lineas = [...f.lineas];
            if (k === 'insumo_id') {
                const ins = insumos.find(i => i.id === Number(v));
                lineas[idx] = { ...lineas[idx], [k]: v, unidad_consumo: ins?.unidad_medida || '' };
            } else {
                lineas[idx] = { ...lineas[idx], [k]: v };
            }
            return { ...f, lineas };
        });
    };
    const addLinea    = () => setForm(f => ({ ...f, lineas: [...f.lineas, { insumo_id: '', cantidad: '', unidad_consumo: '' }] }));
    const removeLinea = (idx) => setForm(f => ({ ...f, lineas: f.lineas.filter((_, i) => i !== idx) }));

    const lineas = form.lineas || [];
    let costoTotal = 0;
    const lineasCalc = lineas.map(l => {
        const ins = insumos.find(i => i.id === Number(l.insumo_id));
        const costoU   = ins ? Number(ins.costo_unitario || 0) : 0;
        const cant     = Number(l.cantidad) || 0;
        const uC       = l.unidad_consumo || ins?.unidad_medida || '';
        const uB       = ins?.unidad_medida || '';
        const cantBase = cant > 0 ? (convertir(cant, uC, uB) ?? cant) : 0;
        const incompat = cant > 0 && uC && uB && uC !== uB && convertir(cant, uC, uB) === null;
        const sub = costoU * cantBase;
        costoTotal += sub;
        return { ...l, ins, costoU, cant, cantBase, uC, uB, sub, incompat };
    });
    const cantProd   = Number(form.cantidad_producida) || 0;
    const costoPorUd = cantProd > 0 ? costoTotal / cantProd : 0;

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                <div>
                    <label className="form-label">Producto final (opcional)</label>
                    <select className="form-control" value={form.producto_final_id} onChange={e => updRoot('producto_final_id', e.target.value)}>
                        <option value="">Sin especificar</option>
                        {productos.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
                    </select>
                </div>
                <div>
                    <label className="form-label">Unidades producidas *</label>
                    <input type="number" className="form-control" min="1" step="1" value={form.cantidad_producida} placeholder="Ej: 500" onChange={e => updRoot('cantidad_producida', e.target.value)} />
                </div>
            </div>

            <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <label className="form-label" style={{ marginBottom: 0 }}>Insumos utilizados *</label>
                    <button type="button" className="btn btn-secondary" style={{ padding: '4px 10px', fontSize: 12 }} onClick={addLinea}><Plus size={13} /> Agregar</button>
                </div>
                {lineasCalc.map((l, idx) => {
                    const unidadesComp = l.ins ? (GRUPOS[l.uB] || [l.uB]) : UNIDADES;
                    return (
                        <div key={idx} style={{ marginBottom: 8, padding: '10px 12px', background: l.incompat ? 'rgba(239,68,68,0.06)' : 'var(--bg-secondary)', borderRadius: 8, border: `1px solid ${l.incompat ? 'var(--danger)' : 'var(--border)'}` }}>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 100px 90px auto', gap: 8, alignItems: 'end' }}>
                                <div>
                                    <label style={{ fontSize: 11, color: 'var(--text-secondary)', display: 'block', marginBottom: 3 }}>
                                        Insumo {l.ins && <span style={{ color: 'var(--text-tertiary)' }}>— {Number(l.ins.cantidad_actual).toFixed(2)} {l.ins.unidad_medida}</span>}
                                    </label>
                                    <select className="form-control" style={{ fontSize: 13 }} value={l.insumo_id} onChange={e => updLinea(idx, 'insumo_id', e.target.value)}>
                                        <option value="">Seleccionar…</option>
                                        {insumos.map(i => <option key={i.id} value={i.id}>{i.nombre}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label style={{ fontSize: 11, color: 'var(--text-secondary)', display: 'block', marginBottom: 3 }}>Cantidad</label>
                                    <input type="number" className="form-control" style={{ fontSize: 13 }} min="0.001" step="any" value={l.cantidad} onChange={e => updLinea(idx, 'cantidad', e.target.value)} />
                                </div>
                                <div>
                                    <label style={{ fontSize: 11, color: 'var(--text-secondary)', display: 'block', marginBottom: 3 }}>Unidad</label>
                                    <select className="form-control" style={{ fontSize: 13 }} value={l.unidad_consumo || l.uB} onChange={e => updLinea(idx, 'unidad_consumo', e.target.value)}>
                                        {unidadesComp.map(u => <option key={u} value={u}>{u}</option>)}
                                    </select>
                                </div>
                                <button type="button" className="btn btn-secondary" style={{ padding: '6px 8px', color: 'var(--danger)' }} onClick={() => removeLinea(idx)}><Trash2 size={14} /></button>
                            </div>
                            {l.cant > 0 && l.ins && (
                                <div style={{ marginTop: 5, fontSize: 11, display: 'flex', gap: 10 }}>
                                    {l.incompat ? (
                                        <span style={{ color: 'var(--danger)' }}>⚠ No compatible: {l.uC} → {l.uB}</span>
                                    ) : (
                                        <>
                                            {l.uC !== l.uB && <span style={{ color: 'var(--text-tertiary)' }}>{l.cant} {l.uC} → {l.cantBase.toFixed(4)} {l.uB}</span>}
                                            <span style={{ color: 'var(--brand)', fontWeight: 600 }}>Costo: {FMT_COP(l.sub)}</span>
                                        </>
                                    )}
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>

            {costoTotal > 0 && (
                <div style={{ background: 'linear-gradient(135deg,#f0fdf4,#dcfce7)', border: '1px solid #86efac', borderRadius: 10, padding: '12px 14px' }}>
                    <div style={{ fontSize: 12, color: '#166534', marginBottom: 6, fontWeight: 600 }}>📊 Resumen</div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                        <div><div style={{ fontSize: 11, color: '#166534' }}>Costo total</div><div style={{ fontSize: 18, fontWeight: 700, color: '#15803d' }}>{FMT_COP(costoTotal)}</div></div>
                        <div><div style={{ fontSize: 11, color: '#166534' }}>Costo / ud</div><div style={{ fontSize: 18, fontWeight: 700, color: '#15803d' }}>{cantProd > 0 ? FMT_COP(costoPorUd) : '—'}</div></div>
                    </div>
                </div>
            )}

            <div>
                <label className="form-label">Observaciones</label>
                <input className="form-control" value={form.observaciones} placeholder="Opcional" onChange={e => updRoot('observaciones', e.target.value)} />
            </div>
        </div>
    );
}

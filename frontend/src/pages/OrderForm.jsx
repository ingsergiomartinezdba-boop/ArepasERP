import { useState, useEffect } from 'react';
import { ordersService, clientsService, productsService, configService } from '../services/api';
import { useNavigate, useParams } from 'react-router-dom';
import { Save, Search, ChevronLeft, Package, Truck, ShoppingCart, X, User, Calendar, Clock, CalendarDays } from 'lucide-react';
import { todayBogota } from '../utils/formatters';
import DateInput from '../components/DateInput';
import { toast } from 'sonner';

// ── Helper: mañana en Bogotá ─────────────────────────────────
const tomorrowBogota = () => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Bogota' }).format(d);
};

const formatDateLabel = (yyyy_mm_dd) => {
    if (!yyyy_mm_dd) return '';
    const [y, m, d] = yyyy_mm_dd.split('-');
    const months = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];
    return `${d} ${months[parseInt(m, 10) - 1]} ${y}`;
};

// ── Helper: hora actual en Bogotá en minutos desde medianoche ─
function minutosAhora() {
    const str = new Intl.DateTimeFormat('en-GB', {
        timeZone: 'America/Bogota', hour: '2-digit', minute: '2-digit', hour12: false,
    }).format(new Date());
    const [h, m] = str.split(':').map(Number);
    return h * 60 + m;
}

// ── Modal de confirmación de fecha ───────────────────────────
function FechaConfirmModal({ clienteNombre, total, onConfirm, onCancel }) {
    const hoy     = todayBogota();
    const manana  = tomorrowBogota();
    const [modo, setModo]             = useState(null);   // null hasta saber si hoy está habilitado
    const [customDate, setCustomDate] = useState(hoy);
    const [hoyDeshabilitado, setHoyDeshabilitado] = useState(false);

    // Cargar horario de corte y definir modo inicial
    useEffect(() => {
        configService.getHorarioCorte().then(r => {
            const [hh, mm] = r.data.hora.split(':').map(Number);
            const corte = hh * 60 + mm;
            const pasoCutoff = minutosAhora() >= corte;
            setHoyDeshabilitado(pasoCutoff);
            setModo(pasoCutoff ? 'manana' : 'hoy');
        }).catch(() => setModo('hoy'));
    }, []);

    const fechaSeleccionada = modo === 'hoy' ? hoy : modo === 'manana' ? manana : customDate;
    const FMT_COP = v => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(v || 0);

    const OPCIONES = [
        {
            key: 'hoy',
            icon: Clock,
            titulo: 'Hoy',
            subtitulo: hoyDeshabilitado ? 'Fuera de horario' : formatDateLabel(hoy),
            color: '#10b981',
            disabled: hoyDeshabilitado,
        },
        {
            key: 'manana',
            icon: CalendarDays,
            titulo: 'Mañana',
            subtitulo: formatDateLabel(manana),
            color: 'var(--brand)',
        },
        {
            key: 'custom',
            icon: Calendar,
            titulo: 'Otra fecha',
            subtitulo: modo === 'custom' ? formatDateLabel(customDate) : 'Elegir…',
            color: '#8b5cf6',
        },
    ];

    // Esperar a que se cargue la configuración antes de mostrar el modal
    if (modo === null) return null;

    return (
        <div className="modal-overlay" style={{ alignItems: 'flex-start', overflowY: 'auto', padding: 16 }}>
            <div className="card animate-slide-up"
                 style={{ maxWidth: 420, width: '100%', margin: 'auto', padding: 0,
                          display: 'flex', flexDirection: 'column', overflow: 'hidden' }}
                 onClick={e => e.stopPropagation()}>

                {/* Header */}
                <div style={{ padding: '20px 22px 16px', borderBottom: '1px solid var(--border-subtle)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                        <div style={{ width: 34, height: 34, borderRadius: 9, background: 'var(--brand-muted)',
                                      border: '1px solid var(--border-brand)', display: 'flex',
                                      alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                            <Calendar size={16} color="var(--brand)" />
                        </div>
                        <div>
                            <div style={{ fontWeight: 800, fontSize: 15 }}>¿Para cuándo es el pedido?</div>
                            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{clienteNombre}</div>
                        </div>
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
                        Total: <strong style={{ color: 'var(--brand)' }}>{FMT_COP(total)}</strong>
                    </div>
                </div>

                {/* Opciones de fecha */}
                <div style={{ padding: '16px 22px', display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {OPCIONES.map(({ key, icon: Icon, titulo, subtitulo, color, disabled }) => {
                        const activo = modo === key;
                        return (
                            <button key={key}
                                onClick={() => !disabled && setModo(key)}
                                disabled={disabled}
                                style={{
                                display: 'flex', alignItems: 'center', gap: 14, padding: '12px 16px',
                                borderRadius: 12, cursor: disabled ? 'not-allowed' : 'pointer',
                                textAlign: 'left', width: '100%',
                                border: `2px solid ${activo ? color : 'var(--border-default)'}`,
                                background: disabled ? 'rgba(255,255,255,0.03)' : activo ? `${color}14` : 'var(--bg-elevated)',
                                opacity: disabled ? 0.45 : 1,
                                transition: 'all 0.15s',
                            }}>
                                <div style={{
                                    width: 36, height: 36, borderRadius: 9, flexShrink: 0,
                                    background: activo ? `${color}22` : 'rgba(255,255,255,0.05)',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                }}>
                                    <Icon size={17} color={activo ? color : 'var(--text-muted)'} />
                                </div>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ fontWeight: 700, fontSize: 14,
                                                  color: activo ? color : 'var(--text-primary)' }}>
                                        {titulo}
                                    </div>
                                    <div style={{ fontSize: 12, color: activo ? color : 'var(--text-muted)',
                                                  opacity: activo ? 0.8 : 1 }}>
                                        {subtitulo}
                                    </div>
                                </div>
                                {activo && (
                                    <div style={{ width: 18, height: 18, borderRadius: '50%',
                                                  background: color, flexShrink: 0,
                                                  display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                        <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
                                            <path d="M1 4l2.5 2.5L9 1" stroke="#151515" strokeWidth="2"
                                                  strokeLinecap="round" strokeLinejoin="round"/>
                                        </svg>
                                    </div>
                                )}
                            </button>
                        );
                    })}

                    {/* Selector de fecha personalizada */}
                    {modo === 'custom' && (
                        <div style={{ padding: '10px 16px', background: 'var(--bg-elevated)',
                                      borderRadius: 10, border: '1px solid var(--border-default)',
                                      display: 'flex', alignItems: 'center', gap: 10 }}>
                            <span style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600,
                                           whiteSpace: 'nowrap' }}>
                                Fecha:
                            </span>
                            <DateInput value={customDate} onChange={setCustomDate} height={36}
                                       style={{ flex: 1 }} />
                        </div>
                    )}
                </div>

                {/* Resumen fecha elegida */}
                <div style={{ margin: '0 22px', padding: '10px 14px', borderRadius: 10,
                              background: 'var(--brand-muted)', border: '1px solid var(--border-brand)',
                              display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Calendar size={13} color="var(--brand)" />
                    <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--brand)' }}>
                        Pedido programado para: {formatDateLabel(fechaSeleccionada)}
                    </span>
                </div>

                {/* Botones */}
                <div style={{ padding: '16px 22px', display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                    <button className="btn btn-secondary" onClick={onCancel}>
                        Cancelar
                    </button>
                    <button className="btn btn-primary"
                            onClick={() => onConfirm(fechaSeleccionada)}
                            style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                        <Save size={14} />
                        Confirmar pedido
                    </button>
                </div>
            </div>
        </div>
    );
}

const FMT = (v) => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(v || 0);

const STATUS_CONFIG = {
    pendiente:   { label: '⏳ Pendiente',   color: '#ffdd19' },
    por_cobrar:  { label: '🚚 Por cobrar',  color: '#3b82f6' },
    pagado:      { label: '✅ Pagado',      color: '#10b981' },
    cancelado:   { label: '❌ Cancelado',   color: '#ef4444' },
};

export default function OrderForm() {
    const navigate = useNavigate();
    const { id } = useParams();
    const isEditing = Boolean(id);

    const [clients, setClients]     = useState([]);
    const [products, setProducts]   = useState([]);
    const [loading, setLoading]     = useState(true);
    const [selectedClient, setSelectedClient] = useState('');
    const [quantities, setQuantities] = useState({});
    const [prices, setPrices]         = useState({});
    const [deliveryFee, setDeliveryFee] = useState(0);
    const [preciosEspeciales, setPreciosEspeciales] = useState({}); // { producto_id: precio }
    const [searchTerm, setSearchTerm]   = useState('');
    const [submitting, setSubmitting]   = useState(false);
    const [status, setStatus]           = useState('pendiente');
    const [date, setDate]               = useState(todayBogota());

    useEffect(() => { loadData(); }, [id]);

    const loadData = async () => {
        setLoading(true);
        try {
            const [cRes, pRes] = await Promise.all([clientsService.getAll(), productsService.getAll(true)]);
            setClients(cRes.data);
            setProducts(pRes.data);
            if (isEditing) {
                const orderRes = await ordersService.getById(id);
                const order = orderRes.data;
                setSelectedClient(order.cliente_id);
                setDeliveryFee(order.valor_domicilio || 0);
                setStatus(order.estado);
                if (order.fecha) setDate(order.fecha.split('T')[0]);
                const qtyMap = {}, priceMap = {};
                order.items.forEach(item => {
                    qtyMap[item.producto_id]   = item.cantidad;
                    priceMap[item.producto_id] = item.precio_aplicado;
                });
                setQuantities(qtyMap);
                setPrices(priceMap);
            }
        } catch (err) {
            if (isEditing) toast.error('Error al cargar pedido');
        } finally { setLoading(false); }
    };

    const handleQuantityChange = (productId, val) => {
        const qty = parseInt(val) || 0;
        setQuantities(prev => ({ ...prev, [productId]: qty }));
    };

    const handlePriceChange = (productId, val) => {
        const price = parseFloat(val);
        setPrices(prev => ({ ...prev, [productId]: isNaN(price) ? 0 : price }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!selectedClient) { toast.warning('Selecciona un cliente'); return; }
        const items = Object.entries(quantities)
            .filter(([, qty]) => qty > 0)
            .map(([pid, qty]) => {
                const product = products.find(p => p.id === parseInt(pid));
                const price = prices[pid] !== undefined ? prices[pid] : product?.precio;
                return { producto_id: parseInt(pid), cantidad: qty, precio: price };
            });
        if (items.length === 0) { toast.warning('Agrega al menos un producto'); return; }

        // Guardar directamente sin modal de fecha
        setSubmitting(true);
        try {
            const payload = {
                cliente_id: parseInt(selectedClient),
                items,
                valor_domicilio: parseFloat(deliveryFee) || 0,
                estado: status,
                fecha: date + 'T00:00:00',
            };
            if (isEditing) await ordersService.update(id, payload);
            else           await ordersService.create(payload);
            navigate('/orders');
        } catch (err) {
            const detail = err?.response?.data?.detail;
            const status = err?.response?.status;
            if (status === 409 && detail) {
                // Stock insuficiente — mostrar el detalle completo, sin auto-cierre
                toast.error(detail, { duration: 10000 });
            } else {
                toast.error(detail || 'Error al guardar pedido');
            }
        }
        finally  { setSubmitting(false); }
    };


    const filteredProducts = products.filter(p =>
        p.nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (p.codigo_corto || '').toLowerCase().includes(searchTerm.toLowerCase())
    );

    const totalProductos = products.reduce((acc, p) => {
        const qty   = quantities[p.id] || 0;
        const price = prices[p.id] !== undefined ? prices[p.id] : p.precio;
        return acc + qty * price;
    }, 0);
    const totalEstimado = totalProductos + (parseFloat(deliveryFee) || 0);
    const itemsSeleccionados = Object.values(quantities).filter(q => q > 0).length;
    const unidadesTotales   = Object.values(quantities).reduce((s, q) => s + (q || 0), 0);
    const clienteObj = clients.find(c => c.id === parseInt(selectedClient));

    if (loading) return (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: 300, gap: 12 }}>
            <div style={{ width: 36, height: 36, borderRadius: '50%', border: '3px solid var(--border)', borderTopColor: '#ffdd19', animation: 'spin 0.8s linear infinite' }} />
            <span style={{ color: 'var(--text-muted)', fontSize: 13 }}>Cargando pedido…</span>
        </div>
    );

    return (
        <div style={{ maxWidth: 920, margin: '0 auto', paddingBottom: 120 }}>
            <form onSubmit={handleSubmit}>

                {/* ── Header ──────────────────────────────────────────────── */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24, gap: 12 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <button type="button" onClick={() => navigate('/orders')}
                            style={{ width: 36, height: 36, borderRadius: 10, background: 'var(--bg-secondary)', border: '1px solid var(--border)', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.15s', flexShrink: 0 }}>
                            <ChevronLeft size={18} />
                        </button>
                        <div>
                            <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)' }}>
                                {isEditing ? `Pedido #${id}` : 'Nuevo pedido'}
                            </div>
                            <h1 style={{ margin: 0, fontSize: 22, fontWeight: 900, lineHeight: 1.1, color: 'var(--text)' }}>
                                {isEditing ? 'Editar Pedido' : 'Crear Pedido'}
                            </h1>
                        </div>
                    </div>

                    {/* Botón guardar — solo visible en desktop cuando hay items */}
                    {unidadesTotales > 0 && (
                        <button type="submit" disabled={submitting}
                            style={{
                                display: 'flex', alignItems: 'center', gap: 8, padding: '10px 22px',
                                fontSize: 14, fontWeight: 800, borderRadius: 10, border: 'none', cursor: submitting ? 'not-allowed' : 'pointer',
                                background: '#ffdd19', color: '#151515', transition: 'all 0.2s', flexShrink: 0,
                                boxShadow: '0 4px 14px rgba(255,221,25,0.3)',
                            }}>
                            <Save size={15} /> {submitting ? 'Guardando…' : isEditing ? 'Guardar cambios' : 'Crear pedido'}
                        </button>
                    )}
                </div>

                {/* ── Datos del pedido ────────────────────────────────────── */}
                <div className="card" style={{ marginBottom: 16, padding: 0, overflow: 'hidden', borderTop: '3px solid #ffdd19' }}>
                    <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ width: 28, height: 28, borderRadius: 8, background: 'rgba(255,221,25,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <User size={14} color="#ffdd19" />
                        </div>
                        <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>Datos del pedido</span>
                    </div>

                    <div style={{ padding: '16px 18px' }}>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr auto auto', gap: 14, alignItems: 'end' }}>

                            {/* Cliente */}
                            <div>
                                <label style={{ display: 'block', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)', marginBottom: 6 }}>
                                    Cliente *
                                </label>
                                <select value={selectedClient} onChange={async e => {
                                        const cid = e.target.value;
                                        setSelectedClient(cid);
                                        const c = clients.find(x => String(x.id) === cid);
                                        setDeliveryFee(c?.tarifa_domicilio || 0);
                                        // Cargar precios especiales del cliente
                                        setPreciosEspeciales({});
                                        if (cid) {
                                            try {
                                                const res = await clientsService.getPreciosCliente(parseInt(cid));
                                                const map = {};
                                                res.data.forEach(p => { if (p.tiene_especial) map[p.producto_id] = p.precio_especial; });
                                                setPreciosEspeciales(map);
                                                // Aplicar precios especiales al state de prices
                                                setPrices(prev => {
                                                    const next = { ...prev };
                                                    res.data.forEach(p => { if (p.tiene_especial) next[p.producto_id] = p.precio_especial; });
                                                    return next;
                                                });
                                            } catch { /* silent */ }
                                        }
                                    }} required
                                    className="form-control"
                                    style={{ fontWeight: 600, fontSize: 14, height: 42, borderRadius: 9 }}>
                                    <option value="">Seleccionar cliente…</option>
                                    {clients.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                                </select>
                            </div>

                            {/* Fecha editable */}
                            <div>
                                <label style={{ display: 'block', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)', marginBottom: 6 }}>
                                    Fecha
                                </label>
                                <DateInput value={date} onChange={setDate} height={42} style={{ width: '100%' }} />
                            </div>

                            {/* Domicilio (solo lectura, viene del cliente) */}
                            {deliveryFee > 0 && (
                                <div>
                                    <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)', marginBottom: 6 }}>
                                        <Truck size={11} /> Domicilio
                                    </label>
                                    <div style={{ display: 'flex', alignItems: 'center', height: 42, background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 9, paddingLeft: 12, paddingRight: 12, fontWeight: 700, fontSize: 14, color: 'var(--brand)' }}>
                                        {new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(deliveryFee)}
                                    </div>
                                </div>
                            )}
                        </div>

                        {isEditing && (
                            <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid var(--border)' }}>
                                <label style={{ display: 'block', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)', marginBottom: 8 }}>Estado</label>
                                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                                    {Object.entries(STATUS_CONFIG).map(([val, cfg]) => (
                                        <button key={val} type="button" onClick={() => setStatus(val)}
                                            style={{
                                                padding: '6px 14px', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer', transition: 'all 0.15s',
                                                background: status === val ? cfg.color + '22' : 'var(--bg-secondary)',
                                                border: `1.5px solid ${status === val ? cfg.color : 'var(--border)'}`,
                                                color: status === val ? cfg.color : 'var(--text-muted)',
                                            }}>
                                            {cfg.label}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* ── Resumen selección ────────────────────────────────────── */}
                {unidadesTotales > 0 && (
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 16px', background: 'rgba(255,221,25,0.07)', border: '1.5px solid rgba(255,221,25,0.25)', borderRadius: 12, marginBottom: 14 }}>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, fontSize: 13 }}>
                            <span style={{ display: 'flex', alignItems: 'center', gap: 4, color: 'var(--text-muted)' }}>
                                <ShoppingCart size={13} style={{ color: '#ffdd19' }} />
                                <strong style={{ color: 'var(--text)' }}>{itemsSeleccionados}</strong> producto{itemsSeleccionados !== 1 ? 's' : ''} ·
                                <strong style={{ color: 'var(--text)' }}>{unidadesTotales}</strong> unidades
                            </span>
                            {deliveryFee > 0 && (
                                <span style={{ color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 4 }}>
                                    <Truck size={13} style={{ color: '#ffdd19' }} />
                                    <strong style={{ color: 'var(--text)' }}>{FMT(deliveryFee)}</strong>
                                </span>
                            )}
                        </div>
                        <div style={{ fontSize: 20, fontWeight: 900, color: '#ffdd19', whiteSpace: 'nowrap' }}>{FMT(totalEstimado)}</div>
                    </div>
                )}

                {/* ── Cabecera catálogo ────────────────────────────────────── */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, gap: 12 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ width: 28, height: 28, borderRadius: 8, background: 'rgba(255,221,25,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <Package size={14} color="#ffdd19" />
                        </div>
                        <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>
                            Catálogo
                            {filteredProducts.length !== products.length && (
                                <span style={{ marginLeft: 6, fontSize: 12, color: 'var(--text-muted)', fontWeight: 500 }}>
                                    ({filteredProducts.length} de {products.length})
                                </span>
                            )}
                        </span>
                    </div>

                    {/* Buscador */}
                    <div style={{ position: 'relative', flex: 1, maxWidth: 320 }}>
                        <Search size={14} style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />
                        <input
                            type="text"
                            placeholder="Buscar por nombre o código…"
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                            style={{ width: '100%', paddingLeft: 34, paddingRight: searchTerm ? 32 : 12, height: 38, background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 10, fontSize: 13, color: 'var(--text)', outline: 'none', boxSizing: 'border-box' }}
                        />
                        {searchTerm && (
                            <button type="button" onClick={() => setSearchTerm('')}
                                style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', padding: 0 }}>
                                <X size={14} />
                            </button>
                        )}
                    </div>
                </div>

                {/* ── Grid de productos ────────────────────────────────────── */}
                {filteredProducts.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--text-muted)' }}>
                        <Package size={36} style={{ opacity: 0.2, marginBottom: 10 }} />
                        <div style={{ fontSize: 14, fontWeight: 500 }}>No se encontraron productos</div>
                        {searchTerm && <div style={{ fontSize: 13, marginTop: 4 }}>Intenta con otro término de búsqueda</div>}
                    </div>
                ) : (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(190px, 1fr))', gap: 10 }}>
                        {filteredProducts.map(p => {
                            const qty         = quantities[p.id] || 0;
                            const priceVal    = prices[p.id] !== undefined ? prices[p.id] : p.precio;
                            const esEspecial  = preciosEspeciales[p.id] !== undefined;
                            const modified    = prices[p.id] !== undefined && prices[p.id] !== p.precio;
                            const subtotal = qty * priceVal;
                            const activo   = qty > 0;

                            return (
                                <div key={p.id}
                                    style={{
                                        background: activo ? 'rgba(255,221,25,0.07)' : 'var(--bg-card)',
                                        border: activo ? '2px solid rgba(255,221,25,0.7)' : '1px solid var(--border)',
                                        borderRadius: 14,
                                        padding: '13px 12px 11px',
                                        display: 'flex',
                                        flexDirection: 'column',
                                        gap: 9,
                                        transition: 'all 0.15s',
                                        position: 'relative',
                                    }}>

                                    {/* Badge qty */}
                                    {activo && (
                                        <div style={{ position: 'absolute', top: -9, right: -9, width: 22, height: 22, borderRadius: '50%', background: '#ffdd19', color: '#151515', fontSize: 11, fontWeight: 900, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 6px rgba(255,221,25,0.5)' }}>
                                            {qty}
                                        </div>
                                    )}

                                    {/* Nombre + código */}
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 5 }}>
                                        <span style={{ fontWeight: 800, fontSize: 13, lineHeight: 1.25, color: activo ? '#ffdd19' : 'var(--text)', flex: 1 }}>
                                            {p.nombre}
                                        </span>
                                        {esEspecial && (
                                            <span title="Precio especial para este cliente" style={{ fontSize: 9, fontWeight: 800, background: 'rgba(255,162,15,0.18)', color: '#ffa20f', borderRadius: 5, padding: '2px 5px', flexShrink: 0, textTransform: 'uppercase', letterSpacing: '0.03em' }}>
                                                ★ Esp.
                                            </span>
                                        )}
                                        {!esEspecial && p.codigo_corto && (
                                            <span style={{ fontSize: 10, fontWeight: 700, background: activo ? 'rgba(255,221,25,0.15)' : 'var(--bg-secondary)', color: activo ? '#ffdd19' : 'var(--text-muted)', borderRadius: 5, padding: '2px 5px', flexShrink: 0, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                                                {p.codigo_corto}
                                            </span>
                                        )}
                                    </div>

                                    {/* Precio editable */}
                                    <div style={{ display: 'flex', alignItems: 'center', background: 'var(--bg-secondary)', borderRadius: 8, overflow: 'hidden', border: `1px solid ${modified ? 'rgba(255,221,25,0.5)' : 'var(--border)'}` }}>
                                        <span style={{ padding: '0 6px 0 8px', fontSize: 13, fontWeight: 800, color: modified ? '#ffdd19' : 'var(--text-muted)', userSelect: 'none' }}>$</span>
                                        <input
                                            type="number"
                                            inputMode="numeric"
                                            min="0"
                                            max="9999999"
                                            step="50"
                                            value={priceVal}
                                            onChange={e => handlePriceChange(p.id, e.target.value)}
                                            style={{
                                                background: 'transparent', border: 'none', outline: 'none',
                                                width: '100%', minWidth: 0,
                                                fontSize: 14, fontWeight: 700,
                                                color: modified ? '#ffdd19' : 'var(--text)',
                                                padding: '6px 6px 6px 0',
                                                appearance: 'textfield',
                                                MozAppearance: 'textfield',
                                            }}
                                        />
                                    </div>

                                    {/* Selector cantidad */}
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                                        <button type="button"
                                            onClick={() => handleQuantityChange(p.id, Math.max(0, qty - 1))}
                                            style={{ width: 28, height: 28, borderRadius: 7, border: `1px solid ${activo ? 'rgba(255,221,25,0.4)' : 'var(--border)'}`, background: activo ? 'rgba(255,221,25,0.12)' : 'var(--bg-secondary)', color: activo ? '#ffdd19' : 'var(--text-muted)', cursor: 'pointer', fontSize: 16, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, transition: 'all 0.1s' }}>
                                            −
                                        </button>
                                        <input
                                            type="number" min="0"
                                            value={qty || ''}
                                            placeholder="0"
                                            onChange={e => handleQuantityChange(p.id, e.target.value)}
                                            style={{ flex: 1, textAlign: 'center', height: 28, background: activo ? 'rgba(255,221,25,0.1)' : 'var(--bg-secondary)', border: `1px solid ${activo ? 'rgba(255,221,25,0.45)' : 'var(--border)'}`, borderRadius: 7, fontSize: 15, fontWeight: 900, color: activo ? '#ffdd19' : 'var(--text)', outline: 'none' }}
                                        />
                                        <button type="button"
                                            onClick={() => handleQuantityChange(p.id, qty + 1)}
                                            style={{ width: 28, height: 28, borderRadius: 7, border: `1px solid ${activo ? 'rgba(255,221,25,0.4)' : 'var(--border)'}`, background: activo ? 'rgba(255,221,25,0.12)' : 'var(--bg-secondary)', color: activo ? '#ffdd19' : 'var(--text-muted)', cursor: 'pointer', fontSize: 16, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, transition: 'all 0.1s' }}>
                                            +
                                        </button>
                                    </div>

                                    {/* Subtotal */}
                                    {activo && (
                                        <div style={{ textAlign: 'right', fontSize: 12, fontWeight: 800, color: '#ffdd19', borderTop: '1px solid rgba(255,221,25,0.2)', paddingTop: 7, letterSpacing: '0.01em' }}>
                                            {FMT(subtotal)}
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}

                {/* ── Total sticky ────────────────────────────────────────── */}
                {unidadesTotales > 0 && (
                    <div style={{ position: 'sticky', bottom: 0, marginTop: 20, background: '#ffdd19', borderRadius: '16px 16px 0 0', padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', boxShadow: '0 -4px 24px rgba(255,221,25,0.35)', gap: 12 }}>
                        <div style={{ minWidth: 0 }}>
                            <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'rgba(21,21,21,0.6)', marginBottom: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {unidadesTotales} uds · {itemsSeleccionados} prod{clienteObj ? ` · ${clienteObj.nombre}` : ''}
                            </div>
                            <div style={{ fontSize: 22, fontWeight: 900, color: '#151515', lineHeight: 1, letterSpacing: '-0.02em' }}>{FMT(totalEstimado)}</div>
                        </div>
                        <button type="submit" disabled={submitting}
                            style={{ padding: '10px 20px', fontSize: 14, fontWeight: 800, borderRadius: 11, background: '#000', color: '#ffdd19', border: 'none', cursor: submitting ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: 7, boxShadow: '0 2px 10px rgba(0,0,0,0.25)', flexShrink: 0, whiteSpace: 'nowrap' }}>
                            <Save size={15} /> {submitting ? 'Guardando…' : isEditing ? 'Guardar' : 'Crear pedido'}
                        </button>
                    </div>
                )}

            </form>

        </div>
    );
}

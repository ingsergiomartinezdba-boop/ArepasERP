import { useState, useEffect } from 'react';
import { clientsService, parametrosService } from '../services/api';
import api from '../services/api';
import { Plus, Edit, Phone, MapPin, Save, X, Trash2, Navigation, Link, PlusCircle, Tag, LineChart } from 'lucide-react';
import { toast } from 'sonner';
import PermissionGate from '../components/PermissionGate';
import { formatDateTime } from '../utils/formatters';

/* ─── Utilidades ─────────────────────────────────────────────── */
function parseGoogleMapsUrl(url) {
    if (!url) return null;
    let m = url.match(/@(-?\d+\.?\d+),(-?\d+\.?\d+)/);
    if (m) return { lat: parseFloat(m[1]), lng: parseFloat(m[2]) };
    m = url.match(/[?&]q=(-?\d+\.?\d+),(-?\d+\.?\d+)/);
    if (m) return { lat: parseFloat(m[1]), lng: parseFloat(m[2]) };
    return null;
}

const toFloat = (v) => (v !== '' && v != null && !isNaN(parseFloat(v)) ? parseFloat(v) : null);
const buildMapsUrl = (lat, lng) => (lat && lng ? `https://maps.google.com/?q=${lat},${lng}` : null);

/** Un registro vacío de detalle de contacto */
const emptyDetalle = (principal = false) => ({
    telefono: '', direccion: '', lat: null, lng: null, maps_url: '', es_principal: principal,
});

const EMPTY_CLIENT = {
    nombre: '', tipo_documento: '', documento: '', tipo_cliente: 'local', ciudad: 'Bogotá',
    canal_venta: 'domicilio', condicion_pago: 'contado', cupo_credito: 0, tarifa_domicilio: 0,
    mostrar_saldo_whatsapp: true,
    detalles: [emptyDetalle(true)],
};

/* ─── Sección del formulario ─────────────────────────────────── */
const Section = ({ title, color = 'var(--brand)', children, action }) => (
    <div className="card mb-4">
        <div className="flex justify-between items-center mb-4">
            <span style={{ fontSize: '0.72rem', fontWeight: 700, color, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                {title}
            </span>
            {action}
        </div>
        {children}
    </div>
);

/* ─── Fila de un detalle de contacto ─────────────────────────── */
const DetalleRow = ({ d, i, total, onUpdate, onRemove, onSetPrincipal, onMapsLink }) => (
    <div className="mb-3 p-3" style={{ border: '1px solid rgba(255,255,255,0.07)', borderRadius: 10, background: 'rgba(255,255,255,0.015)' }}>
        <div className="flex justify-between items-center mb-3">
            <label style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: '0.72rem', color: d.es_principal ? 'var(--brand)' : 'var(--text-muted)', cursor: 'pointer' }}>
                <input type="radio" name="det_principal" checked={!!d.es_principal} onChange={() => onSetPrincipal(i)} style={{ accentColor: 'var(--brand)' }} />
                {d.es_principal ? 'Principal ★' : 'Secundario'}
            </label>
            {total > 1 && (
                <button type="button" onClick={() => onRemove(i)} className="btn btn-secondary text-danger" style={{ padding: '0.2rem 0.5rem', fontSize: '0.7rem' }}>
                    <X size={12} />
                </button>
            )}
        </div>

        {/* Teléfono */}
        <div className="form-group">
            <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Teléfono</label>
            <div style={{ position: 'relative' }}>
                <Phone size={13} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                <input type="tel" className="form-control" value={d.telefono || ''}
                    onChange={e => onUpdate(i, 'telefono', e.target.value)}
                    placeholder="Ej: 3001234567"
                    style={{ paddingLeft: 30 }} />
            </div>
        </div>

        {/* Dirección */}
        <div className="form-group">
            <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Dirección</label>
            <input className="form-control" value={d.direccion || ''}
                onChange={e => onUpdate(i, 'direccion', e.target.value)}
                placeholder="Ej: Calle 123 #45-67" />
        </div>

        {/* Link Google Maps */}
        <div className="form-group">
            <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Link Google Maps</label>
            <div style={{ position: 'relative' }}>
                <Link size={13} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                <input className="form-control" value={d.maps_url || ''}
                    onChange={e => onMapsLink(i, e.target.value)}
                    placeholder="Pegar link de Google Maps"
                    style={{ paddingLeft: 30 }} />
            </div>
        </div>

        {/* Lat / Lng */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
            <div className="form-group" style={{ marginBottom: 0 }}>
                <label style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Latitud</label>
                <input className="form-control" type="number" step="any" value={d.lat ?? ''}
                    onChange={e => onUpdate(i, 'lat', e.target.value ? parseFloat(e.target.value) : null)}
                    placeholder="4.6097" style={{ fontSize: '0.82rem' }} />
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
                <label style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Longitud</label>
                <input className="form-control" type="number" step="any" value={d.lng ?? ''}
                    onChange={e => onUpdate(i, 'lng', e.target.value ? parseFloat(e.target.value) : null)}
                    placeholder="-74.0817" style={{ fontSize: '0.82rem' }} />
            </div>
        </div>

        {d.maps_url && (
            <a href={d.maps_url} target="_blank" rel="noreferrer"
                style={{ fontSize: '0.75rem', display: 'inline-flex', alignItems: 'center', gap: 4, marginTop: 8, color: 'var(--brand)' }}>
                <Navigation size={11} /> Ver en Google Maps
            </a>
        )}
    </div>
);

/* ════════════════════════════════════════════════════════════════
   COMPONENTE PRINCIPAL
════════════════════════════════════════════════════════════════ */
const FMT = (v) => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(v || 0);

export default function Clients() {
    const [clients, setClients] = useState([]);
    const [tiposCliente, setTiposCliente] = useState([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [editingClient, setEditingClient] = useState(null);

    useEffect(() => {
        parametrosService.getTiposCliente(true).then(r => setTiposCliente(r.data)).catch(() => {});
    }, []);

    // Precios especiales
    const [preciosData, setPreciosData] = useState([]);   // [{ producto_id, producto_nombre, precio_base, precio_especial|null }]
    const [preciosMap, setPreciosMap]   = useState({});   // { producto_id: string }
    const [savingPrecios, setSavingPrecios] = useState(false);

    // Módulo analítica premium
    const [analyticsModal, setAnalyticsModal] = useState(null); // { client, status, historial }
    const [savingAnalytics, setSavingAnalytics] = useState(false);
    const [analyticsForm, setAnalyticsForm] = useState({ dias: 30, monto: 10000, medio_pago: '', referencia: '', observaciones: '' });

    useEffect(() => { loadClients(); }, []);

    const loadClients = async () => {
        setLoading(true);
        try { const res = await clientsService.getAll(); setClients(res.data); }
        catch { /* silent */ }
        finally { setLoading(false); }
    };

    /* ── mutadores de detalles ── */
    const updateDetalle = (i, field, val) =>
        setEditingClient(c => ({ ...c, detalles: c.detalles.map((d, idx) => idx === i ? { ...d, [field]: val } : d) }));

    const setPrincipal = (i) =>
        setEditingClient(c => ({ ...c, detalles: c.detalles.map((d, idx) => ({ ...d, es_principal: idx === i })) }));

    const removeDetalle = (i) =>
        setEditingClient(c => ({ ...c, detalles: c.detalles.filter((_, idx) => idx !== i) }));

    const addDetalle = () =>
        setEditingClient(c => ({ ...c, detalles: [...c.detalles, emptyDetalle()] }));

    const handleMapsLink = (i, url) => {
        const coords = parseGoogleMapsUrl(url);
        setEditingClient(c => ({
            ...c,
            detalles: c.detalles.map((d, idx) =>
                idx === i ? { ...d, maps_url: url, ...(coords ? { lat: coords.lat, lng: coords.lng } : {}) } : d
            ),
        }));
    };

    /* ── guardar ── */
    const handleSave = async (e) => {
        e.preventDefault();
        if (!editingClient.nombre?.trim()) { toast.warning("El nombre es requerido"); return; }

        const detalles = editingClient.detalles
            .filter(d => d.telefono?.trim() || d.direccion?.trim())
            .map(d => {
                const lat = toFloat(d.lat);
                const lng = toFloat(d.lng);
                return {
                    telefono: d.telefono?.trim() || null,
                    direccion: d.direccion?.trim() || null,
                    lat,
                    lng,
                    maps_url: d.maps_url || buildMapsUrl(lat, lng) || null,
                    es_principal: d.es_principal || false,
                };
            });

        const payload = {
            nombre: editingClient.nombre,
            tipo_documento: editingClient.tipo_documento || null,
            documento: editingClient.documento || null,
            tipo_cliente: editingClient.tipo_cliente,
            ciudad: editingClient.ciudad,
            canal_venta: editingClient.canal_venta || null,
            condicion_pago: editingClient.condicion_pago || 'contado',
            cupo_credito: editingClient.condicion_pago === 'credito' ? (editingClient.cupo_credito || 0) : 0,
            tarifa_domicilio: editingClient.tarifa_domicilio || 0,
            mostrar_saldo_whatsapp: editingClient.mostrar_saldo_whatsapp !== false,
            detalles,
        };

        setSaving(true);
        try {
            if (editingClient.id) {
                await clientsService.update(editingClient.id, payload);
                toast.success("Cliente actualizado");
            } else {
                await clientsService.create(payload);
                toast.success("Cliente creado");
            }
            setEditingClient(null);
            loadClients();
        } catch (err) {
            console.error(err);
            toast.error(err.response?.data?.detail || "Error al guardar cliente");
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (id) => {
        if (!confirm('¿Eliminar este cliente? Solo es posible si no tiene pedidos.')) return;
        try { await clientsService.delete(id); loadClients(); }
        catch (error) { toast.error(error.response?.data?.detail || "Error al eliminar"); }
    };

    const startEdit = async (client) => {
        const detalles = client.detalles?.length ? client.detalles : [emptyDetalle(true)];
        setEditingClient({ ...client, detalles });
        setPreciosData([]);
        setPreciosMap({});
        if (client.id) {
            try {
                const res = await clientsService.getPreciosCliente(client.id);
                setPreciosData(res.data);
                const map = {};
                res.data.forEach(p => { if (p.precio_especial != null) map[p.producto_id] = String(p.precio_especial); });
                setPreciosMap(map);
            } catch { /* silent */ }
        }
    };

    const handleSavePrecios = async () => {
        if (!editingClient?.id) return;
        setSavingPrecios(true);
        try {
            const items = Object.entries(preciosMap)
                .filter(([, v]) => v !== '' && parseFloat(v) > 0)
                .map(([pid, v]) => ({ producto_id: parseInt(pid), precio_especial: parseFloat(v) }));
            await clientsService.setPreciosCliente(editingClient.id, items);
            toast.success('Precios especiales guardados');
            // Recargar para reflejar cambios
            const res = await clientsService.getPreciosCliente(editingClient.id);
            setPreciosData(res.data);
        } catch { toast.error('Error al guardar precios'); }
        finally { setSavingPrecios(false); }
    };

    /* ── Módulo Analítica premium ────────────────────────── */
    const openAnalyticsModal = async (client) => {
        try {
            const h = await api.get(`/clients/${client.id}/analytics/historial`);
            setAnalyticsModal({
                client,
                enabled:      !!client.analytics_enabled,
                expires_at:   client.analytics_expires_at,
                activated_at: client.analytics_activated_at,
                historial:    h.data,
            });
            setAnalyticsForm({ dias: 30, monto: 10000, medio_pago: '', referencia: '', observaciones: '' });
        } catch {
            toast.error('No se pudo cargar el historial');
        }
    };

    const handleActivarAnalytics = async () => {
        if (!analyticsModal?.client) return;
        setSavingAnalytics(true);
        try {
            await api.post(`/clients/${analyticsModal.client.id}/analytics/activar`, {
                dias:          parseInt(analyticsForm.dias, 10) || 30,
                monto:         parseFloat(analyticsForm.monto) || 0,
                medio_pago:    analyticsForm.medio_pago || null,
                referencia:    analyticsForm.referencia || null,
                observaciones: analyticsForm.observaciones || null,
            });
            toast.success(`Analítica activada por ${analyticsForm.dias} días`);
            setAnalyticsModal(null);
            loadClients();
        } catch (e) {
            toast.error(e?.response?.data?.detail || 'Error al activar');
        } finally {
            setSavingAnalytics(false);
        }
    };

    const handleDesactivarAnalytics = async () => {
        if (!analyticsModal?.client) return;
        if (!confirm('¿Desactivar el módulo analítica para este cliente?')) return;
        setSavingAnalytics(true);
        try {
            await api.post(`/clients/${analyticsModal.client.id}/analytics/desactivar`);
            toast.success('Analítica desactivada');
            setAnalyticsModal(null);
            loadClients();
        } catch (e) {
            toast.error(e?.response?.data?.detail || 'Error al desactivar');
        } finally {
            setSavingAnalytics(false);
        }
    };

    /* ════════════════════════════════════════════
       FORMULARIO
    ════════════════════════════════════════════ */
    if (editingClient) {
        const { nombre, documento, tipo_documento, tipo_cliente, ciudad, canal_venta,
            condicion_pago, cupo_credito, tarifa_domicilio, mostrar_saldo_whatsapp, detalles } = editingClient;

        const set = (field) => (e) =>
            setEditingClient(c => ({ ...c, [field]: e.target ? e.target.value : e }));
        const setCheck = (field) => (e) =>
            setEditingClient(c => ({ ...c, [field]: e.target.checked }));

        return (
            <div style={{ position: 'relative', maxWidth: 680, margin: '0 auto' }}>
                <button onClick={() => setEditingClient(null)} className="btn-close-modal" title="Cerrar">
                    <X size={18} />
                </button>
                <h1 className="m-0 mb-5">{editingClient.id ? 'Editar Cliente' : 'Nuevo Cliente'}</h1>

                <form onSubmit={handleSave}>
                    {/* Datos básicos */}
                    <Section title="Datos Básicos">
                        <div className="form-group">
                            <label>Nombre Completo *</label>
                            <input className="form-control" value={nombre} onChange={set('nombre')} required placeholder="Ej: Distribuidora Central" />
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                            <div className="form-group">
                                <label>Tipo Documento</label>
                                <select className="form-control" value={tipo_documento || ''} onChange={set('tipo_documento')}>
                                    <option value="">— Sin documento —</option>
                                    <option value="CC">Cédula (CC)</option>
                                    <option value="NIT">NIT</option>
                                    <option value="CE">Cédula Extranjería (CE)</option>
                                    <option value="PAS">Pasaporte</option>
                                </select>
                            </div>
                            <div className="form-group">
                                <label>Número de Documento</label>
                                <input className="form-control" value={documento || ''} onChange={set('documento')} placeholder="Ej: 900123456-1" />
                            </div>
                            <div className="form-group">
                                <label>Tipo de Cliente</label>
                                <select className="form-control" value={tipo_cliente || ''} onChange={set('tipo_cliente')}>
                                    <option value="">— Seleccionar —</option>
                                    {tiposCliente.map(t => (
                                        <option key={t.codigo} value={t.codigo}>{t.nombre}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="form-group">
                                <label>Canal de Venta</label>
                                <select className="form-control" value={canal_venta || 'domicilio'} onChange={set('canal_venta')}>
                                    <option value="domicilio">Domicilio</option>
                                    <option value="whatsapp">WhatsApp</option>
                                    <option value="local">Punto Físico</option>
                                    <option value="distribuidor">Distribuidor</option>
                                </select>
                            </div>
                            <div className="form-group">
                                <label>Condición de Pago</label>
                                <select className="form-control" value={condicion_pago || 'contado'} onChange={set('condicion_pago')}>
                                    <option value="contado">Contado</option>
                                    <option value="credito">Crédito</option>
                                </select>
                            </div>
                            <div className="form-group">
                                <label>Cupo de Crédito</label>
                                <input type="number" className="form-control" value={cupo_credito || 0}
                                    onChange={e => setEditingClient(c => ({ ...c, cupo_credito: parseFloat(e.target.value) || 0 }))}
                                    placeholder="0" min="0" step="1000"
                                    disabled={condicion_pago !== 'credito'}
                                    style={{ opacity: condicion_pago !== 'credito' ? 0.4 : 1 }} />
                            </div>
                            <div className="form-group">
                                <label>Tarifa Domicilio</label>
                                <input type="number" className="form-control" value={tarifa_domicilio || 0}
                                    onChange={e => setEditingClient(c => ({ ...c, tarifa_domicilio: parseFloat(e.target.value) || 0 }))}
                                    placeholder="0" min="0" step="500" />
                            </div>
                            <div className="form-group">
                                <label>Ciudad</label>
                                <input className="form-control" value={ciudad || ''} onChange={set('ciudad')} placeholder="Ej: Bogotá" />
                            </div>
                        </div>
                        <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.85rem', cursor: 'pointer', marginTop: 8 }}>
                            <input type="checkbox" checked={mostrar_saldo_whatsapp !== false} onChange={setCheck('mostrar_saldo_whatsapp')}
                                style={{ width: '1.1rem', height: '1.1rem', accentColor: 'var(--brand)' }} />
                            Mostrar saldo pendiente en reporte WhatsApp
                        </label>
                    </Section>

                    {/* Información de Contacto */}
                    <Section title="Información de Contacto" action={
                        <button type="button" onClick={addDetalle} className="btn btn-secondary"
                            style={{ padding: '0.2rem 0.6rem', fontSize: '0.72rem', display: 'flex', alignItems: 'center', gap: 4 }}>
                            <PlusCircle size={12} /> Agregar
                        </button>
                    }>
                        <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '0.75rem', marginTop: 0 }}>
                            Cada registro puede tener teléfono y/o dirección. Puedes agregar múltiples registros por cliente.
                        </p>
                        {detalles.map((d, i) => (
                            <DetalleRow key={i} d={d} i={i} total={detalles.length}
                                onUpdate={updateDetalle} onRemove={removeDetalle}
                                onSetPrincipal={setPrincipal} onMapsLink={handleMapsLink} />
                        ))}
                    </Section>

                    {/* Precios Especiales — solo cuando se edita cliente existente */}
                    {editingClient.id && (
                        <Section title="Precios Especiales por Producto" color="var(--secondary, #ffa20f)"
                            action={
                                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                                    Vacío = precio estándar
                                </span>
                            }>
                            {preciosData.length === 0 ? (
                                <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem', textAlign: 'center', padding: '12px 0' }}>
                                    Cargando productos…
                                </div>
                            ) : (
                                <>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 320, overflowY: 'auto' }}>
                                        {preciosData.map(p => {
                                            const val = preciosMap[p.producto_id] ?? '';
                                            const tieneEspecial = val !== '' && parseFloat(val) > 0;
                                            return (
                                                <div key={p.producto_id} style={{ display: 'grid', gridTemplateColumns: '1fr auto auto', gap: 10, alignItems: 'center', padding: '6px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                                                    <div>
                                                        <div style={{ fontWeight: 600, fontSize: '0.85rem' }}>{p.producto_nombre}</div>
                                                        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                                                            Precio estándar: {FMT(p.precio_base)}
                                                        </div>
                                                    </div>
                                                    <div style={{ display: 'flex', alignItems: 'center', background: 'var(--bg-elevated)', border: `1px solid ${tieneEspecial ? 'rgba(255,162,15,0.5)' : 'var(--border)'}`, borderRadius: 8, overflow: 'hidden', width: 130 }}>
                                                        <span style={{ padding: '0 8px', fontSize: 12, fontWeight: 700, color: tieneEspecial ? '#ffa20f' : 'var(--text-muted)', userSelect: 'none' }}>$</span>
                                                        <input
                                                            type="number" min="0" step="50"
                                                            value={val}
                                                            placeholder={String(Math.round(p.precio_base))}
                                                            onChange={e => setPreciosMap(m => ({ ...m, [p.producto_id]: e.target.value }))}
                                                            style={{ background: 'transparent', border: 'none', outline: 'none', width: '100%', fontSize: 13, fontWeight: 700, color: tieneEspecial ? '#ffa20f' : 'var(--text)', padding: '6px 8px 6px 0' }}
                                                        />
                                                    </div>
                                                    {tieneEspecial && (
                                                        <button type="button" onClick={() => setPreciosMap(m => { const n = { ...m }; delete n[p.producto_id]; return n; })}
                                                            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 4 }}>
                                                            <X size={13} />
                                                        </button>
                                                    )}
                                                    {!tieneEspecial && <div />}
                                                </div>
                                            );
                                        })}
                                    </div>
                                    <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 12 }}>
                                        <button type="button" onClick={handleSavePrecios} disabled={savingPrecios}
                                            className="btn btn-secondary"
                                            style={{ display: 'flex', alignItems: 'center', gap: 6, borderColor: 'rgba(255,162,15,0.4)', color: '#ffa20f' }}>
                                            <Tag size={13} /> {savingPrecios ? 'Guardando…' : 'Guardar Precios'}
                                        </button>
                                    </div>
                                </>
                            )}
                        </Section>
                    )}

                    <div className="mb-8">
                        <button type="submit" className="btn btn-primary font-bold"
                            style={{ width: 'auto', padding: '0.8rem 2rem' }}
                            disabled={saving}>
                            {saving
                                ? <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                    <span style={{ width: 14, height: 14, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: 'white', borderRadius: '50%', animation: 'spin 0.7s linear infinite', display: 'inline-block' }} />
                                    Guardando...
                                  </span>
                                : <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                    <Save size={16} />
                                    {editingClient.id ? 'Guardar Cambios' : 'Crear Cliente'}
                                  </span>
                            }
                        </button>
                    </div>
                </form>
            </div>
        );
    }

    /* ════════════════════════════════════════════
       LISTADO
    ════════════════════════════════════════════ */
    return (
        <div>
            <div className="page-header flex justify-between items-center mb-6">
                <h1 className="m-0">Clientes</h1>
                <button onClick={() => setEditingClient({ ...EMPTY_CLIENT })} className="btn btn-primary"
                    style={{ width: 'auto', padding: '0.6rem 1.2rem', display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Plus size={18} /> Nuevo Cliente
                </button>
            </div>

            <div className="card overflow-x-auto">
                <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 680 }}>
                    <thead>
                        <tr style={{ borderBottom: '1px solid var(--border)', textAlign: 'left' }}>
                            <th className="p-3">Cliente</th>
                            <th className="p-3">Documento</th>
                            <th className="p-3">Teléfono</th>
                            <th className="p-3">Dirección</th>
                            <th className="p-3">Pago</th>
                            <th className="p-3 text-center">Acciones</th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            <tr><td colSpan="6" className="p-4 text-center">Cargando...</td></tr>
                        ) : clients.length === 0 ? (
                            <tr><td colSpan="6" className="p-4 text-center text-muted">No hay clientes registrados.</td></tr>
                        ) : clients.map(client => {
                            const principal = client.detalles?.find(d => d.es_principal) ?? client.detalles?.[0];
                            const mapsUrl = principal?.maps_url ?? buildMapsUrl(principal?.lat, principal?.lng);

                            return (
                                <tr key={client.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                                    <td className="p-3">
                                        <div className="font-bold">{client.nombre}</div>
                                        <div className="text-xs text-muted uppercase">{client.tipo_cliente} {client.canal_venta ? `· ${client.canal_venta}` : ''}</div>
                                    </td>
                                    <td className="p-3 text-muted" style={{ fontSize: '0.82rem' }}>
                                        {client.documento || <span style={{ opacity: 0.35 }}>—</span>}
                                    </td>
                                    <td className="p-3">
                                        {principal?.telefono
                                            ? <div className="flex items-center gap-1 text-sm font-bold" style={{ color: 'var(--brand)' }}>
                                                <Phone size={11} /> {principal.telefono}
                                              </div>
                                            : <span className="text-muted" style={{ opacity: 0.35 }}>—</span>}
                                        {(client.detalles?.length ?? 0) > 1 &&
                                            <div className="text-xs text-muted">+{client.detalles.length - 1} más</div>}
                                    </td>
                                    <td className="p-3" style={{ maxWidth: 200 }}>
                                        {principal?.direccion &&
                                            <div style={{ fontSize: '0.82rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                <MapPin size={10} style={{ display: 'inline', marginRight: 3 }} />
                                                {principal.direccion}
                                            </div>}
                                        {mapsUrl &&
                                            <a href={mapsUrl} target="_blank" rel="noreferrer"
                                                style={{ fontSize: '0.7rem', display: 'inline-flex', alignItems: 'center', gap: 3, marginTop: 2, color: 'var(--brand)' }}>
                                                <Navigation size={9} /> Ver mapa
                                            </a>}
                                    </td>
                                    <td className="p-3">
                                        <span className={`badge ${client.condicion_pago === 'credito' ? 'text-warning' : 'text-success'}`}
                                            style={{ fontSize: '0.68rem', textTransform: 'uppercase', background: 'transparent', border: '1px solid currentColor', padding: '0.15rem 0.5rem', borderRadius: 999, fontWeight: 700 }}>
                                            {client.condicion_pago || 'contado'}
                                        </span>
                                        {client.condicion_pago === 'credito' && client.cupo_credito > 0 &&
                                            <div className="text-xs text-muted" style={{ marginTop: 2 }}>
                                                Cupo: ${Number(client.cupo_credito).toLocaleString()}
                                            </div>}
                                    </td>
                                    <td className="p-3 text-center">
                                        <div className="flex justify-center gap-2">
                                            <button onClick={() => startEdit(client)} className="btn btn-secondary" style={{ padding: '0.35rem' }} title="Editar">
                                                <Edit size={15} />
                                            </button>
                                            <PermissionGate permission="clientes.analytics_toggle">
                                                <button
                                                    onClick={() => openAnalyticsModal(client)}
                                                    className="btn btn-secondary"
                                                    style={{
                                                        padding: '0.35rem',
                                                        color: client.analytics_enabled ? '#ffdd19' : 'rgba(255,255,255,0.5)',
                                                        borderColor: client.analytics_enabled ? 'rgba(255,221,25,0.35)' : undefined,
                                                    }}
                                                    title={client.analytics_enabled ? 'Analítica activa — gestionar' : 'Activar módulo analítica'}
                                                >
                                                    <LineChart size={15} />
                                                </button>
                                            </PermissionGate>
                                            <button onClick={() => handleDelete(client.id)} className="btn btn-secondary text-danger" style={{ padding: '0.35rem' }} title="Eliminar">
                                                <Trash2 size={15} />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>

            {/* ── Modal Módulo Analítica ───────────────────────── */}
            {analyticsModal && (
                <AnalyticsAdminModal
                    modal={analyticsModal}
                    form={analyticsForm}
                    setForm={setAnalyticsForm}
                    onClose={() => setAnalyticsModal(null)}
                    onActivar={handleActivarAnalytics}
                    onDesactivar={handleDesactivarAnalytics}
                    saving={savingAnalytics}
                />
            )}
        </div>
    );
}

/* ─── Modal de administración del módulo analítica ──────────── */
function AnalyticsAdminModal({ modal, form, setForm, onClose, onActivar, onDesactivar, saving }) {
    const { client, enabled, expires_at, activated_at, historial } = modal;
    const activa = enabled && expires_at && new Date(expires_at) >= new Date();
    const fmtDT = (s) => s ? formatDateTime(s) : '—';

    return (
        <div
            onClick={onClose}
            style={{
                position: 'fixed', inset: 0, zIndex: 1000,
                background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
                overflow: 'auto',
            }}
        >
            <div
                onClick={(e) => e.stopPropagation()}
                style={{
                    width: '100%', maxWidth: 560,
                    background: '#151515', border: '1px solid rgba(255,221,25,0.25)',
                    borderRadius: 14, padding: 20, maxHeight: '90vh', overflow: 'auto',
                }}
            >
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                    <LineChart size={22} style={{ color: '#ffdd19' }} />
                    <h2 style={{ margin: 0, fontSize: 18, color: '#fff', flex: 1 }}>
                        Módulo Analítica — {client.nombre}
                    </h2>
                    <button onClick={onClose} className="btn btn-secondary" style={{ padding: '0.35rem' }}>
                        <X size={15} />
                    </button>
                </div>

                {/* Estado actual */}
                <div style={{
                    background: activa ? 'rgba(34,197,94,0.08)' : 'rgba(255,255,255,0.03)',
                    border: `1px solid ${activa ? 'rgba(34,197,94,0.25)' : 'rgba(255,255,255,0.08)'}`,
                    borderRadius: 10, padding: 12, marginBottom: 16,
                }}>
                    <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'rgba(255,255,255,0.45)', fontWeight: 700 }}>
                        Estado
                    </div>
                    <div style={{ fontSize: 16, fontWeight: 700, color: activa ? '#22c55e' : 'rgba(255,255,255,0.55)', marginTop: 4 }}>
                        {activa ? 'Activa' : 'Inactiva'}
                    </div>
                    {activated_at && <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.55)', marginTop: 6 }}>Activada: {fmtDT(activated_at)}</div>}
                    {expires_at   && <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.55)' }}>Expira: {fmtDT(expires_at)}</div>}
                </div>

                {/* Formulario de activación */}
                <div style={{ marginBottom: 16 }}>
                    <h3 style={{ fontSize: 13, color: '#ffdd19', textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 10px' }}>
                        {activa ? 'Renovar / extender' : 'Activar suscripción'}
                    </h3>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                        <div>
                            <label style={{ fontSize: 11, color: 'rgba(255,255,255,0.55)' }}>Días</label>
                            <input type="number" min={1} max={365} value={form.dias}
                                onChange={e => setForm({ ...form, dias: e.target.value })}
                                className="input" />
                        </div>
                        <div>
                            <label style={{ fontSize: 11, color: 'rgba(255,255,255,0.55)' }}>Monto (COP)</label>
                            <input type="number" min={0} value={form.monto}
                                onChange={e => setForm({ ...form, monto: e.target.value })}
                                className="input" />
                        </div>
                        <div>
                            <label style={{ fontSize: 11, color: 'rgba(255,255,255,0.55)' }}>Medio de pago</label>
                            <input type="text" value={form.medio_pago} placeholder="Efectivo, Nequi…"
                                onChange={e => setForm({ ...form, medio_pago: e.target.value })}
                                className="input" />
                        </div>
                        <div>
                            <label style={{ fontSize: 11, color: 'rgba(255,255,255,0.55)' }}>Referencia</label>
                            <input type="text" value={form.referencia} placeholder="#comprobante"
                                onChange={e => setForm({ ...form, referencia: e.target.value })}
                                className="input" />
                        </div>
                        <div style={{ gridColumn: '1 / -1' }}>
                            <label style={{ fontSize: 11, color: 'rgba(255,255,255,0.55)' }}>Observaciones</label>
                            <input type="text" value={form.observaciones}
                                onChange={e => setForm({ ...form, observaciones: e.target.value })}
                                className="input" />
                        </div>
                    </div>
                </div>

                {/* Historial */}
                {historial?.length > 0 && (
                    <div style={{ marginBottom: 16 }}>
                        <h3 style={{ fontSize: 13, color: '#ffdd19', textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 10px' }}>
                            Historial ({historial.length})
                        </h3>
                        <div style={{ maxHeight: 180, overflow: 'auto', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8 }}>
                            <table style={{ width: '100%', fontSize: 12 }}>
                                <thead>
                                    <tr style={{ background: 'rgba(255,255,255,0.03)' }}>
                                        {['Inicio', 'Fin', 'Monto', 'Medio'].map(h => (
                                            <th key={h} style={{ padding: '6px 10px', textAlign: 'left', color: 'rgba(255,255,255,0.45)', fontWeight: 700 }}>{h}</th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {historial.map(h => (
                                        <tr key={h.id} style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                                            <td style={{ padding: '6px 10px', color: 'rgba(255,255,255,0.7)' }}>{fmtDT(h.fecha_inicio)}</td>
                                            <td style={{ padding: '6px 10px', color: 'rgba(255,255,255,0.7)' }}>{fmtDT(h.fecha_fin)}</td>
                                            <td style={{ padding: '6px 10px', color: '#ffdd19', fontWeight: 700 }}>{FMT(h.monto)}</td>
                                            <td style={{ padding: '6px 10px', color: 'rgba(255,255,255,0.55)' }}>{h.medio_pago || '—'}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {/* Acciones */}
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                    <button
                        onClick={onActivar}
                        disabled={saving}
                        className="btn btn-primary"
                        style={{ flex: 1, minWidth: 140 }}
                    >
                        {saving ? 'Guardando…' : (activa ? 'Renovar' : 'Activar')}
                    </button>
                    {activa && (
                        <button
                            onClick={onDesactivar}
                            disabled={saving}
                            className="btn btn-secondary text-danger"
                            style={{ minWidth: 140 }}
                        >
                            Desactivar
                        </button>
                    )}
                    <button onClick={onClose} className="btn btn-secondary" style={{ minWidth: 100 }}>Cerrar</button>
                </div>
            </div>
        </div>
    );
}

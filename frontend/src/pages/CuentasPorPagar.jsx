import React, { useState, useEffect } from 'react';
import { expensesService, paymentMethodsService } from '../services/api';
import { CreditCard, ChevronDown, ChevronUp, Calendar, Trash2, X, Truck } from 'lucide-react';
import DateInput from '../components/DateInput';
import { todayBogota, formatDate } from '../utils/formatters';
import { toast } from 'sonner';

const FMT = (v) => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(v || 0);

const fmtDate = (d) => d ? formatDate(d) : '—';

const ESTADO_BADGE = {
    pendiente: { label: 'Pendiente', bg: 'rgba(255,221,25,0.12)', color: '#ffdd19' },
    parcial:   { label: 'Parcial',   bg: 'rgba(255,162,15,0.12)', color: '#ffa20f' },
    pagado:    { label: 'Pagado',    bg: 'rgba(16,185,129,0.12)', color: '#10b981' },
};

export default function CuentasPorPagar() {
    const [proveedores, setProveedores] = useState([]);
    const [paymentMethods, setPaymentMethods] = useState([]);
    const [loading, setLoading] = useState(true);
    const [expanded, setExpanded] = useState(null); // proveedor_id

    // Modal abono
    const [abonoModal, setAbonoModal] = useState(null); // { factura }
    const [abonos, setAbonos] = useState([]);
    const [abonoForm, setAbonoForm] = useState({ monto: '', fecha: todayBogota(), medio_pago_id: '', notas: '' });
    const [abonoLoading, setAbonoLoading] = useState(false);

    // Modal pago completo
    const [pagoModal, setPagoModal] = useState(null); // { factura }
    const [pagoMethodId, setPagoMethodId] = useState('');
    const [pagoLoading, setPagoLoading] = useState(false);

    const loadData = async () => {
        setLoading(true);
        try {
            const [cxpRes, pmRes] = await Promise.all([
                expensesService.getCuentasPorPagar(),
                paymentMethodsService.getAll(),
            ]);
            setProveedores(cxpRes.data || []);
            setPaymentMethods((pmRes.data || []).filter(m => m.activo !== false));
        } catch {
            toast.error('Error al cargar cuentas por pagar');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { loadData(); }, []);

    const openAbonoModal = async (factura) => {
        setAbonoForm({ monto: '', fecha: todayBogota(), medio_pago_id: '', notas: '' });
        setAbonoLoading(false);
        try {
            const res = await expensesService.getAbonos(factura.id);
            setAbonos(res.data || []);
        } catch { setAbonos([]); }
        setAbonoModal({ factura });
    };

    const handleCrearAbono = async (e) => {
        e.preventDefault();
        const monto = parseFloat(abonoForm.monto);
        if (!(monto > 0)) return toast.error('Ingresa un monto válido');
        setAbonoLoading(true);
        try {
            await expensesService.crearAbono(abonoModal.factura.id, {
                monto,
                fecha: abonoForm.fecha,
                medio_pago_id: abonoForm.medio_pago_id ? parseInt(abonoForm.medio_pago_id) : null,
                notas: abonoForm.notas || null,
            });
            toast.success('Abono registrado');
            setAbonoModal(null);
            loadData();
        } catch (err) {
            toast.error(err?.response?.data?.detail || 'Error al registrar abono');
        } finally {
            setAbonoLoading(false);
        }
    };

    const handlePagoCompleto = async (e) => {
        e.preventDefault();
        if (!pagoMethodId) return toast.error('Selecciona un medio de pago');
        const saldo = pagoModal.factura.saldo_pendiente;
        if (!confirm(`¿Confirmar pago completo de ${FMT(saldo)} para la factura #${pagoModal.factura.id}?`)) return;
        setPagoLoading(true);
        try {
            await expensesService.crearAbono(pagoModal.factura.id, {
                monto: saldo,
                fecha: todayBogota(),
                medio_pago_id: parseInt(pagoMethodId),
                notas: 'Pago completo',
            });
            toast.success('Factura liquidada');
            setPagoModal(null);
            loadData();
        } catch (err) {
            toast.error(err?.response?.data?.detail || 'Error al registrar pago');
        } finally {
            setPagoLoading(false);
        }
    };

    const handleEliminarAbono = async (abonoId) => {
        if (!confirm('¿Eliminar este abono?')) return;
        try {
            await expensesService.eliminarAbono(abonoModal.factura.id, abonoId);
            toast.success('Abono eliminado');
            // Refresh abonos list
            const res = await expensesService.getAbonos(abonoModal.factura.id);
            setAbonos(res.data || []);
            loadData();
        } catch { toast.error('Error al eliminar abono'); }
    };

    const totalDeuda = proveedores.reduce((s, p) => s + p.total_deuda, 0);

    return (
        <div className="animate-fade-in">
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
                <div>
                    <h1 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 800 }}>Cuentas por Pagar</h1>
                    <p style={{ margin: '4px 0 0', color: 'var(--text-muted)', fontSize: '0.875rem' }}>
                        Facturas pendientes agrupadas por proveedor
                    </p>
                </div>
                <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 2 }}>
                        Total Pendiente
                    </div>
                    <div style={{ fontSize: '1.8rem', fontWeight: 900, color: 'var(--danger, #ef4444)' }}>
                        {FMT(totalDeuda)}
                    </div>
                </div>
            </div>

            {/* Tabla proveedores */}
            <div className="card" style={{ padding: 0, overflow: 'hidden', marginBottom: 0 }}>
                <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', background: 'rgba(255,255,255,0.03)', display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Truck size={16} style={{ color: 'var(--brand)' }} />
                    <span style={{ fontSize: '0.8rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                        Proveedores con saldo pendiente
                    </span>
                </div>

                {loading ? (
                    <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>Cargando…</div>
                ) : proveedores.length === 0 ? (
                    <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>
                        ✅ No hay facturas pendientes de pago
                    </div>
                ) : (
                    <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 600 }}>
                            <thead>
                                <tr style={{ borderBottom: '1px solid var(--border)', textAlign: 'left' }}>
                                    <th style={{ padding: '10px 16px', fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)', letterSpacing: '0.06em' }}>PROVEEDOR</th>
                                    <th style={{ padding: '10px 16px', fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)', letterSpacing: '0.06em', textAlign: 'center' }}>FACTURAS</th>
                                    <th style={{ padding: '10px 16px', fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)', letterSpacing: '0.06em', textAlign: 'center' }}>MÁS ANTIGUA</th>
                                    <th style={{ padding: '10px 16px', fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)', letterSpacing: '0.06em', textAlign: 'right' }}>DEUDA TOTAL</th>
                                    <th style={{ padding: '10px 16px', fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)', letterSpacing: '0.06em', textAlign: 'center' }}>DETALLE</th>
                                </tr>
                            </thead>
                            <tbody>
                                {proveedores.map(prov => (
                                    <React.Fragment key={prov.proveedor_id}>
                                        <tr
                                            style={{ borderBottom: expanded === prov.proveedor_id ? 'none' : '1px solid rgba(255,255,255,0.05)', background: expanded === prov.proveedor_id ? 'rgba(255,221,25,0.03)' : 'transparent' }}>
                                            <td style={{ padding: '14px 16px' }}>
                                                <div style={{ fontWeight: 700, fontSize: '1rem' }}>{prov.nombre}</div>
                                                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>ID #{prov.proveedor_id}</div>
                                            </td>
                                            <td style={{ padding: '14px 16px', textAlign: 'center' }}>
                                                <span style={{ background: 'rgba(255,221,25,0.12)', color: '#ffdd19', fontWeight: 700, fontSize: '0.78rem', padding: '3px 10px', borderRadius: 20 }}>
                                                    {prov.facturas_pendientes} pendientes
                                                </span>
                                            </td>
                                            <td style={{ padding: '14px 16px', textAlign: 'center' }}>
                                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                                                    <Calendar size={13} style={{ color: 'var(--text-muted)' }} />
                                                    <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 500 }}>{fmtDate(prov.fecha_mas_antigua)}</span>
                                                </div>
                                            </td>
                                            <td style={{ padding: '14px 16px', textAlign: 'right', fontSize: '1.2rem', fontWeight: 900, color: 'var(--danger, #ef4444)' }}>
                                                {FMT(prov.total_deuda)}
                                            </td>
                                            <td style={{ padding: '14px 16px', textAlign: 'center' }}>
                                                <button
                                                    onClick={() => setExpanded(expanded === prov.proveedor_id ? null : prov.proveedor_id)}
                                                    style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 8, padding: '6px 14px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5, color: 'var(--text)', fontSize: 13, margin: '0 auto' }}>
                                                    {expanded === prov.proveedor_id ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                                                    {expanded === prov.proveedor_id ? 'Ocultar' : 'Ver facturas'}
                                                </button>
                                            </td>
                                        </tr>

                                        {/* Facturas expandidas */}
                                        {expanded === prov.proveedor_id && (
                                            <tr key={`detail-${prov.proveedor_id}`} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                                                <td colSpan={5} style={{ padding: '0 16px 16px 32px', background: 'rgba(255,221,25,0.02)' }}>
                                                    <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: 8 }}>
                                                        <thead>
                                                            <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                                                                {['#', 'Fecha', 'Categoría', 'Total', 'Pagado', 'Saldo', 'Estado', ''].map(h => (
                                                                    <th key={h} style={{ padding: '6px 10px', fontSize: '0.68rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)', letterSpacing: '0.05em', textAlign: h === 'Total' || h === 'Pagado' || h === 'Saldo' ? 'right' : 'left' }}>{h}</th>
                                                                ))}
                                                            </tr>
                                                        </thead>
                                                        <tbody>
                                                            {prov.facturas.map(f => {
                                                                const badge = ESTADO_BADGE[f.estado_pago] || ESTADO_BADGE.pendiente;
                                                                return (
                                                                    <tr key={f.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                                                                        <td style={{ padding: '8px 10px', fontSize: '0.82rem', color: 'var(--text-muted)' }}>#{f.id}</td>
                                                                        <td style={{ padding: '8px 10px', fontSize: '0.82rem' }}>{fmtDate(f.fecha)}</td>
                                                                        <td style={{ padding: '8px 10px', fontSize: '0.82rem' }}>{f.categoria_nombre || '—'}</td>
                                                                        <td style={{ padding: '8px 10px', fontSize: '0.82rem', textAlign: 'right', fontWeight: 600 }}>{FMT(f.valor)}</td>
                                                                        <td style={{ padding: '8px 10px', fontSize: '0.82rem', textAlign: 'right', color: 'var(--success, #10b981)' }}>{FMT(f.monto_pagado)}</td>
                                                                        <td style={{ padding: '8px 10px', fontSize: '0.82rem', textAlign: 'right', fontWeight: 700, color: 'var(--brand)' }}>{FMT(f.saldo_pendiente)}</td>
                                                                        <td style={{ padding: '8px 10px' }}>
                                                                            <span style={{ background: badge.bg, color: badge.color, fontSize: '0.7rem', fontWeight: 700, padding: '2px 8px', borderRadius: 20, whiteSpace: 'nowrap' }}>
                                                                                {badge.label}
                                                                            </span>
                                                                        </td>
                                                                        <td style={{ padding: '8px 10px' }}>
                                                                            <div style={{ display: 'flex', gap: 6 }}>
                                                                                <button onClick={() => openAbonoModal(f)}
                                                                                    style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 12px', borderRadius: 7, border: '1px solid rgba(255,162,15,0.4)', background: 'rgba(255,162,15,0.1)', color: '#ffa20f', fontSize: '0.78rem', fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                                                                                    <CreditCard size={12} /> Abonar
                                                                                </button>
                                                                                <button onClick={() => { setPagoMethodId(''); setPagoModal({ factura: f }); }}
                                                                                    style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 12px', borderRadius: 7, border: '1px solid rgba(16,185,129,0.4)', background: 'rgba(16,185,129,0.1)', color: '#10b981', fontSize: '0.78rem', fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                                                                                    ✓ Pagar
                                                                                </button>
                                                                            </div>
                                                                        </td>
                                                                    </tr>
                                                                );
                                                            })}
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
                )}
            </div>

            {/* Modal Abonos */}
            {abonoModal && (() => {
                const f = abonoModal.factura;
                const saldo = f.saldo_pendiente ?? 0;
                return (
                    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', zIndex: 110, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', overflowY: 'auto', padding: 16 }}>
                        <div className="card" style={{ width: '100%', maxWidth: 480, margin: 'auto', position: 'relative' }}>
                            <button onClick={() => setAbonoModal(null)} className="btn-close-modal"><X size={18} /></button>
                            <h2 style={{ margin: '0 0 4px', fontSize: '1rem' }}>
                                Abonos — Factura #{f.id}
                                <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}> · {f.proveedor_nombre}</span>
                            </h2>
                            <p style={{ margin: '0 0 16px', fontSize: '0.8rem', color: 'var(--text-muted)' }}>{f.categoria_nombre} · {fmtDate(f.fecha)}</p>

                            {/* Totales */}
                            <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
                                {[['Total factura', f.valor, 'var(--text)'], ['Pagado', f.monto_pagado, 'var(--success, #10b981)'], ['Saldo', saldo, saldo > 0 ? 'var(--brand)' : 'var(--success, #10b981)']].map(([label, val, color]) => (
                                    <div key={label} style={{ flex: 1, background: 'var(--bg-elevated)', borderRadius: 8, padding: '8px 12px', minWidth: 100 }}>
                                        <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: 2 }}>{label}</div>
                                        <div style={{ fontWeight: 700, color }}>{FMT(val)}</div>
                                    </div>
                                ))}
                            </div>

                            {/* Historial */}
                            <div style={{ marginBottom: 16 }}>
                                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 700, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Historial de abonos</div>
                                {abonos.length === 0 ? (
                                    <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Sin abonos registrados</div>
                                ) : abonos.map(a => (
                                    <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--bg-elevated)', borderRadius: 8, padding: '8px 12px', marginBottom: 6 }}>
                                        <div style={{ flex: 1 }}>
                                            <div style={{ fontWeight: 600 }}>{FMT(a.monto)}</div>
                                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                                {fmtDate(a.fecha)}{a.medio_pago_nombre ? ` · ${a.medio_pago_nombre}` : ''}{a.notas ? ` · ${a.notas}` : ''}
                                            </div>
                                        </div>
                                        <button onClick={() => handleEliminarAbono(a.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--danger, #ef4444)', padding: 4 }}>
                                            <Trash2 size={14} />
                                        </button>
                                    </div>
                                ))}
                            </div>

                            {/* Formulario */}
                            {saldo > 0 ? (
                                <form onSubmit={handleCrearAbono}>
                                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 700, marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Registrar abono</div>
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
                                        <div className="form-group" style={{ margin: 0 }}>
                                            <label>Monto *</label>
                                            <input type="number" className="form-control" min="0.01" step="0.01" max={saldo}
                                                placeholder="0" value={abonoForm.monto}
                                                onChange={e => setAbonoForm(f => ({ ...f, monto: e.target.value }))} required />
                                        </div>
                                        <div className="form-group" style={{ margin: 0 }}>
                                            <label>Fecha *</label>
                                            <DateInput value={abonoForm.fecha} onChange={v => setAbonoForm(f => ({ ...f, fecha: v }))} height={38} />
                                        </div>
                                    </div>
                                    <div className="form-group" style={{ marginBottom: 10 }}>
                                        <label>Medio de pago</label>
                                        <select className="form-control" value={abonoForm.medio_pago_id}
                                            onChange={e => setAbonoForm(f => ({ ...f, medio_pago_id: e.target.value }))}>
                                            <option value="">— Ninguno —</option>
                                            {paymentMethods.map(m => <option key={m.id} value={m.id}>{m.nombre}</option>)}
                                        </select>
                                    </div>
                                    <div className="form-group" style={{ marginBottom: 12 }}>
                                        <label>Notas</label>
                                        <input type="text" className="form-control" placeholder="Opcional"
                                            value={abonoForm.notas}
                                            onChange={e => setAbonoForm(f => ({ ...f, notas: e.target.value }))} />
                                    </div>
                                    <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                                        <button type="button" className="btn btn-secondary" onClick={() => setAbonoModal(null)}>Cancelar</button>
                                        <button type="submit" className="btn btn-primary" disabled={abonoLoading}>
                                            {abonoLoading ? 'Guardando…' : 'Registrar abono'}
                                        </button>
                                    </div>
                                </form>
                            ) : (
                                <div style={{ textAlign: 'center', padding: '8px 0', color: 'var(--success, #10b981)', fontWeight: 600 }}>✓ Factura pagada completamente</div>
                            )}
                        </div>
                    </div>
                );
            })()}

            {/* Modal Pago Completo */}
            {pagoModal && (
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', zIndex: 120, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
                    <div className="card" style={{ width: '100%', maxWidth: 380, position: 'relative' }}>
                        <button onClick={() => setPagoModal(null)} className="btn-close-modal"><X size={18} /></button>
                        <h2 style={{ margin: '0 0 4px', fontSize: '1rem' }}>Liquidar Factura #{pagoModal.factura.id}</h2>
                        <p style={{ margin: '0 0 16px', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                            {pagoModal.factura.proveedor_nombre} · {pagoModal.factura.categoria_nombre}
                        </p>
                        <div style={{ background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.25)', borderRadius: 10, padding: '12px 16px', marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600 }}>Saldo a pagar</span>
                            <span style={{ fontSize: '1.4rem', fontWeight: 900, color: '#10b981' }}>{FMT(pagoModal.factura.saldo_pendiente)}</span>
                        </div>
                        <form onSubmit={handlePagoCompleto}>
                            <div className="form-group" style={{ marginBottom: 16 }}>
                                <label>Medio de pago *</label>
                                <select className="form-control" value={pagoMethodId}
                                    onChange={e => setPagoMethodId(e.target.value)} required>
                                    <option value="">— Seleccionar —</option>
                                    {paymentMethods.map(m => <option key={m.id} value={m.id}>{m.nombre}</option>)}
                                </select>
                            </div>
                            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                                <button type="button" className="btn btn-secondary" onClick={() => setPagoModal(null)}>Cancelar</button>
                                <button type="submit" className="btn btn-primary" disabled={pagoLoading}
                                    style={{ background: '#10b981', borderColor: '#10b981', color: '#fff' }}>
                                    {pagoLoading ? 'Procesando…' : '✓ Confirmar pago'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}

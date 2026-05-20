import { useEffect, useState } from 'react';
import { receivablesService, paymentMethodsService } from '../services/api';
import { DollarSign, X } from 'lucide-react';
import { toast } from 'sonner';
import { formatDate } from '../utils/formatters';

const FMT = (v) => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(v || 0);

const safeDateFormat = (dateStr) => dateStr ? formatDate(dateStr) : 'S/F';

export default function CuentasPorCobrar() {
    const [deudores, setDeudores] = useState([]);
    const [paymentMethods, setPaymentMethods] = useState([]);
    const [loading, setLoading] = useState(true);
    const [expandedClient, setExpandedClient] = useState(null);

    const [pagarModal, setPagarModal] = useState({ show: false, clientId: null, clientName: '', totalDebt: 0 });
    const [pagarMethodId, setPagarMethodId] = useState('');

    const [abonarModal, setAbonarModal] = useState({ show: false, clientId: null, clientName: '', totalDebt: 0 });
    const [abonarForm, setAbonarForm] = useState({ amount: '', methodId: '' });

    const loadData = async () => {
        setLoading(true);
        try {
            const [accRes, pmRes] = await Promise.all([
                receivablesService.getAccounts(),
                paymentMethodsService.getAll(),
            ]);
            setDeudores(accRes.data || []);
            setPaymentMethods(pmRes.data || []);
        } catch {
            toast.error('Error al cargar cuentas por cobrar');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { loadData(); }, []);

    // Agrupar por cliente
    const groupedDebtors = deudores.reduce((acc, curr) => {
        const clientId = curr.cliente_id || curr.nombre;
        if (!acc[clientId]) acc[clientId] = {
            id: clientId, nombre: curr.nombre, total: 0,
            fecha_mas_antigua: curr.fecha || curr.fecha_vencimiento || null, items: []
        };
        acc[clientId].total += curr.saldo;
        const fechaActual = curr.fecha || curr.fecha_vencimiento;
        if (fechaActual) {
            const d = new Date(fechaActual);
            const oldest = acc[clientId].fecha_mas_antigua ? new Date(acc[clientId].fecha_mas_antigua) : null;
            if (!isNaN(d.getTime()) && (!oldest || isNaN(oldest.getTime()) || d < oldest))
                acc[clientId].fecha_mas_antigua = fechaActual;
        }
        acc[clientId].items.push(curr);
        return acc;
    }, {});
    const debtorsList = Object.values(groupedDebtors);
    const totalDeuda = debtorsList.reduce((s, c) => s + c.total, 0);

    const handlePagarCompleto = async (e) => {
        e.preventDefault();
        if (!pagarMethodId) { toast.warning('Selecciona un medio de pago'); return; }
        try {
            await receivablesService.registerPayment({
                cliente_id: pagarModal.clientId,
                monto: pagarModal.totalDebt,
                medio_pago_id: parseInt(pagarMethodId),
            });
            setPagarModal({ show: false, clientId: null, clientName: '', totalDebt: 0 });
            setPagarMethodId('');
            toast.success(`Pago de ${FMT(pagarModal.totalDebt)} registrado`);
            loadData();
        } catch { toast.error('Error al registrar pago'); }
    };

    const handleAbonar = async (e) => {
        e.preventDefault();
        if (!abonarForm.amount || !abonarForm.methodId) { toast.warning('Ingresa el monto y el medio de pago'); return; }
        try {
            await receivablesService.registerPayment({
                cliente_id: abonarModal.clientId,
                monto: parseFloat(abonarForm.amount),
                medio_pago_id: parseInt(abonarForm.methodId),
            });
            setAbonarModal({ show: false, clientId: null, clientName: '', totalDebt: 0 });
            setAbonarForm({ amount: '', methodId: '' });
            toast.success('Abono registrado');
            loadData();
        } catch { toast.error('Error al registrar abono'); }
    };

    if (loading) return <div className="text-center mt-4">Cargando...</div>;

    return (
        <div>
            <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
                <div>
                    <h1 className="m-0">Cuentas por Cobrar</h1>
                    <p className="text-muted" style={{ margin: 0, fontSize: 13 }}>Saldos pendientes de clientes</p>
                </div>
                {debtorsList.length > 0 && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>
                            {debtorsList.length} cliente{debtorsList.length !== 1 ? 's' : ''}
                        </span>
                        <span style={{ fontSize: 18, fontWeight: 800, color: '#ef4444' }}>{FMT(totalDeuda)}</span>
                    </div>
                )}
            </header>

            {debtorsList.length === 0 ? (
                <div className="card" style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 20 }}>
                    <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'rgba(34,197,94,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <DollarSign size={18} style={{ color: '#22c55e' }} />
                    </div>
                    <div>
                        <div style={{ fontWeight: 600, color: '#22c55e' }}>Sin deudas pendientes</div>
                        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>Todos los clientes están al día</div>
                    </div>
                </div>
            ) : (
                <div className="card" style={{ padding: 0, overflow: 'hidden', borderTop: '3px solid #ef4444' }}>
                    {debtorsList.map((client, idx) => {
                        const isOpen = expandedClient === client.id;
                        const diasDeuda = client.fecha_mas_antigua
                            ? Math.floor((Date.now() - new Date(client.fecha_mas_antigua)) / 86400000)
                            : null;
                        const urgente = diasDeuda !== null && diasDeuda > 30;
                        return (
                            <div key={client.id} style={{ borderBottom: idx < debtorsList.length - 1 ? '1px solid var(--border)' : 'none' }}>
                                <div
                                    style={{ display: 'grid', gridTemplateColumns: '1fr auto', alignItems: 'center', padding: '12px 16px', cursor: 'pointer', gap: 12 }}
                                    onClick={() => setExpandedClient(isOpen ? null : client.id)}
                                >
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
                                        <div style={{ width: 36, height: 36, borderRadius: '50%', background: urgente ? 'rgba(239,68,68,0.15)' : 'rgba(99,102,241,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: 13, fontWeight: 800, color: urgente ? '#f87171' : '#818cf8' }}>
                                            {client.nombre.charAt(0).toUpperCase()}
                                        </div>
                                        <div style={{ minWidth: 0 }}>
                                            <div style={{ fontWeight: 700, fontSize: 14, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{client.nombre}</div>
                                            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2, display: 'flex', gap: 8, alignItems: 'center' }}>
                                                <span>{client.items.length} factura{client.items.length !== 1 ? 's' : ''}</span>
                                                {diasDeuda !== null && (
                                                    <span style={{ color: urgente ? '#f87171' : 'var(--text-muted)' }}>· {diasDeuda}d antigüedad</span>
                                                )}
                                                {urgente && (
                                                    <span style={{ fontSize: 10, fontWeight: 700, color: '#f87171', background: 'rgba(239,68,68,0.12)', borderRadius: 4, padding: '1px 6px', textTransform: 'uppercase' }}>Vencido</span>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
                                        <div style={{ textAlign: 'right' }}>
                                            <div style={{ fontSize: 16, fontWeight: 800, color: '#ef4444' }}>{FMT(client.total)}</div>
                                            <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 1 }}>{isOpen ? '▲ Ocultar' : '▼ Detalle'}</div>
                                        </div>
                                        <div style={{ display: 'flex', gap: 6 }}>
                                            <button
                                                onClick={(e) => { e.stopPropagation(); setPagarModal({ show: true, clientId: client.id, clientName: client.nombre, totalDebt: client.total }); setPagarMethodId(''); }}
                                                style={{ padding: '6px 14px', fontSize: 12, fontWeight: 700, borderRadius: 8, background: 'rgba(34,197,94,0.18)', border: '1px solid rgba(34,197,94,0.4)', color: '#22c55e', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5 }}
                                            >
                                                <DollarSign size={13} /> Pagar
                                            </button>
                                            <button
                                                onClick={(e) => { e.stopPropagation(); setAbonarModal({ show: true, clientId: client.id, clientName: client.nombre, totalDebt: client.total }); setAbonarForm({ amount: '', methodId: '' }); }}
                                                style={{ padding: '6px 12px', fontSize: 12, fontWeight: 700, borderRadius: 8, background: 'rgba(99,102,241,0.12)', border: '1px solid rgba(99,102,241,0.3)', color: '#818cf8', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5 }}
                                            >
                                                <DollarSign size={13} /> Abonar
                                            </button>
                                        </div>
                                    </div>
                                </div>
                                {isOpen && (
                                    <div style={{ background: 'rgba(0,0,0,0.18)', borderTop: '1px solid var(--border)', padding: '8px 16px 12px' }}>
                                        {client.items.map((item, i) => (
                                            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '7px 0', borderBottom: i < client.items.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                                    <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#6366f1', flexShrink: 0 }} />
                                                    <div>
                                                        <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{safeDateFormat(item.fecha || item.fecha_vencimiento)}</div>
                                                        {item.estado === 'parcial' && (
                                                            <span style={{ fontSize: 10, fontWeight: 700, color: '#ffdd19', background: 'rgba(255,221,25,0.12)', borderRadius: 4, padding: '1px 5px' }}>Parcial</span>
                                                        )}
                                                    </div>
                                                </div>
                                                <span style={{ fontSize: 13, fontWeight: 700, color: '#ef4444' }}>{FMT(item.saldo)}</span>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 16px', background: 'rgba(239,68,68,0.06)', borderTop: '1px solid rgba(239,68,68,0.2)' }}>
                        <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Total por cobrar</span>
                        <span style={{ fontSize: 18, fontWeight: 800, color: '#ef4444' }}>{FMT(totalDeuda)}</span>
                    </div>
                </div>
            )}

            {/* Modal Pagar completo */}
            {pagarModal.show && (
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', zIndex: 110, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', overflowY: 'auto', padding: 16 }}>
                    <div className="card" style={{ width: '100%', maxWidth: 400, margin: 'auto', position: 'relative', maxHeight: 'calc(100vh - 32px)', overflowY: 'auto' }}>
                        <button onClick={() => setPagarModal({ show: false, clientId: null, clientName: '', totalDebt: 0 })} className="btn-close-modal"><X size={18} /></button>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
                            <div style={{ width: 44, height: 44, borderRadius: '50%', background: 'rgba(34,197,94,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, fontWeight: 800, color: '#22c55e', flexShrink: 0 }}>
                                {pagarModal.clientName.charAt(0).toUpperCase()}
                            </div>
                            <div>
                                <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>Registrar pago</div>
                                <div style={{ fontSize: 16, fontWeight: 800 }}>{pagarModal.clientName}</div>
                            </div>
                        </div>
                        <div style={{ background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.25)', borderRadius: 10, padding: '14px 16px', marginBottom: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div>
                                <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', marginBottom: 2 }}>Monto a pagar</div>
                                <div style={{ fontSize: 22, fontWeight: 800, color: '#22c55e' }}>{FMT(pagarModal.totalDebt)}</div>
                            </div>
                            <DollarSign size={28} style={{ color: '#22c55e', opacity: 0.4 }} />
                        </div>
                        <form onSubmit={handlePagarCompleto}>
                            <div className="form-group" style={{ marginBottom: 20 }}>
                                <label style={{ fontSize: 13, fontWeight: 600, marginBottom: 8, display: 'block' }}>Medio de pago</label>
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: 8 }}>
                                    {paymentMethods.filter(m => m.activo !== false).map(m => (
                                        <button key={m.id} type="button" onClick={() => setPagarMethodId(String(m.id))}
                                            style={{ padding: '10px 8px', borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: 'pointer', textAlign: 'center',
                                                background: pagarMethodId === String(m.id) ? 'rgba(34,197,94,0.15)' : 'var(--bg-secondary)',
                                                border: pagarMethodId === String(m.id) ? '2px solid #22c55e' : '2px solid var(--border)',
                                                color: pagarMethodId === String(m.id) ? '#22c55e' : 'var(--text-secondary)' }}>
                                            {m.nombre}
                                        </button>
                                    ))}
                                </div>
                            </div>
                            <button type="submit" disabled={!pagarMethodId}
                                style={{ width: '100%', padding: '13px', fontSize: 15, fontWeight: 800, borderRadius: 10, border: 'none', cursor: pagarMethodId ? 'pointer' : 'not-allowed',
                                    background: pagarMethodId ? '#22c55e' : 'var(--bg-secondary)', color: pagarMethodId ? '#000' : 'var(--text-muted)',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                                <DollarSign size={18} /> Confirmar pago{pagarMethodId ? ` · ${FMT(pagarModal.totalDebt)}` : ''}
                            </button>
                        </form>
                    </div>
                </div>
            )}

            {/* Modal Abonar */}
            {abonarModal.show && (
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', zIndex: 110, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', overflowY: 'auto', padding: 16 }}>
                    <div className="card" style={{ width: '100%', maxWidth: 400, margin: 'auto', position: 'relative', maxHeight: 'calc(100vh - 32px)', overflowY: 'auto' }}>
                        <button onClick={() => setAbonarModal({ show: false, clientId: null, clientName: '', totalDebt: 0 })} className="btn-close-modal"><X size={18} /></button>
                        <div style={{ marginBottom: 16 }}>
                            <h2 className="m-0" style={{ fontSize: 18 }}>Registrar Abono</h2>
                            <p className="text-muted" style={{ margin: '4px 0 0', fontSize: 13 }}>Cliente: <strong>{abonarModal.clientName}</strong></p>
                        </div>
                        <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 8, padding: '12px 14px', marginBottom: 16 }}>
                            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 2 }}>Total deuda actual</div>
                            <div style={{ fontSize: 20, fontWeight: 800, color: '#ef4444' }}>{FMT(abonarModal.totalDebt)}</div>
                        </div>
                        <form onSubmit={handleAbonar}>
                            <div className="form-group" style={{ marginBottom: 14 }}>
                                <label style={{ fontSize: 13, fontWeight: 600 }}>Monto a abonar</label>
                                <input type="number" className="form-control" min="1" max={abonarModal.totalDebt}
                                    value={abonarForm.amount} onChange={e => setAbonarForm(f => ({ ...f, amount: e.target.value }))}
                                    placeholder="Ej: 50000" autoFocus required />
                            </div>
                            <div className="form-group" style={{ marginBottom: 20 }}>
                                <label style={{ fontSize: 13, fontWeight: 600 }}>Medio de pago</label>
                                <select className="form-control" value={abonarForm.methodId} onChange={e => setAbonarForm(f => ({ ...f, methodId: e.target.value }))} required>
                                    <option value="">-- Seleccionar --</option>
                                    {paymentMethods.map(m => <option key={m.id} value={m.id}>{m.nombre}</option>)}
                                </select>
                            </div>
                            <button type="submit" className="btn btn-primary" style={{ width: '100%', padding: '12px', fontWeight: 700 }}>
                                <DollarSign size={16} /> Confirmar Abono
                            </button>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}

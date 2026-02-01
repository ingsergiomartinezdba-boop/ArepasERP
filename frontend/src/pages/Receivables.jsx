import { useState, useEffect } from 'react';
import { receivablesService, ordersService, paymentMethodsService } from '../services/api';
import { DollarSign, Clock, Calendar, CheckCircle, Trash2, Edit, CreditCard, FileText, User, Info, ArrowUpRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Modal, PageHeader, Button, FormField, TripleDateSelector, Card } from '../components';
import { formatCurrency, formatDate } from '../utils/formatters';

export default function Receivables() {
    const navigate = useNavigate();
    const [accounts, setAccounts] = useState([]);
    const [history, setHistory] = useState([]);
    const [loading, setLoading] = useState(true);
    const [paymentMethods, setPaymentMethods] = useState([]);

    // Modal State
    const [showModal, setShowModal] = useState(false);
    const [selectedAccount, setSelectedAccount] = useState(null);
    const [editingPayment, setEditingPayment] = useState(null);
    const [paymentForm, setPaymentForm] = useState({
        monto: '',
        fecha: (() => {
            const now = new Date();
            return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
        })(),
        descripcion: '',
        metodo_pago_id: ''
    });

    // Pay Specific Order Modal State
    const [showOrderModal, setShowOrderModal] = useState(false);
    const [clientOrders, setClientOrders] = useState([]);
    const [selectedOrder, setSelectedOrder] = useState(null);
    const [loadingOrders, setLoadingOrders] = useState(false);

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        setLoading(true);
        try {
            const [accRes, histRes, methodsRes] = await Promise.all([
                receivablesService.getAccounts(),
                receivablesService.getHistory(),
                paymentMethodsService.getAll()
            ]);
            setAccounts(accRes.data);
            setHistory(histRes.data);
            setPaymentMethods(methodsRes.data.filter(m => m.activo));
        } catch (error) {
            console.error("Error loading receivables", error);
        } finally {
            setLoading(false);
        }
    };

    const handleOpenPayment = (account) => {
        setEditingPayment(null);
        setSelectedAccount(account);
        setPaymentForm(prev => ({ ...prev, monto: '', descripcion: '', metodo_pago_id: '' }));
        setShowModal(true);
    };

    const handleEditPayment = (payment) => {
        setEditingPayment(payment);

        const linkedAccount = accounts.find(a => a.cliente_id === payment.cliente_id);
        const debt = linkedAccount ? linkedAccount.total_deuda : 0;

        setSelectedAccount({
            cliente_id: payment.cliente_id,
            nombre: payment.cliente,
            total_deuda: debt
        });

        setPaymentForm({
            monto: payment.monto,
            fecha: payment.fecha ? payment.fecha.split('T')[0] : '',
            descripcion: payment.descripcion || '',
            metodo_pago_id: payment.metodo_pago_id || ''
        });

        setShowModal(true);
    };

    const handleDeletePayment = async (id, amount) => {
        if (!confirm(`¿Está seguro de eliminar este abono? La deuda del cliente volverá a aumentar.`)) return;

        try {
            await receivablesService.deletePayment(id);
            loadData();
        } catch (error) {
            console.error(error);
            alert("Error al eliminar abono");
        }
    };

    const handlePaymentSubmit = async (e) => {
        e.preventDefault();
        if (!paymentForm.monto || !paymentForm.metodo_pago_id) {
            alert("Complete el monto y medio de pago");
            return;
        }

        const amount = parseFloat(paymentForm.monto);
        if (amount <= 0) {
            alert("El monto debe ser mayor a 0");
            return;
        }

        if (amount > selectedAccount.total_deuda && !editingPayment) {
            if (!confirm(`El monto ingresado ($${amount}) es MAYOR a la deuda total ($${selectedAccount.total_deuda}). ¿Desea continuar? (El excedente no se asocia a pedidos futuros automáticante)`)) {
                return;
            }
        }

        try {
            const payload = {
                cliente_id: selectedAccount.cliente_id,
                monto: amount,
                fecha: new Date(paymentForm.fecha).toISOString(),
                descripcion: paymentForm.descripcion,
                metodo_pago_id: parseInt(paymentForm.metodo_pago_id)
            };

            if (editingPayment) {
                await receivablesService.updatePayment(editingPayment.id, payload);
            } else {
                await receivablesService.registerPayment(payload);
            }
            setShowModal(false);
            setEditingPayment(null);
            loadData();
        } catch (error) {
            console.error(error);
            alert("Error al procesar abono");
        }
    };

    const handleOpenOrderSelection = async (account) => {
        setSelectedAccount(account);
        setLoadingOrders(true);
        setShowOrderModal(true);

        try {
            const response = await ordersService.getAll();
            const allOrders = response.data;

            const pendingOrders = allOrders.filter(order => {
                if (order.cliente_id !== account.cliente_id) return false;
                const total = parseFloat(order.total || 0);
                const paid = parseFloat(order.monto_pagado || 0);
                const debt = total - paid;
                return debt > 0.01;
            });

            setClientOrders(pendingOrders);
        } catch (error) {
            console.error("Error loading orders:", error);
            alert("Error al cargar los pedidos del cliente");
        } finally {
            setLoadingOrders(false);
        }
    };

    const handlePaySpecificOrder = async () => {
        if (!selectedOrder || !paymentForm.metodo_pago_id) {
            alert("Seleccione un pedido y un medio de pago");
            return;
        }

        const total = parseFloat(selectedOrder.total || 0);
        const paid = parseFloat(selectedOrder.monto_pagado || 0);
        const debt = total - paid;

        if (debt <= 0) {
            alert("Este pedido ya está completamente pagado");
            return;
        }

        if (!confirm(`¿Confirma el pago completo de $${formatCurrency(debt)} para el pedido #${selectedOrder.id}?`)) {
            return;
        }

        try {
            const payload = {
                cliente_id: selectedAccount.cliente_id,
                monto: debt,
                fecha: new Date(paymentForm.fecha).toISOString(),
                descripcion: paymentForm.descripcion || `Pago completo pedido #${selectedOrder.id}`,
                metodo_pago_id: parseInt(paymentForm.metodo_pago_id)
            };

            await receivablesService.registerPayment(payload);
            setShowOrderModal(false);
            setSelectedOrder(null);
            loadData();
        } catch (error) {
            console.error(error);
            alert("Error al procesar el pago");
        }
    };

    const totalDeudaGeneral = accounts.reduce((acc, curr) => acc + curr.total_deuda, 0);

    return (
        <div className="animate-fade-in">
            <PageHeader
                title="Cartera de Clientes"
                action={
                    <div className="text-right">
                        <p className="text-muted text-xs uppercase tracking-widest font-bold">Total Pendiente Recaudo</p>
                        <p className="text-3xl font-black text-danger">{formatCurrency(totalDeudaGeneral)}</p>
                    </div>
                }
            />

            <Card className="p-0 overflow-hidden mb-8">
                <div className="p-4 border-b border-white/5 bg-white/5 flex justify-between items-center">
                    <h3 className="m-0 text-sm uppercase tracking-wider flex items-center gap-2">
                        <User size={16} className="text-primary" /> Cuentas por Cobrar
                    </h3>
                </div>
                <div className="overflow-x-auto">
                    <table>
                        <thead>
                            <tr>
                                <th>CLIENTE</th>
                                <th className="text-center">PEDIDOS</th>
                                <th className="text-center">DEUDA TOTAL</th>
                                <th className="text-center">ANTIGÜEDAD</th>
                                <th className="text-center">ACCIONES</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr><td colSpan="5" className="p-10 text-center text-muted">Cargando datos...</td></tr>
                            ) : accounts.length === 0 ? (
                                <tr><td colSpan="5" className="p-10 text-center text-muted">No hay cuentas por cobrar pendientes.</td></tr>
                            ) : (
                                accounts.map(acc => (
                                    <tr key={acc.cliente_id}>
                                        <td>
                                            <div className="font-bold text-lg">{acc.nombre}</div>
                                            <div className="text-xs text-muted">ID Cliente: #{acc.cliente_id}</div>
                                        </td>
                                        <td className="text-center">
                                            <div className="badge badge-warning inline-block">
                                                {acc.ordenes_pendientes} pendientes
                                            </div>
                                        </td>
                                        <td className="text-center font-black text-danger text-xl">
                                            {formatCurrency(acc.total_deuda)}
                                        </td>
                                        <td className="text-center text-sm">
                                            <div className="flex flex-col items-center">
                                                <Calendar size={14} className="text-muted mb-1" />
                                                <span className="font-medium text-muted">{formatDate(acc.fecha_mas_antigua)}</span>
                                            </div>
                                        </td>
                                        <td>
                                            <div className="flex gap-2 justify-center">
                                                <Button
                                                    variant="secondary"
                                                    onClick={() => handleOpenPayment(acc)}
                                                    size="sm"
                                                    icon={<ArrowUpRight size={14} />}
                                                >
                                                    Abono
                                                </Button>
                                                <Button
                                                    variant="success"
                                                    onClick={() => handleOpenOrderSelection(acc)}
                                                    size="sm"
                                                    icon={<CheckCircle size={14} />}
                                                >
                                                    Pagar Pedido
                                                </Button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </Card>

            <div className="flex items-center gap-2 mb-4">
                <Clock size={20} className="text-primary" />
                <h2 className="m-0 text-xl font-bold">Historial de Abonos Recientes</h2>
            </div>

            <Card className="p-0 overflow-hidden">
                <div className="overflow-x-auto">
                    <table>
                        <thead>
                            <tr>
                                <th className="text-center">FECHA</th>
                                <th>CLIENTE / DESCRIPCIÓN</th>
                                <th className="text-center">MEDIO PAGO</th>
                                <th className="text-right">MONTO</th>
                                <th className="text-center">ACCIONES</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr><td colSpan="5" className="p-10 text-center text-muted">Cargando historia...</td></tr>
                            ) : history.length === 0 ? (
                                <tr><td colSpan="5" className="p-10 text-center text-muted">No hay abonos registrados.</td></tr>
                            ) : (
                                history.map(item => (
                                    <tr key={item.id}>
                                        <td className="text-center">
                                            <div className="text-xs font-bold text-muted">{formatDate(item.fecha)}</div>
                                        </td>
                                        <td>
                                            <div className="font-bold">{item.cliente}</div>
                                            <div className="text-xs text-muted italic">{item.descripcion || 'Sin descripción'}</div>
                                        </td>
                                        <td className="text-center">
                                            <div className="badge badge-secondary">{item.medio_pago}</div>
                                        </td>
                                        <td className="text-right font-black text-success text-lg">
                                            {formatCurrency(item.monto)}
                                        </td>
                                        <td>
                                            <div className="flex justify-center gap-2">
                                                <Button
                                                    variant="secondary"
                                                    size="sm"
                                                    icon={<Edit size={14} />}
                                                    onClick={() => handleEditPayment(item)}
                                                />
                                                <Button
                                                    variant="danger"
                                                    size="sm"
                                                    icon={<Trash2 size={14} />}
                                                    onClick={() => handleDeletePayment(item.id, item.monto)}
                                                />
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </Card>

            {/* Payment Modal */}
            <Modal
                isOpen={showModal && selectedAccount}
                onClose={() => setShowModal(false)}
                title={editingPayment ? 'Modificar Abono' : 'Registrar Abono'}
                size="md"
            >
                <div className="p-4 bg-black/20 rounded-lg border border-white/5 mb-6">
                    <div className="flex justify-between items-center text-sm mb-2">
                        <span className="text-muted">CLIENTE:</span>
                        <span className="font-bold uppercase">{selectedAccount?.nombre}</span>
                    </div>
                    <div className="flex justify-between items-center">
                        <span className="text-muted">DEUDA ACTUAL:</span>
                        <span className="text-2xl font-black text-danger">{formatCurrency(selectedAccount?.total_deuda)}</span>
                    </div>
                    {editingPayment && (
                        <div className="mt-3 pt-3 border-t border-white/5 text-[10px] text-info uppercase tracking-widest font-bold">
                            * Se recalculará la deuda al guardar cambios.
                        </div>
                    )}
                </div>

                <form onSubmit={handlePaymentSubmit} className="flex flex-col gap-4">
                    <FormField label="Monto a Abonar" icon={<DollarSign size={16} />} required>
                        <input
                            type="number"
                            value={paymentForm.monto}
                            onChange={e => setPaymentForm({ ...paymentForm, monto: e.target.value })}
                            placeholder="0"
                            required
                            min="1"
                            className="text-2xl font-black text-success text-center"
                        />
                    </FormField>

                    <FormField label="Medio de Pago" icon={<CreditCard size={16} />} required>
                        <select
                            value={paymentForm.metodo_pago_id}
                            onChange={e => setPaymentForm({ ...paymentForm, metodo_pago_id: e.target.value })}
                            required
                        >
                            <option value="">Seleccione...</option>
                            {paymentMethods.map(m => (
                                <option key={m.id} value={m.id}>{m.nombre}</option>
                            ))}
                        </select>
                    </FormField>

                    <FormField label="Fecha del Recibo" icon={<Calendar size={16} />} required>
                        <TripleDateSelector
                            value={paymentForm.fecha}
                            onChange={v => setPaymentForm({ ...paymentForm, fecha: v })}
                        />
                    </FormField>

                    <FormField label="Descripción o Notas" icon={<FileText size={16} />}>
                        <textarea
                            value={paymentForm.descripcion}
                            onChange={e => setPaymentForm({ ...paymentForm, descripcion: e.target.value })}
                            rows="2"
                            placeholder="Ej. Abono parcial factura enero..."
                        />
                    </FormField>

                    <div className="flex gap-3 mt-4">
                        <Button variant="secondary" onClick={() => setShowModal(false)} className="flex-1">Cancelar</Button>
                        <Button type="submit" variant="primary" className="flex-1 font-bold">{editingPayment ? 'Guardar Cambios' : 'Confirmar Abono'}</Button>
                    </div>
                </form>
            </Modal>

            {/* Pay Specific Order Modal */}
            <Modal
                isOpen={showOrderModal && selectedAccount}
                onClose={() => { setShowOrderModal(false); setSelectedOrder(null); }}
                title="Saldar Pedido Específico"
                size="lg"
            >
                <div className="p-3 bg-white/5 rounded-lg mb-6 flex justify-between items-center text-sm">
                    <div>
                        <span className="text-muted block text-[10px] uppercase font-bold">Cliente</span>
                        <span className="font-bold">{selectedAccount?.nombre}</span>
                    </div>
                    <div className="text-right">
                        <span className="text-muted block text-[10px] uppercase font-bold text-danger">Deuda Total</span>
                        <span className="font-bold text-danger">{formatCurrency(selectedAccount?.total_deuda)}</span>
                    </div>
                </div>

                {loadingOrders ? (
                    <div className="py-12 text-center text-muted">Cargando pedidos...</div>
                ) : clientOrders.length === 0 ? (
                    <div className="py-12 text-center text-muted">No hay pedidos pendientes para este cliente</div>
                ) : (
                    <div className="flex flex-col gap-6">
                        <div>
                            <label className="text-xs uppercase tracking-widest font-bold text-muted mb-3 block">Seleccione el Pedido:</label>
                            <div className="grid gap-2 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                                {clientOrders.map(order => {
                                    const total = parseFloat(order.total || 0);
                                    const paid = parseFloat(order.monto_pagado || 0);
                                    const isSelected = selectedOrder?.id === order.id;

                                    return (
                                        <div
                                            key={order.id}
                                            onClick={() => setSelectedOrder(order)}
                                            className={`p-4 rounded-xl border transition-all duration-200 group relative overflow-hidden ${isSelected
                                                ? 'border-success bg-success/10 shadow-[0_0_20px_rgba(16,185,129,0.15)]'
                                                : 'border-white/5 bg-white/5 hover:border-white/20 hover:bg-white/10'
                                                }`}
                                        >
                                            <div className="flex justify-between items-center relative z-10">
                                                <div className="flex gap-4 items-center">
                                                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${isSelected ? 'bg-success text-black' : 'bg-white/5 text-muted'}`}>
                                                        <FileText size={20} />
                                                    </div>
                                                    <div>
                                                        <div className="font-bold text-lg">Pedido #{order.id}</div>
                                                        <div className="text-xs text-muted uppercase font-semibold">
                                                            {new Date(order.fecha).toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' })}
                                                        </div>
                                                    </div>
                                                </div>
                                                <div className="text-right">
                                                    <div className={`text-xl font-black ${isSelected ? 'text-success' : 'text-danger'}`}>
                                                        {formatCurrency(total - paid)}
                                                    </div>
                                                    <div className="text-[10px] uppercase font-bold text-muted">Saldo Pendiente</div>
                                                </div>
                                            </div>
                                            {isSelected && (
                                                <div className="absolute right-0 top-0 bottom-0 w-1 bg-success"></div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                        {selectedOrder && (
                            <div className="border-t border-white/5 pt-6 animate-slide-up">
                                <form className="flex flex-col gap-4">
                                    <div className="stats-grid">
                                        <FormField label="Medio de Pago" icon={<CreditCard size={16} />} required>
                                            <select
                                                value={paymentForm.metodo_pago_id}
                                                onChange={e => setPaymentForm({ ...paymentForm, metodo_pago_id: e.target.value })}
                                                required
                                            >
                                                <option value="">Seleccione...</option>
                                                {paymentMethods.map(m => (
                                                    <option key={m.id} value={m.id}>{m.nombre}</option>
                                                ))}
                                            </select>
                                        </FormField>

                                        <FormField label="Fecha Pago" icon={<Calendar size={16} />}>
                                            <TripleDateSelector
                                                value={paymentForm.fecha}
                                                onChange={v => setPaymentForm({ ...paymentForm, fecha: v })}
                                            />
                                        </FormField>
                                    </div>

                                    <FormField label="Descripción (Opcional)" icon={<Info size={16} />}>
                                        <textarea
                                            value={paymentForm.descripcion}
                                            onChange={e => setPaymentForm({ ...paymentForm, descripcion: e.target.value })}
                                            rows="1"
                                            placeholder={`Pago total del pedido #${selectedOrder.id}`}
                                        />
                                    </FormField>

                                    <div className="p-4 bg-success/20 rounded-xl border border-success/30 flex justify-between items-center shadow-inner mt-2">
                                        <div className="text-xs font-bold uppercase tracking-widest text-success-light">Monto a Liquidar:</div>
                                        <div className="text-3xl font-black text-success">
                                            {formatCurrency(parseFloat(selectedOrder.total || 0) - parseFloat(selectedOrder.monto_pagado || 0))}
                                        </div>
                                    </div>

                                    <div className="flex gap-3 mt-4">
                                        <Button
                                            variant="secondary"
                                            onClick={() => { setShowOrderModal(false); setSelectedOrder(null); }}
                                            className="flex-1"
                                        >
                                            Cancelar
                                        </Button>
                                        <Button
                                            variant="success"
                                            onClick={handlePaySpecificOrder}
                                            className="flex-1 font-black"
                                            icon={<CheckCircle size={18} />}
                                        >
                                            Confirmar Liquidación
                                        </Button>
                                    </div>
                                </form>
                            </div>
                        )}
                    </div>
                )}
            </Modal>
        </div>
    );
}

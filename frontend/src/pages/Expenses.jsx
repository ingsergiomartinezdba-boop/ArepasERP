import { useState, useEffect } from 'react';
import { expensesService, suppliersService, paymentMethodsService } from '../services/api';
import { Plus, Trash2, Calendar, Tag, Edit, Search, Filter, CheckCircle, XCircle, TrendingDown, ShoppingBag, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function Expenses() {
    const navigate = useNavigate();
    const [expenses, setExpenses] = useState([]);
    const [loading, setLoading] = useState(true);

    // Suppliers for editing
    const [suppliers, setSuppliers] = useState([]);
    const [paymentMethods, setPaymentMethods] = useState([]);

    // Month Filter (default to current month)
    const [month, setMonth] = useState(new Date().toISOString().slice(0, 7)); // YYYY-MM

    // Edit Modal State
    const [editMode, setEditMode] = useState(false);
    const [editId, setEditId] = useState(null);
    const [form, setForm] = useState({
        concepto: '',
        valor: '',
        categoria: 'materia_prima',
        tipo_gasto: 'variable',
        fecha: '',
        proveedor_id: '',
        observaciones: ''
    });

    // Pay Modal
    const [payModal, setPayModal] = useState({ show: false, expenseId: null, amount: 0, methodId: '' });

    useEffect(() => {
        loadSuppliers();
        loadPaymentMethods();
    }, []);

    useEffect(() => {
        loadExpenses();
    }, [month]);

    const loadSuppliers = async () => {
        try {
            const res = await suppliersService.getAll();
            setSuppliers(res.data);
        } catch (error) {
            console.error(error);
        }
    };

    const loadPaymentMethods = async () => {
        try {
            const res = await paymentMethodsService.getAll();
            setPaymentMethods(res.data.filter(m => m.activo));
        } catch (error) {
            console.error(error);
        }
    };

    const loadExpenses = async () => {
        setLoading(true);
        try {
            // Calculate start and end date
            const year = parseInt(month.split('-')[0]);
            const m = parseInt(month.split('-')[1]);
            const startStr = `${month}-01`;
            const lastDay = new Date(year, m, 0).getDate();
            const endStr = `${month}-${lastDay}`;

            // Allow querying beyond limits?
            // The service call:
            const response = await expensesService.getAll({
                start_date: startStr,
                end_date: endStr
            });
            setExpenses(response.data);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (id) => {
        if (!confirm('¿Anular/Eliminar este gasto? Esta acción no se puede deshacer.')) return;
        try {
            await expensesService.delete(id);
            loadExpenses();
        } catch (err) {
            alert("Error al eliminar");
        }
    };

    const handlePayClick = (expense) => {
        setPayModal({ show: true, expenseId: expense.id, amount: expense.valor, methodId: '' });
    };

    const handleConfirmPay = async (e) => {
        e.preventDefault();
        if (!payModal.methodId) return alert("Seleccione un método de pago");

        try {
            // Note: We use the generic update endpoint. 
            // We should ideally send only the fields to update, but our service/backend expects a full object or handles partials?
            // The backend update_expense takes ExpenseCreate (pydantic).
            // ExpenseCreate has all fields. If we send partial, pydantic might complain if required fields are missing?
            // Wait, ExpenseCreate inherits ExpenseBase. All fields are required except Optionals.
            // But we don't have the full object here easily unless we fetch it or pass it.
            // Actually `expensesService.update` usually does a PUT which replaces? Or PATCH?
            // Backend implementation: `supabase.table("gastos").update(expense.dict()).eq("id", expense_id)`
            // If we send a partial dict, Pydantic validation happens FIRST.
            // If ExpenseCreate has required fields (concept, value, date), we MUST send them.
            // This is a limitation of the current backend `update_expense` signature using `ExpenseCreate`.
            // We have the `expense` object in the list. we can merge.

            const expenseToUpdate = expenses.find(e => e.id === payModal.expenseId);
            if (!expenseToUpdate) return;

            const payload = {
                ...expenseToUpdate,
                medio_pago_id: parseInt(payModal.methodId),
                // Ensure IDs are ints
                proveedor_id: expenseToUpdate.proveedor_id ? parseInt(expenseToUpdate.proveedor_id) : null,
                // Dates might need string format? 'YYYY-MM-DD'
                fecha: expenseToUpdate.fecha
            };

            await expensesService.update(payModal.expenseId, payload);
            setPayModal({ ...payModal, show: false });
            loadExpenses();
        } catch (error) {
            console.error(error);
            alert("Error al registrar pago");
        }
    };

    const handleUnpayClick = async (expense) => {
        if (!confirm('¿Desea marcar este gasto como PENDIENTE? Se eliminará el registro del método de pago.')) return;
        try {
            const payload = {
                ...expense,
                medio_pago_id: null,
                proveedor_id: expense.proveedor_id ? parseInt(expense.proveedor_id) : null
            };
            await expensesService.update(expense.id, payload);
            loadExpenses();
        } catch (error) {
            console.error(error);
            alert("Error al revertir pago");
        }
    };

    const handleEditClick = (expense) => {
        setForm({
            concepto: expense.concepto,
            valor: expense.valor,
            categoria: expense.categoria,
            tipo_gasto: expense.tipo_gasto,
            fecha: expense.fecha,
            proveedor_id: expense.proveedor_id || '',
            observaciones: expense.observaciones || ''
        });
        setEditId(expense.id);
        setEditMode(true);
    };

    const handleUpdate = async (e) => {
        e.preventDefault();
        try {
            const payload = {
                ...form,
                valor: parseFloat(form.valor),
                proveedor_id: form.proveedor_id ? parseInt(form.proveedor_id) : null
            };

            await expensesService.update(editId, payload);
            setEditMode(false);
            setEditId(null);
            loadExpenses();
        } catch (e) {
            alert("Error al actualizar");
        }
    };

    const formatCurrency = (val) => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(val);

    const formatDate = (dateStr) => new Date(dateStr).toLocaleDateString('es-CO', { day: '2-digit', month: '2-digit', year: 'numeric' });

    const totalMonth = expenses.reduce((acc, curr) => acc + curr.valor, 0);

    return (
        <div>
            <div className="page-header flex justify-between items-center mb-6">
                <h1 className="m-0">Gastos</h1>
                <div className="flex gap-2 items-center">
                    <div className="flex gap-1 bg-card rounded border p-1 border-input">
                        <select
                            className="bg-transparent text-sm outline-none px-2 py-1"
                            value={month.split('-')[1]}
                            onChange={e => setMonth(`${month.split('-')[0]}-${e.target.value}`)}
                        >
                            <option value="01">Enero</option>
                            <option value="02">Febrero</option>
                            <option value="03">Marzo</option>
                            <option value="04">Abril</option>
                            <option value="05">Mayo</option>
                            <option value="06">Junio</option>
                            <option value="07">Julio</option>
                            <option value="08">Agosto</option>
                            <option value="09">Septiembre</option>
                            <option value="10">Octubre</option>
                            <option value="11">Noviembre</option>
                            <option value="12">Diciembre</option>
                        </select>
                        <select
                            className="bg-transparent text-sm outline-none px-2 py-1 border-l border-input"
                            value={month.split('-')[0]}
                            onChange={e => setMonth(`${e.target.value}-${month.split('-')[1]}`)}
                        >
                            {[2024, 2025, 2026, 2027, 2028].map(y => (
                                <option key={y} value={y}>{y}</option>
                            ))}
                        </select>
                    </div>
                </div>
            </div>

            <div className="orders-report-grid mb-6">
                {/* Widget 1: Total Gastos */}
                <div className="card p-3 min-[550px]:p-2 mb-0 h-full flex flex-col justify-between" style={{ minWidth: 0, overflow: 'hidden' }}>
                    <div className="flex items-center gap-1 text-muted text-sm min-[550px]:text-[0.7rem] mb-1">
                        <TrendingDown className="w-4 h-4 min-[550px]:w-3 min-[550px]:h-3 text-danger" /> Total Gastos Mes
                    </div>
                    <div className="text-2xl min-[550px]:text-lg font-bold truncate" title={formatCurrency(totalMonth)}>{formatCurrency(totalMonth)}</div>
                </div>

                {/* Widget 2: Cantidad de Gastos */}
                <div className="card p-3 min-[550px]:p-2 mb-0 h-full flex flex-col justify-between" style={{ minWidth: 0, overflow: 'hidden' }}>
                    <div className="flex items-center gap-1 text-muted text-sm min-[550px]:text-[0.7rem] mb-1">
                        <ShoppingBag className="w-4 h-4 min-[550px]:w-3 min-[550px]:h-3 text-primary" /> Cantidad Registros
                    </div>
                    <div className="text-2xl min-[550px]:text-lg font-bold truncate">{expenses.length}</div>
                </div>
            </div>

            <div className="card overflow-x-auto">
                <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '800px' }}>
                    <thead>
                        <tr style={{ borderBottom: '1px solid var(--border)', textAlign: 'left' }}>
                            <th className="p-3">Fecha</th>
                            <th className="p-3">Concepto</th>
                            <th className="p-3">Categoría</th>
                            <th className="p-3">Proveedor</th>
                            <th className="p-3">Estado</th>
                            <th className="p-3 text-right">Valor</th>
                            <th className="p-3 text-center">Acciones</th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            <tr><td colSpan="7" className="p-4 text-center">Cargando...</td></tr>
                        ) : expenses.length === 0 ? (
                            <tr><td colSpan="7" className="p-4 text-center text-muted">No se encontraron gastos en este mes.</td></tr>
                        ) : (
                            expenses.map(expense => (
                                <tr key={expense.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                                    <td className="p-3 text-sm">{formatDate(expense.fecha)}</td>
                                    <td className="p-3">
                                        <div className="font-bold">{expense.concepto}</div>
                                        {expense.observaciones && <div className="text-xs text-muted italic">"{expense.observaciones}"</div>}
                                    </td>
                                    <td className="p-3">
                                        <span className="badge text-xs" style={{ background: 'rgba(255,255,255,0.05)' }}>
                                            {expense.categoria.replace('_', ' ')}
                                        </span>
                                    </td>
                                    <td className="p-3 text-sm text-primary">
                                        {expense.proveedor_nombre || '-'}
                                    </td>
                                    <td className="p-3">
                                        <button
                                            onClick={() => expense.medio_pago_id ? handleUnpayClick(expense) : handlePayClick(expense)}
                                            className={`badge ${!expense.medio_pago_id ? 'text-danger' : 'text-success'}`}
                                            style={{
                                                fontSize: '0.7rem',
                                                textTransform: 'uppercase',
                                                background: 'transparent',
                                                border: '1px solid currentColor',
                                                cursor: 'pointer',
                                                padding: '0.2rem 0.6rem',
                                                borderRadius: '999px',
                                                fontWeight: 'bold'
                                            }}
                                            title={expense.medio_pago_id ? "Click para marcar como Pendiente" : "Click para marcar como Pagado"}
                                        >
                                            {!expense.medio_pago_id ? 'PENDIENTE' : 'PAGADO'}
                                        </button>
                                    </td>
                                    <td className="p-3 text-right font-bold text-danger">
                                        {formatCurrency(expense.valor)}
                                    </td>
                                    <td className="p-3 text-center">
                                        <div className="flex justify-center gap-2">
                                            <button
                                                onClick={() => handleEditClick(expense)}
                                                className="btn btn-secondary"
                                                style={{ padding: '0.4rem' }}
                                                title="Editar"
                                            >
                                                <Edit size={16} />
                                            </button>
                                            <button
                                                onClick={() => handleDelete(expense.id)}
                                                className="btn btn-secondary text-danger"
                                                style={{ padding: '0.4rem' }}
                                                title="Anular"
                                            >
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

            {/* Pay Modal */}
            {payModal.show && (
                <div style={{
                    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                    backgroundColor: 'rgba(0,0,0,0.8)', zIndex: 100,
                    display: 'flex', alignItems: 'center', justifyContent: 'center'
                }}>
                    <div className="card" style={{ width: '90%', maxWidth: '400px', position: 'relative', overflow: 'visible' }}>
                        <button
                            onClick={() => setPayModal({ ...payModal, show: false })}
                            className="btn-close-modal"
                            title="Cerrar"
                        >
                            <X size={18} />
                        </button>

                        <h2>Registrar Pago</h2>
                        <p className="text-muted">Valor a pagar: <span className="text-white font-bold">{formatCurrency(payModal.amount)}</span></p>

                        <form onSubmit={handleConfirmPay} className="mt-4">
                            <div className="form-group">
                                <label>Medio de Pago</label>
                                <select
                                    className="form-control"
                                    value={payModal.methodId}
                                    onChange={e => setPayModal({ ...payModal, methodId: e.target.value })}
                                    required
                                >
                                    <option value="">-- Seleccionar --</option>
                                    {paymentMethods.map(m => (
                                        <option key={m.id} value={m.id}>{m.nombre}</option>
                                    ))}
                                </select>
                            </div>

                            <div className="mt-6">
                                <button type="submit" className="btn btn-primary font-bold" style={{ width: '100%' }}>Confirmar Pago</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Edit Modal */}
            {editMode && (
                <div style={{
                    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                    backgroundColor: 'rgba(0,0,0,0.8)', zIndex: 100,
                    display: 'flex', alignItems: 'center', justifyContent: 'center'
                }}>
                    <div className="card" style={{ width: '90%', maxWidth: '500px', position: 'relative', overflow: 'visible' }}>
                        <button
                            onClick={() => setEditMode(false)}
                            className="btn-close-modal"
                            title="Cerrar"
                        >
                            <X size={18} />
                        </button>

                        <div style={{ maxHeight: '85vh', overflowY: 'auto', paddingRight: '5px' }}>
                            <h2>Editar Gasto</h2>
                            <form onSubmit={handleUpdate} className="mt-4">
                                <div className="form-group">
                                    <label>Concepto</label>
                                    <input
                                        value={form.concepto}
                                        onChange={e => setForm({ ...form, concepto: e.target.value })}
                                        required
                                    />
                                </div>

                                <div className="form-group">
                                    <label>Valor</label>
                                    <input
                                        type="number"
                                        value={form.valor}
                                        onChange={e => setForm({ ...form, valor: e.target.value })}
                                        required
                                    />
                                </div>

                                <div className="form-group">
                                    <label>Categoría</label>
                                    <select
                                        value={form.categoria}
                                        onChange={e => setForm({ ...form, categoria: e.target.value })}
                                        className="form-control"
                                    >
                                        <option value="materia_prima">Materia Prima</option>
                                        <option value="produccion">Producción</option>
                                        <option value="mantenimiento">Mantenimiento</option>
                                        <option value="transporte">Transporte</option>
                                        <option value="servicios">Servicios</option>
                                        <option value="nomina">Nómina</option>
                                        <option value="administracion">Admin</option>
                                        <option value="otros">Otros</option>
                                    </select>
                                </div>

                                <div className="form-group">
                                    <label>Proveedor</label>
                                    <select
                                        value={form.proveedor_id}
                                        onChange={e => setForm({ ...form, proveedor_id: e.target.value })}
                                        className="form-control"
                                    >
                                        <option value="">-- Seleccionar --</option>
                                        {suppliers.map(s => (
                                            <option key={s.id} value={s.id}>{s.nombre}</option>
                                        ))}
                                    </select>
                                </div>

                                <div className="form-group">
                                    <label>Fecha</label>
                                    <input
                                        type="date"
                                        value={form.fecha}
                                        onChange={e => setForm({ ...form, fecha: e.target.value })}
                                        required
                                    />
                                </div>

                                <div className="form-group">
                                    <label>Observaciones</label>
                                    <textarea
                                        value={form.observaciones}
                                        onChange={e => setForm({ ...form, observaciones: e.target.value })}
                                        className="form-control"
                                        rows="1"
                                    />
                                </div>

                                <div className="mt-6">
                                    <button type="submit" className="btn btn-primary font-bold" style={{ width: '100%' }}>Actualizar Gasto</button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            )}
        </div >
    );
}

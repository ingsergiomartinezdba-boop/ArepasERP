import { useState, useEffect } from 'react';
import { expensesService, suppliersService, paymentMethodsService } from '../services/api';
import { Plus, Trash2, Calendar, Tag, Edit, Search, Filter, CheckCircle, XCircle } from 'lucide-react';
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

    const totalMonth = expenses.reduce((acc, curr) => acc + curr.valor, 0);

    return (
        <div>
            <div className="flex flex-col md:flex-row justify-between items-center mb-4 gap-4">
                <div className="flex items-center gap-4">
                    <h1 style={{ margin: 0 }}>Gastos</h1>
                    <div className="flex gap-2 items-center">
                        <Calendar size={18} className="text-muted" />
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

                <div className="text-right flex items-center gap-4">
                    <div>
                        <p className="text-muted text-sm">Total Mes</p>
                        <p className="text-xl font-bold text-danger">{formatCurrency(totalMonth)}</p>
                    </div>
                </div>
            </div>

            {loading ? <p>Cargando...</p> : (
                <div className="flex" style={{ flexDirection: 'column', gap: '0.75rem' }}>
                    {expenses.map(expense => (
                        <div key={expense.id} className="card" style={{ marginBottom: 0, padding: '1rem' }}>
                            <div className="flex justify-between items-start">
                                <div style={{ flex: 1 }}>
                                    <div className="flex justify-between items-center mb-1">
                                        <h3 style={{ fontSize: '1rem', margin: 0 }}>{expense.concepto}</h3>
                                        <h2 className="text-danger font-bold" style={{ fontSize: '1.1rem', margin: 0 }}>
                                            {formatCurrency(expense.valor)}
                                        </h2>
                                    </div>

                                    <div className="flex flex-wrap gap-2 text-muted mt-2" style={{ fontSize: '0.8rem' }}>
                                        <span className="flex items-center gap-1 badge" style={{ background: 'rgba(255,255,255,0.05)' }}>
                                            <Tag size={12} /> {expense.categoria.replace('_', ' ')}
                                        </span>
                                        <span className="flex items-center gap-1">
                                            <Calendar size={12} /> {new Date(expense.fecha).toLocaleDateString('es-CO', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                                        </span>
                                        {expense.proveedor_nombre && (
                                            <span className="flex items-center gap-1 text-primary">
                                                Prove: {expense.proveedor_nombre}
                                            </span>
                                        )}
                                    </div>
                                    {expense.observaciones && (
                                        <p className="text-muted mt-1 text-sm italic">"{expense.observaciones}"</p>
                                    )}

                                    <div className="mt-2">
                                        <button
                                            onClick={(e) => { e.stopPropagation(); !expense.medio_pago_id && handlePayClick(expense); }}
                                            className={`badge ${!expense.medio_pago_id ? 'text-danger' : 'text-success'}`}
                                            style={{
                                                fontSize: '0.7rem',
                                                textTransform: 'uppercase',
                                                background: 'transparent',
                                                border: '1px solid currentColor',
                                                cursor: !expense.medio_pago_id ? 'pointer' : 'default',
                                                padding: '0.2rem 0.6rem',
                                                borderRadius: '999px',
                                                fontWeight: 'bold',
                                                letterSpacing: '0.5px'
                                            }}
                                            title={!expense.medio_pago_id ? "Clic para registrar pago" : "Pagado"}
                                        >
                                            {!expense.medio_pago_id ? 'PENDIENTE' : 'PAGADO'}
                                        </button>
                                    </div>
                                </div>

                                <div className="flex flex-col justify-center gap-2 ml-4">
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
                                        title="Anular / Eliminar"
                                    >
                                        <Trash2 size={16} />
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))}
                    {expenses.length === 0 && (
                        <div className="text-center p-8 card border-dashed">
                            <p className="text-muted">No hay gastos registrados en este mes.</p>
                        </div>
                    )}
                </div>
            )}

            {/* Pay Modal */}
            {payModal.show && (
                <div style={{
                    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                    backgroundColor: 'rgba(0,0,0,0.8)', zIndex: 100,
                    display: 'flex', alignItems: 'center', justifyContent: 'center'
                }}>
                    <div className="card" style={{ width: '90%', maxWidth: '400px' }}>
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

                            <div className="flex gap-2 justify-end mt-6">
                                <button type="button" onClick={() => setPayModal({ ...payModal, show: false })} className="btn btn-secondary">Cancelar</button>
                                <button type="submit" className="btn btn-success text-black font-bold">Confirmar Pago</button>
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
                    <div className="card" style={{ width: '90%', maxWidth: '500px', maxHeight: '90vh', overflowY: 'auto' }}>
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

                            <div className="flex gap-2 justify-end mt-4">
                                <button type="button" onClick={() => setEditMode(false)} className="btn btn-secondary">Cancelar</button>
                                <button type="submit" className="btn btn-primary">Actualizar</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}

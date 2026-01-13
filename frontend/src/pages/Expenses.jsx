import { useState, useEffect } from 'react';
import { expensesService, suppliersService } from '../services/api';
import { Plus, Trash2, Calendar, Tag, Edit, Search, Filter } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function Expenses() {
    const navigate = useNavigate();
    const [expenses, setExpenses] = useState([]);
    const [loading, setLoading] = useState(true);

    // Suppliers for editing
    const [suppliers, setSuppliers] = useState([]);

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

    useEffect(() => {
        loadSuppliers();
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

    const loadExpenses = async () => {
        setLoading(true);
        try {
            // Calculate start and end date
            const year = parseInt(month.split('-')[0]);
            const m = parseInt(month.split('-')[1]);
            const startStr = `${month}-01`;
            const lastDay = new Date(year, m, 0).getDate();
            const endStr = `${month}-${lastDay}`;

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
        if (!confirm('¿Eliminar este gasto?')) return;
        try {
            await expensesService.delete(id);
            loadExpenses();
        } catch (err) {
            alert("Error al eliminar");
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
                    <button onClick={() => navigate('/expenses/new')} className="btn btn-primary" style={{ width: 'auto', padding: '0.5rem' }}>
                        <Plus size={20} />
                    </button>
                    <div className="flex gap-2 items-center">
                        <Calendar size={18} className="text-muted" />
                        <input
                            type="month"
                            value={month}
                            onChange={e => setMonth(e.target.value)}
                            className="form-control"
                            style={{ width: 'auto', padding: '0.3rem' }}
                        />
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
                                            <Calendar size={12} /> {new Date(expense.fecha).toLocaleDateString('es-CO')}
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
                                </div>

                                <div className="flex flex-col gap-2 ml-4">
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
                                        title="Eliminar"
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

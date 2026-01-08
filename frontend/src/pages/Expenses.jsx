import { useState, useEffect } from 'react';
import { expensesService } from '../services/api';
import { Plus, Trash2, Calendar, DollarSign, Tag } from 'lucide-react';

export default function Expenses() {
    const [expenses, setExpenses] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);

    const [newExpense, setNewExpense] = useState({
        concepto: '',
        valor: '',
        categoria: 'materia_prima', // Default
        tipo_gasto: 'variable',
        fecha: new Date().toISOString().split('T')[0]
    });

    useEffect(() => {
        loadExpenses();
    }, []);

    const loadExpenses = async () => {
        try {
            const response = await expensesService.getAll();
            setExpenses(response.data);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            await expensesService.create({
                ...newExpense,
                valor: parseFloat(newExpense.valor)
            });
            setShowForm(false);
            setNewExpense({
                concepto: '',
                valor: '',
                categoria: 'materia_prima',
                tipo_gasto: 'variable',
                fecha: new Date().toISOString().split('T')[0]
            });
            loadExpenses();
        } catch (err) {
            alert("Error al guardar gasto");
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

    const formatCurrency = (val) => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP' }).format(val);

    if (showForm) {
        return (
            <div>
                <div className="flex justify-between items-center mb-4">
                    <h1>Nuevo Gasto</h1>
                    <button onClick={() => setShowForm(false)} className="btn btn-secondary" style={{ width: 'auto' }}>
                        Cancelar
                    </button>
                </div>

                <form onSubmit={handleSubmit}>
                    <div className="form-group">
                        <label>Concepto</label>
                        <input
                            value={newExpense.concepto}
                            onChange={e => setNewExpense({ ...newExpense, concepto: e.target.value })}
                            placeholder="Ej. Bulto de maíz"
                            required
                        />
                    </div>

                    <div className="form-group">
                        <label>Valor</label>
                        <div className="flex items-center">
                            <span style={{ marginRight: '8px' }}>$</span>
                            <input
                                type="number"
                                value={newExpense.valor}
                                onChange={e => setNewExpense({ ...newExpense, valor: e.target.value })}
                                required
                            />
                        </div>
                    </div>

                    <div className="stats-grid">
                        <div className="form-group">
                            <label>Categoría</label>
                            <select
                                value={newExpense.categoria}
                                onChange={e => setNewExpense({ ...newExpense, categoria: e.target.value })}
                            >
                                <option value="materia_prima">Materia Prima</option>
                                <option value="produccion">Producción</option>
                                <option value="mantenimiento">Mantenimiento</option>
                                <option value="transporte">Transporte</option>
                                <option value="servicios">Servicios</option>
                                <option value="administracion">Admin</option>
                                <option value="otros">Otros</option>
                            </select>
                        </div>

                        <div className="form-group">
                            <label>Tipo</label>
                            <select
                                value={newExpense.tipo_gasto}
                                onChange={e => setNewExpense({ ...newExpense, tipo_gasto: e.target.value })}
                            >
                                <option value="variable">Variable</option>
                                <option value="fijo">Fijo</option>
                            </select>
                        </div>
                    </div>

                    <div className="form-group">
                        <label>Fecha</label>
                        <input
                            type="date"
                            value={newExpense.fecha}
                            onChange={e => setNewExpense({ ...newExpense, fecha: e.target.value })}
                            required
                        />
                    </div>

                    <button type="submit" className="btn btn-primary mt-4">Guardar Gasto</button>
                </form>
            </div>
        );
    }

    return (
        <div>
            <div className="flex justify-between items-center mb-4">
                <h1>Gastos</h1>
                <button onClick={() => setShowForm(true)} className="btn btn-primary" style={{ width: 'auto', padding: '0.5rem 1rem' }}>
                    <Plus size={20} />
                </button>
            </div>

            {loading ? <p>Cargando...</p> : (
                <div className="flex" style={{ flexDirection: 'column', gap: '0.75rem' }}>
                    {expenses.map(expense => (
                        <div key={expense.id} className="card" style={{ marginBottom: 0, padding: '1rem' }}>
                            <div className="flex justify-between items-start">
                                <div>
                                    <h3 style={{ fontSize: '1rem', marginBottom: '0.25rem' }}>{expense.concepto}</h3>
                                    <h2 className="text-danger" style={{ fontSize: '1.1rem', marginBottom: '0.5rem' }}>
                                        {formatCurrency(expense.valor)}
                                    </h2>
                                    <div className="flex gap-2 text-muted" style={{ fontSize: '0.8rem' }}>
                                        <span className="flex items-center gap-1"><Tag size={12} /> {expense.categoria}</span>
                                        <span className="flex items-center gap-1"><Calendar size={12} /> {expense.fecha}</span>
                                    </div>
                                </div>
                                <button
                                    onClick={() => handleDelete(expense.id)}
                                    className="btn btn-secondary text-danger"
                                    style={{ width: 'auto', padding: '0.5rem' }}
                                >
                                    <Trash2 size={16} />
                                </button>
                            </div>
                        </div>
                    ))}
                    {expenses.length === 0 && <p className="text-center text-muted">No hay gastos registrados.</p>}
                </div>
            )}
        </div>
    );
}

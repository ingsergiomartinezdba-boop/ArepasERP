import { useState, useEffect } from 'react';
import { expensesService, suppliersService } from '../services/api';
import { useNavigate } from 'react-router-dom';
import { Save, ArrowLeft } from 'lucide-react';

export default function ExpenseForm() {
    const navigate = useNavigate();
    const [suppliers, setSuppliers] = useState([]);
    const [loading, setLoading] = useState(false);

    const [form, setForm] = useState({
        concepto: '',
        valor: '',
        categoria: 'materia_prima',
        tipo_gasto: 'variable',
        fecha: new Date().toISOString().split('T')[0],
        proveedor_id: '',
        observaciones: ''
    });

    useEffect(() => {
        loadSuppliers();
    }, []);

    const loadSuppliers = async () => {
        try {
            const res = await suppliersService.getAll();
            setSuppliers(res.data);
        } catch (error) {
            console.error(error);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            const payload = {
                ...form,
                valor: parseFloat(form.valor),
                proveedor_id: form.proveedor_id ? parseInt(form.proveedor_id) : null
            };

            await expensesService.create(payload);
            alert("Gasto registrado correctamente");
            navigate('/expenses');
        } catch (err) {
            alert("Error al guardar gasto");
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div style={{ maxWidth: '600px', margin: '0 auto' }}>
            <div className="flex items-center gap-4 mb-4">
                <button onClick={() => navigate('/expenses')} className="btn btn-secondary" style={{ width: 'auto', padding: '0.4rem' }}>
                    <ArrowLeft size={20} />
                </button>
                <h1>Nuevo Gasto</h1>
            </div>

            <div className="card">
                <form onSubmit={handleSubmit}>
                    <div className="form-group">
                        <label>Concepto *</label>
                        <input
                            value={form.concepto}
                            onChange={e => setForm({ ...form, concepto: e.target.value })}
                            placeholder="Ej. Bulto de maíz"
                            required
                        />
                    </div>

                    <div className="form-group">
                        <label>Valor *</label>
                        <div className="flex items-center">
                            <span style={{ marginRight: '8px' }}>$</span>
                            <input
                                type="number"
                                value={form.valor}
                                onChange={e => setForm({ ...form, valor: e.target.value })}
                                required
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                            <label>Tipo</label>
                            <select
                                value={form.tipo_gasto}
                                onChange={e => setForm({ ...form, tipo_gasto: e.target.value })}
                                className="form-control"
                            >
                                <option value="variable">Variable</option>
                                <option value="fijo">Fijo</option>
                            </select>
                        </div>
                    </div>

                    <div className="form-group">
                        <label>Proveedor (Opcional)</label>
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
                        <label>Fecha *</label>
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
                            rows="2"
                        />
                    </div>

                    <button type="submit" className="btn btn-primary mt-4 w-full" disabled={loading}>
                        <Save size={18} style={{ marginRight: '8px' }} />
                        {loading ? 'Guardando...' : 'Guardar Gasto'}
                    </button>
                </form>
            </div>
        </div>
    );
}

import { useState, useEffect } from 'react';
import { expensesService, suppliersService, paymentMethodsService } from '../services/api';
import { useNavigate } from 'react-router-dom';
import { Save, ArrowLeft, Clock, Wallet, DollarSign, FileText, Tag, List } from 'lucide-react';
import TripleDateSelector from '../components/TripleDateSelector';

export default function ExpenseForm() {
    const navigate = useNavigate();
    const [suppliers, setSuppliers] = useState([]);
    const [paymentMethods, setPaymentMethods] = useState([]);
    const [loading, setLoading] = useState(false);

    const [form, setForm] = useState({
        concepto: '',
        valor: '',
        categoria: 'materia_prima',
        tipo_gasto: 'variable',
        fecha: new Date().toISOString().split('T')[0],
        proveedor_id: '',
        observaciones: '',
        estado_pago: 'pagado', // 'pagado' or 'credito'
        medio_pago_id: ''
    });

    useEffect(() => {
        loadSuppliers();
        loadPaymentMethods();
    }, []);

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

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            const payload = {
                ...form,
                valor: parseFloat(form.valor),
                proveedor_id: form.proveedor_id ? parseInt(form.proveedor_id) : null,
                medio_pago_id: (form.estado_pago === 'pagado' && form.medio_pago_id) ? parseInt(form.medio_pago_id) : null
            };
            // Clean up virtual fields not in backend model
            delete payload.estado_pago;

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
        <div style={{ maxWidth: '800px', margin: '0 auto' }}>
            <div className="flex justify-between items-center mb-6">
                <div className="flex items-center gap-4">
                    <button onClick={() => navigate('/expenses')} className="btn btn-secondary" style={{ width: '40px', height: '40px', padding: 0, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <ArrowLeft size={20} />
                    </button>
                    <h1 className="m-0 text-2xl font-bold">Nuevo Gasto</h1>
                </div>

                <div className="flex items-center gap-3">
                    <TripleDateSelector
                        value={form.fecha}
                        onChange={(newDate) => setForm({ ...form, fecha: newDate })}
                        style={{ padding: '0.2rem 0.6rem', minWidth: '260px' }}
                    />
                    <button
                        onClick={handleSubmit}
                        className="btn btn-primary"
                        style={{ width: 'auto', padding: '0.6rem 1rem' }}
                        disabled={loading}
                    >
                        <Save size={20} />
                    </button>
                </div>
            </div>

            <div className="card p-6">
                <form onSubmit={handleSubmit} className="flex flex-col gap-6">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="form-group md:col-span-2">
                            <label className="text-sm text-muted mb-1 block">Concepto / Detalle *</label>
                            <div className="relative">
                                <div className="absolute left-3 top-1/2 -translate-y-1/2 text-muted">
                                    <Tag size={16} />
                                </div>
                                <input
                                    className="pl-10"
                                    value={form.concepto}
                                    onChange={e => setForm({ ...form, concepto: e.target.value })}
                                    placeholder="Ej. Bulto de maíz, Servicios públicos..."
                                    required
                                />
                            </div>
                        </div>

                        <div className="form-group">
                            <label className="text-sm text-muted mb-1 block">Valor *</label>
                            <div className="relative">
                                <div className="absolute left-3 top-1/2 -translate-y-1/2 text-success font-bold">
                                    $
                                </div>
                                <input
                                    type="number"
                                    className="pl-8 text-lg font-bold"
                                    value={form.valor}
                                    onChange={e => setForm({ ...form, valor: e.target.value })}
                                    placeholder="0"
                                    required
                                />
                            </div>
                        </div>
                    </div>

                    <div className="form-group bg-card/50 p-4 rounded-xl border border-white/10 mb-6">
                        <label className="mb-3 block text-sm font-medium text-muted-foreground uppercase tracking-wide">Estado del Pago</label>

                        <div className="flex w-full gap-4 mb-4">
                            <button
                                type="button"
                                className={`flex items-center justify-center gap-2 py-3 px-4 rounded-lg text-sm font-bold transition-all ${form.estado_pago === 'pagado'
                                    ? 'bg-emerald-600 text-white'
                                    : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                                    }`}
                                onClick={() => setForm({ ...form, estado_pago: 'pagado' })}
                            >
                                <DollarSign size={18} />
                                PAGADO
                            </button>
                            <button
                                type="button"
                                className={`flex items-center justify-center gap-2 py-3 px-4 rounded-lg text-sm font-bold transition-all ${form.estado_pago === 'credito'
                                    ? 'bg-red-600 text-white'
                                    : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                                    }`}
                                onClick={() => setForm({ ...form, estado_pago: 'credito', medio_pago_id: '' })}
                            >
                                <FileText size={18} />
                                CRÉDITO / POR PAGAR
                            </button>
                        </div>

                        {form.estado_pago === 'pagado' ? (
                            <div className="animate-fade-in space-y-2">
                                <label className="text-sm text-gray-400 flex items-center gap-2">
                                    <Wallet size={14} /> Medio de Pago *
                                </label>
                                <div className="relative">
                                    <select
                                        value={form.medio_pago_id}
                                        onChange={e => setForm({ ...form, medio_pago_id: e.target.value })}
                                        className="w-full bg-black/40 border border-white/10 rounded-lg py-3 px-4 text-white focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none appearance-none transition-all"
                                        style={{ backgroundImage: 'none' }}
                                        required={form.estado_pago === 'pagado'}
                                    >
                                        <option value="">-- Seleccionar Medio --</option>
                                        {paymentMethods.map(m => (
                                            <option key={m.id} value={m.id}>{m.nombre}</option>
                                        ))}
                                    </select>
                                    <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-muted-foreground text-xs">
                                        ▼
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="flex items-center gap-3 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-400 text-sm animate-fade-in">
                                <Clock size={16} />
                                <span>El gasto se registrará como una <strong>cuenta por pagar</strong> pendiente.</span>
                            </div>
                        )}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="form-group">
                            <label className="text-sm text-muted mb-1 block">Categoría</label>
                            <select
                                value={form.categoria}
                                onChange={e => setForm({ ...form, categoria: e.target.value })}
                                className="form-control"
                            >
                                <option value="materia_prima">📦 Materia Prima</option>
                                <option value="produccion">⚙️ Producción</option>
                                <option value="mantenimiento">🔧 Mantenimiento</option>
                                <option value="transporte">🚚 Transporte</option>
                                <option value="servicios">💡 Servicios</option>
                                <option value="nomina">👥 Nómina</option>
                                <option value="administracion">📁 Administración</option>
                                <option value="otros">✨ Otros</option>
                            </select>
                        </div>

                        <div className="form-group">
                            <label className="text-sm text-muted mb-1 block">Tipo de Gasto</label>
                            <select
                                value={form.tipo_gasto}
                                onChange={e => setForm({ ...form, tipo_gasto: e.target.value })}
                                className="form-control"
                            >
                                <option value="variable">📈 Variable</option>
                                <option value="fijo">🔒 Fijo</option>
                            </select>
                        </div>
                    </div>

                    <div className="form-group">
                        <label className="text-sm text-muted mb-1 block">Proveedor {form.estado_pago === 'credito' ? '*' : '(Opcional)'}</label>
                        <select
                            value={form.proveedor_id}
                            onChange={e => setForm({ ...form, proveedor_id: e.target.value })}
                            className="form-control"
                            required={form.estado_pago === 'credito'}
                        >
                            <option value="">-- Seleccionar Proveedor --</option>
                            {suppliers.map(s => (
                                <option key={s.id} value={s.id}>{s.nombre}</option>
                            ))}
                        </select>
                    </div>

                    <div className="form-group">
                        <label className="text-sm text-muted mb-1 block">Observaciones adicionales</label>
                        <textarea
                            value={form.observaciones}
                            onChange={e => setForm({ ...form, observaciones: e.target.value })}
                            rows="2"
                            placeholder="Notas importantes sobre este gasto..."
                        />
                    </div>
                </form>
            </div>
        </div>
    );
}

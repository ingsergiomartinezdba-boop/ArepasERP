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

            <form onSubmit={handleSubmit} className="flex flex-col gap-6">
                {/* SECCIÓN 1: IDENTIDAD DEL GASTO */}
                <div className="card p-6" style={{ borderLeft: '4px solid var(--primary)' }}>
                    <h3 className="text-sm uppercase tracking-widest font-bold text-primary mb-4 flex items-center gap-2">
                        <Tag size={18} /> 1. Datos del Gasto
                    </h3>

                    <div className="flex gap-4 w-full mb-6">
                        <div className="form-group" style={{ flex: 2 }}>
                            <label className="text-sm text-muted mb-1 block font-medium">Proveedor *</label>
                            <select
                                value={form.proveedor_id}
                                onChange={e => setForm({ ...form, proveedor_id: e.target.value })}
                                className="w-full"
                                required
                                style={{ height: '45px', background: 'rgba(0,0,0,0.2)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', color: 'white', padding: '0 0.75rem', fontWeight: 'bold' }}
                            >
                                <option value="">-- Seleccionar Proveedor --</option>
                                {suppliers.map(s => (
                                    <option key={s.id} value={s.id}>{s.nombre}</option>
                                ))}
                            </select>
                        </div>

                        <div className="form-group flex-1">
                            <label className="text-sm text-muted mb-1 block font-medium">Valor *</label>
                            <div className="flex items-center gap-2" style={{ height: '45px', background: 'rgba(16, 185, 129, 0.05)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '0 0.75rem' }}>
                                <span className="text-success font-bold text-xl">$</span>
                                <input
                                    type="number"
                                    className="text-2xl font-black text-success w-full bg-transparent border-none outline-none p-0"
                                    value={form.valor}
                                    onChange={e => setForm({ ...form, valor: e.target.value })}
                                    placeholder="0"
                                    required
                                />
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 gap-6">
                        <div className="form-group">
                            <label className="text-sm text-muted mb-1 block">Concepto / Detalle *</label>
                            <input
                                value={form.concepto}
                                onChange={e => setForm({ ...form, concepto: e.target.value })}
                                placeholder="Ej. Bulto de maíz, Servicios públicos..."
                                required
                            />
                        </div>
                    </div>
                </div>

                {/* SECCIÓN 2: PAGO Y CLASIFICACIÓN */}
                <div className="card p-6" style={{ borderLeft: '4px solid var(--secondary)' }}>
                    <h3 className="text-sm uppercase tracking-widest font-bold text-success mb-6 flex items-center gap-2">
                        <Wallet size={18} /> 2. Pago y Clasificación
                    </h3>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* Fila 1: Estado, Categoría y Tipo */}
                        <div className="flex gap-4 w-full md:col-span-2 items-end">
                            <div className="form-group" style={{ flex: 1.5 }}>
                                <label className="mb-2 block text-xs font-bold text-muted-foreground uppercase tracking-wider">Estado de Pago</label>
                                <div className="flex gap-2">
                                    <button
                                        type="button"
                                        className={`flex-1 flex items-center justify-center gap-1 py-2 px-2 rounded-lg text-[0.7rem] font-bold transition-all active:scale-95 border ${form.estado_pago === 'pagado'
                                            ? 'shadow-[0_4px_15px_rgba(249,115,22,0.4)]'
                                            : 'hover:bg-white/10'
                                            }`}
                                        style={{
                                            background: form.estado_pago === 'pagado' ? 'linear-gradient(135deg, #f97316 0%, #ea580c 100%)' : 'rgba(255,255,255,0.05)',
                                            color: form.estado_pago === 'pagado' ? 'white' : '#94a3b8',
                                            borderColor: form.estado_pago === 'pagado' ? '#fb923c' : 'rgba(255,255,255,0.1)'
                                        }}
                                        onClick={() => setForm({ ...form, estado_pago: 'pagado' })}
                                    >
                                        <DollarSign size={14} className={form.estado_pago === 'pagado' ? 'animate-pulse' : ''} />
                                        PAGADO
                                    </button>
                                    <button
                                        type="button"
                                        className={`flex-1 flex items-center justify-center gap-1 py-2 px-2 rounded-lg text-[0.7rem] font-bold transition-all active:scale-95 border ${form.estado_pago === 'credito'
                                            ? 'shadow-[0_4px_15px_rgba(249,115,22,0.4)]'
                                            : 'hover:bg-white/10'
                                            }`}
                                        style={{
                                            background: form.estado_pago === 'credito' ? 'linear-gradient(135deg, #f97316 0%, #ea580c 100%)' : 'rgba(255,255,255,0.05)',
                                            color: form.estado_pago === 'credito' ? 'white' : '#94a3b8',
                                            borderColor: form.estado_pago === 'credito' ? '#fb923c' : 'rgba(255,255,255,0.1)'
                                        }}
                                        onClick={() => setForm({ ...form, estado_pago: 'credito', medio_pago_id: '' })}
                                    >
                                        <FileText size={14} className={form.estado_pago === 'credito' ? 'animate-pulse' : ''} />
                                        CRÉDITO
                                    </button>
                                </div>
                            </div>

                            <div className="form-group flex-1">
                                <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2 block">Categoría</label>
                                <select
                                    value={form.categoria}
                                    onChange={e => setForm({ ...form, categoria: e.target.value })}
                                    className="form-control"
                                    style={{ height: '40px', fontSize: '0.8rem' }}
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

                            <div className="form-group flex-1">
                                <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2 block">Tipo de Gasto</label>
                                <select
                                    value={form.tipo_gasto}
                                    onChange={e => setForm({ ...form, tipo_gasto: e.target.value })}
                                    className="form-control"
                                    style={{ height: '40px', fontSize: '0.8rem' }}
                                >
                                    <option value="variable">📈 Variable</option>
                                    <option value="fijo">🔒 Fijo</option>
                                </select>
                            </div>
                        </div>

                        {/* Fila 2: Medio de Pago o Info de Crédito */}
                        <div className="md:col-span-2">
                            {form.estado_pago === 'pagado' ? (
                                <div className="animate-fade-in bg-emerald-500/5 p-4 rounded-xl border border-emerald-500/10 flex items-center gap-4 mt-2">
                                    <div className="flex items-center gap-2 text-xs font-bold uppercase whitespace-nowrap" style={{ color: '#f97316' }}>
                                        <Wallet size={16} />
                                        Medio de Pago:
                                    </div>
                                    <div className="relative flex-1">
                                        <select
                                            value={form.medio_pago_id}
                                            onChange={e => setForm({ ...form, medio_pago_id: e.target.value })}
                                            className="w-full bg-black/20 border border-white/5 rounded-lg py-2 px-4 text-white focus:border-emerald-500 outline-none appearance-none text-sm"
                                            required={form.estado_pago === 'pagado'}
                                        >
                                            <option value="">-- Seleccionar Medio --</option>
                                            {paymentMethods.map(m => (
                                                <option key={m.id} value={m.id}>{m.nombre}</option>
                                            ))}
                                        </select>
                                    </div>
                                </div>
                            ) : (
                                <div className="flex items-center gap-3 p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-500 text-xs animate-fade-in mt-2 font-bold" style={{ color: '#ef4444' }}>
                                    <Clock size={16} />
                                    <span>Se registrará como una cuenta por pagar pendiente en el sistema.</span>
                                </div>
                            )}
                        </div>

                        {/* Fila 3: Observaciones */}
                        <div className="form-group md:col-span-2 mt-2">
                            <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2 block">Observaciones adicionales</label>
                            <textarea
                                value={form.observaciones}
                                onChange={e => setForm({ ...form, observaciones: e.target.value })}
                                rows="2"
                                placeholder="Notas opcionales sobre este gasto..."
                                style={{ minHeight: '80px', background: 'rgba(255,255,255,0.02)' }}
                            />
                        </div>
                    </div>
                </div>
            </form>
        </div>
    );
}

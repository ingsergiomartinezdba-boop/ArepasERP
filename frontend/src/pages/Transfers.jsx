import { useState, useEffect } from 'react';
import { transfersService, paymentMethodsService } from '../services/api';
import { ArrowRightLeft, Save } from 'lucide-react';

export default function Transfers() {
    const [transfers, setTransfers] = useState([]);
    const [methods, setMethods] = useState([]);
    const [loading, setLoading] = useState(true);
    const [form, setForm] = useState({
        origen_id: '',
        destino_id: '',
        valor: '',
        fecha: new Date().toISOString().split('T')[0],
        descripcion: ''
    });

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        setLoading(true);
        try {
            const [transfersRes, methodsRes] = await Promise.all([
                transfersService.getAll(),
                paymentMethodsService.getAll()
            ]);
            setTransfers(transfersRes.data);
            setMethods(methodsRes.data.filter(m => m.activo));
        } catch (error) {
            console.error("Error loading data", error);
        } finally {
            setLoading(false);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (Number(form.origen_id) === Number(form.destino_id)) {
            alert("El origen y destino no pueden ser iguales");
            return;
        }

        try {
            const payload = {
                ...form,
                origen_id: Number(form.origen_id),
                destino_id: Number(form.destino_id),
                valor: Number(form.valor)
            };
            await transfersService.create(payload);
            alert("Transferencia registrada exitosamente");
            setForm({
                ...form,
                valor: '',
                descripcion: ''
            });
            loadData();
        } catch (error) {
            console.error(error);
            alert("Error al registrar transferencia");
        }
    };

    const getMethodName = (id) => methods.find(m => m.id === id)?.nombre || 'Desconocido';

    const formatCurrency = (val) => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(val);

    return (
        <div>
            <div className="page-header mb-6">
                <h1>Movimientos de Caja</h1>
            </div>

            <div className="card mb-6 p-6">
                <h3 className="mb-4 flex items-center gap-2">
                    <ArrowRightLeft size={20} className="text-primary" />
                    Nueva Transferencia
                </h3>
                <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="form-group">
                        <label>Origen (Desde)</label>
                        <select
                            value={form.origen_id}
                            onChange={e => setForm({ ...form, origen_id: e.target.value })}
                            required
                        >
                            <option value="">Seleccionar Origen...</option>
                            {methods.map(m => (
                                <option key={m.id} value={m.id}>{m.nombre}</option>
                            ))}
                        </select>
                    </div>

                    <div className="form-group">
                        <label>Destino (Hacia)</label>
                        <select
                            value={form.destino_id}
                            onChange={e => setForm({ ...form, destino_id: e.target.value })}
                            required
                        >
                            <option value="">Seleccionar Destino...</option>
                            {methods.map(m => (
                                <option key={m.id} value={m.id}>{m.nombre}</option>
                            ))}
                        </select>
                    </div>

                    <div className="form-group">
                        <label>Valor</label>
                        <input
                            type="number"
                            value={form.valor}
                            onChange={e => setForm({ ...form, valor: e.target.value })}
                            required
                            min="1"
                            placeholder="0"
                        />
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

                    <div className="form-group md:col-span-2">
                        <label>Descripción / Motivo</label>
                        <textarea
                            value={form.descripcion}
                            onChange={e => setForm({ ...form, descripcion: e.target.value })}
                            required
                            rows="2"
                            placeholder="Ej. Consignación ventas efectivo"
                        />
                    </div>

                    <div className="md:col-span-2">
                        <button type="submit" className="btn btn-primary w-full">
                            <Save size={18} style={{ marginRight: '8px' }} />
                            Registrar Movimiento
                        </button>
                    </div>
                </form>
            </div>

            <div className="card">
                <h3 className="mb-4">Historial Reciente</h3>
                {loading ? <p>Cargando...</p> : (
                    <div className="flex flex-col gap-3">
                        {transfers.length === 0 ? <p className="text-muted text-center py-4">No hay movimientos.</p> :
                            transfers.map(t => (
                                <div key={t.id} className="p-3 rounded border border-white/10 bg-black/20 flex justify-between items-center">
                                    <div>
                                        <div className="text-sm text-muted mb-1">{new Date(t.fecha).toLocaleDateString()}</div>
                                        <div className="flex items-center gap-2">
                                            <span className="text-danger font-medium">{getMethodName(t.origen_id)}</span>
                                            <ArrowRightLeft size={16} className="text-muted" />
                                            <span className="text-success font-medium">{getMethodName(t.destino_id)}</span>
                                        </div>
                                        <p className="text-sm text-gray-400 mt-1 italic">{t.descripcion}</p>
                                    </div>
                                    <div className="font-bold text-lg">
                                        {formatCurrency(t.valor)}
                                    </div>
                                </div>
                            ))}
                    </div>
                )}
            </div>
        </div>
    );
}

import { useState, useEffect } from 'react';
import { paymentMethodsService } from '../services/api';
import { Plus, Edit, Trash2, CreditCard, ToggleLeft, ToggleRight } from 'lucide-react';
import { toast } from 'sonner';
import { formatDate } from '../utils/formatters';

const fmtDate = (d) => d ? formatDate(d) : '—';

export default function PaymentMethods() {
    const [methods, setMethods] = useState([]);
    const [loading, setLoading] = useState(true);
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [editingMethod, setEditingMethod] = useState(null);
    const [formData, setFormData] = useState({ nombre: '', tipo: 'digital', activo: true });

    useEffect(() => { loadData(); }, []);

    const loadData = async () => {
        setLoading(true);
        try {
            const res = await paymentMethodsService.getAll();
            setMethods(res.data);
        } catch (error) {
            console.error("Error loading payment methods", error);
        } finally {
            setLoading(false);
        }
    };

    const handleEdit = (method) => {
        setEditingMethod(method);
        setFormData({
            nombre: method.nombre || '',
            tipo: method.tipo || 'digital',
            activo: method.activo ?? true,
        });
        setIsFormOpen(true);
    };

    const handleToggle = async (method) => {
        try {
            await paymentMethodsService.toggle(method.id);
            const nuevo = !(method.activo ?? true);
            toast.success(`${method.nombre} marcado como ${nuevo ? 'Activo' : 'Inactivo'}`);
            loadData();
        } catch (err) {
            toast.error("Error al cambiar estado");
        }
    };

    const handleDelete = async (id) => {
        if (!window.confirm('¿Eliminar este medio de pago?')) return;
        try {
            await paymentMethodsService.delete(id);
            loadData();
        } catch {
            toast.warning("No se puede eliminar, está asociado a registros");
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            if (editingMethod) {
                await paymentMethodsService.update(editingMethod.id, formData);
                toast.success("Medio de pago actualizado");
            } else {
                await paymentMethodsService.create(formData);
                toast.success("Medio de pago creado");
            }
            setIsFormOpen(false);
            setEditingMethod(null);
            setFormData({ nombre: '', tipo: 'digital', activo: true });
            loadData();
        } catch (err) {
            toast.error(err?.response?.data?.detail || "Error al guardar");
        }
    };

    return (
        <div>
            <div className="page-header flex justify-between items-center mb-4">
                <h1 className="m-0">Medios de Pago</h1>
                <button
                    className="btn btn-primary"
                    style={{ width: 'auto', padding: '0.6rem 1.2rem', display: 'flex', alignItems: 'center', gap: 8 }}
                    onClick={() => {
                        setEditingMethod(null);
                        setFormData({ nombre: '', tipo: 'digital', activo: true });
                        setIsFormOpen(true);
                    }}
                >
                    <Plus size={18} /> Nuevo
                </button>
            </div>

            {/* Formulario */}
            {isFormOpen && (
                <div className="card mb-4" style={{ border: '1px solid var(--primary)', maxWidth: 480 }}>
                    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
                        <h3 className="m-0">{editingMethod ? 'Editar Medio' : 'Nuevo Medio de Pago'}</h3>

                        <div className="form-group">
                            <label>Nombre</label>
                            <input type="text" className="form-control"
                                value={formData.nombre}
                                onChange={e => setFormData({ ...formData, nombre: e.target.value })}
                                placeholder="Ej: Nequi, Efectivo, Bancolombia"
                                required />
                        </div>

                        <div className="form-group">
                            <label>Tipo</label>
                            <select className="form-control"
                                value={formData.tipo}
                                onChange={e => setFormData({ ...formData, tipo: e.target.value })}>
                                <option value="efectivo">Efectivo</option>
                                <option value="digital">Digital (Nequi, Daviplata…)</option>
                                <option value="transferencia">Transferencia Bancaria</option>
                            </select>
                        </div>

                        <div style={{
                            background: 'rgba(6,182,212,0.06)', border: '1px solid rgba(6,182,212,0.25)',
                            borderRadius: 8, padding: '8px 12px', fontSize: 12, color: 'var(--text-secondary)',
                        }}>
                            💡 Para registrar un <strong>saldo de apertura</strong> (efectivo en caja,
                            dinero en banco, etc.) usa <strong>Flujo de Caja → Nuevo ingreso</strong>
                            con la categoría "Saldo inicial".
                        </div>

                        <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: '0.9rem' }}>
                            <input type="checkbox"
                                checked={formData.activo}
                                onChange={e => setFormData({ ...formData, activo: e.target.checked })}
                                style={{ width: '1.1rem', height: '1.1rem', accentColor: 'var(--brand)' }} />
                            Activo
                        </label>

                        <div className="flex gap-2 justify-end mt-1">
                            <button type="button" className="btn btn-secondary"
                                onClick={() => { setIsFormOpen(false); setEditingMethod(null); }}>
                                Cancelar
                            </button>
                            <button type="submit" className="btn btn-primary">Guardar</button>
                        </div>
                    </form>
                </div>
            )}

            {/* Tabla */}
            {loading ? <p>Cargando...</p> : (
                <div className="card overflow-x-auto">
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                            <tr style={{ borderBottom: '1px solid var(--border)', textAlign: 'left' }}>
                                <th className="p-3">Medio de Pago</th>
                                <th className="p-3">Tipo</th>
                                <th className="p-3">Estado</th>
                                <th className="p-3">Creado</th>
                                <th className="p-3 text-center">Acciones</th>
                            </tr>
                        </thead>
                        <tbody>
                            {methods.length === 0 ? (
                                <tr><td colSpan="5" className="p-4 text-center text-muted">No hay medios de pago.</td></tr>
                            ) : methods.map(method => {
                                const activo = method.activo ?? true;
                                return (
                                    <tr key={method.id}
                                        style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', opacity: activo ? 1 : 0.55 }}>
                                        <td className="p-3">
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                                <div style={{
                                                    width: 34, height: 34, borderRadius: '50%',
                                                    background: activo ? 'rgba(139,92,246,0.15)' : 'rgba(255,255,255,0.05)',
                                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                }}>
                                                    <CreditCard size={16} style={{ color: activo ? 'var(--brand)' : 'var(--text-muted)' }} />
                                                </div>
                                                <span className="font-bold">{method.nombre}</span>
                                            </div>
                                        </td>
                                        <td className="p-3 text-muted" style={{ fontSize: '0.85rem', textTransform: 'capitalize' }}>
                                            {method.tipo || '—'}
                                        </td>
                                        <td className="p-3">
                                            <span style={{
                                                fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase',
                                                padding: '0.2rem 0.6rem', borderRadius: 999,
                                                border: '1px solid currentColor',
                                                color: activo ? '#22c55e' : '#6b7280',
                                            }}>
                                                {activo ? 'Activo' : 'Inactivo'}
                                            </span>
                                        </td>
                                        <td className="p-3 text-muted" style={{ fontSize: '0.82rem' }}>
                                            {fmtDate(method.created_at)}
                                        </td>
                                        <td className="p-3">
                                            <div className="flex justify-center gap-2">
                                                {/* Toggle activo/inactivo */}
                                                <button
                                                    onClick={() => handleToggle(method)}
                                                    className="btn btn-secondary"
                                                    style={{ padding: '0.35rem' }}
                                                    title={activo ? 'Desactivar' : 'Activar'}>
                                                    {activo
                                                        ? <ToggleRight size={18} style={{ color: '#22c55e' }} />
                                                        : <ToggleLeft size={18} style={{ color: '#6b7280' }} />}
                                                </button>
                                                {/* Editar */}
                                                <button
                                                    onClick={() => handleEdit(method)}
                                                    className="btn btn-secondary"
                                                    style={{ padding: '0.35rem' }}
                                                    title="Editar">
                                                    <Edit size={16} />
                                                </button>
                                                {/* Eliminar */}
                                                <button
                                                    onClick={() => handleDelete(method.id)}
                                                    className="btn btn-secondary text-danger"
                                                    style={{ padding: '0.35rem' }}
                                                    title="Eliminar">
                                                    <Trash2 size={16} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}

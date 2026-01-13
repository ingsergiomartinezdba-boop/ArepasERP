import { useState, useEffect } from 'react';
import { paymentMethodsService } from '../services/api';
import { Plus, Edit, Trash2, CreditCard } from 'lucide-react';

export default function PaymentMethods() {
    const [methods, setMethods] = useState([]);
    const [loading, setLoading] = useState(true);
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [editingMethod, setEditingMethod] = useState(null);
    const [formData, setFormData] = useState({ nombre: '', tipo: 'digital', activo: true });

    useEffect(() => {
        loadData();
    }, []);

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
            nombre: method.nombre,
            tipo: method.tipo,
            activo: method.activo
        });
        setIsFormOpen(true);
    };

    const handleDelete = async (id) => {
        if (window.confirm('¿Eliminar este medio de pago?')) {
            try {
                await paymentMethodsService.delete(id);
                loadData();
            } catch (error) {
                console.error("Error deleting", error);
                alert("No se puede eliminar porque está asociado a registros.");
            }
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            if (editingMethod) {
                await paymentMethodsService.update(editingMethod.id, formData);
            } else {
                await paymentMethodsService.create(formData);
            }
            setIsFormOpen(false);
            setEditingMethod(null);
            setFormData({ nombre: '', tipo: 'digital', activo: true });
            loadData();
        } catch (error) {
            console.error("Error saving", error);
            alert("Error al guardar.");
        }
    };

    return (
        <div>
            <div className="page-header flex justify-between items-center mb-4">
                <h1>Medios de Pago</h1>
                <button
                    className="btn btn-primary"
                    style={{ width: 'auto', padding: '0.6rem' }}
                    onClick={() => {
                        setEditingMethod(null);
                        setFormData({ nombre: '', tipo: 'digital', activo: true });
                        setIsFormOpen(true);
                    }}
                >
                    <Plus size={24} />
                </button>
            </div>

            {isFormOpen && (
                <div className="card mb-4" style={{ border: '1px solid var(--primary)' }}>
                    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
                        <h3>{editingMethod ? 'Editar Medio' : 'Nuevo Medio'}</h3>

                        <div>
                            <label>Nombre</label>
                            <input
                                type="text"
                                className="form-control"
                                value={formData.nombre}
                                onChange={e => setFormData({ ...formData, nombre: e.target.value })}
                                required
                            />
                        </div>

                        <div>
                            <label>Tipo</label>
                            <select
                                className="form-control"
                                value={formData.tipo}
                                onChange={e => setFormData({ ...formData, tipo: e.target.value })}
                            >
                                <option value="digital">Digital (Nequi, Daviplata, etc)</option>
                                <option value="efectivo">Efectivo</option>
                                <option value="transferencia">Transferencia Bancaria</option>
                            </select>
                        </div>

                        <div className="flex items-center gap-2">
                            <input
                                type="checkbox"
                                checked={formData.activo}
                                onChange={e => setFormData({ ...formData, activo: e.target.checked })}
                                id="chkActive"
                            />
                            <label htmlFor="chkActive">Activo</label>
                        </div>

                        <div className="flex gap-2 justify-end mt-2">
                            <button
                                type="button"
                                className="btn btn-secondary"
                                onClick={() => setIsFormOpen(false)}
                            >
                                Cancelar
                            </button>
                            <button type="submit" className="btn btn-primary">
                                Guardar
                            </button>
                        </div>
                    </form>
                </div>
            )}

            {loading ? <p>Cargando...</p> : (
                <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))' }}>
                    {methods.map(method => (
                        <div key={method.id} className="card flex justify-between items-center">
                            <div className="flex items-center gap-3">
                                <div style={{
                                    width: '40px', height: '40px',
                                    borderRadius: '50%', background: 'rgba(255,255,255,0.1)',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center'
                                }}>
                                    <CreditCard size={20} />
                                </div>
                                <div>
                                    <h3 style={{ margin: 0, fontSize: '1rem' }}>{method.nombre}</h3>
                                    <small className="text-muted">{method.tipo} • {method.activo ? 'Activo' : 'Inactivo'}</small>
                                </div>
                            </div>
                            <div className="flex gap-2">
                                <button className="btn btn-secondary" style={{ padding: '0.4rem' }} onClick={() => handleEdit(method)}>
                                    <Edit size={16} />
                                </button>
                                <button className="btn btn-secondary" style={{ padding: '0.4rem', color: 'var(--danger)', borderColor: 'var(--danger)' }} onClick={() => handleDelete(method.id)}>
                                    <Trash2 size={16} />
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

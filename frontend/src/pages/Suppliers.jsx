import { useState, useEffect } from 'react';
import { suppliersService } from '../services/api';
import { Plus, Edit, Trash2, Phone, Mail, MapPin, Save, X } from 'lucide-react';

export default function Suppliers() {
    const [suppliers, setSuppliers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [editingId, setEditingId] = useState(null); // null = list, 'new' or ID = edit mode
    const [form, setForm] = useState({
        nombre: '',
        contacto: '',
        telefono: '',
        email: '',
        direccion: ''
    });

    useEffect(() => {
        loadSuppliers();
    }, []);

    const loadSuppliers = async () => {
        setLoading(true);
        try {
            const res = await suppliersService.getAll();
            setSuppliers(res.data);
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            if (editingId && editingId !== 'new') {
                await suppliersService.update(editingId, form);
            } else {
                await suppliersService.create(form);
            }
            setForm({ nombre: '', contacto: '', telefono: '', email: '', direccion: '' });
            setEditingId(null);
            loadSuppliers();
        } catch (error) {
            alert("Error al guardar proveedor");
            console.error(error);
        }
    };

    const handleEdit = (supplier) => {
        setForm({
            nombre: supplier.nombre,
            contacto: supplier.contacto || '',
            telefono: supplier.telefono || '',
            email: supplier.email || '',
            direccion: supplier.direccion || ''
        });
        setEditingId(supplier.id);
    };

    const handleNew = () => {
        setForm({ nombre: '', contacto: '', telefono: '', email: '', direccion: '' });
        setEditingId('new');
    };

    const handleDelete = async (id) => {
        if (!confirm('¿Seguro que desea eliminar este proveedor? Si tiene gastos asociados no se podrá eliminar.')) return;
        try {
            await suppliersService.delete(id);
            loadSuppliers();
        } catch (error) {
            const msg = error.response?.data?.detail || "No se puede eliminar: Probablemente tenga gastos asociados.";
            alert(msg);
        }
    };

    if (editingId) {
        return (
            <div style={{ position: 'relative' }}>
                <button
                    onClick={() => setEditingId(null)}
                    className="btn-close-modal"
                    style={{ top: '0', right: '0' }}
                >
                    <X size={18} />
                </button>

                <div className="mb-6">
                    <h1 className="m-0">{editingId !== 'new' ? 'Editar Proveedor' : 'Nuevo Proveedor'}</h1>
                </div>

                <div className="card">
                    <form onSubmit={handleSubmit}>
                        <div className="form-group">
                            <label>Nombre Empresa *</label>
                            <input
                                className="form-control"
                                value={form.nombre}
                                onChange={e => setForm({ ...form, nombre: e.target.value })}
                                required
                                placeholder="Ej: Distribuidora de Harinas S.A.S."
                            />
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="form-group">
                                <label>Persona de Contacto</label>
                                <input
                                    className="form-control"
                                    value={form.contacto}
                                    onChange={e => setForm({ ...form, contacto: e.target.value })}
                                    placeholder="Ej: Carlos Gómez"
                                />
                            </div>

                            <div className="form-group">
                                <label>Teléfono</label>
                                <div className="relative">
                                    <input
                                        type="tel"
                                        className="form-control"
                                        value={form.telefono}
                                        onChange={e => setForm({ ...form, telefono: e.target.value })}
                                        placeholder="Ej: 3001234567"
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="form-group">
                                <label>Email</label>
                                <input
                                    type="email"
                                    className="form-control"
                                    value={form.email}
                                    onChange={e => setForm({ ...form, email: e.target.value })}
                                    placeholder="contacto@empresa.com"
                                />
                            </div>

                            <div className="form-group">
                                <label>Dirección</label>
                                <input
                                    className="form-control"
                                    value={form.direccion}
                                    onChange={e => setForm({ ...form, direccion: e.target.value })}
                                    placeholder="Ej: Calle 10 #20-30"
                                />
                            </div>
                        </div>

                        <div className="mt-8">
                            <button type="submit" className="btn btn-primary font-bold" style={{ width: 'auto', padding: '0.8rem 2rem' }}>
                                <Save size={20} style={{ marginRight: '8px' }} />
                                {editingId !== 'new' ? 'Guardar Cambios' : 'Crear Proveedor'}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        );
    }

    return (
        <div>
            <div className="page-header flex justify-between items-center mb-6">
                <h1 className="m-0">Proveedores</h1>
                <button
                    onClick={handleNew}
                    className="btn btn-primary"
                    style={{ width: 'auto', padding: '0.6rem 1.2rem', display: 'flex', alignItems: 'center', gap: '8px' }}
                >
                    <Plus size={20} /> Nuevo Proveedor
                </button>
            </div>

            <div className="card overflow-x-auto">
                <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '900px' }}>
                    <thead>
                        <tr style={{ borderBottom: '1px solid var(--border)', textAlign: 'left' }}>
                            <th className="p-3">ID</th>
                            <th className="p-3">Empresa</th>
                            <th className="p-3">Contacto</th>
                            <th className="p-3">Detalles</th>
                            <th className="p-3 text-center">Acciones</th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            <tr><td colSpan="5" className="p-4 text-center">Cargando...</td></tr>
                        ) : suppliers.length === 0 ? (
                            <tr><td colSpan="5" className="p-4 text-center text-muted">No hay proveedores registrados.</td></tr>
                        ) : (
                            suppliers.map(supplier => (
                                <tr key={supplier.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                                    <td className="p-3 text-muted">#{supplier.id}</td>
                                    <td className="p-3">
                                        <div className="font-bold">{supplier.nombre}</div>
                                        {supplier.direccion && (
                                            <div className="text-xs text-muted flex items-center gap-1 mt-1">
                                                <MapPin size={10} /> {supplier.direccion}
                                            </div>
                                        )}
                                    </td>
                                    <td className="p-3">
                                        {supplier.contacto && <div className="text-sm font-semibold">{supplier.contacto}</div>}
                                        {supplier.telefono && (
                                            <div className="text-xs text-muted flex items-center gap-1">
                                                <Phone size={10} /> {supplier.telefono}
                                            </div>
                                        )}
                                    </td>
                                    <td className="p-3">
                                        {supplier.email ? (
                                            <div className="flex items-center gap-1 text-sm text-primary">
                                                <Mail size={12} /> {supplier.email}
                                            </div>
                                        ) : <span className="text-muted text-xs">-</span>}
                                    </td>
                                    <td className="p-3 text-center">
                                        <div className="flex justify-center gap-2">
                                            <button
                                                onClick={() => handleEdit(supplier)}
                                                className="btn btn-secondary"
                                                style={{ padding: '0.4rem' }}
                                                title="Editar"
                                            >
                                                <Edit size={16} />
                                            </button>
                                            <button
                                                onClick={() => handleDelete(supplier.id)}
                                                className="btn btn-secondary text-danger"
                                                style={{ padding: '0.4rem' }}
                                                title="Eliminar"
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
        </div>
    );
}

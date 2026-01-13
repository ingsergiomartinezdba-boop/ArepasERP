import { useState, useEffect } from 'react';
import { suppliersService } from '../services/api';
import { Plus, Edit, Trash2, Phone, Mail, MapPin } from 'lucide-react';

export default function Suppliers() {
    const [suppliers, setSuppliers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [editingId, setEditingId] = useState(null);
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
            if (editingId) {
                await suppliersService.update(editingId, form);
            } else {
                await suppliersService.create(form);
            }
            setShowModal(false);
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
        setShowModal(true);
    };

    const handleDelete = async (id) => {
        if (confirm('¿Eliminar proveedor? Si tiene gastos asociados no se podrá eliminar.')) {
            try {
                await suppliersService.delete(id);
                loadSuppliers();
            } catch (error) {
                alert("No se puede eliminar: Probablemente tenga gastos asociados.");
            }
        }
    };

    return (
        <div>
            <div className="flex justify-between items-center mb-4">
                <h1 style={{ marginBottom: 0 }}>Proveedores</h1>
                <button
                    onClick={() => { setShowModal(true); setEditingId(null); setForm({ nombre: '', contacto: '', telefono: '', email: '', direccion: '' }); }}
                    className="btn btn-primary"
                    style={{ width: 'auto', padding: '0.5rem 1rem' }}
                >
                    <Plus size={18} />
                </button>
            </div>

            {loading ? <p>Cargando...</p> : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {suppliers.map(supplier => (
                        <div key={supplier.id} className="card">
                            <div className="flex justify-between items-start mb-2">
                                <h3 className="font-bold text-lg">{supplier.nombre}</h3>
                                <div className="flex gap-2">
                                    <button onClick={() => handleEdit(supplier)} className="text-secondary hover:text-white">
                                        <Edit size={16} />
                                    </button>
                                    <button onClick={() => handleDelete(supplier.id)} className="text-danger hover:text-white">
                                        <Trash2 size={16} />
                                    </button>
                                </div>
                            </div>

                            <div className="text-sm text-muted space-y-1">
                                {supplier.contacto && <p><strong>Contacto:</strong> {supplier.contacto}</p>}
                                {supplier.telefono && (
                                    <p className="flex items-center gap-2">
                                        <Phone size={14} /> {supplier.telefono}
                                    </p>
                                )}
                                {supplier.email && (
                                    <p className="flex items-center gap-2">
                                        <Mail size={14} /> {supplier.email}
                                    </p>
                                )}
                                {supplier.direccion && (
                                    <p className="flex items-center gap-2">
                                        <MapPin size={14} /> {supplier.direccion}
                                    </p>
                                )}
                            </div>
                        </div>
                    ))}
                    {suppliers.length === 0 && <p className="col-span-3 text-center text-muted">No hay proveedores registrados.</p>}
                </div>
            )}

            {showModal && (
                <div style={{
                    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                    backgroundColor: 'rgba(0,0,0,0.8)', zIndex: 100,
                    display: 'flex', alignItems: 'center', justifyContent: 'center'
                }}>
                    <div className="card" style={{ width: '90%', maxWidth: '500px' }}>
                        <h2>{editingId ? 'Editar Proveedor' : 'Nuevo Proveedor'}</h2>
                        <form onSubmit={handleSubmit} className="mt-4 flex flex-col gap-3">
                            <div>
                                <label>Nombre Empresa *</label>
                                <input
                                    className="form-control"
                                    value={form.nombre}
                                    onChange={e => setForm({ ...form, nombre: e.target.value })}
                                    required
                                />
                            </div>
                            <div>
                                <label>Contacto</label>
                                <input
                                    className="form-control"
                                    value={form.contacto}
                                    onChange={e => setForm({ ...form, contacto: e.target.value })}
                                    placeholder="Nombre de persona de contacto"
                                />
                            </div>
                            <div>
                                <label>Teléfono</label>
                                <input
                                    className="form-control"
                                    value={form.telefono}
                                    onChange={e => setForm({ ...form, telefono: e.target.value })}
                                />
                            </div>
                            <div>
                                <label>Email</label>
                                <input
                                    type="email"
                                    className="form-control"
                                    value={form.email}
                                    onChange={e => setForm({ ...form, email: e.target.value })}
                                />
                            </div>
                            <div>
                                <label>Dirección</label>
                                <input
                                    className="form-control"
                                    value={form.direccion}
                                    onChange={e => setForm({ ...form, direccion: e.target.value })}
                                />
                            </div>

                            <div className="flex gap-2 justify-end mt-4">
                                <button type="button" onClick={() => setShowModal(false)} className="btn btn-secondary">Cancelar</button>
                                <button type="submit" className="btn btn-primary">Guardar</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}

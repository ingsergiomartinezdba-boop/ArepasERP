import { useState, useEffect } from 'react';
import { clientsService } from '../services/api';
import { Plus, Edit, Phone, MapPin, Save, X } from 'lucide-react';

export default function Clients() {
    const [clients, setClients] = useState([]);
    const [loading, setLoading] = useState(true);
    const [editingClient, setEditingClient] = useState(null); // null = list, {} = new mode, object = edit mode

    useEffect(() => {
        loadClients();
    }, []);

    const loadClients = async () => {
        try {
            const response = await clientsService.getAll();
            setClients(response.data);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async (e) => {
        e.preventDefault();
        try {
            if (editingClient.id) {
                await clientsService.update(editingClient.id, editingClient);
            } else {
                await clientsService.create(editingClient);
            }
            setEditingClient(null);
            loadClients();
        } catch (err) {
            alert("Error al guardar cliente");
        }
    };

    const startEdit = (client) => {
        setEditingClient({ ...client });
    };

    const startNew = () => {
        setEditingClient({
            nombre: '',
            tipo_cliente: 'local',
            telefono: '',
            direccion: '',
            ciudad: 'Bogotá',
            canal_venta: 'local',
            condicion_pago: 'contado'
        });
    };

    if (editingClient) {
        return (
            <div>
                <div className="flex justify-between items-center mb-4">
                    <h1>{editingClient.id ? 'Editar Cliente' : 'Nuevo Cliente'}</h1>
                    <button onClick={() => setEditingClient(null)} className="btn btn-secondary" style={{ width: 'auto' }}>
                        <X size={20} />
                    </button>
                </div>

                <form onSubmit={handleSave}>
                    <div className="form-group">
                        <label>Nombre</label>
                        <input
                            value={editingClient.nombre}
                            onChange={e => setEditingClient({ ...editingClient, nombre: e.target.value })}
                            required
                        />
                    </div>

                    <div className="stats-grid">
                        <div className="form-group">
                            <label>Tipo</label>
                            <select
                                value={editingClient.tipo_cliente}
                                onChange={e => setEditingClient({ ...editingClient, tipo_cliente: e.target.value })}
                            >
                                <option value="mayorista">Mayorista</option>
                                <option value="minorista">Minorista</option>
                                <option value="local">Local</option>
                                <option value="distribuidor">Distribuidor</option>
                            </select>
                        </div>

                        <div className="form-group">
                            <label>Pago</label>
                            <select
                                value={editingClient.condicion_pago}
                                onChange={e => setEditingClient({ ...editingClient, condicion_pago: e.target.value })}
                            >
                                <option value="contado">Contado</option>
                                <option value="credito">Crédito</option>
                            </select>
                        </div>
                    </div>

                    <div className="form-group">
                        <label>Teléfono</label>
                        <input
                            type="tel"
                            value={editingClient.telefono || ''}
                            onChange={e => setEditingClient({ ...editingClient, telefono: e.target.value })}
                        />
                    </div>

                    <div className="form-group">
                        <label>Dirección</label>
                        <input
                            value={editingClient.direccion || ''}
                            onChange={e => setEditingClient({ ...editingClient, direccion: e.target.value })}
                        />
                    </div>

                    <div className="form-group">
                        <label>Canal</label>
                        <select
                            value={editingClient.canal_venta}
                            onChange={e => setEditingClient({ ...editingClient, canal_venta: e.target.value })}
                        >
                            <option value="local">Local</option>
                            <option value="whatsapp">WhatsApp</option>
                            <option value="domicilio">Domicilio</option>
                        </select>
                    </div>

                    <button type="submit" className="btn btn-primary mt-4">
                        <Save size={20} style={{ marginRight: '8px' }} />
                        Guardar
                    </button>
                </form>
            </div>
        );
    }

    return (
        <div>
            <div className="flex justify-between items-center mb-4">
                <h1>Clientes</h1>
                <button onClick={startNew} className="btn btn-primary" style={{ width: 'auto', padding: '0.5rem 1rem' }}>
                    <Plus size={20} />
                </button>
            </div>

            {loading ? <p>Cargando...</p> : (
                <div className="flex" style={{ flexDirection: 'column', gap: '1rem' }}>
                    {clients.map(client => (
                        <div key={client.id} className="card" style={{ marginBottom: 0, padding: '1rem' }}>
                            <div className="flex justify-between items-start">
                                <div>
                                    <h3>{client.nombre}</h3>
                                    <p className="text-muted" style={{ fontSize: '0.9rem' }}>{client.tipo_cliente} • {client.condicion_pago}</p>

                                    {(client.telefono || client.direccion) && (
                                        <div className="mt-4" style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '0.85rem' }}>
                                            {client.telefono && (
                                                <div className="flex items-center gap-2">
                                                    <Phone size={14} className="text-muted" />
                                                    <span>{client.telefono}</span>
                                                </div>
                                            )}
                                            {client.direccion && (
                                                <div className="flex items-center gap-2">
                                                    <MapPin size={14} className="text-muted" />
                                                    <span>{client.direccion}</span>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                                <button
                                    onClick={() => startEdit(client)}
                                    className="btn btn-secondary"
                                    style={{ width: 'auto', padding: '0.5rem' }}
                                >
                                    <Edit size={18} />
                                </button>
                            </div>
                        </div>
                    ))}
                    {clients.length === 0 && <p className="text-center text-muted">No hay clientes registrados.</p>}
                </div>
            )}
        </div>
    );
}

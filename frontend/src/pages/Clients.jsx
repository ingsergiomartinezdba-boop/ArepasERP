import { useState, useEffect } from 'react';
import { clientsService } from '../services/api';
import { Plus, Edit, Phone, MapPin, Save, X, Trash2, Users } from 'lucide-react';

export default function Clients() {
    const [clients, setClients] = useState([]);
    const [loading, setLoading] = useState(true);
    const [editingClient, setEditingClient] = useState(null); // null = list, {} = new mode, object = edit mode

    useEffect(() => {
        loadClients();
    }, []);

    const loadClients = async () => {
        setLoading(true);
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

    const handleDelete = async (id) => {
        if (!confirm('¿Seguro que desea eliminar este cliente? Solo podrá hacerlo si no tiene pedidos registrados.')) return;
        try {
            await clientsService.delete(id);
            loadClients();
        } catch (error) {
            console.error(error);
            const msg = error.response?.data?.detail || "Error al eliminar cliente";
            alert(msg);
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
            condicion_pago: 'contado',
            mostrar_saldo_whatsapp: true
        });
    };

    if (editingClient) {
        return (
            <div style={{ position: 'relative' }}>
                <button
                    onClick={() => setEditingClient(null)}
                    className="btn-close-modal"
                    style={{ top: '0', right: '0' }}
                >
                    <X size={18} />
                </button>

                <div className="mb-6">
                    <h1 className="m-0">{editingClient.id ? 'Editar Cliente' : 'Nuevo Cliente'}</h1>
                </div>

                <div className="card">
                    <form onSubmit={handleSave}>
                        <div className="form-group">
                            <label>Nombre Completo</label>
                            <input
                                value={editingClient.nombre}
                                onChange={e => setEditingClient({ ...editingClient, nombre: e.target.value })}
                                required
                                placeholder="Ej: Juan Pérez"
                            />
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="form-group">
                                <label>Tipo de Cliente</label>
                                <select
                                    className="form-control"
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
                                <label>Condición de Pago</label>
                                <select
                                    className="form-control"
                                    value={editingClient.condicion_pago}
                                    onChange={e => setEditingClient({ ...editingClient, condicion_pago: e.target.value })}
                                >
                                    <option value="contado">Contado</option>
                                    <option value="credito">Crédito</option>
                                </select>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="form-group">
                                <label>Teléfono / WhatsApp</label>
                                <div className="relative">
                                    <input
                                        type="tel"
                                        className="form-control"
                                        value={editingClient.telefono || ''}
                                        onChange={e => setEditingClient({ ...editingClient, telefono: e.target.value })}
                                        placeholder="Ej: 3001234567"
                                    />
                                </div>
                            </div>

                            <div className="form-group">
                                <label>Dirección de Entrega</label>
                                <input
                                    className="form-control"
                                    value={editingClient.direccion || ''}
                                    onChange={e => setEditingClient({ ...editingClient, direccion: e.target.value })}
                                    placeholder="Ej: Calle 123 #45-67"
                                />
                            </div>
                        </div>

                        <div className="form-group">
                            <label>Canal Principal de Venta</label>
                            <select
                                className="form-control"
                                value={editingClient.canal_venta}
                                onChange={e => setEditingClient({ ...editingClient, canal_venta: e.target.value })}
                            >
                                <option value="local">Punto Físico (Local)</option>
                                <option value="whatsapp">WhatsApp</option>
                                <option value="domicilio">Domicilio / Pedido Externo</option>
                            </select>
                        </div>

                        <div className="form-group flex items-center gap-2 mt-4" style={{ flexDirection: 'row', alignItems: 'center' }}>
                            <input
                                type="checkbox"
                                checked={editingClient.mostrar_saldo_whatsapp !== false}
                                onChange={e => setEditingClient({ ...editingClient, mostrar_saldo_whatsapp: e.target.checked })}
                                id="chkWhatsappBalance"
                                style={{ width: '1.2rem', height: '1.2rem' }}
                            />
                            <label htmlFor="chkWhatsappBalance" className="mb-0" style={{ fontWeight: 'normal' }}>
                                Mostrar Saldo Total en Reporte WhatsApp
                            </label>
                        </div>

                        <div className="mt-8">
                            <button type="submit" className="btn btn-primary font-bold" style={{ width: 'auto', padding: '0.8rem 2rem' }}>
                                <Save size={20} style={{ marginRight: '8px' }} />
                                {editingClient.id ? 'Guardar Cambios' : 'Crear Cliente'}
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
                <h1 className="m-0">Clientes</h1>
                <button onClick={startNew} className="btn btn-primary" style={{ width: 'auto', padding: '0.6rem 1.2rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Plus size={20} /> Nuevo Cliente
                </button>
            </div>

            <div className="card overflow-x-auto">
                <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '900px' }}>
                    <thead>
                        <tr style={{ borderBottom: '1px solid var(--border)', textAlign: 'left' }}>
                            <th className="p-3">ID</th>
                            <th className="p-3">Nombre</th>
                            <th className="p-3">Contacto</th>
                            <th className="p-3">Tipo</th>
                            <th className="p-3">Pago</th>
                            <th className="p-3 text-center">Acciones</th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            <tr><td colSpan="6" className="p-4 text-center">Cargando...</td></tr>
                        ) : clients.length === 0 ? (
                            <tr><td colSpan="6" className="p-4 text-center text-muted">No hay clientes registrados.</td></tr>
                        ) : (
                            clients.map(client => (
                                <tr key={client.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                                    <td className="p-3 text-muted">#{client.id}</td>
                                    <td className="p-3">
                                        <div className="font-bold">{client.nombre}</div>
                                        <div className="text-xs text-muted flex items-center gap-1">
                                            <MapPin size={10} /> {client.direccion || 'Sin dirección'}
                                        </div>
                                    </td>
                                    <td className="p-3">
                                        <div className="flex items-center gap-1 text-sm font-bold text-primary">
                                            <Phone size={14} /> {client.telefono || '-'}
                                        </div>
                                        <div className="text-[0.65rem] text-muted uppercase tracking-tighter">
                                            Canal: {client.canal_venta}
                                        </div>
                                    </td>
                                    <td className="p-3">
                                        <span
                                            className="badge"
                                            style={{
                                                fontSize: '0.65rem',
                                                textTransform: 'uppercase',
                                                background: 'transparent',
                                                border: '1px solid rgba(255,255,255,0.1)',
                                                color: 'var(--text-muted)',
                                                padding: '0.1rem 0.5rem',
                                                borderRadius: '999px',
                                                fontWeight: 'bold'
                                            }}
                                        >
                                            {client.tipo_cliente}
                                        </span>
                                    </td>
                                    <td className="p-3">
                                        <span
                                            className={`badge ${client.condicion_pago === 'contado' ? 'text-success' : 'text-danger'}`}
                                            style={{
                                                fontSize: '0.7rem',
                                                textTransform: 'uppercase',
                                                background: 'transparent',
                                                border: '1px solid currentColor',
                                                padding: '0.2rem 0.6rem',
                                                borderRadius: '999px',
                                                fontWeight: 'bold',
                                                letterSpacing: '0.5px'
                                            }}
                                        >
                                            {client.condicion_pago}
                                        </span>
                                    </td>
                                    <td className="p-3 text-center">
                                        <div className="flex justify-center gap-2">
                                            <button
                                                onClick={() => startEdit(client)}
                                                className="btn btn-secondary"
                                                style={{ padding: '0.4rem' }}
                                                title="Editar"
                                            >
                                                <Edit size={16} />
                                            </button>
                                            <button
                                                onClick={() => handleDelete(client.id)}
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

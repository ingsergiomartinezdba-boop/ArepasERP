import { useState, useEffect } from 'react';
import { clientsService, productsService, ordersService } from '../services/api';
import { useNavigate } from 'react-router-dom';
import { Save, Plus, Trash2 } from 'lucide-react';

export default function OrderForm() {
    const navigate = useNavigate();
    const [clients, setClients] = useState([]);
    const [products, setProducts] = useState([]);

    const [selectedClient, setSelectedClient] = useState('');
    const [orderItems, setOrderItems] = useState([]); // { tempId, producto_id, cantidad }
    const [submitting, setSubmitting] = useState(false);

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        try {
            const [cRes, pRes] = await Promise.all([
                clientsService.getAll(),
                productsService.getAll(true)
            ]);
            setClients(cRes.data);
            setProducts(pRes.data);
        } catch (err) {
            console.error("Error loading form data", err);
        }
    };

    const addItem = () => {
        setOrderItems([...orderItems, { tempId: Date.now(), producto_id: '', cantidad: 1 }]);
    };

    const removeItem = (id) => {
        setOrderItems(orderItems.filter(i => i.tempId !== id));
    };

    const updateItem = (id, field, value) => {
        setOrderItems(orderItems.map(i => i.tempId === id ? { ...i, [field]: value } : i));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!selectedClient || orderItems.length === 0) return;

        // Filter out invalid items
        const validItems = orderItems.filter(i => i.producto_id && i.cantidad > 0);
        if (validItems.length === 0) return;

        setSubmitting(true);
        try {
            const payload = {
                cliente_id: parseInt(selectedClient),
                items: validItems.map(i => ({ producto_id: parseInt(i.producto_id), cantidad: parseInt(i.cantidad) })),
                // Default values for now
                estado: 'pendiente'
            };

            await ordersService.create(payload);
            navigate('/');
        } catch (err) {
            alert("Error al crear pedido");
            console.error(err);
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div>
            <h1>Nuevo Pedido</h1>

            <form onSubmit={handleSubmit}>
                <div className="form-group">
                    <label>Cliente</label>
                    <select
                        value={selectedClient}
                        onChange={e => setSelectedClient(e.target.value)}
                        required
                        autoFocus
                    >
                        <option value="">Seleccionar Cliente...</option>
                        {clients.map(c => (
                            <option key={c.id} value={c.id}>{c.nombre}</option>
                        ))}
                    </select>
                </div>

                <div className="card">
                    <div className="flex justify-between items-center mb-2">
                        <h3>Productos</h3>
                        <button type="button" onClick={addItem} className="btn btn-secondary" style={{ padding: '0.5rem' }}>
                            <Plus size={20} />
                        </button>
                    </div>

                    {orderItems.map((item, index) => (
                        <div key={item.tempId} className="flex gap-2 mb-2 items-end">
                            <div style={{ flex: 2 }}>
                                <select
                                    value={item.producto_id}
                                    onChange={e => updateItem(item.tempId, 'producto_id', e.target.value)}
                                    required
                                >
                                    <option value="">Producto...</option>
                                    {products.map(p => (
                                        <option key={p.id} value={p.id}>{p.nombre} ({p.codigo_corto})</option>
                                    ))}
                                </select>
                            </div>
                            <div style={{ flex: 1 }}>
                                <input
                                    type="number"
                                    value={item.cantidad}
                                    onChange={e => updateItem(item.tempId, 'cantidad', e.target.value)}
                                    min="1"
                                    required
                                />
                            </div>
                            <button
                                type="button"
                                onClick={() => removeItem(item.tempId)}
                                className="btn btn-secondary text-danger"
                                style={{ padding: '0.75rem' }}
                            >
                                <Trash2 size={18} />
                            </button>
                        </div>
                    ))}

                    {orderItems.length === 0 && <p className="text-muted text-center py-4">Agrega productos</p>}
                </div>

                <button type="submit" className="btn btn-primary" disabled={submitting}>
                    <Save size={20} style={{ marginRight: '8px' }} />
                    Guardar Pedido
                </button>
            </form>
        </div>
    );
}

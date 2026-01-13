import { useState, useEffect } from 'react';
import { clientsService, productsService, ordersService } from '../services/api';
import { useNavigate, useParams } from 'react-router-dom';
import { Save, Search } from 'lucide-react';

export default function OrderForm() {
    const navigate = useNavigate();
    const { id } = useParams();
    const isEditing = Boolean(id);

    const [clients, setClients] = useState([]);
    const [products, setProducts] = useState([]);
    const [loading, setLoading] = useState(true);

    const [selectedClient, setSelectedClient] = useState('');
    // Map of productId -> quantity
    const [quantities, setQuantities] = useState({});
    const [deliveryFee, setDeliveryFee] = useState(0);
    const [searchTerm, setSearchTerm] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [status, setStatus] = useState('pendiente'); // For editing
    const [date, setDate] = useState(new Date().toISOString().split('T')[0]);

    useEffect(() => {
        loadData();
    }, [id]);

    const loadData = async () => {
        setLoading(true);
        try {
            const [cRes, pRes] = await Promise.all([
                clientsService.getAll(),
                productsService.getAll(true)
            ]);
            setClients(cRes.data);
            setProducts(pRes.data);

            if (isEditing) {
                const orderRes = await ordersService.getById(id);
                const order = orderRes.data;
                setSelectedClient(order.cliente_id);
                setDeliveryFee(order.valor_domicilio || 0);
                setStatus(order.estado);
                if (order.fecha) setDate(order.fecha.split('T')[0]);

                const qtyMap = {};
                order.items.forEach(item => {
                    qtyMap[item.producto_id] = item.cantidad;
                });
                setQuantities(qtyMap);
            }
        } catch (err) {
            console.error("Error loading form data", err);
            if (isEditing) alert("Error cargando pedido");
        } finally {
            setLoading(false);
        }
    };

    const handleQuantityChange = (productId, val) => {
        const qty = parseInt(val) || 0;
        setQuantities(prev => ({
            ...prev,
            [productId]: qty
        }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!selectedClient) {
            alert("Por favor seleccione un cliente");
            return;
        }

        const items = Object.entries(quantities)
            .filter(([_, qty]) => qty > 0)
            .map(([pid, qty]) => ({
                producto_id: parseInt(pid),
                cantidad: qty
            }));

        if (items.length === 0) {
            alert("Seleccione al menos un producto");
            return;
        }

        setSubmitting(true);
        try {
            const payload = {
                cliente_id: parseInt(selectedClient),
                items: items,
                valor_domicilio: parseFloat(deliveryFee) || 0,
                estado: status,
                fecha: date // Add date to payload
            };

            if (isEditing) {
                await ordersService.update(id, payload);
            } else {
                await ordersService.create(payload);
            }
            navigate('/orders'); // Redirect to orders list instead of root
        } catch (err) {
            alert("Error al guardar pedido");
            console.error(err);
        } finally {
            setSubmitting(false);
        }
    };

    const formatCurrency = (val) => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(val);

    const filteredProducts = products.filter(p =>
        p.nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.codigo_corto.toLowerCase().includes(searchTerm.toLowerCase())
    );

    // Calculate total on the fly
    const totalProductos = products.reduce((acc, p) => {
        const qty = quantities[p.id] || 0;
        return acc + (qty * p.precio_estandar);
    }, 0);

    const totalEstimado = totalProductos + (parseFloat(deliveryFee) || 0);

    if (loading) return <div className="text-center mt-4">Cargando...</div>;

    return (
        <div className="pb-20"> {/* Padding bottom for fixed footer */}
            <h1 className="mb-4">{isEditing ? 'Editar Pedido' : 'Nuevo Pedido'}</h1>

            <form onSubmit={handleSubmit}>
                <div className="card mb-4 sticky-top-mobile" style={{ zIndex: 10, borderBottom: '2px solid var(--primary)' }}>
                    <div className="flex gap-4 mb-2">
                        <div className="form-group mb-0" style={{ flex: 1 }}>
                            <label className="text-muted text-sm">Cliente</label>
                            <select
                                value={selectedClient}
                                onChange={e => setSelectedClient(e.target.value)}
                                required
                                className="form-control-lg"
                                style={{ fontWeight: 'bold' }}
                            >
                                <option value="">Seleccionar Cliente...</option>
                                {clients.map(c => (
                                    <option key={c.id} value={c.id}>{c.nombre}</option>
                                ))}
                            </select>
                        </div>

                        <div className="form-group mb-0">
                            <label className="text-muted text-sm">Fecha Pedido</label>
                            <div className="flex bg-card rounded border border-input" style={{ padding: '0.3rem' }}>
                                {/* Day */}
                                <select
                                    className="bg-transparent outline-none text-center"
                                    style={{ fontWeight: 'bold' }}
                                    value={date.split('-')[2]}
                                    onChange={e => {
                                        const [y, m, d] = date.split('-');
                                        setDate(`${y}-${m}-${e.target.value}`);
                                    }}
                                >
                                    {Array.from({ length: 31 }, (_, i) => i + 1).map(d => {
                                        const val = d.toString().padStart(2, '0');
                                        return <option key={d} value={val}>{val}</option>
                                    })}
                                </select>
                                <span className="text-muted mx-1">/</span>
                                {/* Month */}
                                <select
                                    className="bg-transparent outline-none"
                                    style={{ fontWeight: 'bold' }}
                                    value={date.split('-')[1]}
                                    onChange={e => {
                                        const [y, m, d] = date.split('-');
                                        setDate(`${y}-${e.target.value}-${d}`);
                                    }}
                                >
                                    <option value="01">Ene</option>
                                    <option value="02">Feb</option>
                                    <option value="03">Mar</option>
                                    <option value="04">Abr</option>
                                    <option value="05">May</option>
                                    <option value="06">Jun</option>
                                    <option value="07">Jul</option>
                                    <option value="08">Ago</option>
                                    <option value="09">Sep</option>
                                    <option value="10">Oct</option>
                                    <option value="11">Nov</option>
                                    <option value="12">Dic</option>
                                </select>
                                <span className="text-muted mx-1">/</span>
                                {/* Year */}
                                <select
                                    className="bg-transparent outline-none"
                                    style={{ fontWeight: 'bold' }}
                                    value={date.split('-')[0]}
                                    onChange={e => {
                                        const [y, m, d] = date.split('-');
                                        setDate(`${e.target.value}-${m}-${d}`);
                                    }}
                                >
                                    {[2024, 2025, 2026, 2027, 2028].map(y => (
                                        <option key={y} value={y}>{y}</option>
                                    ))}
                                </select>
                            </div>
                        </div>
                    </div>

                    {isEditing && (
                        <div className="form-group mb-0 mt-2">
                            <label className="text-muted text-sm">Estado</label>
                            <select
                                value={status}
                                onChange={e => setStatus(e.target.value)}
                                className="form-control"
                                style={{ fontWeight: 'bold' }}
                            >
                                <option value="pendiente">Pendiente</option>
                                <option value="pagado">Pagado</option>
                                <option value="parcial">Parcial</option>
                                <option value="cancelado">Cancelado</option>
                            </select>
                        </div>
                    )}
                </div>

                <div className="mb-3 relative">
                    <Search className="absolute left-3 top-3 text-muted" size={20} />
                    <input
                        type="text"
                        placeholder="Buscar producto..."
                        className="pl-10"
                        style={{ paddingLeft: '2.5rem' }}
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                    />
                </div>

                <div className="product-grid">
                    {filteredProducts.map(p => {
                        const qty = quantities[p.id] || '';
                        return (
                            <div key={p.id} className={`card product-card ${qty > 0 ? 'active-product' : ''}`}
                                style={{
                                    display: 'flex',
                                    flexDirection: 'column',
                                    justifyContent: 'space-between',
                                    border: qty > 0 ? '2px solid var(--primary)' : '1px solid var(--border)',
                                    transition: 'all 0.2s'
                                }}>
                                <div>
                                    <div className="flex justify-between items-start">
                                        <h3 className="text-lg m-0">{p.nombre}</h3>
                                        <span className="badge badge-secondary">{p.codigo_corto}</span>
                                    </div>
                                    <p className="text-muted mt-1">{formatCurrency(p.precio_estandar)}</p>
                                </div>

                                <div className="mt-3">
                                    <label className="text-xs text-muted">Cantidad</label>
                                    <input
                                        type="number"
                                        min="0"
                                        value={qty}
                                        onChange={e => handleQuantityChange(p.id, e.target.value)}
                                        className="text-center text-xl font-bold"
                                        placeholder="0"
                                        style={{ background: qty > 0 ? 'rgba(245, 158, 11, 0.1)' : 'transparent' }}
                                    />
                                </div>
                            </div>
                        );
                    })}
                </div>

                {/* Fixed Footer for Total and Save */}
                <div style={{
                    position: 'fixed',
                    bottom: 0,
                    left: 0,
                    right: 0,
                    background: 'var(--card-bg)',
                    padding: '1rem',
                    borderTop: '1px solid var(--border)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '10px',
                    boxShadow: '0 -4px 10px rgba(0,0,0,0.3)',
                    zIndex: 100
                }}>
                    <div className="flex justify-between items-center w-full">
                        <div className="flex items-center gap-2">
                            <label className="text-sm font-bold m-0">Domicilio:</label>
                            <input
                                type="number"
                                value={deliveryFee}
                                onChange={e => {
                                    const raw = e.target.value;
                                    if (raw === '') { setDeliveryFee(''); return; }
                                    let val = parseInt(raw);
                                    if (isNaN(val)) val = 0;
                                    if (val < 0) val = 0;
                                    if (val > 10000) val = 10000;
                                    setDeliveryFee(val);
                                }}
                                className="form-control form-control-sm"
                                style={{ width: '100px', fontWeight: 'bold' }}
                                min="0"
                                max="10000"
                            />
                        </div>
                    </div>

                    <div className="flex justify-between items-center w-full">
                        <div>
                            <small className="text-muted">Total Estimado</small>
                            <h2 className="text-primary m-0">{formatCurrency(totalEstimado)}</h2>
                        </div>
                        <button
                            type="submit"
                            className="btn btn-primary btn-lg"
                            disabled={submitting || totalEstimado === 0}
                            style={{ padding: '0.75rem 2rem' }}
                        >
                            <Save size={24} className="mr-2" />
                            {submitting ? '...' : 'Confirmar'}
                        </button>
                    </div>
                </div>
            </form>
        </div>
    );
}

import { useState, useEffect } from 'react';
import { productsService } from '../services/api';
import { Plus, Edit, Package, DollarSign, X, Save } from 'lucide-react';

export default function Products() {
    const [products, setProducts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [editingProduct, setEditingProduct] = useState(null);

    useEffect(() => {
        loadProducts();
    }, []);

    const loadProducts = async () => {
        try {
            const response = await productsService.getAll(false); // Get all, including inactive
            setProducts(response.data);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async (e) => {
        e.preventDefault();
        try {
            const payload = {
                ...editingProduct,
                precio_estandar: parseFloat(editingProduct.precio_estandar),
                costo_unitario: parseFloat(editingProduct.costo_unitario)
            };

            if (editingProduct.id) {
                await productsService.update(editingProduct.id, payload);
            } else {
                await productsService.create(payload);
            }
            setEditingProduct(null);
            loadProducts();
        } catch (err) {
            alert("Error al guardar producto");
        }
    };

    const startEdit = (product) => {
        setEditingProduct({ ...product });
    };

    const startNew = () => {
        setEditingProduct({
            nombre: '',
            codigo_corto: '',
            tipo_producto: 'arepa',
            precio_estandar: '',
            costo_unitario: '',
            unidad_medida: 'paquete',
            activo: true
        });
    };

    const formatCurrency = (val) => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP' }).format(val);

    if (editingProduct) {
        return (
            <div>
                <div className="flex justify-between items-center mb-4">
                    <h1>{editingProduct.id ? 'Editar Producto' : 'Nuevo Producto'}</h1>
                    <button onClick={() => setEditingProduct(null)} className="btn btn-secondary" style={{ width: 'auto' }}>
                        <X size={20} />
                    </button>
                </div>

                <form onSubmit={handleSave}>
                    <div className="form-group">
                        <label>Nombre</label>
                        <input
                            value={editingProduct.nombre}
                            onChange={e => setEditingProduct({ ...editingProduct, nombre: e.target.value })}
                            required
                        />
                    </div>

                    <div className="stats-grid">
                        <div className="form-group">
                            <label>Código Corto (Ej: r, ch)</label>
                            <input
                                value={editingProduct.codigo_corto}
                                onChange={e => setEditingProduct({ ...editingProduct, codigo_corto: e.target.value })}
                                required
                            />
                        </div>
                        <div className="form-group">
                            <label>Tipo</label>
                            <select
                                value={editingProduct.tipo_producto}
                                onChange={e => setEditingProduct({ ...editingProduct, tipo_producto: e.target.value })}
                            >
                                <option value="arepa">Arepa</option>
                                <option value="queso">Queso</option>
                                <option value="otro">Otro</option>
                            </select>
                        </div>
                    </div>

                    <div className="stats-grid">
                        <div className="form-group">
                            <label>Precio Venta</label>
                            <input
                                type="number"
                                value={editingProduct.precio_estandar}
                                onChange={e => setEditingProduct({ ...editingProduct, precio_estandar: e.target.value })}
                                required
                            />
                        </div>
                        <div className="form-group">
                            <label>Costo Unitario</label>
                            <input
                                type="number"
                                value={editingProduct.costo_unitario}
                                onChange={e => setEditingProduct({ ...editingProduct, costo_unitario: e.target.value })}
                                required
                            />
                        </div>
                    </div>

                    <div className="form-group">
                        <label>Unidad Medida</label>
                        <select
                            value={editingProduct.unidad_medida}
                            onChange={e => setEditingProduct({ ...editingProduct, unidad_medida: e.target.value })}
                        >
                            <option value="paquete">Paquete</option>
                            <option value="unidad">Unidad</option>
                            <option value="libra">Libra</option>
                            <option value="kg">Kg</option>
                        </select>
                    </div>

                    <div className="form-group flex items-center gap-2">
                        <input
                            type="checkbox"
                            style={{ width: 'auto' }}
                            checked={editingProduct.activo}
                            onChange={e => setEditingProduct({ ...editingProduct, activo: e.target.checked })}
                        />
                        <label style={{ marginBottom: 0 }}>Activo</label>
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
                <h1>Productos</h1>
                <button onClick={startNew} className="btn btn-primary" style={{ width: 'auto', padding: '0.5rem 1rem' }}>
                    <Plus size={20} />
                </button>
            </div>

            {loading ? <p>Cargando...</p> : (
                <div className="flex" style={{ flexDirection: 'column', gap: '1rem' }}>
                    {products.map(product => (
                        <div key={product.id} className="card" style={{ marginBottom: 0, padding: '1rem', opacity: product.activo ? 1 : 0.6 }}>
                            <div className="flex justify-between items-start">
                                <div>
                                    <div className="flex items-center gap-2">
                                        <h3>{product.nombre}</h3>
                                        <span className="text-muted" style={{ fontSize: '0.8rem', background: 'rgba(255,255,255,0.1)', padding: '2px 6px', borderRadius: '4px' }}>
                                            {product.codigo_corto}
                                        </span>
                                    </div>
                                    <div className="flex gap-4 mt-2">
                                        <div className="flex items-center gap-1 text-success">
                                            <DollarSign size={14} />
                                            <strong>{formatCurrency(product.precio_estandar)}</strong>
                                        </div>
                                        <div className="text-muted" style={{ fontSize: '0.9rem' }}>
                                            Costo: {formatCurrency(product.costo_unitario)}
                                        </div>
                                    </div>
                                </div>
                                <button
                                    onClick={() => startEdit(product)}
                                    className="btn btn-secondary"
                                    style={{ width: 'auto', padding: '0.5rem' }}
                                >
                                    <Edit size={18} />
                                </button>
                            </div>
                        </div>
                    ))}
                    {products.length === 0 && <p className="text-center text-muted">No hay productos registrados.</p>}
                </div>
            )}
        </div>
    );
}

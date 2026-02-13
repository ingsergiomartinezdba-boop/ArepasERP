import { useState, useEffect } from 'react';
import { productsService } from '../services/api';
import { Plus, Edit, Package, DollarSign, X, Save, Trash2 } from 'lucide-react';

export default function Products() {
    const [products, setProducts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [editingProduct, setEditingProduct] = useState(null);

    useEffect(() => {
        loadProducts();
    }, []);

    const loadProducts = async () => {
        setLoading(true);
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

    const handleDelete = async (id) => {
        if (!confirm('¿Seguro que desea eliminar este producto? Si tiene pedidos asociados no se podrá eliminar.')) return;
        try {
            await productsService.delete(id);
            loadProducts();
        } catch (error) {
            const msg = error.response?.data?.detail || "No se puede eliminar: Probablemente tenga movimientos asociados.";
            alert(msg);
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
            <div style={{ position: 'relative' }}>
                <button
                    onClick={() => setEditingProduct(null)}
                    className="btn-close-modal"
                    style={{ top: '0', right: '0' }}
                >
                    <X size={18} />
                </button>

                <div className="mb-6">
                    <h1 className="m-0">{editingProduct.id ? 'Editar Producto' : 'Nuevo Producto'}</h1>
                </div>

                <div className="card">
                    <form onSubmit={handleSave}>
                        <div className="form-group">
                            <label>Nombre del Producto *</label>
                            <input
                                className="form-control"
                                value={editingProduct.nombre}
                                onChange={e => setEditingProduct({ ...editingProduct, nombre: e.target.value })}
                                required
                                placeholder="Ej: Arepa de Choclo x5"
                            />
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="form-group">
                                <label>Código Corto (Identificador)</label>
                                <input
                                    className="form-control"
                                    value={editingProduct.codigo_corto}
                                    onChange={e => setEditingProduct({ ...editingProduct, codigo_corto: e.target.value })}
                                    required
                                    placeholder="Ej: ach5"
                                />
                            </div>
                            <div className="form-group">
                                <label>Tipo de Producto</label>
                                <select
                                    className="form-control"
                                    value={editingProduct.tipo_producto}
                                    onChange={e => setEditingProduct({ ...editingProduct, tipo_producto: e.target.value })}
                                >
                                    <option value="arepa">Arepa</option>
                                    <option value="queso">Queso</option>
                                    <option value="otro">Otro</option>
                                </select>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="form-group">
                                <label>Precio de Venta</label>
                                <div className="relative">
                                    <span style={{ position: 'absolute', left: '10px', top: '10px', color: 'var(--text-muted)' }}>$</span>
                                    <input
                                        type="number"
                                        className="form-control"
                                        style={{ paddingLeft: '25px' }}
                                        value={editingProduct.precio_estandar}
                                        onChange={e => setEditingProduct({ ...editingProduct, precio_estandar: e.target.value })}
                                        required
                                    />
                                </div>
                            </div>
                            <div className="form-group">
                                <label>Costo Unitario</label>
                                <div className="relative">
                                    <span style={{ position: 'absolute', left: '10px', top: '10px', color: 'var(--text-muted)' }}>$</span>
                                    <input
                                        type="number"
                                        className="form-control"
                                        style={{ paddingLeft: '25px' }}
                                        value={editingProduct.costo_unitario}
                                        onChange={e => setEditingProduct({ ...editingProduct, costo_unitario: e.target.value })}
                                        required
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="form-group">
                                <label>Unidad de Medida</label>
                                <select
                                    className="form-control"
                                    value={editingProduct.unidad_medida}
                                    onChange={e => setEditingProduct({ ...editingProduct, unidad_medida: e.target.value })}
                                >
                                    <option value="paquete">Paquete</option>
                                    <option value="unidad">Unidad</option>
                                    <option value="libra">Libra</option>
                                    <option value="kg">Kg</option>
                                </select>
                            </div>

                            <div className="form-group flex items-end">
                                <div className="flex items-center gap-2 mb-2 p-2" style={{ border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', width: '100%' }}>
                                    <input
                                        type="checkbox"
                                        style={{ width: '1.2rem', height: '1.2rem' }}
                                        checked={editingProduct.activo}
                                        onChange={e => setEditingProduct({ ...editingProduct, activo: e.target.checked })}
                                        id="chkActive"
                                    />
                                    <label htmlFor="chkActive" className="mb-0 cursor-pointer">Producto Activo</label>
                                </div>
                            </div>
                        </div>

                        <div className="mt-8">
                            <button type="submit" className="btn btn-primary font-bold" style={{ width: 'auto', padding: '0.8rem 2rem' }}>
                                <Save size={20} style={{ marginRight: '8px' }} />
                                {editingProduct.id ? 'Guardar Cambios' : 'Crear Producto'}
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
                <h1 className="m-0">Productos</h1>
                <button
                    onClick={startNew}
                    className="btn btn-primary"
                    style={{ width: 'auto', padding: '0.6rem 1.2rem', display: 'flex', alignItems: 'center', gap: '8px' }}
                >
                    <Plus size={20} /> Nuevo Producto
                </button>
            </div>

            <div className="card overflow-x-auto">
                <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '800px' }}>
                    <thead>
                        <tr style={{ borderBottom: '1px solid var(--border)', textAlign: 'left' }}>
                            <th className="p-3">ID</th>
                            <th className="p-3">Producto</th>
                            <th className="p-3">Código</th>
                            <th className="p-3">Tipo</th>
                            <th className="p-3">Precio</th>
                            <th className="p-3">Estado</th>
                            <th className="p-3 text-center">Acciones</th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            <tr><td colSpan="7" className="p-4 text-center">Cargando...</td></tr>
                        ) : products.length === 0 ? (
                            <tr><td colSpan="7" className="p-4 text-center text-muted">No hay productos registrados.</td></tr>
                        ) : (
                            products.map(product => (
                                <tr key={product.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', opacity: product.activo ? 1 : 0.5 }}>
                                    <td className="p-3 text-muted">#{product.id}</td>
                                    <td className="p-3">
                                        <div className="font-bold">{product.nombre}</div>
                                        <div className="text-xs text-muted">{product.unidad_medida}</div>
                                    </td>
                                    <td className="p-3 font-mono text-sm">{product.codigo_corto}</td>
                                    <td className="p-3 capitalize">{product.tipo_producto}</td>
                                    <td className="p-3">
                                        <div className="text-success font-bold">{formatCurrency(product.precio_estandar)}</div>
                                        <div className="text-xs text-muted">Costo: {formatCurrency(product.costo_unitario)}</div>
                                    </td>
                                    <td className="p-3">
                                        <span className={`badge ${product.activo ? 'text-success' : 'text-muted'}`} style={{ border: '1px solid currentColor', background: 'transparent' }}>
                                            {product.activo ? 'Activo' : 'Inactivo'}
                                        </span>
                                    </td>
                                    <td className="p-3 text-center">
                                        <div className="flex justify-center gap-2">
                                            <button
                                                onClick={() => startEdit(product)}
                                                className="btn btn-secondary"
                                                style={{ padding: '0.4rem' }}
                                                title="Editar"
                                            >
                                                <Edit size={16} />
                                            </button>
                                            <button
                                                onClick={() => handleDelete(product.id)}
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

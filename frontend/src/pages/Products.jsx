import { useState, useEffect } from 'react';
import { productsService, insumosService, parametrosService } from '../services/api';
import { Plus, Edit, X, Save, Trash2, Calculator, RefreshCw, CheckCircle } from 'lucide-react';
import { toast } from 'sonner';
import { formatDate } from '../utils/formatters';

const FMT = (n) => `$${Number(n).toLocaleString('es-CO', { minimumFractionDigits: 0 })}`;

function CalculadoraCosto({ productoId, onCostoAplicado }) {
    const [insumos, setInsumos] = useState([]);
    const [allInsumos, setAllInsumos] = useState([]);
    const [calculo, setCalculo] = useState(null);
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        insumosService.getAll(false).then(r => setAllInsumos(r.data)).catch(() => {});
        if (productoId) {
            productsService.getInsumos(productoId).then(r => {
                setInsumos(r.data.map(i => ({ insumo_id: i.insumo_id, cantidad: i.cantidad })));
            }).catch(() => {});
        }
    }, [productoId]);

    const calcular = async () => {
        if (!productoId) return;
        setLoading(true);
        try {
            await productsService.saveInsumos(productoId, insumos.filter(i => i.insumo_id));
            const r = await productsService.calcularCosto(productoId);
            setCalculo(r.data);
        } catch (e) {
            toast.error(e.response?.data?.detail || 'Error al calcular costo');
        } finally {
            setLoading(false);
        }
    };

    const aplicar = async () => {
        setSaving(true);
        try {
            const r = await productsService.aplicarCosto(productoId);
            toast.success(`Costo actualizado: ${FMT(r.data.costo_nuevo)}`);
            onCostoAplicado(r.data.costo_nuevo);
        } catch {
            toast.error('Error al aplicar costo');
        } finally {
            setSaving(false);
        }
    };

    return (
        <div style={{ border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden', marginBottom: 16 }}>
            <div style={{ background: 'var(--bg-secondary)', padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 8, borderBottom: '1px solid var(--border)' }}>
                <Calculator size={15} style={{ color: '#ffdd19' }} />
                <span style={{ fontWeight: 700, fontSize: 13 }}>Calculadora de Costo Unitario</span>
            </div>
            <div style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 12 }}>
                {/* Insumos de empaque */}
                <div>
                    <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 8 }}>
                        Insumos de empaque (ej: bolsa) por unidad
                    </div>
                    {insumos.map((ln, idx) => (
                        <div key={idx} style={{ display: 'flex', gap: 8, marginBottom: 6, alignItems: 'center' }}>
                            <select className="form-control" style={{ fontSize: 13, flex: 2 }}
                                value={ln.insumo_id || ''}
                                onChange={e => {
                                    const arr = [...insumos];
                                    arr[idx] = { ...arr[idx], insumo_id: Number(e.target.value) };
                                    setInsumos(arr);
                                }}>
                                <option value="">Seleccionar insumo…</option>
                                {allInsumos.map(i => <option key={i.id} value={i.id}>{i.nombre} ({i.unidad_medida})</option>)}
                            </select>
                            <input type="number" className="form-control" style={{ fontSize: 13, flex: 1 }}
                                placeholder="Cantidad" min="0.0001" step="any"
                                value={ln.cantidad}
                                onChange={e => {
                                    const arr = [...insumos];
                                    arr[idx] = { ...arr[idx], cantidad: e.target.value };
                                    setInsumos(arr);
                                }} />
                            <button type="button" className="btn btn-secondary" style={{ padding: '4px 8px', color: 'var(--danger)', flexShrink: 0 }}
                                onClick={() => setInsumos(insumos.filter((_, i) => i !== idx))}>
                                <Trash2 size={13} />
                            </button>
                        </div>
                    ))}
                    <button type="button" className="btn btn-secondary" style={{ fontSize: 12, padding: '4px 10px' }}
                        onClick={() => setInsumos([...insumos, { insumo_id: '', cantidad: 1 }])}>
                        <Plus size={12} /> Agregar insumo
                    </button>
                </div>

                <button type="button" className="btn btn-secondary" style={{ fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}
                    onClick={calcular} disabled={loading || !productoId}>
                    <RefreshCw size={13} /> {loading ? 'Calculando…' : 'Calcular costo'}
                </button>

                {/* Resultado */}
                {calculo && (
                    <div style={{ background: 'var(--bg-secondary)', borderRadius: 8, padding: 12 }}>
                        <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 8, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Desglose</div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 13 }}>
                            {calculo.insumos.map((i, idx) => (
                                <div key={idx} style={{ display: 'flex', justifyContent: 'space-between' }}>
                                    <span style={{ color: 'var(--text-secondary)' }}>{i.insumo_nombre} ({i.cantidad} {i.unidad_medida} × {FMT(i.costo_unitario)})</span>
                                    <span style={{ fontWeight: 600 }}>{FMT(i.costo_linea)}</span>
                                </div>
                            ))}
                            <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid var(--border)', paddingTop: 6, marginTop: 4 }}>
                                <span style={{ fontWeight: 700 }}>Costo total calculado</span>
                                <span style={{ fontWeight: 800, fontSize: 15, color: '#ffdd19' }}>{FMT(calculo.costo_total)}</span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                                <span style={{ color: 'var(--text-secondary)' }}>Costo actual en producto</span>
                                <span style={{ color: 'var(--text-secondary)' }}>{FMT(calculo.costo_actual)}</span>
                            </div>
                        </div>
                        <button type="button" className="btn btn-primary" style={{ width: '100%', marginTop: 10, fontSize: 13, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
                            onClick={aplicar} disabled={saving}>
                            <CheckCircle size={14} /> {saving ? 'Aplicando…' : `Actualizar costo a ${FMT(calculo.costo_total)}`}
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}

const fmtDate = (d) => d ? formatDate(d) : '—';

export default function Products() {
    const [products, setProducts] = useState([]);
    const [tiposProducto, setTiposProducto] = useState([]);
    const [loading, setLoading] = useState(true);
    const [editingProduct, setEditingProduct] = useState(null);

    useEffect(() => {
        loadProducts();
        parametrosService.getTiposProducto(true).then(r => setTiposProducto(r.data)).catch(() => {});
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
                precio: parseFloat(editingProduct.precio),
                costo: parseFloat(editingProduct.costo),
            };
            delete payload.peso_kg;
            delete payload.unidad_base;

            if (editingProduct.id) {
                await productsService.update(editingProduct.id, payload);
            } else {
                await productsService.create(payload);
            }
            setEditingProduct(null);
            loadProducts();
        } catch (err) {
            toast.error("Error al guardar producto");
        }
    };

    const handleDelete = async (id) => {
        if (!confirm('¿Seguro que desea eliminar este producto? Si tiene pedidos asociados no se podrá eliminar.')) return;
        try {
            await productsService.delete(id);
            loadProducts();
        } catch (error) {
            const msg = error.response?.data?.detail || "No se puede eliminar: Probablemente tenga movimientos asociados.";
            toast.error(msg);
        }
    };

    const startEdit = (product) => {
        setEditingProduct({ ...product });
    };

    const startNew = () => {
        setEditingProduct({
            nombre: '',
            codigo_corto: '',
            tipo_producto: 'final',
            precio: '',
            costo: '',
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
                                    value={editingProduct.tipo_producto || ''}
                                    onChange={e => setEditingProduct({ ...editingProduct, tipo_producto: e.target.value })}
                                >
                                    <option value="">— Seleccionar —</option>
                                    {tiposProducto.map(t => (
                                        <option key={t.codigo} value={t.codigo}>{t.nombre}</option>
                                    ))}
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
                                        value={editingProduct.precio}
                                        onChange={e => setEditingProduct({ ...editingProduct, precio: e.target.value })}
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
                                        value={editingProduct.costo}
                                        onChange={e => setEditingProduct({ ...editingProduct, costo: e.target.value })}
                                        required
                                    />
                                </div>
                            </div>
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

                        <div style={{ fontSize: 12, color: 'var(--text-secondary)', padding: '8px 12px', background: 'rgba(167,139,250,0.08)', border: '1px solid rgba(167,139,250,0.25)', borderRadius: 8 }}>
                            La composición del producto (masa, empaques, etiquetas, etc.) se gestiona desde la grilla de insumos al final.
                        </div>

                        <div className="mt-8">
                            <button type="submit" className="btn btn-primary font-bold" style={{ width: 'auto', padding: '0.8rem 2rem' }}>
                                <Save size={20} style={{ marginRight: '8px' }} />
                                {editingProduct.id ? 'Guardar Cambios' : 'Crear Producto'}
                            </button>
                        </div>
                    </form>

                    {editingProduct.id && (
                        <div className="mt-6">
                            <CalculadoraCosto
                                productoId={editingProduct.id}
                                onCostoAplicado={(newCosto) => setEditingProduct({ ...editingProduct, costo: newCosto })}
                            />
                        </div>
                    )}
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
                            <th className="p-3">Producto</th>
                            <th className="p-3">Código</th>
                            <th className="p-3">Tipo</th>
                            <th className="p-3">Precio / Costo</th>
                            <th className="p-3">Creado</th>
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
                                    <td className="p-3">
                                        <div className="font-bold">{product.nombre}</div>
                                        <div className="text-xs text-muted">#{product.id}</div>
                                    </td>
                                    <td className="p-3 font-mono text-sm">{product.codigo_corto || <span className="text-muted" style={{ opacity: 0.4 }}>—</span>}</td>
                                    <td className="p-3 capitalize">{product.tipo_producto}</td>
                                    <td className="p-3">
                                        <div className="text-success font-bold">{formatCurrency(product.precio)}</div>
                                        <div className="text-xs text-muted">Costo: {formatCurrency(product.costo)}</div>
                                    </td>
                                    <td className="p-3 text-muted" style={{ fontSize: '0.8rem' }}>
                                        {fmtDate(product.created_at)}
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

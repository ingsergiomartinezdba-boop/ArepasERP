/**
 * RolesAdmin — Página de gestión de Roles y Permisos
 * Requiere permiso: roles.ver
 */
import { useState, useEffect, useMemo } from 'react';
import { Shield, Plus, Edit2, Trash2, Check, X, ChevronDown, ChevronUp, Users, Save, Key } from 'lucide-react';
import { toast } from 'sonner';
import { rolesService } from '../services/api';
import { usePermission } from '../context/AuthContext';
import PermissionGate from '../components/PermissionGate';

// ── Iconos por módulo ────────────────────────────────────────
const MODULO_LABEL = {
    clientes:      '👥 Clientes',
    pedidos:       '🛒 Pedidos',
    productos:     '📦 Productos',
    gastos:        '💸 Gastos',
    proveedores:   '🚚 Proveedores',
    medios_pago:   '💳 Medios de Pago',
    transferencias:'🔄 Transferencias / Caja',
    produccion:    '⚗️ Producción',
    inventario:    '📋 Inventario',
    insumos:       '🌽 Insumos',
    cobros:        '💰 Cuentas por Cobrar',
    reportes:      '📊 Reportes',
    analitica:     '📈 Analítica',
    costeo:        '🧮 Costeo',
    usuarios:      '🔑 Usuarios',
    roles:         '🛡️ Roles',
};

const ACCION_LABEL = {
    ver:       'Ver',
    crear:     'Crear',
    editar:    'Editar',
    eliminar:  'Eliminar',
    ajustar:   'Ajustar',
    registrar: 'Registrar',
};

// ── Modal Rol ────────────────────────────────────────────────
function RolModal({ rol, onClose, onSave }) {
    const [nombre, setNombre]           = useState(rol?.nombre || '');
    const [descripcion, setDescripcion] = useState(rol?.descripcion || '');
    const [saving, setSaving]           = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!nombre.trim()) return;
        setSaving(true);
        try {
            await onSave({ nombre: nombre.trim(), descripcion: descripcion.trim() || null });
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="card" style={{ maxWidth: 440, width: '100%', margin: 'auto', padding: 28 }}
                 onClick={e => e.stopPropagation()}>
                <h2 style={{ marginBottom: 20, fontSize: '1.2rem' }}>
                    {rol ? 'Editar rol' : 'Nuevo rol'}
                </h2>
                <form onSubmit={handleSubmit}>
                    <div className="mb-3">
                        <label className="form-label">Nombre del rol *</label>
                        <input
                            value={nombre}
                            onChange={e => setNombre(e.target.value)}
                            placeholder="Ej: Vendedor, Bodeguero..."
                            required
                            autoFocus
                        />
                    </div>
                    <div className="mb-4">
                        <label className="form-label">Descripción</label>
                        <textarea
                            value={descripcion}
                            onChange={e => setDescripcion(e.target.value)}
                            placeholder="¿Qué puede hacer este rol?"
                            rows={3}
                        />
                    </div>
                    <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                        <button type="button" className="btn btn-secondary" onClick={onClose}>
                            Cancelar
                        </button>
                        <button type="submit" className="btn btn-primary" disabled={saving}>
                            {saving ? 'Guardando…' : 'Guardar rol'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

// ── Panel de Permisos de un Rol ──────────────────────────────
function PermisosPanel({ rol, todosPermisos, onClose, onSaved }) {
    // Set de ids activos
    const [activos, setActivos] = useState(new Set(rol.permisos?.map(p => p.id) || []));
    const [saving, setSaving]   = useState(false);

    // Agrupar todos los permisos por módulo
    const grupos = useMemo(() => {
        const map = {};
        todosPermisos.forEach(p => {
            if (!map[p.modulo]) map[p.modulo] = [];
            map[p.modulo].push(p);
        });
        return map;
    }, [todosPermisos]);

    const toggle = (id) => {
        setActivos(prev => {
            const next = new Set(prev);
            next.has(id) ? next.delete(id) : next.add(id);
            return next;
        });
    };

    const toggleModulo = (modulo) => {
        const ids = grupos[modulo].map(p => p.id);
        const allActive = ids.every(id => activos.has(id));
        setActivos(prev => {
            const next = new Set(prev);
            ids.forEach(id => allActive ? next.delete(id) : next.add(id));
            return next;
        });
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            await rolesService.asignarPermisos(rol.id, [...activos]);
            toast.success('Permisos actualizados');
            onSaved();
        } catch {
            toast.error('Error al guardar permisos');
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="modal-overlay" style={{ alignItems: 'flex-start', overflowY: 'auto', padding: 16 }}
             onClick={onClose}>
            <div className="card" style={{ maxWidth: 680, width: '100%', margin: 'auto', padding: 0,
                                           maxHeight: 'calc(100vh - 32px)', display: 'flex', flexDirection: 'column' }}
                 onClick={e => e.stopPropagation()}>

                {/* Header fijo */}
                <div style={{ padding: '20px 24px 16px', borderBottom: '1px solid var(--border-subtle)',
                              display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
                    <div>
                        <h2 style={{ margin: 0, fontSize: '1.1rem' }}>
                            <Key size={16} style={{ marginRight: 8, verticalAlign: 'middle', color: 'var(--brand)' }} />
                            Permisos de "{rol.nombre}"
                        </h2>
                        <p style={{ margin: '4px 0 0', fontSize: 12, color: 'var(--text-muted)' }}>
                            {activos.size} de {todosPermisos.length} permisos activos
                        </p>
                    </div>
                    <button className="btn btn-ghost" onClick={onClose} style={{ padding: '4px 8px' }}>
                        <X size={16} />
                    </button>
                </div>

                {/* Módulos scrollable */}
                <div style={{ overflowY: 'auto', padding: '12px 24px', flex: 1 }}>
                    {Object.entries(grupos).map(([modulo, permisos]) => {
                        const ids = permisos.map(p => p.id);
                        const totalActivos = ids.filter(id => activos.has(id)).length;
                        const allOn = totalActivos === ids.length;
                        const someOn = totalActivos > 0 && !allOn;

                        return (
                            <div key={modulo} className="card" style={{ marginBottom: 10, padding: '12px 16px' }}>
                                {/* Cabecera del módulo */}
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                              marginBottom: 10 }}>
                                    <span style={{ fontWeight: 700, fontSize: 13 }}>
                                        {MODULO_LABEL[modulo] || modulo}
                                    </span>
                                    <button
                                        onClick={() => toggleModulo(modulo)}
                                        style={{
                                            fontSize: 11, fontWeight: 700, padding: '3px 10px',
                                            borderRadius: 6, border: '1px solid var(--border)',
                                            background: allOn ? 'var(--brand-muted)' : 'transparent',
                                            color: allOn ? 'var(--brand)' : 'var(--text-muted)',
                                            cursor: 'pointer',
                                        }}>
                                        {allOn ? 'Quitar todos' : someOn ? `${totalActivos}/${ids.length}` : 'Todos'}
                                    </button>
                                </div>

                                {/* Checkboxes por acción */}
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                                    {permisos.map(p => {
                                        const on = activos.has(p.id);
                                        return (
                                            <button
                                                key={p.id}
                                                onClick={() => toggle(p.id)}
                                                style={{
                                                    display: 'flex', alignItems: 'center', gap: 6,
                                                    padding: '5px 12px', borderRadius: 8, cursor: 'pointer',
                                                    fontSize: 12, fontWeight: 600,
                                                    border: `1.5px solid ${on ? 'var(--brand)' : 'var(--border)'}`,
                                                    background: on ? 'var(--brand-muted)' : 'transparent',
                                                    color: on ? 'var(--brand)' : 'var(--text-muted)',
                                                    transition: 'all 0.15s',
                                                }}>
                                                <div style={{
                                                    width: 14, height: 14, borderRadius: 3,
                                                    border: `2px solid ${on ? 'var(--brand)' : 'var(--border-strong)'}`,
                                                    background: on ? 'var(--brand)' : 'transparent',
                                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                    flexShrink: 0,
                                                }}>
                                                    {on && <Check size={9} color="#151515" strokeWidth={3} />}
                                                </div>
                                                {ACCION_LABEL[p.accion] || p.accion}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        );
                    })}
                </div>

                {/* Footer fijo */}
                <div style={{ padding: '14px 24px', borderTop: '1px solid var(--border-subtle)',
                              display: 'flex', justifyContent: 'flex-end', gap: 10, flexShrink: 0 }}>
                    <button className="btn btn-secondary" onClick={onClose}>Cancelar</button>
                    <PermissionGate permission="roles.editar">
                        <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
                            <Save size={14} style={{ marginRight: 6 }} />
                            {saving ? 'Guardando…' : 'Guardar permisos'}
                        </button>
                    </PermissionGate>
                </div>
            </div>
        </div>
    );
}

// ── Componente principal ──────────────────────────────────────
export default function RolesAdmin() {
    const canVer     = usePermission('roles.ver');
    const canCrear   = usePermission('roles.crear');
    const canEditar  = usePermission('roles.editar');
    const canEliminar = usePermission('roles.eliminar');

    const [roles, setRoles]               = useState([]);
    const [permisos, setPermisos]         = useState([]);
    const [loading, setLoading]           = useState(true);

    const [modalRol, setModalRol]         = useState(null);   // null | { rol | 'new' }
    const [panelRol, setPanelRol]         = useState(null);   // rol con permisos cargados
    const [confirmDelete, setConfirmDelete] = useState(null); // rol a eliminar

    useEffect(() => {
        cargar();
    }, []);

    const cargar = async () => {
        setLoading(true);
        try {
            const [rRes, pRes] = await Promise.all([
                rolesService.getRoles(),
                rolesService.getPermisos(),
            ]);
            setRoles(rRes.data);
            setPermisos(pRes.data);
        } catch {
            toast.error('Error al cargar roles');
        } finally {
            setLoading(false);
        }
    };

    const abrirPermisos = async (rol) => {
        try {
            const res = await rolesService.getRol(rol.id);
            setPanelRol(res.data);
        } catch {
            toast.error('Error al cargar permisos del rol');
        }
    };

    const handleSaveRol = async (data) => {
        try {
            if (modalRol?.id) {
                await rolesService.actualizarRol(modalRol.id, data);
                toast.success('Rol actualizado');
            } else {
                await rolesService.crearRol(data);
                toast.success('Rol creado');
            }
            setModalRol(null);
            cargar();
        } catch (err) {
            toast.error(err.response?.data?.detail || 'Error al guardar rol');
            throw err;
        }
    };

    const handleEliminar = async () => {
        if (!confirmDelete) return;
        try {
            await rolesService.eliminarRol(confirmDelete.id);
            toast.success('Rol eliminado');
            setConfirmDelete(null);
            cargar();
        } catch (err) {
            toast.error(err.response?.data?.detail || 'Error al eliminar rol');
        }
    };

    if (!canVer) {
        return (
            <div style={{ textAlign: 'center', padding: 60 }}>
                <Shield size={40} style={{ color: 'var(--danger)', marginBottom: 16 }} />
                <h2>Sin acceso</h2>
                <p style={{ color: 'var(--text-muted)' }}>No tienes permiso para ver esta sección.</p>
            </div>
        );
    }

    return (
        <div style={{ maxWidth: 900, margin: '0 auto' }}>
            {/* ── Header ─────────────────────────────────────────── */}
            <div className="page-header">
                <div>
                    <h1 style={{ display: 'flex', alignItems: 'center', gap: 10, margin: 0 }}>
                        <Shield size={22} color="var(--brand)" />
                        Roles y Permisos
                    </h1>
                    <p style={{ color: 'var(--text-muted)', fontSize: 13, marginTop: 4 }}>
                        {roles.length} roles configurados · Sistema RBAC dinámico
                    </p>
                </div>
                <PermissionGate permission="roles.crear">
                    <button className="btn btn-primary" onClick={() => setModalRol({})}>
                        <Plus size={16} style={{ marginRight: 6 }} />
                        Nuevo Rol
                    </button>
                </PermissionGate>
            </div>

            {/* ── Lista de roles ──────────────────────────────────── */}
            {loading ? (
                <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>
                    Cargando roles…
                </div>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {roles.map(rol => (
                        <div key={rol.id} className="card" style={{ padding: '16px 20px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                          gap: 16, flexWrap: 'wrap' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 14, minWidth: 0 }}>
                                    <div style={{
                                        width: 40, height: 40, borderRadius: 10, flexShrink: 0,
                                        background: 'var(--brand-muted)',
                                        border: '1px solid var(--border-brand)',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    }}>
                                        <Shield size={18} color="var(--brand)" />
                                    </div>
                                    <div style={{ minWidth: 0 }}>
                                        <div style={{ fontWeight: 700, fontSize: 15 }}>{rol.nombre}</div>
                                        {rol.descripcion && (
                                            <div style={{ fontSize: 12, color: 'var(--text-muted)',
                                                          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                {rol.descripcion}
                                            </div>
                                        )}
                                    </div>
                                </div>

                                <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                                    {/* Botón permisos */}
                                    <button
                                        className="btn btn-secondary btn-sm"
                                        onClick={() => abrirPermisos(rol)}
                                        style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                        <Key size={13} />
                                        Permisos
                                    </button>

                                    {/* Editar */}
                                    <PermissionGate permission="roles.editar">
                                        <button
                                            className="btn btn-ghost btn-sm"
                                            onClick={() => setModalRol(rol)}
                                            title="Editar rol">
                                            <Edit2 size={14} />
                                        </button>
                                    </PermissionGate>

                                    {/* Eliminar */}
                                    <PermissionGate permission="roles.eliminar">
                                        <button
                                            className="btn btn-danger btn-sm"
                                            onClick={() => setConfirmDelete(rol)}
                                            title="Eliminar rol">
                                            <Trash2 size={14} />
                                        </button>
                                    </PermissionGate>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* ── Modales ─────────────────────────────────────────── */}

            {/* Crear / Editar rol */}
            {modalRol !== null && (
                <RolModal
                    rol={modalRol?.id ? modalRol : null}
                    onClose={() => setModalRol(null)}
                    onSave={handleSaveRol}
                />
            )}

            {/* Gestionar permisos del rol */}
            {panelRol && (
                <PermisosPanel
                    rol={panelRol}
                    todosPermisos={permisos}
                    onClose={() => setPanelRol(null)}
                    onSaved={() => { setPanelRol(null); cargar(); }}
                />
            )}

            {/* Confirmar eliminación */}
            {confirmDelete && (
                <div className="modal-overlay" onClick={() => setConfirmDelete(null)}>
                    <div className="card" style={{ maxWidth: 380, width: '100%', margin: 'auto', padding: 28 }}
                         onClick={e => e.stopPropagation()}>
                        <h2 style={{ marginBottom: 12, fontSize: '1.1rem', color: 'var(--danger)' }}>
                            ¿Eliminar rol "{confirmDelete.nombre}"?
                        </h2>
                        <p style={{ color: 'var(--text-muted)', fontSize: 13, marginBottom: 20 }}>
                            Esta acción no se puede deshacer. Los usuarios con este rol perderán sus permisos.
                        </p>
                        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                            <button className="btn btn-secondary" onClick={() => setConfirmDelete(null)}>
                                Cancelar
                            </button>
                            <button className="btn btn-danger" onClick={handleEliminar}>
                                Eliminar
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

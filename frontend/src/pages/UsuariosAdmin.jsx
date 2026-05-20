/**
 * UsuariosAdmin — CRUD de usuarios con asignación de rol
 * Requiere permiso: usuarios.ver
 */
import { useState, useEffect } from 'react';
import { Users, Plus, Edit2, UserX, UserCheck, Shield, Mail, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { rolesService, clientsService } from '../services/api';
import { usePermission } from '../context/AuthContext';
import PermissionGate from '../components/PermissionGate';

function UsuarioModal({ usuario, roles, clientes, onClose, onSave }) {
    const [form, setForm] = useState({
        email:      usuario?.email      || '',
        nombre:     usuario?.nombre     || '',
        password:   '',
        rol_id:     usuario?.rol_id     ?? '',
        cliente_id: usuario?.cliente_id ?? '',
    });
    const [saving, setSaving] = useState(false);
    const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

    const handleSubmit = async (e) => {
        e.preventDefault();
        setSaving(true);
        const data = {
            ...form,
            rol_id:     form.rol_id     ? Number(form.rol_id)     : null,
            cliente_id: form.cliente_id ? Number(form.cliente_id) : null,
        };
        if (!usuario && !form.password) { toast.warning('La contraseña es obligatoria'); setSaving(false); return; }
        if (!form.password) delete data.password;
        try {
            await onSave(data);
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="modal-overlay" style={{ alignItems: 'flex-start', overflowY: 'auto', padding: 16 }}
             onClick={onClose}>
            <div className="card" style={{ maxWidth: 440, width: '100%', margin: 'auto', padding: 28 }}
                 onClick={e => e.stopPropagation()}>
                <h2 style={{ marginBottom: 20, fontSize: '1.2rem' }}>
                    {usuario ? 'Editar usuario' : 'Nuevo usuario'}
                </h2>
                <form onSubmit={handleSubmit}>
                    <div className="mb-3">
                        <label className="form-label">Nombre completo *</label>
                        <input value={form.nombre} onChange={e => set('nombre', e.target.value)}
                               required placeholder="Nombre y apellido" autoFocus />
                    </div>
                    <div className="mb-3">
                        <label className="form-label">Email *</label>
                        <input type="email" value={form.email} onChange={e => set('email', e.target.value)}
                               required disabled={!!usuario} placeholder="correo@empresa.com" />
                    </div>
                    <div className="mb-3">
                        <label className="form-label">
                            {usuario ? 'Nueva contraseña (dejar vacío para no cambiar)' : 'Contraseña *'}
                        </label>
                        <input type="password" value={form.password} onChange={e => set('password', e.target.value)}
                               placeholder={usuario ? '••••••••' : 'Mínimo 6 caracteres'} minLength={form.password ? 6 : 0} />
                    </div>
                    <div className="mb-3">
                        <label className="form-label">Rol</label>
                        <select value={form.rol_id} onChange={e => set('rol_id', e.target.value)}>
                            <option value="">Sin rol asignado</option>
                            {roles.map(r => (
                                <option key={r.id} value={r.id}>{r.nombre}</option>
                            ))}
                        </select>
                    </div>
                    {/* Vincular a cliente — solo visible si hay clientes */}
                    {clientes.length > 0 && (
                        <div className="mb-4">
                            <label className="form-label">Vincular a cliente (opcional)</label>
                            <select value={form.cliente_id} onChange={e => set('cliente_id', e.target.value)}>
                                <option value="">Sin cliente vinculado</option>
                                {clientes.map(c => (
                                    <option key={c.id} value={c.id}>{c.nombre}</option>
                                ))}
                            </select>
                        </div>
                    )}
                    <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                        <button type="button" className="btn btn-secondary" onClick={onClose}>Cancelar</button>
                        <button type="submit" className="btn btn-primary" disabled={saving}>
                            {saving ? 'Guardando…' : 'Guardar'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

export default function UsuariosAdmin() {
    const canVer      = usePermission('usuarios.ver');
    const canCrear    = usePermission('usuarios.crear');
    const canEditar   = usePermission('usuarios.editar');
    const canEliminar = usePermission('usuarios.eliminar');

    const [usuarios, setUsuarios] = useState([]);
    const [roles, setRoles]       = useState([]);
    const [clientes, setClientes] = useState([]);
    const [loading, setLoading]   = useState(true);
    const [modal, setModal]       = useState(null);  // null | usuario | {}

    useEffect(() => { cargar(); }, []);

    const cargar = async () => {
        setLoading(true);
        try {
            const [uRes, rRes, cRes] = await Promise.all([
                rolesService.getUsuarios(),
                rolesService.getRoles(),
                clientsService.getAll().catch(() => ({ data: [] })),
            ]);
            setUsuarios(uRes.data);
            setRoles(rRes.data);
            setClientes(cRes.data ?? []);
        } catch { toast.error('Error al cargar usuarios'); }
        finally { setLoading(false); }
    };

    const handleSave = async (data) => {
        try {
            if (modal?.id) {
                await rolesService.actualizarUsuario(modal.id, data);
                toast.success('Usuario actualizado');
            } else {
                await rolesService.crearUsuario(data);
                toast.success('Usuario creado');
            }
            setModal(null);
            cargar();
        } catch (err) {
            toast.error(err.response?.data?.detail || 'Error al guardar');
            throw err;
        }
    };

    const toggleActivo = async (u) => {
        try {
            if (u.activo) {
                await rolesService.desactivarUsuario(u.id);
                toast.success('Usuario desactivado');
            } else {
                await rolesService.actualizarUsuario(u.id, { activo: true });
                toast.success('Usuario activado');
            }
            cargar();
        } catch (err) {
            toast.error(err.response?.data?.detail || 'Error');
        }
    };

    const eliminarDefinitivo = async (u) => {
        const ok = window.confirm(
            `¿Eliminar DEFINITIVAMENTE a ${u.nombre} (${u.email})?\n\n` +
            `Esta acción no se puede deshacer. Si el usuario tiene registros ` +
            `asociados (pedidos, gastos, etc.) la eliminación va a fallar y ` +
            `tendrás que desactivarlo en su lugar.`
        );
        if (!ok) return;
        try {
            await rolesService.eliminarUsuario(u.id);
            toast.success('Usuario eliminado');
            cargar();
        } catch (err) {
            toast.error(err.response?.data?.detail || 'No se pudo eliminar');
        }
    };

    if (!canVer) return (
        <div style={{ textAlign: 'center', padding: 60 }}>
            <Users size={40} style={{ color: 'var(--danger)', marginBottom: 16 }} />
            <h2>Sin acceso</h2>
            <p style={{ color: 'var(--text-muted)' }}>No tienes permiso para ver usuarios.</p>
        </div>
    );

    return (
        <div style={{ maxWidth: 900, margin: '0 auto' }}>
            <div className="page-header">
                <div>
                    <h1 style={{ display: 'flex', alignItems: 'center', gap: 10, margin: 0 }}>
                        <Users size={22} color="var(--brand)" />
                        Usuarios
                    </h1>
                    <p style={{ color: 'var(--text-muted)', fontSize: 13, marginTop: 4 }}>
                        {usuarios.length} usuario(s) registrados
                    </p>
                </div>
                <PermissionGate permission="usuarios.crear">
                    <button className="btn btn-primary" onClick={() => setModal({})}>
                        <Plus size={16} style={{ marginRight: 6 }} /> Nuevo Usuario
                    </button>
                </PermissionGate>
            </div>

            {loading ? (
                <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>Cargando…</div>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {usuarios.map(u => (
                        <div key={u.id} className="card" style={{
                            padding: '14px 18px', opacity: u.activo ? 1 : 0.55,
                            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                            gap: 16, flexWrap: 'wrap',
                        }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 14, minWidth: 0 }}>
                                {/* Avatar */}
                                <div style={{
                                    width: 38, height: 38, borderRadius: '50%', flexShrink: 0,
                                    background: u.activo ? 'var(--brand-muted)' : 'rgba(255,255,255,0.05)',
                                    border: `1px solid ${u.activo ? 'var(--border-brand)' : 'var(--border)'}`,
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    fontWeight: 800, fontSize: 15, color: u.activo ? 'var(--brand)' : 'var(--text-muted)',
                                }}>
                                    {u.nombre.charAt(0).toUpperCase()}
                                </div>
                                <div style={{ minWidth: 0 }}>
                                    <div style={{ fontWeight: 700, fontSize: 14 }}>{u.nombre}</div>
                                    <div style={{ fontSize: 12, color: 'var(--text-muted)', display: 'flex',
                                                  alignItems: 'center', gap: 6 }}>
                                        <Mail size={11} />
                                        {u.email}
                                    </div>
                                </div>
                            </div>

                            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
                                {/* Badge de rol */}
                                <span style={{
                                    fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 6,
                                    background: 'var(--brand-muted)', color: 'var(--brand)',
                                    border: '1px solid var(--border-brand)',
                                    display: 'flex', alignItems: 'center', gap: 5,
                                }}>
                                    <Shield size={10} />
                                    {u.rol_nombre || u.rol || 'Sin rol'}
                                </span>

                                {/* Badge inactivo */}
                                {!u.activo && (
                                    <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 8px',
                                                   borderRadius: 6, background: 'var(--danger-bg)',
                                                   color: 'var(--danger)' }}>
                                        Inactivo
                                    </span>
                                )}

                                <PermissionGate permission="usuarios.editar">
                                    <button className="btn btn-ghost btn-sm" onClick={() => setModal(u)} title="Editar">
                                        <Edit2 size={14} />
                                    </button>
                                </PermissionGate>

                                <PermissionGate permission="usuarios.eliminar">
                                    <button
                                        className={`btn btn-sm ${u.activo ? 'btn-danger' : 'btn-secondary'}`}
                                        onClick={() => toggleActivo(u)}
                                        title={u.activo ? 'Desactivar' : 'Activar'}>
                                        {u.activo ? <UserX size={14} /> : <UserCheck size={14} />}
                                    </button>
                                    <button
                                        className="btn btn-sm btn-ghost"
                                        onClick={() => eliminarDefinitivo(u)}
                                        title="Eliminar definitivamente"
                                        style={{ color: 'var(--danger)' }}>
                                        <Trash2 size={14} />
                                    </button>
                                </PermissionGate>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {modal !== null && (
                <UsuarioModal
                    usuario={modal?.id ? modal : null}
                    roles={roles}
                    clientes={clientes}
                    onClose={() => setModal(null)}
                    onSave={handleSave}
                />
            )}
        </div>
    );
}

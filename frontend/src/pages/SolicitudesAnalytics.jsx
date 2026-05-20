import { useEffect, useState } from 'react';
import { Inbox, CheckCircle, XCircle, Clock, Sparkles, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import api from '../services/api';
import { formatDateTime } from '../utils/formatters';

const ESTADO_META = {
    pendiente:  { label: 'Pendiente',  color: '#f59e0b', bg: 'rgba(245,158,11,0.10)', border: 'rgba(245,158,11,0.30)' },
    revisada:   { label: 'Revisada',   color: '#3b82f6', bg: 'rgba(59,130,246,0.10)', border: 'rgba(59,130,246,0.30)' },
    activada:   { label: 'Activada',   color: '#22c55e', bg: 'rgba(34,197,94,0.10)',  border: 'rgba(34,197,94,0.30)' },
    rechazada:  { label: 'Rechazada',  color: '#ef4444', bg: 'rgba(239,68,68,0.10)',  border: 'rgba(239,68,68,0.30)' },
};

const fmtDT = (s) => s ? formatDateTime(s) : '—';

export default function SolicitudesAnalytics() {
    const [solicitudes, setSolicitudes] = useState([]);
    const [filtro, setFiltro]           = useState('pendiente'); // pendiente | '' (todas)
    const [loading, setLoading]         = useState(true);
    const [procesando, setProcesando]   = useState(null); // id que está siendo actualizado

    const cargar = async () => {
        setLoading(true);
        try {
            const url = filtro ? `/clients/analytics/solicitudes?estado=${filtro}` : '/clients/analytics/solicitudes';
            const r = await api.get(url);
            setSolicitudes(r.data);
        } catch {
            toast.error('Error al cargar solicitudes');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { cargar(); }, [filtro]);

    const marcarComo = async (id, nuevoEstado, notas = null) => {
        setProcesando(id);
        try {
            await api.put(`/clients/analytics/solicitudes/${id}`, {
                estado: nuevoEstado,
                notas_admin: notas,
            });
            toast.success(`Solicitud marcada como ${nuevoEstado}`);
            cargar();
        } catch (e) {
            toast.error(e?.response?.data?.detail || 'Error al actualizar');
        } finally {
            setProcesando(null);
        }
    };

    const rechazar = (s) => {
        const motivo = prompt('Motivo del rechazo (opcional):');
        if (motivo === null) return; // cancelado
        marcarComo(s.id, 'rechazada', motivo || null);
    };

    return (
        <div className="container" style={{ maxWidth: 960, paddingTop: 24 }}>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24, flexWrap: 'wrap' }}>
                <div style={{
                    width: 40, height: 40, borderRadius: 10,
                    background: 'var(--brand-muted)', border: '1px solid var(--border-brand)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                    <Inbox size={20} color="var(--brand)" />
                </div>
                <div style={{ flex: 1 }}>
                    <h1 style={{ margin: 0, fontSize: '1.3rem', fontWeight: 800 }}>Solicitudes — Módulo Analítica</h1>
                    <p style={{ margin: 0, fontSize: 13, color: 'var(--text-secondary)' }}>
                        Clientes interesados en activar la suscripción premium
                    </p>
                </div>
                <button onClick={cargar} className="btn btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <RefreshCw size={14} />
                    Recargar
                </button>
            </div>

            {/* Filtros */}
            <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
                {[
                    { id: 'pendiente', label: 'Pendientes' },
                    { id: 'revisada',  label: 'Revisadas' },
                    { id: 'activada',  label: 'Activadas' },
                    { id: 'rechazada', label: 'Rechazadas' },
                    { id: '',          label: 'Todas' },
                ].map(f => {
                    const active = filtro === f.id;
                    return (
                        <button key={f.id || 'all'} onClick={() => setFiltro(f.id)} style={{
                            padding: '6px 14px', borderRadius: 999, border: '1px solid',
                            borderColor: active ? 'rgba(255,221,25,0.40)' : 'var(--border-default)',
                            background: active ? 'rgba(255,221,25,0.10)' : 'transparent',
                            color: active ? '#ffdd19' : 'var(--text-secondary)',
                            fontSize: 13, fontWeight: 600, cursor: 'pointer',
                        }}>
                            {f.label}
                        </button>
                    );
                })}
            </div>

            {loading ? (
                <div style={{ textAlign: 'center', padding: 64 }}><div className="spinner" /></div>
            ) : solicitudes.length === 0 ? (
                <div style={{
                    background: 'var(--bg-surface)', border: '1px solid var(--border-default)',
                    borderRadius: 12, padding: 48, textAlign: 'center', color: 'var(--text-secondary)',
                }}>
                    <Inbox size={40} style={{ opacity: 0.3, marginBottom: 10 }} />
                    <div style={{ fontSize: 14 }}>No hay solicitudes{filtro ? ` ${ESTADO_META[filtro]?.label.toLowerCase()}` : ''}.</div>
                </div>
            ) : (
                <div style={{ display: 'grid', gap: 10 }}>
                    {solicitudes.map(s => {
                        const meta = ESTADO_META[s.estado] || ESTADO_META.pendiente;
                        return (
                            <div key={s.id} style={{
                                background: 'var(--bg-surface)',
                                border: '1px solid var(--border-default)',
                                borderRadius: 12, padding: 16,
                                display: 'flex', flexDirection: 'column', gap: 10,
                            }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                                    <Sparkles size={16} style={{ color: '#ffdd19' }} />
                                    <div style={{ flex: 1, minWidth: 180 }}>
                                        <div style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: 15 }}>
                                            {s.cliente_nombre}
                                        </div>
                                        <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                                            {s.cliente_doc || '—'} · solicitud #{s.id}
                                        </div>
                                    </div>
                                    <div style={{
                                        padding: '4px 12px', borderRadius: 999,
                                        background: meta.bg, border: `1px solid ${meta.border}`,
                                        color: meta.color, fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em',
                                    }}>
                                        {meta.label}
                                    </div>
                                </div>

                                <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                                    Solicitada: <strong style={{ color: 'var(--text-primary)' }}>{fmtDT(s.fecha_solicitud)}</strong>
                                    {s.fecha_revision && <> · Revisada: {fmtDT(s.fecha_revision)}</>}
                                </div>

                                {s.mensaje && (
                                    <div style={{
                                        background: 'var(--bg-elevated)', padding: '8px 12px', borderRadius: 8,
                                        fontSize: 13, color: 'var(--text-primary)', fontStyle: 'italic',
                                    }}>
                                        "{s.mensaje}"
                                    </div>
                                )}

                                {s.notas_admin && (
                                    <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>
                                        <strong>Notas:</strong> {s.notas_admin}
                                    </div>
                                )}

                                {/* Acciones (solo si está pendiente o revisada) */}
                                {(s.estado === 'pendiente' || s.estado === 'revisada') && (
                                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 4 }}>
                                        <a href={`/clients`} className="btn btn-primary" style={{ fontSize: 13, padding: '7px 14px' }}>
                                            Ir a activar el cliente
                                        </a>
                                        {s.estado === 'pendiente' && (
                                            <button
                                                onClick={() => marcarComo(s.id, 'revisada')}
                                                disabled={procesando === s.id}
                                                className="btn btn-secondary"
                                                style={{ fontSize: 13, padding: '7px 14px', display: 'flex', alignItems: 'center', gap: 6 }}
                                            >
                                                <Clock size={13} /> Marcar revisada
                                            </button>
                                        )}
                                        <button
                                            onClick={() => marcarComo(s.id, 'activada')}
                                            disabled={procesando === s.id}
                                            className="btn btn-secondary"
                                            style={{ fontSize: 13, padding: '7px 14px', color: '#22c55e', display: 'flex', alignItems: 'center', gap: 6 }}
                                        >
                                            <CheckCircle size={13} /> Activada
                                        </button>
                                        <button
                                            onClick={() => rechazar(s)}
                                            disabled={procesando === s.id}
                                            className="btn btn-secondary"
                                            style={{ fontSize: 13, padding: '7px 14px', color: '#ef4444', display: 'flex', alignItems: 'center', gap: 6 }}
                                        >
                                            <XCircle size={13} /> Rechazar
                                        </button>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}

import { useEffect, useState } from 'react';
import { LineChart, TrendingUp, BarChart2, Sparkles, Lock, Calendar, ShoppingBag, CheckCircle, Clock } from 'lucide-react';
import { toast } from 'sonner';
import api from '../services/api';
import { formatDateTime } from '../utils/formatters';

/**
 * Paywall del módulo analítica.
 * Permite al cliente enviar UNA solicitud de activación; el admin la revisa
 * desde el panel "Solicitudes de Analítica".
 */
export default function AnalyticsPaywall() {
    const [solicitud, setSolicitud] = useState(null);   // { id, estado, fecha_solicitud, ... } o null
    const [loading, setLoading]     = useState(true);
    const [enviando, setEnviando]   = useState(false);

    useEffect(() => {
        api.get('/portal/analytics/mi-solicitud')
            .then(r => setSolicitud(r.data))
            .catch(() => setSolicitud(null))
            .finally(() => setLoading(false));
    }, []);

    const enviarSolicitud = async () => {
        setEnviando(true);
        try {
            const r = await api.post('/portal/analytics/solicitar', { mensaje: '' });
            setSolicitud({
                id:              r.data.id,
                estado:          r.data.estado,
                fecha_solicitud: r.data.fecha_solicitud,
            });
            if (r.data.ya_existia) {
                toast.info('Ya tienes una solicitud en revisión.');
            } else {
                toast.success('Solicitud enviada. El administrador la revisará pronto.');
            }
        } catch (e) {
            toast.error(e?.response?.data?.detail || 'No se pudo enviar la solicitud.');
        } finally {
            setEnviando(false);
        }
    };

    const beneficios = [
        { icon: BarChart2,   titulo: 'Dashboard analítico',    desc: 'Ventas diarias, semanales y mensuales con gráficas claras.' },
        { icon: Calendar,    titulo: 'Patrones por día',       desc: 'Descubre qué días compras más y planea mejor tu semana.' },
        { icon: ShoppingBag, titulo: 'Productos top',          desc: 'Los productos que más consumes — no te quedes sin stock.' },
        { icon: Sparkles,    titulo: 'Motor de recomendación', desc: 'Sugerencias para tu próximo pedido basadas en tu historial.' },
        { icon: TrendingUp,  titulo: 'Tendencias y alertas',   desc: 'Detecta cambios en tu consumo antes que afecten tu negocio.' },
    ];

    const solicitudPendiente = solicitud?.estado === 'pendiente' || solicitud?.estado === 'revisada';
    const solicitudRechazada = solicitud?.estado === 'rechazada';

    const fmtFecha = (s) => s ? formatDateTime(s) : '';

    return (
        <div style={{ maxWidth: 720, margin: '0 auto', padding: '24px 16px' }}>
            {/* Hero */}
            <div style={{
                background: 'linear-gradient(135deg, rgba(255,221,25,0.12) 0%, rgba(255,162,15,0.08) 100%)',
                border: '1px solid rgba(255,221,25,0.28)',
                borderRadius: 16, padding: 28, textAlign: 'center', marginBottom: 24,
            }}>
                <div style={{
                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                    width: 64, height: 64, borderRadius: 18,
                    background: 'rgba(255,221,25,0.15)', border: '1px solid rgba(255,221,25,0.35)',
                    marginBottom: 16,
                }}>
                    <LineChart size={30} style={{ color: '#ffdd19' }} />
                </div>
                <h2 style={{
                    fontFamily: 'var(--font-display, var(--font))',
                    fontSize: 26, margin: '0 0 8px', color: 'var(--text-primary)',
                }}>
                    Módulo Analítica
                </h2>
                <p style={{ color: 'var(--text-secondary)', margin: '0 0 16px', fontSize: 15, lineHeight: 1.6 }}>
                    Toma mejores decisiones con datos reales de tu negocio.
                    Visualiza tus compras, detecta patrones y recibe recomendaciones para tu próximo pedido.
                </p>
                <div style={{
                    display: 'inline-flex', alignItems: 'center', gap: 8,
                    background: 'rgba(255,255,255,0.05)',
                    border: '1px solid var(--border-default)',
                    borderRadius: 999, padding: '8px 16px',
                    fontSize: 13, color: 'var(--text-secondary)',
                }}>
                    <Lock size={14} />
                    <span>Módulo premium — actualmente no activo</span>
                </div>
            </div>

            {/* Beneficios */}
            <div style={{ display: 'grid', gap: 12, marginBottom: 24 }}>
                {beneficios.map((b, i) => (
                    <div key={i} style={{
                        display: 'flex', gap: 14, alignItems: 'flex-start',
                        background: 'var(--bg-surface)',
                        border: '1px solid var(--border-default)',
                        borderRadius: 12, padding: 16,
                    }}>
                        <div style={{
                            flexShrink: 0,
                            width: 40, height: 40, borderRadius: 10,
                            background: 'rgba(255,221,25,0.10)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}>
                            <b.icon size={20} style={{ color: '#ffdd19' }} />
                        </div>
                        <div>
                            <div style={{ fontWeight: 700, color: 'var(--text-primary)', marginBottom: 4 }}>
                                {b.titulo}
                            </div>
                            <div style={{ fontSize: 13.5, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                                {b.desc}
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {/* Precio y CTA */}
            <div style={{
                background: 'var(--bg-elevated)',
                border: '1px solid rgba(255,221,25,0.35)',
                borderRadius: 14, padding: 22, textAlign: 'center',
                boxShadow: '0 4px 20px rgba(255,221,25,0.08)',
            }}>
                <div style={{ fontSize: 13, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 }}>
                    Suscripción mensual
                </div>
                <div style={{
                    fontSize: 34, fontWeight: 800, color: '#ffdd19',
                    fontFamily: 'var(--font-display, var(--font))',
                    margin: '4px 0',
                }}>
                    $10.000 <span style={{ fontSize: 14, color: 'var(--text-secondary)', fontWeight: 500 }}>COP/mes</span>
                </div>
                <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 16 }}>
                    Renovación cada 30 días · Cancela cuando quieras
                </div>

                {loading ? (
                    <div className="spinner" style={{ margin: '0 auto' }} />
                ) : solicitudPendiente ? (
                    // Solicitud en revisión
                    <div style={{
                        background: 'rgba(59,130,246,0.10)',
                        border: '1px solid rgba(59,130,246,0.30)',
                        borderRadius: 10, padding: '14px 16px',
                        color: '#93c5fd',
                        display: 'flex', alignItems: 'center', gap: 12, justifyContent: 'center',
                    }}>
                        <Clock size={20} />
                        <div style={{ textAlign: 'left', fontSize: 13, lineHeight: 1.5 }}>
                            <div style={{ fontWeight: 700 }}>Solicitud en revisión</div>
                            <div style={{ fontSize: 12, opacity: 0.85 }}>
                                Enviada el {fmtFecha(solicitud.fecha_solicitud)}. El administrador te contactará pronto.
                            </div>
                        </div>
                    </div>
                ) : solicitudRechazada ? (
                    // Rechazada: permitir reintentar
                    <>
                        <div style={{
                            background: 'rgba(239,68,68,0.08)',
                            border: '1px solid rgba(239,68,68,0.25)',
                            borderRadius: 10, padding: '10px 14px', marginBottom: 10,
                            color: '#fca5a5', fontSize: 13,
                        }}>
                            Tu solicitud anterior fue rechazada
                            {solicitud.notas_admin ? <>: <em>{solicitud.notas_admin}</em></> : '.'}
                        </div>
                        <button onClick={enviarSolicitud} disabled={enviando} className="btn btn-primary"
                            style={{ width: '100%', padding: '12px 20px', fontSize: 15, fontWeight: 700 }}>
                            {enviando ? 'Enviando…' : 'Enviar nueva solicitud'}
                        </button>
                    </>
                ) : (
                    // Sin solicitud: botón principal
                    <button
                        onClick={enviarSolicitud}
                        disabled={enviando}
                        style={{
                            width: '100%', padding: '12px 20px',
                            background: '#ffdd19', color: '#151515',
                            border: 'none', borderRadius: 10,
                            fontWeight: 700, fontSize: 15, cursor: 'pointer',
                            boxShadow: '0 2px 10px rgba(255,221,25,0.30)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
                        }}
                    >
                        <CheckCircle size={18} />
                        {enviando ? 'Enviando…' : 'Enviar solicitud de activación'}
                    </button>
                )}

                <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 10 }}>
                    Un administrador revisará tu solicitud y te activará la suscripción tras confirmar el pago.
                </div>
            </div>
        </div>
    );
}

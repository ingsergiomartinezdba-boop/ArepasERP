import { useEffect, useRef, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { configService } from '../services/api';
import api from '../services/api';
import { toast } from 'sonner';
import { envColor, envName } from '../components/EnvIndicator';
import AnalyticsPaywall from '../components/AnalyticsPaywall';
import AnalyticsDashboard from '../components/AnalyticsDashboard';
import HistorialPedidos from '../components/HistorialPedidos';
import { Home, LineChart, FileText, BarChart2 } from 'lucide-react';
import { formatDate } from '../utils/formatters';

// ── Fecha helpers ─────────────────────────────────────────────
const todayBogota = () =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Bogota' }).format(new Date());

const tomorrowBogota = () => {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Bogota' }).format(d);
};

const fmtDateLabel = (s) => {
  if (!s) return '';
  const [y, m, d] = s.split('-');
  const meses = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];
  return `${d} ${meses[+m - 1]} ${y}`;
};

function minutosAhora() {
  const str = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'America/Bogota', hour: '2-digit', minute: '2-digit', hour12: false,
  }).format(new Date());
  const [h, m] = str.split(':').map(Number);
  return h * 60 + m;
}

const fmt = (n) => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(n ?? 0);
const fmtDate = (d) => d ? formatDate(d) : '-';


/* ── Patrón SVG decorativo ─────────────────────────────────── */
const BG_PATTERN = `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cellipse cx='30' cy='30' rx='18' ry='10' fill='none' stroke='%23ffdd19' stroke-width='0.6' stroke-opacity='0.07'/%3E%3Cellipse cx='30' cy='30' rx='10' ry='5' fill='none' stroke='%23ffdd19' stroke-width='0.5' stroke-opacity='0.05'/%3E%3C/svg%3E")`;

export default function PortalCliente() {
  const { user, logout, hasPermission } = useAuth();
  const [resumen, setResumen]         = useState(null);
  const [loading, setLoading]         = useState(true);
  const [verUltimoPedido, setVerUltimoPedido] = useState(false);
  const [modalFecha, setModalFecha]   = useState(null); // payload pendiente de confirmación
  const [tab, setTab]                 = useState('inicio');    // 'inicio' | 'analytics'
  const [subTab, setSubTab]           = useState('analitica'); // 'analitica' | 'reporte'
  const [analyticsStatus, setAnalyticsStatus] = useState(null);
  const hasAnalyticsPerm = hasPermission('portal.analytics');

  useEffect(() => {
    api.get('/portal/resumen')
      .then(r => setResumen(r.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  // Cargar status de suscripción analítica (solo si tiene permiso)
  useEffect(() => {
    if (!hasAnalyticsPerm) return;
    api.get('/portal/analytics/status')
      .then(r => setAnalyticsStatus(r.data))
      .catch(() => setAnalyticsStatus(null));
  }, [hasAnalyticsPerm]);

  const recargar = async () => {
    try {
      const r = await api.get('/portal/resumen');
      setResumen(r.data);
    } catch {}
  };

  if (loading) {
    return (
      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        justifyContent: 'center', height: '100vh',
        background: '#0e0e0e',
      }}>
        <img src="/logo-betania.jpeg" alt="Betania"
             style={{ width: 72, height: 72, borderRadius: 16, marginBottom: 20, opacity: 0.9 }} />
        <div className="spinner" />
      </div>
    );
  }

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      background: '#0e0e0e',
      color: '#ffffff',
      fontFamily: 'var(--font)',
      overflowY: 'auto',
      overflowX: 'hidden',
    }}>

      {/* ── Marca de agua: logo centrado ─────────────────────── */}
      <div style={{
        position: 'fixed',
        inset: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        pointerEvents: 'none',
        zIndex: 0,
      }}>
        <img src="/logo-betania.jpeg" alt=""
             style={{
               width: 520,
               height: 520,
               borderRadius: '50%',
               objectFit: 'cover',
               opacity: 0.04,
               filter: 'grayscale(100%) brightness(2)',
               transform: 'scale(1)',
             }} />
      </div>

      {/* ── Patrón de arepas (fondo sutil) ───────────────────── */}
      <div style={{
        position: 'fixed',
        inset: 0,
        backgroundImage: BG_PATTERN,
        backgroundSize: '60px 60px',
        pointerEvents: 'none',
        zIndex: 0,
      }} />

      {/* ── Glow decorativo amarillo arriba-izquierda ─────────── */}
      <div style={{
        position: 'fixed',
        top: -180,
        left: -180,
        width: 500,
        height: 500,
        borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(255,221,25,0.10) 0%, transparent 70%)',
        pointerEvents: 'none',
        zIndex: 0,
      }} />

      {/* ── Glow naranja abajo-derecha ────────────────────────── */}
      <div style={{
        position: 'fixed',
        bottom: -200,
        right: -200,
        width: 600,
        height: 600,
        borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(255,162,15,0.08) 0%, transparent 70%)',
        pointerEvents: 'none',
        zIndex: 0,
      }} />

      {/* ════════════════════════════════════════════════════════
          HEADER
      ════════════════════════════════════════════════════════ */}
      <header style={{
        position: 'sticky',
        top: 0,
        zIndex: 100,
        background: 'rgba(14,14,14,0.85)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        borderBottom: '1px solid rgba(255,221,25,0.12)',
      }}>
        {/* Línea de acento amarilla arriba */}
        <div style={{ height: 3, background: 'linear-gradient(90deg, #ffdd19 0%, #ffa20f 50%, transparent 100%)' }} />

        <div style={{
          maxWidth: 960,
          margin: '0 auto',
          padding: '14px 24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}>
          {/* Logo + nombre */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{ position: 'relative' }}>
              <img src="/logo-betania.jpeg" alt="Betania"
                   style={{
                     width: 44, height: 44, borderRadius: 12,
                     objectFit: 'cover',
                     border: '2px solid rgba(255,221,25,0.4)',
                     boxShadow: '0 0 16px rgba(255,221,25,0.20)',
                   }} />
            </div>
            <div>
              <div style={{
                fontFamily: 'var(--font-display)',
                fontSize: 18,
                fontWeight: 800,
                color: '#ffdd19',
                letterSpacing: '0.02em',
                lineHeight: 1.1,
              }}>
                Arepas Betania
              </div>
              <div style={{
                fontSize: 11,
                color: 'rgba(255,221,25,0.55)',
                letterSpacing: '0.12em',
                textTransform: 'uppercase',
                fontWeight: 600,
              }}>
                Portal Cliente
              </div>
            </div>
          </div>

          {/* Usuario + cerrar sesión */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{ textAlign: 'right' }} title={`Ambiente: ${envName}`}>
              <div style={{ fontSize: 13, fontWeight: 600 }}>
                <span style={{ color: envColor, fontWeight: 700 }}>Bienvenido</span>
                , <span style={{ color: '#ffffff' }}>{user?.nombre}</span>
              </div>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>Cliente</div>
            </div>
            <button onClick={logout} style={{
              background: 'rgba(255,255,255,0.06)',
              border: '1px solid rgba(255,255,255,0.12)',
              borderRadius: 10,
              color: 'rgba(255,255,255,0.6)',
              padding: '7px 16px',
              cursor: 'pointer',
              fontSize: 12,
              fontWeight: 600,
              transition: 'all 0.15s',
            }}
              onMouseEnter={e => { e.target.style.background = 'rgba(255,221,25,0.10)'; e.target.style.color = '#ffdd19'; e.target.style.borderColor = 'rgba(255,221,25,0.3)'; }}
              onMouseLeave={e => { e.target.style.background = 'rgba(255,255,255,0.06)'; e.target.style.color = 'rgba(255,255,255,0.6)'; e.target.style.borderColor = 'rgba(255,255,255,0.12)'; }}
            >
              Cerrar sesión
            </button>
          </div>
        </div>
      </header>

      {/* ════════════════════════════════════════════════════════
          HERO — bienvenida personalizada
      ════════════════════════════════════════════════════════ */}
      <div style={{
        position: 'relative',
        zIndex: 1,
        background: 'linear-gradient(180deg, rgba(255,221,25,0.06) 0%, transparent 100%)',
        borderBottom: '1px solid rgba(255,221,25,0.08)',
        padding: '28px 24px 24px',
        textAlign: 'center',
      }}>
        <p style={{
          margin: 0,
          fontSize: 14,
          color: '#22c55e',
          fontWeight: 700,
          letterSpacing: '0.02em',
        }}>
          Consulta tus pedidos y estado de cuenta
        </p>
      </div>

      {/* ════════════════════════════════════════════════════════
          CONTENIDO PRINCIPAL
      ════════════════════════════════════════════════════════ */}
      <main style={{ position: 'relative', zIndex: 1, maxWidth: 960, margin: '0 auto', padding: '28px 16px 48px' }}>

        {/* ── Tabs (solo si el cliente tiene permiso de analítica) ── */}
        {hasAnalyticsPerm && (
          <div style={{
            display: 'flex', gap: 6, marginBottom: 20,
            background: 'rgba(255,255,255,0.03)',
            border: '1px solid rgba(255,255,255,0.06)',
            borderRadius: 12, padding: 4,
          }}>
            {[
              { id: 'inicio',    label: 'Inicio',               Icon: Home },
              { id: 'analytics', label: 'Reporte y Analítica',  Icon: LineChart },
            ].map(t => {
              const active = tab === t.id;
              return (
                <button key={t.id} onClick={() => setTab(t.id)} style={{
                  flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                  padding: '10px 14px', borderRadius: 8, border: 'none', cursor: 'pointer',
                  background: active ? 'rgba(255,221,25,0.10)' : 'transparent',
                  color: active ? '#ffdd19' : 'rgba(255,255,255,0.55)',
                  fontWeight: active ? 700 : 600, fontSize: 13,
                  transition: 'all 0.15s',
                }}>
                  <t.Icon size={15} />
                  {t.label}
                  {t.id === 'analytics' && analyticsStatus && !analyticsStatus.activa && (
                    <span style={{
                      fontSize: 9, padding: '2px 6px', borderRadius: 10,
                      background: 'rgba(255,162,15,0.18)', color: '#ffa20f',
                      fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em',
                    }}>Premium</span>
                  )}
                </button>
              );
            })}
          </div>
        )}

        {/* ── TAB: REPORTE Y ANALÍTICA ─────────────────────── */}
        {tab === 'analytics' && (
          !analyticsStatus?.activa
            ? <AnalyticsPaywall />
            : (
              <>
                {/* Sub-menú */}
                <div style={{
                  display: 'flex', gap: 6, marginBottom: 18,
                  background: 'rgba(255,255,255,0.02)',
                  border: '1px solid rgba(255,255,255,0.05)',
                  borderRadius: 10, padding: 3,
                }}>
                  {[
                    { id: 'analitica', label: 'Analítica', Icon: BarChart2 },
                    { id: 'reporte',   label: 'Reporte',   Icon: FileText },
                  ].map(s => {
                    const active = subTab === s.id;
                    return (
                      <button key={s.id} onClick={() => setSubTab(s.id)} style={{
                        flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                        padding: '8px 12px', borderRadius: 7, border: 'none', cursor: 'pointer',
                        background: active ? 'rgba(255,221,25,0.10)' : 'transparent',
                        color: active ? '#ffdd19' : 'rgba(255,255,255,0.5)',
                        fontWeight: active ? 700 : 600, fontSize: 12.5,
                        letterSpacing: '0.02em',
                      }}>
                        <s.Icon size={14} />
                        {s.label}
                      </button>
                    );
                  })}
                </div>

                {subTab === 'analitica' && <AnalyticsDashboard status={analyticsStatus} />}
                {subTab === 'reporte'   && <HistorialPedidos />}
              </>
            )
        )}

        {/* ── TAB: INICIO (contenido por defecto) ─────────── */}
        {tab === 'inicio' && (
        <>
        {/* Stat cards */}
        {resumen && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 14, marginBottom: 24 }}>
            <StatCard label="Pedidos" value={resumen.total_pedidos} isNumber />
            <StatCard label="Valor total" value={fmt(resumen.valor_total)} />
            <StatCard label="Total pagado" value={fmt(resumen.total_pagado)} accent="#10b981" />
            <StatCard
              label="Por pagar"
              value={fmt(resumen.saldo_pendiente)}
              accent={resumen.saldo_pendiente > 0 ? '#f59e0b' : '#10b981'}
              highlight={resumen.saldo_pendiente > 0}
            />
          </div>
        )}

        {/* Último pedido + Último pago */}
        {resumen && (resumen.ultimo_pedido || resumen.ultimo_pago) && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 12, marginBottom: 24 }}>

            {resumen.ultimo_pedido && (() => {
              const ESTADOS = {
                pendiente:  { label: 'Pendiente',  color: '#f59e0b' },
                por_cobrar: { label: 'Por pagar',  color: '#3b82f6' },
                pagado:     { label: 'Pagado',     color: '#10b981' },
                cancelado:  { label: 'Cancelado',  color: '#ef4444' },
              };
              const up = resumen.ultimo_pedido;
              const est = ESTADOS[up.estado] ?? { label: up.estado, color: 'rgba(255,255,255,0.4)' };
              return (
                <div style={{
                  background: 'rgba(255,255,255,0.03)',
                  border: `1px solid ${verUltimoPedido ? 'rgba(255,221,25,0.2)' : 'rgba(255,255,255,0.08)'}`,
                  borderRadius: 12, overflow: 'hidden', transition: 'border-color 0.2s',
                }}>
                  {/* Cabecera clicable */}
                  <button onClick={() => setVerUltimoPedido(v => !v)} style={{
                    width: '100%', background: 'transparent', border: 'none', cursor: 'pointer',
                    padding: '12px 20px', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', textAlign: 'left',
                  }}>
                    <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.35)' }}>
                      Último pedido
                    </span>
                    <span style={{ fontWeight: 800, fontSize: 15, color: '#fff' }}>#{up.id}</span>
                    <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)' }}>{fmtDate(up.fecha)}</span>
                    <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 10px', borderRadius: 20, background: est.color + '22', color: est.color }}>
                      {est.label}
                    </span>
                    <span style={{ marginLeft: 'auto', fontWeight: 800, fontSize: 15, color: '#fff' }}>{fmt(up.total)}</span>
                    {up.saldo > 0 && (
                      <span style={{ fontSize: 12, fontWeight: 700, color: '#f59e0b' }}>Por pagar {fmt(up.saldo)}</span>
                    )}
                    <span style={{ fontSize: 14, color: 'rgba(255,221,25,0.6)', transform: verUltimoPedido ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}>▾</span>
                  </button>

                  {/* Detalle desplegable */}
                  {verUltimoPedido && up.items?.length > 0 && (
                    <div style={{ padding: '0 20px 16px', borderTop: '1px solid rgba(255,255,255,0.05)', background: 'rgba(255,255,255,0.015)' }}>
                      <table style={{ width: '100%', marginTop: 14, fontSize: 13, borderCollapse: 'collapse' }}>
                        <thead>
                          <tr>
                            {['Producto', 'Cant.', 'Precio', 'Subtotal'].map(h => (
                              <th key={h} style={{
                                textAlign: 'left', padding: '5px 8px',
                                color: 'rgba(255,221,25,0.55)', fontWeight: 700,
                                fontSize: 11, letterSpacing: '0.06em', textTransform: 'uppercase',
                                borderBottom: '1px solid rgba(255,255,255,0.06)',
                              }}>{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {up.items.map((it, i) => (
                            <tr key={i} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                              <td style={{ padding: '7px 8px', color: 'rgba(255,255,255,0.85)' }}>{it.nombre}</td>
                              <td style={{ padding: '7px 8px', color: 'rgba(255,255,255,0.55)' }}>{it.cantidad}</td>
                              <td style={{ padding: '7px 8px', color: 'rgba(255,255,255,0.55)' }}>{fmt(it.precio)}</td>
                              <td style={{ padding: '7px 8px', fontWeight: 700, color: '#fff' }}>{fmt(it.subtotal)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              );
            })()}

            {resumen.ultimo_pago && (
              <div style={{
                background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,221,25,0.12)',
                borderRadius: 12, padding: '12px 20px', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap',
              }}>
                <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'rgba(255,221,25,0.6)' }}>
                  Último pago
                </span>
                <span style={{ fontWeight: 800, fontSize: 16, color: '#ffdd19' }}>{fmt(resumen.ultimo_pago.monto)}</span>
                <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)' }}>{fmtDate(resumen.ultimo_pago.fecha)}</span>
                {resumen.ultimo_pago.medio && (
                  <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 10px', borderRadius: 20, background: 'rgba(255,221,25,0.10)', color: '#ffdd19' }}>
                    {resumen.ultimo_pago.medio}
                  </span>
                )}
              </div>
            )}

          </div>
        )}

        {/* ── NUEVO PEDIDO ────────────────────────────────────── */}
        <NuevoPedidoForm
          tarifaDomicilio={resumen?.tarifa_domicilio ?? 0}
          onModalFecha={(payload) => setModalFecha(payload)}
        />

        {/* Modal de fecha */}
        {modalFecha && (
          <ModalFecha
            total={modalFecha.total}
            onConfirm={async (fecha) => {
              await api.post('/portal/nuevo-pedido', { ...modalFecha.body, fecha });
              modalFecha.resetForm?.();
              setModalFecha(null);
              recargar();
              toast.success('¡Pedido enviado con éxito!');
            }}
            onCancel={() => setModalFecha(null)}
          />
        )}
        </>
        )}
      </main>

      {/* ── Footer con marca ─────────────────────────────────── */}
      <footer style={{
        position: 'relative', zIndex: 1,
        textAlign: 'center', padding: '20px 24px',
        borderTop: '1px solid rgba(255,255,255,0.05)',
        color: 'rgba(255,255,255,0.2)',
        fontSize: 12,
      }}>
        <span style={{ color: 'rgba(255,221,25,0.4)', fontFamily: 'var(--font-display)', fontWeight: 700 }}>
          Arepas Betania
        </span>
        {' '}· Portal exclusivo para clientes
      </footer>
    </div>
  );
}

/* ── Componentes internos ──────────────────────────────────── */

function StatCard({ label, value, isNumber, accent, highlight }) {
  return (
    <div style={{
      background: highlight
        ? 'rgba(245,158,11,0.07)'
        : 'rgba(255,255,255,0.03)',
      border: highlight
        ? '1px solid rgba(245,158,11,0.22)'
        : '1px solid rgba(255,255,255,0.07)',
      borderRadius: 14,
      padding: '18px 20px',
      transition: 'border-color 0.2s',
    }}>
      <div style={{
        fontSize: 11, fontWeight: 700, letterSpacing: '0.1em',
        textTransform: 'uppercase',
        color: 'rgba(255,255,255,0.35)',
        marginBottom: 8,
      }}>
        {label}
      </div>
      <div style={{
        fontSize: isNumber ? 32 : 18,
        fontWeight: 800,
        color: accent ?? '#ffffff',
        fontFamily: isNumber ? 'var(--font-display)' : 'var(--font)',
        lineHeight: 1,
      }}>
        {value}
      </div>
    </div>
  );
}

/* ── Formulario Nuevo Pedido ──────────────────────────────── */
function NuevoPedidoForm({ onModalFecha, tarifaDomicilio = 0 }) {
  const [productos, setProductos] = useState([]);
  const [cantidades, setCantidades] = useState({});   // { producto_id: cantidad }
  const [busqueda, setBusqueda]   = useState('');
  const [obs, setObs]             = useState('');
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState('');

  useEffect(() => {
    api.get('/portal/productos')
      .then(r => setProductos(r.data))
      .catch(() => setError('No se pudieron cargar los productos.'))
      .finally(() => setLoading(false));
  }, []);

  const setCantidad = (id, val) => {
    const n = parseInt(val, 10);
    setCantidades(prev => ({ ...prev, [id]: isNaN(n) || n < 0 ? 0 : n }));
  };

  const productosFiltrados = productos.filter(p =>
    p.nombre.toLowerCase().includes(busqueda.toLowerCase())
  );

  const totalProductos = productos.reduce((s, p) => s + (cantidades[p.id] || 0) * p.precio, 0);
  const totalFinal     = totalProductos + (tarifaDomicilio || 0);
  const unidadesTotales = Object.values(cantidades).reduce((s, q) => s + (q || 0), 0);
  const itemsSeleccionados = Object.values(cantidades).filter(q => q > 0).length;

  const resetForm = () => {
    setCantidades({});
    setBusqueda('');
    setObs('');
    setError('');
  };

  const handleConfirmar = () => {
    const items = productos
      .filter(p => (cantidades[p.id] || 0) > 0)
      .map(p => ({ producto_id: p.id, cantidad: cantidades[p.id] }));
    if (items.length === 0) { setError('Agrega al menos un producto.'); return; }
    setError('');
    onModalFecha({
      total: totalFinal,
      resetForm,
      body: {
        items,
        observaciones:   obs || null,
        valor_domicilio: tarifaDomicilio || 0,
      },
    });
  };

  if (loading) return (
    <div style={{ textAlign: 'center', padding: 48 }}>
      <div className="spinner" />
    </div>
  );

  return (
    <div style={{ paddingBottom: unidadesTotales > 0 ? 80 : 0 }}>

      {/* Buscador */}
      <div style={{ position: 'relative', marginBottom: 16 }}>
        <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', fontSize: 16, opacity: 0.4 }}>🔍</span>
        <input
          value={busqueda}
          onChange={e => setBusqueda(e.target.value)}
          placeholder="Buscar producto…"
          style={{
            width: '100%', padding: '10px 14px 10px 38px', borderRadius: 10, boxSizing: 'border-box',
            background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)',
            color: '#fff', fontSize: 14,
          }}
        />
        {busqueda && (
          <button onClick={() => setBusqueda('')} style={{
            position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
            background: 'none', border: 'none', color: 'rgba(255,255,255,0.4)', cursor: 'pointer', fontSize: 18,
          }}>×</button>
        )}
      </div>

      {error && <div style={{ color: '#ef4444', fontSize: 13, marginBottom: 12 }}>{error}</div>}

      {/* Grid de productos */}
      {productosFiltrados.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '40px 0', color: 'rgba(255,255,255,0.3)' }}>
          <div style={{ fontSize: 36, marginBottom: 8 }}>🫓</div>
          <div>No se encontraron productos</div>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 10 }}>
          {productosFiltrados.map(p => {
            const qty    = cantidades[p.id] || 0;
            const activo = qty > 0;
            return (
              <div key={p.id} style={{
                background: activo ? 'rgba(255,221,25,0.08)' : 'rgba(255,255,255,0.03)',
                border: `${activo ? '2px' : '1px'} solid ${activo ? 'rgba(255,221,25,0.65)' : 'rgba(255,255,255,0.09)'}`,
                borderRadius: 14, padding: '13px 12px 11px',
                display: 'flex', flexDirection: 'column', gap: 9,
                transition: 'all 0.15s', position: 'relative',
              }}>
                {/* Badge cantidad */}
                {activo && (
                  <div style={{
                    position: 'absolute', top: -9, right: -9,
                    width: 22, height: 22, borderRadius: '50%',
                    background: '#ffdd19', color: '#151515',
                    fontSize: 11, fontWeight: 900,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    boxShadow: '0 2px 6px rgba(255,221,25,0.5)',
                  }}>{qty}</div>
                )}

                {/* Nombre */}
                <span style={{ fontWeight: 800, fontSize: 13, lineHeight: 1.25, color: activo ? '#ffdd19' : '#fff' }}>
                  {p.nombre}
                </span>

                {/* Precio */}
                <span style={{ fontSize: 13, fontWeight: 700, color: activo ? 'rgba(255,221,25,0.7)' : 'rgba(255,255,255,0.45)' }}>
                  {fmt(p.precio)}
                </span>

                {/* Selector cantidad */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                  <button onClick={() => setCantidad(p.id, qty - 1)} style={{
                    width: 28, height: 28, borderRadius: 7, flexShrink: 0,
                    border: `1px solid ${activo ? 'rgba(255,221,25,0.4)' : 'rgba(255,255,255,0.12)'}`,
                    background: activo ? 'rgba(255,221,25,0.12)' : 'rgba(255,255,255,0.05)',
                    color: activo ? '#ffdd19' : 'rgba(255,255,255,0.5)',
                    cursor: 'pointer', fontSize: 18, fontWeight: 800,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>−</button>
                  <input
                    type="number" min="0"
                    value={qty || ''}
                    placeholder="0"
                    onChange={e => setCantidad(p.id, e.target.value)}
                    style={{
                      flex: 1, textAlign: 'center', height: 28,
                      background: activo ? 'rgba(255,221,25,0.10)' : 'rgba(255,255,255,0.05)',
                      border: `1px solid ${activo ? 'rgba(255,221,25,0.45)' : 'rgba(255,255,255,0.12)'}`,
                      borderRadius: 7, fontSize: 15, fontWeight: 900,
                      color: activo ? '#ffdd19' : '#fff', outline: 'none',
                    }}
                  />
                  <button onClick={() => setCantidad(p.id, qty + 1)} style={{
                    width: 28, height: 28, borderRadius: 7, flexShrink: 0,
                    border: `1px solid ${activo ? 'rgba(255,221,25,0.4)' : 'rgba(255,255,255,0.12)'}`,
                    background: activo ? 'rgba(255,221,25,0.12)' : 'rgba(255,255,255,0.05)',
                    color: activo ? '#ffdd19' : 'rgba(255,255,255,0.5)',
                    cursor: 'pointer', fontSize: 18, fontWeight: 800,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>+</button>
                </div>

                {/* Subtotal */}
                {activo && (
                  <div style={{
                    textAlign: 'right', fontSize: 12, fontWeight: 800, color: '#ffdd19',
                    borderTop: '1px solid rgba(255,221,25,0.2)', paddingTop: 7,
                  }}>
                    {fmt(qty * p.precio)}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Extras: domicilio (solo lectura) + observaciones */}
      {unidadesTotales > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: tarifaDomicilio > 0 ? '1fr 1fr' : '1fr', gap: 12, marginTop: 20 }}>
          {tarifaDomicilio > 0 && (
            <div>
              <label style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'rgba(255,255,255,0.4)', display: 'block', marginBottom: 6 }}>
                Domicilio
              </label>
              <div style={{ padding: '10px 14px', borderRadius: 10, background: 'rgba(255,221,25,0.08)', border: '1px solid rgba(255,221,25,0.25)', color: '#ffdd19', fontSize: 14, fontWeight: 800 }}>
                {fmt(tarifaDomicilio)}
              </div>
            </div>
          )}
          <div>
            <label style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'rgba(255,255,255,0.4)', display: 'block', marginBottom: 6 }}>
              Observaciones
            </label>
            <input value={obs} onChange={e => setObs(e.target.value)} placeholder="Notas adicionales…"
              style={{ width: '100%', padding: '10px 14px', borderRadius: 10, boxSizing: 'border-box', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', color: '#fff', fontSize: 14 }} />
          </div>
        </div>
      )}

      {/* Barra sticky de total */}
      {unidadesTotales > 0 && (
        <div style={{
          position: 'sticky', bottom: 0, marginTop: 20,
          background: '#ffdd19', borderRadius: '16px 16px 0 0',
          padding: '12px 16px',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          boxShadow: '0 -4px 24px rgba(255,221,25,0.35)', gap: 12,
        }}>
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'rgba(21,21,21,0.6)', marginBottom: 1 }}>
              {unidadesTotales} uds · {itemsSeleccionados} producto{itemsSeleccionados !== 1 ? 's' : ''}
            </div>
            <div style={{ fontSize: 22, fontWeight: 900, color: '#151515', lineHeight: 1 }}>{fmt(totalFinal)}</div>
          </div>
          <button onClick={handleConfirmar} style={{
            padding: '10px 20px', fontSize: 14, fontWeight: 800, borderRadius: 11,
            background: '#000', color: '#ffdd19', border: 'none', cursor: 'pointer',
            display: 'flex', alignItems: 'center', gap: 7,
            boxShadow: '0 2px 10px rgba(0,0,0,0.25)', whiteSpace: 'nowrap',
          }}>
            Confirmar Pedido →
          </button>
        </div>
      )}
    </div>
  );
}

/* ── Modal selección de fecha ─────────────────────────────── */
function ModalFecha({ total, onConfirm, onCancel }) {
  const hoy    = todayBogota();
  const manana = tomorrowBogota();
  const [modo, setModo]         = useState(null);
  const [custom, setCustom]     = useState(hoy);
  const [hoyDis, setHoyDis]     = useState(false);
  const [enviando, setEnviando] = useState(false);
  const datePickerRef = useRef();

  useEffect(() => {
    configService.getHorarioCorte().then(r => {
      const [hh, mm] = r.data.hora.split(':').map(Number);
      const pasoCutoff = minutosAhora() >= hh * 60 + mm;
      setHoyDis(pasoCutoff);
      setModo(pasoCutoff ? 'manana' : 'hoy');
    }).catch(() => setModo('hoy'));
  }, []);

  if (!modo) return null;

  const fecha = modo === 'hoy' ? hoy : modo === 'manana' ? manana : custom;

  const OPTS = [
    { key: 'hoy',    label: 'Hoy',        sub: hoyDis ? 'Fuera de horario' : fmtDateLabel(hoy),    color: '#10b981', disabled: hoyDis },
    { key: 'manana', label: 'Mañana',      sub: fmtDateLabel(manana),                               color: '#ffdd19' },
    { key: 'custom', label: 'Otra fecha',  sub: modo === 'custom' ? fmtDateLabel(custom) : 'Elegir…', color: '#8b5cf6' },
  ];

  const confirmar = async () => {
    setEnviando(true);
    try { await onConfirm(fecha); }
    finally { setEnviando(false); }
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 200,
      background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(6px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
    }} onClick={onCancel}>
      <div style={{
        background: '#151515', border: '1px solid rgba(255,221,25,0.2)',
        borderRadius: 18, padding: 28, maxWidth: 380, width: '100%',
        boxShadow: '0 20px 60px rgba(0,0,0,0.6)',
      }} onClick={e => e.stopPropagation()}>
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontWeight: 800, fontSize: 17, marginBottom: 4 }}>¿Para cuándo es el pedido?</div>
          <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)' }}>
            Total: <strong style={{ color: '#ffdd19' }}>{fmt(total)}</strong>
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 20 }}>
          {OPTS.map(({ key, label, sub, color, disabled }) => {
            const activo = modo === key;
            return (
              <button key={key} onClick={() => !disabled && setModo(key)} disabled={disabled}
                style={{
                  display: 'flex', alignItems: 'center', gap: 14, padding: '12px 16px',
                  borderRadius: 12, cursor: disabled ? 'not-allowed' : 'pointer',
                  border: `2px solid ${activo ? color : 'rgba(255,255,255,0.1)'}`,
                  background: disabled ? 'rgba(255,255,255,0.02)' : activo ? `${color}18` : 'rgba(255,255,255,0.04)',
                  opacity: disabled ? 0.4 : 1, textAlign: 'left', width: '100%',
                }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700, fontSize: 14, color: activo ? color : '#fff' }}>{label}</div>
                  <div style={{ fontSize: 12, color: activo ? color : 'rgba(255,255,255,0.4)', opacity: 0.8 }}>{sub}</div>
                </div>
                {activo && <div style={{ width: 18, height: 18, borderRadius: '50%', background: color, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <svg width="10" height="8" viewBox="0 0 10 8"><path d="M1 4l2.5 2.5L9 1" stroke="#151515" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                </div>}
              </button>
            );
          })}
          {modo === 'custom' && (
            <div style={{ position: 'relative', display: 'inline-block', width: '100%' }}>
              <button type="button"
                onClick={() => { try { datePickerRef.current?.showPicker(); } catch { datePickerRef.current?.click(); } }}
                style={{
                  width: '100%', padding: '11px 14px', borderRadius: 10, textAlign: 'left',
                  border: '1px solid rgba(255,221,25,0.3)', background: 'rgba(255,255,255,0.06)',
                  color: '#fff', fontSize: 15, fontWeight: 600, cursor: 'pointer',
                }}>
                {(() => { const [y,m,d] = custom.split('-'); return `${d}/${m}/${y}`; })()}
              </button>
              <input ref={datePickerRef} type="date" value={custom} min={hoy}
                onChange={e => setCustom(e.target.value)}
                style={{ position: 'absolute', opacity: 0, pointerEvents: 'none', width: 0, height: 0, top: 0, left: 0 }}
              />
            </div>
          )}
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={onCancel} style={{
            flex: 1, padding: '11px 0', borderRadius: 10, border: '1px solid rgba(255,255,255,0.12)',
            background: 'transparent', color: 'rgba(255,255,255,0.5)', cursor: 'pointer', fontWeight: 600,
          }}>Cancelar</button>
          <button onClick={confirmar} disabled={enviando} style={{
            flex: 2, padding: '11px 0', borderRadius: 10, border: 'none',
            background: '#ffdd19', color: '#151515', cursor: 'pointer', fontWeight: 800, fontSize: 15,
          }}>{enviando ? 'Enviando…' : 'Confirmar'}</button>
        </div>
      </div>
    </div>
  );
}

function SectionTitle({ children }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14,
    }}>
      <div style={{ width: 3, height: 16, borderRadius: 2, background: '#ffdd19', flexShrink: 0 }} />
      <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: 'rgba(255,255,255,0.8)', letterSpacing: '0.04em' }}>
        {children}
      </h3>
    </div>
  );
}

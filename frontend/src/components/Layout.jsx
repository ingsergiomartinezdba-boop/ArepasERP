import { useState, useEffect, useRef } from 'react';
import {
    Home, PlusCircle, Users, BarChart2, Package, List, Settings,
    Truck, CreditCard, FileText, ArrowRightLeft, ShoppingCart,
    TrendingUp, Wallet, LogOut, FlaskConical, Layers, LineChart,
    DollarSign, Menu, X, Shield, UserCog, Inbox, Sparkles, Sliders,
    PiggyBank,
} from 'lucide-react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import NavSection from './NavSection';
import { envColor, envName } from './EnvIndicator';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import { toast } from 'sonner';

const NAV_SECTIONS = [
    {
        title: 'PEDIDOS',
        icon: ShoppingCart,
        defaultOpen: true,
        items: [
            { to: '/orders',        icon: List,       label: 'Pedidos del Día',     end: true, permission: 'pedidos.ver' },
            { to: '/orders/new',    icon: PlusCircle, label: 'Nuevo Pedido',                   permission: 'pedidos.crear' },
            { to: '/orders/report', icon: FileText,   label: 'Reporte',                        permission: 'reportes.ver' },
            { to: '/orders/cuentas-por-cobrar', icon: DollarSign, label: 'Cuentas por Cobrar', permission: 'cobros.ver' },
        ],
    },
    {
        title: 'PRODUCCIÓN',
        icon: FlaskConical,
        defaultOpen: true,
        items: [
            { to: '/production', icon: FlaskConical, label: 'Producción',  end: true, permission: 'produccion.ver' },
            { to: '/costeo',     icon: TrendingUp,   label: 'Costeo',      end: true, permission: 'costeo.ver' },
            { to: '/inventory',  icon: Layers,       label: 'Inventario',  end: true, permission: 'inventario.ver' },
        ],
    },
    {
        title: 'GASTOS',
        icon: TrendingUp,
        defaultOpen: true,
        items: [
            { to: '/expenses/new',              icon: PlusCircle, label: 'Nuevo Gasto',       permission: 'gastos.crear' },
            { to: '/expenses',                  icon: BarChart2,  label: 'Reporte',          end: true, permission: 'gastos.ver' },
            { to: '/expenses/cuentas-por-pagar', icon: DollarSign, label: 'Cuentas por Pagar', permission: 'gastos.ver' },
        ],
    },
    {
        title: 'CAJA',
        icon: Wallet,
        defaultOpen: true,
        items: [
            { to: '/cash-flow', icon: PiggyBank,      label: 'Flujo de Caja',           permission: 'cash_flow.ver' },
            { to: '/cash-flow/movimientos-por-medio', icon: CreditCard, label: 'Movimientos por Medio', permission: 'cash_flow.ver' },
            { to: '/transfers', icon: ArrowRightLeft, label: 'Movimientos',             permission: 'transferencias.ver' },
        ],
    },
    {
        title: 'ANALÍTICA',
        icon: LineChart,
        defaultOpen: true,
        items: [
            { to: '/analytics', icon: LineChart, label: 'Forecasting & KPIs', end: true, permission: 'analitica.ver' },
        ],
    },
    {
        title: 'CONFIGURACIÓN',
        icon: Settings,
        defaultOpen: false,
        items: [
            { to: '/clients',         icon: Users,      label: 'Clientes',       permission: 'clientes.ver' },
            { to: '/suppliers',       icon: Truck,      label: 'Proveedores',    permission: 'proveedores.ver' },
            { to: '/products',        icon: Package,    label: 'Productos',      permission: 'productos.ver' },
            { to: '/payment-methods', icon: CreditCard, label: 'Medios de Pago', permission: 'medios_pago.ver' },
        ],
    },
    {
        title: 'ADMINISTRACIÓN',
        icon: Shield,
        defaultOpen: false,
        permission: 'roles.ver',
        items: [
            { to: '/admin/roles',                  icon: Shield,   label: 'Roles y Permisos' },
            { to: '/admin/usuarios',               icon: UserCog,  label: 'Usuarios',               permission: 'usuarios.ver' },
            { to: '/admin/solicitudes-analytics',  icon: Inbox,    label: 'Solicitudes Analítica',  permission: 'clientes.analytics_toggle' },
            { to: '/admin/parametros',             icon: Sliders,  label: 'Parámetros',             permission: 'parametros.ver' },
        ],
    },
];

// Nombre de la ruta activa para el topbar móvil
function usePageTitle() {
    const location = useLocation();
    const path = location.pathname;
    if (path === '/') return 'Inicio';
    for (const s of NAV_SECTIONS) {
        for (const item of s.items) {
            if (item.end ? path === item.to : path.startsWith(item.to)) return item.label;
        }
    }
    return 'ArepasERP';
}

export default function Layout() {
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const sidebarRef = useRef(null);
    const location = useLocation();
    const navigate = useNavigate();
    const pageTitle = usePageTitle();
    const { logout, hasPermission, user } = useAuth();
    const [solicitudesPendientes, setSolicitudesPendientes] = useState(0);

    // Cierra el sidebar al navegar (móvil)
    useEffect(() => { setSidebarOpen(false); }, [location.pathname]);

    // Chequea solicitudes pendientes del módulo analítica al montar y cada 5 min
    useEffect(() => {
        if (!hasPermission('clientes.analytics_toggle')) return;

        let mounted = true;
        let yaNotificado = false;

        const chequear = async () => {
            try {
                const r = await api.get('/clients/analytics/solicitudes/pendientes-count');
                if (!mounted) return;
                const n = r.data.pendientes || 0;
                setSolicitudesPendientes(n);
                // Popup solo la primera vez en la sesión, si hay pendientes y no estamos ya en esa página
                if (n > 0 && !yaNotificado && !location.pathname.includes('solicitudes-analytics')) {
                    yaNotificado = true;
                    toast(
                        `${n} ${n === 1 ? 'solicitud pendiente' : 'solicitudes pendientes'} del módulo analítica`,
                        {
                            description: 'Clic para revisar',
                            duration: 8000,
                            action: {
                                label: 'Ver',
                                onClick: () => navigate('/admin/solicitudes-analytics'),
                            },
                        }
                    );
                }
            } catch { /* ignore */ }
        };

        chequear();
        const id = setInterval(chequear, 5 * 60 * 1000);
        return () => { mounted = false; clearInterval(id); };
    }, [hasPermission, navigate, location.pathname]);

    // Cierra al hacer clic fuera del sidebar en móvil
    useEffect(() => {
        const handleClick = (e) => {
            if (sidebarOpen && sidebarRef.current && !sidebarRef.current.contains(e.target)) {
                setSidebarOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClick);
        document.addEventListener('touchstart', handleClick);
        return () => {
            document.removeEventListener('mousedown', handleClick);
            document.removeEventListener('touchstart', handleClick);
        };
    }, [sidebarOpen]);

    const navContent = (
        <>
            <NavLink to="/" end className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
                <Home size={18} />
                <span className="nav-text">Inicio</span>
            </NavLink>

            {NAV_SECTIONS.map((section) => {
                // Ocultar sección si requiere permiso específico (ej. ADMINISTRACIÓN)
                if (section.permission && !hasPermission(section.permission)) return null;

                // Filtrar items por permiso individual
                const visibleItems = section.items.filter(
                    item => !item.permission || hasPermission(item.permission)
                );
                // Ocultar sección si ningún ítem es visible
                if (visibleItems.length === 0) return null;

                return (
                    <NavSection key={section.title} title={section.title} icon={section.icon} defaultOpen={section.defaultOpen}>
                        {visibleItems.map((item) => {
                            const showBadge = item.to === '/admin/solicitudes-analytics' && solicitudesPendientes > 0;
                            return (
                                <NavLink key={item.to} to={item.to} end={item.end}
                                    className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
                                    <item.icon size={18} />
                                    <span className="nav-text">{item.label}</span>
                                    {showBadge && (
                                        <span style={{
                                            marginLeft: 'auto',
                                            background: '#ef4444', color: '#fff',
                                            fontSize: 10, fontWeight: 800,
                                            minWidth: 18, height: 18, borderRadius: 9,
                                            padding: '0 5px',
                                            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                                        }}>{solicitudesPendientes}</span>
                                    )}
                                </NavLink>
                            );
                        })}
                    </NavSection>
                );
            })}

            <button onClick={logout} className="nav-item nav-logout" title="Cerrar sesión">
                <LogOut size={16} />
                <span className="nav-text">Cerrar sesión</span>
            </button>
        </>
    );

    return (
        <div className="app-container">

            {/* ── Topbar móvil ─────────────────────────────── */}
            <header className="mobile-topbar">
                <button className="mobile-hamburger" onClick={() => setSidebarOpen(v => !v)} aria-label="Menú">
                    <Menu size={22} />
                </button>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <img src="/logo-betania.jpeg" alt="Betania" style={{ width: 28, height: 28, borderRadius: 7, objectFit: 'contain', border: '1px solid rgba(255,221,25,0.3)' }} />
                    <span style={{ fontWeight: 800, fontSize: 15, color: 'var(--brand)' }}>{pageTitle}</span>
                </div>
            </header>

            {/* ── Overlay oscuro cuando sidebar abierto en móvil ─ */}
            {sidebarOpen && <div className="sidebar-overlay" onClick={() => setSidebarOpen(false)} />}

            {/* ── Sidebar ──────────────────────────────────────── */}
            <aside ref={sidebarRef} className={`sidebar ${sidebarOpen ? 'sidebar-open' : ''}`}>
                <div className="sidebar-header">
                    <img src="/logo-betania.jpeg" alt="Betania" className="sidebar-logo app-logo" />
                    <div className="brand-text">
                        <span className="sidebar-brand-name">Arepas</span>
                        <span className="sidebar-brand-sub">Betania</span>
                    </div>
                    <button className="sidebar-close-btn" onClick={() => setSidebarOpen(false)} aria-label="Cerrar menú">
                        <X size={18} />
                    </button>
                </div>
                <nav className="nav-list">{navContent}</nav>
            </aside>

            {/* ── Columna derecha: topbar + contenido ──────────── */}
            <div className="right-column">
                <header className="desktop-topbar">
                    <span style={{ fontSize: 14, color: 'var(--text-secondary)' }} title={`Ambiente: ${envName}`}>
                        <span style={{ color: envColor, fontWeight: 700 }}>Bienvenido</span>
                        , <strong style={{ color: 'var(--text-primary)' }}>{user?.nombre}</strong>
                    </span>
                </header>

                <main className="main-content">
                    <div className="container">
                        <Outlet />
                    </div>
                </main>
            </div>
        </div>
    );
}

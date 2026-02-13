import { Home, PlusCircle, Users, BarChart2, Package, ChefHat, List, Settings, Truck, CreditCard, MessageCircle, FileText, ArrowRightLeft, ShoppingCart, TrendingUp, Wallet } from 'lucide-react';
import { NavLink, Outlet } from 'react-router-dom';
import NavSection from './NavSection';

export default function Layout() {
    return (
        <div className="app-container">
            <aside className="sidebar">
                <div className="sidebar-header" style={{ flexDirection: 'column', textAlign: 'center', gap: '0.75rem', padding: '1.5rem 0.5rem' }}>
                    <img
                        src="/logo-betania.jpeg"
                        alt="Logo"
                        style={{
                            width: '60px',
                            height: '60px',
                            borderRadius: '10px',
                            objectFit: 'contain',
                            imageRendering: '-webkit-optimize-contrast',
                            boxShadow: '0 4px 15px rgba(0,0,0,0.4)',
                            border: '1px solid rgba(255,255,255,0.05)'
                        }}
                        className="app-logo"
                    />
                    <div className="brand-text" style={{ fontSize: '1rem', lineHeight: '1.2' }}>
                        <span style={{ display: 'block', fontWeight: '800', color: 'var(--primary)' }}>BETANIA</span>
                        <span style={{ fontSize: '0.7rem', opacity: 0.7, letterSpacing: '2px' }}>DISTRIBUIDORES</span>
                    </div>
                </div>

                <nav className="nav-list">
                    <NavLink
                        to="/"
                        className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
                    >
                        <Home size={22} />
                        <span className="nav-text">Inicio</span>
                    </NavLink>

                    <NavSection title="PEDIDOS" icon={ShoppingCart} defaultOpen={true}>
                        <NavLink
                            to="/orders"
                            className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
                        >
                            <List size={22} />
                            <span className="nav-text">Pedidos del Día</span>
                        </NavLink>

                        <NavLink
                            to="/orders/new"
                            className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
                        >
                            <PlusCircle size={22} />
                            <span className="nav-text">Nuevo</span>
                        </NavLink>

                        <NavLink
                            to="/orders/report"
                            className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
                        >
                            <FileText size={22} />
                            <span className="nav-text">Reporte</span>
                        </NavLink>
                    </NavSection>

                    <NavSection title="GASTOS" icon={TrendingUp} defaultOpen={true}>
                        <NavLink
                            to="/expenses/new"
                            className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
                        >
                            <PlusCircle size={22} />
                            <span className="nav-text">Nuevo</span>
                        </NavLink>

                        <NavLink
                            to="/expenses"
                            className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
                        >
                            <BarChart2 size={22} />
                            <span className="nav-text">Reporte</span>
                        </NavLink>
                    </NavSection>

                    <NavSection title="CAJA" icon={Wallet} defaultOpen={true}>
                        <NavLink
                            to="/transfers"
                            className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
                        >
                            <ArrowRightLeft size={22} />
                            <span className="nav-text">Movimientos</span>
                        </NavLink>
                    </NavSection>

                    <NavSection title="CONFIGURACIÓN" icon={Settings} defaultOpen={false}>
                        <NavLink
                            to="/clients"
                            className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
                        >
                            <Users size={22} />
                            <span className="nav-text">Clientes</span>
                        </NavLink>

                        <NavLink
                            to="/suppliers"
                            className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
                        >
                            <Truck size={22} />
                            <span className="nav-text">Proveedores</span>
                        </NavLink>

                        <NavLink
                            to="/products"
                            className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
                        >
                            <Package size={22} />
                            <span className="nav-text">Productos</span>
                        </NavLink>

                        <NavLink
                            to="/payment-methods"
                            className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
                        >
                            <CreditCard size={22} />
                            <span className="nav-text">Medios Pago</span>
                        </NavLink>
                    </NavSection>

                    <button
                        onClick={async () => {
                            const { supabase } = await import('../lib/supabase');
                            await supabase.auth.signOut();
                            window.location.href = '/login';
                        }}
                        className="nav-item mt-auto"
                        style={{ marginTop: 'auto', background: 'transparent', border: 'none', width: '100%', cursor: 'pointer' }}
                    >
                        <div style={{ display: 'flex', gap: '0.75rem', color: 'var(--danger)' }}>
                            <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" y1="12" x2="9" y2="12"></line></svg>
                            <span className="nav-text">Salir</span>
                        </div>
                    </button>
                </nav>
            </aside>

            <main className="main-content">
                <div className="container">
                    <Outlet />
                </div>
            </main>
        </div>
    );
}

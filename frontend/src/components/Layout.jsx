import { Home, PlusCircle, Users, BarChart2, Package, ChefHat, List, Settings, Truck, CreditCard, MessageCircle, FileText, ArrowRightLeft } from 'lucide-react';
import { NavLink, Outlet } from 'react-router-dom';

export default function Layout() {
    return (
        <div className="app-container">
            <aside className="sidebar">
                <div className="sidebar-header">
                    <ChefHat size={32} className="app-logo" />
                    <span className="brand-text"><strong>Arepas Betania</strong> ERP</span>
                </div>

                <nav className="nav-list">
                    <NavLink
                        to="/"
                        className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
                    >
                        <Home size={22} />
                        <span className="nav-text">Inicio</span>
                    </NavLink>

                    <div className="nav-section-title text-muted text-xs font-bold mt-4 mb-2 pl-3">PEDIDOS</div>

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
                        <span className="nav-text">Nuevo Pedido</span>
                    </NavLink>



                    <NavLink
                        to="/orders/report"
                        className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
                    >
                        <FileText size={22} />
                        <span className="nav-text">Reporte Mensual</span>
                    </NavLink>

                    <div className="nav-section-title text-muted text-xs font-bold mt-4 mb-2 pl-3">GASTOS</div>

                    <NavLink
                        to="/expenses/new"
                        className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
                    >
                        <PlusCircle size={22} />
                        <span className="nav-text">Nuevo Gasto</span>
                    </NavLink>

                    <NavLink
                        to="/expenses"
                        className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
                    >
                        <BarChart2 size={22} />
                        <span className="nav-text">Reporte Gastos</span>
                    </NavLink>

                    <div className="nav-section-title text-muted text-xs font-bold mt-4 mb-2 pl-3">CAJA</div>

                    <NavLink
                        to="/transfers"
                        className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
                    >
                        <ArrowRightLeft size={22} />
                        <span className="nav-text">Movimientos</span>
                    </NavLink>

                    <div className="nav-section-title text-muted text-xs font-bold mt-4 mb-2 pl-3">CONFIGURACIÓN</div>

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
                        <span className="nav-text">Medios de Pago</span>
                    </NavLink>

                    <button
                        onClick={() => import('../lib/supabase').then(m => m.supabase.auth.signOut())}
                        className="nav-item"
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

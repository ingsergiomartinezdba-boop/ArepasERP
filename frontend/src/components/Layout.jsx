import { Home, PlusCircle, Users, BarChart2 } from 'lucide-react';
import { NavLink, Outlet } from 'react-router-dom';

export default function Layout() {
    return (
        <div className="app-container">
            <main className="container">
                <Outlet />
            </main>

            <nav className="bottom-nav">
                <NavLink
                    to="/"
                    className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
                >
                    <Home size={24} />
                    <span>Inicio</span>
                </NavLink>

                <NavLink
                    to="/orders/new"
                    className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
                >
                    <PlusCircle size={24} />
                    <span>Pedido</span>
                </NavLink>

                <NavLink
                    to="/clients"
                    className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
                >
                    <Users size={24} />
                    <span>Clientes</span>
                </NavLink>

                <NavLink
                    to="/expenses"
                    className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
                >
                    <BarChart2 size={24} />
                    <span>Gastos</span>
                </NavLink>
            </nav>
        </div>
    );
}

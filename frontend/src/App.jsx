import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import OrderForm from './pages/OrderForm';
import WhatsappSummary from './pages/WhatsappSummary';
import Clients from './pages/Clients';
import Expenses from './pages/Expenses';
import ExpenseForm from './pages/ExpenseForm';
import ExpensesDashboard from './pages/ExpensesDashboard';
import Products from './pages/Products';
import OrdersList from './pages/OrdersList';
import Login from './pages/Login';
import Suppliers from './pages/Suppliers';
import PaymentMethods from './pages/PaymentMethods';
import Transfers from './pages/Transfers';
import OrdersReport from './pages/OrdersReport';
import Inventory from './pages/Inventory';
import Production from './pages/Production';
import Analytics from './pages/Analytics';
import CashFlow from './pages/CashFlow';
import MovimientosPorMedio from './pages/MovimientosPorMedio';
import CosteoProduccion from './pages/CosteoProduccion';
import Parametros from './pages/Parametros';
import CuentasPorCobrar from './pages/CuentasPorCobrar';
import CuentasPorPagar from './pages/CuentasPorPagar';
import RolesAdmin from './pages/RolesAdmin';
import UsuariosAdmin from './pages/UsuariosAdmin';
import PortalCliente from './pages/PortalCliente';
import SolicitudesAnalytics from './pages/SolicitudesAnalytics';
import ProtectedRoute from './components/ProtectedRoute';
import PortalRoute from './components/PortalRoute';

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />

          {/* Portal exclusivo para usuarios con rol Cliente */}
          <Route element={<PortalRoute />}>
            <Route path="/portal" element={<PortalCliente />} />
          </Route>

          <Route element={<ProtectedRoute />}>
            <Route path="/" element={<Layout />}>
              <Route index element={<Dashboard />} />
              <Route path="orders" element={<OrdersList />} />
              <Route path="orders/report" element={<OrdersReport />} />
              <Route path="orders/new" element={<OrderForm />} />
              <Route path="orders/:id/edit" element={<OrderForm />} />
              <Route path="whatsapp" element={<WhatsappSummary />} />
              <Route path="clients" element={<Clients />} />
              <Route path="suppliers" element={<Suppliers />} />
              <Route path="expenses" element={<Expenses />} />
              <Route path="expenses/new" element={<ExpenseForm />} />
              <Route path="expenses/dashboard" element={<ExpensesDashboard />} />
              <Route path="products" element={<Products />} />
              <Route path="payment-methods" element={<PaymentMethods />} />
              <Route path="transfers" element={<Transfers />} />
              <Route path="inventory" element={<Inventory />} />
              <Route path="production" element={<Production />} />
              <Route path="analytics" element={<Analytics />} />
              <Route path="cash-flow" element={<CashFlow />} />
              <Route path="cash-flow/movimientos-por-medio" element={<MovimientosPorMedio />} />
              <Route path="costeo" element={<CosteoProduccion />} />
              <Route path="orders/cuentas-por-cobrar" element={<CuentasPorCobrar />} />
              <Route path="expenses/cuentas-por-pagar" element={<CuentasPorPagar />} />
              {/* RBAC Admin */}
              <Route path="admin/roles"        element={<RolesAdmin />} />
              <Route path="admin/usuarios"     element={<UsuariosAdmin />} />
              <Route path="admin/parametros"    element={<Parametros />} />
              <Route path="admin/solicitudes-analytics" element={<SolicitudesAnalytics />} />
            </Route>
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;

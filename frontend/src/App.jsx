import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import OrderForm from './pages/OrderForm';
import WhatsappSummary from './pages/WhatsappSummary';
import Clients from './pages/Clients';
import Expenses from './pages/Expenses';
import Products from './pages/Products';
import OrdersList from './pages/OrdersList';
import Login from './pages/Login';
import Suppliers from './pages/Suppliers';
import PaymentMethods from './pages/PaymentMethods';
import OrdersReport from './pages/OrdersReport';
import ProtectedRoute from './components/ProtectedRoute';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />

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
            <Route path="products" element={<Products />} />
            <Route path="payment-methods" element={<PaymentMethods />} />
          </Route>
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;

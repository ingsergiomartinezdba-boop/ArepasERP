import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import OrderForm from './pages/OrderForm';
import WhatsappSummary from './pages/WhatsappSummary';
// import Clients from './pages/Clients'; // To be implemented if needed
// import Expenses from './pages/Expenses'; // To be implemented if needed

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Dashboard />} />
          <Route path="orders/new" element={<OrderForm />} />
          <Route path="whatsapp" element={<WhatsappSummary />} />
          <Route path="clients" element={<div className="text-center mt-4">Gestión de Clientes (En construcción)</div>} />
          <Route path="expenses" element={<div className="text-center mt-4">Gestión de Gastos (En construcción)</div>} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;

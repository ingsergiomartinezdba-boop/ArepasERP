import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function ProtectedRoute() {
    const { user, loading, hasPermission } = useAuth();

    // Esperar a que AuthContext termine la hidratación inicial desde localStorage
    if (loading) return null;

    // Sin sesión activa → al login. El JWT vive en cookie HttpOnly y no es
    // legible desde JS; usamos `user` (cacheado en localStorage) como señal.
    if (!user) {
        return <Navigate to="/login" replace />;
    }

    // Usuarios del portal cliente no acceden al ERP interno
    if (hasPermission('portal.ver_pedidos') && !hasPermission('pedidos.ver')) {
        return <Navigate to="/portal" replace />;
    }

    return <Outlet />;
}

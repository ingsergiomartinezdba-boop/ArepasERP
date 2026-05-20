import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

/**
 * Ruta exclusiva para usuarios con rol Cliente (portal.ver_pedidos).
 * - Sin sesión → login
 * - Con sesión pero sin permiso portal → dashboard interno
 * - Con permiso portal → renderiza el portal
 *
 * Usa `user` del AuthContext (no localStorage.token) porque el JWT
 * vive en cookie HttpOnly y no es legible desde JS.
 */
export default function PortalRoute() {
    const { user, loading, hasPermission } = useAuth();

    if (loading) return null;

    if (!user) {
        return <Navigate to="/login" replace />;
    }

    if (!hasPermission('portal.ver_pedidos')) {
        return <Navigate to="/" replace />;
    }

    return <Outlet />;
}

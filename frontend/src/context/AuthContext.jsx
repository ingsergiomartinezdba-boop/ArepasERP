/**
 * AuthContext — Gestión global de autenticación + permisos RBAC
 *
 * Provee:
 *   - user: { id, email, nombre, rol, rol_id, rol_nombre, permisos: string[] }
 *   - login(email, password) → lanza error si falla
 *   - logout()
 *   - hasPermission(codigo) → boolean
 *   - hasAnyPermission([...codigos]) → boolean
 *   - hasAllPermissions([...codigos]) → boolean
 *   - loading: boolean
 */
import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import api from '../services/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
    const [user, setUser]       = useState(null);
    const [loading, setLoading] = useState(true);

    // Inicializar: si hay `user` cacheado en localStorage, asumir sesión activa
    // (la cookie HttpOnly se enviará automáticamente). El primer request que
    // falle con 401 redirigirá a /login.
    // Se acepta también el `token` legado en localStorage por compatibilidad con
    // sesiones creadas antes del cambio a cookies.
    useEffect(() => {
        const stored = localStorage.getItem('user');
        if (stored) {
            try {
                setUser(JSON.parse(stored));
            } catch {
                localStorage.removeItem('user');
                localStorage.removeItem('token');
            }
        }
        setLoading(false);
    }, []);

    const login = useCallback(async (email, password) => {
        // El backend setea la cookie HttpOnly `arepaserp_session`.
        // No guardamos el access_token en localStorage (evita robo vía XSS).
        // 'user' sí va a localStorage porque solo es info pública del perfil.
        const res = await api.post('/auth/login', { email, password });
        const { user: userData } = res.data;
        localStorage.removeItem('token');  // limpia sesiones legadas si existieran
        localStorage.setItem('user', JSON.stringify(userData));
        setUser(userData);
        return userData;
    }, []);

    const logout = useCallback(async () => {
        // Pedir al backend que borre la cookie HttpOnly (no se puede desde JS).
        try {
            await api.post('/auth/logout');
        } catch {
            // best-effort: si falla, igual seguimos limpiando el cliente.
        }
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        setUser(null);
        window.location.href = '/login';
    }, []);

    const refreshUser = useCallback(async () => {
        try {
            const res = await api.get('/auth/me');
            localStorage.setItem('user', JSON.stringify(res.data));
            setUser(res.data);
        } catch {
            logout();
        }
    }, [logout]);

    // ── Helpers de permisos ──────────────────────────────────

    const hasPermission = useCallback((codigo) => {
        if (!user) return false;
        // rol legacy 'admin' → acceso total
        if (user.rol === 'admin') return true;
        return Array.isArray(user.permisos) && user.permisos.includes(codigo);
    }, [user]);

    const hasAnyPermission = useCallback((codigos = []) => {
        return codigos.some(c => hasPermission(c));
    }, [hasPermission]);

    const hasAllPermissions = useCallback((codigos = []) => {
        return codigos.every(c => hasPermission(c));
    }, [hasPermission]);

    return (
        <AuthContext.Provider value={{
            user,
            loading,
            login,
            logout,
            refreshUser,
            hasPermission,
            hasAnyPermission,
            hasAllPermissions,
            isAdmin: user?.rol === 'admin' || user?.permisos?.includes('roles.editar'),
        }}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    const ctx = useContext(AuthContext);
    if (!ctx) throw new Error('useAuth debe usarse dentro de <AuthProvider>');
    return ctx;
}

/** Shortcut hook */
export function usePermission(codigo) {
    const { hasPermission } = useAuth();
    return hasPermission(codigo);
}

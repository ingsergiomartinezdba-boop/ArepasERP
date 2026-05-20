/**
 * PermissionGate — Renderiza hijos solo si el usuario tiene el permiso requerido.
 *
 * Uso:
 *   <PermissionGate permission="pedidos.crear">
 *     <button>Nuevo Pedido</button>
 *   </PermissionGate>
 *
 *   <PermissionGate permission="clientes.eliminar" fallback={<span>Sin acceso</span>}>
 *     <button>Eliminar</button>
 *   </PermissionGate>
 *
 *   <PermissionGate anyOf={["pedidos.crear", "pedidos.editar"]}>
 *     ...
 *   </PermissionGate>
 */
import { useAuth } from '../context/AuthContext';

export default function PermissionGate({ permission, anyOf, allOf, fallback = null, children }) {
    const { hasPermission, hasAnyPermission, hasAllPermissions } = useAuth();

    let allowed = false;

    if (permission)  allowed = hasPermission(permission);
    else if (anyOf)  allowed = hasAnyPermission(anyOf);
    else if (allOf)  allowed = hasAllPermissions(allOf);
    else             allowed = true; // sin restricción

    return allowed ? children : fallback;
}

/**
 * PageHeader Component
 * 
 * Componente estándar para headers de página en la aplicación
 * 
 * @param {string} title - Título de la página (requerido)
 * @param {React.ReactNode} action - Botón o elemento de acción (opcional)
 * @param {React.ReactNode} children - Contenido adicional entre título y acción (opcional)
 * @param {string} className - Clases CSS adicionales (opcional)
 * @param {object} style - Estilos inline adicionales (opcional)
 */

export default function PageHeader({
    title,
    action,
    children,
    className = '',
    style = {}
}) {
    return (
        <div
            className={`flex justify-between items-center mb-4 ${className}`}
            style={style}
        >
            <div className="flex items-center gap-4">
                <h1 style={{ margin: 0 }}>{title}</h1>
                {children}
            </div>

            {action && (
                <div className="flex items-center gap-2">
                    {action}
                </div>
            )}
        </div>
    );
}

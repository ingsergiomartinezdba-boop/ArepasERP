/**
 * CloseButton Component
 * 
 * Botón de cerrar estándar con fondo naranja y X negra
 * Usar en todos los modales y diálogos de la aplicación
 * 
 * @param {Function} onClick - Función a ejecutar al hacer click
 * @param {string} className - Clases CSS adicionales (opcional)
 * @param {object} style - Estilos inline adicionales (opcional)
 */

export default function CloseButton({ onClick, className = '', style = {} }) {
    const defaultStyle = {
        backgroundColor: '#ff9800',
        color: '#000',
        border: 'none',
        borderRadius: '4px',
        width: '32px',
        height: '32px',
        fontSize: '24px',
        fontWeight: 'bold',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        lineHeight: '1',
        transition: 'opacity 0.2s',
        ...style
    };

    return (
        <button
            onClick={onClick}
            className={className}
            style={defaultStyle}
            onMouseEnter={(e) => e.currentTarget.style.opacity = '0.8'}
            onMouseLeave={(e) => e.currentTarget.style.opacity = '1'}
            aria-label="Cerrar"
        >
            &times;
        </button>
    );
}

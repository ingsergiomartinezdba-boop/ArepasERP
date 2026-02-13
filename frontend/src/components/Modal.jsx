import { useEffect } from 'react';
import CloseButton from './CloseButton';

/**
 * Modal Component
 * 
 * Componente estándar para todos los modales de la aplicación
 * 
 * @param {boolean} isOpen - Controla si el modal está abierto
 * @param {function} onClose - Función a ejecutar al cerrar el modal
 * @param {string} title - Título del modal (opcional)
 * @param {string} size - Tamaño del modal: 'sm' (300px), 'md' (400px), 'lg' (500px), 'xl' (600px)
 * @param {boolean} showCloseButton - Mostrar botón de cerrar (default: true)
 * @param {boolean} closeOnOverlayClick - Cerrar al hacer click en el overlay (default: true)
 * @param {React.ReactNode} children - Contenido del modal
 * @param {object} style - Estilos adicionales para el contenedor del modal
 * @param {string} className - Clases CSS adicionales
 */

export default function Modal({
    isOpen,
    onClose,
    title,
    size = 'md',
    showCloseButton = true,
    closeOnOverlayClick = true,
    children,
    style = {},
    className = ''
}) {
    // Cerrar con tecla ESC
    useEffect(() => {
        const handleEsc = (e) => {
            if (e.key === 'Escape' && isOpen) {
                onClose();
            }
        };

        window.addEventListener('keydown', handleEsc);
        return () => window.removeEventListener('keydown', handleEsc);
    }, [isOpen, onClose]);

    // Prevenir scroll del body cuando el modal está abierto
    useEffect(() => {
        if (isOpen) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = 'unset';
        }

        return () => {
            document.body.style.overflow = 'unset';
        };
    }, [isOpen]);

    if (!isOpen) return null;

    // Tamaños predefinidos
    const sizes = {
        sm: '300px',
        md: '400px',
        lg: '500px',
        xl: '600px'
    };

    const handleOverlayClick = (e) => {
        if (closeOnOverlayClick && e.target === e.currentTarget) {
            onClose();
        }
    };

    return (
        <div
            className="modal-overlay"
            onClick={handleOverlayClick}
        >
            <div
                className={`card animate-slide-up ${className}`}
                style={{
                    width: '90%',
                    maxWidth: sizes[size] || sizes.md,
                    margin: 0,
                    position: 'relative',
                    overflow: 'visible', // Allow close button to overlap
                    ...style
                }}
                onClick={(e) => e.stopPropagation()}
            >
                {/* Floating Close Button */}
                {showCloseButton && <CloseButton onClick={onClose} />}

                <div style={{ maxHeight: '85vh', overflowY: 'auto', paddingRight: '5px' }}>
                    {/* Header */}
                    {title && (
                        <div className="mb-4">
                            <h2 className="m-0" style={{ fontSize: '1.5rem' }}>{title}</h2>
                        </div>
                    )}

                    {/* Content */}
                    <div>
                        {children}
                    </div>
                </div>
            </div>
        </div>
    );
}

/**
 * Button Component
 * 
 * Componente estándar de botón para la aplicación ArepasERP.
 * Soporta diferentes variantes de color y tamaños.
 * 
 * @param {string} variant - Variante de color: 'primary', 'secondary', 'success', 'danger' (default: 'primary')
 * @param {string} size - Tamaño: 'sm', 'md', 'lg' (default: 'md')
 * @param {React.ReactNode} icon - Icono opcional a mostrar (Lucide icon)
 */

export default function Button({
    children,
    variant = 'primary',
    size = 'md',
    icon,
    className = '',
    type = 'button',
    disabled = false,
    onClick,
    style = {},
    fluid = false, // Custom prop - not passed to DOM
    ...props // Remaining props (fluid is already extracted above)
}) {
    // Note: fluid prop is used for styling but not passed to DOM element
    // Basic class
    const baseClass = 'btn';

    // Variant classes
    const variantClasses = {
        primary: 'btn-primary',
        secondary: 'btn-secondary',
        success: 'btn-success',
        danger: 'btn-danger'
    };

    // Size styles (manual refinement since global CSS might be limited)
    const sizeStyles = {
        sm: { padding: '0.25rem 0.5rem', fontSize: '0.875rem' },
        md: {}, // Default from CSS
        lg: { padding: '0.75rem 1.5rem', fontSize: '1.125rem' }
    };

    // Combine classes
    const combinedClassName = [
        baseClass,
        variantClasses[variant] || variantClasses.primary,
        className
    ].filter(Boolean).join(' ');

    // Combine styles
    const combinedStyle = {
        ...sizeStyles[size] || {},
        ...(fluid ? { width: '100%' } : {}),
        ...style
    };

    return (
        <button
            type={type}
            className={combinedClassName}
            style={combinedStyle}
            onClick={onClick}
            disabled={disabled}
            aria-label={props['aria-label']}
            title={props.title}
            id={props.id}
            name={props.name}
            form={props.form}
            tabIndex={props.tabIndex}
        >
            <span className="flex items-center justify-center gap-2">
                {icon && <span>{icon}</span>}
                {children}
            </span>
        </button>
    );
}

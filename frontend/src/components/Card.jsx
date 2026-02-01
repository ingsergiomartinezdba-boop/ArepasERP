import React from 'react';

/**
 * Card Component
 * Standardizes the appearance of containers with consistent padding, borders, and shadows.
 * 
 * Props:
 * - children: Content of the card
 * - title: Optional header title
 * - footer: Optional footer content
 * - className: Additional classes for the container
 * - bodyClassName: Additional classes for the body div
 * - noPadding: If true, removes padding from the body
 * - variant: 'default' | 'glass' | 'outline' (can be extended)
 * - interactive: If true, adds hover effects
 */
export default function Card({
    children,
    title,
    footer,
    className = '',
    bodyClassName = '',
    noPadding = false,
    variant = 'default',
    interactive = false,
    ...props
}) {
    const baseClasses = "card overflow-hidden";
    const interactiveClasses = interactive ? "hover:shadow-lg transition-all duration-200 cursor-pointer active:scale-[0.98]" : "";

    // Variant classes can be added here
    const variantClasses = {
        default: "",
        glass: "backdrop-blur-md bg-opacity-10 border-white/10",
        outline: "border-2 border-primary/20",
    }[variant] || "";

    return (
        <div
            className={`${baseClasses} ${interactiveClasses} ${variantClasses} ${className}`}
            {...props}
        >
            {title && (
                <div className="card-header border-b border-border/50 py-3 px-4">
                    <h3 className="text-lg font-semibold m-0">{title}</h3>
                </div>
            )}

            <div className={`${noPadding ? '' : 'p-4'} ${bodyClassName}`}>
                {children}
            </div>

            {footer && (
                <div className="card-footer border-t border-border/50 py-3 px-4 bg-muted/5">
                    {footer}
                </div>
            )}
        </div>
    );
}

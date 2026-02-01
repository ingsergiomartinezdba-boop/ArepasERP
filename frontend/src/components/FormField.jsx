import React from 'react';

/**
 * FormField Component
 * Standardizes the layout for form inputs, labels, and error messages.
 * 
 * Props:
 * - label: The text to display above the input
 * - error: Optional error message to display below the input
 * - required: Boolean to show a '*' next to the label
 * - icon: Optional Lucide icon to display next to the label
 * - children: The input/select/textarea element
 * - className: Optional container classes
 * - helpText: Optional small text below the field
 */
export default function FormField({
    label,
    error,
    required = false,
    icon,
    children,
    className = '',
    helpText,
    ...props
}) {
    return (
        <div className={`form-group ${className}`} {...props}>
            {label && (
                <label className="flex items-center gap-2 mb-1 text-sm font-medium text-muted">
                    {icon && <span className="text-primary">{icon}</span>}
                    {label}
                    {required && <span className="text-danger ml-1">*</span>}
                </label>
            )}

            <div className="relative">
                {children}
            </div>

            {helpText && !error && (
                <small className="text-muted mt-1 block text-xs">
                    {helpText}
                </small>
            )}

            {error && (
                <small className="text-danger mt-1 block text-xs font-semibold animate-fade-in">
                    {error}
                </small>
            )}
        </div>
    );
}

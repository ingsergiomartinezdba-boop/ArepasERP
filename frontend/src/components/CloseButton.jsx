import { X } from 'lucide-react';

export default function CloseButton({ onClick, className = '', style = {} }) {
    return (
        <button
            onClick={onClick}
            className={`btn-close-modal ${className}`}
            style={style}
            aria-label="Cerrar"
        >
            <X size={18} />
        </button>
    );
}

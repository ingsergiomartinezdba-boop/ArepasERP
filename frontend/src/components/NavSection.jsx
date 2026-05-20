import { useState } from 'react';
import { ChevronDown } from 'lucide-react';

const NavSection = ({ title, children, icon: Icon, defaultOpen = false }) => {
    const [isOpen, setIsOpen] = useState(defaultOpen);

    return (
        <div className="nav-section">
            <button
                type="button"
                className="nav-section-header"
                onClick={() => setIsOpen(!isOpen)}
                aria-expanded={isOpen}
            >
                <span className="nav-section-left">
                    {Icon && <Icon size={14} />}
                    <span className="nav-section-label">{title}</span>
                </span>
                <ChevronDown
                    size={13}
                    className="nav-section-chevron"
                    style={{ transform: isOpen ? 'rotate(0deg)' : 'rotate(-90deg)' }}
                />
            </button>

            {isOpen && (
                <div className="nav-section-items">
                    {children}
                </div>
            )}
        </div>
    );
};

export default NavSection;

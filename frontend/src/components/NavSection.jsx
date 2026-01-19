import { useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';

const NavSection = ({ title, children, defaultOpen = false }) => {
    const [isOpen, setIsOpen] = useState(defaultOpen);

    return (
        <div className="nav-section">
            <div
                className="nav-section-title text-muted text-xs font-bold mt-4 mb-2 pl-3 flex items-center justify-between cursor-pointer hover:text-white transition-colors"
                onClick={() => setIsOpen(!isOpen)}
                style={{ userSelect: 'none' }}
                title={`Toggle ${title}`}
            >
                <span>{title}</span>
                {isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            </div>
            {isOpen && (
                <div className="nav-section-content pl-2 border-l border-white/10 ml-3">
                    {children}
                </div>
            )}
        </div>
    );
};

export default NavSection;

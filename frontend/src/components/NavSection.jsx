import { useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';

const NavSection = ({ title, children, icon: Icon, defaultOpen = false }) => {
    const [isOpen, setIsOpen] = useState(defaultOpen);

    return (
        <div className="nav-section">
            <div
                className="nav-section-title text-muted text-xs font-bold mt-4 mb-2 pl-3 flex items-center justify-between cursor-pointer hover:text-white transition-colors"
                onClick={() => setIsOpen(!isOpen)}
                style={{ userSelect: 'none', gap: '8px' }}
                title={`Toggle ${title}`}
            >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    {Icon && <Icon size={16} />}
                    <span className="section-label">{title}</span>
                </div>
                {isOpen ? <ChevronDown size={14} className="chevron" /> : <ChevronRight size={14} className="chevron" />}
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

import React, { useState, useEffect, useRef, ReactNode } from 'react';

interface DropdownProps {
    trigger: ReactNode;
    children: ReactNode;
    onOpen?: () => void;
}

const Dropdown: React.FC<DropdownProps> = ({ trigger, children, onOpen }) => {
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    const toggleDropdown = () => {
        const newIsOpen = !isOpen;
        setIsOpen(newIsOpen);
        if (newIsOpen && onOpen) {
            onOpen();
        }
    };

    const handleClickOutside = (event: MouseEvent) => {
        if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
            setIsOpen(false);
        }
    };

    useEffect(() => {
        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, []);

    return (
        <div className="relative" ref={dropdownRef}>
            <div onClick={toggleDropdown}>
                {trigger}
            </div>

            {isOpen && (
                <div 
                    className="absolute right-0 mt-2 w-72 bg-white dark:bg-slate-700 rounded-lg shadow-xl border border-slate-200 dark:border-slate-600 z-50 animate-fade-in-up"
                    onClick={() => setIsOpen(false)} // close on item click
                >
                    {children}
                </div>
            )}
        </div>
    );
};

export default Dropdown;
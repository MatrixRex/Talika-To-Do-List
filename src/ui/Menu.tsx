import { useRef, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { createPortal } from 'react-dom';

export interface MenuProps {
  children: ReactNode;
  isOpen: boolean;
  onClose: () => void;
  className?: string;
}

export function Menu({ children, isOpen, onClose, className }: MenuProps) {
  const anchorRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ top: 0, right: 0 });

  useEffect(() => {
    if (isOpen && anchorRef.current) {
      const rect = anchorRef.current.getBoundingClientRect();
      setPosition({
        top: rect.top,
        right: window.innerWidth - rect.right,
      });
    }
  }, [isOpen]);

  return (
    <>
      <div ref={anchorRef} className="absolute right-0 top-full" aria-hidden="true" />
      {isOpen && createPortal(
        <>
          <div className="fixed inset-0 z-40" onClick={(e) => { e.stopPropagation(); onClose(); }} />
          <div 
            className={`fixed mt-1 z-50 bg-surface-elevated text-text rounded-md shadow-lg border border-surface-border p-1 min-w-menu ${className || ''}`}
            style={{ top: position.top, right: position.right }}
            onClick={(e) => e.stopPropagation()}
          >
            {children}
          </div>
        </>,
        document.body
      )}
    </>
  );
}

export interface MenuItemProps {
  icon?: ReactNode;
  children: ReactNode;
  onClick: () => void;
  variant?: 'default' | 'danger';
}

export function MenuItem({ icon, children, onClick, variant = 'default' }: MenuItemProps) {
  const variantClass = variant === 'danger' ? 'text-danger' : 'text-text';
  return (
    <button
      type="button"
      className={`w-full px-4 py-2 text-left hover:bg-surface rounded-md min-h-touch flex items-center gap-2 transition-colors duration-fast ${variantClass}`}
      onClick={onClick}
    >
      {icon}
      <span className="truncate">{children}</span>
    </button>
  );
}

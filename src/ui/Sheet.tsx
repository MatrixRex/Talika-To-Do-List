import { useEffect, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

export interface SheetProps {
  children: ReactNode;
  isOpen: boolean;
  onClose: () => void;
}

export function Sheet({ children, isOpen, onClose }: SheetProps) {
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || typeof document === 'undefined') return null;

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-40 flex flex-col justify-end"
      onClick={(e) => e.stopPropagation()}
    >
      <div 
        className="absolute inset-0 bg-text opacity-20" 
        onClick={(e) => {
          e.stopPropagation();
          onClose();
        }} 
      />
      <div 
        className="relative bg-surface-elevated text-text rounded-t-lg p-4 transition-transform duration-base translate-y-0 shadow-lg border-t border-surface-border"
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>,
    document.body
  );
}


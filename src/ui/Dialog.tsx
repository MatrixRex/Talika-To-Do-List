import { useEffect, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useDelayedUnmount } from './useDelayedUnmount';

export interface DialogProps {
  children: ReactNode;
  isOpen: boolean;
  onClose: () => void;
}

export function Dialog({ children, isOpen, onClose }: DialogProps) {
  // Use 150ms delay, which matches var(--dur-base)
  const { shouldRender, isExiting } = useDelayedUnmount(isOpen, 150);

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

  if (!shouldRender || typeof document === 'undefined') return null;

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={(e) => e.stopPropagation()}
    >
      <div 
        className={`absolute inset-0 bg-text opacity-20 ${isExiting ? 'anim-fade-out' : 'anim-fade-in'}`} 
        onClick={(e) => {
          e.stopPropagation();
          onClose();
        }} 
      />
      <div 
        className={`relative bg-surface-elevated text-text rounded-lg p-6 max-w-sm w-full shadow-xl border border-surface-border ${isExiting ? 'anim-scale-out' : 'anim-scale-in'}`}
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>,
    document.body
  );
}


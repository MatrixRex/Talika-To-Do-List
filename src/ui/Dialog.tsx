import type { ReactNode } from 'react';
import { useDelayedUnmount } from './useDelayedUnmount';

export interface DialogProps {
  children: ReactNode;
  isOpen: boolean;
  onClose: () => void;
}

export function Dialog({ children, isOpen, onClose }: DialogProps) {
  // Use 150ms delay, which matches var(--dur-base)
  const { shouldRender, isExiting } = useDelayedUnmount(isOpen, 150);

  if (!shouldRender) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div 
        className={`absolute inset-0 bg-text opacity-20 ${isExiting ? 'anim-fade-out' : 'anim-fade-in'}`} 
        onClick={onClose} 
      />
      <div 
        className={`relative bg-surface-elevated text-text rounded-lg p-6 max-w-sm w-full shadow-xl border border-surface-border ${isExiting ? 'anim-scale-out' : 'anim-scale-in'}`}
      >
        {children}
      </div>
    </div>
  );
}

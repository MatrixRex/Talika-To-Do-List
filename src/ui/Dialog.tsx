import type { ReactNode } from 'react';

export interface DialogProps {
  children: ReactNode;
  isOpen: boolean;
  onClose: () => void;
}

export function Dialog({ children, isOpen, onClose }: DialogProps) {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-text opacity-20" onClick={onClose} />
      <div className="relative bg-background text-text rounded-lg p-6 max-w-sm w-full shadow-xl border border-surface">
        {children}
      </div>
    </div>
  );
}

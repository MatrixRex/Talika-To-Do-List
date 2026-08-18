import type { ReactNode } from 'react';

export interface SheetProps {
  children: ReactNode;
  isOpen: boolean;
  onClose: () => void;
}

export function Sheet({ children, isOpen, onClose }: SheetProps) {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-40 flex flex-col justify-end">
      <div className="absolute inset-0 bg-text opacity-20" onClick={onClose} />
      <div className="relative bg-surface-elevated text-text rounded-t-lg p-4 transition-transform duration-base translate-y-0 shadow-lg border-t border-surface-border">
        {children}
      </div>
    </div>
  );
}

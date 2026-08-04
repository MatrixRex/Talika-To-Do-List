import React from 'react';

export function Sheet({ children, isOpen, onClose }: { children: React.ReactNode, isOpen: boolean, onClose: () => void }) {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-40 flex flex-col justify-end">
      <div className="absolute inset-0 bg-text-muted opacity-20" onClick={onClose} />
      <div className="relative bg-background rounded-t-lg p-4 transition-transform duration-base translate-y-0">
        {children}
      </div>
    </div>
  );
}

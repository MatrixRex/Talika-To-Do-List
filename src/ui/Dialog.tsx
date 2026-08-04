import React from 'react';

export function Dialog({ children, isOpen, onClose }: { children: React.ReactNode, isOpen: boolean, onClose: () => void }) {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-text-muted opacity-20" onClick={onClose} />
      <div className="relative bg-background rounded-lg p-6 max-w-sm w-full shadow-xl">
        {children}
      </div>
    </div>
  );
}

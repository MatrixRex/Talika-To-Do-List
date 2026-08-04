import React from 'react';

export function Menu({ children, isOpen, onClose }: { children: React.ReactNode, isOpen: boolean, onClose: () => void }) {
  if (!isOpen) return null;
  return (
    <>
      <div className="fixed inset-0 z-40" onClick={onClose} />
      <div className="absolute z-50 bg-background rounded-md shadow-lg border border-surface p-1">
        {children}
      </div>
    </>
  );
}

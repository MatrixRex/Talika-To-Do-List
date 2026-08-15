import type { ReactNode } from 'react';

export interface MenuProps {
  children: ReactNode;
  isOpen: boolean;
  onClose: () => void;
  className?: string;
}

export function Menu({ children, isOpen, onClose, className }: MenuProps) {
  if (!isOpen) return null;
  return (
    <>
      <div className="fixed inset-0 z-40" onClick={onClose} />
      <div className={`absolute right-0 top-full mt-1 z-50 bg-background text-text rounded-md shadow-lg border border-surface p-1 min-w-menu ${className || ''}`}>
        {children}
      </div>
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

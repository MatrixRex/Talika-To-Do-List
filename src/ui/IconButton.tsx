import type { ButtonHTMLAttributes, ReactNode } from 'react';

export interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children?: ReactNode;
}

export function IconButton({ children, className, ...props }: IconButtonProps) {
  return (
    <button
      className={`p-2 min-h-touch min-w-touch rounded-full transition-colors duration-base hover:bg-surface active:scale-95 text-text-muted hover:text-text flex items-center justify-center ${className || ''}`}
      {...props}
    >
      {children}
    </button>
  );
}

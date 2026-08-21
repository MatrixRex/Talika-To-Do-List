import type { ButtonHTMLAttributes, ReactNode } from 'react';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children?: ReactNode;
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
}

export function Button({ children, className, variant = 'primary', ...props }: ButtonProps) {
  const variantStyles = {
    primary: 'bg-accent text-background hover:opacity-90',
    secondary: 'bg-surface text-text hover:bg-surface-active',
    ghost: 'bg-transparent text-text-muted hover:bg-surface hover:text-text',
    danger: 'bg-danger text-background hover:opacity-90',
  }[variant];

  return (
    <button
      className={`px-4 py-2 min-h-touch min-w-touch rounded-md anim-press flex items-center justify-center font-medium ${variantStyles} ${className || ''}`}
      {...props}
    >
      {children}
    </button>
  );
}

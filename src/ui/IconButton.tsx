import type { ButtonHTMLAttributes, ReactNode } from 'react';

export interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children?: ReactNode;
}

export function IconButton({ children, className, ...props }: IconButtonProps) {
  return (
    <button
      type={props.type || 'button'}
      className={`p-2 min-h-touch min-w-touch rounded-full anim-press hover:bg-surface text-text-muted hover:text-text flex items-center justify-center ${className || ''}`}
      {...props}
    >
      {children}
    </button>
  );
}

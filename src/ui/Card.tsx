import type { HTMLAttributes, ReactNode } from 'react';

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  children?: ReactNode;
}

export function Card({ children, className, ...props }: CardProps) {
  return (
    <div className={`bg-surface text-text rounded-lg p-4 shadow-sm ${className || ''}`} {...props}>
      {children}
    </div>
  );
}

import type { HTMLAttributes, ReactNode } from 'react';

export interface ListRowProps extends HTMLAttributes<HTMLDivElement> {
  children?: ReactNode;
}

export function ListRow({ children, className, ...props }: ListRowProps) {
  return (
    <div
      className={`flex items-center gap-3 p-3 min-h-touch transition-colors duration-fast hover:bg-surface rounded-md cursor-pointer ${className || ''}`}
      {...props}
    >
      {children}
    </div>
  );
}

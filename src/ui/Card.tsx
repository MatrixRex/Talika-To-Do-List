import React from 'react';

export function Card({ children, className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={`bg-surface rounded-lg p-4 shadow-sm ${className || ''}`} {...props}>
      {children}
    </div>
  );
}

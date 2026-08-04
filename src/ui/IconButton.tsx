import React from 'react';

export function IconButton({ children, className, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button className={`p-2 rounded-full transition-colors duration-base hover:bg-surface active:scale-95 text-text-muted flex items-center justify-center ${className || ''}`} {...props}>
      {children}
    </button>
  );
}

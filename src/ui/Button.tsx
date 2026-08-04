import React from 'react';

export function Button({ children, className, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button className={`bg-accent text-white px-4 py-2 rounded-md transition-colors duration-base hover:opacity-90 active:scale-95 ${className || ''}`} {...props}>
      {children}
    </button>
  );
}

import React from 'react';

export function Input({ className, ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input className={`bg-surface rounded-md px-3 py-2 outline-none focus:ring-2 focus:ring-accent transition-shadow duration-fast w-full ${className || ''}`} {...props} />
  );
}

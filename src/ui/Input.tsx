import type { InputHTMLAttributes } from 'react';

export type InputProps = InputHTMLAttributes<HTMLInputElement>;

export function Input({ className, ...props }: InputProps) {
  return (
    <input
      className={`bg-surface text-text placeholder:text-text-muted rounded-md px-3 py-2 min-h-touch outline-none focus:ring-2 focus:ring-accent transition-shadow duration-fast w-full ${className || ''}`}
      {...props}
    />
  );
}

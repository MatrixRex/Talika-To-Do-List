import { forwardRef, type InputHTMLAttributes } from 'react';

export type InputProps = InputHTMLAttributes<HTMLInputElement>;

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { className, ...props },
  ref
) {
  return (
    <input
      ref={ref}
      className={`bg-surface text-text placeholder:text-text-muted rounded-md px-3 py-2 min-h-touch outline-none focus:ring-2 focus:ring-accent transition-shadow duration-fast w-full ${className || ''}`}
      {...props}
    />
  );
});

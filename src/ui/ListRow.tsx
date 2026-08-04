import React from 'react';

export function ListRow({ children, className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={`flex items-center gap-3 p-3 transition-colors duration-fast hover:bg-surface rounded-md cursor-pointer ${className || ''}`} {...props}>
      {children}
    </div>
  );
}

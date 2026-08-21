import type { ReactNode, HTMLAttributes } from 'react';

// Disable stagger after the app initially loads to avoid delayed animations for newly created items
let disableStagger = false;
setTimeout(() => {
  disableStagger = true;
}, 1000);

interface AnimateEnterProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  staggerIndex?: number;
}

export function AnimateEnter({ children, staggerIndex = 0, className = '', style, ...props }: AnimateEnterProps) {
  // Stagger interval is 50ms per item for a subtle waterfall effect
  // Disable stagger after initial page load so new tasks animate instantly
  const delayMs = disableStagger ? 0 : staggerIndex * 50;

  return (
    <div
      className={`anim-enter ${className}`}
      style={{
        ...style,
        animationDelay: `${delayMs}ms`,
      }}
      {...props}
    >
      {children}
    </div>
  );
}

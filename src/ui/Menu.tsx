import { useRef, useState, useLayoutEffect, useCallback } from 'react';
import type { ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { calculateMenuPosition, type MenuPosition } from './menu-position';

export type { MenuPosition };


export interface MenuProps {
  children: ReactNode;
  isOpen: boolean;
  onClose: () => void;
  className?: string;
}

export function Menu({ children, isOpen, onClose, className }: MenuProps) {
  const anchorRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState<MenuPosition>({ top: 0, right: 0 });
  const [isPositioned, setIsPositioned] = useState(false);

  const updatePosition = useCallback(() => {
    if (!anchorRef.current) return;

    const anchorEl = anchorRef.current;
    const parentEl = anchorEl.parentElement;
    const triggerRect = parentEl
      ? parentEl.getBoundingClientRect()
      : anchorEl.getBoundingClientRect();

    const viewportDimensions = {
      width: window.innerWidth,
      height: window.innerHeight,
    };

    const menuEl = menuRef.current;
    const menuDimensions = {
      width: menuEl?.offsetWidth || 160,
      height: menuEl?.offsetHeight || 180,
    };

    const calculated = calculateMenuPosition(
      triggerRect,
      menuDimensions,
      viewportDimensions,
      8,
      4
    );

    setPosition(calculated);
    setIsPositioned(true);
  }, []);

  useLayoutEffect(() => {
    if (isOpen) {
      setIsPositioned(false);
      updatePosition();

      const handleScrollOrResize = () => {
        updatePosition();
      };

      window.addEventListener('resize', handleScrollOrResize);
      window.addEventListener('scroll', handleScrollOrResize, true);

      return () => {
        window.removeEventListener('resize', handleScrollOrResize);
        window.removeEventListener('scroll', handleScrollOrResize, true);
      };
    } else {
      setIsPositioned(false);
    }
  }, [isOpen, updatePosition]);

  return (
    <>
      <div ref={anchorRef} className="absolute right-0 top-full" aria-hidden="true" />
      {isOpen &&
        createPortal(
          <>
            <div
              className="fixed inset-0 z-40"
              onClick={(e) => {
                e.stopPropagation();
                onClose();
              }}
            />
            <div
              ref={menuRef}
              className={`fixed z-50 bg-surface-elevated text-text rounded-md shadow-lg border border-surface-border p-1 min-w-menu overflow-y-auto ${className || ''}`}
              style={{
                top: position.top,
                right: position.right,
                maxHeight: 'calc(100vh - 16px)',
                opacity: isPositioned ? 1 : 0,
              }}
              onClick={(e) => e.stopPropagation()}
            >
              {children}
            </div>
          </>,
          document.body
        )}
    </>
  );
}

export interface MenuItemProps {
  icon?: ReactNode;
  children: ReactNode;
  onClick: () => void;
  variant?: 'default' | 'danger';
}

export function MenuItem({ icon, children, onClick, variant = 'default' }: MenuItemProps) {
  const variantClass = variant === 'danger' ? 'text-danger' : 'text-text';
  return (
    <button
      type="button"
      className={`w-full px-4 py-2 text-left hover:bg-surface rounded-md min-h-touch flex items-center gap-2 transition-colors duration-fast ${variantClass}`}
      onClick={onClick}
    >
      {icon}
      <span className="truncate">{children}</span>
    </button>
  );
}

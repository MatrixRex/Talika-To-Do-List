import { Icon } from './icons';

export interface AppLogoProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}

export function AppLogo({ size = 'md', className = '' }: AppLogoProps) {
  const sizeClasses = {
    sm: 'w-6 h-6 rounded-sm',
    md: 'w-8 h-8 rounded-md',
    lg: 'w-12 h-12 rounded-lg',
    xl: 'w-16 h-16 rounded-lg',
  };

  const iconSizes = {
    sm: 'w-3.5 h-3.5',
    md: 'w-5 h-5',
    lg: 'w-7 h-7',
    xl: 'w-9 h-9',
  };

  return (
    <div
      className={`inline-flex items-center justify-center bg-accent text-surface shrink-0 shadow-sm overflow-hidden ${sizeClasses[size]} ${className}`}
      aria-label="Talika Logo"
    >
      <Icon name="logo" className={iconSizes[size]} />
    </div>
  );
}

import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { AppLogo } from '../ui';
import { SettingsDialog } from './SettingsDialog';

export function AuthBar() {
  const { userProfile, firebaseUser } = useAuth();
  const [settingsOpen, setSettingsOpen] = useState(false);

  if (!firebaseUser) return null;

  const displayName = userProfile?.displayName || firebaseUser.displayName || 'User';
  const initial = displayName.charAt(0).toUpperCase();

  return (
    <header className="relative flex items-center justify-between px-4 py-2 border-b border-surface-border">
      <div className="flex items-center gap-2">
        <AppLogo size="sm" />
        <span className="font-bold tracking-tight text-text text-lg">Talika</span>
      </div>

      <div className="relative">
        <button
          type="button"
          onClick={() => setSettingsOpen(true)}
          className="flex items-center gap-2 p-1 rounded-full hover:bg-surface transition-colors duration-fast"
          aria-label="Settings"
        >
          {firebaseUser.photoURL ? (
            <img
              src={firebaseUser.photoURL}
              alt={displayName}
              className="w-8 h-8 rounded-full border border-surface-border"
            />
          ) : (
            <div className="w-8 h-8 rounded-full bg-accent text-background flex items-center justify-center font-bold text-sm">
              {initial}
            </div>
          )}
          <span className="text-sm font-medium hidden sm:inline max-w-32 truncate">
            {displayName}
          </span>
        </button>

        <SettingsDialog isOpen={settingsOpen} onClose={() => setSettingsOpen(false)} />
      </div>
    </header>
  );
}

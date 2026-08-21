import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Menu, MenuItem } from '../ui/Menu';
import { Icon } from '../ui/icons';

export function AuthBar() {
  const { userProfile, firebaseUser, signOut } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);

  if (!firebaseUser) return null;

  const displayName = userProfile?.displayName || firebaseUser.displayName || 'User';
  const email = userProfile?.email || firebaseUser.email || '';
  const initial = displayName.charAt(0).toUpperCase();

  return (
    <header className="relative flex items-center justify-between px-4 py-2 border-b border-surface-border">
      <div className="flex items-center gap-2">
        <span className="font-bold tracking-tight text-accent text-lg">Talika</span>
      </div>

      <div className="relative">
        <button
          type="button"
          onClick={() => setMenuOpen(!menuOpen)}
          className="flex items-center gap-2 p-1 rounded-full hover:bg-surface transition-colors duration-fast"
          aria-label="Account settings"
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

        <Menu isOpen={menuOpen} onClose={() => setMenuOpen(false)} className="w-56 right-0">
          <div className="px-4 py-2 border-b border-surface-border">
            <p className="text-sm font-semibold truncate">{displayName}</p>
            {email && <p className="text-xs text-text-muted truncate">{email}</p>}
          </div>
          <MenuItem
            icon={<Icon name="logOut" />}
            variant="danger"
            onClick={() => {
              setMenuOpen(false);
              signOut();
            }}
          >
            Sign out
          </MenuItem>
          <div className="px-4 pt-3 pb-1 border-t border-surface-border mt-1">
            <p className="text-[10px] text-text-muted text-center font-mono">v{__APP_VERSION__}</p>
          </div>
        </Menu>
      </div>
    </header>
  );
}

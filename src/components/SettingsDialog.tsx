import { Dialog, Button, ListRow, IconButton } from '../ui';
import { Icon } from '../ui/icons';
import { useAuth } from '../context/AuthContext';

interface SettingsDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

export function SettingsDialog({ isOpen, onClose }: SettingsDialogProps) {
  const { userProfile, firebaseUser, signOut, updatePrefs } = useAuth();

  if (!firebaseUser || !userProfile) return null;

  const displayName = userProfile.displayName || firebaseUser.displayName || 'User';
  const email = userProfile.email || firebaseUser.email || '';
  const initial = displayName.charAt(0).toUpperCase();

  const handleToggleHideCompleted = () => {
    updatePrefs({ hideCompletedTasks: !userProfile.prefs.hideCompletedTasks });
  };

  return (
    <Dialog isOpen={isOpen} onClose={onClose}>
      <div className="flex flex-col gap-6">
        <h3 className="text-lg font-bold text-text">Settings</h3>
        
        {/* User Info Section */}
        <div className="flex items-center gap-3 bg-surface p-3 rounded-lg border border-surface-border">
          {firebaseUser.photoURL ? (
            <img
              src={firebaseUser.photoURL}
              alt={displayName}
              className="w-12 h-12 rounded-full border border-surface-border"
            />
          ) : (
            <div className="w-12 h-12 rounded-full bg-accent text-background flex items-center justify-center font-bold text-xl">
              {initial}
            </div>
          )}
          <div className="flex-1 min-w-0">
            <p className="text-base font-semibold truncate">{displayName}</p>
            {email && <p className="text-sm text-text-muted truncate">{email}</p>}
          </div>
          <IconButton onClick={signOut} aria-label="Sign out" className="text-danger hover:bg-danger/10">
            <Icon name="logOut" />
          </IconButton>
        </div>

        {/* Preferences Section */}
        <div className="flex flex-col gap-2">
          <h4 className="text-sm font-semibold text-text-muted uppercase tracking-wider">Preferences</h4>
          <ListRow className="cursor-pointer hover:bg-surface rounded-md" onClick={handleToggleHideCompleted}>
            <div className="flex-1">
              <p className="text-sm font-medium text-text">Hide completed tasks</p>
              <p className="text-xs text-text-muted">Tasks disappear shortly after completion</p>
            </div>
            <div className="shrink-0 text-accent">
              <Icon name={userProfile.prefs.hideCompletedTasks ? 'check' : 'circle'} />
            </div>
          </ListRow>
        </div>

        {/* Footer Section */}
        <div className="flex items-center justify-between mt-2 pt-4 border-t border-surface-border">
          <span className="text-xs text-text-muted font-mono">v{__APP_VERSION__}</span>
          <Button variant="primary" onClick={onClose}>Done</Button>
        </div>
      </div>
    </Dialog>
  );
}

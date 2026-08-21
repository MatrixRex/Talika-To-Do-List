import { useState } from 'react';
import type { Folder, User } from '../lib/schema';
import { Dialog, Button, Icon, type IconName, getFolderColorStyle } from '../ui';

interface JoinFolderDialogProps {
  isOpen: boolean;
  folder: Folder | null;
  owner: User | null;
  onJoin: () => Promise<void>;
  onClose: () => void;
}

export function JoinFolderDialog({
  isOpen,
  folder,
  owner,
  onJoin,
  onClose,
}: JoinFolderDialogProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!folder) return null;

  const colorStyle = getFolderColorStyle(folder.color);
  const iconName = (folder.icon as IconName) || 'folder';

  const handleConfirm = async () => {
    setLoading(true);
    setError(null);
    try {
      await onJoin();
    } catch (err: unknown) {
      console.error('Failed to join folder:', err);
      setError((err as Error).message || 'Failed to join folder.');
      setLoading(false);
    }
  };

  return (
    <Dialog isOpen={isOpen} onClose={loading ? () => {} : onClose}>
      <div className="flex flex-col gap-4">
        {/* Header with folder icon & name */}
        <div className="flex items-center gap-3 border-b border-surface-border pb-3">
          <div
            className="p-3 rounded-md flex items-center justify-center shrink-0"
            style={colorStyle.style}
          >
            <Icon name={iconName} />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-lg font-bold text-text truncate">
              Join &ldquo;{folder.name}&rdquo;
            </h3>
            <p className="text-xs text-text-muted">
              You were invited to collaborate on this folder
            </p>
          </div>
        </div>

        {error && (
          <div className="text-xs text-danger bg-danger/10 p-2.5 rounded-md border border-danger/20">
            {error}
          </div>
        )}

        {/* Owner Info & Details */}
        <div className="flex items-center gap-3 p-3 bg-surface/50 rounded-md border border-surface-border">
          <div className="w-9 h-9 rounded-full bg-accent/20 text-accent flex items-center justify-center font-bold text-sm shrink-0">
            {owner?.displayName?.charAt(0).toUpperCase() || owner?.email?.charAt(0).toUpperCase() || 'U'}
          </div>
          <div className="flex flex-col min-w-0">
            <span className="text-xs text-text-muted">Folder owner</span>
            <span className="text-sm font-semibold text-text truncate">
              {owner?.displayName || owner?.email || 'Talika User'}
            </span>
            {owner?.displayName && owner?.email && (
              <span className="text-xs text-text-muted truncate">{owner.email}</span>
            )}
          </div>
        </div>

        <p className="text-xs text-text-muted">
          Joining this folder will give you access to view, create, and manage tasks together in real time.
        </p>

        {/* Action Buttons */}
        <div className="flex justify-end gap-2 pt-2 border-t border-surface-border mt-2">
          <Button variant="ghost" onClick={onClose} disabled={loading}>
            Decline
          </Button>
          <Button variant="primary" onClick={handleConfirm} disabled={loading}>
            {loading ? 'Joining…' : 'Join Folder'}
          </Button>
        </div>
      </div>
    </Dialog>
  );
}

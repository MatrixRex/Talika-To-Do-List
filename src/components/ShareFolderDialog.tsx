import { useState, useEffect } from 'react';
import type { Folder, User } from '../lib/schema';
import {
  Dialog,
  Input,
  Button,
  IconButton,
  Icon,
  ListRow,
  type IconName,
  getFolderColorStyle,
} from '../ui';
import {
  lookupUserByEmail,
  fetchUsersByIds,
  shareFolder,
  revokeFolderMember,
  leaveFolder,
  countFolderReminders,
} from '../lib/db';
import { buildFolderShareLink } from '../lib/share-links';

interface ShareFolderDialogProps {
  isOpen: boolean;
  folder: Folder | null;
  currentUserId: string;
  onClose: () => void;
  onFolderUpdated?: () => void;
  onFolderLeft?: () => void;
}

export function ShareFolderDialog({
  isOpen,
  folder,
  currentUserId,
  onClose,
  onFolderUpdated,
  onFolderLeft,
}: ShareFolderDialogProps) {
  const [inviteEmail, setInviteEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [members, setMembers] = useState<User[]>([]);
  const [pendingInviteUser, setPendingInviteUser] = useState<User | null>(null);
  const [remindersCount, setRemindersCount] = useState<number>(0);
  const [isReminderWarningOpen, setIsReminderWarningOpen] = useState(false);
  const [isLeaveConfirmOpen, setIsLeaveConfirmOpen] = useState(false);

  const isOwner = folder ? folder.ownerId === currentUserId : false;
  const memberIdsKey = folder ? folder.memberIds.slice().sort().join(',') : '';

  // Reset dialog state when opening/closing
  useEffect(() => {
    if (isOpen) {
      setErrorMessage(null);
      setSuccessMessage(null);
      setInviteEmail('');
      setCopiedLink(false);
    }
  }, [isOpen]);

  // Load member profiles whenever dialog opens or memberIds change
  useEffect(() => {
    if (isOpen && folder) {
      setLoading(true);
      fetchUsersByIds(folder.memberIds)
        .then((users) => {
          setMembers(users);
          setLoading(false);
        })
        .catch((err) => {
          console.error('Failed to fetch folder members:', err);
          setLoading(false);
        });
    }
  }, [isOpen, folder?.id, memberIdsKey]);

  if (!folder) return null;

  const colorStyle = getFolderColorStyle(folder.color);
  const iconName = (folder.icon as IconName) || 'folder';

  const handleCopyLink = async () => {
    if (!folder) return;
    const link = buildFolderShareLink(folder.id);
    try {
      if (navigator.share && /Android|iPhone|iPad|iPod/i.test(navigator.userAgent)) {
        await navigator.share({
          title: `Join "${folder.name}" on Talika`,
          text: `Collaborate with me on "${folder.name}" on Talika`,
          url: link,
        });
        return;
      }
    } catch (err) {
      if ((err as Error).name === 'AbortError') return;
    }

    try {
      await navigator.clipboard.writeText(link);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2500);
    } catch (err) {
      console.error('Failed to copy link:', err);
    }
  };

  const handleInviteSubmit = async () => {
    if (!inviteEmail.trim()) return;
    setErrorMessage(null);
    setSuccessMessage(null);
    setLoading(true);

    try {
      const user = await lookupUserByEmail(inviteEmail);
      if (!user) {
        setErrorMessage('No user found with that email. Ensure they have signed in to Talika.');
        setLoading(false);
        return;
      }

      if (folder.memberIds.includes(user.uid)) {
        setErrorMessage('User is already a member of this folder.');
        setLoading(false);
        return;
      }

      // Check if folder contains any tasks with reminders (§4)
      const count = await countFolderReminders(folder.id);
      if (count > 0 && folder.memberIds.length === 1) {
        // First time sharing a private folder with reminders -> warn first!
        setRemindersCount(count);
        setPendingInviteUser(user);
        setIsReminderWarningOpen(true);
        setLoading(false);
        return;
      }

      // Execute share
      await executeShare(user);
    } catch (err: unknown) {
      console.error('Invite failed:', err);
      setErrorMessage((err as Error).message || 'Failed to invite user.');
      setLoading(false);
    }
  };

  const executeShare = async (userToInvite: User) => {
    setLoading(true);
    // Optimistically update members list immediately
    setMembers((prev) => [...prev.filter((m) => m.uid !== userToInvite.uid), userToInvite]);

    try {
      const newMemberIds = [...folder.memberIds, userToInvite.uid];
      const result = await shareFolder(folder.id, newMemberIds, currentUserId);

      setSuccessMessage(
        result.strippedCount > 0
          ? `Invited ${userToInvite.displayName || userToInvite.email}. ${result.strippedCount} reminder(s) were removed.`
          : `Invited ${userToInvite.displayName || userToInvite.email} successfully!`
      );
      setInviteEmail('');
      setPendingInviteUser(null);
      setIsReminderWarningOpen(false);

      if (onFolderUpdated) {
        onFolderUpdated();
      }
    } catch (err: unknown) {
      console.error('Execute share error:', err);
      setErrorMessage((err as Error).message || 'Failed to share folder.');
      // Re-fetch members to revert optimistic state on error
      fetchUsersByIds(folder.memberIds).then(setMembers).catch(console.error);
    } finally {
      setLoading(false);
    }
  };

  const handleRevoke = async (memberId: string) => {
    setErrorMessage(null);
    setSuccessMessage(null);
    setLoading(true);

    const prevMembers = members;
    // Optimistically remove member
    setMembers((prev) => prev.filter((m) => m.uid !== memberId));

    try {
      await revokeFolderMember(folder.id, memberId, currentUserId);
      setSuccessMessage('Member removed.');

      if (onFolderUpdated) {
        onFolderUpdated();
      }
    } catch (err: unknown) {
      console.error('Revoke failed:', err);
      setErrorMessage((err as Error).message || 'Failed to remove member.');
      setMembers(prevMembers);
    } finally {
      setLoading(false);
    }
  };

  const handleLeave = async () => {
    setLoading(true);
    try {
      await leaveFolder(folder.id, currentUserId);
      setIsLeaveConfirmOpen(false);
      onClose();
      if (onFolderLeft) {
        onFolderLeft();
      }
    } catch (err: unknown) {
      console.error('Leave folder failed:', err);
      setErrorMessage((err as Error).message || 'Failed to leave folder.');
      setLoading(false);
    }
  };

  return (
    <>
      <Dialog isOpen={isOpen} onClose={onClose}>
        <div className="flex flex-col gap-4 max-h-96 overflow-y-auto">
          {/* Header */}
          <div className="flex items-center gap-3 border-b border-surface-border pb-3">
            <div
              className="p-2 rounded-md flex items-center justify-center shrink-0"
              style={colorStyle.style}
            >
              <Icon name={iconName} />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-base font-bold text-text truncate">
                Share &ldquo;{folder.name}&rdquo;
              </h3>
              <p className="text-xs text-text-muted">
                {isOwner ? 'Manage collaborators and permissions' : 'Shared folder members'}
              </p>
            </div>
          </div>

          {/* Feedback messages */}
          {errorMessage && (
            <div className="text-xs text-danger bg-danger/10 p-2.5 rounded-md border border-danger/20">
              {errorMessage}
            </div>
          )}
          {successMessage && (
            <div className="text-xs text-accent bg-accent/10 p-2.5 rounded-md border border-accent/20">
              {successMessage}
            </div>
          )}

          {/* Share Link Section */}
          <div className="flex flex-col gap-2 p-3 bg-surface/50 rounded-md border border-surface-border">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-text uppercase tracking-wider flex items-center gap-1.5">
                <Icon name="link" className="text-accent" />
                <span>Share Link</span>
              </span>
              {copiedLink && (
                <span className="text-xs text-accent font-medium">
                  Copied to clipboard!
                </span>
              )}
            </div>
            <p className="text-xs text-text-muted">
              Anyone with this link can join this folder as an editor.
            </p>
            <div className="flex items-center gap-2">
              <Input
                readOnly
                value={buildFolderShareLink(folder.id)}
                className="text-xs text-text-muted truncate select-all bg-background cursor-text"
                onClick={(e) => (e.target as HTMLInputElement).select()}
              />
              <Button
                variant="secondary"
                onClick={handleCopyLink}
                className="shrink-0 flex items-center gap-1.5"
              >
                <Icon name={copiedLink ? 'check' : 'copy'} className={copiedLink ? 'text-accent' : ''} />
                <span>{copiedLink ? 'Copied' : 'Copy'}</span>
              </Button>
            </div>
          </div>

          {/* Invite Section (Owner only) */}
          {isOwner && (
            <div className="flex flex-col gap-2">
              <label className="text-xs font-semibold text-text uppercase tracking-wider">
                Invite Collaborator
              </label>
              <div className="flex gap-2">
                <Input
                  type="email"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  placeholder="collaborator@example.com"
                  onKeyDown={(e) => e.key === 'Enter' && handleInviteSubmit()}
                  disabled={loading}
                />
                <Button
                  variant="primary"
                  onClick={handleInviteSubmit}
                  disabled={loading || !inviteEmail.trim()}
                >
                  Invite
                </Button>
              </div>
            </div>
          )}

          {/* Members List */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-text uppercase tracking-wider">
                Members ({folder.memberIds.length})
              </label>
            </div>

            <div className="flex flex-col gap-1 max-h-48 overflow-y-auto">
              {members.map((member) => {
                const role = (folder.roles && folder.roles[member.uid]) || (member.uid === folder.ownerId ? 'owner' : 'editor');
                const isSelf = member.uid === currentUserId;
                const isMemberOwner = role === 'owner';

                return (
                  <ListRow
                    key={member.uid}
                    className="flex items-center justify-between py-2 px-3 bg-surface/50 rounded-md"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-7 h-7 rounded-full bg-accent/20 text-accent flex items-center justify-center font-bold text-xs shrink-0">
                        {member.displayName?.charAt(0).toUpperCase() || member.email?.charAt(0).toUpperCase() || 'U'}
                      </div>
                      <div className="flex flex-col min-w-0">
                        <span className="text-xs font-medium text-text truncate">
                          {member.displayName || member.email} {isSelf ? '(You)' : ''}
                        </span>
                        <span className="text-xs text-text-muted truncate">
                          {member.email}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <span className={`text-xs uppercase font-semibold px-2 py-0.5 rounded-full ${
                        isMemberOwner
                          ? 'bg-accent text-white'
                          : 'bg-surface text-text-muted border border-border'
                      }`}>
                        {role}
                      </span>

                      {/* Owner can revoke other members */}
                      {isOwner && !isMemberOwner && (
                        <IconButton
                          aria-label={`Remove ${member.displayName || member.email}`}
                          onClick={() => handleRevoke(member.uid)}
                          disabled={loading}
                        >
                          <Icon name="trash" className="text-danger hover:opacity-80" />
                        </IconButton>
                      )}
                    </div>
                  </ListRow>
                );
              })}

              {members.length === 0 && !loading && (
                <div className="text-xs text-text-muted text-center py-4">
                  No member details available.
                </div>
              )}
            </div>
          </div>

          {/* Footer Actions */}
          <div className="flex items-center justify-between pt-2 border-t border-surface-border mt-2">
            {!isOwner ? (
              <Button
                variant="danger"
                onClick={() => setIsLeaveConfirmOpen(true)}
                disabled={loading}
              >
                <Icon name="logOut" />
                <span>Leave Folder</span>
              </Button>
            ) : (
              <div />
            )}
            <Button variant="ghost" onClick={onClose}>
              Done
            </Button>
          </div>
        </div>
      </Dialog>

      {/* Reminder Warning Dialog (§4) */}
      <Dialog
        isOpen={isReminderWarningOpen}
        onClose={() => {
          setIsReminderWarningOpen(false);
          setPendingInviteUser(null);
        }}
      >
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-2 text-danger">
            <Icon name="bellOff" />
            <h3 className="text-lg font-bold">Reminders will be removed</h3>
          </div>
          <p className="text-sm text-text-muted">
            {remindersCount} {remindersCount === 1 ? 'task' : 'tasks'} in this folder {remindersCount === 1 ? 'has a reminder' : 'have reminders'}. Sharing will remove them because reminders are private-only.
          </p>
          <div className="flex justify-end gap-2 mt-3">
            <Button
              variant="ghost"
              onClick={() => {
                setIsReminderWarningOpen(false);
                setPendingInviteUser(null);
              }}
            >
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={() => {
                if (pendingInviteUser) {
                  executeShare(pendingInviteUser);
                }
              }}
            >
              Share & Remove Reminders
            </Button>
          </div>
        </div>
      </Dialog>

      {/* Leave Folder Confirmation Dialog */}
      <Dialog isOpen={isLeaveConfirmOpen} onClose={() => setIsLeaveConfirmOpen(false)}>
        <div className="flex flex-col gap-3">
          <h3 className="text-lg font-bold text-text">Leave &ldquo;{folder.name}&rdquo;?</h3>
          <p className="text-sm text-text-muted">
            You will lose access to this shared folder and all its tasks.
          </p>
          <div className="flex justify-end gap-2 mt-3">
            <Button variant="ghost" onClick={() => setIsLeaveConfirmOpen(false)}>
              Cancel
            </Button>
            <Button variant="danger" onClick={handleLeave}>
              Leave Folder
            </Button>
          </div>
        </div>
      </Dialog>
    </>
  );
}

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Timestamp } from 'firebase/firestore';
import type { Item, Reminder } from './schema';
import {
  initializeNotifications,
  scheduleItemReminder,
  cancelItemReminder,
  rescheduleAllReminders,
  showWebNotification,
  getActiveWebTimersCount,
  clearAllWebTimers,
} from './notifications';

describe('Web / PWA Notifications Unit Tests', () => {
  const userA = 'user-alice';
  const userB = 'user-bob';

  const createMockItem = (overrides?: Partial<Item>): Item => ({
    id: 'test-item-1',
    folderId: null,
    parentId: null,
    ownerId: userA,
    memberIds: [userA],
    title: 'Buy Groceries',
    done: false,
    completedAt: null,
    sortKey: 'a0',
    reminder: null,
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
    updatedBy: userA,
    ...overrides,
  });

  beforeEach(() => {
    vi.useFakeTimers();
    clearAllWebTimers();

    // Mock global window and Notification
    const mockNotification = vi.fn() as unknown as typeof Notification;
    Object.defineProperty(mockNotification, 'permission', {
      value: 'granted',
      writable: true,
      configurable: true,
    });
    mockNotification.requestPermission = vi.fn().mockResolvedValue('granted');

    vi.stubGlobal('Notification', mockNotification);
    vi.stubGlobal('navigator', {
      serviceWorker: undefined,
    });
  });

  afterEach(() => {
    clearAllWebTimers();
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  describe('initializeNotifications', () => {
    it('returns true when Notification permission is already granted', async () => {
      (Notification as unknown as { permission: string }).permission = 'granted';
      const result = await initializeNotifications();
      expect(result).toBe(true);
    });

    it('requests permission when Notification permission is default', async () => {
      (Notification as unknown as { permission: string }).permission = 'default';
      const requestSpy = vi.spyOn(Notification, 'requestPermission').mockResolvedValue('granted');

      const result = await initializeNotifications();
      expect(requestSpy).toHaveBeenCalled();
      expect(result).toBe(true);
    });

    it('returns false when Notification permission is denied', async () => {
      (Notification as unknown as { permission: string }).permission = 'denied';
      const result = await initializeNotifications();
      expect(result).toBe(false);
    });
  });

  describe('scheduleItemReminder on Web / PWA', () => {
    it('sets an active web timer for a future reminder on a private task', async () => {
      const futureDate = new Date(Date.now() + 60000); // 1 minute in future
      const reminder: Reminder = {
        fireAt: Timestamp.fromDate(futureDate),
        recurrence: { kind: 'once' },
      };
      const item = createMockItem({ id: 'item-future', reminder });

      await scheduleItemReminder(item);
      expect(getActiveWebTimersCount()).toBe(1);

      // Fast-forward time to trigger notification
      vi.advanceTimersByTime(60000);

      expect(Notification).toHaveBeenCalledWith('Talika Reminder', expect.objectContaining({
        body: 'Buy Groceries',
        tag: 'talika-reminder-item-future',
      }));
      expect(getActiveWebTimersCount()).toBe(0);
    });

    it('rejects reminder on completed items', async () => {
      const futureDate = new Date(Date.now() + 60000);
      const reminder: Reminder = {
        fireAt: Timestamp.fromDate(futureDate),
        recurrence: { kind: 'once' },
      };
      const item = createMockItem({ done: true, reminder });

      await scheduleItemReminder(item);
      expect(getActiveWebTimersCount()).toBe(0);
    });

    it('rejects reminder on shared items (Invariant 5: memberIds.length > 1)', async () => {
      const futureDate = new Date(Date.now() + 60000);
      const reminder: Reminder = {
        fireAt: Timestamp.fromDate(futureDate),
        recurrence: { kind: 'daily' },
      };
      const sharedItem = createMockItem({ memberIds: [userA, userB], reminder });

      await scheduleItemReminder(sharedItem);
      expect(getActiveWebTimersCount()).toBe(0);
    });
  });

  describe('cancelItemReminder on Web / PWA', () => {
    it('clears the active timer for an item', async () => {
      const futureDate = new Date(Date.now() + 60000);
      const reminder: Reminder = {
        fireAt: Timestamp.fromDate(futureDate),
        recurrence: { kind: 'once' },
      };
      const item = createMockItem({ id: 'item-to-cancel', reminder });

      await scheduleItemReminder(item);
      expect(getActiveWebTimersCount()).toBe(1);

      await cancelItemReminder('item-to-cancel');
      expect(getActiveWebTimersCount()).toBe(0);

      // Advance time and ensure notification did NOT fire
      vi.advanceTimersByTime(60000);
      expect(Notification).not.toHaveBeenCalled();
    });
  });

  describe('rescheduleAllReminders on Web / PWA', () => {
    it('clears previous timers and reschedules all eligible private items', async () => {
      const futureDate1 = new Date(Date.now() + 30000);
      const futureDate2 = new Date(Date.now() + 60000);

      const items: Item[] = [
        createMockItem({
          id: 'task-1',
          reminder: { fireAt: Timestamp.fromDate(futureDate1), recurrence: { kind: 'once' } },
        }),
        createMockItem({
          id: 'task-2',
          reminder: { fireAt: Timestamp.fromDate(futureDate2), recurrence: { kind: 'daily' } },
        }),
        createMockItem({
          id: 'task-done',
          done: true,
          reminder: { fireAt: Timestamp.fromDate(futureDate1), recurrence: { kind: 'once' } },
        }),
        createMockItem({
          id: 'task-shared',
          memberIds: [userA, userB],
          reminder: { fireAt: Timestamp.fromDate(futureDate1), recurrence: { kind: 'daily' } },
        }),
      ];

      await rescheduleAllReminders(items);
      // Only task-1 and task-2 are eligible
      expect(getActiveWebTimersCount()).toBe(2);
    });
  });

  describe('showWebNotification with Service Worker vs Notification fallback', () => {
    it('uses ServiceWorkerRegistration.showNotification when ServiceWorker is available', async () => {
      const showNotificationMock = vi.fn().mockResolvedValue(undefined);
      vi.stubGlobal('navigator', {
        serviceWorker: {
          ready: Promise.resolve({
            showNotification: showNotificationMock,
          }),
        },
      });

      await showWebNotification('Task Due', { body: 'Check Talika' });
      expect(showNotificationMock).toHaveBeenCalledWith('Task Due', expect.objectContaining({
        body: 'Check Talika',
        icon: './favicon.svg',
      }));
    });

    it('falls back to window.Notification if Service Worker is not available', async () => {
      vi.stubGlobal('navigator', {});

      await showWebNotification('Task Due', { body: 'Check Talika' });
      expect(Notification).toHaveBeenCalledWith('Task Due', expect.objectContaining({
        body: 'Check Talika',
        icon: './favicon.svg',
      }));
    });
  });
});

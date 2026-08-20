import { LocalNotifications } from '@capacitor/local-notifications';
import { Capacitor } from '@capacitor/core';
import type { Item } from './schema';
import { catchUpMissedReminder } from './recurrence';

const CHANNEL_ID = 'talika-task-reminders';

// In-memory web notification timers for browser/PWA environment
const activeWebTimers = new Map<string, ReturnType<typeof setTimeout>>();

/**
 * Creates a deterministic 32-bit positive integer ID from an item's string ID for Capacitor.
 */
function hashItemIdToNotificationId(id: string): number {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    const char = id.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0; // Convert to 32bit integer
  }
  return Math.abs(hash) % 2147483647 || 1;
}

/**
 * Initializes notification channel (for Android) and requests permissions if needed.
 * Supports both Capacitor native and Web/PWA environments.
 */
export async function initializeNotifications(): Promise<boolean> {
  if (Capacitor.isNativePlatform() && Capacitor.isPluginAvailable('LocalNotifications')) {
    try {
      const permissionStatus = await LocalNotifications.checkPermissions();
      if (permissionStatus.display !== 'granted') {
        const requested = await LocalNotifications.requestPermissions();
        if (requested.display !== 'granted') {
          return false;
        }
      }

      if (Capacitor.getPlatform() === 'android') {
        await LocalNotifications.createChannel({
          id: CHANNEL_ID,
          name: 'Task Reminders',
          description: 'Notifications for scheduled to-do task reminders',
          importance: 5,
          visibility: 1,
          vibration: true,
        });
      }

      return true;
    } catch (err) {
      console.warn('Failed to initialize local notifications', err);
      return false;
    }
  }

  // Web / PWA fallback
  if (typeof window !== 'undefined' && 'Notification' in window) {
    try {
      if (Notification.permission === 'default') {
        const result = await Notification.requestPermission();
        return result === 'granted';
      }
      return Notification.permission === 'granted';
    } catch (err) {
      console.warn('Failed to initialize web notifications', err);
      return false;
    }
  }

  return false;
}

/**
 * Displays a Web / PWA notification using ServiceWorker if available,
 * falling back to window.Notification.
 */
export async function showWebNotification(
  title: string,
  options?: NotificationOptions
): Promise<void> {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return;
  }

  if (Notification.permission !== 'granted') {
    return;
  }

  // 1. Try ServiceWorkerRegistration.showNotification first (best for PWA & mobile browsers)
  if ('serviceWorker' in navigator) {
    try {
      const reg = await navigator.serviceWorker.ready;
      if (reg && 'showNotification' in reg) {
        await reg.showNotification(title, {
          icon: './favicon.svg',
          badge: './favicon.svg',
          ...options,
        });
        return;
      }
    } catch (err) {
      console.warn('Failed to show notification via service worker', err);
    }
  }

  // 2. Fall back to window.Notification constructor (desktop browsers)
  try {
    new Notification(title, {
      icon: './favicon.svg',
      ...options,
    });
  } catch (err) {
    console.warn('Failed to show notification via Notification API', err);
  }
}

/**
 * Schedules or updates a notification for a specific task.
 * Uses Capacitor LocalNotifications on mobile and Web timers / notifications on PWA.
 */
export async function scheduleItemReminder(item: Item): Promise<void> {
  if (!item.reminder || item.done || item.memberIds.length > 1) {
    await cancelItemReminder(item.id);
    return;
  }

  const caughtUp = catchUpMissedReminder(item.reminder);
  if (!caughtUp) {
    await cancelItemReminder(item.id);
    return;
  }

  const fireDate = caughtUp.fireAt.toDate();
  const now = Date.now();
  const delayMs = fireDate.getTime() - now;

  if (delayMs <= 0) {
    await cancelItemReminder(item.id);
    return;
  }

  if (Capacitor.isNativePlatform() && Capacitor.isPluginAvailable('LocalNotifications')) {
    try {
      const notificationId = hashItemIdToNotificationId(item.id);

      // Cancel any previous notification for this task ID first
      await LocalNotifications.cancel({ notifications: [{ id: notificationId }] });

      await LocalNotifications.schedule({
        notifications: [
          {
            id: notificationId,
            title: 'Talika Reminder',
            body: item.title,
            channelId: CHANNEL_ID,
            schedule: {
              at: fireDate,
              allowWhileIdle: true,
            },
            extra: {
              itemId: item.id,
              folderId: item.folderId,
            },
          },
        ],
      });
    } catch (err) {
      console.warn(`Could not schedule notification for item ${item.id}`, err);
    }
  } else if (typeof window !== 'undefined' && 'Notification' in window) {
    // Web / PWA timer scheduling
    // Cancel any existing web timer for this item
    if (activeWebTimers.has(item.id)) {
      clearTimeout(activeWebTimers.get(item.id));
      activeWebTimers.delete(item.id);
    }

    // Check / request permission in background if needed
    if (Notification.permission === 'default') {
      Notification.requestPermission().catch(() => {});
    }

    // Max 32-bit signed int for setTimeout is 2147483647 ms (~24.8 days)
    if (delayMs > 0 && delayMs < 2147483647) {
      const timer = setTimeout(async () => {
        activeWebTimers.delete(item.id);
        await showWebNotification('Talika Reminder', {
          body: item.title,
          tag: `talika-reminder-${item.id}`,
          data: {
            itemId: item.id,
            folderId: item.folderId,
            url: './',
          },
        });
      }, delayMs);

      activeWebTimers.set(item.id, timer);
    }
  }
}

/**
 * Cancels any scheduled notification for a task.
 */
export async function cancelItemReminder(itemId: string): Promise<void> {
  if (activeWebTimers.has(itemId)) {
    clearTimeout(activeWebTimers.get(itemId));
    activeWebTimers.delete(itemId);
  }

  if (Capacitor.isNativePlatform() && Capacitor.isPluginAvailable('LocalNotifications')) {
    try {
      const notificationId = hashItemIdToNotificationId(itemId);
      await LocalNotifications.cancel({ notifications: [{ id: notificationId }] });
    } catch (err) {
      console.warn(`Could not cancel notification for item ${itemId}`, err);
    }
  }
}

/**
 * Reschedules all active reminders (runs on app open and device boot).
 */
export async function rescheduleAllReminders(items: Item[]): Promise<void> {
  const isAvailable = await initializeNotifications();
  if (!isAvailable) {
    // If not available/permitted, clear any lingering web timers
    clearAllWebTimers();
    return;
  }

  try {
    if (Capacitor.isNativePlatform() && Capacitor.isPluginAvailable('LocalNotifications')) {
      const pending = await LocalNotifications.getPending();
      if (pending.notifications.length > 0) {
        await LocalNotifications.cancel({ notifications: pending.notifications });
      }
    } else {
      clearAllWebTimers();
    }

    const eligibleItems = items.filter(
      (item) => item.reminder !== null && !item.done && item.memberIds.length === 1
    );

    for (const item of eligibleItems) {
      await scheduleItemReminder(item);
    }
  } catch (err) {
    console.warn('Error rescheduling all reminders', err);
  }
}

/**
 * Returns the count of active web timers (primarily for test verification).
 */
export function getActiveWebTimersCount(): number {
  return activeWebTimers.size;
}

/**
 * Clears all active in-memory web timers.
 */
export function clearAllWebTimers(): void {
  for (const timer of activeWebTimers.values()) {
    clearTimeout(timer);
  }
  activeWebTimers.clear();
}


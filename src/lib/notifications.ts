import { LocalNotifications } from '@capacitor/local-notifications';
import { Capacitor } from '@capacitor/core';
import type { Item } from './schema';
import { catchUpMissedReminder } from './recurrence';

const CHANNEL_ID = 'talika-task-reminders';

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
 */
export async function initializeNotifications(): Promise<boolean> {
  if (!Capacitor.isPluginAvailable('LocalNotifications')) {
    return false;
  }

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

/**
 * Schedules or updates a local notification for a specific task.
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
  if (fireDate.getTime() <= Date.now()) {
    return;
  }

  if (Capacitor.isPluginAvailable('LocalNotifications')) {
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
    // Browser fallback
    if (Notification.permission === 'default') {
      Notification.requestPermission().catch(() => {});
    }
  }
}

/**
 * Cancels any scheduled notification for a task.
 */
export async function cancelItemReminder(itemId: string): Promise<void> {
  if (Capacitor.isPluginAvailable('LocalNotifications')) {
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
  if (!isAvailable) return;

  try {
    const pending = await LocalNotifications.getPending();
    if (pending.notifications.length > 0) {
      await LocalNotifications.cancel({ notifications: pending.notifications });
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

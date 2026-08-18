import { Timestamp } from 'firebase/firestore';
import type { Reminder } from './schema';

/**
 * Returns number of days in a given month and year.
 * month is 0-indexed (0 = January, 1 = February, etc.)
 */
export function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

/**
 * Computes the next occurrence of a reminder after `currentFireAt`.
 * Preserves local wall-clock time across DST transitions and handles month-end clamping.
 */
export function getNextOccurrence(
  currentFireAt: Date,
  recurrence: Reminder['recurrence'],
  referenceDate?: Date
): Date | null {
  const ref = referenceDate || currentFireAt;
  const targetHour = currentFireAt.getHours();
  const targetMinute = currentFireAt.getMinutes();
  const targetSecond = currentFireAt.getSeconds();
  const targetMs = currentFireAt.getMilliseconds();

  switch (recurrence.kind) {
    case 'once': {
      return null;
    }

    case 'daily': {
      const next = new Date(currentFireAt.getTime());
      do {
        next.setDate(next.getDate() + 1);
        next.setHours(targetHour, targetMinute, targetSecond, targetMs);
      } while (next <= ref);
      return next;
    }

    case 'weekly': {
      if (!recurrence.days || recurrence.days.length === 0) return null;
      const sortedDays = [...recurrence.days].sort((a, b) => a - b);
      const next = new Date(currentFireAt.getTime());

      do {
        next.setDate(next.getDate() + 1);
        next.setHours(targetHour, targetMinute, targetSecond, targetMs);
      } while (!sortedDays.includes(next.getDay()) || next <= ref);

      return next;
    }

    case 'monthly': {
      const configuredDay = recurrence.day;
      let year = currentFireAt.getFullYear();
      let month = currentFireAt.getMonth();

      let next: Date;
      do {
        month += 1;
        if (month > 11) {
          month = 0;
          year += 1;
        }
        const daysInMonth = getDaysInMonth(year, month);
        const targetDay = Math.min(configuredDay, daysInMonth);
        next = new Date(year, month, targetDay, targetHour, targetMinute, targetSecond, targetMs);
      } while (next <= ref);

      return next;
    }

    case 'interval': {
      const { n, unit } = recurrence;
      if (n <= 0) return null;

      const next = new Date(currentFireAt.getTime());
      const baseDay = currentFireAt.getDate();

      if (unit === 'day') {
        do {
          next.setDate(next.getDate() + n);
          next.setHours(targetHour, targetMinute, targetSecond, targetMs);
        } while (next <= ref);
        return next;
      }

      if (unit === 'week') {
        do {
          next.setDate(next.getDate() + n * 7);
          next.setHours(targetHour, targetMinute, targetSecond, targetMs);
        } while (next <= ref);
        return next;
      }

      if (unit === 'month') {
        let year = currentFireAt.getFullYear();
        let month = currentFireAt.getMonth();

        do {
          month += n;
          year += Math.floor(month / 12);
          month = ((month % 12) + 12) % 12;

          const daysInMonth = getDaysInMonth(year, month);
          const targetDay = Math.min(baseDay, daysInMonth);
          next.setFullYear(year, month, targetDay);
          next.setHours(targetHour, targetMinute, targetSecond, targetMs);
        } while (next <= ref);

        return next;
      }

      return null;
    }

    default:
      return null;
  }
}

/**
 * When device was powered off or app not opened, advances overdue recurring reminders
 * to their next upcoming valid fire date strictly in the future relative to `now`.
 * Returns null if the reminder was a one-time reminder that has expired.
 */
export function catchUpMissedReminder(reminder: Reminder, now: Date = new Date()): Reminder | null {
  const currentFireDate = reminder.fireAt.toDate();
  if (currentFireDate.getTime() > now.getTime()) {
    return reminder; // Still in the future
  }

  if (reminder.recurrence.kind === 'once') {
    return null; // Expired one-off reminder
  }

  const nextOccurrence = getNextOccurrence(currentFireDate, reminder.recurrence, now);
  if (!nextOccurrence) {
    return null;
  }

  return {
    ...reminder,
    fireAt: Timestamp.fromDate(nextOccurrence)
  };
}

const WEEKDAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/**
 * Formats a reminder into a clean semantic string representation.
 */
export function formatReminder(reminder: Reminder): string {
  const fireDate = reminder.fireAt.toDate();
  const timeStr = fireDate.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  const dateStr = fireDate.toLocaleDateString([], { month: 'short', day: 'numeric' });

  switch (reminder.recurrence.kind) {
    case 'once':
      return `${dateStr} at ${timeStr}`;
    case 'daily':
      return `Daily at ${timeStr}`;
    case 'weekly': {
      const days = reminder.recurrence.days.map(d => WEEKDAY_NAMES[d]).join(', ');
      return `Weekly on ${days} at ${timeStr}`;
    }
    case 'monthly':
      return `Monthly on the ${getOrdinal(reminder.recurrence.day)} at ${timeStr}`;
    case 'interval': {
      const { n, unit } = reminder.recurrence;
      const unitLabel = n === 1 ? unit : `${unit}s`;
      return `Every ${n} ${unitLabel} at ${timeStr}`;
    }
    default:
      return `${dateStr} at ${timeStr}`;
  }
}

function getOrdinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

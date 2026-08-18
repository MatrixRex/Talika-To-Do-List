import { describe, it, expect } from 'vitest';
import {
  getNextOccurrence,
  catchUpMissedReminder,
  formatReminder
} from './recurrence';
import type { Reminder } from './schema';
import { Timestamp } from 'firebase/firestore';

describe('Recurrence Date Math (Stage 6 Exit Suite)', () => {
  describe('Monthly on 31st — Month-End Clamping', () => {
    it('correctly clamps Jan 31 to Feb 28 on a non-leap year (2026) and returns to Mar 31', () => {
      const jan31 = new Date(2026, 0, 31, 9, 30, 0); // Jan 31, 2026 09:30
      const recurrence: Reminder['recurrence'] = { kind: 'monthly', day: 31 };

      // Next after Jan 31 should be Feb 28, 2026 09:30
      const feb = getNextOccurrence(jan31, recurrence);
      expect(feb).not.toBeNull();
      expect(feb!.getFullYear()).toBe(2026);
      expect(feb!.getMonth()).toBe(1); // February (0-indexed)
      expect(feb!.getDate()).toBe(28);
      expect(feb!.getHours()).toBe(9);
      expect(feb!.getMinutes()).toBe(30);

      // Next after Feb 28 should be Mar 31, 2026 09:30 (restoring day 31!)
      const mar = getNextOccurrence(feb!, recurrence);
      expect(mar).not.toBeNull();
      expect(mar!.getFullYear()).toBe(2026);
      expect(mar!.getMonth()).toBe(2); // March
      expect(mar!.getDate()).toBe(31);
      expect(mar!.getHours()).toBe(9);
      expect(mar!.getMinutes()).toBe(30);

      // Next after Mar 31 should be Apr 30, 2026 09:30 (April has 30 days)
      const apr = getNextOccurrence(mar!, recurrence);
      expect(apr).not.toBeNull();
      expect(apr!.getFullYear()).toBe(2026);
      expect(apr!.getMonth()).toBe(3); // April
      expect(apr!.getDate()).toBe(30);
      expect(apr!.getHours()).toBe(9);
      expect(apr!.getMinutes()).toBe(30);
    });

    it('correctly clamps Jan 31 to Feb 29 on a leap year (2024)', () => {
      const jan31Leap = new Date(2024, 0, 31, 14, 0, 0); // Jan 31, 2024
      const recurrence: Reminder['recurrence'] = { kind: 'monthly', day: 31 };

      const febLeap = getNextOccurrence(jan31Leap, recurrence);
      expect(febLeap).not.toBeNull();
      expect(febLeap!.getFullYear()).toBe(2024);
      expect(febLeap!.getMonth()).toBe(1);
      expect(febLeap!.getDate()).toBe(29); // Feb 29 in leap year
      expect(febLeap!.getHours()).toBe(14);
      expect(febLeap!.getMinutes()).toBe(0);
    });
  });

  describe('Weekly Recurrence & DST Transitions', () => {
    it('preserves wall-clock time across Spring Forward DST transition', () => {
      // 2026 US Spring forward: Sunday, March 8, 2026
      // Reminder every Monday at 09:00:00
      const recurrence: Reminder['recurrence'] = { kind: 'weekly', days: [1] }; // Monday = 1
      const mondayBeforeDST = new Date(2026, 2, 2, 9, 0, 0); // Mon Mar 2, 2026 09:00

      const mondayAfterDST = getNextOccurrence(mondayBeforeDST, recurrence);
      expect(mondayAfterDST).not.toBeNull();
      expect(mondayAfterDST!.getFullYear()).toBe(2026);
      expect(mondayAfterDST!.getMonth()).toBe(2);
      expect(mondayAfterDST!.getDate()).toBe(9); // Mon Mar 9, 2026
      expect(mondayAfterDST!.getHours()).toBe(9); // Exact wall-clock hour preserved!
      expect(mondayAfterDST!.getMinutes()).toBe(0);
    });

    it('preserves wall-clock time across Fall Back DST transition', () => {
      // 2026 US Fall back: Sunday, November 1, 2026
      // Reminder every Monday at 09:00:00
      const recurrence: Reminder['recurrence'] = { kind: 'weekly', days: [1] }; // Monday = 1
      const mondayBeforeFallBack = new Date(2026, 9, 26, 9, 0, 0); // Mon Oct 26, 2026 09:00

      const mondayAfterFallBack = getNextOccurrence(mondayBeforeFallBack, recurrence);
      expect(mondayAfterFallBack).not.toBeNull();
      expect(mondayAfterFallBack!.getFullYear()).toBe(2026);
      expect(mondayAfterFallBack!.getMonth()).toBe(10);
      expect(mondayAfterFallBack!.getDate()).toBe(2); // Mon Nov 2, 2026
      expect(mondayAfterFallBack!.getHours()).toBe(9); // Exact wall-clock hour preserved!
      expect(mondayAfterFallBack!.getMinutes()).toBe(0);
    });

    it('cycles through multiple days in a weekly pattern (e.g., Mon, Wed, Fri)', () => {
      // Mon(1), Wed(3), Fri(5) at 18:00
      const recurrence: Reminder['recurrence'] = { kind: 'weekly', days: [1, 3, 5] };
      const monday = new Date(2026, 5, 1, 18, 0, 0); // Mon Jun 1, 2026

      const wednesday = getNextOccurrence(monday, recurrence);
      expect(wednesday!.getDay()).toBe(3);
      expect(wednesday!.getDate()).toBe(3);

      const friday = getNextOccurrence(wednesday!, recurrence);
      expect(friday!.getDay()).toBe(5);
      expect(friday!.getDate()).toBe(5);

      const nextMonday = getNextOccurrence(friday!, recurrence);
      expect(nextMonday!.getDay()).toBe(1);
      expect(nextMonday!.getDate()).toBe(8);
    });
  });

  describe('Offline Catch-Up (Device off for multiple days)', () => {
    it('advances a daily reminder missed over 3 days to the next future occurrence', () => {
      const scheduledFireAt = new Date(2026, 5, 1, 9, 0, 0); // June 1 at 09:00
      const recurrence: Reminder['recurrence'] = { kind: 'daily' };
      
      const reminder: Reminder = {
        fireAt: Timestamp.fromDate(scheduledFireAt),
        recurrence
      };

      // Device boots on June 4 at 14:00 (missed June 1 09:00, June 2 09:00, June 3 09:00, June 4 09:00)
      const bootedAt = new Date(2026, 5, 4, 14, 0, 0);
      const caughtUp = catchUpMissedReminder(reminder, bootedAt);

      expect(caughtUp).not.toBeNull();
      const nextDate = caughtUp!.fireAt.toDate();
      expect(nextDate.getFullYear()).toBe(2026);
      expect(nextDate.getMonth()).toBe(5); // June
      expect(nextDate.getDate()).toBe(5); // June 5 at 09:00
      expect(nextDate.getHours()).toBe(9);
      expect(nextDate.getMinutes()).toBe(0);
    });

    it('returns null for overdue "once" reminders', () => {
      const scheduledFireAt = new Date(2026, 5, 1, 9, 0, 0);
      const reminder: Reminder = {
        fireAt: Timestamp.fromDate(scheduledFireAt),
        recurrence: { kind: 'once' }
      };

      const bootedAt = new Date(2026, 5, 2, 10, 0, 0);
      const caughtUp = catchUpMissedReminder(reminder, bootedAt);
      expect(caughtUp).toBeNull();
    });
  });

  describe('Interval Recurrence', () => {
    it('correctly increments by interval days, weeks, and months', () => {
      // Every 3 days
      const startDay = new Date(2026, 0, 10, 10, 0, 0);
      const next3Days = getNextOccurrence(startDay, { kind: 'interval', n: 3, unit: 'day' });
      expect(next3Days!.getDate()).toBe(13);

      // Every 2 weeks
      const next2Weeks = getNextOccurrence(startDay, { kind: 'interval', n: 2, unit: 'week' });
      expect(next2Weeks!.getDate()).toBe(24);

      // Every 2 months on Jan 31 -> Mar 31 -> May 31
      const jan31 = new Date(2026, 0, 31, 10, 0, 0);
      const next2Months = getNextOccurrence(jan31, { kind: 'interval', n: 2, unit: 'month' });
      expect(next2Months!.getMonth()).toBe(2); // March
      expect(next2Months!.getDate()).toBe(31);
    });
  });

  describe('Format Reminder', () => {
    it('formats recurrence rules into human-readable strings', () => {
      const now = new Date(2026, 5, 1, 9, 0, 0);
      const dailyReminder: Reminder = {
        fireAt: Timestamp.fromDate(now),
        recurrence: { kind: 'daily' }
      };
      expect(formatReminder(dailyReminder)).toContain('Daily');

      const weeklyReminder: Reminder = {
        fireAt: Timestamp.fromDate(now),
        recurrence: { kind: 'weekly', days: [1, 3] }
      };
      expect(formatReminder(weeklyReminder)).toContain('Mon');

      const monthlyReminder: Reminder = {
        fireAt: Timestamp.fromDate(now),
        recurrence: { kind: 'monthly', day: 31 }
      };
      expect(formatReminder(monthlyReminder)).toContain('Monthly');
    });
  });
});

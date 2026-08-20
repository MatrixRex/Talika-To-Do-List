import { useState, useEffect } from 'react';
import type { Reminder } from '../lib/schema';
import { Dialog, Button, Input } from '../ui';
import { Icon } from '../ui/icons';
import { Timestamp } from 'firebase/firestore';

interface ReminderDialogProps {
  isOpen: boolean;
  onClose: () => void;
  currentReminder: Reminder | null;
  onSave: (reminder: Reminder | null) => void;
}

type RecurrenceType = 'once' | 'daily' | 'weekly' | 'monthly' | 'interval';

const WEEKDAYS = [
  { label: 'S', name: 'Sun', value: 0 },
  { label: 'M', name: 'Mon', value: 1 },
  { label: 'T', name: 'Tue', value: 2 },
  { label: 'W', name: 'Wed', value: 3 },
  { label: 'T', name: 'Thu', value: 4 },
  { label: 'F', name: 'Fri', value: 5 },
  { label: 'S', name: 'Sat', value: 6 },
];

export function ReminderDialog({
  isOpen,
  onClose,
  currentReminder,
  onSave,
}: ReminderDialogProps) {
  const [kind, setKind] = useState<RecurrenceType>('once');
  const [dateStr, setDateStr] = useState('');
  const [timeStr, setTimeStr] = useState('09:00');
  const [selectedDays, setSelectedDays] = useState<number[]>([1]); // Monday default
  const [monthlyDay, setMonthlyDay] = useState(1);
  const [intervalN, setIntervalN] = useState(1);
  const [intervalUnit, setIntervalUnit] = useState<'day' | 'week' | 'month'>('day');

  useEffect(() => {
    if (currentReminder) {
      const d = currentReminder.fireAt.toDate();
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      const hours = String(d.getHours()).padStart(2, '0');
      const minutes = String(d.getMinutes()).padStart(2, '0');

      setDateStr(`${year}-${month}-${day}`);
      setTimeStr(`${hours}:${minutes}`);
      setKind(currentReminder.recurrence.kind);

      if (currentReminder.recurrence.kind === 'weekly') {
        setSelectedDays(currentReminder.recurrence.days);
      } else if (currentReminder.recurrence.kind === 'monthly') {
        setMonthlyDay(currentReminder.recurrence.day);
      } else if (currentReminder.recurrence.kind === 'interval') {
        setIntervalN(currentReminder.recurrence.n);
        setIntervalUnit(currentReminder.recurrence.unit);
      }
    } else {
      // Default: Tomorrow at 09:00
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const year = tomorrow.getFullYear();
      const month = String(tomorrow.getMonth() + 1).padStart(2, '0');
      const day = String(tomorrow.getDate()).padStart(2, '0');

      setDateStr(`${year}-${month}-${day}`);
      setTimeStr('09:00');
      setKind('once');
      setSelectedDays([1]);
      setMonthlyDay(tomorrow.getDate());
      setIntervalN(1);
      setIntervalUnit('day');
    }
  }, [currentReminder, isOpen]);

  const toggleDay = (dayVal: number) => {
    if (selectedDays.includes(dayVal)) {
      if (selectedDays.length > 1) {
        setSelectedDays(selectedDays.filter((d) => d !== dayVal));
      }
    } else {
      setSelectedDays([...selectedDays, dayVal].sort((a, b) => a - b));
    }
  };

  const handleSave = () => {
    const [hours, minutes] = timeStr.split(':').map(Number);
    let targetDate: Date;

    if (kind === 'once') {
      const [year, month, day] = dateStr.split('-').map(Number);
      targetDate = new Date(year, month - 1, day, hours, minutes, 0, 0);
    } else {
      targetDate = new Date();
      targetDate.setHours(hours, minutes, 0, 0);
      if (targetDate.getTime() <= Date.now()) {
        targetDate.setDate(targetDate.getDate() + 1);
      }
    }

    let recurrence: Reminder['recurrence'];

    if (kind === 'once') {
      recurrence = { kind: 'once' };
    } else if (kind === 'daily') {
      recurrence = { kind: 'daily' };
    } else if (kind === 'weekly') {
      recurrence = { kind: 'weekly', days: selectedDays };
    } else if (kind === 'monthly') {
      recurrence = { kind: 'monthly', day: monthlyDay };
    } else {
      recurrence = { kind: 'interval', n: Math.max(1, intervalN), unit: intervalUnit };
    }

    if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission().catch(() => {});
    }

    onSave({
      fireAt: Timestamp.fromDate(targetDate),
      recurrence,
    });
    onClose();
  };

  const handleRemove = () => {
    onSave(null);
    onClose();
  };

  return (
    <Dialog isOpen={isOpen} onClose={onClose}>
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-2">
          <Icon name="bell" className="text-accent" />
          <h3 className="text-lg font-bold text-text">
            {currentReminder ? 'Edit Reminder' : 'Set Reminder'}
          </h3>
        </div>

        {/* Recurrence Mode Selector */}
        <div className="grid grid-cols-5 gap-1 p-1 bg-surface rounded-md text-xs font-medium">
          {(['once', 'daily', 'weekly', 'monthly', 'interval'] as RecurrenceType[]).map((type) => (
            <button
              key={type}
              type="button"
              className={`py-1.5 px-1 rounded-sm capitalize transition-colors duration-fast ${
                kind === type ? 'bg-background text-text font-bold shadow-sm' : 'text-text-muted hover:text-text'
              }`}
              onClick={() => setKind(type)}
            >
              {type}
            </button>
          ))}
        </div>

        {/* Date Selector (for 'once' mode) */}
        {kind === 'once' && (
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-text-muted">Date</label>
            <Input
              type="date"
              value={dateStr}
              onChange={(e) => setDateStr(e.target.value)}
            />
          </div>
        )}

        {/* Time Selector */}
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-text-muted">Time</label>
          <Input
            type="time"
            value={timeStr}
            onChange={(e) => setTimeStr(e.target.value)}
          />
        </div>

        {/* Weekly Day Selector */}
        {kind === 'weekly' && (
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-text-muted">Repeat on days</label>
            <div className="flex items-center justify-between gap-1">
              {WEEKDAYS.map((w) => {
                const isSelected = selectedDays.includes(w.value);
                return (
                  <button
                    key={w.value}
                    type="button"
                    title={w.name}
                    className={`w-8 h-8 rounded-full text-xs font-medium transition-colors duration-fast ${
                      isSelected
                        ? 'bg-accent text-background font-bold'
                        : 'bg-surface text-text-muted hover:text-text'
                    }`}
                    onClick={() => toggleDay(w.value)}
                  >
                    {w.label}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Monthly Day Selector */}
        {kind === 'monthly' && (
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-text-muted">Day of month (1–31)</label>
            <Input
              type="number"
              min={1}
              max={31}
              value={monthlyDay}
              onChange={(e) => setMonthlyDay(Math.min(31, Math.max(1, Number(e.target.value))))}
            />
          </div>
        )}

        {/* Interval Selector */}
        {kind === 'interval' && (
          <div className="flex flex-col gap-2">
            <label className="text-xs font-medium text-text-muted">Repeat every</label>
            <div className="flex items-center gap-2">
              <Input
                type="number"
                min={1}
                max={365}
                className="w-20"
                value={intervalN}
                onChange={(e) => setIntervalN(Math.max(1, Number(e.target.value)))}
              />
              <select
                className="flex-1 h-10 px-3 rounded-md bg-surface text-text border border-surface-border text-sm"
                value={intervalUnit}
                onChange={(e) => setIntervalUnit(e.target.value as 'day' | 'week' | 'month')}
              >
                <option value="day">Day(s)</option>
                <option value="week">Week(s)</option>
                <option value="month">Month(s)</option>
              </select>
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex items-center justify-between mt-2 pt-2 border-t border-surface-border">
          {currentReminder ? (
            <Button variant="danger" onClick={handleRemove}>
              Remove
            </Button>
          ) : (
            <div />
          )}

          <div className="flex items-center gap-2">
            <Button variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button variant="primary" onClick={handleSave}>
              Save
            </Button>
          </div>
        </div>
      </div>
    </Dialog>
  );
}

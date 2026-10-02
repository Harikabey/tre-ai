export const REMINDERS_STORAGE_KEY = 'tre_reminders';
export const REMINDER_NOTIFICATIONS_ENABLED_KEY = 'tre_reminder_notifications_enabled';
export const REMINDERS_CHANGED_EVENT = 'tre-reminders-changed';

export interface Reminder {
  id: string;
  text: string;
  dueAt: string;
  notified: boolean;
  createdAt: number;
  missed?: boolean;
  opened?: boolean;
}

function isReminder(value: unknown): value is Reminder {
  if (!value || typeof value !== 'object') return false;
  const reminder = value as Partial<Reminder>;
  return typeof reminder.id === 'string' &&
    typeof reminder.text === 'string' &&
    typeof reminder.dueAt === 'string' &&
    Number.isFinite(Date.parse(reminder.dueAt)) &&
    typeof reminder.notified === 'boolean' &&
    typeof reminder.createdAt === 'number' &&
    Number.isFinite(reminder.createdAt);
}

export function readReminders(): Reminder[] {
  const raw = localStorage.getItem(REMINDERS_STORAGE_KEY);
  if (!raw) return [];

  const parsed: unknown = JSON.parse(raw);
  if (!Array.isArray(parsed)) {
    throw new Error('Yerel hatırlatıcı verileri geçersiz.');
  }

  return parsed.filter(isReminder);
}

export function writeReminders(reminders: Reminder[]): void {
  localStorage.setItem(REMINDERS_STORAGE_KEY, JSON.stringify(reminders));
  window.dispatchEvent(new Event(REMINDERS_CHANGED_EVENT));
}

export function addReminder(reminder: Reminder): void {
  writeReminders([...readReminders().filter((item) => item.id !== reminder.id), reminder]);
}

export function updateReminder(id: string, changes: Partial<Reminder>): void {
  writeReminders(readReminders().map((reminder) =>
    reminder.id === id ? { ...reminder, ...changes } : reminder,
  ));
}

export function deleteReminder(id: string): void {
  writeReminders(readReminders().filter((reminder) => reminder.id !== id));
}

export function areReminderNotificationsEnabled(): boolean {
  return localStorage.getItem(REMINDER_NOTIFICATIONS_ENABLED_KEY) === 'true';
}

export function formatReminderTime(dueAt: string, now = new Date()): string {
  const due = new Date(dueAt);
  const time = new Intl.DateTimeFormat('tr-TR', { hour: '2-digit', minute: '2-digit' }).format(due);
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const dueDay = new Date(due.getFullYear(), due.getMonth(), due.getDate());
  const dayDifference = Math.round((dueDay.getTime() - today.getTime()) / 86_400_000);

  if (dayDifference === 0) return `bugün ${time}`;
  if (dayDifference === 1) return `yarın ${time}`;
  return `${new Intl.DateTimeFormat('tr-TR', { day: 'numeric', month: 'long' }).format(due)} ${time}`;
}

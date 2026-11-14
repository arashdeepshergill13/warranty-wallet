// Reminders are scheduled on the phone itself by iOS. No push server.
// iOS keeps at most 64 scheduled notifications per app, so only the next 60
// are ever queued; the queue is rebuilt each time the app opens or data changes.

import { LocalNotifications } from '@capacitor/local-notifications';
import { isNative } from './native.js';
import { addDays, fromISO, formatDate, todayISO } from './warranty.js';

const MAX_QUEUED = 60;
const HOUR = 9;

export function planReminders(items, settings, now = new Date()) {
  if (!settings.remindersOn) return [];
  const today = todayISO(now);
  const plan = [];
  for (const item of items) {
    if (!item.expiryDate || item.expiryDate < today) continue;
    for (const days of settings.reminderDays) {
      const at = fromISO(addDays(item.expiryDate, -days));
      at.setHours(HOUR, 0, 0, 0);
      if (at <= now) continue;
      const when = days === 0 ? 'ends today' : days === 1 ? 'ends tomorrow' : `ends in ${days} days`;
      plan.push({
        at,
        itemId: item.id,
        title: `${item.productName}: warranty ${when}`,
        body: `Covered until ${formatDate(item.expiryDate)}. If anything is wrong with it, claim now.`,
      });
    }
  }
  plan.sort((a, b) => a.at - b.at);
  return plan.slice(0, MAX_QUEUED);
}

export async function reminderPermission() {
  if (!isNative) return 'unavailable';
  try {
    return (await LocalNotifications.checkPermissions()).display; // 'granted' | 'denied' | 'prompt'
  } catch {
    return 'unavailable';
  }
}

export async function askForReminders() {
  if (!isNative) return 'unavailable';
  try {
    return (await LocalNotifications.requestPermissions()).display;
  } catch {
    return 'unavailable';
  }
}

let running = Promise.resolve();
export function syncReminders(items, settings) {
  running = running.then(() => doSync(items, settings)).catch(() => {});
  return running;
}

async function doSync(items, settings) {
  if (!isNative) return;
  if ((await reminderPermission()) !== 'granted') return;
  const pending = await LocalNotifications.getPending();
  if (pending.notifications.length) {
    await LocalNotifications.cancel({ notifications: pending.notifications.map((n) => ({ id: n.id })) });
  }
  const plan = planReminders(items, settings);
  if (!plan.length) return;
  await LocalNotifications.schedule({
    notifications: plan.map((p, index) => ({
      id: index + 1,
      title: p.title,
      body: p.body,
      schedule: { at: p.at, allowWhileIdle: true },
      extra: { itemId: p.itemId },
    })),
  });
}

export async function onReminderTapped(handler) {
  if (!isNative) return () => {};
  const handle = await LocalNotifications.addListener('localNotificationActionPerformed', (event) => {
    const id = event?.notification?.extra?.itemId;
    if (typeof id === 'string') handler(id);
  });
  return () => handle.remove();
}

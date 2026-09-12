// 本地通知引擎：日程提醒 + 经期开始日提醒（应用打开期间检查）
import { get, save } from './store.js';
import { occurrencesInRange, CATEGORIES } from './events.js';
import { predict } from './period.js';
import { toKey, addDays, pad2 } from './dates.js';

export function notifSupported() { return typeof window !== 'undefined' && 'Notification' in window; }

export function permissionState() {
  return notifSupported() ? Notification.permission : 'unsupported';
}

export async function requestPermission() {
  if (!notifSupported()) return 'unsupported';
  try { return await Notification.requestPermission(); }
  catch (e) { return 'denied'; }
}

function fire(title, body, tag) {
  try {
    const n = new Notification(title, { body, tag, icon: 'icons/icon.svg', badge: 'icons/icon.svg' });
    n.onclick = () => { try { window.focus(); n.close(); } catch (e) { /* 忽略 */ } };
  } catch (e) { console.warn('通知发送失败', e); }
}

function twoDaysKeys(now) {
  const todayK = toKey(now);
  return [todayK, toKey(addDays(now, 1)), toKey(addDays(now, 2))];
}

export function tick(now) {
  now = now || new Date();
  const data = get();
  const todayK = toKey(now);
  if (!notifSupported() || Notification.permission !== 'granted') return;

  const fired = new Set(data.notified[todayK] || []);
  let dirty = false;

  // 日程提醒
  const range = twoDaysKeys(now);
  for (const ev of data.events) {
    if (!ev.remind || ev.remind === 'none' || !ev.startTime) continue;
    for (const k of occurrencesInRange(ev, range[0], range[range.length - 1])) {
      const occ = new Date(k + 'T' + ev.startTime + ':00');
      if (isNaN(occ.getTime())) continue;
      const lead = parseInt(ev.remind, 10) || 0;
      const fireAt = occ.getTime() - lead * 60000;
      const key = ev.id + '|' + k + '|' + lead;
      if (now.getTime() >= fireAt && now.getTime() <= occ.getTime() + 30 * 60000 && !fired.has(key)) {
        fired.add(key); dirty = true;
        const cat = CATEGORIES[ev.category] || CATEGORIES.other;
        const when = k === todayK ? '今天 ' : (k.slice(5).replace('-', '月') + '日 ');
        fire('日程提醒 · ' + cat.label, when + ev.startTime + ' ' + ev.title + (ev.note ? '\n' + ev.note : ''), key);
      }
    }
  }

  // 经期开始日提醒
  if (data.settings.periodReminder && data.periods.length) {
    const pr = predict(data.periods, data.settings.cycleLen, data.settings.periodLen, todayK);
    const t = data.settings.reminderTime || '09:00';
    const [hh, mm] = t.split(':').map(Number);
    const at = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hh || 9, mm || 0);
    const key = 'period|' + todayK;
    if (pr.nextStart === todayK && now.getTime() >= at.getTime() && !fired.has(key)) {
      fired.add(key); dirty = true;
      fire('生理期提醒', '今天是预测的经期开始日，注意休息保暖。', key);
    }
  }

  if (dirty) {
    data.notified = { [todayK]: [...fired] }; // 只保留当天，避免膨胀
    save();
  }
}

export function startLoop() {
  if (typeof window === 'undefined') return;
  setInterval(() => tick(), 30000);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') tick();
  });
  setTimeout(() => tick(), 3000);
}

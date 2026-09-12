// 日程与重复规则（纯函数）
import { toKey, parseDate, addDays, addMonths } from './dates.js';

export const CATEGORIES = {
  work: { label: '工作', color: '#4a90d9' },
  life: { label: '生活', color: '#3aa675' },
  memory: { label: '纪念日', color: '#e0699e' },
  other: { label: '其他', color: '#8a8f99' }
};

export const REPEATS = {
  none: '不重复', daily: '每天', weekly: '每周', monthly: '每月', yearly: '每年'
};

export const REMINDS = {
  none: '不提醒', '0': '准时提醒', '5': '提前 5 分钟', '60': '提前 1 小时', '1440': '提前 1 天'
};

export function makeEvent(fields) {
  return {
    id: fields.id || null,
    title: (fields.title || '').trim() || '未命名日程',
    date: fields.date,               // 首次日期 'YYYY-MM-DD'
    startTime: fields.startTime || '',
    endTime: fields.endTime || '',
    note: fields.note || '',
    category: CATEGORIES[fields.category] ? fields.category : 'other',
    repeat: REPEATS[fields.repeat] ? fields.repeat : 'none',
    remind: REMINDS[fields.remind] !== undefined ? fields.remind : 'none',
    done: !!fields.done
  };
}

// 展开 [rangeStartKey, rangeEndKey] 内的出现日期
export function occurrencesInRange(ev, rangeStartKey, rangeEndKey) {
  const base = parseDate(ev.date);
  const rs = parseDate(rangeStartKey);
  const re = parseDate(rangeEndKey);
  if (base > re) return [];
  const rep = ev.repeat || 'none';
  const out = [];
  if (rep === 'none') {
    if (base >= rs) out.push(ev.date);
    return out;
  }
  if (rep === 'daily') {
    let d = base < rs ? rs : base;
    for (; d <= re && out.length < 400; d = addDays(d, 1)) out.push(toKey(d));
    return out;
  }
  if (rep === 'weekly') {
    const dow = base.getDay();
    let d = base < rs ? rs : base;
    while (d <= re && d.getDay() !== dow) d = addDays(d, 1);
    for (; d <= re && out.length < 200; d = addDays(d, 7)) {
      if (d >= base) out.push(toKey(d));
    }
    return out;
  }
  if (rep === 'monthly') {
    // 按年月直接枚举，避免"1月31日"在收敛到2月28日后丢失原始锚点
    for (let y = rs.getFullYear(); y <= re.getFullYear(); y++) {
      for (let m = 0; m < 12; m++) {
        const max = new Date(y, m + 1, 0).getDate();
        if (base.getDate() > max) continue; // 该月没有这一天（如2月无31日）
        const cand = new Date(y, m, base.getDate());
        if (cand >= base && cand >= rs && cand <= re) out.push(toKey(cand));
      }
    }
    return out;
  }
  if (rep === 'yearly') {
    for (let y = Math.max(base.getFullYear(), rs.getFullYear()); y <= re.getFullYear(); y++) {
      const cand = new Date(y, base.getMonth(), base.getDate());
      if (cand >= rs && cand <= re) out.push(toKey(cand));
    }
    return out;
  }
  return out;
}

// 某天发生的日程（按时间排序，无时间在前）
export function getEventsForDate(key, all) {
  const out = [];
  for (const ev of all || []) {
    if (occurrencesInRange(ev, key, key).length) out.push(ev);
  }
  out.sort((a, b) => {
    if (!a.startTime && b.startTime) return -1;
    if (a.startTime && !b.startTime) return 1;
    if (a.startTime && b.startTime && a.startTime !== b.startTime) return a.startTime < b.startTime ? -1 : 1;
    return a.title < b.title ? -1 : 1;
  });
  return out;
}

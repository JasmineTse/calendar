// 日期工具（纯函数，浏览器与测试页共用）
export const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六'];

export function pad2(n) { return n < 10 ? '0' + n : '' + n; }
export function fmtDate(y, m, d) { return y + '-' + pad2(m) + '-' + pad2(d); }

// 'YYYY-MM-DD' -> 本地时区当天 0 点的 Date
export function parseDate(s) {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function toKey(date) {
  return fmtDate(date.getFullYear(), date.getMonth() + 1, date.getDate());
}

export function todayKey() { return toKey(new Date()); }

export function addDays(date, n) {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  d.setDate(d.getDate() + n);
  return d;
}

// 月份步进，目标月不存在该日时收敛到月末（1月31日 + 1月 -> 2月28日）
export function addMonths(date, n) {
  const d = new Date(date.getFullYear(), date.getMonth() + n, 1);
  const max = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  d.setDate(Math.min(date.getDate(), max));
  return d;
}

export function diffDays(a, b) {
  const A = Date.UTC(a.getFullYear(), a.getMonth(), a.getDate());
  const B = Date.UTC(b.getFullYear(), b.getMonth(), b.getDate());
  return Math.round((B - A) / 86400000);
}

// 周一为一周的开始：(getDay()+6)%7 -> 周一=0 ... 周日=6
export function mondayOffset(date) { return (date.getDay() + 6) % 7; }

export function daysInMonth(y, m) { return new Date(y, m + 1, 0).getDate(); }

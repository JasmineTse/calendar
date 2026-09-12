// 生理期记录与预测（日历法），纯函数便于单元测试
import { toKey, parseDate, addDays, diffDays } from './dates.js';

const KEY_RE = /^\d{4}-\d{2}-\d{2}$/;

export function normalizePeriods(periods) {
  return (periods || [])
    .filter(p => p && KEY_RE.test(p.start || ''))
    .map(p => ({
      id: p.id || ('p' + p.start),
      start: p.start,
      end: (p.end && KEY_RE.test(p.end) && p.end >= p.start) ? p.end : null
    }))
    .sort((a, b) => (a.start < b.start ? -1 : a.start > b.start ? 1 : 0));
}

// 相邻两次经期开始日的间隔（15–60 天视为有效周期）
export function cycleLengths(periods) {
  const starts = normalizePeriods(periods).map(p => p.start);
  const out = [];
  for (let i = 1; i < starts.length; i++) {
    const d = diffDays(parseDate(starts[i - 1]), parseDate(starts[i]));
    if (d >= 15 && d <= 60) out.push(d);
  }
  return out;
}

export function avgCycle(periods, fallback) {
  const a = cycleLengths(periods);
  if (!a.length) return fallback;
  const r = a.slice(-6); // 最近 6 个周期
  return Math.round(r.reduce((x, y) => x + y, 0) / r.length);
}

// 最近周期波动大于 9 天视为不规律
export function isIrregular(periods) {
  const a = cycleLengths(periods).slice(-6);
  return a.length >= 3 && (Math.max(...a) - Math.min(...a)) > 9;
}

export function predict(periods, cycleLenSetting, periodLen, todayKey) {
  const ps = normalizePeriods(periods);
  const res = {
    avg: avgCycle(ps, cycleLenSetting),
    irregular: isIrregular(ps),
    count: ps.length,
    lastStart: ps.length ? ps[ps.length - 1].start : null,
    nextStart: null, nextEnd: null, ovulation: null,
    fertileStart: null, fertileEnd: null,
    predictions: [], rolling: false
  };
  if (!ps.length) return res;
  const today = parseDate(todayKey);
  let next = addDays(parseDate(ps[ps.length - 1].start), res.avg);
  // 用户漏记时向前滚动，保证预测始终指向未来（diffDays(next, today) = today - next）
  while (diffDays(next, today) > 0) { next = addDays(next, res.avg); res.rolling = true; }
  res.nextStart = toKey(next);
  res.nextEnd = toKey(addDays(next, periodLen - 1));
  const ovu = addDays(next, -14);
  res.ovulation = toKey(ovu);
  res.fertileStart = toKey(addDays(ovu, -5));
  res.fertileEnd = toKey(addDays(ovu, 1));
  for (let i = 0; i < 3; i++) {
    const st = addDays(next, i * res.avg);
    res.predictions.push({
      start: toKey(st),
      end: toKey(addDays(st, periodLen - 1)),
      ovulation: toKey(addDays(st, -14))
    });
  }
  return res;
}

// 某日在生理期日历上的标注：实际经期 > 预测经期 > 排卵日 > 易孕期
export function classifyDay(key, periods, cycleLenSetting, periodLen, todayKey) {
  const ps = normalizePeriods(periods);
  for (const p of ps) {
    const endKey = p.end || toKey(addDays(parseDate(p.start), periodLen - 1));
    if (key >= p.start && key <= endKey) {
      return { kind: 'period', dayNum: diffDays(parseDate(p.start), parseDate(key)) + 1, ongoing: !p.end };
    }
  }
  const pr = predict(ps, cycleLenSetting, periodLen, todayKey);
  for (const pd of pr.predictions) {
    if (key >= pd.start && key <= pd.end) return { kind: 'predicted-period' };
    if (key === pd.ovulation) return { kind: 'ovulation' };
    const fs = toKey(addDays(parseDate(pd.ovulation), -5));
    const fe = toKey(addDays(parseDate(pd.ovulation), 1));
    if (key >= fs && key <= fe) return { kind: 'fertile' };
  }
  return { kind: null };
}

export function dayStatusText(key, cls, pr) {
  if (!pr) return '未记录';
  if (cls.kind === 'period') {
    return (cls.ongoing ? '经期中 · 第 ' : '经期 · 第 ') + cls.dayNum + ' 天' + (cls.ongoing ? '（进行中）' : '');
  }
  if (cls.kind === 'predicted-period') return '预测经期';
  if (cls.kind === 'ovulation') return '预测排卵日';
  if (cls.kind === 'fertile') return '易孕期（预测）';
  if (pr.nextStart) return '安全期（预测）';
  return '未记录';
}

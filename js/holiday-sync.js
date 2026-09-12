// 联网更新法定节假日：多数据源依次尝试 + 解析 + 合并
// 仅在用户点击"更新假期"时发起网络请求；解析与合并为纯函数，可离线单元测试
const TIMEOUT_MS = 8000;

export const SOURCES = [
  {
    label: 'timor.tech',
    url: y => 'https://timor.tech/api/holiday/year/' + y,
    parse: parseTimor
  },
  {
    label: 'holiday-cn（jsDelivr）',
    url: y => 'https://cdn.jsdelivr.net/gh/NateScarlet/holiday-cn@master/' + y + '.json',
    parse: parseHolidayCN
  },
  {
    label: 'holiday-cn（GitHub）',
    url: y => 'https://raw.githubusercontent.com/NateScarlet/holiday-cn/master/' + y + '.json',
    parse: parseHolidayCN
  }
];

// [{name, date, off}] 按出现顺序合并同名同类型日期
function groupEntries(entries) {
  const holidays = [], workdays = [], idx = {};
  for (const e of entries) {
    const key = (e.off ? 'h|' : 'w|') + e.name;
    if (idx[key] === undefined) {
      const group = { name: e.name, days: [] };
      idx[key] = e.off ? holidays.push(group) - 1 : workdays.push(group) - 1;
    }
    (e.off ? holidays : workdays)[idx[key]].days.push(e.date);
  }
  return { holidays, workdays };
}

// timor.tech：{"code":0,"holiday":{"01-01":{"holiday":true,"name":"元旦","date":"2027-01-01"},...}}
// 未公布年份返回 {"code":0,"holiday":{}} -> null（视为"尚未公布"）
export function parseTimor(payload) {
  if (!payload || payload.code !== 0 || !payload.holiday || typeof payload.holiday !== 'object') return null;
  const entries = [];
  for (const v of Object.values(payload.holiday)) {
    if (!v || typeof v.date !== 'string' || !v.name) continue;
    entries.push({ name: v.name, date: v.date, off: v.holiday === true });
  }
  if (!entries.length) return null;
  return groupEntries(entries);
}

// holiday-cn：顶层 {"year":2026,"days":[{"name":"元旦","date":"2026-01-01","isOffDay":true},...]}
// 兼容嵌套格式 {"years":{"2026":{"days":[...]}}}
export function parseHolidayCN(payload, year) {
  if (!payload) return null;
  let days = null;
  if (Array.isArray(payload.days)) days = payload.days;
  else if (payload.years && payload.years[String(year)] && Array.isArray(payload.years[String(year)].days)) {
    days = payload.years[String(year)].days;
  }
  if (!days) return null;
  const entries = [];
  for (const d of days) {
    if (!d || typeof d.date !== 'string' || !d.name) continue;
    entries.push({ name: d.name, date: d.date, off: d.isOffDay !== false });
  }
  if (!entries.length) return null;
  return groupEntries(entries);
}

async function fetchJson(url) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, { signal: ctrl.signal });
    if (!res.ok) {
      const e = new Error('HTTP ' + res.status);
      e.httpStatus = res.status;
      throw e;
    }
    return await res.json();
  } catch (e) {
    if (e && e.name === 'AbortError') throw new Error('请求超时');
    throw e;
  } finally {
    clearTimeout(timer);
  }
}

// 获取单年：{status:'ok', data, source} / {status:'unpublished'} / 抛错（网络失败）
export async function fetchYearData(year) {
  const errors = [];
  let reachable = false;
  for (const s of SOURCES) {
    try {
      const raw = await fetchJson(s.url(year));
      reachable = true;
      const data = s.parse(raw, year);
      if (data && (data.holidays.length || data.workdays.length)) {
        return { year, status: 'ok', data, source: s.label };
      }
    } catch (e) {
      if (e && e.httpStatus === 404) reachable = true; // 数据源正常但该年未发布
      errors.push(s.label + '：' + ((e && e.message) || '失败'));
    }
  }
  if (reachable) return { year, status: 'unpublished' };
  throw new Error(errors.join('；') || '网络不可用');
}

// 合并进用户的 holidaysOverride（按年份覆盖，不影响内置数据与其他年份）
export function mergeOverride(existing, updates, todayKey) {
  const base = existing && existing.years ? JSON.parse(JSON.stringify(existing)) : { source: '', updated: '', years: {} };
  const labels = [];
  for (const u of updates) {
    base.years[String(u.year)] = u.data;
    if (!labels.includes(u.source)) labels.push(u.source);
  }
  base.updated = todayKey;
  base.source = '在线更新（' + labels.join('、') + '）';
  return base;
}

// 同步当年与次年：{ok:[{year,data,source}], unpublished:[2027], errors:['2026 年：…']}
export async function syncHolidays(now) {
  const y = (now || new Date()).getFullYear();
  const results = await Promise.allSettled([fetchYearData(y), fetchYearData(y + 1)]);
  const ok = [], unpublished = [], errors = [];
  results.forEach((r, i) => {
    const year = y + i;
    if (r.status === 'fulfilled') {
      if (r.value.status === 'ok') ok.push(r.value);
      else unpublished.push(year);
    } else {
      errors.push(year + ' 年：' + (r.reason && r.reason.message || '失败'));
    }
  });
  return { ok, unpublished, errors };
}

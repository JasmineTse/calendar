// 法定节假日与调休：内置 JSON + 用户导入覆盖；无数据年份优雅降级（仅周末标红）
import { toKey, addDays } from './dates.js';

export class HolidayStore {
  // builtin：内置 JSON；override：用户导入（同一年份时覆盖内置）
  constructor(builtin, override) {
    this._index = {};
    this.years = {};
    this.source = (builtin && builtin.source) || '';
    this.updated = (builtin && builtin.updated) || '';
    this.merge(builtin);
    if (override) this.merge(override);
  }

  merge(dataObj) {
    if (!dataObj || typeof dataObj !== 'object' || !dataObj.years) return;
    for (const y of Object.keys(dataObj.years)) {
      this.years[String(y)] = dataObj.years[y];
      delete this._index[y];
    }
  }

  _yearIndex(year) {
    if (this._index[year]) return this._index[year];
    const idx = { holiday: {}, work: {} };
    const y = this.years[String(year)];
    if (y) {
      (y.holidays || []).forEach(h => (h.days || []).forEach(d => { idx.holiday[d] = h.name; }));
      (y.workdays || []).forEach(w => (w.days || []).forEach(d => { idx.work[d] = w.name; }));
    }
    this._index[year] = idx;
    return idx;
  }

  hasYear(year) { return !!this.years[String(year)]; }

  yearList() { return Object.keys(this.years).sort(); }

  // key: 'YYYY-MM-DD' -> {type:'holiday'|'workday'|null, name, hasData}
  getInfo(key) {
    const year = key.slice(0, 4);
    const idx = this._yearIndex(year);
    const hasData = this.hasYear(year);
    if (idx.holiday[key]) return { type: 'holiday', name: idx.holiday[key], hasData };
    if (idx.work[key]) return { type: 'workday', name: idx.work[key], hasData };
    return { type: null, name: null, hasData };
  }

  // 距下一个法定假期（含今天）：{name, start, end, days}，days=0 表示今天开始放假
  nextHoliday(fromDate, maxDays = 500) {
    for (let i = 0; i < maxDays; i++) {
      const d = addDays(fromDate, i);
      const k = toKey(d);
      const info = this.getInfo(k);
      if (info.type === 'holiday') {
        let end = d;
        for (;;) {
          const n = addDays(end, 1);
          if (this.getInfo(toKey(n)).type === 'holiday') end = n; else break;
        }
        return { name: info.name, start: k, end: toKey(end), days: i };
      }
    }
    return null;
  }
}

// 校验导入的节假日 JSON 结构
export function validateHolidayJson(obj) {
  if (!obj || typeof obj !== 'object' || !obj.years) return { ok: false, error: '缺少 years 字段' };
  for (const y of Object.keys(obj.years)) {
    if (!/^\d{4}$/.test(y)) return { ok: false, error: '年份键必须为四位数字：' + y };
    const v = obj.years[y];
    for (const g of [...(v.holidays || []), ...(v.workdays || [])]) {
      if (!g.name || !Array.isArray(g.days)) return { ok: false, error: y + ' 年存在缺少 name/days 的分组' };
      for (const d of g.days) {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return { ok: false, error: y + ' 年存在非法日期：' + d };
        const [yy, mm, dd] = d.split('-').map(Number);
        const dt = new Date(yy, mm - 1, dd);
        if (dt.getFullYear() !== yy || dt.getMonth() !== mm - 1 || dt.getDate() !== dd) {
          return { ok: false, error: y + ' 年存在不存在的日期：' + d };
        }
      }
    }
  }
  return { ok: true };
}

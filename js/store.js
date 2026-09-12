// 本地数据层：全部数据仅存于浏览器 localStorage，不上传任何内容
const KEY = 'wnl_data_v1';

function defaults() {
  return {
    settings: {
      cycleLen: 28,        // 平均周期长度（天）
      periodLen: 5,        // 平均经期天数
      periodReminder: true, // 经期开始日提醒
      reminderTime: '09:00',
      pinHash: null        // 应用锁 PIN 的哈希
    },
    events: [],            // 日程
    periods: [],           // 生理期记录 {id,start,end}
    holidaysOverride: null,// 用户导入的节假日数据（覆盖内置）
    notified: {}           // 当日已发送提醒的 key 集合
  };
}

let data = null;

export function load() {
  if (data) return data;
  data = defaults();
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      Object.assign(data, parsed);
    }
  } catch (e) { /* 损坏则重置 */ }
  data.settings = Object.assign(defaults().settings, data.settings || {});
  if (!Array.isArray(data.events)) data.events = [];
  if (!Array.isArray(data.periods)) data.periods = [];
  if (!data.notified || typeof data.notified !== 'object') data.notified = {};
  return data;
}

export function get() { return load(); }

export function save() {
  try { localStorage.setItem(KEY, JSON.stringify(data)); }
  catch (e) { console.warn('保存失败', e); }
}

export function resetAll() {
  data = defaults();
  save();
}

export function exportData() { return JSON.stringify(load(), null, 2); }

// 导入备份：仅接受结构合法的数据
export function importData(obj) {
  if (!obj || typeof obj !== 'object') throw new Error('数据格式不正确');
  if (!Array.isArray(obj.events) || !Array.isArray(obj.periods)) throw new Error('缺少 events/periods 字段');
  const d = defaults();
  Object.assign(d, obj);
  d.settings = Object.assign(defaults().settings, obj.settings || {});
  data = d;
  save();
}

export function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

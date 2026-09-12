// 界面渲染：日历（月/周/年）、当日详情、日程编辑、生理期、设置、日期选择器、锁屏
import { WEEKDAYS, toKey, parseDate, addDays, addMonths, mondayOffset, daysInMonth, todayKey, pad2 } from './dates.js';
import { get, uid } from './store.js';
import * as period from './period.js';
import * as events from './events.js';
import { getDayDetail, cellLabel } from './lunar-adapter.js';
import { state } from './state.js';

export function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

// '2026-09-13' -> '9月13日'
export function cnMD(key) {
  return parseInt(key.slice(5, 7), 10) + '月' + parseInt(key.slice(8, 10), 10) + '日';
}

// ---------- 提示条 ----------
export function showMsg(text, isError) {
  let t = document.getElementById('toast');
  if (!t) { t = document.createElement('div'); t.id = 'toast'; document.body.appendChild(t); }
  t.textContent = text;
  t.className = 'toast show' + (isError ? ' err' : '');
  clearTimeout(t._tm);
  t._tm = setTimeout(() => { t.className = 'toast'; }, 2200);
}

// ---------- 日历格子 ----------
function classifyOf(key) {
  const data = get();
  return period.classifyDay(key, data.periods, data.settings.cycleLen, data.settings.periodLen, todayKey());
}

function dayCellHtml(key, date) {
  const data = get();
  const todayK = todayKey();
  const label = cellLabel(date);
  const hol = state.holidayStore ? state.holidayStore.getInfo(key) : { type: null, hasData: false };
  const isWeekend = date.getDay() === 0 || date.getDay() === 6;
  const legal = hol.type === 'holiday';
  const work = hol.type === 'workday';
  const cls = [];
  if (legal || isWeekend) cls.push('red');
  if (work) cls.push('workday');
  if (key === todayK) cls.push('today');
  if (key === state.selected) cls.push('selected');
  const pc = classifyOf(key);
  if (pc.kind) cls.push('p-' + pc.kind);

  const badge = legal ? '<span class="badge rest">休</span>' : (work ? '<span class="badge work">班</span>' : '');
  const evs = events.getEventsForDate(key, data.events).slice(0, 3);
  const dots = evs.map(e => `<i class="dot" style="background:${(events.CATEGORIES[e.category] || events.CATEGORIES.other).color}"></i>`).join('');
  let pbar = '';
  if (pc.kind === 'period') pbar = '<span class="pbar k-period"></span>';
  else if (pc.kind === 'predicted-period') pbar = '<span class="pbar k-pred"></span>';
  else if (pc.kind === 'ovulation') pbar = '<span class="pbar k-ovu"></span>';
  else if (pc.kind === 'fertile') pbar = '<span class="pbar k-fertile"></span>';

  return `<button class="cell ${cls.join(' ')}" data-action="open-day" data-key="${key}">
    <span class="solar">${date.getDate()}</span>${badge}
    <span class="sub kind-${label.kind}${pc.kind === 'period' ? ' on-period' : ''}">${esc(label.label)}</span>
    <span class="marks">${pbar}${dots}</span>
  </button>`;
}

function weekHeaderHtml() {
  const hs = ['一', '二', '三', '四', '五', '六', '日'];
  return '<div class="week-header">' + hs.map((w, i) => `<span class="${i >= 5 ? 'red' : ''}">${w}</span>`).join('') + '</div>';
}

function countdownHtml() {
  const st = state.holidayStore;
  if (!st) return '';
  const nx = st.nextHoliday(new Date(), 500);
  if (!nx) return '';
  if (nx.days === 0) return `<span class="chip hot">放假中</span><span>${esc(nx.name)}（至 ${cnMD(nx.end)}）</span>`;
  const d = nx.days;
  return `<span class="chip">假期</span><span>距 <b>${esc(nx.name)}</b> 还有 <b>${d}</b> 天（${cnMD(nx.start)}开始）</span>`;
}

// ---------- 月视图 ----------
function monthGridHtml() {
  const cur = state.cursor;
  const first = new Date(cur.getFullYear(), cur.getMonth(), 1);
  const start = addDays(first, -mondayOffset(first));
  const total = mondayOffset(first) + daysInMonth(cur.getFullYear(), cur.getMonth());
  const cells = Math.ceil(total / 7) * 7;
  let html = '';
  for (let i = 0; i < cells; i++) {
    const d = addDays(start, i);
    html += dayCellHtml(toKey(d), d);
  }
  return `<div class="month-grid">${html}</div>`;
}

// ---------- 周视图 ----------
function agendaListHtml(key) {
  const data = get();
  const evs = events.getEventsForDate(key, data.events);
  if (!evs.length) return '<div class="empty">这一天暂无日程</div>';
  return evs.map(ev => {
    const cat = events.CATEGORIES[ev.category] || events.CATEGORIES.other;
    const time = ev.startTime ? esc(ev.startTime) + (ev.endTime ? ' – ' + esc(ev.endTime) : '') : '全天';
    return `<div class="ev-row ${ev.done ? 'done' : ''}">
      <button class="check ${ev.done ? 'on' : ''}" data-action="toggle-done" data-id="${ev.id}" title="完成">${ev.done ? '✓' : ''}</button>
      <div class="ev-main" data-action="edit-event" data-id="${ev.id}">
        <div class="ev-title">${esc(ev.title)}</div>
        <div class="ev-meta"><i class="dot" style="background:${cat.color}"></i>${cat.label} · ${time}${ev.repeat !== 'none' ? ' · ' + events.REPEATS[ev.repeat] : ''}${ev.remind !== 'none' ? ' · ' + events.REMINDS[ev.remind] : ''}</div>
        ${ev.note ? `<div class="ev-note">${esc(ev.note)}</div>` : ''}
      </div>
      <button class="icon-btn" data-action="del-event" data-id="${ev.id}" title="删除">🗑</button>
    </div>`;
  }).join('');
}

function weekViewHtml() {
  const sel = parseDate(state.selected);
  const start = addDays(sel, -mondayOffset(sel));
  let cells = '';
  for (let i = 0; i < 7; i++) {
    const d = addDays(start, i);
    cells += dayCellHtml(toKey(d), d);
  }
  return `<div class="week-strip month-grid">${cells}</div>
    <div class="agenda"><h4>${cnMD(state.selected)} 日程 <button class="link" data-action="add-event" data-key="${state.selected}">＋ 添加</button></h4>${agendaListHtml(state.selected)}</div>`;
}

// ---------- 年视图 ----------
function miniMonthHtml(y, m) {
  const first = new Date(y, m, 1);
  const off = mondayOffset(first);
  const total = off + daysInMonth(y, m);
  const rows = Math.ceil(total / 7);
  const start = addDays(first, -off);
  const todayK = todayKey();
  let cells = '';
  for (let i = 0; i < rows * 7; i++) {
    const d = addDays(start, i);
    if (d.getMonth() !== m) { cells += '<span class="m-cell dim"></span>'; continue; }
    const k = toKey(d);
    const hol = state.holidayStore ? state.holidayStore.getInfo(k) : { type: null, hasData: false };
    const cls = [];
    if (hol.type === 'holiday' || d.getDay() === 0 || d.getDay() === 6) cls.push('red');
    if (hol.type === 'workday') cls.push('work');
    if (k === todayK) cls.push('today');
    cells += `<span class="m-cell ${cls.join(' ')}" data-action="goto-day" data-key="${k}">${d.getDate()}</span>`;
  }
  return `<div class="mini"><h4 data-action="goto-month" data-m="${m}">${m + 1}月</h4><div class="m-grid">${cells}</div></div>`;
}

function yearViewHtml() {
  let html = '';
  for (let m = 0; m < 12; m++) html += miniMonthHtml(state.cursor.getFullYear(), m);
  return `<div class="year-grid">${html}</div>`;
}

// ---------- 日历标签页 ----------
export function renderCalendarTab(el) {
  const cur = state.cursor;
  const seg = (v, t) => `<button class="${state.view === v ? 'on' : ''}" data-action="view" data-view="${v}">${t}</button>`;
  el.innerHTML = `
    <header class="cal-head">
      <div class="row1">
        <button class="title" data-action="open-picker"><b>${cur.getFullYear()}年${state.view === 'year' ? '' : cur.getMonth() + 1 + '月'}</b><span class="chev">▾</span></button>
        <div class="seg">${seg('month', '月')}${seg('week', '周')}${seg('year', '年')}</div>
      </div>
      <div class="row2">
        <button class="icon-btn sm" data-action="nav" data-dir="-1">‹</button>
        <button class="link" data-action="today">今天</button>
        <button class="icon-btn sm" data-action="nav" data-dir="1">›</button>
        <div class="countdown">${countdownHtml()}</div>
      </div>
    </header>
    ${weekHeaderHtml()}
    ${state.view === 'month' ? monthGridHtml() : state.view === 'week' ? weekViewHtml() : yearViewHtml()}
    ${dayPanelHtml(state.selected)}
    <button class="fab" data-action="add-event" data-key="${state.selected}" title="添加日程">＋</button>
  `;
}

// ---------- 当日详情 ----------
function chipHtml(name, key, kind) {
  return `<span class="fchip ${kind}">${esc(name)}<button class="fadd" data-action="festival-to-event" data-name="${esc(name)}" data-key="${key}" title="设为每年提醒">＋</button></span>`;
}

// 当日详情：内联显示在日历下方（不再弹窗）
export function dayPanelHtml(key) {
  const date = parseDate(key);
  const d = getDayDetail(date);
  if (!d) return '<section class="day-panel"><p class="empty">农历库未加载</p></section>';
  const data = get();
  const pc = classifyOf(key);
  const pr = period.predict(data.periods, data.settings.cycleLen, data.settings.periodLen, todayKey());
  const status = period.dayStatusText(key, pc, pr);

  const chips = (d.festivals || []).map(f => chipHtml(f, key, 'f')).join('')
    + (d.jieqi ? chipHtml(d.jieqi, key, 'j') : '');

  const kv = (k, v) => v ? `<div class="kv"><span>${k}</span><b>${esc(v)}</b></div>` : '';

  // 生理期操作按钮
  let pbtns = '';
  const openRec = period.normalizePeriods(data.periods).filter(p => !p.end).pop();
  if (openRec && key >= openRec.start) {
    pbtns = `<button class="btn primary sm" data-action="period-end" data-key="${key}">记录经期结束（至这天）</button>`;
  } else {
    pbtns = `<button class="btn primary sm" data-action="period-start" data-key="${key}">标记这天为经期开始</button>`;
  }

  const evs = events.getEventsForDate(key, data.events);

  return `<section class="day-panel">
    <div class="d-head">
      <div class="d-title">
        <b>${d.y}年${d.m}月${d.d}日 星期${d.weekInCN}</b>
        <span>农历${d.monthCN}月${d.dayCN}${d.festivals.length ? ' · ' + d.festivals.map(esc).join(' · ') : ''}</span>
      </div>
      <button class="icon-btn" data-action="detail-nav" data-dir="-1">‹</button>
      <button class="icon-btn" data-action="detail-nav" data-dir="1">›</button>
    </div>
    ${chips ? `<div class="chips">${chips}</div>` : ''}
    <div class="card period-mini">
      <div class="p-status"><span class="pdot ${pc.kind || 'none'}"></span>${esc(status)}</div>
      ${pr.nextStart && pc.kind !== 'period' ? `<div class="p-sub">下次经期预测 ${cnMD(pr.nextStart)} · 排卵日 ${cnMD(pr.ovulation)}</div>` : ''}
      <div class="p-btns">${pbtns}<a class="btn ghost sm" href="#" data-action="tab" data-tab="period">管理生理期</a></div>
    </div>
    <div class="card">
      <h4>日程</h4>
      ${evs.length ? evs.map(ev => {
        const cat = events.CATEGORIES[ev.category] || events.CATEGORIES.other;
        const time = ev.startTime ? esc(ev.startTime) + (ev.endTime ? ' – ' + esc(ev.endTime) : '') : '全天';
        return `<div class="ev-row ${ev.done ? 'done' : ''}">
          <button class="check ${ev.done ? 'on' : ''}" data-action="toggle-done" data-id="${ev.id}">${ev.done ? '✓' : ''}</button>
          <div class="ev-main" data-action="edit-event" data-id="${ev.id}">
            <div class="ev-title">${esc(ev.title)}</div>
            <div class="ev-meta"><i class="dot" style="background:${cat.color}"></i>${cat.label} · ${time}</div>
          </div>
          <button class="icon-btn" data-action="del-event" data-id="${ev.id}">🗑</button>
        </div>`;
      }).join('') : '<div class="empty">暂无日程</div>'}
      <button class="btn ghost sm" data-action="add-event" data-key="${key}">＋ 添加日程</button>
    </div>
    <div class="card">
      <h4>黄历 · 宜忌</h4>
      <div class="yiji">
        <div class="yj yi"><label>宜</label><div>${d.yi.length ? d.yi.map(esc).join(' · ') : '——'}</div></div>
        <div class="yj ji"><label>忌</label><div>${d.ji.length ? d.ji.map(esc).join(' · ') : '——'}</div></div>
      </div>
      <div class="almanac">
        ${kv('干支', d.ganzhiY + '年 · ' + d.ganzhiM + '月 · ' + d.ganzhiD + '日')}
        ${kv('生肖', d.shengxiao)}
        ${kv('节气', d.jieqi)}
        ${kv('冲煞', d.chongDesc)}
        ${kv('吉神宜趋', (d.jiShen || []).join(' '))}
        ${kv('凶神宜忌', (d.xiongSha || []).join(' '))}
        ${kv('胎神占方', d.taishen)}
        ${kv('彭祖百忌', d.pengzu)}
        ${kv('喜神方位', d.xishen)}
        ${kv('财神方位', d.caishen)}
      </div>
      <p class="disclaimer">民俗内容，仅供参考</p>
    </div>
  </section>`;
}

// ---------- 日程编辑 ----------
export function editorHtml(key, ev) {
  const cats = Object.entries(events.CATEGORIES).map(([k, v]) => `<option value="${k}" ${ev && ev.category === k ? 'selected' : ''}>${v.label}</option>`).join('');
  const reps = Object.entries(events.REPEATS).map(([k, v]) => `<option value="${k}" ${ev && ev.repeat === k ? 'selected' : ''}>${v}</option>`).join('');
  const rems = Object.entries(events.REMINDS).map(([k, v]) => `<option value="${k}" ${ev && ev.remind === k ? 'selected' : ''}>${v}</option>`).join('');
  return `<div class="sheet-backdrop" data-action="editor-close"></div>
  <div class="sheet-card">
    <div class="d-head"><button class="icon-btn" data-action="editor-close">✕</button><div class="d-title"><b>${ev ? '编辑日程' : '新建日程'}</b></div></div>
    <div class="form">
      <label>标题<input id="f-title" type="text" maxlength="50" placeholder="日程标题" value="${ev ? esc(ev.title) : ''}"></label>
      <div class="grid2">
        <label>日期<input id="f-date" type="date" value="${ev ? ev.date : key}"></label>
        <label>分类<select id="f-cat">${cats}</select></label>
      </div>
      <div class="grid2">
        <label>开始时间<input id="f-start" type="time" value="${ev && ev.startTime ? ev.startTime : ''}"></label>
        <label>结束时间<input id="f-end" type="time" value="${ev && ev.endTime ? ev.endTime : ''}"></label>
      </div>
      <div class="grid2">
        <label>重复<select id="f-repeat">${reps}</select></label>
        <label>提醒<select id="f-remind">${rems}</select></label>
      </div>
      <label>备注<textarea id="f-note" rows="2" maxlength="200" placeholder="备注（可选）">${ev ? esc(ev.note) : ''}</textarea></label>
      <div class="form-btns">
        ${ev ? '<button class="btn danger" data-action="event-delete" data-id="' + ev.id + '">删除</button>' : ''}
        <button class="btn ghost" data-action="editor-close">取消</button>
        <button class="btn primary" data-action="event-save">保存</button>
      </div>
    </div>
  </div>`;
}

export function renderEditor(root) {
  if (!state.editorOpen) { root.innerHTML = ''; return; }
  const data = get();
  const ev = state.editingEventId ? data.events.find(e => e.id === state.editingEventId) : null;
  root.innerHTML = editorHtml(state.selected, ev);
}

// ---------- 日期选择器 ----------
export function pickerHtml() {
  const cur = state.cursor;
  let months = '';
  for (let m = 0; m < 12; m++) {
    months += `<button class="${m === cur.getMonth() ? 'on' : ''}" data-action="pick-month" data-m="${m}">${m + 1}月</button>`;
  }
  return `<div class="sheet-backdrop" data-action="picker-close"></div>
  <div class="sheet-card small">
    <div class="d-head"><button class="icon-btn" data-action="picker-close">✕</button><div class="d-title"><b>选择日期</b></div></div>
    <div class="year-nav">
      <button class="icon-btn sm" data-action="pick-year" data-dir="-1">‹</button>
      <b>${cur.getFullYear()}年</b>
      <button class="icon-btn sm" data-action="pick-year" data-dir="1">›</button>
    </div>
    <div class="month-btns">${months}</div>
    <div class="jump">
      <input id="jump-date" type="date" value="${state.selected}">
      <button class="btn primary" data-action="pick-goto">跳转</button>
    </div>
    <button class="btn ghost" data-action="today-pick">回到今天</button>
  </div>`;
}

export function renderPicker(root, open) {
  root.innerHTML = open ? pickerHtml() : (root.innerHTML && root.dataset.picker === '1' ? '' : root.innerHTML);
}

// ---------- 生理期标签页 ----------
function cycleChartHtml(cycles) {
  if (!cycles.length) return '<div class="empty">记录两次及以上经期后，这里会显示周期趋势</div>';
  return '<canvas id="cycle-chart" style="width:100%;height:150px"></canvas>';
}

export function periodTabHtml() {
  const data = get();
  const s = data.settings;
  const tk = todayKey();
  const pr = period.predict(data.periods, s.cycleLen, s.periodLen, tk);
  const cls = classifyOf(tk);
  const status = period.dayStatusText(tk, cls, pr);

  let headline;
  if (!data.periods.length) {
    headline = '还没有记录，标记一次经期开始吧';
  } else if (cls.kind === 'period') {
    headline = '经期中 · 第 ' + cls.dayNum + ' 天' + (cls.ongoing ? '（进行中）' : '');
  } else {
    const dd = Math.round((parseDate(pr.nextStart) - parseDate(tk)) / 86400000);
    headline = dd === 0 ? '预测今天开始经期' : '距下次经期约 ' + dd + ' 天（预测 ' + cnMD(pr.nextStart) + '）';
  }

  const allRecords = period.normalizePeriods(data.periods).slice().reverse();
  // 只显示最近一次记录；其余进入"历史记录"页查看
  const lastRow = (() => {
    if (!allRecords.length) return '<div class="empty">暂无记录</div>';
    const p = allRecords[0];
    const days = p.end ? Math.round((parseDate(p.end) - parseDate(p.start)) / 86400000) + 1 : null;
    const info = `<div><b>${cnMD(p.start)}</b> 开始${p.end ? ' – ' + cnMD(p.end) + ' · 共 ' + days + ' 天' : ' · 进行中'}</div>`;
    const btn = allRecords.length > 1 ? '<button class="link" data-action="period-history">历史记录</button>' : '';
    return `<div class="rec-label">上一经期</div><div class="rec-row">${info}${btn}</div>`;
  })();

  const cycles = period.cycleLengths(data.periods).slice(-6);
  const chartLabels = period.normalizePeriods(data.periods).slice(-(cycles.length + 1)).map(p => p.start.slice(5).split('-')[0] + '月').slice(1);

  return `
  <header class="tab-head"><b>生理期</b><span class="muted">数据仅存本机，不上传</span></header>
  <div class="card period-card">
    <div class="p-status big"><span class="pdot ${cls.kind || 'none'}"></span>${esc(headline)}</div>
    ${data.periods.length ? `
      <div class="p-grid">
        <div><span>预测排卵日</span><b>${pr.ovulation ? cnMD(pr.ovulation) : '——'}</b></div>
        <div><span>易孕期</span><b>${pr.fertileStart ? cnMD(pr.fertileStart) + ' – ' + cnMD(pr.fertileEnd) : '——'}</b></div>
        <div><span>平均周期</span><b>${pr.avg} 天</b></div>
        <div><span>上次经期</span><b>${pr.lastStart ? cnMD(pr.lastStart) : '——'}</b></div>
      </div>
      ${pr.irregular ? '<p class="warn">最近几次周期长度波动较大。偶尔波动很常见；若长期不规律，建议咨询医生。</p>' : ''}` : ''}
  </div>
  <div class="card">
    <h4>经期记录</h4>
    <div class="grid2">
      <label>开始日期<input id="p-start" type="date" value="${state.editingPeriodId ? (data.periods.find(p => p.id === state.editingPeriodId) || {}).start || tk : tk}"></label>
      <label>结束日期<input id="p-end" type="date" value="${state.editingPeriodId ? (data.periods.find(p => p.id === state.editingPeriodId) || {}).end || '' : ''}"></label>
    </div>
    <div class="form-btns">
      <button class="btn ghost sm" data-action="period-new">清空输入</button>
      <button class="btn primary" data-action="period-save">${state.editingPeriodId ? '更新记录' : '保存记录'}</button>
    </div>
    ${lastRow}
  </div>
  <div class="card">
    <h4>周期设置</h4>
    <div class="stepper-row"><span>平均周期长度</span>
      <div class="stepper"><button data-action="cycle-dec">−</button><b>${s.cycleLen} 天</b><button data-action="cycle-inc">＋</button></div>
    </div>
    <div class="stepper-row"><span>平均经期天数</span>
      <div class="stepper"><button data-action="plen-dec">−</button><b>${s.periodLen} 天</b><button data-action="plen-inc">＋</button></div>
    </div>
    <div class="stepper-row"><span>经期开始日提醒</span>
      <button class="toggle ${s.periodReminder ? 'on' : ''}" data-action="reminder-toggle"><i></i></button>
    </div>
    <div class="stepper-row"><span>提醒时间</span><input id="reminder-time" type="time" value="${s.reminderTime}"></div>
  </div>
  <div class="card">
    <h4>周期趋势</h4>
    ${cycleChartHtml(cycles)}
    ${cycles.length ? `<p class="muted center">近 ${cycles.length} 个周期 · 平均 ${pr.avg} 天</p>` : ''}
    <p class="disclaimer">预测基于日历法，仅供参考，不作为医疗或避孕依据。</p>
  </div>`;
}

export function renderPeriodTab(el) {
  el.innerHTML = periodTabHtml();
  const canvas = el.querySelector('#cycle-chart');
  if (canvas) drawCycleChart(canvas, period.cycleLengths(get().periods).slice(-6));
}

// ---------- 经期历史记录页 ----------
export function historyHtml() {
  const data = get();
  const all = period.normalizePeriods(data.periods).slice().reverse();
  const rows = all.map(p => {
    const days = p.end ? Math.round((parseDate(p.end) - parseDate(p.start)) / 86400000) + 1 : null;
    return `<div class="rec-row">
      <div><b>${p.start.slice(0, 4)}年${cnMD(p.start)}</b> 开始${p.end ? ' – ' + cnMD(p.end) + ' · 共 ' + days + ' 天' : ' · 进行中'}</div>
      <div class="rec-ops">
        <button class="link" data-action="period-edit" data-id="${p.id}">编辑</button>
        <button class="link danger" data-action="period-del" data-id="${p.id}">删除</button>
      </div>
    </div>`;
  }).join('');
  return `<div class="subpage">
    <header class="sub-head">
      <b>历史记录</b>
      <span class="muted">共 ${all.length} 次</span>
      <button class="back-btn" data-action="history-close">‹ 返回</button>
    </header>
    <div class="sub-body">
      <div class="card">${rows || '<div class="empty">暂无记录</div>'}</div>
      <p class="disclaimer">点击"编辑"会回到上一页，将这条记录载入日期输入框，改好后点"更新记录"。</p>
    </div>
  </div>`;
}

// 周期趋势柱状图（原生 canvas）
export function drawCycleChart(canvas, values) {
  const ctx = canvas.getContext('2d');
  const dpr = window.devicePixelRatio || 1;
  const W = canvas.clientWidth || 320;
  const H = canvas.clientHeight || 150;
  canvas.width = W * dpr; canvas.height = H * dpr;
  ctx.scale(dpr, dpr);
  const dark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  const txt = dark ? '#b9b7b1' : '#6b6f76';
  const grid = dark ? '#2c2e33' : '#eceae4';
  const bar = '#e2557b';
  const avgC = dark ? '#7fb8a0' : '#3aa675';

  const starts = period.normalizePeriods(get().periods).slice(-(values.length + 1)).slice(1);
  const labels = starts.map(p => parseInt(p.start.slice(5), 10) + '月');
  const avg = Math.round(values.reduce((a, b) => a + b, 0) / values.length);
  const lo = 15, hi = 50;
  const L = 34, R = 8, T = 14, B = 24;
  const iw = W - L - R, ih = H - T - B;
  const yOf = v => T + (1 - (v - lo) / (hi - lo)) * ih;
  ctx.clearRect(0, 0, W, H);
  // 网格
  ctx.strokeStyle = grid; ctx.fillStyle = txt; ctx.font = '10px sans-serif';
  for (const v of [20, 30, 40]) {
    ctx.beginPath(); ctx.moveTo(L, yOf(v)); ctx.lineTo(W - R, yOf(v)); ctx.stroke();
    ctx.fillText(v + '', 4, yOf(v) + 3);
  }
  // 柱
  const bw = Math.min(34, iw / values.length * 0.55);
  values.forEach((v, i) => {
    const x = L + iw / values.length * (i + 0.5) - bw / 2;
    const y = yOf(v);
    ctx.fillStyle = bar;
    ctx.beginPath();
    const r = Math.min(5, bw / 2);
    ctx.moveTo(x, y + r);
    ctx.arcTo(x, y, x + r, y, r); ctx.arcTo(x + bw, y, x + bw, y + r, r);
    ctx.lineTo(x + bw, H - B); ctx.lineTo(x, H - B); ctx.closePath(); ctx.fill();
    ctx.fillStyle = txt;
    ctx.fillText(labels[i] || '', x + bw / 2 - ctx.measureText(labels[i] || '').width / 2, H - 8);
    ctx.fillText(v + '', x + bw / 2 - ctx.measureText(v + '').width / 2, y - 4);
  });
  // 平均线
  const ay = yOf(avg);
  ctx.strokeStyle = avgC; ctx.setLineDash([4, 3]);
  ctx.beginPath(); ctx.moveTo(L, ay); ctx.lineTo(W - R, ay); ctx.stroke();
  ctx.setLineDash([]);
  ctx.fillStyle = avgC;
  ctx.fillText('平均 ' + avg, W - R - ctx.measureText('平均 ' + avg).width, ay - 4);
}

// ---------- 设置标签页 ----------
export function settingsTabHtml() {
  const data = get();
  const s = data.settings;
  const perm = (typeof Notification !== 'undefined') ? Notification.permission : 'unsupported';
  const permTxt = perm === 'granted' ? '已允许' : perm === 'denied' ? '已被拒绝（需在浏览器设置中恢复）' : perm === 'unsupported' ? '当前环境不支持' : '未开启';
  const years = state.holidayMeta.years.join('、') || '未加载';

  return `
  <header class="tab-head"><b>设置</b></header>
  <div class="card">
    <h4>通知</h4>
    <div class="kv"><span>系统通知权限</span><b>${permTxt}</b></div>
    <div class="form-btns">
      <button class="btn primary sm" data-action="notif-enable">开启通知</button>
      <button class="btn ghost sm" data-action="notif-test">发送测试通知</button>
    </div>
    <p class="muted">日程到点与经期开始日会通过系统通知提醒。浏览器需保持本应用处于运行状态（安装为桌面应用后更可靠）。</p>
  </div>
  <div class="card">
    <h4>应用锁</h4>
    <div class="kv"><span>状态</span><b>${s.pinHash ? '已开启（启动时需输入 PIN）' : '未开启'}</b></div>
    ${s.pinHash ? `
      <div class="form-btns"><button class="btn danger sm" data-action="pin-clear">关闭应用锁</button></div>
    ` : `
      <div class="grid2">
        <label>PIN（4–8 位数字）<input id="pin1" type="password" inputmode="numeric" maxlength="8" placeholder="····"></label>
        <label>确认 PIN<input id="pin2" type="password" inputmode="numeric" maxlength="8" placeholder="····"></label>
      </div>
      <div class="form-btns"><button class="btn primary sm" data-action="pin-save">开启应用锁</button></div>
      <p class="muted">PIN 仅以哈希保存在本机，忘记后只能通过"清空全部数据"重置。</p>
    `}
  </div>
  <div class="card">
    <h4>法定节假日数据</h4>
    <div class="kv"><span>数据年份</span><b>${years}</b></div>
    <div class="kv"><span>数据来源</span><b>${data.holidaysOverride ? esc(data.holidaysOverride.source || '在线更新 / 导入') : '内置（国务院通知）'}</b></div>
    ${data.holidaysOverride && data.holidaysOverride.updated ? `<div class="kv"><span>在线更新于</span><b>${data.holidaysOverride.updated}</b></div>` : ''}
    <div class="form-btns">
      <button class="btn primary sm" data-action="holiday-sync">🔄 更新假期</button>
      <label class="btn ghost sm file-btn">导入 JSON<input id="holiday-file" type="file" accept=".json,application/json"></label>
      <button class="btn ghost sm" data-action="holiday-reset">恢复内置数据</button>
    </div>
    <p class="muted">每年 11 月前后国务院公布次年安排后，点"更新假期"即可联网获取当年与次年数据（仅此操作需要网络，其余功能始终离线可用）。</p>
  </div>
  <div class="card">
    <h4>数据备份</h4>
    <p class="muted">全部数据（日程、生理期记录、设置）仅保存在本机浏览器中。换设备或清除浏览器数据前，请先导出备份。</p>
    <div class="form-btns">
      <button class="btn ghost sm" data-action="data-export">导出备份</button>
      <label class="btn ghost sm file-btn">导入备份<input id="data-file" type="file" accept=".json,application/json"></label>
      <button class="btn danger sm" data-action="data-wipe">清空全部数据</button>
    </div>
  </div>
  <div class="card">
    <h4>关于</h4>
    <p class="muted">万年历 v1.0 · 无广告 · 离线优先<br>
    农历与黄历数据由开源库 lunar-javascript 推算；节假日数据源自国务院办公厅公开通知。<br>
    黄历宜忌等民俗内容仅供参考；生理期预测不作为医疗依据。</p>
  </div>`;
}

export function renderSettingsTab(el) { el.innerHTML = settingsTabHtml(); }

// ---------- 锁屏 ----------
export function lockHtml() {
  return `<div class="lock">
    <div class="lock-card">
      <div class="lock-icon">🔒</div>
      <b>万年历已锁定</b>
      <input id="lock-pin" type="password" inputmode="numeric" maxlength="8" placeholder="输入 PIN 解锁">
      <button class="btn primary" data-action="lock-unlock">解锁</button>
      <p class="lock-err" id="lock-err"></p>
    </div>
  </div>`;
}

export async function sha256hex(s) {
  try {
    if (window.crypto && crypto.subtle) {
      const b = await crypto.subtle.digest('SHA-256', new TextEncoder().encode('wnl:' + s));
      return [...new Uint8Array(b)].map(x => x.toString(16).padStart(2, '0')).join('');
    }
  } catch (e) { /* 退回简单哈希 */ }
  let h1 = 0, h2 = 0;
  const str = 'wnl:' + s;
  for (let i = 0; i < str.length; i++) {
    h1 = (h1 * 31 + str.charCodeAt(i)) | 0;
    h2 = (h2 * 17 + str.charCodeAt(i) + i) | 0;
  }
  return 'fb' + (h1 >>> 0).toString(16) + (h2 >>> 0).toString(16);
}

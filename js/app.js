// 应用主控：启动、标签页、事件调度、日期选择器、通知循环
import { toKey, parseDate, addDays, addMonths, todayKey } from './dates.js';
import { get, save, uid, resetAll, exportData, importData } from './store.js';
import { HolidayStore, validateHolidayJson } from './holidays.js';
import * as period from './period.js';
import { makeEvent } from './events.js';
import { state } from './state.js';
import {
  renderCalendarTab, renderPeriodTab, renderSettingsTab, renderPoemTab, renderWhyTab, renderJiri,
  renderEditor, renderPicker, pickerHtml, historyHtml,
  showMsg, esc
} from './views.js';
import { requestPermission, permissionState, tick, startLoop } from './notify.js';

let pickerOpen = false;

const $ = id => document.getElementById(id);

function render() {
  const tabs = { calendar: renderCalendarTab, poem: renderPoemTab, why: renderWhyTab, period: renderPeriodTab, settings: renderSettingsTab };
  for (const [name, fn] of Object.entries(tabs)) {
    const el = $('view-' + name);
    if (state.tab === name) { el.hidden = false; fn(el); }
    else el.hidden = true;
  }
  document.querySelectorAll('.tabbar button').forEach(b => b.classList.toggle('on', b.dataset.tab === state.tab));
  renderEditor($('overlay-root'));
  const pr = $('picker-root');
  if (pickerOpen) pr.innerHTML = pickerHtml();
  else if (pr.dataset.open === '1') pr.innerHTML = '';
  pr.dataset.open = pickerOpen ? '1' : '0';
  $('history-root').innerHTML = state.historyOpen ? historyHtml() : '';
  renderJiri();
}

function closeOverlays() {
  state.editorOpen = false;
  state.editingEventId = null;
  state.historyOpen = false;
  state.jiriOpen = false;
  pickerOpen = false;
  $('overlay-root').innerHTML = '';
  $('picker-root').innerHTML = '';
  $('history-root').innerHTML = '';
  $('jiri-root').innerHTML = '';
}

function gotoToday() {
  state.cursor = new Date();
  state.selected = todayKey();
}

// 按 current view 步进：月视图翻月、周视图翻周、年视图翻年
function navigate(dir) {
  if (state.tab !== 'calendar') return;
  if (state.view === 'month') state.cursor = addMonths(state.cursor, dir);
  else if (state.view === 'week') {
    state.selected = toKey(addDays(parseDate(state.selected), dir * 7));
    state.cursor = parseDate(state.selected);
  } else {
    state.cursor = new Date(state.cursor.getFullYear() + dir, state.cursor.getMonth(), 1);
  }
  render();
}

// 触摸滑动翻页：水平位移足够大且明显大于纵向位移时触发（不影响点按与滚动）
function attachSwipe(el) {
  let sx = 0, sy = 0, st = 0;
  el.addEventListener('touchstart', e => {
    if (e.touches.length !== 1) return;
    sx = e.touches[0].clientX;
    sy = e.touches[0].clientY;
    st = Date.now();
  }, { passive: true });
  el.addEventListener('touchend', e => {
    const t = e.changedTouches[0];
    if (!t) return;
    const dx = t.clientX - sx, dy = t.clientY - sy;
    if (Date.now() - st > 800) return;                        // 长按不算滑动
    if (Math.abs(dx) < 60 || Math.abs(dx) < Math.abs(dy) * 1.5) return; // 位移不足或纵向为主
    navigate(dx < 0 ? 1 : -1);                                // 左滑下一个，右滑上一个
  }, { passive: true });
}

function rebuildHolidayStore() {
  const data = get();
  if (state._builtinHolidays) {
    state.holidayStore = new HolidayStore(state._builtinHolidays, data.holidaysOverride);
  } else {
    state.holidayStore = data.holidaysOverride ? new HolidayStore(null, data.holidaysOverride) : null;
  }
  const src = data.holidaysOverride || state._builtinHolidays;
  state.holidayMeta = {
    source: src ? (src.source || '') : '',
    years: state.holidayStore ? state.holidayStore.yearList() : []
  };
}

// ---------- 动作 ----------
async function run(action, btn) {
  const data = get();
  const ds = btn.dataset;

  switch (action) {
    case 'tab': {
      state.tab = ds.tab;
      if (state.editorOpen || pickerOpen || state.historyOpen) closeOverlays();
      render();
      break;
    }
    case 'view':
      state.view = ds.view;
      render();
      break;

    case 'nav':
      navigate(parseInt(ds.dir, 10));
      break;
    case 'today':
      gotoToday();
      closeOverlays();
      render();
      break;
    case 'today-pick':
      gotoToday();
      closeOverlays();
      render();
      break;

    case 'open-picker': pickerOpen = true; render(); break;
    case 'picker-close': pickerOpen = false; render(); break;
    case 'pick-year':
      state.cursor = new Date(state.cursor.getFullYear() + parseInt(ds.dir, 10), state.cursor.getMonth(), 1);
      render();
      break;
    case 'pick-month':
      state.cursor = new Date(state.cursor.getFullYear(), parseInt(ds.m, 10), 1);
      state.view = 'month';
      pickerOpen = false;
      render();
      break;
    case 'pick-goto': {
      const v = $('jump-date') && $('jump-date').value;
      if (!v) { showMsg('请选择日期', true); break; }
      state.selected = v;
      state.cursor = parseDate(v);
      pickerOpen = false;
      render();
      break;
    }

    case 'goto-day':
      state.selected = ds.key;
      state.cursor = parseDate(ds.key);
      state.view = 'month';
      render();
      break;
    case 'goto-month':
      state.cursor = new Date(state.cursor.getFullYear(), parseInt(ds.m, 10), 1);
      state.view = 'month';
      render();
      break;

    case 'open-day':
      state.selected = ds.key;
      state.editorOpen = false;
      state.jiriOpen = false;
      render();
      {
        const panel = document.querySelector('.day-panel');
        if (panel) panel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
      break;
    case 'detail-nav': {
      state.selected = toKey(addDays(parseDate(state.selected), parseInt(ds.dir, 10)));
      const sel = parseDate(state.selected);
      if (sel.getMonth() !== state.cursor.getMonth() || sel.getFullYear() !== state.cursor.getFullYear()) state.cursor = sel;
      render();
      break;
    }

    case 'add-event':
      if (ds.key) state.selected = ds.key;
      state.editorOpen = true;
      state.editingEventId = null;
      render();
      break;
    case 'edit-event':
      state.editorOpen = true;
      state.editingEventId = ds.id;
      render();
      break;
    case 'editor-close':
      state.editorOpen = false;
      state.editingEventId = null;
      render();
      break;
    case 'event-save': {
      const ev = makeEvent({
        id: state.editingEventId || uid(),
        title: $('f-title').value,
        date: $('f-date').value,
        startTime: $('f-start').value,
        endTime: $('f-end').value,
        note: $('f-note').value,
        category: $('f-cat').value,
        repeat: $('f-repeat').value,
        remind: $('f-remind').value
      });
      if (!ev.date) { showMsg('请选择日期', true); break; }
      const idx = data.events.findIndex(e => e.id === ev.id);
      if (idx >= 0) data.events[idx] = ev; else data.events.push(ev);
      save();
      state.editorOpen = false;
      state.editingEventId = null;
      state.selected = ev.date;
      render();
      showMsg('已保存日程');
      tick();
      break;
    }
    case 'event-delete': {
      const idx = data.events.findIndex(e => e.id === ds.id);
      if (idx >= 0) data.events.splice(idx, 1);
      save();
      state.editorOpen = false;
      state.editingEventId = null;
      render();
      showMsg('已删除');
      break;
    }
    case 'toggle-done': {
      const ev = data.events.find(e => e.id === ds.id);
      if (ev) { ev.done = !ev.done; save(); render(); }
      break;
    }
    case 'del-event': {
      if (!confirm('删除这条日程？')) break;
      const idx = data.events.findIndex(e => e.id === ds.id);
      if (idx >= 0) data.events.splice(idx, 1);
      save();
      render();
      showMsg('已删除');
      break;
    }
    case 'festival-to-event': {
      const ev = makeEvent({
        id: uid(), title: ds.name, date: ds.key,
        category: 'memory', repeat: 'yearly', remind: '1440'
      });
      data.events.push(ev);
      save();
      showMsg('已创建每年提醒：「' + ds.name + '」，提前 1 天通知');
      tick();
      break;
    }

    // 生理期
    case 'period-start': {
      const openRec = period.normalizePeriods(data.periods).filter(p => !p.end).pop();
      if (openRec && ds.key >= openRec.start) { showMsg('已有进行中的经期记录', true); break; }
      data.periods.push({ id: uid(), start: ds.key, end: null });
      save();
      render();
      showMsg('已记录经期开始');
      break;
    }
    case 'period-end': {
      const openRec = period.normalizePeriods(data.periods).filter(p => !p.end).pop();
      if (!openRec || ds.key < openRec.start) { showMsg('没有进行中的经期', true); break; }
      openRec.end = ds.key;
      save();
      render();
      showMsg('已记录经期结束');
      break;
    }
    case 'period-new':
      state.editingPeriodId = null;
      renderPeriodTab($('view-period'));
      break;
    case 'period-save': {
      const st = $('p-start').value, en = $('p-end').value;
      if (!st) { showMsg('请选择开始日期', true); break; }
      if (en && en < st) { showMsg('结束日期不能早于开始日期', true); break; }
      if (state.editingPeriodId) {
        const rec = data.periods.find(p => p.id === state.editingPeriodId);
        if (rec) { rec.start = st; rec.end = en || null; }
        state.editingPeriodId = null;
        showMsg('已更新记录');
      } else {
        if (data.periods.some(p => p.start === st && p.end === (en || null))) { showMsg('该记录已存在', true); break; }
        data.periods.push({ id: uid(), start: st, end: en || null });
        showMsg('已保存记录');
      }
      save();
      render();
      break;
    }
    case 'period-history':
      state.historyOpen = true;
      render();
      break;
    case 'history-close':
      state.historyOpen = false;
      render();
      break;
    case 'period-edit':
      state.editingPeriodId = ds.id;
      state.historyOpen = false;
      render();
      break;
    case 'period-del': {
      if (!confirm('删除这条经期记录？')) break;
      const idx = data.periods.findIndex(p => p.id === ds.id);
      if (idx >= 0) data.periods.splice(idx, 1);
      save();
      render();
      showMsg('已删除');
      break;
    }
    case 'cycle-dec': data.settings.cycleLen = Math.max(21, data.settings.cycleLen - 1); save(); render(); break;
    case 'cycle-inc': data.settings.cycleLen = Math.min(45, data.settings.cycleLen + 1); save(); render(); break;
    case 'plen-dec': data.settings.periodLen = Math.max(2, data.settings.periodLen - 1); save(); render(); break;
    case 'plen-inc': data.settings.periodLen = Math.min(10, data.settings.periodLen + 1); save(); render(); break;
    case 'reminder-toggle':
      data.settings.periodReminder = !data.settings.periodReminder;
      save(); render();
      if (data.settings.periodReminder && permissionState() === 'default') showMsg('已开启，建议在"设置 → 通知"里开启系统通知权限');
      break;

    // 设置
    case 'tip-copy': {
      const acc = 'jasminetse@163.com';
      try {
        if (navigator.clipboard && navigator.clipboard.writeText) {
          await navigator.clipboard.writeText(acc);
          showMsg('支付宝账号已复制');
        } else { throw new Error('no clipboard'); }
      } catch (e) {
        const ta = document.createElement('textarea');
        ta.value = acc; ta.style.position = 'fixed'; ta.style.opacity = '0';
        document.body.appendChild(ta); ta.select();
        try { document.execCommand('copy'); showMsg('支付宝账号已复制'); }
        catch (e2) { showMsg('复制失败，请手动记录：' + acc, true); }
        ta.remove();
      }
      break;
    }
    case 'tip-pay': {
      const acc = 'jasminetse@163.com';
      try { if (navigator.clipboard && navigator.clipboard.writeText) await navigator.clipboard.writeText(acc); } catch (e) { /* 忽略 */ }
      showMsg('账号已复制，正在打开支付宝…');
      location.href = 'https://render.alipay.com/p/s/i?scheme=' + encodeURIComponent('alipays://platformapi/startapp?appId=09999988');
      break;
    }
    case 'notif-enable': {
      const r = await requestPermission();
      if (r === 'granted') { showMsg('通知已开启'); tick(); }
      else if (r === 'denied') showMsg('通知被拒绝，请在浏览器设置中允许', true);
      else showMsg('当前环境不支持系统通知', true);
      render();
      break;
    }
    case 'notif-test': {
      if (permissionState() !== 'granted') { showMsg('请先开启通知权限', true); break; }
      tick();
      try {
        const n = new Notification('万年历', { body: '通知工作正常 ✓', icon: 'icons/icon.svg' });
        n.onclick = () => { window.focus(); n.close(); };
      } catch (e) { showMsg('通知发送失败：' + e.message, true); }
      break;
    }
    case 'holiday-sync': {
      btn.disabled = true;
      btn.textContent = '正在获取…';
      try {
        const hs = await import('./holiday-sync.js');
        const { ok, unpublished, errors } = await hs.syncHolidays();
        if (!ok.length) {
          if (unpublished.length) showMsg(unpublished.join('、') + ' 年安排尚未公布（预计 11 月发布）', true);
          else showMsg('更新失败：' + (errors[0] || '网络不可用'), true);
          break;
        }
        const d = get();
        d.holidaysOverride = hs.mergeOverride(d.holidaysOverride, ok, todayKey());
        save();
        rebuildHolidayStore();
        render();
        showMsg('已更新 ' + ok.map(u => u.year).join('、') + ' 年放假安排' + (unpublished.length ? '；' + unpublished.join('、') + ' 年尚未公布' : ''));
      } finally {
        btn.disabled = false;
        btn.textContent = '🔄 更新假期';
      }
      break;
    }
    case 'holiday-reset':
      data.holidaysOverride = null;
      save();
      rebuildHolidayStore();
      render();
      showMsg('已恢复内置节假日数据');
      break;
    case 'data-export': {
      const blob = new Blob([exportData()], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = '万年历备份-' + todayKey().replace(/-/g, '') + '.json';
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 5000);
      showMsg('备份已导出');
      break;
    }
    case 'data-wipe': {
      if (!confirm('将清空全部日程、生理期记录与设置，且无法恢复。确定？')) break;
      if (!confirm('再次确认：真的要清空吗？')) break;
      resetAll();
      rebuildHolidayStore();
      closeOverlays();
      render();
      showMsg('已清空全部数据');
      break;
    }

    case 'open-jiri':
      state.jiriOpen = true;
      state.jiriPage = 'events';
      state.jiriCat = 'hot';
      render();
      break;
    case 'jiri-close':
      state.jiriOpen = false;
      render();
      break;
    case 'jiri-cat':
      state.jiriCat = ds.cat;
      renderJiri();
      break;
    case 'jiri-event':
      state.jiriEventName = ds.name;
      state.jiriStart = todayKey();
      state.jiriEnd = toKey(addMonths(new Date(), 3));
      state.jiriWeekendOnly = false;
      state.jiriPage = 'result';
      renderJiri();
      break;
    case 'jiri-back':
      state.jiriPage = 'events';
      renderJiri();
      break;
    case 'jiri-range': {
      const s = $('jiri-start').value, e = $('jiri-end').value;
      if (!s || !e) { showMsg('请选择起止日期', true); break; }
      if (e < s) { showMsg('结束日期不能早于开始日期', true); break; }
      state.jiriStart = s;
      state.jiriEnd = e;
      renderJiri();
      break;
    }
    case 'jiri-weekend':
      state.jiriWeekendOnly = !state.jiriWeekendOnly;
      renderJiri();
      break;
    case 'why-shuffle': {
      state.whyIdx = (await import('./whys.js')).randomWhyIndex(state.whyIdx);
      renderWhyTab($('view-why'));
      break;
    }
    case 'poem-shuffle': {
      state.poemIdx = (await import('./poems.js')).randomPoemIndex(state.poemIdx);
      state.poemDaily = false;
      renderPoemTab($('view-poem'));
      break;
    }

    // 锁屏
  }
}

// ---------- 启动 ----------
async function boot() {
  const data = get();

  // 先渲染首屏，节假日数据随后异步补充
  rebuildHolidayStore();

  render();
  const splash = document.getElementById('splash');
  if (splash) { splash.classList.add('hide'); setTimeout(() => splash.remove(), 300); }

  // 内置节假日数据：网络请求不阻塞首屏
  try {
    const r = await fetch('data/holidays.json');
    if (r.ok) {
      state._builtinHolidays = await r.json();
      rebuildHolidayStore();
      render();
    }
  } catch (e) { /* 离线或 file:// 下降级为无内置数据 */ }

  // 事件委托
  document.body.addEventListener('click', e => {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    if (btn.tagName === 'A') e.preventDefault();
    run(btn.dataset.action, btn).catch(err => {
      console.error(err);
      showMsg('操作失败：' + err.message, true);
    });
  });

  // change 事件（时间/文件输入）
  document.body.addEventListener('change', async e => {
    const t = e.target;
    if (t.id === 'reminder-time') {
      get().settings.reminderTime = t.value || '09:00';
      save();
    } else if (t.id === 'holiday-file') {
      const f = t.files && t.files[0];
      if (!f) return;
      try {
        const obj = JSON.parse(await f.text());
        const chk = validateHolidayJson(obj);
        if (!chk.ok) { showMsg('导入失败：' + chk.error, true); return; }
        const d = get();
        d.holidaysOverride = obj;
        save();
        rebuildHolidayStore();
        render();
        showMsg('节假日数据已导入（' + Object.keys(obj.years).join('、') + '）');
      } catch (err) { showMsg('导入失败：文件不是有效的 JSON', true); }
      t.value = '';
    } else if (t.id === 'data-file') {
      const f = t.files && t.files[0];
      if (!f) return;
      try {
        importData(JSON.parse(await f.text()));
        rebuildHolidayStore();
        closeOverlays();
        render();
        showMsg('备份已导入');
      } catch (err) { showMsg('导入失败：' + err.message, true); }
      t.value = '';
    }
  });

  // 通知循环
  startLoop();

  // 日历主页面左右滑动切换月/周/年
  attachSwipe(document.getElementById('view-calendar'));

  // 申请持久存储，降低系统自动清理本地数据的风险（对 iOS 尤其重要）
  try { if (navigator.storage && navigator.storage.persist) navigator.storage.persist(); } catch (e) { /* 忽略 */ }

  // Service Worker（离线可用 + 可安装），并在每次打开时检查更新
  if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === '127.0.0.1' || location.hostname === 'localhost')) {
    navigator.serviceWorker.register('sw.js').then(reg => {
      // 有新版本安装完成时立即接管；若此前已有旧版本在运行，自动刷新页面换上新代码
      reg.addEventListener('updatefound', () => {
        const nw = reg.installing;
        if (!nw) return;
        nw.addEventListener('statechange', () => {
          if (nw.state === 'installed' && navigator.serviceWorker.controller) nw.postMessage({ type: 'SKIP_WAITING' });
        });
      });
    }).catch(() => { });
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (window.__hadController) location.reload();
      window.__hadController = true;
    });
    // 打开/回到前台时主动检查更新
    const checkUpdate = () => { if (document.visibilityState === 'visible') { navigator.serviceWorker.getRegistration().then(r => r && r.update()).catch(() => { }); } };
    checkUpdate();
    document.addEventListener('visibilitychange', checkUpdate);
  }
}

boot();

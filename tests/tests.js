// 万年历单元测试（浏览器中运行：tests/test.html，与生产页面共用同一套逻辑模块）
import { pad2, fmtDate, parseDate, toKey, addDays, addMonths, diffDays } from '../js/dates.js';
import { HolidayStore, validateHolidayJson } from '../js/holidays.js';
import * as period from '../js/period.js';
import { makeEvent, occurrencesInRange, getEventsForDate } from '../js/events.js';
import { getDayDetail, cellLabel } from '../js/lunar-adapter.js';
import { parseTimor, parseHolidayCN, mergeOverride, fetchYearData } from '../js/holiday-sync.js';
import { TERM_TIPS, TERM_ORDER } from '../js/tips.js';
import { POEMS, poemOfTheDay, randomPoemIndex } from '../js/poems.js';

const out = [];
let pass = 0, fail = 0;

function ok(name, cond, extra) {
  if (cond) { pass++; out.push(`<span class="ok">[通过]</span> ${name}`); }
  else { fail++; out.push(`<span class="fail">[失败]</span> ${name}${extra ? ' —— ' + extra : ''}`); }
}

function eq(name, actual, expected) {
  ok(name, JSON.stringify(actual) === JSON.stringify(expected),
    `实际 ${JSON.stringify(actual)}，期望 ${JSON.stringify(expected)}`);
}

// ---------- 日期工具 ----------
eq('pad2', pad2(3), '03');
eq('addMonths 月末收敛', toKey(addMonths(new Date(2026, 0, 31), 1)), '2026-02-28');
eq('addDays', toKey(addDays(new Date(2026, 8, 30), 3)), '2026-10-03');
eq('diffDays', diffDays(new Date(2026, 0, 1), new Date(2026, 0, 29)), 28);

// ---------- 农历（lunar-javascript）----------
{
  const d = getDayDetail(new Date(2026, 1, 17)); // 2026-02-17 春节
  ok('农历库已加载', !!d);
  if (d) {
    eq('2026-02-17 农历正月初一', [d.monthCN, d.dayCN], ['正', '初一']);
    ok('2026-02-17 节日含春节', d.festivals.includes('春节'), JSON.stringify(d.festivals));
    eq('2026-02-17 年干支丙午', d.ganzhiY, '丙午');
    eq('2026-02-17 生肖马', d.shengxiao, '马');
  }
  const d2 = getDayDetail(new Date(2025, 0, 29)); // 2025 春节
  eq('2025-01-29 年干支乙巳', d2 && d2.ganzhiY, '乙巳');
  eq('2025-01-29 生肖蛇', d2 && d2.shengxiao, '蛇');

  const lichun = getDayDetail(new Date(2025, 1, 3)); // 2025 立春
  eq('2025-02-03 节气立春', lichun && lichun.jieqi, '立春');

  // 2025 闰六月：初一只能落在 07-24 或 07-25 之一
  const a = getDayDetail(new Date(2025, 6, 24));
  const b = getDayDetail(new Date(2025, 6, 25));
  const isLeapSixFirst = x => x && x.monthCN.indexOf('闰') === 0 && x.monthCN.indexOf('六') > 0 && x.dayCN === '初一';
  ok('2025 闰六月初一识别', isLeapSixFirst(a) !== isLeapSixFirst(b) && (isLeapSixFirst(a) || isLeapSixFirst(b)),
    `24日=${a && a.monthCN + a.dayCN}，25日=${b && b.monthCN + b.dayCN}`);

  const d3 = getDayDetail(new Date(2026, 8, 13));
  ok('2026-09-13 宜忌非空', d3 && d3.yi.length > 0 && d3.ji.length > 0,
    `宜=${JSON.stringify(d3 && d3.yi)}，忌=${JSON.stringify(d3 && d3.ji)}`);
  ok('2026-09-13 冲煞存在', !!d3.chongDesc, String(d3.chongDesc));

  const cl = cellLabel(new Date(2026, 1, 17));
  eq('春节格子标签优先节日', [cl.kind, cl.label], ['festival', '春节']);

  const cx = getDayDetail(new Date(2026, 1, 16));
  ok('2026-02-16 除夕', cx && cx.festivals.includes('除夕'), JSON.stringify(cx && cx.festivals));
}

// ---------- 节假日 ----------
const json = await fetch('../data/holidays.json').then(r => r.json());
{
  const hs = new HolidayStore(json, null);
  eq('2025-01-28 春节假期', hs.getInfo('2025-01-28'), { type: 'holiday', name: '春节', hasData: true });
  eq('2025-01-26 春节调休上班', hs.getInfo('2025-01-26'), { type: 'workday', name: '春节调休', hasData: true });
  eq('2025-10-01 国庆中秋', hs.getInfo('2025-10-01').name, '国庆节·中秋节');
  eq('2026-02-15 春节假期开始', hs.getInfo('2026-02-15').name, '春节');
  eq('2026-02-23 春节假期结束', hs.getInfo('2026-02-23').type, 'holiday');
  eq('2026-02-28 春节调休上班', hs.getInfo('2026-02-28').type, 'workday');
  eq('2026-09-25 中秋假期', hs.getInfo('2026-09-25').name, '中秋节');
  eq('2026-10-10 国庆调休上班', hs.getInfo('2026-10-10').type, 'workday');
  eq('2026-09-20 国庆调休上班（官方通知原文）', hs.getInfo('2026-09-20').type, 'workday');
  eq('2026-01-04 元旦调休上班', hs.getInfo('2026-01-04').type, 'workday');
  ok('无数据年份优雅降级', hs.getInfo('2030-05-01').hasData === false && hs.getInfo('2030-05-01').type === null);

  const nx = hs.nextHoliday(new Date(2026, 8, 13)); // 2026-09-13
  ok('假期倒计时：距中秋12天', nx && nx.name === '中秋节' && nx.days === 12, JSON.stringify(nx));

  // 数据质量：补班日不得与假期重叠
  let overlap = false;
  for (const y of Object.keys(json.years)) {
    const h = new Set();
    (json.years[y].holidays || []).forEach(g => g.days.forEach(d => h.add(d)));
    (json.years[y].workdays || []).forEach(g => g.days.forEach(d => { if (h.has(d)) overlap = true; }));
  }
  ok('调休上班日与假期无重叠', !overlap);

  ok('校验器拒绝非法数据', validateHolidayJson({ foo: 1 }).ok === false);
  ok('校验器拒绝非法日期', validateHolidayJson({ years: { 2027: { holidays: [{ name: 'x', days: ['2027-02-30'] }] } } }).ok === false);
  ok('校验器接受合法数据', validateHolidayJson(json).ok === true);
}

// ---------- 生理期 ----------
{
  const recs = [
    { id: 'a', start: '2026-07-05', end: '2026-07-09' },
    { id: 'b', start: '2026-08-02', end: '2026-08-06' }
  ];
  eq('周期长度', period.cycleLengths(recs), [28]);
  eq('平均周期（有记录）', period.avgCycle(recs, 30), 28);
  eq('平均周期（无记录回退设置）', period.avgCycle([], 30), 30);
  ok('规律判定', period.isIrregular([{ start: '2026-01-01', end: '2026-01-05' }, { start: '2026-01-29', end: '2026-02-02' }, { start: '2026-02-27', end: '2026-03-03' }]) === false);
  ok('不规律判定（28/40/28，共3个周期）', period.isIrregular([{ start: '2026-01-01' }, { start: '2026-01-29' }, { start: '2026-03-10' }, { start: '2026-04-07' }]) === true);
  ok('不足3个周期不判定', period.isIrregular([{ start: '2026-01-01' }, { start: '2026-03-10' }]) === false);

  const pr = period.predict(recs, 28, 5, '2026-08-20');
  eq('预测下次经期', pr.nextStart, '2026-08-30');
  eq('预测排卵日', pr.ovulation, '2026-08-16');
  eq('易孕窗口', [pr.fertileStart, pr.fertileEnd], ['2026-08-11', '2026-08-17']);
  eq('预测列表首项', pr.predictions[0].start, '2026-08-30');
  eq('预测经期结束', pr.predictions[0].end, '2026-09-03');

  const pr2 = period.predict(recs, 28, 5, '2026-09-20');
  eq('漏记时向前滚动', pr2.nextStart, '2026-09-27');
  ok('滚动标记', pr2.rolling === true);

  eq('实际经期标注', period.classifyDay('2026-08-03', recs, 28, 5, '2026-08-20'), { kind: 'period', dayNum: 2, ongoing: false });
  eq('排卵日标注', period.classifyDay('2026-08-16', recs, 28, 5, '2026-08-20').kind, 'ovulation');
  eq('易孕期标注', period.classifyDay('2026-08-12', recs, 28, 5, '2026-08-20').kind, 'fertile');
  eq('实际记录优先于预测', period.classifyDay('2026-09-01', recs.concat([{ id: 'c', start: '2026-08-30', end: null }]), 28, 5, '2026-09-02').kind, 'period');

  const recOngoing = [{ id: 'x', start: '2026-09-12', end: null }];
  eq('进行中经期天数', period.classifyDay('2026-09-14', recOngoing, 28, 5, '2026-09-13'), { kind: 'period', dayNum: 3, ongoing: true });
}

// ---------- 日程重复规则 ----------
{
  const weekly = makeEvent({ title: '周会', date: '2026-09-07', repeat: 'weekly', remind: 'none', category: 'work' });
  eq('每周重复展开', occurrencesInRange(weekly, '2026-09-01', '2026-09-30'),
    ['2026-09-07', '2026-09-14', '2026-09-21', '2026-09-28']);

  const yearly = makeEvent({ title: '生日', date: '2020-05-01', repeat: 'yearly', remind: 'none', category: 'memory' });
  eq('每年重复展开', occurrencesInRange(yearly, '2026-01-01', '2026-12-31'), ['2026-05-01']);

  const monthly = makeEvent({ title: '月末检查', date: '2026-01-31', repeat: 'monthly', remind: 'none', category: 'life' });
  eq('每月重复2月无31日跳过', occurrencesInRange(monthly, '2026-02-01', '2026-02-28'), []);
  eq('每月重复3月31日命中', occurrencesInRange(monthly, '2026-03-01', '2026-03-31'), ['2026-03-31']);

  const daily = makeEvent({ title: '吃药', date: '2026-09-10', repeat: 'daily', remind: 'none', category: 'life' });
  eq('每天重复展开', occurrencesInRange(daily, '2026-09-12', '2026-09-14'), ['2026-09-12', '2026-09-13', '2026-09-14']);

  const once = makeEvent({ title: '单次', date: '2026-09-13', repeat: 'none', remind: 'none', category: 'other' });
  eq('单次日程', occurrencesInRange(once, '2026-09-01', '2026-09-30'), ['2026-09-13']);
  eq('单次日程范围外', occurrencesInRange(once, '2026-10-01', '2026-10-31'), []);

  const evs = [
    makeEvent({ id: '1', title: '有时限', date: '2026-09-13', startTime: '09:00', remind: 'none', category: 'work' }),
    makeEvent({ id: '2', title: '全天', date: '2026-09-13', remind: 'none', category: 'life' })
  ];
  eq('全天日程排在前面', getEventsForDate('2026-09-13', evs).map(e => e.id), ['2', '1']);
}

// ---------- 在线更新：解析与合并 ----------
{
  // 真实 timor.tech 响应结构（节选自 2026 年实际数据）
  const timorSample = {
    code: 0,
    holiday: {
      '01-01': { holiday: true, name: '元旦', wage: 3, date: '2027-01-01', rest: 65 },
      '01-02': { holiday: true, name: '元旦', wage: 2, date: '2027-01-02', rest: 1 },
      '01-03': { holiday: true, name: '元旦', wage: 2, date: '2027-01-03', rest: 1 },
      '01-04': { holiday: false, name: '元旦后补班', wage: 1, date: '2027-01-04', rest: 1 },
      '02-15': { holiday: true, name: '春节', wage: 2, date: '2027-02-15', rest: 13 },
      '02-16': { holiday: true, name: '春节', wage: 2, date: '2027-02-16', rest: 13 }
    }
  };
  const t = parseTimor(timorSample, 2027);
  eq('timor 解析-假期分组', t.holidays, [
    { name: '元旦', days: ['2027-01-01', '2027-01-02', '2027-01-03'] },
    { name: '春节', days: ['2027-02-15', '2027-02-16'] }
  ]);
  eq('timor 解析-补班分组', t.workdays, [{ name: '元旦后补班', days: ['2027-01-04'] }]);

  const cnSample = {
    year: 2027,
    papers: ['https://www.gov.cn/x'],
    days: [
      { name: '元旦', date: '2027-01-01', isOffDay: true },
      { name: '元旦调休', date: '2027-01-09', isOffDay: false }
    ]
  };
  const c = parseHolidayCN(cnSample, 2027);
  eq('holiday-cn 解析-顶层格式', c.holidays, [{ name: '元旦', days: ['2027-01-01'] }]);
  eq('holiday-cn 解析-补班', c.workdays, [{ name: '元旦调休', days: ['2027-01-09'] }]);

  const cnNested = { years: { 2027: { days: cnSample.days } } };
  eq('holiday-cn 解析-嵌套格式', parseHolidayCN(cnNested, 2027).holidays, c.holidays);

  eq('timor 未公布年份返回空', parseTimor({ code: 0, holiday: {} }, 2027), null);
  eq('timor 异常载荷返回空', parseTimor(null, 2027), null);
  eq('holiday-cn 异常载荷返回空', parseHolidayCN({ foo: 1 }, 2027), null);

  // 合并：保留已有覆盖年份 + 新增新年份 + 记录来源与时间
  const merged = mergeOverride(
    { source: '旧', updated: '2026-01-01', years: { 2026: { holidays: [], workdays: [] } } },
    [{ year: 2027, data: t, source: 'timor.tech' }],
    '2026-11-15'
  );
  ok('合并保留旧年份', !!merged.years['2026']);
  ok('合并新增新年份', merged.years['2027'].holidays.length === 2);
  eq('合并记录更新时间', merged.updated, '2026-11-15');
  ok('合并记录来源', merged.source.indexOf('timor.tech') > -1);

  // 合并结果可直接作为 HolidayStore 的覆盖层使用
  const hs2 = new HolidayStore({ years: {} }, merged);
  eq('合并结果接入 HolidayStore', hs2.getInfo('2027-01-01'), { type: 'holiday', name: '元旦', hasData: true });
  eq('HolidayStore 覆盖层无该年数据', hs2.getInfo('2028-01-01'), { type: null, name: null, hasData: false });

  // 单年获取：数据源全部不可达时抛错
  const origFetch = globalThis.fetch;
  globalThis.fetch = () => Promise.reject(new TypeError('Failed to fetch'));
  try {
    await fetchYearData(2027).then(() => ok('断网时抛错', false), e => ok('断网时抛错', e instanceof Error && e.message.length > 0));
  } finally {
    globalThis.fetch = origFetch;
  }
}

// ---------- 节气养生 ----------
eq('节气养生覆盖24节气', TERM_ORDER.filter(t => TERM_TIPS[t] && TERM_TIPS[t].length >= 8).length, 24);
eq('节气顺序无重复', new Set(TERM_ORDER).size, 24);
ok('养生文案短小（≤40字）', TERM_ORDER.every(t => TERM_TIPS[t].length <= 40));

// ---------- 每日一诗 ----------
eq('诗词库恰为300首', POEMS.length, 300);
ok('每首诗字段完整', POEMS.every(p => p.t && p.a && p.d && p.k && Array.isArray(p.p) && p.p.length > 0 && p.p.every(l => typeof l === 'string') && p.tr && p.tr.length >= 10));
ok('唐诗宋词兼备', POEMS.some(p => p.d === '唐') && POEMS.some(p => p.d === '宋'));
ok('标题+作者组合不重复', new Set(POEMS.map(p => p.t + '|' + p.a + '|' + p.p[0])).size === POEMS.length);
eq('每日一诗确定性（同日同诗）', poemOfTheDay('2026-09-13'), poemOfTheDay('2026-09-13'));
ok('不同日期推荐不同', new Set(['2026-09-13', '2026-09-14', '2026-09-15', '2026-09-16', '2026-09-17', '2026-09-18'].map(poemOfTheDay)).size > 1);
ok('随机换一首不重复当前', POEMS.every((_, i) => randomPoemIndex(i) !== i));

// ---------- 输出 ----------
document.getElementById('out').innerHTML = out.join('\n');
const s = document.getElementById('summary');
s.textContent = `通过 ${pass} / 失败 ${fail}（共 ${pass + fail} 项）`;
s.className = fail ? 'fail' : 'pass';
document.title = (fail ? 'FAIL' : 'PASS') + ' - 万年历单元测试';
console.log(`单元测试：通过 ${pass}，失败 ${fail}`);

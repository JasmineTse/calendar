// 农历/黄历适配层：封装 lunar-javascript（js/lib/lunar.js）
// 浏览器端由 UMD 暴露全局 Lunar/Solar；测试环境可注入 globalThis.LunarLib
import { addDays } from './dates.js';

function lib() {
  const g = globalThis;
  if (g.Lunar && g.Solar) return g;
  if (g.LunarLib) return g.LunarLib;
  return null;
}

function tryFn(fn, fallback) {
  try {
    const v = fn();
    return (v === null || v === undefined) ? fallback : v;
  } catch (e) { return fallback; }
}

function arr(v) { return Array.isArray(v) ? v : []; }

// 一次性取全当天完整信息
export function getDayDetail(date) {
  const L = lib();
  if (!L) return null;
  const solar = L.Solar.fromDate(date);
  const lunar = L.Lunar.fromDate(date);

  let monthStr = tryFn(() => lunar.getMonthInChinese(), '');
  try {
    if (lunar.getMonth() < 0 && monthStr.indexOf('闰') !== 0) monthStr = '闰' + monthStr;
  } catch (e) { /* 忽略 */ }

  const festivals = [
    ...arr(tryFn(() => solar.getFestivals(), [])),
    ...arr(tryFn(() => lunar.getFestivals(), []))
  ];
  // 除夕兜底：农历库个别年份未标注时，按“次日为正月初一”推算
  if (!festivals.includes('除夕')) {
    try {
      const nx = L.Lunar.fromDate(addDays(date, 1));
      if (nx.getMonthInChinese() === '正' && nx.getDayInChinese() === '初一') festivals.push('除夕');
    } catch (e) { /* 忽略 */ }
  }

  // 传统黄历语序：冲猴(丙申)煞南
  const chongDesc = (() => {
    const sx = tryFn(() => lunar.getDayChongShengXiao(), '');
    const gz = tryFn(() => lunar.getDayChongGan(), '');
    const zhi = tryFn(() => lunar.getDayChong(), '');
    const sha = tryFn(() => lunar.getDaySha(), '');
    if (sx && gz && zhi) return '冲' + sx + '(' + gz + zhi + ')' + (sha ? '煞' + sha : '');
    return tryFn(() => lunar.getDayChongDesc(), '');
  })();

  // 当前所处的节气（含当天为节气日的情形），供节气养生展示
  let prevJieqi = '';
  try {
    const pj = lunar.getPrevJieQi();
    if (pj && typeof pj.getName === 'function') prevJieqi = pj.getName() || '';
  } catch (e) { /* 忽略 */ }

  return {
    y: solar.getYear(), m: solar.getMonth(), d: solar.getDay(),
    prevJieqi,
    week: solar.getWeek(), weekInCN: tryFn(() => solar.getWeekInChinese(), ''),
    lunarYearCN: tryFn(() => lunar.getYearInChinese(), ''),
    monthCN: monthStr,
    dayCN: tryFn(() => lunar.getDayInChinese(), ''),
    // 年干支/生肖按大众习惯以正月初一为界（春节即换新年）；月干支按节气为界
    ganzhiY: tryFn(() => lunar.getYearInGanZhi(), ''),
    ganzhiM: tryFn(() => lunar.getMonthInGanZhiExact()) || tryFn(() => lunar.getMonthInGanZhi(), ''),
    ganzhiD: tryFn(() => lunar.getDayInGanZhiExact()) || tryFn(() => lunar.getDayInGanZhi(), ''),
    shengxiao: tryFn(() => lunar.getYearShengXiao(), ''),
    jieqi: tryFn(() => lunar.getJieQi(), ''),
    festivals,
    yi: arr(tryFn(() => lunar.getDayYi(), [])),
    ji: arr(tryFn(() => lunar.getDayJi(), [])),
    jiShen: arr(tryFn(() => lunar.getDayJiShen(), [])),
    xiongSha: arr(tryFn(() => lunar.getDayXiongSha(), [])),
    chongDesc,
    sha: tryFn(() => lunar.getDaySha(), ''),
    taishen: tryFn(() => lunar.getDayPositionTai(), ''),
    pengzu: (tryFn(() => lunar.getPengZuGan(), '') + ' ' + tryFn(() => lunar.getPengZuZhi(), '')).trim(),
    xishen: tryFn(() => lunar.getDayPositionXiDesc(), ''),
    caishen: tryFn(() => lunar.getDayPositionCaiDesc(), '')
  };
}

// 日历格子上的小字：节日 > 节气 > 农历日
export function cellLabel(date) {
  const d = getDayDetail(date);
  if (!d) return { label: '', kind: 'lunar' };
  const f = d.festivals && d.festivals[0];
  if (f) return { label: f, kind: 'festival', all: d.festivals };
  if (d.jieqi) return { label: d.jieqi, kind: 'jieqi' };
  return { label: d.dayCN, kind: 'lunar' };
}

// 择吉日：事件分类 + 按黄历"宜"事项扫描吉日（基于 lunar 库推算，民俗内容仅供参考）
import { parseDate, addDays, toKey } from './dates.js';
import { getDayDetail } from './lunar-adapter.js';

// 事件目录：五类；每个事件映射到黄历"宜"事项关键词（命中任一即可）
export const JIRI_CATS = [
  {
    key: 'hot', label: '热门',
    events: [
      { name: '结婚嫁娶', yi: ['嫁娶'] },
      { name: '搬家入宅', yi: ['移徙', '入宅'] },
      { name: '理发美发', yi: ['理发'] },
      { name: '开业开市', yi: ['开市'] },
      { name: '出行旅游', yi: ['出行'] },
      { name: '祭祀祈福', yi: ['祭祀', '祈福'] },
      { name: '安床置榻', yi: ['安床'] },
      { name: '装修修缮', yi: ['修造'] }
    ]
  },
  {
    key: 'life', label: '生活',
    events: [
      { name: '沐浴清洁', yi: ['沐浴'] },
      { name: '打扫除旧', yi: ['扫舍宇', '扫舍'] },
      { name: '求医治病', yi: ['求医', '治病', '求医疗病'] },
      { name: '求子嗣', yi: ['求嗣'] },
      { name: '栽种植物', yi: ['栽种'] },
      { name: '领养宠物', yi: ['纳畜'] },
      { name: '垂钓捕鱼', yi: ['取渔', '结网', '捕捞'] },
      { name: '会友访亲', yi: ['会亲友'] },
      { name: '拆除旧屋', yi: ['破屋', '坏垣'] },
      { name: '修补填补', yi: ['补垣', '塞穴'] },
      { name: '入学开课', yi: ['入学'] },
      { name: '针灸调理', yi: ['针灸'] },
      { name: '裁制衣裳', yi: ['裁衣'] }
    ]
  },
  {
    key: 'biz', label: '工商',
    events: [
      { name: '开业开市', yi: ['开市'] },
      { name: '交易签约', yi: ['交易', '立券'] },
      { name: '收款纳财', yi: ['纳财'] },
      { name: '挂牌揭匾', yi: ['挂匾'] },
      { name: '安装机械', yi: ['安机械'] },
      { name: '出货发货', yi: ['出货', '出货财'] },
      { name: '订婚纳采', yi: ['问名', '纳采', '订盟'] },
      { name: '入职赴任', yi: ['赴任'] },
      { name: '置产买房', yi: ['置产'] }
    ]
  },
  {
    key: 'build', label: '建筑',
    events: [
      { name: '装修修造', yi: ['修造'] },
      { name: '动土奠基', yi: ['动土'] },
      { name: '竖柱立柱', yi: ['竖柱'] },
      { name: '上梁封顶', yi: ['上梁'] },
      { name: '盖屋建房的', yi: ['盖屋'] },
      { name: '造庙塑像', yi: ['造庙'] },
      { name: '掘井打井', yi: ['掘井'] },
      { name: '修坟立碑', yi: ['修坟', '立碑'] },
      { name: '平整道路', yi: ['平治道涂'] }
    ]
  },
  {
    key: 'sacrifice', label: '祭祀',
    events: [
      { name: '祭祀祖先', yi: ['祭祀'] },
      { name: '祈福许愿', yi: ['祈福'] },
      { name: '开光佛像', yi: ['开光'] },
      { name: '安葬立碑', yi: ['安葬', '立碑'] },
      { name: '除服脱孝', yi: ['除服', '成服'] }
    ]
  }
];

// 在 [startKey, endKey] 内扫描宜做 event 的日子
// opts.weekendOnly 为 true 时，仅保留周末（周六/周日，且非调休补班日）或法定节假日
// holidayStore 可为 null（此时仅按周末判断）
export function scanDays(startKey, endKey, event, opts) {
  const o = opts || {};
  const results = [];
  let d = parseDate(startKey);
  const end = parseDate(endKey);
  let guard = 0;
  while (d <= end && guard < 400) {
    guard++;
    const key = toKey(d);
    const det = getDayDetail(d);
    const matched = (event.yi || []).filter(y => (det.yi || []).includes(y));
    if (matched.length) {
      const dow = d.getDay();
      const isWeekendDay = dow === 0 || dow === 6;
      let isHoliday = false;
      let isWorkday = false;
      if (o.holidayStore) {
        const info = o.holidayStore.getInfo(key);
        isHoliday = info.type === 'holiday';
        isWorkday = info.type === 'workday';
      }
      const isRest = isHoliday || (isWeekendDay && !isWorkday);
      if (!o.weekendOnly || isRest) {
        results.push({ key, yi: matched, weekend: isWeekendDay && !isWorkday, holiday: isHoliday });
      }
    }
    d = addDays(d, 1);
  }
  return results;
}

// 按类别名查找类别
export function findCat(key) {
  return JIRI_CATS.find(c => c.key === key) || JIRI_CATS[0];
}

// 按事件名在全部类别中查找事件
export function findEvent(name) {
  for (const c of JIRI_CATS) {
    const ev = c.events.find(e => e.name === name);
    if (ev) return { cat: c, event: ev };
  }
  return null;
}

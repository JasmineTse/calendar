// 择吉日：事件目录全部来自黄历"宜"事项实际词汇（按 lunar 库一整年推算汇总），纯离线
// 每个事件的 name 即黄历术语，匹配时按当日"宜"列表是否包含该术语判断
import { parseDate, addDays, toKey } from './dates.js';
import { getDayDetail } from './lunar-adapter.js';

export const JIRI_CATS = [
  {
    key: 'hot', label: '热门',
    events: [
      { name: '嫁娶', yi: ['嫁娶'] },
      { name: '纳采', yi: ['纳采'] },
      { name: '问名', yi: ['问名'] },
      { name: '订盟', yi: ['订盟'] },
      { name: '移徙', yi: ['移徙'] },
      { name: '入宅', yi: ['入宅'] },
      { name: '开市', yi: ['开市'] },
      { name: '出行', yi: ['出行'] },
      { name: '理发', yi: ['理发'] },
      { name: '安床', yi: ['安床'] },
      { name: '修造', yi: ['修造'] },
      { name: '置产', yi: ['置产'] },
    ]
  },
  {
    key: 'life', label: '生活',
    events: [
      { name: '沐浴', yi: ['沐浴'] },
      { name: '扫舍', yi: ['扫舍'] },
      { name: '解除', yi: ['解除'] },
      { name: '治病', yi: ['治病'] },
      { name: '求医', yi: ['求医'] },
      { name: '针灸', yi: ['针灸'] },
      { name: '经络', yi: ['经络'] },
      { name: '裁衣', yi: ['裁衣'] },
      { name: '合帐', yi: ['合帐'] },
      { name: '冠笄', yi: ['冠笄'] },
      { name: '整手足甲', yi: ['整手足甲'] },
      { name: '会亲友', yi: ['会亲友'] },
      { name: '归宁', yi: ['归宁'] },
      { name: '入学', yi: ['入学'] },
      { name: '习艺', yi: ['习艺'] },
      { name: '进人口', yi: ['进人口'] },
      { name: '纳婿', yi: ['纳婿'] },
      { name: '教牛马', yi: ['教牛马'] },
      { name: '栽种', yi: ['栽种'] },
      { name: '纳畜', yi: ['纳畜'] },
      { name: '牧养', yi: ['牧养'] },
      { name: '造畜稠', yi: ['造畜稠'] },
      { name: '捕捉', yi: ['捕捉'] },
      { name: '结网', yi: ['结网'] },
      { name: '取渔', yi: ['取渔'] },
      { name: '畋猎', yi: ['畋猎'] },
      { name: '割蜜', yi: ['割蜜'] },
      { name: '开池', yi: ['开池'] },
      { name: '放水', yi: ['放水'] },
      { name: '作灶', yi: ['作灶'] },
      { name: '开厕', yi: ['开厕'] },
      { name: '修门', yi: ['修门'] },
      { name: '安碓磑', yi: ['安碓磑'] },
      { name: '断蚁', yi: ['断蚁'] },
      { name: '雕刻', yi: ['雕刻'] },
      { name: '归岫', yi: ['归岫'] },
    ]
  },
  {
    key: 'biz', label: '工商',
    events: [
      { name: '交易', yi: ['交易'] },
      { name: '立券', yi: ['立券'] },
      { name: '纳财', yi: ['纳财'] },
      { name: '挂匾', yi: ['挂匾'] },
      { name: '出货财', yi: ['出货财'] },
      { name: '开仓', yi: ['开仓'] },
      { name: '赴任', yi: ['赴任'] },
      { name: '造车器', yi: ['造车器'] },
      { name: '安机械', yi: ['安机械'] },
    ]
  },
  {
    key: 'build', label: '建筑',
    events: [
      { name: '动土', yi: ['动土'] },
      { name: '竖柱', yi: ['竖柱'] },
      { name: '上梁', yi: ['上梁'] },
      { name: '盖屋', yi: ['盖屋'] },
      { name: '起基', yi: ['起基'] },
      { name: '定磉', yi: ['定磉'] },
      { name: '合脊', yi: ['合脊'] },
      { name: '架马', yi: ['架马'] },
      { name: '安门', yi: ['安门'] },
      { name: '开柱眼', yi: ['开柱眼'] },
      { name: '作梁', yi: ['作梁'] },
      { name: '出火', yi: ['出火'] },
      { name: '拆卸', yi: ['拆卸'] },
      { name: '破屋', yi: ['破屋'] },
      { name: '坏垣', yi: ['坏垣'] },
      { name: '补垣', yi: ['补垣'] },
      { name: '塞穴', yi: ['塞穴'] },
      { name: '修饰垣墙', yi: ['修饰垣墙'] },
      { name: '平治道涂', yi: ['平治道涂'] },
      { name: '伐木', yi: ['伐木'] },
      { name: '开渠', yi: ['开渠'] },
      { name: '筑堤', yi: ['筑堤'] },
      { name: '造庙', yi: ['造庙'] },
      { name: '造桥', yi: ['造桥'] },
      { name: '造船', yi: ['造船'] },
      { name: '掘井', yi: ['掘井'] },
      { name: '开生坟', yi: ['开生坟'] },
      { name: '造仓', yi: ['造仓'] },
    ]
  },
  {
    key: 'sacrifice', label: '祭祀',
    events: [
      { name: '祭祀', yi: ['祭祀'] },
      { name: '祈福', yi: ['祈福'] },
      { name: '求嗣', yi: ['求嗣'] },
      { name: '开光', yi: ['开光'] },
      { name: '斋醮', yi: ['斋醮'] },
      { name: '普渡', yi: ['普渡'] },
      { name: '安香', yi: ['安香'] },
      { name: '塑绘', yi: ['塑绘'] },
      { name: '破土', yi: ['破土'] },
      { name: '安葬', yi: ['安葬'] },
      { name: '入殓', yi: ['入殓'] },
      { name: '移柩', yi: ['移柩'] },
      { name: '启钻', yi: ['启钻'] },
      { name: '除服', yi: ['除服'] },
      { name: '成服', yi: ['成服'] },
      { name: '修坟', yi: ['修坟'] },
      { name: '立碑', yi: ['立碑'] },
      { name: '合寿木', yi: ['合寿木'] },
      { name: '谢土', yi: ['谢土'] },
    ]
  }
];

// 在 [startKey, endKey] 内扫描宜做 event 的日子
// opts.weekendOnly 为 true 时，仅保留周末（周六/周日，且非调休补班日）或法定节假日
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

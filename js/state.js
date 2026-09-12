// 应用共享状态
import { toKey } from './dates.js';

export const state = {
  tab: 'calendar',            // calendar | period | settings
  view: 'month',              // month | week | year
  cursor: new Date(),         // 当前浏览的年月
  selected: toKey(new Date()),// 当前选中日期 'YYYY-MM-DD'
  editorOpen: false,
  editingEventId: null,       // null=新建
  holidayStore: null,
  holidayMeta: { source: '', years: [] },
  editingPeriodId: null,
  historyOpen: false,          // 经期历史记录页是否打开
  poemIdx: null,               // 当前展示的诗词下标（null=按日期取每日一诗）
  poemDaily: true,             // 是否为当日推荐（false=用户随机换过）
  whyIdx: null                 // 当前展示的"为什么"下标（null=打开时随机）
};

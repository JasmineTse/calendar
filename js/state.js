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
  historyOpen: false           // 经期历史记录页是否打开
};

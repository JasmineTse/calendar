// 唐诗宋词选集汇总：300 首（附简明白话译文）
// p 为诗句数组；词的上下阕之间用空字符串分隔
import { POEMS as P1 } from './poems-part1.js';
import { POEMS_P2 } from './poems-part2.js';
import { POEMS_P3 } from './poems-part3.js';
import { POEMS_P4 } from './poems-part4.js';
import { POEMS_P5 } from './poems-part5.js';

export const POEMS = [...P1, ...POEMS_P2, ...POEMS_P3, ...POEMS_P4, ...POEMS_P5];

// 每日一诗：按日期确定性选取（同一天人人相同，每天不同）
export function poemOfTheDay(key) {
  let h = 0;
  const s = 'poem:' + key;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return POEMS[h % POEMS.length];
}

// 随机选一首，避免与当前重复
export function randomPoemIndex(exceptIdx) {
  if (POEMS.length <= 1) return 0;
  let i = Math.floor(Math.random() * POEMS.length);
  while (i === exceptIdx) i = (i + 1) % POEMS.length;
  return i;
}

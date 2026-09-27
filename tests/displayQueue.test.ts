import { describe, expect, it } from 'vitest';
import { DisplayQueue, EVENTS_PER_SOURCE } from '../src/game/displayQueue';
import type { GameEvent } from '../src/game/sim';

const brewed = (recipe: 'glow' | 'focus' | 'elixir', amount: number, double = false): GameEvent =>
  ({ type: 'brewed', recipe, amount, double });

describe('給畫面的事件佇列', () => {
  it('一口大釜狂出事件（極速沸騰）時，其他大釜的事件不會被擠掉', () => {
    const q = new DisplayQueue();
    // 模擬幾個 tick：每個 tick 大釜依序處理，最右邊的微光恢復劑沸騰中、事件特別多
    for (let t = 0; t < 5; t++) {
      for (let k = 0; k < 5; k++) q.push(brewed('elixir', 88));
      for (let k = 0; k < 20; k++) q.push(brewed('focus', 110));
      for (let k = 0; k < 800; k++) q.push(brewed('glow', 131));
    }
    const out = q.drain();
    const count = (r: string) => out.filter((e) => e.type === 'brewed' && e.recipe === r).length;
    expect(count('elixir')).toBe(25);
    expect(count('focus')).toBeGreaterThan(0);
    expect(count('glow')).toBe(EVENTS_PER_SOURCE);
  });

  it('合併的事件數量照樣算進去（產量速率顯示用）', () => {
    const q = new DisplayQueue();
    for (let k = 0; k < 1000; k++) q.push(brewed('glow', 2));
    q.push(brewed('glow', 5, true));
    const out = q.drain();
    const normal = out.filter((e) => e.type === 'brewed' && !e.double);
    expect(normal.reduce((n, e) => n + (e.type === 'brewed' ? e.amount : 0), 0)).toBe(2000);
    // 雙倍是另一個來源，另外保留
    expect(out.filter((e) => e.type === 'brewed' && e.double)).toHaveLength(1);
  });

  it('收購箱的金額與各原料數量也會合併；原本的事件物件不被改動', () => {
    const q = new DisplayQueue();
    const originals: GameEvent[] = [];
    for (let k = 0; k < EVENTS_PER_SOURCE + 10; k++) {
      const e: GameEvent = { type: 'wholesale', crate: 'materials', amount: 3, gold: 1, items: { redheart: 3 } };
      originals.push(e);
      q.push(e);
    }
    const out = q.drain();
    const total = out.reduce((n, e) => n + (e.type === 'wholesale' ? e.gold : 0), 0);
    expect(total).toBe(EVENTS_PER_SOURCE + 10);
    const red = out.reduce((n, e) => n + (e.type === 'wholesale' ? e.items?.redheart ?? 0 : 0), 0);
    expect(red).toBe((EVENTS_PER_SOURCE + 10) * 3);
    expect(originals.every((e) => e.type === 'wholesale' && e.gold === 1)).toBe(true);
  });

  it('成交、成就等事件一定保留；取走後重新計算', () => {
    const q = new DisplayQueue();
    for (let k = 0; k < 100; k++) q.push({ type: 'sale', id: k, gold: 1, rush: false, tip: false, partial: false });
    expect(q.drain()).toHaveLength(100);
    for (let k = 0; k < 40; k++) q.push(brewed('glow', 1));
    expect(q.drain()).toHaveLength(EVENTS_PER_SOURCE);
    expect(q.length).toBe(0);
  });
});

import { describe, expect, it } from 'vitest';
import { Game } from '../src/game/game';
import type { SimContext } from '../src/game/sim';

describe('執行期的遊戲物件', () => {
  it('畫面沒在取事件（背景分頁）時，待處理的事件不會無限累積', () => {
    const game = new Game(null);
    const ctx = (game as unknown as { ctx: SimContext }).ctx;
    for (let k = 0; k < 10_000; k++) ctx.emit({ type: 'harvest', slot: 0, material: 'redheart', amount: 1 });
    const events = game.drainEvents();
    expect(events.length).toBeLessThanOrEqual(800);
    expect(events.length).toBeGreaterThan(0);
    // 留下的是最新的
    expect(game.drainEvents()).toHaveLength(0);
  });
});

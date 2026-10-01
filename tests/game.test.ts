import { describe, expect, it } from 'vitest';
import { Game } from '../src/game/game';
import { toSaveFile } from '../src/game/save';
import type { SimContext } from '../src/game/sim';
import { createInitialState, createNewGame, type GameState } from '../src/game/state';
import { skipTutorial } from '../src/game/tutorial';

/** 用「一小時前存的檔」建立遊戲，回傳第一次 advance() 有沒有跳出離線報告 */
function offlineReported(state: GameState): { reported: boolean; game: Game } {
  const game = new Game({ ...toSaveFile(state), savedAt: Date.now() - 3600_000 });
  let reported = false;
  game.onOffline = () => { reported = true; };
  game.advance();
  return { reported, game };
}

describe('離線進度', () => {
  it('開頭的教學還沒結束（只打開過網頁、看完序章但還在教學中）：不算離線進度、不跳報告', () => {
    const fresh = createNewGame();
    const a = offlineReported(fresh);
    expect(a.reported).toBe(false);
    expect(a.game.state.materials).toEqual(createNewGame().materials);

    const midway = createNewGame();
    midway.redeemed.opening = 1;
    midway.tutorial.pot = true;
    expect(offlineReported(midway).reported).toBe(false);
  });

  it('教學做完或跳過之後、以及舊存檔：照常計算並跳出報告', () => {
    const skipped = createNewGame();
    skipped.redeemed.opening = 1;
    skipTutorial(skipped);
    expect(offlineReported(skipped).reported).toBe(true);
    expect(offlineReported(createInitialState()).reported).toBe(true);
  });
});

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

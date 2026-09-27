import { describe, expect, it } from 'vitest';
import { assignLumia, equipOutfit, redeem, setDecor } from '../src/game/commands';
import { GIFT_FX } from '../src/game/config/gifts';
import { MASCOT, OUTFIT_BONUS } from '../src/game/config/mascot';
import { parseSave } from '../src/game/save';
import type { SimContext } from '../src/game/sim';
import { createInitialState, type GameState } from '../src/game/state';
import { growthSpeed } from '../src/game/stats';
import { tickWish } from '../src/game/wishes';

const ctx: SimContext = { rng: () => 0.5, offline: false, emit: () => {} };

function withWish(lamp: boolean): GameState {
  const s = createInitialState();
  s.gifts.star_lamp = true;
  if (lamp) s.decor[0] = 'star_lamp';
  s.wish = {
    kind: 'clickPot', item: null, goal: 100, progress: 0, rarity: 0, reward: 1,
    time: 240 * (lamp ? GIFT_FX.wishTime : 1), timeMax: 240 * (lamp ? GIFT_FX.wishTime : 1), lamp,
  };
  return s;
}

describe('許願星燈跟著心願進行中擺上／收起來', () => {
  it('心願進行中才擺上星燈：總時限變長、剩餘時間加上多出來的部分', () => {
    const s = withWish(false);
    s.wish!.time = 100; // 已經過了 140 秒
    setDecor(s, 0, 'star_lamp');
    expect(s.wish!.timeMax).toBeCloseTo(240 * GIFT_FX.wishTime);
    expect(s.wish!.time).toBeCloseTo(240 * GIFT_FX.wishTime - 140);
  });

  it('收起來：變回原本的時限，已經過去的時間不變；超過時也至少留幾秒', () => {
    const s = withWish(true);
    s.wish!.time = s.wish!.timeMax - 100;
    setDecor(s, 0, null);
    expect(s.wish!.timeMax).toBeCloseTo(240);
    expect(s.wish!.time).toBeCloseTo(140);
    const t = withWish(true);
    t.wish!.time = 20; // 已經過了 292 秒，超過沒有星燈的 240 秒
    setDecor(t, 0, null);
    expect(t.wish!.time).toBeGreaterThan(0);
    expect(t.wish!.time).toBeLessThanOrEqual(20);
  });

  it('每個 tick 也會同步（例如擺設格被收回時）；來回切換不會累積', () => {
    const s = withWish(false);
    s.stats.customersServed = 1;
    s.decor[0] = 'star_lamp';
    tickWish(s, 0.1, ctx);
    expect(s.wish!.timeMax).toBeCloseTo(240 * GIFT_FX.wishTime);
    s.decor[0] = null;
    tickWish(s, 0.1, ctx);
    s.decor[0] = 'star_lamp';
    tickWish(s, 0.1, ctx);
    expect(s.wish!.timeMax).toBeCloseTo(240 * GIFT_FX.wishTime);
  });

  it('舊存檔的心願沒有記錄：當成出題時就是現在的狀態，不會重複加', () => {
    const s = withWish(true);
    delete s.wish!.lamp;
    const save = parseSave(JSON.stringify({ version: 3, savedAt: 0, state: s }))!;
    expect(save.state.wish!.lamp).toBe(true);
    expect(save.state.wish!.timeMax).toBeCloseTo(240 * GIFT_FX.wishTime);
  });
});

describe('花園精靈圍裙裝', () => {
  it('兌換後可以換上；指派在溫室時生長速度 +100%（和指派的 +25% 相加）', () => {
    const s = createInitialState();
    s.happiness = 100;
    expect(equipOutfit(s, 'gardener')).toBe(false);
    expect(redeem(s, 'outfit_gardener')).toBe(true);
    expect(equipOutfit(s, 'gardener')).toBe(true);
    const slot = s.slots[0];
    const base = growthSpeed({ ...s, mascot: { ...s.mascot, assignment: 'rest' } }, slot);
    assignLumia(s, 'greenhouse');
    expect(growthSpeed(s, slot) / base).toBeCloseTo(1 + MASCOT.greenhouseBonus + OUTFIT_BONUS.gardenerGrowth);
    // 不在溫室沒有效果
    assignLumia(s, 'counter');
    expect(growthSpeed(s, slot)).toBeCloseTo(base);
  });
});

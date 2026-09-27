import { describe, expect, it } from 'vitest';
import { advanceBrew, sampleBinomial, tick, type GameEvent, type SimContext } from '../src/game/sim';
import { RECIPES } from '../src/game/config/recipes';
import { createInitialState } from '../src/game/state';
import { recipeInputs } from '../src/game/stats';

const ctx = (rng: () => number = () => 0.5): SimContext & { events: GameEvent[] } => {
  const events: GameEvent[] = [];
  return { rng, offline: false, emit: (e) => events.push(e), events };
};

/** 產量極高的微光恢復劑大釜（一個 tick 超過以前的 1000 輪上限） */
function fastGlow() {
  const s = createInitialState();
  s.slots.forEach((sl) => (sl.plant = null));
  s.customerTimer = -1e9;
  const c = s.cauldrons[0];
  c.level = 150;
  c.salamander = 2000;
  s.materials.redheart = 1e12;
  return { s, c };
}

describe('大釜一次結算多輪', () => {
  it('極速沸騰是完整的 ×6，不會被每個 tick 的處理上限卡住', () => {
    const a = fastGlow();
    const b = fastGlow();
    b.c.boil = 100;
    b.c.boilCooldown = 100;
    tick(a.s, 1, ctx());
    tick(b.s, 1, ctx());
    // 沸騰時一個 tick（1 秒）遠超過以前的 1000 輪上限
    expect(b.s.potions.glow).toBeGreaterThan(5000 * b.c.level);
    expect(b.s.potions.glow / a.s.potions.glow).toBeCloseTo(6, 1);
  });

  it('原料只夠幾輪時照原料結算，原料用量正確、事件很少', () => {
    const { s, c } = fastGlow();
    const per = recipeInputs(s, 'glow')[0][1];
    s.materials.redheart = per * c.level * 10 + per * 5; // 10 輪滿批量 + 5 瓶的份
    c.batch = 0;
    const cx = ctx();
    advanceBrew(s, c, RECIPES.glow.brewTime * 1000, cx);
    expect(s.potions.glow).toBe(c.level * 10 + 5);
    expect(s.materials.redheart).toBeCloseTo(0, 6);
    expect(cx.events.length).toBeLessThan(10);
  });

  it('雙倍輪數的抽樣：期望值正確，範圍合理', () => {
    let seed = 1;
    const rng = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    let total = 0;
    for (let k = 0; k < 200; k++) {
      const d = sampleBinomial(10_000, 0.3, rng);
      expect(d).toBeGreaterThanOrEqual(0);
      expect(d).toBeLessThanOrEqual(10_000);
      total += d;
    }
    expect(total / 200 / 10_000).toBeCloseTo(0.3, 2);
    expect(sampleBinomial(5, 0, rng)).toBe(0);
    expect(sampleBinomial(5, 1, rng)).toBe(5);
  });
});

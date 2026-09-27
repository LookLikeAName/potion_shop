import { describe, expect, it } from 'vitest';
import { FlowTracker } from '../src/game/flow';
import { tick, type SimContext } from '../src/game/sim';
import { createInitialState, type GameState } from '../src/game/state';

function run(s: GameState, seconds: number, flow: FlowTracker) {
  const ctx: SimContext = { rng: () => 0.5, offline: false, emit: (e) => flow.note(e) };
  for (let t = 0; t < seconds - 1e-9; t += 0.1) {
    tick(s, 0.1, ctx);
    flow.sample(s, 0.1);
  }
}

describe('產銷統計', () => {
  it('量出原料與藥水每秒的產量，且 產量 = 使用 + 收購 + 淨變化', () => {
    const s = createInitialState();
    s.slots[0].fairy = true; // 紅心草 1 份 / 3 秒
    s.cauldrons[0].salamander = 1; // 微光恢復劑 每 8 秒熬 1 瓶，用 2 份紅心草
    s.materials.redheart = 10;
    s.upgrades.crate_glow = 1;
    s.settings.potions.glow.keepPct = 0;
    const flow = new FlowTracker();
    run(s, 25, flow);
    const r = flow.report(s)!;
    expect(r.items.redheart.made).toBeCloseTo(1 / 3, 1);
    expect(r.items.redheart.used).toBeCloseTo(2 / 8, 1);
    expect(r.items.glow.made).toBeCloseTo(1 / 8, 1);
    expect(r.items.glow.crate).toBeGreaterThan(0);
    for (const i of ['redheart', 'glow'] as const) {
      const f = r.items[i];
      expect(f.used + f.crate + f.net).toBeCloseTo(f.made, 5);
    }
    expect(r.starved.glow).toBe(0);
  });

  it('折線圖資料：每秒一點、最多 30 點，總和與平均一致，庫存是每秒結束時的值', () => {
    const s = createInitialState();
    s.slots[0].fairy = true;
    s.cauldrons[0].salamander = 1;
    s.materials.redheart = 10;
    const flow = new FlowTracker();
    run(s, 12, flow);
    const ser = flow.series(s)!;
    // 12 秒 → 11 個走完的 1 秒桶（最後一個還在累積）
    expect(ser.ago).toHaveLength(11);
    expect(ser.ago[ser.ago.length - 1]).toBeLessThanOrEqual(0);
    for (let k = 1; k < ser.ago.length; k++) expect(ser.ago[k] - ser.ago[k - 1]).toBeCloseTo(1, 5);
    const it2 = ser.items.redheart;
    for (let k = 0; k < it2.made.length; k++) {
      // 淨變化 = 產量 − 使用 − 收購 = 這一秒的庫存變化
      expect(it2.net[k]).toBeCloseTo(it2.made[k] - it2.used[k] - it2.crate[k], 5);
      if (k > 0) expect(it2.net[k]).toBeCloseTo(it2.stock[k] - it2.stock[k - 1], 5);
    }
    run(s, 40, flow);
    expect(flow.series(s)!.ago.length).toBeLessThanOrEqual(30);
  });

  it('大釜湊不出原料時記錄等待比例；reset 後重新統計', () => {
    const s = createInitialState();
    s.slots[0].plant = null;
    s.cauldrons[0].salamander = 1;
    const flow = new FlowTracker();
    run(s, 5, flow);
    expect(flow.report(s)!.starved.glow).toBeCloseTo(1, 2);
    flow.reset();
    expect(flow.report(s)).toBeNull();
  });
});

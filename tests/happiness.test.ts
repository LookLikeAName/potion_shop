import { describe, expect, it } from 'vitest';
import { clickPlant, giveGift, redeem, setDecor } from '../src/game/commands';
import { GIFT_FX, GIFT_MAP } from '../src/game/config/gifts';
import { WISH } from '../src/game/config/wishes';
import { simulateOffline } from '../src/game/offline';
import { parseSave } from '../src/game/save';
import { harvest, tick, type GameEvent, type SimContext } from '../src/game/sim';
import { createInitialState, type GameState } from '../src/game/state';
import {
  bondLevel, decorFx, decorSlots, displayedGifts, growthSpeed, happyMult, orderScale, plantClickPower, renownLevel,
} from '../src/game/stats';
import { rollWish, tickWish, wishOptions } from '../src/game/wishes';

function ctx(rng: () => number = () => 0.5, extra: Partial<SimContext> = {}): SimContext & { events: GameEvent[] } {
  const events: GameEvent[] = [];
  return { rng, offline: false, emit: (e) => events.push(e), events, ...extra };
}

/** 已經開店、賣出第一筆（心願開放） */
function opened(): GameState {
  const s = createInitialState();
  s.stats.customersServed = 1;
  s.slots[0].fairy = true;
  s.slots[0].level = 10;
  s.cauldrons[0].salamander = 1;
  return s;
}

describe('名聲、羈絆與開心度倍率', () => {
  it('名聲 = 累計收入的位數；羈絆 = 兌換次數（聲援不算）；倍率相乘', () => {
    const s = createInitialState();
    expect(renownLevel(s)).toBe(0);
    s.stats.goldEarned = 12_345;
    expect(renownLevel(s)).toBe(4);
    s.redeemed = { decor_slot_3: 1, attunement: 3, cheer: 10 };
    expect(bondLevel(s)).toBe(4);
    expect(happyMult(s)).toBeCloseTo((1 + 0.1 * 4) * (1 + 0.15 * 4));
  });

  it('休息的開心度乘上倍率', () => {
    const a = createInitialState();
    const b = createInitialState();
    b.stats.goldEarned = 1e10;
    a.mascot.assignment = b.mascot.assignment = 'rest';
    tick(a, 60, ctx());
    tick(b, 60, ctx());
    expect(b.happiness / a.happiness).toBeCloseTo(happyMult(b), 1);
  });
});

describe('休息室擺設', () => {
  it('只有開放的格數有效果；同一件禮物換格子時兩格互換', () => {
    const s = createInitialState();
    s.gifts = { snack: true, gramophone: true, tea_set: true };
    expect(decorSlots(s)).toBe(2);
    expect(setDecor(s, 0, 'snack')).toBe(true);
    expect(setDecor(s, 1, 'gramophone')).toBe(true);
    expect(setDecor(s, 2, 'tea_set')).toBe(false); // 第 3 格還沒擴建
    expect(setDecor(s, 0, 'crystal_ball')).toBe(false); // 沒送過的不能擺
    expect(setDecor(s, 1, 'snack')).toBe(true);
    expect(s.decor.slice(0, 2)).toEqual(['gramophone', 'snack']);
    s.happiness = 3;
    redeem(s, 'decor_slot_3');
    expect(decorSlots(s)).toBe(3);
    expect(setDecor(s, 2, 'tea_set')).toBe(true);
    expect(displayedGifts(s)).toEqual(['gramophone', 'snack', 'tea_set']);
    expect(setDecor(s, 2, null)).toBe(true);
    expect(decorFx(s, 'drain')).toBe(false);
  });

  it('留聲機、魔法花束、音樂盒擺出來才有效果', () => {
    const s = createInitialState();
    s.slots[0].level = 5;
    s.potionRate.glow = 50;
    const g0 = growthSpeed(s, s.slots[0]);
    const o0 = orderScale(s, 'glow');
    const c0 = plantClickPower(s, s.slots[0]);
    s.gifts = { gramophone: true, bouquet: true, music_box: true };
    expect(growthSpeed(s, s.slots[0])).toBeCloseTo(g0); // 還收在倉庫
    s.decor[0] = 'gramophone';
    s.decor[1] = 'bouquet';
    expect(growthSpeed(s, s.slots[0])).toBeCloseTo(g0 * (1 + GIFT_FX.speed));
    expect(orderScale(s, 'glow')).toBeCloseTo(o0 * GIFT_FX.orderQty);
    s.decor[1] = 'music_box';
    expect(plantClickPower(s, s.slots[0])).toBeCloseTo(c0 * GIFT_FX.click);
  });

  it('月光捕夢網：離線金幣 ×1.5', () => {
    const make = () => {
      const s = createInitialState();
      s.slots[0].fairy = true;
      s.slots[0].level = 10;
      s.cauldrons[0].salamander = 3;
      s.cauldrons[0].level = 10;
      s.upgrades.abacus_squirrel = 1;
      return s;
    };
    const a = make();
    const b = make();
    b.gifts.dream_catcher = true;
    b.decor[0] = 'dream_catcher';
    const ra = simulateOffline(a, 3600);
    const rb = simulateOffline(b, 3600);
    expect(rb.dream).toBe(true);
    expect(rb.gold).toBeCloseTo(ra.gold * GIFT_FX.offline);
  });

  it('送禮物：擺設位滿了就收在倉庫', () => {
    const s = createInitialState();
    s.gold = 1e9;
    for (const id of ['snack', 'slime_doll', 'gramophone']) giveGift(s, id);
    expect(s.decor.slice(0, 2)).toEqual(['snack', 'slime_doll']);
    expect(s.gifts.gramophone).toBe(true);
    expect(displayedGifts(s)).not.toContain('gramophone');
    expect(s.happiness).toBe(GIFT_MAP.snack.happiness + GIFT_MAP.slime_doll.happiness + GIFT_MAP.gramophone.happiness);
  });
});

describe('小心願', () => {
  it('賣出第一筆之後才開始；冷卻結束出題', () => {
    const s = createInitialState();
    const c = ctx();
    tickWish(s, 1000, c);
    expect(s.wish).toBeNull();
    const o = opened();
    tickWish(o, WISH.firstDelay + 1, c);
    expect(o.wish).not.toBeNull();
    expect(c.events).toContainEqual(expect.objectContaining({ type: 'wish', result: 'new' }));
  });

  it('只出做得到的題目：沒有收購箱就沒有收購題、沒種的原料不會出', () => {
    const s = opened();
    const kinds = wishOptions(s).map((o) => `${o.kind}:${o.item ?? ''}`);
    expect(kinds).toContain('harvest:redheart');
    expect(kinds).not.toContain('harvest:moonshroom');
    expect(kinds.some((k) => k.startsWith('crate'))).toBe(false);
    s.crateRate = 100;
    expect(wishOptions(s).some((o) => o.kind === 'crate')).toBe(true);
  });

  it('目標量 = 放置產量 × 時限 × 係數；獎勵乘上開心度倍率與稀有度', () => {
    const s = opened();
    // rng 固定 0 → 第一個題目種類（收成紅心草）、普通心願、最短時限
    const w = rollWish(s, () => 0)!;
    expect(w.kind).toBe('harvest');
    expect(w.rarity).toBe(0);
    expect(w.timeMax).toBe(WISH.times[0]);
    const s2 = opened();
    s2.stats.goldEarned = 1e10;
    const w2 = rollWish(s2, () => 0)!;
    // 獎勵取到小數點後 2 位，比例允許 5% 誤差
    expect(Math.abs(w2.reward / w.reward / (happyMult(s2) / happyMult(s)) - 1)).toBeLessThan(0.05);
    // 抽到閃亮心願：題目 ×2、獎勵 ×3
    const shiny = rollWish(s, (() => { const seq = [0, 0.99, 0]; let i = 0; return () => seq[i++ % 3]; })())!;
    expect(shiny.rarity).toBe(2);
    expect(shiny.goal / w.goal).toBeCloseTo(2, 0);
    expect(Math.abs(shiny.reward / w.reward / 3 - 1)).toBeLessThan(0.05);
  });

  it('達成就立刻給獎勵；時間到進度過半給安慰獎，之後冷卻', () => {
    const s = opened();
    const c = ctx();
    s.wish = { kind: 'harvest', item: 'redheart', goal: 100, progress: 0, time: 60, timeMax: 60, rarity: 0, reward: 2 };
    harvest(s, 0, 1, c);
    const perHarvest = s.wish!.progress;
    expect(perHarvest).toBeGreaterThan(0);
    s.wish!.progress = 99.9;
    harvest(s, 0, 1, c);
    expect(s.wish).toBeNull();
    expect(s.happiness).toBeCloseTo(2);
    expect(s.stats.wishesDone).toBe(1);
    expect(s.wishTimer).toBeGreaterThanOrEqual(WISH.cooldownMin);

    s.wish = { kind: 'clickPot', item: null, goal: 10, progress: 6, time: 1, timeMax: 60, rarity: 0, reward: 2 };
    tickWish(s, 2, c);
    expect(s.wish).toBeNull();
    expect(s.happiness).toBeCloseTo(2 + 2 * WISH.consolation);
    expect(s.stats.wishesFailed).toBe(1);
  });

  it('點擊題：親手點盆栽才算', () => {
    const s = opened();
    const c = ctx();
    s.wish = { kind: 'clickPot', item: null, goal: 3, progress: 0, time: 60, timeMax: 60, rarity: 0, reward: 1 };
    clickPlant(s, 0, c);
    clickPlant(s, 0, c);
    expect(s.wish!.progress).toBe(2);
    clickPlant(s, 0, c);
    expect(s.wish).toBeNull();
    expect(s.happiness).toBeCloseTo(1);
  });

  it('分頁在背景或離線時：時間與進度都暫停', () => {
    const s = opened();
    s.wish = { kind: 'harvest', item: 'redheart', goal: 1e9, progress: 0, time: 60, timeMax: 60, rarity: 0, reward: 1 };
    const bg = ctx(() => 0.5, { foreground: false });
    tick(s, 30, bg);
    expect(s.wish!.time).toBe(60);
    expect(s.wish!.progress).toBe(0);
    simulateOffline(s, 3600);
    expect(s.wish!.time).toBe(60);
    expect(s.wish!.progress).toBe(0);
    tick(s, 10, ctx());
    expect(s.wish!.time).toBeCloseTo(50);
    expect(s.wish!.progress).toBeGreaterThan(0);
  });

  it('許願星燈：時限 +30%；占星水晶球：獎勵 +25%', () => {
    const s = opened();
    const w0 = rollWish(s, () => 0)!;
    s.gifts = { star_lamp: true, crystal_ball: true };
    s.decor[0] = 'star_lamp';
    s.decor[1] = 'crystal_ball';
    const w1 = rollWish(s, () => 0)!;
    expect(w1.timeMax).toBeCloseTo(w0.timeMax * GIFT_FX.wishTime);
    expect(w1.goal).toBe(w0.goal); // 題目量不變，只是多給時間
    expect(Math.abs(w1.reward / (w0.reward * GIFT_FX.wishReward) - 1)).toBeLessThan(0.05);
  });
});

describe('舊存檔轉換（版本 1 → 2）', () => {
  it('開心度兌換的家具轉成禮物並擺出來，退還開心度；魔力同調超過 5 級退還', () => {
    const save = parseSave(JSON.stringify({
      version: 1, savedAt: 1,
      state: {
        version: 1, happiness: 0.5, redeemed: { gramophone: 1, tea_set: 1, slime_doll: 1, attunement: 8 },
        giftDay: 'x', giftsToday: { snack: true },
      },
    }))!;
    const s = save.state;
    expect(s.gifts).toEqual({ gramophone: true, tea_set: true, slime_doll: true });
    expect(s.decor.slice(0, 2)).toEqual(['gramophone', 'tea_set']);
    expect(s.redeemed.gramophone).toBeUndefined();
    expect(s.redeemed.attunement).toBe(5);
    expect(s.happiness).toBeCloseTo(0.5 + 3 + 5 + 1 + 3 * 5);
    expect('giftsToday' in s).toBe(false);
  });

  it('新版存檔不會重複轉換', () => {
    const s = createInitialState();
    s.happiness = 4;
    s.gifts.gramophone = true;
    const again = parseSave(JSON.stringify({ version: 2, savedAt: 1, state: s }))!.state;
    expect(again.happiness).toBe(4);
  });
});

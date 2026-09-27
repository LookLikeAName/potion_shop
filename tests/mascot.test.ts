import { describe, expect, it } from 'vitest';
import { CUSTOMER } from '../src/game/config/balance';
import { MASCOT } from '../src/game/config/mascot';
import {
  assignLumia, canStartFever, dayKeyOf, equipOutfit, redeem, redeemCost, startFever, touchLumia,
} from '../src/game/commands';
import { offlineCapSeconds, simulateOffline } from '../src/game/offline';
import { parseSave } from '../src/game/save';
import { finishSale, spawnCustomer, tick, type GameEvent, type SimContext } from '../src/game/sim';
import { createInitialState, type GameState } from '../src/game/state';
import {
  brewPassiveSpeed, checkoutTime, condenserChance, customerPatience, growthSpeed, orderScale, sellPrice, workZone,
} from '../src/game/stats';

function ctx(rng = () => 0.5): SimContext & { events: GameEvent[] } {
  const events: GameEvent[] = [];
  return { rng, offline: false, emit: (e) => events.push(e), events };
}

function run(s: GameState, seconds: number, c = ctx()) {
  for (let t = 0; t < seconds - 1e-9; t += 0.1) tick(s, 0.1, c);
}

/** 不讓植物、顧客影響測試 */
function quiet(s: GameState) {
  s.slots.forEach((sl) => (sl.plant = null));
  s.customerTimer = -1e9;
}

describe('指派加成', () => {
  it('溫室 +25% 生長、大釜 +25% 熬煮、櫃台售價 +25% 與耐心 +25%（不影響結帳時間）', () => {
    const s = createInitialState();
    s.cauldrons[0].salamander = 1;
    const g0 = growthSpeed(s, s.slots[0]);
    const b0 = brewPassiveSpeed(s, s.cauldrons[0]);
    const p0 = customerPatience(s);
    const price0 = sellPrice(s, 'glow');
    const t0 = checkoutTime(s);

    assignLumia(s, 'greenhouse');
    expect(growthSpeed(s, s.slots[0])).toBeCloseTo(g0 * 1.25);
    assignLumia(s, 'cauldron');
    expect(brewPassiveSpeed(s, s.cauldrons[0])).toBeCloseTo(b0 * 1.25);
    expect(growthSpeed(s, s.slots[0])).toBeCloseTo(g0);
    assignLumia(s, 'counter');
    expect(sellPrice(s, 'glow')).toBeCloseTo(price0 * 1.25);
    expect(checkoutTime(s)).toBeCloseTo(t0);
    expect(customerPatience(s)).toBeCloseTo(p0 * 1.25);
  });

  it('疲勞（體力 < 25）時效果減半；休息時沒有加成', () => {
    const s = createInitialState();
    const g0 = growthSpeed(s, s.slots[0]);
    assignLumia(s, 'greenhouse');
    s.mascot.stamina = 10;
    expect(growthSpeed(s, s.slots[0])).toBeCloseTo(g0 * 1.125);
    assignLumia(s, 'rest');
    expect(growthSpeed(s, s.slots[0])).toBeCloseTo(g0);
  });
});

describe('自由活動', () => {
  it('效果跟著她目前自己選的區域', () => {
    const s = createInitialState();
    const g0 = growthSpeed(s, s.slots[0]);
    assignLumia(s, 'patrol');
    s.mascot.patrolZone = 'greenhouse';
    expect(workZone(s)).toBe('greenhouse');
    expect(growthSpeed(s, s.slots[0])).toBeCloseTo(g0 * 1.25);
    s.mascot.patrolZone = 'counter';
    expect(growthSpeed(s, s.slots[0])).toBeCloseTo(g0);
    expect(customerPatience(s)).toBeGreaterThan(CUSTOMER.patience);
  });

  it('每隔 25–45 秒換一個有事可做的區域，並且消耗體力', () => {
    const s = createInitialState();
    quiet(s);
    s.slots[0].plant = 'redheart';
    s.slots[0].fairy = true;
    assignLumia(s, 'patrol');
    const seen = new Set<string>();
    // 固定種子的亂數（用 Math.random 偶爾會剛好都沒抽到某一區，測試會不穩定）
    let seed = 12345;
    const c = ctx(() => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648));
    // 觀察 400 秒（約 10 次換區）；市場熱度等其他系統也會用到亂數，時間太短可能剛好沒抽到某一區
    for (let k = 0; k < 80; k++) {
      run(s, 5, c);
      if (s.mascot.patrolZone) seen.add(s.mascot.patrolZone);
      s.mascot.stamina = 100; // 只觀察換區，不讓她累倒
    }
    expect([...seen].sort()).toEqual(['cauldron', 'counter', 'greenhouse']);

    s.mascot.stamina = 100;
    run(s, 60, c);
    expect(s.mascot.stamina).toBeCloseTo(95, 0);
  });

  it('沒有植物時不會去溫室', () => {
    const s = createInitialState();
    quiet(s);
    assignLumia(s, 'patrol');
    const c = ctx(() => Math.random());
    for (let k = 0; k < 30; k++) {
      run(s, 10, c);
      expect(s.mascot.patrolZone).not.toBe('greenhouse');
      s.mascot.stamina = 100;
    }
  });

  it('體力耗盡自己去休息，睡飽後回到自由活動', () => {
    const s = createInitialState();
    quiet(s);
    assignLumia(s, 'patrol');
    s.mascot.stamina = 1;
    const c = ctx();
    run(s, 15, c);
    expect(s.mascot.autoRest).toBe(true);
    expect(workZone(s)).toBeNull();
    run(s, 600, c);
    expect(s.mascot.autoRest).toBe(false);
    expect(s.mascot.assignment).toBe('patrol');
  });
});

describe('體力', () => {
  it('工作每分鐘 -5；耗盡自動去休息，回滿後回到原本的指派', () => {
    const s = createInitialState();
    quiet(s);
    assignLumia(s, 'counter');
    const c = ctx();
    run(s, 60, c);
    expect(s.mascot.stamina).toBeCloseTo(95, 0);

    s.mascot.stamina = 1;
    run(s, 15, c);
    expect(s.mascot.autoRest).toBe(true);
    expect(c.events).toContainEqual({ type: 'mascot', kind: 'exhausted' });

    // 自動休息每分鐘 +10，10 分鐘回滿
    run(s, 600, c);
    expect(s.mascot.autoRest).toBe(false);
    expect(s.mascot.assignment).toBe('counter');
    expect(c.events).toContainEqual({ type: 'mascot', kind: 'woke' });
  });

  it('擺出紅茶組讓工作消耗 -50%', () => {
    const s = createInitialState();
    quiet(s);
    s.gifts.tea_set = true;
    s.decor[0] = 'tea_set';
    assignLumia(s, 'greenhouse');
    run(s, 60);
    expect(s.mascot.stamina).toBeCloseTo(97.5, 0);
  });

  it('玩家放去休息：回復 ×2，並產出開心度', () => {
    const s = createInitialState();
    quiet(s);
    s.mascot.stamina = 0;
    assignLumia(s, 'rest');
    run(s, 60);
    expect(s.mascot.stamina).toBeCloseTo(20, 0);
    // 基礎每小時 2 點 × 開心度倍率（剛開店名聲、羈絆都是 0 → ×1）
    expect(s.happiness).toBeCloseTo(MASCOT.restHappinessPerHour / 60, 4);
  });
});

describe('觸碰互動', () => {
  it('每次 +0.03、消耗 5 能量；每天第一次另外 +0.5', () => {
    const s = createInitialState();
    const r1 = touchLumia(s, 'head', false, '2026-9-25');
    expect(r1).toMatchObject({ reaction: 'headpat', daily: true });
    expect(s.happiness).toBeCloseTo(0.53);
    const r2 = touchLumia(s, 'cheek', false, '2026-9-25');
    expect(r2).toMatchObject({ reaction: 'poke', daily: false });
    expect(s.happiness).toBeCloseTo(0.56);
    expect(s.mascot.energy).toBe(MASCOT.energyMax - 10);
  });

  it('狂戳不給開心度也不耗能量；能量不足時害羞', () => {
    const s = createInitialState();
    s.mascot.dailyKey = 'today';
    expect(touchLumia(s, 'head', true, 'today')).toMatchObject({ reaction: 'panic', gain: 0 });
    expect(s.mascot.energy).toBe(MASCOT.energyMax);
    s.mascot.energy = 2;
    expect(touchLumia(s, 'head', false, 'today')).toMatchObject({ reaction: 'shy', gain: 0 });
  });

  it('能量每小時回滿', () => {
    const s = createInitialState();
    quiet(s);
    s.mascot.energy = 0;
    run(s, 1800);
    expect(s.mascot.energy).toBeCloseTo(50, 0);
  });

  it('每天凌晨 4 點換日', () => {
    const d = new Date(2026, 8, 25, 3, 59).getTime();
    expect(dayKeyOf(d)).toBe('2026-9-24');
    expect(dayKeyOf(d + 2 * 60_000)).toBe('2026-9-25');
  });
});

describe('開心度兌換', () => {
  it('只能花整數開心度；買滿後不能再買', () => {
    const s = createInitialState();
    s.happiness = 2.99;
    expect(redeem(s, 'decor_slot_3')).toBe(false);
    s.happiness = 3.5;
    expect(redeem(s, 'decor_slot_3')).toBe(true);
    expect(s.happiness).toBeCloseTo(0.5);
    expect(redeemCost(s, 'decor_slot_3')).toBeNull();
  });

  it('少女的聲援：價格遞增 2、3、4、5…，每次售價 +20%（相加）', () => {
    const s = createInitialState();
    const base = sellPrice(s, 'glow');
    s.happiness = 100;
    const costs: number[] = [];
    for (let i = 0; i < 4; i++) {
      costs.push(redeemCost(s, 'cheer')!);
      redeem(s, 'cheer');
    }
    expect(costs).toEqual([2, 3, 4, 5]);
    expect(sellPrice(s, 'glow')).toBeCloseTo(base * 1.8);
  });

  it('奇蹟綠手指不再開格子（改用金幣買）；心電感應延長離線上限；魔力同調加冷凝管機率', () => {
    const s = createInitialState();
    s.happiness = 100;
    redeem(s, 'green_thumb');
    expect(s.slots.filter((sl) => sl.open)).toHaveLength(3);
    expect(offlineCapSeconds(s)).toBe(12 * 3600);
    redeem(s, 'telepathy');
    expect(offlineCapSeconds(s)).toBe(72 * 3600);
    s.upgrades.condenser = 1;
    redeem(s, 'attunement');
    expect(condenserChance(s)).toBeCloseTo(0.25);
  });

  it('慶功宴：售價 ×3', () => {
    const s = createInitialState();
    const base = sellPrice(s, 'glow');
    s.happiness = 50;
    redeem(s, 'celebration');
    expect(sellPrice(s, 'glow')).toBeCloseTo(base * 3);
  });
});

describe('服裝', () => {
  it('沒買的服裝不能穿', () => {
    const s = createInitialState();
    expect(equipOutfit(s, 'maid')).toBe(false);
    s.redeemed.outfit_maid = 1;
    expect(equipOutfit(s, 'maid')).toBe(true);
  });

  it('女僕裝在櫃台：售價 +50%（與櫃台指派相加）；客人少買 20% 但照原本的數量付錢', () => {
    const s = createInitialState();
    const p0 = customerPatience(s);
    const price0 = sellPrice(s, 'glow');
    s.potionRate.glow = 50;
    assignLumia(s, 'counter');
    const scale0 = orderScale(s, 'glow');
    s.redeemed.outfit_maid = 1;
    equipOutfit(s, 'maid');
    // 耐心只剩櫃台指派的 +25%
    expect(customerPatience(s)).toBeCloseTo(p0 * 1.25);
    // 櫃台 +25% 加女僕裝 +50%（同一池相加）
    expect(sellPrice(s, 'glow')).toBeCloseTo(price0 * 1.75);
    expect(orderScale(s, 'glow')).toBeCloseTo(scale0 * 0.8);
    // 進門時就決定付款倍率：一瓶付 1.25 瓶的錢
    s.potions.glow = 1e6;
    const c = spawnCustomer(s, ctx(() => 0.5));
    expect(c.payMult).toBeCloseTo(1.25);
    const gold0 = s.gold;
    const delivered = c.lines.reduce((n, l) => n + l.delivered, 0);
    finishSale(s, c, ctx(() => 0.99));
    expect(s.gold - gold0).toBeCloseTo(delivered * sellPrice(s, 'glow') * 1.25);
  });

  it('法袍在大釜區：熬煮 +100%（加上指派的 25%）', () => {
    const s = createInitialState();
    s.cauldrons[0].salamander = 1;
    const b0 = brewPassiveSpeed(s, s.cauldrons[0]);
    s.redeemed.outfit_robe = 1;
    equipOutfit(s, 'robe');
    assignLumia(s, 'cauldron');
    expect(brewPassiveSpeed(s, s.cauldrons[0])).toBeCloseTo(b0 * 2.25);
  });

  it('穿睡衣離線：金幣 ×2', () => {
    const make = () => {
      const s = createInitialState();
      s.slots[0].fairy = true;
      s.slots[0].level = 10;
      s.cauldrons[0].salamander = 3;
      s.cauldrons[0].level = 10;
      return s;
    };
    const a = make();
    const b = make();
    b.redeemed.outfit_pajama = 1;
    equipOutfit(b, 'pajama');
    const ra = simulateOffline(a, 3600);
    const rb = simulateOffline(b, 3600);
    expect(rb.pajama).toBe(true);
    expect(rb.gold).toBeCloseTo(ra.gold * 2);
  });
});

describe('離線休息', () => {
  it('離線時看板娘在休息：體力回滿、產出開心度', () => {
    const s = createInitialState();
    s.mascot.stamina = 10;
    assignLumia(s, 'counter');
    const r = simulateOffline(s, 3 * 3600);
    expect(s.mascot.stamina).toBe(MASCOT.staminaMax);
    expect(r.happiness).toBeGreaterThanOrEqual(0.15 - 1e-6);
  });
});

describe('狂熱時刻', () => {
  it('需要「星空下的誓言」；每天一次、60 秒；期間生長與熬煮 ×10、自動採收', () => {
    const s = createInitialState();
    expect(canStartFever(s, 'd1')).toBe(false);
    s.redeemed.vow = 1;
    const g0 = growthSpeed(s, s.slots[0]);
    expect(startFever(s, 'd1')).toBe(true);
    expect(growthSpeed(s, s.slots[0])).toBeCloseTo(g0 * 10);
    expect(brewPassiveSpeed(s, s.cauldrons[0])).toBeGreaterThan(0); // 沒有火蜥蜴也會自己熬
    expect(startFever(s, 'd1')).toBe(false);

    s.customerTimer = -1e9;
    run(s, 61);
    expect(s.feverLeft).toBe(0);
    expect(s.materials.redheart).toBeGreaterThan(0); // 沒有花妖精也自動收成
    expect(canStartFever(s, 'd1')).toBe(false);
    expect(canStartFever(s, 'd2')).toBe(true);
  });
});

describe('成就', () => {
  it('達成時給一次開心度，不重複', () => {
    const s = createInitialState();
    s.potions.glow = 10;
    s.upgrades.abacus_squirrel = 1;
    const c = ctx(() => 0);
    const cust = spawnCustomer(s, c);
    expect(cust.status).toBe('ready');
    run(s, 6, c);
    expect(s.achievements.first_sale).toBe(true);
    const h = s.happiness;
    run(s, 3, c);
    expect(c.events.filter((e) => e.type === 'achievement' && e.id === 'first_sale')).toHaveLength(1);
    expect(s.happiness).toBeGreaterThanOrEqual(h);
  });
});

describe('舊存檔相容（M3）', () => {
  it('沒有看板娘欄位的存檔可以載入', () => {
    const save = parseSave(JSON.stringify({ version: 1, savedAt: 1, state: { gold: 5 } }))!;
    expect(save.state.mascot).toMatchObject({ assignment: 'patrol', stamina: 100, outfit: 'default' });
    expect(save.state.redeemed).toEqual({});
  });
});

import { describe, expect, it } from 'vitest';
import { CUSTOMER, UPGRADE_FX } from '../src/game/config/balance';
import {
  activeCombo, clickCauldron, clickPlant, getQuote, giftAvailable, giftPrice, giveGift, moveCauldron, purchase,
  ringBell, setMaterialKeep, setMaterialSell, setReserve, unlockRecipe,
} from '../src/game/commands';
import { parseAmount } from '../src/game/format';
import { simulateOffline } from '../src/game/offline';
import { parseSave } from '../src/game/save';
import { completeBrew, finishSale, spawnCustomer, tick, type GameEvent, type SimContext } from '../src/game/sim';
import { createInitialState, type GameState } from '../src/game/state';
import { brewPassiveSpeed, cratePct, materialReserve, maxCustomerQty } from '../src/game/stats';

function ctx(rng = () => 0.5): SimContext & { events: GameEvent[] } {
  const events: GameEvent[] = [];
  return { rng, offline: false, emit: (e) => events.push(e), events };
}

function run(s: GameState, seconds: number, c = ctx()) {
  for (let t = 0; t < seconds - 1e-9; t += 0.1) tick(s, 0.1, c);
}

const own = (s: GameState, ...ids: string[]) => ids.forEach((id) => (s.upgrades[id] = 1));

describe('星銀澆水壺', () => {
  it('點擊盆栽時，相鄰且生長中的盆栽獲得 50% 推進', () => {
    const s = createInitialState();
    own(s, 'star_can');
    s.slots[1].plant = 'redheart';
    s.slots[2].plant = 'redheart';
    clickPlant(s, 1, ctx());
    expect(s.slots[1].progress).toBeCloseTo(0.5);
    expect(s.slots[0].progress).toBeCloseTo(0.25);
    expect(s.slots[2].progress).toBeCloseTo(0.25);
  });

  it('沒有澆水壺時不影響鄰居；浮空盆栽不會潑到前排', () => {
    const s = createInitialState();
    s.slots[1].plant = 'redheart';
    clickPlant(s, 0, ctx());
    expect(s.slots[1].progress).toBe(0);

    own(s, 'star_can');
    s.slots[3] = { ...s.slots[3], open: true, plant: 'redheart' };
    clickPlant(s, 3, ctx());
    expect(s.slots[0].progress).toBeCloseTo(0.5); // 只有第一次點擊自己的推進
  });
});

describe('附魔園藝剪', () => {
  it('暴擊時立即收成，產量 ×3', () => {
    const s = createInitialState();
    own(s, 'shears');
    s.slots[0].level = 4;
    const c = ctx(() => 0); // 必定暴擊
    expect(clickPlant(s, 0, c)).toBe('crit');
    expect(s.materials.redheart).toBe(12);
    expect(c.events).toContainEqual(expect.objectContaining({ type: 'harvest', crit: true }));
  });

  it('沒擲中時照常推進', () => {
    const s = createInitialState();
    own(s, 'shears');
    expect(clickPlant(s, 0, ctx(() => 0.99))).toBe('grow');
  });
});

describe('隱形僕役湯勺', () => {
  it('每級被動熬煮 ×1.5，最多 3 級，價格 20K/200K/2M', () => {
    const s = createInitialState();
    s.cauldrons[0].salamander = 1;
    const base = brewPassiveSpeed(s, s.cauldrons[0]);
    s.gold = 1e7;
    purchase(s, { kind: 'global', id: 'servant_ladle' }, 'max');
    expect(s.upgrades.servant_ladle).toBe(3);
    expect(s.gold).toBe(1e7 - 2_220_000);
    expect(brewPassiveSpeed(s, s.cauldrons[0])).toBeCloseTo(base * 3.375);
  });
});

describe('龍息風箱', () => {
  it('連點 10 下進入極速沸騰（×6），結束後冷卻期間不累積連擊', () => {
    const s = createInitialState();
    own(s, 'bellows');
    s.materials.redheart = 1000;
    s.cauldrons[0].level = 1;
    const c = ctx();
    for (let i = 0; i < 9; i++) clickCauldron(s, 'glow', c);
    expect(s.cauldrons[0].boil).toBe(0);
    expect(activeCombo(s, s.cauldrons[0])).toBe(9);
    clickCauldron(s, 'glow', c);
    expect(s.cauldrons[0].boil).toBe(UPGRADE_FX.boilTime);
    expect(c.events).toContainEqual({ type: 'boil', recipe: 'glow' });

    // 沸騰中點擊推進 ×6（微光：0.5 秒 → 3 秒）
    s.cauldrons[0].progress = 0;
    s.cauldrons[0].batch = 1;
    clickCauldron(s, 'glow', c);
    expect(s.cauldrons[0].progress).toBeCloseTo(3);

    // 沸騰 5 秒後結束，還在冷卻：連擊不會累積
    run(s, UPGRADE_FX.boilTime + 0.2, c);
    expect(s.cauldrons[0].boil).toBe(0);
    expect(s.cauldrons[0].boilCooldown).toBeGreaterThan(0);
    for (let i = 0; i < 12; i++) clickCauldron(s, 'glow', c);
    expect(s.cauldrons[0].boil).toBe(0);
  });

  it('點擊間隔超過 1 秒，連擊重新計算', () => {
    const s = createInitialState();
    own(s, 'bellows');
    s.materials.redheart = 1000;
    const c = ctx();
    for (let i = 0; i < 5; i++) clickCauldron(s, 'glow', c);
    run(s, 1.5, c);
    clickCauldron(s, 'glow', c);
    expect(s.cauldrons[0].combo).toBe(1);
  });

  it('沒有風箱時不會累積連擊', () => {
    const s = createInitialState();
    s.materials.redheart = 1000;
    for (let i = 0; i < 20; i++) clickCauldron(s, 'glow', ctx());
    expect(s.cauldrons[0].boil).toBe(0);
  });
});

describe('雙口冷凝管', () => {
  it('擲中時產出 ×2；離線取期望值 ×1.15', () => {
    const s = createInitialState();
    own(s, 'condenser');
    s.cauldrons[0].batch = 4;
    completeBrew(s, s.cauldrons[0], ctx(() => 0));
    expect(s.potions.glow).toBe(8);

    s.cauldrons[0].batch = 4;
    completeBrew(s, s.cauldrons[0], { ...ctx(), offline: true });
    expect(s.potions.glow).toBeCloseTo(8 + 4 * 1.15);
  });
});

describe('叫賣鈴鐺', () => {
  it('買下時 3 次；每次招來一位顧客；每 30 秒回復 1 次', () => {
    const s = createInitialState();
    s.gold = 5000;
    purchase(s, { kind: 'global', id: 'bell' }, 1);
    expect(s.bellCharges).toBe(3);
    const c = ctx();
    expect(ringBell(s, c)).toBe('ok');
    expect(s.customers).toHaveLength(1);
    expect(s.bellCharges).toBe(2);
    s.customerTimer = -1e9; // 不讓顧客自然來
    run(s, UPGRADE_FX.bellRecharge + 0.2, c);
    expect(s.bellCharges).toBe(3);
  });

  it('排隊滿了或沒有次數時不能搖', () => {
    const s = createInitialState();
    own(s, 'bell');
    s.bellCharges = 3;
    const c = ctx();
    for (let i = 0; i < CUSTOMER.queueMax; i++) spawnCustomer(s, c);
    expect(ringBell(s, c)).toBe('full');
    s.customers = [];
    s.bellCharges = 0;
    expect(ringBell(s, c)).toBe('empty');
  });
});

describe('慷慨的酒鬼體質', () => {
  it('擲中時該筆金幣 ×2', () => {
    const s = createInitialState();
    own(s, 'drunks');
    s.potions.glow = 10;
    const cust = spawnCustomer(s, ctx(() => 0)); // qty 1
    finishSale(s, cust, ctx(() => 0));
    expect(s.gold).toBeCloseTo(5 * 2);
  });
});

describe('商會收購箱', () => {
  it('每種藥水與原料各有一個收購箱，各自升級：微光的價格表 100/1.5K/6K/25K，收購價 30% → 60%', () => {
    const s = createInitialState();
    s.gold = 100_000;
    expect(getQuote(s, { kind: 'global', id: 'crate_glow' }, 1)?.cost).toBe(100);
    purchase(s, { kind: 'global', id: 'crate_glow' }, 'max');
    expect(s.upgrades.crate_glow).toBe(4);
    expect(s.gold).toBe(100_000 - 32_600);
    expect(cratePct(s, 'crate_glow')).toBeCloseTo(0.6);
    expect(cratePct(s, 'crate_materials')).toBe(0);
    expect(getQuote(s, { kind: 'global', id: 'crate_glow' }, 1)?.count).toBe(0);
  });

  it('配方沒解鎖時，對應的收購箱不能買', () => {
    const s = createInitialState();
    s.gold = 1e9;
    expect(getQuote(s, { kind: 'global', id: 'crate_focus' }, 1)).toBeNull();
    unlockRecipe(s, 'focus');
    expect(getQuote(s, { kind: 'global', id: 'crate_focus' }, 1)?.cost).toBe(1000);
  });

  it('只收購有收購箱的藥水，並依各自的保留量', () => {
    const s = createInitialState();
    s.gold = 1e9;
    unlockRecipe(s, 'focus');
    s.gold = 0;
    own(s, 'crate_glow');
    setReserve(s, 'glow', 10);
    setReserve(s, 'focus', 5);
    s.potions.glow = 35;
    s.potions.focus = 30; // 沒有專注糖漿的收購箱：不收
    s.customerTimer = -1e9;
    const c = ctx();
    run(s, 1.05, c);
    expect(s.potions.glow).toBe(10);
    expect(s.potions.focus).toBe(30);
    expect(s.gold).toBeCloseTo(25 * 5 * 0.3);
    expect(c.events).toContainEqual(expect.objectContaining({ type: 'wholesale', crate: 'glow', amount: 25 }));

    own(s, 'crate_focus');
    run(s, 1.05, c);
    expect(s.potions.focus).toBe(5);
  });

  it('多餘原料需要原料收購箱：保留所有大釜熬 3 輪的量，價格 = 基準價 × 收購比例', () => {
    const s = createInitialState();
    own(s, 'crate_materials');
    s.cauldrons[0].level = 10; // 微光：每輪 2 × 10 = 20 紅心草 → 保留 60
    s.materials.redheart = 1060;
    s.slots[0].plant = null; // 不讓盆栽在測試中繼續長
    s.customerTimer = -1e9;
    const c = ctx();
    // 大釜開工會先拿走 20，剩下 1040 → 保留 60，收購 980
    run(s, 1.05, c);
    expect(s.materials.redheart).toBe(60);
    expect(s.stats.materialsWholesaled).toBe(980);
    expect(s.gold).toBeCloseTo(980 * 0.5 * 0.3);
    expect(c.events).toContainEqual(expect.objectContaining({ type: 'wholesale', crate: 'materials', amount: 980 }));
  });

  it('原料保留量用百分比：100% = 大釜熬 1 輪，0% = 全部收購', () => {
    const s = createInitialState();
    own(s, 'crate_materials');
    s.cauldrons[0].level = 30; // 微光：每輪 2 × 30 = 60 紅心草
    s.slots[0].plant = null;
    s.customerTimer = -1e9;
    setMaterialKeep(s, 'redheart', 100);
    expect(materialReserve(s, 'redheart')).toBe(60);
    setMaterialKeep(s, 'redheart', 250);
    expect(materialReserve(s, 'redheart')).toBe(150);
    setMaterialKeep(s, 'redheart', 10); // 6 份，但至少保留 20
    expect(materialReserve(s, 'redheart')).toBe(UPGRADE_FX.materialReserveMin);
    setMaterialKeep(s, 'redheart', -50);
    expect(s.settings.materials.redheart.keepPct).toBe(0);
    expect(materialReserve(s, 'redheart')).toBe(0);
    s.cauldrons = [];
    s.materials.redheart = 500;
    run(s, 1.05);
    expect(s.materials.redheart).toBe(0);
  });

  it('每種原料可以分別關閉收購；只有藥水收購箱時也不收原料', () => {
    const s = createInitialState();
    own(s, 'crate_materials');
    setMaterialSell(s, 'redheart', false);
    s.materials.redheart = 1000;
    s.materials.moonshroom = 1000;
    s.slots[0].plant = null;
    s.cauldrons = [];
    const c = ctx();
    run(s, 1.05, c);
    expect(s.materials.redheart).toBe(1000);
    expect(s.materials.moonshroom).toBe(UPGRADE_FX.materialReserveMin);
    expect(c.events).toContainEqual(expect.objectContaining({
      type: 'wholesale', crate: 'materials', items: { moonshroom: 1000 - UPGRADE_FX.materialReserveMin },
    }));

    const t = createInitialState();
    own(t, 'crate_glow');
    t.materials.redheart = 1000;
    t.slots[0].plant = null;
    t.cauldrons = [];
    run(t, 1.05);
    expect(t.materials.redheart).toBe(1000);
  });

  it('保留量各自設定，可以設到很大的數字，但不會小於 0 或超過上限', () => {
    const s = createInitialState();
    setReserve(s, 'glow', -5);
    setReserve(s, 'focus', 25_000);
    expect(s.settings.reserves.glow).toBe(0);
    expect(s.settings.reserves.focus).toBe(25_000);
    setReserve(s, 'focus', 1e12);
    expect(s.settings.reserves.focus).toBe(UPGRADE_FX.reserveMax);
    expect(s.settings.reserves.elixir).toBe(UPGRADE_FX.reserveDefault);
  });

  it('舊存檔：一個收購箱換成四個同等級的，共用保留量套用到每種藥水', () => {
    const save = parseSave(JSON.stringify({
      version: 1, savedAt: 1,
      state: { upgrades: { crate: 2, owl: 1 }, settings: { reserve: 35, sellMaterials: false } },
    }))!;
    expect(save.state.upgrades).toMatchObject({ crate_glow: 2, crate_focus: 2, crate_elixir: 2, crate_materials: 2 });
    expect(save.state.upgrades.crate).toBeUndefined();
    expect(save.state.settings.reserves).toEqual({ glow: 35, focus: 35, elixir: 35 });
    // 舊的原料總開關關閉 → 每種原料都不賣，保留量用預設
    expect(save.state.settings.materials.redheart).toEqual({ sell: false, keepPct: UPGRADE_FX.materialKeepDefault });
    expect(save.state.settings.materials.moonshroom.sell).toBe(false);
    expect('sellMaterials' in save.state.settings).toBe(false);
  });
});

describe('輸入數量', () => {
  it('支援 K、M、B 與千分位逗號，看不懂就回傳 null', () => {
    expect(parseAmount('500')).toBe(500);
    expect(parseAmount(' 2k ')).toBe(2000);
    expect(parseAmount('1.5M')).toBe(1_500_000);
    expect(parseAmount('1.20K')).toBe(1200);
    expect(parseAmount('1,200')).toBe(1200);
    expect(parseAmount('abc')).toBeNull();
    expect(parseAmount('')).toBeNull();
  });
});

describe('過勞精靈工會合約', () => {
  it('離線時自動點擊，收益比沒有合約高', () => {
    const make = () => {
      const s = createInitialState();
      s.slots[0].level = 5;
      s.cauldrons[0].salamander = 1;
      return s;
    };
    const a = make();
    const b = make();
    own(b, 'guild_contract');
    const ra = simulateOffline(a, 3600);
    const rb = simulateOffline(b, 3600);
    expect(rb.gold).toBeGreaterThan(ra.gold);
  });
});

describe('大釜排序', () => {
  it('移動後順序改變，左邊的優先拿原料', () => {
    const s = createInitialState();
    s.gold = 1e6;
    unlockRecipe(s, 'focus');
    expect(moveCauldron(s, 1, 0)).toBe(true);
    expect(s.cauldrons.map((c) => c.recipe)).toEqual(['focus', 'glow']);
    expect(moveCauldron(s, 0, 5)).toBe(false);
  });
});

describe('無限升級（金幣出口）', () => {
  it('魔法肥料：收成量 +10%/級', () => {
    const s = createInitialState();
    s.upgrades.fertilizer = 3;
    s.slots[0].level = 10;
    s.slots[0].ready = true;
    clickPlant(s, 0, ctx(() => 0.99)); // 不豐收
    expect(s.materials.redheart).toBeCloseTo(13);
  });

  it('保溫魔法陣：被動熬煮 +15%/級', () => {
    const s = createInitialState();
    s.cauldrons[0].salamander = 1;
    const b0 = brewPassiveSpeed(s, s.cauldrons[0]);
    s.upgrades.warm_circle = 2;
    expect(brewPassiveSpeed(s, s.cauldrons[0])).toBeCloseTo(b0 * 1.3);
  });

  it('宣傳海報：需求上限 +1/級，價格每級 ×2', () => {
    const s = createInitialState();
    s.gold = 1e6;
    const before = maxCustomerQty(s);
    purchase(s, { kind: 'global', id: 'poster' }, 1);
    purchase(s, { kind: 'global', id: 'poster' }, 1);
    expect(maxCustomerQty(s)).toBe(before + 2);
    expect(s.gold).toBe(1e6 - 3000 - 6000);
  });
});

describe('送禮物', () => {
  it('價格 = 目前收入 × 分鐘數（至少最低價），每天每種一次', () => {
    const s = createInitialState();
    expect(giftPrice(s, 'snack')).toBe(200);
    s.incomeRate = 100; // 每秒 100 金
    expect(giftPrice(s, 'snack')).toBe(12000); // 2 分鐘
    expect(giftPrice(s, 'hairpin')).toBe(60000); // 10 分鐘

    s.gold = 1e6;
    expect(giveGift(s, 'snack', 'd1')).toBe(true);
    expect(s.happiness).toBeCloseTo(0.1);
    expect(giveGift(s, 'snack', 'd1')).toBe(false);
    expect(giftAvailable(s, 'snack', 'd2')).toBe(true);
    expect(giveGift(s, 'snack', 'd2')).toBe(true);
  });

  it('錢不夠不能送', () => {
    const s = createInitialState();
    s.gold = 100;
    expect(giveGift(s, 'snack', 'd1')).toBe(false);
    expect(s.happiness).toBe(0);
  });

  it('收入追蹤會跟著實際收入變化', () => {
    const s = createInitialState();
    s.potions.glow = 1e6;
    s.cauldrons[0].level = 1;
    const c = ctx(() => 0);
    run(s, 300, c);
    expect(s.incomeRate).toBeGreaterThan(0);
  });
});

describe('舊存檔相容', () => {
  it('缺少 M2 欄位的存檔可以載入', () => {
    const old = {
      version: 1, savedAt: 1,
      state: { gold: 5, cauldrons: [{ recipe: 'glow', level: 3, progress: 0, batch: 0, salamander: 1 }] },
    };
    const save = parseSave(JSON.stringify(old))!;
    expect(save.state.cauldrons[0]).toMatchObject({ level: 3, combo: 0, boil: 0 });
    expect(save.state.settings.reserves.glow).toBe(UPGRADE_FX.reserveDefault);
    expect(save.state.settings.materials.redheart).toEqual({ sell: true, keepPct: UPGRADE_FX.materialKeepDefault });
    expect(save.state.bellCharges).toBe(0);
  });
});

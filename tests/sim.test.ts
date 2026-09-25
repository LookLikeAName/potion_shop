import { describe, expect, it } from 'vitest';
import { CUSTOMER } from '../src/game/config/balance';
import {
  clickCauldron, clickPlant, getQuote, plantSeed, purchase, replant, replantCost, unlockRecipe,
} from '../src/game/commands';
import { bulkCost, maxAffordable } from '../src/game/costs';
import { formatNumber } from '../src/game/format';
import { simulateOffline } from '../src/game/offline';
import { exportSave, importSave, parseSave } from '../src/game/save';
import { spawnCustomer, tick, type GameEvent, type SimContext } from '../src/game/sim';
import { createInitialState, type GameState } from '../src/game/state';
import { combine, growthSpeed } from '../src/game/stats';

function ctx(rng = () => 0.5): SimContext & { events: GameEvent[] } {
  const events: GameEvent[] = [];
  return { rng, offline: false, emit: (e) => events.push(e), events };
}

function run(s: GameState, seconds: number, c = ctx()) {
  for (let t = 0; t < seconds; t += 0.1) tick(s, 0.1, c);
}

describe('溫室', () => {
  it('沒有花妖精時，植物長滿會停在成熟狀態，需要手動採收', () => {
    const s = createInitialState();
    const c = ctx();
    run(s, 5, c);
    expect(s.slots[0].ready).toBe(true);
    expect(s.materials.redheart).toBe(0);
    expect(clickPlant(s, 0, c)).toBe('harvest');
    expect(s.materials.redheart).toBe(1);
  });

  it('有花妖精時自動採收，產量 = 等級', () => {
    const s = createInitialState();
    s.slots[0].fairy = true;
    s.slots[0].level = 3;
    s.cauldrons = [];
    run(s, 3.05);
    expect(s.materials.redheart).toBe(3);
  });

  it('點擊推進生長進度', () => {
    const s = createInitialState();
    const c = ctx();
    for (let i = 0; i < 6; i++) clickPlant(s, 0, c);
    expect(s.slots[0].ready).toBe(true);
  });

  it('等級 10 里程碑讓速度 ×2', () => {
    const s = createInitialState();
    const slot = s.slots[0];
    slot.level = 9;
    const before = growthSpeed(s, slot);
    slot.level = 10;
    expect(growthSpeed(s, slot)).toBeCloseTo(before * 2);
  });
});

describe('大釜', () => {
  it('沒有火蜥蜴時不會自己熬煮', () => {
    const s = createInitialState();
    s.materials.redheart = 10;
    run(s, 20);
    expect(s.potions.glow).toBe(0);
    expect(s.cauldrons[0].batch).toBe(1);
  });

  it('點擊可以熬煮，缺料時回傳 missing', () => {
    const s = createInitialState();
    const c = ctx();
    expect(clickCauldron(s, 'glow', c)).toBe('missing');
    s.materials.redheart = 2;
    for (let i = 0; i < 8; i++) clickCauldron(s, 'glow', c);
    expect(s.potions.glow).toBe(1);
  });

  it('火蜥蜴 Lv1 = 基礎速度 50%；批量 = min(等級, 可湊份數)', () => {
    const s = createInitialState();
    s.cauldrons[0].salamander = 1;
    s.cauldrons[0].level = 5;
    s.materials.redheart = 6; // 只夠 3 份
    s.customerTimer = -1e9; // 不讓顧客把藥水買走
    run(s, 8.05);
    expect(s.potions.glow).toBe(3);
  });

  it('共用原料時，最左邊的大釜優先', () => {
    const s = createInitialState();
    s.gold = 1e6;
    unlockRecipe(s, 'focus');
    // 把專注糖漿移到最左邊
    s.cauldrons.reverse();
    s.materials.redheart = 1;
    s.materials.moonshroom = 2;
    tick(s, 0.1, ctx());
    expect(s.cauldrons[0].recipe).toBe('focus');
    expect(s.cauldrons[0].batch).toBe(1);
    expect(s.cauldrons[1].batch).toBe(0);
  });
});

describe('顧客', () => {
  it('庫存足夠時結帳收錢', () => {
    const s = createInitialState();
    s.potions.glow = 10;
    const c = ctx(() => 0);
    const cust = spawnCustomer(s, c);
    expect(cust.status).toBe('checkout');
    run(s, CUSTOMER.checkout + 0.2, c);
    expect(s.gold).toBeGreaterThan(0);
    expect(s.customers.find((x) => x.id === cust.id)).toBeUndefined();
  });

  it('急單：補到貨後成交並有 +50% 獎勵；超時則離開、不扣資源', () => {
    const s = createInitialState();
    const c = ctx(() => 0); // qty = 1
    const cust = spawnCustomer(s, c);
    expect(cust.rush).toBe(true);
    s.potions.glow = 1;
    run(s, CUSTOMER.checkout + 0.3, c);
    expect(s.gold).toBeCloseTo(5 * 1.5);

    const s2 = createInitialState();
    const first = spawnCustomer(s2, c);
    run(s2, CUSTOMER.patience + 1, c);
    expect(s2.customers.some((x) => x.id === first.id)).toBe(false);
    expect(c.events).toContainEqual({ type: 'customerLeft', id: first.id });
    expect(s2.gold).toBe(0);
  });

  it('排隊滿 3 人時暫停來客', () => {
    const s = createInitialState();
    run(s, 200, ctx(() => 0.99));
    expect(s.customers.length).toBeLessThanOrEqual(CUSTOMER.queueMax);
  });
});

describe('購買', () => {
  it('等比級數價格與最大可買數量', () => {
    expect(bulkCost(10, 1.15, 0, 1)).toBeCloseTo(10);
    expect(bulkCost(10, 1.15, 0, 2)).toBeCloseTo(21.5);
    expect(maxAffordable(10, 1.15, 0, 21.5)).toBe(2);
    expect(maxAffordable(10, 1.15, 0, 9)).toBe(0);
  });

  it('購買盆栽升級會扣錢並增加等級', () => {
    const s = createInitialState();
    s.gold = 100;
    expect(purchase(s, { kind: 'potLevel', slot: 0 }, 1)).toBe(true);
    expect(s.slots[0].level).toBe(2);
    expect(s.gold).toBeCloseTo(90);
  });

  it('一次性升級買過後不能再買', () => {
    const s = createInitialState();
    s.gold = 1000;
    purchase(s, { kind: 'fairy', slot: 0 }, 1);
    expect(s.slots[0].fairy).toBe(true);
    expect(getQuote(s, { kind: 'fairy', slot: 0 }, 1)?.count).toBe(0);
  });

  it('種子要花錢，而且只能種在空的已開放盆栽', () => {
    const s = createInitialState();
    s.gold = 1000;
    expect(plantSeed(s, 1, 'moonshroom')).toBe(true);
    expect(s.gold).toBe(700);
    expect(plantSeed(s, 1, 'redheart')).toBe(false);
    expect(plantSeed(s, 3, 'redheart')).toBe(false); // 隱藏格
  });
});

describe('改種', () => {
  it('第一次種新植物付種子價、從 Lv1 開始；種回原本的植物免費並恢復等級與升級', () => {
    const s = createInitialState();
    const c = ctx();
    s.gold = 10_000;
    Object.assign(s.slots[0], { level: 12, rain: 3, fairy: true });

    expect(replantCost(s, 0, 'moonshroom')).toBe(300);
    expect(replant(s, 0, 'moonshroom', c)).toBe(true);
    expect(s.gold).toBe(9_700);
    expect(s.slots[0]).toMatchObject({ plant: 'moonshroom', level: 1, rain: 0, fairy: false });

    expect(replantCost(s, 0, 'redheart')).toBe(0);
    expect(replant(s, 0, 'redheart', c)).toBe(true);
    expect(s.gold).toBe(9_700);
    expect(s.slots[0]).toMatchObject({ plant: 'redheart', level: 12, rain: 3, fairy: true });
    // 月光菇的紀錄也被保留
    expect(s.slots[0].memory.moonshroom).toEqual({ level: 1, rain: 0, fairy: false });
  });

  it('成熟的植物改種前會先收成', () => {
    const s = createInitialState();
    s.gold = 1000;
    s.slots[0].ready = true;
    replant(s, 0, 'moonshroom', ctx());
    expect(s.materials.redheart).toBe(1);
  });

  it('同一種植物、空花盆、隱藏格都不能改種', () => {
    const s = createInitialState();
    s.gold = 1e6;
    expect(replantCost(s, 0, 'redheart')).toBeNull();
    expect(replantCost(s, 1, 'redheart')).toBeNull();
    expect(replantCost(s, 3, 'redheart')).toBeNull();
  });

  it('錢不夠時不能改種', () => {
    const s = createInitialState();
    s.gold = 10;
    expect(replant(s, 0, 'moonshroom', ctx())).toBe(false);
    expect(s.slots[0].plant).toBe('redheart');
  });
});

describe('加成疊加', () => {
  it('同池相加、異池相乘', () => {
    expect(combine([
      { stat: 'sellPrice', pool: 'G', value: 0.1 },
      { stat: 'sellPrice', pool: 'G', value: 0.2 },
      { stat: 'sellPrice', pool: 'H', value: 0.5 },
      { stat: 'sellPrice', pool: 'S', value: 3 },
    ])).toBeCloseTo(1.3 * 1.5 * 3);
  });
});

describe('離線', () => {
  it('有自動化時離線會產生金幣，並受 12 小時上限限制', () => {
    const s = createInitialState();
    s.slots[0].fairy = true;
    s.slots[0].level = 10;
    s.cauldrons[0].salamander = 3;
    s.cauldrons[0].level = 10;
    const r = simulateOffline(s, 24 * 3600);
    expect(r.capped).toBe(true);
    expect(r.simulated).toBe(12 * 3600);
    expect(r.gold).toBeGreaterThan(0);
  });

  it('沒有自動化時離線不會有收益，也不會出錯', () => {
    const s = createInitialState();
    const r = simulateOffline(s, 3600);
    expect(r.gold).toBe(0);
  });
});

describe('存檔', () => {
  it('匯出後匯入內容相同（含中文）', () => {
    const s = createInitialState();
    s.gold = 12345;
    s.slots[1].plant = 'moonshroom';
    const back = importSave(exportSave(s));
    expect(back?.state.gold).toBe(12345);
    expect(back?.state.slots[1].plant).toBe('moonshroom');
  });

  it('舊存檔缺少欄位時會補上預設值', () => {
    const save = parseSave(JSON.stringify({ version: 0, savedAt: 1, state: { gold: 5 } }));
    expect(save?.state.gold).toBe(5);
    expect(save?.state.slots).toHaveLength(5);
    expect(save?.state.materials.redheart).toBe(0);
  });
});

describe('數字格式', () => {
  it('大數縮寫', () => {
    expect(formatNumber(999)).toBe('999');
    expect(formatNumber(1234)).toBe('1.23K');
    expect(formatNumber(1.5e6)).toBe('1.50M');
    expect(formatNumber(1e15)).toBe('1.00aa');
  });
});

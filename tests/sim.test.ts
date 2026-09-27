import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { CUSTOMER, MARKET, UPGRADE_FX } from '../src/game/config/balance';
import {
  clickCauldron, clickPlant, getQuote, plantSeed, purchase, replant, replantCost, unlockRecipe,
} from '../src/game/commands';
import { bulkCost, maxAffordable } from '../src/game/costs';
import { formatNumber } from '../src/game/format';
import { simulateOffline } from '../src/game/offline';
import { exportSave, importSave, parseSave } from '../src/game/save';
import {
  checkoutByClick, customerDemand, harvest, spawnCustomer, tick, type GameEvent, type SimContext,
} from '../src/game/sim';
import { createInitialState, type GameState } from '../src/game/state';
import {
  checkoutTime, combine, customerShare, ENTER_TIME, growthSpeed, orderScale, payTime, potYield, sellPrice, WALK_TIME,
} from '../src/game/stats';

// 這個檔案的測試驗證的是其他機制：採收量先用「每級 +1」（盆栽採收量曲線另外測）
const POT_CURVE = UPGRADE_FX.potYieldCurve;
beforeAll(() => { UPGRADE_FX.potYieldCurve = 0; });
afterAll(() => { UPGRADE_FX.potYieldCurve = POT_CURVE; });

function ctx(rng = () => 0.5): SimContext & { events: GameEvent[] } {
  const events: GameEvent[] = [];
  return { rng, offline: false, emit: (e) => events.push(e), events };
}

/** 新客人沒有升級時自動結帳要多久（從門口走到隊伍前面 + 走到櫃台 + 結帳） */
const BASE_CHECKOUT = ENTER_TIME + WALK_TIME + CUSTOMER.payTime;

function run(s: GameState, seconds: number, c = ctx()) {
  for (let t = 0; t < seconds; t += 0.1) tick(s, 0.1, c);
}

describe('市場熱度', () => {
  it('每隔一段時間換目標，數值在 min～max 之間起伏；訂單量跟著乘上熱度', () => {
    const s = createInitialState();
    s.customerTimer = -1e9;
    let seed = 7;
    const c = ctx(() => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648));
    const seen: number[] = [];
    for (let k = 0; k < 60; k++) {
      run(s, 10, c);
      seen.push(s.market.value);
    }
    expect(Math.min(...seen)).toBeGreaterThanOrEqual(MARKET.min - 1e-9);
    expect(Math.max(...seen)).toBeLessThanOrEqual(MARKET.max + 1e-9);
    expect(Math.max(...seen) - Math.min(...seen)).toBeGreaterThan(0.2);

    s.potionRate.glow = 100;
    s.market.value = 1;
    const base = orderScale(s, 'glow');
    s.market.value = 1.3;
    expect(orderScale(s, 'glow')).toBeCloseTo(base * 1.3);
  });

  it('離線時熱度回到平均 1', () => {
    const s = createInitialState();
    s.market = { value: 1.4, target: 1.4, timer: 0 };
    tick(s, 60, { rng: () => 0.9, offline: true, emit: () => {} });
    expect(s.market.target).toBe(1);
  });
});

describe('盆栽採收量曲線', () => {
  it('每輪 = 等級 × (1 + 等級 / k)：每升一級增加的量會隨等級變大', () => {
    UPGRADE_FX.potYieldCurve = 20;
    expect(potYield(10)).toBeCloseTo(15);
    expect(potYield(100)).toBeCloseTo(600);
    expect(potYield(101) - potYield(100)).toBeGreaterThan(potYield(11) - potYield(10));
    UPGRADE_FX.potYieldCurve = 0;
    expect(potYield(100)).toBe(100);
  });
});

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
    // 專注糖漿要 3 紅心草 + 2 月光菇；紅心草只夠一口大釜開工
    s.materials.redheart = 3;
    s.materials.moonshroom = 2;
    tick(s, 0.1, ctx());
    expect(s.cauldrons[0].recipe).toBe('focus');
    expect(s.cauldrons[0].batch).toBe(1);
    expect(s.cauldrons[1].batch).toBe(0);
  });
});

describe('顧客', () => {
  it('庫存足夠時備好貨排隊；有算盤松鼠就自動結帳收錢', () => {
    const s = createInitialState();
    s.upgrades.abacus_squirrel = 1;
    s.potions.glow = 10;
    const c = ctx(() => 0);
    const cust = spawnCustomer(s, c);
    expect(cust.status).toBe('ready');
    run(s, BASE_CHECKOUT + 0.3, c);
    expect(s.gold).toBeGreaterThan(0);
    expect(s.customers.find((x) => x.id === cust.id)).toBeUndefined();
  });

  it('急單：補到貨後成交並有 +50% 獎勵；超時則離開、不扣資源', () => {
    const s = createInitialState();
    s.upgrades.abacus_squirrel = 1;
    const c = ctx(() => 0); // qty = 1
    const cust = spawnCustomer(s, c);
    expect(cust.rush).toBe(true);
    s.potions.glow = 1;
    run(s, BASE_CHECKOUT + 0.3, c);
    expect(s.gold).toBeCloseTo(5 * 1.5);

    const s2 = createInitialState();
    const first = spawnCustomer(s2, c);
    run(s2, CUSTOMER.patience + 1, c);
    expect(s2.customers.some((x) => x.id === first.id)).toBe(false);
    expect(c.events).toContainEqual({ type: 'customerLeft', id: first.id });
    expect(s2.gold).toBe(0);
  });

  it('沒有算盤松鼠時，客人走到櫃台後就等著；玩家點他立刻完成，點還在等貨的沒有反應', () => {
    const s = createInitialState();
    s.customerTimer = -1e9;
    s.potions.glow = 1;
    const c = ctx(() => 0);
    const ready = spawnCustomer(s, c);
    const waiting = spawnCustomer(s, c);
    run(s, 10, c);
    expect(ready.status).toBe('serving');
    expect(ready.walk).toBeLessThanOrEqual(0);
    expect(s.gold).toBe(0);
    expect(checkoutByClick(s, waiting.id, c)).toBe(false);
    expect(checkoutByClick(s, ready.id, c)).toBe(true);
    expect(s.gold).toBeCloseTo(5);
    expect(s.customers.some((x) => x.id === ready.id)).toBe(false);
  });

  it('客人不管怎樣都要走到櫃台：還在路上時點他，走到的同時完成', () => {
    const s = createInitialState();
    s.customerTimer = -1e9;
    s.potions.glow = 1;
    const c = ctx(() => 0);
    const cust = spawnCustomer(s, c);
    tick(s, 0.1, c); // 開始走向櫃台
    expect(cust.status).toBe('serving');
    expect(checkoutByClick(s, cust.id, c)).toBe(true);
    expect(s.gold).toBe(0);
    run(s, ENTER_TIME + WALK_TIME + 0.1, c);
    expect(s.gold).toBeCloseTo(5);
  });

  it('自動結帳一次只服務一位：第二位要等第一位結完', () => {
    const s = createInitialState();
    s.customerTimer = -1e9;
    s.upgrades.abacus_squirrel = 1;
    s.potions.glow = 10;
    const c = ctx(() => 0);
    spawnCustomer(s, c);
    spawnCustomer(s, c);
    run(s, BASE_CHECKOUT + 0.25, c);
    expect(s.stats.customersServed).toBe(1);
    run(s, BASE_CHECKOUT + 0.2, c);
    expect(s.stats.customersServed).toBe(2);
  });

  it('訂單量跟著實際產量：顧客平均買走「產量 × 顧客比例」', () => {
    const s = createInitialState();
    s.potionRate.glow = 100;
    // 沒有松鼠：每秒 0.125 位客人（= 基準）→ 顧客比例 40%；一種藥水時每人平均 2 瓶基本量
    expect(customerShare(s)).toBeCloseTo(CUSTOMER.shareBase);
    expect(orderScale(s, 'glow')).toBeCloseTo((100 * 0.4) / (0.125 * 2));
    expect(customerDemand(s, 'glow')).toBeCloseTo(100 * 0.4);
    const cust = spawnCustomer(s, ctx(() => 0)); // 基本 1 瓶
    expect(cust.lines[0].qty).toBe(160);
  });

  it('客人只點有在產的藥水（原料分配不均、某口大釜停工時不會一直點買不到的）', () => {
    const s = createInitialState();
    s.gold = 1e9;
    unlockRecipe(s, 'focus');
    s.potionRate.glow = 100;
    s.potionRate.focus = 0;
    for (let k = 0; k < 20; k++) {
      const cust = spawnCustomer(s, ctx(() => (k + 0.5) / 20));
      expect(cust.lines.map((l) => l.potion)).toEqual(['glow']);
      s.customers = [];
    }
  });

  it('櫃台越快、海報越多，顧客買走的比例越高（最高 90%）', () => {
    const s = createInitialState();
    s.upgrades.abacus_squirrel = 9; // 結帳 ×3 → 每秒 1.2 位，但來客速度也要夠
    s.upgrades.signboard = 100;
    expect(customerShare(s)).toBeGreaterThan(CUSTOMER.shareBase + 0.3);
    s.upgrades.poster = 10;
    expect(customerShare(s)).toBeCloseTo(CUSTOMER.shareMax);
  });

  it('結帳時間 = 走到櫃台（固定）+ 結帳（松鼠升級縮短，滿級 0）；露米婭不影響結帳時間', () => {
    const s = createInitialState();
    s.upgrades.abacus_squirrel = 1;
    expect(checkoutTime(s)).toBeCloseTo(WALK_TIME + CUSTOMER.payTime);
    s.upgrades.abacus_squirrel = 5; // Lv5／9：剩一半
    expect(checkoutTime(s)).toBeCloseTo(WALK_TIME + CUSTOMER.payTime * 0.5);
    s.mascot.assignment = 'counter';
    expect(checkoutTime(s)).toBeCloseTo(WALK_TIME + CUSTOMER.payTime * 0.5);
    s.upgrades.abacus_squirrel = 9;
    expect(payTime(s)).toBe(0);
    expect(checkoutTime(s)).toBeCloseTo(WALK_TIME);
  });

  it('松鼠滿級：客人走到櫃台的同時就完成訂單', () => {
    const s = createInitialState();
    s.customerTimer = -1e9;
    s.upgrades.abacus_squirrel = 9;
    s.potions.glow = 1;
    const c = ctx(() => 0);
    spawnCustomer(s, c);
    // 新客人要先從門口走進來，還沒走到櫃台前不會成交
    run(s, ENTER_TIME, c);
    expect(s.gold).toBe(0);
    run(s, WALK_TIME + 0.15, c);
    expect(s.gold).toBeCloseTo(5);
  });

  it('店裡站滿時暫停來客（結帳完離開的不算）', () => {
    const s = createInitialState();
    run(s, 200, ctx(() => 0.99));
    expect(s.customers.length).toBeLessThanOrEqual(CUSTOMER.queueMax);
  });
});

describe('多品項訂單', () => {
  /** 依序回傳指定的亂數 */
  const seq = (...vals: number[]) => {
    let i = 0;
    return () => vals[Math.min(i++, vals.length - 1)];
  };
  const withAllRecipes = () => {
    const s = createInitialState();
    s.gold = 1e9;
    unlockRecipe(s, 'focus');
    unlockRecipe(s, 'elixir');
    s.customerTimer = -1e9;
    s.upgrades.abacus_squirrel = 1;
    return s;
  };

  it('解鎖多種配方後，一張訂單可以有多種不重複的藥水', () => {
    const s = withAllRecipes();
    // 0.95 → 三種；接著每項：選藥水、數量
    const c = spawnCustomer(s, ctx(seq(0.95, 0, 0, 0, 0, 0, 0)));
    expect(c.lines).toHaveLength(3);
    expect(new Set(c.lines.map((l) => l.potion)).size).toBe(3);
  });

  it('只解鎖一種配方時一定是單品', () => {
    const s = createInitialState();
    const c = spawnCustomer(s, ctx(seq(0.99, 0, 0)));
    expect(c.lines).toHaveLength(1);
  });

  it('整張訂單湊齊才成交；等待中補齊仍有急單獎勵', () => {
    const s = withAllRecipes();
    const before = s.gold;
    const c = ctx(seq(0.7, 0, 0, 0, 0)); // 兩種，各 1 瓶
    const cust = spawnCustomer(s, c);
    expect(cust.lines).toHaveLength(2);
    s.potions[cust.lines[0].potion] = 5; // 只有第一種
    run(s, 1, c);
    expect(cust.status).toBe('waiting');
    s.potions[cust.lines[1].potion] = 5;
    run(s, BASE_CHECKOUT + 0.3, c);
    const full = cust.lines.reduce((g, l) => g + sellPrice(s, l.potion), 0);
    expect(s.gold - before).toBeCloseTo(full * CUSTOMER.rushBonus);
  });

  it('時間到湊不齊：買走現有的部分，整筆 ×80%，沒有急單獎勵', () => {
    const s = withAllRecipes();
    const before = s.gold;
    const c = ctx(seq(0.7, 0, 0.99, 0, 0.99)); // 兩種，各 3 瓶
    const cust = spawnCustomer(s, c);
    const [a, b] = cust.lines;
    expect(a.qty).toBe(3);
    s.potions[a.potion] = 2; // 第一種只有 2 瓶，第二種沒有
    run(s, CUSTOMER.patience + BASE_CHECKOUT + 0.5, c);
    expect(s.customers.some((x) => x.id === cust.id)).toBe(false);
    expect(a.delivered).toBe(2);
    expect(b.delivered).toBe(0);
    expect(s.gold - before).toBeCloseTo(2 * sellPrice(s, a.potion) * CUSTOMER.partialPriceMult);
    expect(c.events).toContainEqual(expect.objectContaining({ type: 'sale', partial: true, rush: false }));
  });

  it('一瓶都沒有就離開，不扣任何東西', () => {
    const s = withAllRecipes();
    const before = s.gold;
    const c = ctx(seq(0.7, 0, 0, 0, 0));
    const cust = spawnCustomer(s, c);
    run(s, CUSTOMER.patience + 1, c);
    expect(c.events).toContainEqual({ type: 'customerLeft', id: cust.id });
    expect(s.gold).toBe(before);
  });

  it('舊存檔的單品顧客會轉成訂單格式', () => {
    const save = parseSave(JSON.stringify({
      version: 1, savedAt: 1,
      state: { customers: [{ id: 3, potion: 'focus', qty: 2, status: 'waiting', patience: 5, patienceMax: 20, rush: true, checkout: 0 }] },
    }));
    expect(save?.state.customers[0].lines).toEqual([{ potion: 'focus', qty: 2, delivered: 0 }]);
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

describe('豐收', () => {
  it('擲中時產量 +50%（至少 +1），沒擲中照等級產出', () => {
    const s = createInitialState();
    s.slots[0].level = 10;
    s.slots[0].ready = true;
    const hit = ctx(() => 0.1);
    clickPlant(s, 0, hit);
    expect(s.materials.redheart).toBe(15);
    expect(hit.events).toContainEqual(expect.objectContaining({ type: 'harvest', bounty: true }));

    s.slots[0].ready = true;
    clickPlant(s, 0, ctx(() => 0.9));
    expect(s.materials.redheart).toBe(25);
  });

  it('等級 1 豐收也至少多 1 個', () => {
    const s = createInitialState();
    s.slots[0].ready = true;
    clickPlant(s, 0, ctx(() => 0.1));
    expect(s.materials.redheart).toBe(2);
  });

  it('離線取期望值（+10%）', () => {
    const s = createInitialState();
    s.slots[0].level = 10;
    harvest(s, 0, 4, { ...ctx(), offline: true });
    expect(s.materials.redheart).toBeCloseTo(4 * 10 * 1.1);
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
    s.upgrades.abacus_squirrel = 1;
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

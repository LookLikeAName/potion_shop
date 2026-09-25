// 核心模擬。純邏輯，不碰畫面；在線、背景補算、離線結算、測試共用。
import { BOUNTY, CUSTOMER, UPGRADE_FX } from './config/balance';
import { MATERIAL_IDS, PLANTS, type MaterialId } from './config/plants';
import { RECIPES, type PotionId } from './config/recipes';
import type { CauldronState, CustomerState, GameState } from './state';
import {
  arrivalRate, bountyChance, brewClickAdvance, brewPassiveSpeed, condenserChance, cratePct, customerPatience,
  drunkChance, growthSpeed, has, materialReserve, maxCustomerQty, plantClickAdvance, sellPrice,
} from './stats';

export type GameEvent =
  | { type: 'harvest'; slot: number; material: MaterialId; amount: number; crit?: boolean; bounty?: boolean }
  | { type: 'brewed'; recipe: PotionId; amount: number; double?: boolean }
  | { type: 'boil'; recipe: PotionId }
  | { type: 'customerArrived'; id: number }
  | { type: 'sale'; id: number; gold: number; rush: boolean; tip: boolean }
  | { type: 'customerLeft'; id: number }
  | { type: 'wholesale'; amount: number; materials: number; gold: number };

export interface SimContext {
  rng: () => number;
  /** 離線模式：顧客與機率改用期望值，不產生急單 */
  offline: boolean;
  emit: (e: GameEvent) => void;
}

export function tick(s: GameState, dt: number, ctx: SimContext): void {
  s.time += dt;
  if (ctx.offline && has(s, 'guild_contract')) contractClicks(s, dt, ctx);
  tickPlants(s, dt, ctx);
  tickCauldrons(s, dt, ctx);
  if (ctx.offline) tickCustomersOffline(s, dt);
  else tickCustomers(s, dt, ctx);
  tickBell(s, dt);
  tickCrate(s, dt, ctx);
}

// ---------- 溫室 ----------

function tickPlants(s: GameState, dt: number, ctx: SimContext): void {
  s.slots.forEach((slot, i) => {
    if (!slot.plant) return;
    if (slot.ready && !slot.fairy) return;
    slot.progress += dt * growthSpeed(s, slot);
    settlePlant(s, i, ctx);
  });
}

/** 進度滿了：有花妖精就自動採收（可一次多輪），沒有就停在成熟狀態 */
export function settlePlant(s: GameState, i: number, ctx: SimContext): void {
  const slot = s.slots[i];
  const growTime = PLANTS[slot.plant!].growTime;
  if (slot.progress < growTime) return;
  if (slot.fairy) {
    const n = Math.floor(slot.progress / growTime);
    slot.progress -= n * growTime;
    slot.ready = false;
    harvest(s, i, n, ctx);
  } else {
    slot.progress = growTime;
    slot.ready = true;
  }
}

/** 收成 times 輪（暴擊時 times = 產量倍數，不再擲豐收） */
export function harvest(s: GameState, i: number, times: number, ctx: SimContext, crit = false): void {
  const slot = s.slots[i];
  const material = slot.plant!;
  let amount = times * slot.level;
  let bounty = false;
  if (!crit) {
    const p = bountyChance(s);
    const extra = Math.max(1, Math.round(slot.level * BOUNTY.bonus));
    if (ctx.offline || times > 50) {
      // 離線或一次收很多輪：取期望值
      amount += times * p * extra;
    } else {
      let hits = 0;
      for (let k = 0; k < times; k++) if (ctx.rng() < p) hits++;
      amount += hits * extra;
      bounty = hits > 0;
    }
  }
  s.materials[material] += amount;
  ctx.emit({ type: 'harvest', slot: i, material, amount, crit, bounty });
}

// ---------- 大釜 ----------

function tickCauldrons(s: GameState, dt: number, ctx: SimContext): void {
  // 陣列順序 = 由左到右，左邊的大釜先拿原料
  for (const c of s.cauldrons) {
    const speed = brewPassiveSpeed(s, c);
    const brewTime = RECIPES[c.recipe].brewTime;
    let t = dt;
    for (let guard = 0; guard < 1000; guard++) {
      if (c.batch === 0 && !tryStartBrew(s, c)) break;
      if (speed <= 0 || t <= 0) break;
      const need = (brewTime - c.progress) / speed;
      if (need <= t) {
        t -= need;
        completeBrew(s, c, ctx);
      } else {
        c.progress += speed * t;
        t = 0;
      }
    }
    c.boil = Math.max(0, c.boil - dt);
    c.boilCooldown = Math.max(0, c.boilCooldown - dt);
  }
}

/** 批量 = min(等級, 湊得出的份數)；湊不出 1 份就不開工 */
export function tryStartBrew(s: GameState, c: CauldronState): boolean {
  const inputs = Object.entries(RECIPES[c.recipe].inputs) as [MaterialId, number][];
  let n = c.level;
  for (const [m, need] of inputs) n = Math.min(n, Math.floor(s.materials[m] / need + 1e-9));
  if (n < 1) return false;
  for (const [m, need] of inputs) s.materials[m] -= need * n;
  c.batch = n;
  c.progress = 0;
  return true;
}

/** 完成一輪；雙口冷凝管有機率產出 ×2（離線取期望值） */
export function completeBrew(s: GameState, c: CauldronState, ctx: SimContext): void {
  const p = condenserChance(s);
  let amount = c.batch;
  let double = false;
  if (p > 0) {
    if (ctx.offline) amount *= 1 + p;
    else if (ctx.rng() < p) {
      amount *= 2;
      double = true;
    }
  }
  s.potions[c.recipe] += amount;
  ctx.emit({ type: 'brewed', recipe: c.recipe, amount, double });
  c.batch = 0;
  c.progress = 0;
}

/** 缺少的原料（開工需要 1 份） */
export function missingInputs(s: GameState, c: CauldronState): MaterialId[] {
  return (Object.entries(RECIPES[c.recipe].inputs) as [MaterialId, number][])
    .filter(([m, need]) => s.materials[m] < need)
    .map(([m]) => m);
}

// ---------- 顧客 ----------

function tickCustomers(s: GameState, dt: number, ctx: SimContext): void {
  if (s.cauldrons.length > 0) {
    s.customerTimer += dt * arrivalRate(s);
    if (s.customerTimer >= CUSTOMER.interval) {
      if (s.customers.length < CUSTOMER.queueMax) {
        s.customerTimer -= CUSTOMER.interval;
        spawnCustomer(s, ctx);
      } else {
        // 排滿時暫停來客，不累積
        s.customerTimer = CUSTOMER.interval;
      }
    }
  }

  for (const c of [...s.customers]) {
    if (c.status === 'waiting') {
      if (tryReserve(s, c)) continue;
      c.patience -= dt;
      if (c.patience <= 0) {
        removeCustomer(s, c.id);
        ctx.emit({ type: 'customerLeft', id: c.id });
      }
    } else {
      c.checkout -= dt;
      if (c.checkout <= 0) finishSale(s, c, ctx);
    }
  }
}

export function spawnCustomer(s: GameState, ctx: SimContext): CustomerState {
  const pool = s.cauldrons.map((c) => c.recipe);
  const potion = pool[Math.floor(ctx.rng() * pool.length)];
  const maxQty = maxCustomerQty(s);
  const qty = CUSTOMER.qtyMin + Math.floor(ctx.rng() * (maxQty - CUSTOMER.qtyMin + 1));
  const patience = customerPatience(s);
  const c: CustomerState = {
    id: s.nextCustomerId++, potion, qty, status: 'waiting',
    patience, patienceMax: patience, rush: false, checkout: 0,
  };
  s.customers.push(c);
  if (!tryReserve(s, c)) c.rush = true;
  ctx.emit({ type: 'customerArrived', id: c.id });
  return c;
}

/** 庫存足夠就扣除並進入結帳 */
function tryReserve(s: GameState, c: CustomerState): boolean {
  if (s.potions[c.potion] < c.qty) return false;
  s.potions[c.potion] -= c.qty;
  c.status = 'checkout';
  c.checkout = CUSTOMER.checkout;
  return true;
}

export function finishSale(s: GameState, c: CustomerState, ctx: SimContext): void {
  const tip = ctx.rng() < drunkChance(s);
  const gold = sellPrice(s, c.potion) * c.qty
    * (c.rush ? CUSTOMER.rushBonus : 1)
    * (tip ? UPGRADE_FX.drunkMult : 1);
  s.gold += gold;
  s.stats.goldEarned += gold;
  s.stats.potionsSold += c.qty;
  s.stats.customersServed++;
  if (c.rush) s.stats.rushServed++;
  removeCustomer(s, c.id);
  ctx.emit({ type: 'sale', id: c.id, gold, rush: c.rush, tip });
}

function removeCustomer(s: GameState, id: number): void {
  s.customers = s.customers.filter((c) => c.id !== id);
}

/** 離線：顧客以基礎來客率的期望值購買，沒有急單；酒鬼小費取期望值 */
function tickCustomersOffline(s: GameState, dt: number): void {
  const types = s.cauldrons.map((c) => c.recipe);
  if (types.length === 0) return;
  const avgQty = (CUSTOMER.qtyMin + maxCustomerQty(s)) / 2;
  const demandEach = ((arrivalRate(s) / CUSTOMER.interval) * avgQty * dt) / types.length;
  const tipMult = 1 + drunkChance(s) * (UPGRADE_FX.drunkMult - 1);
  for (const p of types) {
    const sold = Math.min(s.potions[p], demandEach);
    if (sold <= 0) continue;
    const gold = sold * sellPrice(s, p) * tipMult;
    s.potions[p] -= sold;
    s.gold += gold;
    s.stats.goldEarned += gold;
    s.stats.potionsSold += sold;
  }
}

// ---------- 叫賣鈴鐺 ----------

function tickBell(s: GameState, dt: number): void {
  if (!has(s, 'bell') || s.bellCharges >= UPGRADE_FX.bellMaxCharges) {
    s.bellTimer = 0;
    return;
  }
  s.bellTimer += dt;
  while (s.bellTimer >= UPGRADE_FX.bellRecharge && s.bellCharges < UPGRADE_FX.bellMaxCharges) {
    s.bellTimer -= UPGRADE_FX.bellRecharge;
    s.bellCharges++;
  }
}

// ---------- 商會收購箱 ----------

/**
 * 超過保留量的藥水與原料，以一定比例收購（在線時整份收，離線可收零頭）。
 * 藥水保留量由玩家設定；原料保留量自動計算為「所有大釜熬 3 輪」的量。
 */
function tickCrate(s: GameState, dt: number, ctx: SimContext): void {
  const pct = cratePct(s);
  if (pct <= 0) return;
  s.crateTimer += dt;
  if (s.crateTimer < UPGRADE_FX.crateInterval) return;
  s.crateTimer = 0;
  const excessOf = (have: number, keep: number) => {
    const n = have - keep;
    return ctx.offline ? n : Math.floor(n);
  };

  let amount = 0;
  let gold = 0;
  for (const c of s.cauldrons) {
    const n = excessOf(s.potions[c.recipe], s.settings.reserve);
    if (n <= 0) continue;
    s.potions[c.recipe] -= n;
    amount += n;
    gold += n * sellPrice(s, c.recipe) * pct;
  }

  let materials = 0;
  if (s.settings.sellMaterials) {
    for (const m of MATERIAL_IDS) {
      const n = excessOf(s.materials[m], materialReserve(s, m));
      if (n <= 0) continue;
      s.materials[m] -= n;
      materials += n;
      gold += n * PLANTS[m].sellValue * pct;
    }
  }

  if (amount <= 0 && materials <= 0) return;
  s.gold += gold;
  s.stats.goldEarned += gold;
  s.stats.potionsWholesaled += amount;
  s.stats.materialsWholesaled += materials;
  s.stats.wholesaleGold += gold;
  ctx.emit({ type: 'wholesale', amount, materials, gold });
}

// ---------- 過勞精靈工會合約（離線自動點擊） ----------

/** 每秒 N 次點擊，平均分給已種植的盆栽與運作中（或可開工）的大釜 */
function contractClicks(s: GameState, dt: number, ctx: SimContext): void {
  const pots = s.slots.map((slot, i) => (slot.plant ? i : -1)).filter((i) => i >= 0);
  const targets = pots.length + s.cauldrons.length;
  if (targets === 0) return;
  const each = (UPGRADE_FX.contractCps * dt) / targets;
  for (const i of pots) {
    const slot = s.slots[i];
    if (slot.ready) {
      // 成熟但沒有花妖精：精靈幫忙收成
      slot.ready = false;
      slot.progress = 0;
      harvest(s, i, 1, ctx);
    }
    slot.progress += plantClickAdvance(slot) * each;
    settlePlant(s, i, ctx);
  }
  for (const c of s.cauldrons) {
    if (c.batch === 0 && !tryStartBrew(s, c)) continue;
    c.progress += brewClickAdvance(c) * each;
    if (c.progress >= RECIPES[c.recipe].brewTime) completeBrew(s, c, ctx);
  }
}

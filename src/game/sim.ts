// 核心模擬。純邏輯，不碰畫面；在線、背景補算、離線結算、測試共用。
import { CUSTOMER } from './config/balance';
import { PLANTS, type MaterialId } from './config/plants';
import { RECIPES, type PotionId } from './config/recipes';
import type { CauldronState, CustomerState, GameState } from './state';
import {
  arrivalRate, brewPassiveSpeed, customerPatience, growthSpeed, maxCustomerQty, sellPrice,
} from './stats';

export type GameEvent =
  | { type: 'harvest'; slot: number; material: MaterialId; amount: number }
  | { type: 'brewed'; recipe: PotionId; amount: number }
  | { type: 'customerArrived'; id: number }
  | { type: 'sale'; id: number; gold: number; rush: boolean }
  | { type: 'customerLeft'; id: number };

export interface SimContext {
  rng: () => number;
  /** 離線模式：顧客改用期望值，不產生急單 */
  offline: boolean;
  emit: (e: GameEvent) => void;
}

export function tick(s: GameState, dt: number, ctx: SimContext): void {
  s.time += dt;
  tickPlants(s, dt, ctx);
  tickCauldrons(s, dt, ctx);
  if (ctx.offline) tickCustomersOffline(s, dt);
  else tickCustomers(s, dt, ctx);
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

export function harvest(s: GameState, i: number, times: number, ctx: SimContext): void {
  const slot = s.slots[i];
  const material = slot.plant!;
  const amount = times * slot.level;
  s.materials[material] += amount;
  ctx.emit({ type: 'harvest', slot: i, material, amount });
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

export function completeBrew(s: GameState, c: CauldronState, ctx: SimContext): void {
  s.potions[c.recipe] += c.batch;
  ctx.emit({ type: 'brewed', recipe: c.recipe, amount: c.batch });
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
  const gold = sellPrice(s, c.potion) * c.qty * (c.rush ? CUSTOMER.rushBonus : 1);
  s.gold += gold;
  s.stats.goldEarned += gold;
  s.stats.potionsSold += c.qty;
  s.stats.customersServed++;
  if (c.rush) s.stats.rushServed++;
  removeCustomer(s, c.id);
  ctx.emit({ type: 'sale', id: c.id, gold, rush: c.rush });
}

function removeCustomer(s: GameState, id: number): void {
  s.customers = s.customers.filter((c) => c.id !== id);
}

/** 離線：顧客以基礎來客率的期望值購買，沒有急單 */
function tickCustomersOffline(s: GameState, dt: number): void {
  const types = s.cauldrons.map((c) => c.recipe);
  if (types.length === 0) return;
  const avgQty = (CUSTOMER.qtyMin + maxCustomerQty(s)) / 2;
  const demandEach = ((arrivalRate(s) / CUSTOMER.interval) * avgQty * dt) / types.length;
  for (const p of types) {
    const sold = Math.min(s.potions[p], demandEach);
    if (sold <= 0) continue;
    const gold = sold * sellPrice(s, p);
    s.potions[p] -= sold;
    s.gold += gold;
    s.stats.goldEarned += gold;
    s.stats.potionsSold += sold;
  }
}

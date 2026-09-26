// 核心模擬。純邏輯，不碰畫面；在線、背景補算、離線結算、測試共用。
import { ACHIEVEMENTS } from './config/achievements';
import { CRATE_FOR, CRATE_MATERIALS } from './config/upgrades';
import { BOUNTY, CUSTOMER, UPGRADE_FX } from './config/balance';
import { TALENT_FX } from './config/happiness';
import { INCOME_SMOOTHING, MASCOT } from './config/mascot';
import { MATERIAL_IDS, PLANTS, type MaterialId } from './config/plants';
import { POTION_IDS, RECIPES, type PotionId } from './config/recipes';
import type { CauldronState, CustomerState, GameState, OrderLine } from './state';
import {
  arrivalRate, autoHarvest, bountyChance, brewClickAdvance, brewPassiveSpeed, condenserChance,
  cratePct, customerPatience, customerThroughput, drunkChance, growthSpeed, harvestYield, has, hasAnyCrate,
  hasAutoCheckout, isResting, materialReserve, maxCustomerQty, orderScale, patrolZones, plantClickAdvance,
  ENTER_TIME, payTime, potionReserve, recipeInputs, redeemed, sellPrice, slotYieldMult, WALK_TIME,
} from './stats';

export type GameEvent =
  | { type: 'harvest'; slot: number; material: MaterialId; amount: number; crit?: boolean; bounty?: boolean }
  | { type: 'brewed'; recipe: PotionId; amount: number; double?: boolean }
  | { type: 'boil'; recipe: PotionId }
  | { type: 'customerArrived'; id: number }
  | { type: 'sale'; id: number; gold: number; rush: boolean; tip: boolean; partial: boolean }
  | { type: 'customerLeft'; id: number }
  /** 某一個收購箱收購了 amount 瓶（或份原料）；原料收購箱另外列出每種原料各收了多少 */
  | { type: 'wholesale'; crate: CrateKind; amount: number; gold: number; items?: Partial<Record<MaterialId, number>> }
  | { type: 'mascot'; kind: 'exhausted' | 'woke' }
  | { type: 'achievement'; id: string };

/** 收購箱種類：每種藥水一個、原料一個 */
export type CrateKind = PotionId | 'materials';

export interface SimContext {
  rng: () => number;
  /** 離線模式：顧客與機率改用期望值，不產生急單 */
  offline: boolean;
  emit: (e: GameEvent) => void;
}

export function tick(s: GameState, dt: number, ctx: SimContext): void {
  s.time += dt;
  const earnedBefore = s.stats.goldEarned;
  if (ctx.offline && has(s, 'guild_contract')) contractClicks(s, dt, ctx);
  tickPlants(s, dt, ctx);
  tickCauldrons(s, dt, ctx);
  if (ctx.offline) tickCustomersOffline(s, dt);
  else tickCustomers(s, dt, ctx);
  tickBell(s, dt);
  tickCrate(s, dt, ctx);
  tickMascot(s, dt, ctx);
  tickAchievements(s, dt, ctx);
  s.feverLeft = Math.max(0, s.feverLeft - dt);
  // 平滑的每秒收入（指數移動平均）
  const inst = (s.stats.goldEarned - earnedBefore) / dt;
  s.incomeRate += (inst - s.incomeRate) * Math.min(1, dt / INCOME_SMOOTHING);
  // 各藥水平滑後的每秒產量（包含點擊熬好的），顧客訂單量跟著它走
  const k = Math.min(1, dt / CUSTOMER.rateSmoothing);
  for (const p of POTION_IDS) {
    s.potionRate[p] += (s.brewedThisTick[p] / dt - s.potionRate[p]) * k;
    s.brewedThisTick[p] = 0;
  }
}

// ---------- 溫室 ----------

function tickPlants(s: GameState, dt: number, ctx: SimContext): void {
  s.slots.forEach((slot, i) => {
    if (!slot.plant) return;
    if (slot.ready && !autoHarvest(s, slot)) return;
    slot.progress += dt * growthSpeed(s, slot);
    settlePlant(s, i, ctx);
  });
}

/** 進度滿了：有花妖精（或狂熱時刻）就自動採收（可一次多輪），沒有就停在成熟狀態 */
export function settlePlant(s: GameState, i: number, ctx: SimContext): void {
  const slot = s.slots[i];
  const growTime = PLANTS[slot.plant!].growTime;
  if (slot.progress < growTime) return;
  if (autoHarvest(s, slot)) {
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
  amount *= harvestYield(s) * slotYieldMult(s, i);
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
  const inputs = recipeInputs(s, c.recipe);
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
  s.brewedThisTick[c.recipe] += amount;
  ctx.emit({ type: 'brewed', recipe: c.recipe, amount, double });
  c.batch = 0;
  c.progress = 0;
}

/** 缺少的原料（開工需要 1 份） */
export function missingInputs(s: GameState, c: CauldronState): MaterialId[] {
  return recipeInputs(s, c.recipe)
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
        // 店裡站滿時暫停來客，不累積
        s.customerTimer = CUSTOMER.interval;
      }
    }
  }

  for (const c of [...s.customers]) {
    // 還沒排到的客人繼續從門口往隊伍前面走（排到後由 walk 接手）
    if (c.status !== 'serving') c.arrive = Math.max(0, c.arrive - dt);
    if (c.status !== 'waiting') continue;
    if (tryReserve(s, c)) continue;
    c.patience -= dt;
    if (c.patience <= 0 && !takePartial(s, c)) {
      // 一瓶都沒有：安靜離開，不扣任何東西
      removeCustomer(s, c.id);
      s.stats.customersLost++;
      ctx.emit({ type: 'customerLeft', id: c.id });
    }
  }

  // 自動結帳（算盤松鼠）：一次只服務一位，排最前面的備好客人走到櫃台結帳
  // 結帳一次一位：排最前面的備好貨客人走到櫃台（固定時間），到了之後
  // 玩家點過的立刻完成；有算盤松鼠就倒數結帳時間（滿級為 0，走到就完成）；都沒有就在櫃台等玩家點
  let serving = s.customers.find((c) => c.status === 'serving');
  if (!serving) {
    serving = s.customers.find((c) => c.status === 'ready');
    if (!serving) return;
    serving.status = 'serving';
    // 剛進門還沒走到隊伍前面的，要把剩下的路也走完
    serving.walk = WALK_TIME + serving.arrive;
    serving.checkout = payTime(s);
  }
  if (serving.walk > 0) {
    serving.walk -= dt;
    if (serving.walk > 1e-9) return;
  }
  if (serving.express) {
    finishSale(s, serving, ctx);
  } else if (hasAutoCheckout(s)) {
    serving.checkout -= dt;
    if (serving.checkout <= 1e-9) finishSale(s, serving, ctx);
  }
}

/** 已解鎖配方數 → 訂單有幾種藥水 */
function rollLineCount(types: number, r: number): number {
  const chances = CUSTOMER.linesChance[Math.min(types, 3)] ?? [1];
  let acc = 0;
  for (let k = 0; k < chances.length; k++) {
    acc += chances[k];
    if (r < acc) return k + 1;
  }
  return chances.length;
}

/**
 * 客人會點的藥水：只點目前真的有在產的（產量至少是最多那種的 5%），
 * 原料分配不均、某種大釜停工時，就不會一直點買不到的藥水。剛開局大家都還沒產量時全部都可以點。
 */
function orderablePotions(s: GameState): PotionId[] {
  const all = s.cauldrons.map((c) => c.recipe);
  const top = Math.max(0, ...all.map((p) => s.potionRate[p]));
  if (top < CUSTOMER.minOrderRate) return all;
  const ok = all.filter((p) => s.potionRate[p] >= top * CUSTOMER.orderableShare || s.potions[p] >= 1);
  return ok.length > 0 ? ok : all;
}

export function spawnCustomer(s: GameState, ctx: SimContext): CustomerState {
  const pool = orderablePotions(s);
  const count = rollLineCount(s.cauldrons.length, ctx.rng());
  const maxQty = maxCustomerQty(s);
  const lines: OrderLine[] = [];
  for (let k = 0; k < count && pool.length > 0; k++) {
    const potion = pool.splice(Math.floor(ctx.rng() * pool.length), 1)[0];
    // 基本 1–3 瓶，乘上這種藥水大釜的等級（店越大，客人一次買越多）
    const base = CUSTOMER.qtyMin + Math.floor(ctx.rng() * (maxQty - CUSTOMER.qtyMin + 1));
    lines.push({ potion, qty: Math.max(1, Math.round(base * orderScale(s, potion))), delivered: 0 });
  }
  const patience = customerPatience(s);
  const c: CustomerState = {
    id: s.nextCustomerId++, lines, status: 'waiting',
    patience, patienceMax: patience, rush: false, partial: false, checkout: 0, arrive: ENTER_TIME, walk: 0, express: false,
  };
  s.customers.push(c);
  if (!tryReserve(s, c)) c.rush = true;
  ctx.emit({ type: 'customerArrived', id: c.id });
  return c;
}

/** 整張訂單都湊得齊才扣除，客人帶著貨去排隊結帳 */
function tryReserve(s: GameState, c: CustomerState): boolean {
  if (c.lines.some((l) => s.potions[l.potion] < l.qty)) return false;
  for (const l of c.lines) {
    s.potions[l.potion] -= l.qty;
    l.delivered = l.qty;
  }
  c.status = 'ready';
  return true;
}

/** 耐心用完還湊不齊：買走現有的部分（整筆打折）；一瓶都沒有就回傳 false */
function takePartial(s: GameState, c: CustomerState): boolean {
  let total = 0;
  for (const l of c.lines) {
    l.delivered = Math.min(l.qty, Math.floor(s.potions[l.potion] + 1e-9));
    total += l.delivered;
  }
  if (total <= 0) return false;
  for (const l of c.lines) s.potions[l.potion] -= l.delivered;
  c.partial = true;
  c.status = 'ready';
  return true;
}

/** 玩家親手點客人結帳：備好貨的客人走到櫃台的同時就完成訂單（已經在櫃台就立刻完成），不用等結帳時間 */
export function checkoutByClick(s: GameState, id: number, ctx: SimContext): boolean {
  const c = s.customers.find((x) => x.id === id);
  if (!c || c.status === 'waiting') return false;
  // 客人不管怎樣都要走到櫃台：已經在櫃台就立刻完成，否則走到的同時完成
  if (c.status === 'serving' && c.walk <= 1e-9) finishSale(s, c, ctx);
  else c.express = true;
  return true;
}

/** 訂單總瓶數（實際拿到的） */
export const deliveredCount = (c: CustomerState) => c.lines.reduce((n, l) => n + l.delivered, 0);

export function finishSale(s: GameState, c: CustomerState, ctx: SimContext): void {
  const tip = ctx.rng() < drunkChance(s);
  const base = c.lines.reduce((sum, l) => sum + sellPrice(s, l.potion) * l.delivered, 0);
  // 急單獎勵只在整張訂單湊齊時才有
  const gold = base
    * (c.partial ? CUSTOMER.partialPriceMult : c.rush ? CUSTOMER.rushBonus : 1)
    * (tip ? UPGRADE_FX.drunkMult : 1);
  s.gold += gold;
  s.stats.goldEarned += gold;
  s.stats.potionsSold += deliveredCount(c);
  s.stats.customersServed++;
  if (c.rush && !c.partial) s.stats.rushServed++;
  if (c.partial) s.stats.partialSales++;
  removeCustomer(s, c.id);
  ctx.emit({ type: 'sale', id: c.id, gold, rush: c.rush && !c.partial, tip, partial: c.partial });
}

function removeCustomer(s: GameState, id: number): void {
  s.customers = s.customers.filter((c) => c.id !== id);
}

/** 顧客對某種藥水的平均需求（瓶／秒）：每秒服務人數 × 點到這種藥水的機率 × 平均數量 */
export function customerDemand(s: GameState, p: PotionId): number {
  const types = s.cauldrons.length;
  if (types === 0 || !s.cauldrons.some((c) => c.recipe === p)) return 0;
  const chances = CUSTOMER.linesChance[Math.min(types, 3)] ?? [1];
  const avgLines = chances.reduce((sum, q, k) => sum + q * (k + 1), 0);
  const avgQty = (CUSTOMER.qtyMin + maxCustomerQty(s)) / 2;
  return customerThroughput(s) * (avgLines / types) * avgQty * orderScale(s, p);
}

/** 離線：顧客以期望值購買（沒有自動結帳就沒有人結帳），沒有急單；酒鬼小費取期望值 */
function tickCustomersOffline(s: GameState, dt: number): void {
  if (!hasAutoCheckout(s)) return;
  const tipMult = 1 + drunkChance(s) * (UPGRADE_FX.drunkMult - 1);
  for (const { recipe: p } of s.cauldrons) {
    const sold = Math.min(s.potions[p], customerDemand(s, p) * dt);
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
 * 每種藥水各有一個收購箱（各自的保留量與收購價），原料另有一個（每種原料各自開關；保留量 = 設定百分比 × 所有大釜熬 1 輪的量）。
 * 超過保留量的部分以該收購箱的比例收購（在線時整份收，離線可收零頭）。
 */
function tickCrate(s: GameState, dt: number, ctx: SimContext): void {
  if (!hasAnyCrate(s)) return;
  s.crateTimer += dt;
  if (s.crateTimer < UPGRADE_FX.crateInterval) return;
  s.crateTimer = 0;
  const excessOf = (have: number, keep: number) => {
    const n = have - keep;
    return ctx.offline ? n : Math.floor(n);
  };

  const pay = (crate: CrateKind, amount: number, gold: number, items?: Partial<Record<MaterialId, number>>) => {
    s.gold += gold;
    s.stats.goldEarned += gold;
    s.stats.wholesaleGold += gold;
    if (crate === 'materials') s.stats.materialsWholesaled += amount;
    else s.stats.potionsWholesaled += amount;
    ctx.emit({ type: 'wholesale', crate, amount, gold, ...(items && { items }) });
  };

  for (const c of s.cauldrons) {
    const pct = cratePct(s, CRATE_FOR[c.recipe]);
    if (pct <= 0 || !s.settings.potions[c.recipe].sell) continue;
    const n = excessOf(s.potions[c.recipe], potionReserve(s, c.recipe));
    if (n <= 0) continue;
    s.potions[c.recipe] -= n;
    pay(c.recipe, n, n * sellPrice(s, c.recipe) * pct);
  }

  const matPct = cratePct(s, CRATE_MATERIALS);
  if (matPct > 0) {
    let amount = 0;
    let gold = 0;
    const items: Partial<Record<MaterialId, number>> = {};
    for (const m of MATERIAL_IDS) {
      if (!s.settings.materials[m].sell) continue;
      const n = excessOf(s.materials[m], materialReserve(s, m));
      if (n <= 0) continue;
      s.materials[m] -= n;
      items[m] = n;
      amount += n;
      gold += n * PLANTS[m].sellValue * matPct;
    }
    if (amount > 0) pay('materials', amount, gold, items);
  }
}

// ---------- 看板娘：體力、休息、互動能量 ----------

function tickMascot(s: GameState, dt: number, ctx: SimContext): void {
  const m = s.mascot;
  m.energy = Math.min(MASCOT.energyMax, m.energy + (MASCOT.energyRegenPerHour / 3600) * dt);

  // 離線時她在休息室好好休息
  const resting = ctx.offline || isResting(s);
  if (resting) {
    const mult = !ctx.offline && m.assignment === 'rest' ? MASCOT.playerRestMult : 1;
    m.stamina = Math.min(MASCOT.staminaMax, m.stamina + (MASCOT.restRegenPerMin / 60) * mult * dt);
    s.happiness += restHappinessPerSec(s) * dt;
    if (m.autoRest && m.stamina >= MASCOT.staminaMax) {
      m.autoRest = false;
      ctx.emit({ type: 'mascot', kind: 'woke' });
    }
    return;
  }
  if (m.assignment === 'patrol') tickPatrol(s, dt, ctx);
  const drain = (MASCOT.workDrainPerMin / 60) * (redeemed(s, 'tea_set') ? TALENT_FX.teaDrainMult : 1);
  m.stamina -= drain * dt;
  if (m.stamina <= 0) {
    m.stamina = 0;
    m.autoRest = true;
    ctx.emit({ type: 'mascot', kind: 'exhausted' });
  }
}

/** 自由活動：每隔一段時間自己換一個有事可做的區域工作 */
function tickPatrol(s: GameState, dt: number, ctx: SimContext): void {
  const m = s.mascot;
  const zones = patrolZones(s);
  m.patrolTimer -= dt;
  if (m.patrolTimer > 0 && m.patrolZone && zones.includes(m.patrolZone)) return;
  // 換到另一個區域（只有一個可去時就留在原地）
  const others = zones.filter((z) => z !== m.patrolZone);
  const pool = others.length > 0 ? others : zones;
  m.patrolZone = pool[Math.floor(ctx.rng() * pool.length)];
  m.patrolTimer = MASCOT.patrolSwitchMin + ctx.rng() * (MASCOT.patrolSwitchMax - MASCOT.patrolSwitchMin);
}

/** 休息時每秒產出的開心度（史萊姆娃娃另加） */
export function restHappinessPerSec(s: GameState): number {
  const perHour = MASCOT.restHappinessPerHour + (redeemed(s, 'slime_doll') ? TALENT_FX.slimeRestPerHour : 0);
  return perHour / 3600;
}

// ---------- 成就 ----------

function tickAchievements(s: GameState, dt: number, ctx: SimContext): void {
  s.achievementTimer += dt;
  if (s.achievementTimer < 1) return;
  s.achievementTimer = 0;
  for (const a of ACHIEVEMENTS) {
    if (s.achievements[a.id] || !a.check(s)) continue;
    s.achievements[a.id] = true;
    s.happiness += a.reward;
    ctx.emit({ type: 'achievement', id: a.id });
  }
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
    c.progress += brewClickAdvance(s, c) * each;
    if (c.progress >= RECIPES[c.recipe].brewTime) completeBrew(s, c, ctx);
  }
}

// 玩家指令。UI 與場景只透過這裡改變遊戲狀態。
import { CUSTOMER, LEVEL_COST_GROWTH, SLOT_NEIGHBORS, TIER_MULT, UPGRADE_FX } from './config/balance';
import { HAPPINESS_MAP, TALENT_FX } from './config/happiness';
import {
  GIFTS, MASCOT, OUTFITS, type Assignment, type OutfitId, type Reaction, type TouchPart,
} from './config/mascot';
import { PLANTS, type MaterialId } from './config/plants';
import { RECIPES, POTION_IDS, type PotionId } from './config/recipes';
import { GLOBAL_UPGRADE_MAP, TARGET_UPGRADES, maxLevelOf } from './config/upgrades';
import { quote, type BuyMode, type Quote } from './costs';
import { completeBrew, harvest, settlePlant, spawnCustomer, tryStartBrew, type SimContext } from './sim';
import { createCauldron, type CauldronState, type GameState } from './state';
import { brewClickAdvance, has, plantClickAdvance, shearsChance } from './stats';

// ---------- 點擊 ----------

export type PlantClick = 'harvest' | 'grow' | 'crit' | 'none';

export function clickPlant(s: GameState, i: number, ctx: SimContext): PlantClick {
  const slot = s.slots[i];
  if (!slot?.plant) return 'none';
  let result: PlantClick;
  if (ctx.rng() < shearsChance(s)) {
    // 附魔園藝剪：暴擊生長，立即收成並加倍產量
    slot.ready = false;
    slot.progress = 0;
    harvest(s, i, UPGRADE_FX.shearsYield, ctx, true);
    result = 'crit';
  } else if (slot.ready) {
    slot.ready = false;
    slot.progress = 0;
    harvest(s, i, 1, ctx);
    result = 'harvest';
  } else {
    slot.progress += plantClickAdvance(slot);
    settlePlant(s, i, ctx);
    result = 'grow';
  }
  if (has(s, 'star_can')) splash(s, i, ctx);
  return result;
}

/** 星銀澆水壺：相鄰且生長中的盆栽也獲得一半推進量 */
function splash(s: GameState, i: number, ctx: SimContext): void {
  for (const n of SLOT_NEIGHBORS[i] ?? []) {
    const slot = s.slots[n];
    if (!slot?.open || !slot.plant || slot.ready) continue;
    slot.progress += plantClickAdvance(slot) * UPGRADE_FX.starCanSplash;
    settlePlant(s, n, ctx);
  }
}

export function clickCauldron(s: GameState, recipe: PotionId, ctx: SimContext): 'brew' | 'missing' | 'none' {
  const c = s.cauldrons.find((x) => x.recipe === recipe);
  if (!c) return 'none';
  if (c.batch === 0 && !tryStartBrew(s, c)) return 'missing';
  if (has(s, 'bellows')) countCombo(s, c, ctx);
  c.progress += brewClickAdvance(s, c);
  if (c.progress >= RECIPES[c.recipe].brewTime) completeBrew(s, c, ctx);
  return 'brew';
}

/** 龍息風箱：連點 10 下（每下間隔 1 秒內）觸發極速沸騰，之後冷卻 */
function countCombo(s: GameState, c: CauldronState, ctx: SimContext): void {
  if (c.boilCooldown > 0) return;
  c.combo = s.time - c.comboAt <= UPGRADE_FX.comboGap ? c.combo + 1 : 1;
  c.comboAt = s.time;
  if (c.combo >= UPGRADE_FX.comboClicks) {
    c.combo = 0;
    c.boil = UPGRADE_FX.boilTime;
    c.boilCooldown = UPGRADE_FX.boilTime + UPGRADE_FX.boilCooldown;
    ctx.emit({ type: 'boil', recipe: c.recipe });
  }
}

/** 連擊中斷時歸零（給畫面顯示用） */
export function activeCombo(s: GameState, c: CauldronState): number {
  return s.time - c.comboAt <= UPGRADE_FX.comboGap ? c.combo : 0;
}

// ---------- 櫃台 ----------

export function ringBell(s: GameState, ctx: SimContext): 'ok' | 'empty' | 'full' | 'none' {
  if (!has(s, 'bell') || s.cauldrons.length === 0) return 'none';
  if (s.bellCharges < 1) return 'empty';
  if (s.customers.length >= CUSTOMER.queueMax) return 'full';
  s.bellCharges--;
  spawnCustomer(s, ctx);
  return 'ok';
}

export function setReserve(s: GameState, n: number): void {
  s.settings.reserve = Math.max(0, Math.min(UPGRADE_FX.reserveMax, Math.round(n)));
}

export function setSellMaterials(s: GameState, on: boolean): void {
  s.settings.sellMaterials = on;
}

// ---------- 看板娘 ----------

export function assignLumia(s: GameState, a: Assignment): void {
  s.mascot.assignment = a;
  // 玩家親手指派（包含叫醒她）時，取消自動休息
  s.mascot.autoRest = false;
}

export interface TouchResult {
  reaction: Reaction;
  gain: number;
  daily: boolean;
}

/**
 * 觸碰立繪。spam = 1 秒內觸碰太多下（由執行期以真實時間判斷）。
 * dayKey = 今天的日期（凌晨 4 點重置），用來發每日第一次互動獎勵。
 */
export function touchLumia(s: GameState, part: TouchPart, spam: boolean, dayKey: string): TouchResult {
  if (spam) return { reaction: 'panic', gain: 0, daily: false };
  const m = s.mascot;
  let gain = 0;
  let daily = false;
  if (m.dailyKey !== dayKey) {
    m.dailyKey = dayKey;
    gain += MASCOT.dailyBonus;
    daily = true;
  }
  let reaction: Reaction = 'shy';
  if (m.energy >= MASCOT.touchCost) {
    m.energy -= MASCOT.touchCost;
    gain += MASCOT.touchReward;
    reaction = part === 'head' ? 'headpat' : 'poke';
  }
  s.happiness += gain;
  return { reaction, gain, daily };
}

/** 本地時間的日期字串，每天凌晨 4 點換日 */
export function dayKeyOf(nowMs: number): string {
  const d = new Date(nowMs - MASCOT.dayResetHour * 3600_000);
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}

// ---------- 送禮物 ----------

/** 取 3 位有效數字，讓價格好讀 */
const roundNice = (n: number) => {
  if (n < 1000) return Math.ceil(n / 10) * 10;
  const p = 10 ** (Math.floor(Math.log10(n)) - 2);
  return Math.ceil(n / p) * p;
};

export function giftPrice(s: GameState, id: string): number {
  const g = GIFTS.find((x) => x.id === id)!;
  return roundNice(Math.max(g.minPrice, s.incomeRate * g.minutes * 60));
}

/** 今天還能不能送（每天凌晨 4 點重置） */
export function giftAvailable(s: GameState, id: string, dayKey: string): boolean {
  return s.giftDay !== dayKey || !s.giftsToday[id];
}

export function giveGift(s: GameState, id: string, dayKey: string): boolean {
  const g = GIFTS.find((x) => x.id === id);
  if (!g || !giftAvailable(s, id, dayKey)) return false;
  const price = giftPrice(s, id);
  if (s.gold < price) return false;
  if (s.giftDay !== dayKey) {
    s.giftDay = dayKey;
    s.giftsToday = {};
  }
  s.gold -= price;
  s.giftsToday[id] = true;
  s.happiness += g.happiness;
  return true;
}

// ---------- 開心度兌換 ----------

/** 下一次兌換要花多少整數開心度；已買滿 = null */
export function redeemCost(s: GameState, id: string): number | null {
  const item = HAPPINESS_MAP[id];
  if (!item) return null;
  const owned = s.redeemed[id] ?? 0;
  if (owned >= item.max) return null;
  return item.cost(owned);
}

export function redeem(s: GameState, id: string): boolean {
  const cost = redeemCost(s, id);
  // 開心度有小數，但只能花整數部分
  if (cost === null || Math.floor(s.happiness + 1e-9) < cost) return false;
  s.happiness -= cost;
  s.redeemed[id] = (s.redeemed[id] ?? 0) + 1;
  if (id === 'green_thumb') {
    for (const slot of s.slots) slot.open = true;
  }
  return true;
}

export function outfitOwned(s: GameState, o: OutfitId): boolean {
  const item = OUTFITS[o].item;
  return !item || (s.redeemed[item] ?? 0) > 0;
}

export function equipOutfit(s: GameState, o: OutfitId): boolean {
  if (!outfitOwned(s, o)) return false;
  s.mascot.outfit = o;
  return true;
}

export function canStartFever(s: GameState, dayKey: string): boolean {
  return (s.redeemed.vow ?? 0) > 0 && s.feverLeft <= 0 && s.feverDay !== dayKey;
}

export function startFever(s: GameState, dayKey: string): boolean {
  if (!canStartFever(s, dayKey)) return false;
  s.feverLeft = TALENT_FX.feverSeconds;
  s.feverDay = dayKey;
  return true;
}

// ---------- 大釜排序 ----------

/** 把大釜從 from 移到 to（其他大釜順移）；順序 = 原料分配優先順序 */
export function moveCauldron(s: GameState, from: number, to: number): boolean {
  const n = s.cauldrons.length;
  if (from === to || from < 0 || to < 0 || from >= n || to >= n) return false;
  const [c] = s.cauldrons.splice(from, 1);
  s.cauldrons.splice(to, 0, c);
  return true;
}

// ---------- 種植與解鎖 ----------

export function canPlant(s: GameState, i: number, m: MaterialId): boolean {
  const slot = s.slots[i];
  return !!slot && slot.open && !slot.plant && s.gold >= PLANTS[m].seedCost;
}

export function plantSeed(s: GameState, i: number, m: MaterialId): boolean {
  if (!canPlant(s, i, m)) return false;
  s.gold -= PLANTS[m].seedCost;
  Object.assign(s.slots[i], { plant: m, level: 1, progress: 0, ready: false });
  return true;
}

/**
 * 改種的價格：這個盆栽種過的植物免費（恢復當時的等級與升級），沒種過的付種子價。
 * 不能改種時回傳 null。
 */
export function replantCost(s: GameState, i: number, m: MaterialId): number | null {
  const slot = s.slots[i];
  if (!slot?.open || !slot.plant || slot.plant === m) return null;
  return slot.memory[m] ? 0 : PLANTS[m].seedCost;
}

export function replant(s: GameState, i: number, m: MaterialId, ctx: SimContext): boolean {
  const cost = replantCost(s, i, m);
  if (cost === null || s.gold < cost) return false;
  const slot = s.slots[i];
  // 已成熟的先幫忙收成，不浪費
  if (slot.ready) harvest(s, i, 1, ctx);
  s.gold -= cost;
  slot.memory[slot.plant!] = { level: slot.level, rain: slot.rain, fairy: slot.fairy };
  const next = slot.memory[m] ?? { level: 1, rain: 0, fairy: false };
  Object.assign(slot, { plant: m, ...next, progress: 0, ready: false });
  return true;
}

export function unlockRecipe(s: GameState, p: PotionId): boolean {
  if (s.cauldrons.some((c) => c.recipe === p)) return false;
  const cost = RECIPES[p].unlockCost;
  if (s.gold < cost) return false;
  s.gold -= cost;
  s.cauldrons.push(createCauldron(p));
  return true;
}

/** 下一個可解鎖的配方（依階級順序） */
export function nextLockedRecipes(s: GameState): PotionId[] {
  return POTION_IDS.filter((p) => !s.cauldrons.some((c) => c.recipe === p));
}

// ---------- 購買升級 ----------

export type PurchaseKey =
  | { kind: 'potLevel'; slot: number }
  | { kind: 'rain'; slot: number }
  | { kind: 'fairy'; slot: number }
  | { kind: 'cauldronLevel'; recipe: PotionId }
  | { kind: 'salamander'; recipe: PotionId }
  | { kind: 'global'; id: string };

interface PriceSpec {
  base: number;
  growth: number;
  owned: number;
  remaining: number;
  /** 指定每級價格（取代等比價格） */
  table?: number[];
}

/** 依價格表報價：table[k] 為第 k 級的價格 */
function tableQuote(table: number[], owned: number, mode: BuyMode, budget: number): Quote {
  const left = table.slice(owned);
  const want = mode === 'max' ? left.length : Math.min(mode, left.length);
  let count = 0;
  let cost = 0;
  for (let k = 0; k < want; k++) {
    if (mode === 'max' && count > 0 && cost + left[k] > budget) break;
    cost += left[k];
    count++;
  }
  return { count, cost, affordable: count > 0 && cost <= budget };
}

function priceSpec(s: GameState, key: PurchaseKey): PriceSpec | null {
  switch (key.kind) {
    case 'potLevel':
    case 'rain':
    case 'fairy': {
      const slot = s.slots[key.slot];
      if (!slot?.plant) return null;
      const plant = PLANTS[slot.plant];
      const tm = TIER_MULT[plant.tier];
      if (key.kind === 'potLevel') {
        return { base: plant.levelBaseCost, growth: LEVEL_COST_GROWTH, owned: slot.level - 1, remaining: Infinity };
      }
      if (key.kind === 'rain') {
        const u = TARGET_UPGRADES.raincloud;
        return { base: u.base * tm, growth: u.growth, owned: slot.rain, remaining: Infinity };
      }
      return { base: TARGET_UPGRADES.fairy.base * tm, growth: 1, owned: 0, remaining: slot.fairy ? 0 : 1 };
    }
    case 'cauldronLevel':
    case 'salamander': {
      const c = s.cauldrons.find((x) => x.recipe === key.recipe);
      if (!c) return null;
      const r = RECIPES[c.recipe];
      if (key.kind === 'cauldronLevel') {
        return { base: r.levelBaseCost, growth: LEVEL_COST_GROWTH, owned: c.level - 1, remaining: Infinity };
      }
      const u = TARGET_UPGRADES.salamander;
      return { base: u.base * TIER_MULT[r.tier], growth: u.growth, owned: c.salamander, remaining: Infinity };
    }
    case 'global': {
      const def = GLOBAL_UPGRADE_MAP[key.id];
      if (!def) return null;
      const owned = s.upgrades[key.id] ?? 0;
      return {
        base: def.cost.base, growth: def.cost.growth, owned,
        remaining: maxLevelOf(def) - owned, table: def.costTable,
      };
    }
  }
}

export function getQuote(s: GameState, key: PurchaseKey, mode: BuyMode): Quote | null {
  const spec = priceSpec(s, key);
  if (!spec) return null;
  if (spec.table) return tableQuote(spec.table, spec.owned, mode, s.gold);
  return quote(spec.base, spec.growth, spec.owned, mode, s.gold, spec.remaining);
}

export function purchase(s: GameState, key: PurchaseKey, mode: BuyMode): boolean {
  const q = getQuote(s, key, mode);
  if (!q || !q.affordable) return false;
  s.gold -= q.cost;
  const n = q.count;
  switch (key.kind) {
    case 'potLevel': s.slots[key.slot].level += n; break;
    case 'rain': s.slots[key.slot].rain += n; break;
    case 'fairy': s.slots[key.slot].fairy = true; break;
    case 'cauldronLevel': s.cauldrons.find((c) => c.recipe === key.recipe)!.level += n; break;
    case 'salamander': s.cauldrons.find((c) => c.recipe === key.recipe)!.salamander += n; break;
    case 'global':
      s.upgrades[key.id] = (s.upgrades[key.id] ?? 0) + n;
      // 剛買的鈴鐺是充滿的
      if (key.id === 'bell') s.bellCharges = UPGRADE_FX.bellMaxCharges;
      break;
  }
  return true;
}

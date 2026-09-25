// 玩家指令。UI 與場景只透過這裡改變遊戲狀態。
import { LEVEL_COST_GROWTH, TIER_MULT } from './config/balance';
import { PLANTS, type MaterialId } from './config/plants';
import { RECIPES, POTION_IDS, type PotionId } from './config/recipes';
import { GLOBAL_UPGRADE_MAP, TARGET_UPGRADES } from './config/upgrades';
import { quote, type BuyMode, type Quote } from './costs';
import { completeBrew, harvest, settlePlant, tryStartBrew, type SimContext } from './sim';
import { createCauldron, type GameState } from './state';
import { brewClickAdvance, plantClickAdvance } from './stats';

// ---------- 點擊 ----------

export function clickPlant(s: GameState, i: number, ctx: SimContext): 'harvest' | 'grow' | 'none' {
  const slot = s.slots[i];
  if (!slot?.plant) return 'none';
  if (slot.ready) {
    slot.ready = false;
    slot.progress = 0;
    harvest(s, i, 1, ctx);
    return 'harvest';
  }
  slot.progress += plantClickAdvance(slot);
  settlePlant(s, i, ctx);
  return 'grow';
}

export function clickCauldron(s: GameState, recipe: PotionId, ctx: SimContext): 'brew' | 'missing' | 'none' {
  const c = s.cauldrons.find((x) => x.recipe === recipe);
  if (!c) return 'none';
  if (c.batch === 0 && !tryStartBrew(s, c)) return 'missing';
  c.progress += brewClickAdvance(c);
  if (c.progress >= RECIPES[c.recipe].brewTime) completeBrew(s, c, ctx);
  return 'brew';
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
        remaining: def.maxLevel === undefined ? Infinity : def.maxLevel - owned,
      };
    }
  }
}

export function getQuote(s: GameState, key: PurchaseKey, mode: BuyMode): Quote | null {
  const spec = priceSpec(s, key);
  if (!spec) return null;
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
    case 'global': s.upgrades[key.id] = (s.upgrades[key.id] ?? 0) + n; break;
  }
  return true;
}

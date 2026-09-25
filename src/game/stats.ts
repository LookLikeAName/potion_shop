// 數值計算：依企劃書第 5 章「同池相加、異池相乘」。
import { BOUNTY, CHANCE_CAP, CUSTOMER, MILESTONES, UPGRADE_FX } from './config/balance';
import { PLANTS, type MaterialId } from './config/plants';
import { RECIPES, type PotionId } from './config/recipes';
import { GLOBAL_UPGRADES, TARGET_UPGRADES, type Mod, type StatId } from './config/upgrades';
import type { CauldronState, GameState, SlotState } from './state';

export function combine(mods: Mod[]): number {
  const sum = { G: 0, M: 0, H: 0 };
  let special = 1;
  for (const m of mods) {
    if (m.pool === 'S') special *= m.value;
    else sum[m.pool] += m.value;
  }
  return (1 + sum.G) * (1 + sum.M) * (1 + sum.H) * special;
}

export function globalMods(s: GameState, stat: StatId): Mod[] {
  const out: Mod[] = [];
  for (const def of GLOBAL_UPGRADES) {
    const lvl = s.upgrades[def.id] ?? 0;
    if (lvl > 0) for (const m of def.mods(lvl)) if (m.stat === stat) out.push(m);
  }
  return out;
}

export function milestoneCount(level: number): number {
  return MILESTONES.filter((m) => level >= m).length;
}

export function milestoneMult(level: number): number {
  return 2 ** milestoneCount(level);
}

export function nextMilestone(level: number): number | null {
  return MILESTONES.find((m) => level < m) ?? null;
}

/** 植物生長速度倍率（1 = 基礎速度） */
export function growthSpeed(s: GameState, slot: SlotState): number {
  return combine([
    ...globalMods(s, 'growthSpeed'),
    { stat: 'growthSpeed', pool: 'G', value: slot.rain * TARGET_UPGRADES.raincloud.perLevel },
    { stat: 'growthSpeed', pool: 'S', value: milestoneMult(slot.level) },
  ]);
}

export function plantClickAdvance(slot: SlotState): number {
  return slot.plant ? PLANTS[slot.plant].clickAdvance * milestoneMult(slot.level) : 0;
}

/** 極速沸騰中的速度倍率 */
export function boilMult(c: CauldronState): number {
  return c.boil > 0 ? UPGRADE_FX.boilMult : 1;
}

/** 大釜被動熬煮速度倍率，沒有火蜥蜴 = 0 */
export function brewPassiveSpeed(s: GameState, c: CauldronState): number {
  if (c.salamander <= 0) return 0;
  const base = 0.5 + 0.25 * (c.salamander - 1);
  return base * combine([
    ...globalMods(s, 'brewSpeed'),
    { stat: 'brewSpeed', pool: 'S', value: milestoneMult(c.level) },
    { stat: 'brewSpeed', pool: 'S', value: boilMult(c) },
  ]);
}

export function brewClickAdvance(c: CauldronState): number {
  return RECIPES[c.recipe].clickAdvance * milestoneMult(c.level) * boilMult(c);
}

// ---------- 升級擁有狀態與機率 ----------

export function has(s: GameState, id: string): boolean {
  return (s.upgrades[id] ?? 0) > 0;
}

const chance = (p: number) => Math.min(CHANCE_CAP, p);

/** 豐收機率（之後的開心度特權或事件可以加在這裡） */
export function bountyChance(_s: GameState): number {
  return chance(BOUNTY.chance);
}

export function shearsChance(s: GameState): number {
  return has(s, 'shears') ? chance(UPGRADE_FX.shearsChance) : 0;
}

/** 雙口冷凝管雙倍產出機率（M3 的「魔力同調」會加在這裡） */
export function condenserChance(s: GameState): number {
  return has(s, 'condenser') ? chance(UPGRADE_FX.condenserChance) : 0;
}

export function drunkChance(s: GameState): number {
  return has(s, 'drunks') ? chance(UPGRADE_FX.drunkChance) : 0;
}

/** 原料保留量：足夠所有大釜以目前等級熬 N 輪 */
export function materialReserve(s: GameState, m: MaterialId): number {
  const perRound = s.cauldrons.reduce((sum, c) => sum + (RECIPES[c.recipe].inputs[m] ?? 0) * c.level, 0);
  return Math.max(UPGRADE_FX.materialReserveMin, perRound * UPGRADE_FX.materialReserveRounds);
}

/** 收購箱收購價比例（售價的幾成），沒有收購箱 = 0 */
export function cratePct(s: GameState): number {
  const lvl = s.upgrades.crate ?? 0;
  return lvl > 0 ? UPGRADE_FX.crateBasePct + UPGRADE_FX.crateStepPct * (lvl - 1) : 0;
}

export function sellPrice(s: GameState, potion: PotionId): number {
  return RECIPES[potion].basePrice * combine(globalMods(s, 'sellPrice'));
}

/** 來客速度倍率 */
export function arrivalRate(s: GameState): number {
  return combine(globalMods(s, 'arrivalRate'));
}

export function customerPatience(s: GameState): number {
  return CUSTOMER.patience * combine(globalMods(s, 'patience'));
}

export function maxCustomerQty(s: GameState): number {
  return CUSTOMER.qtyMax + Math.floor((s.upgrades.signboard ?? 0) / 10);
}

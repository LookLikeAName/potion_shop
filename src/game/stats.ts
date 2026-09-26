// 數值計算：依企劃書第 5 章「同池相加、異池相乘」。
import { BOUNTY, CHANCE_CAP, CUSTOMER, MILESTONES, UPGRADE_FX } from './config/balance';
import { TALENT_FX } from './config/happiness';
import { MASCOT, OUTFIT_BONUS, type WorkZone } from './config/mascot';
import { PLANTS, type MaterialId } from './config/plants';
import { RECIPES, type PotionId } from './config/recipes';
import {
  CRATE_FOR, CRATE_MATERIALS, GLOBAL_UPGRADES, TARGET_UPGRADES, type Mod, type StatId,
} from './config/upgrades';
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

/** 某個數值的所有全域修正：金幣升級（G/S）、看板娘（M）、開心度兌換（H/S） */
export function globalMods(s: GameState, stat: StatId): Mod[] {
  const out: Mod[] = [];
  for (const def of GLOBAL_UPGRADES) {
    const lvl = s.upgrades[def.id] ?? 0;
    if (lvl > 0) for (const m of def.mods(lvl)) if (m.stat === stat) out.push(m);
  }
  out.push(...mascotMods(s, stat), ...talentMods(s, stat));
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
  // 狂熱時刻：沒有火蜥蜴的大釜也全自動
  if (c.salamander <= 0 && s.feverLeft <= 0) return 0;
  const base = c.salamander > 0 ? 0.5 + 0.25 * (c.salamander - 1) : 0.5;
  return base * combine([
    ...globalMods(s, 'brewSpeed'),
    { stat: 'brewSpeed', pool: 'S', value: milestoneMult(c.level) },
    { stat: 'brewSpeed', pool: 'S', value: boilMult(c) },
  ]);
}

/** 點擊攪拌的推進量：看板娘指派與狂熱時刻也有效（留聲機只影響被動） */
export function brewClickAdvance(s: GameState, c: CauldronState): number {
  const mods = [...mascotMods(s, 'brewSpeed'), ...feverMods(s)];
  return RECIPES[c.recipe].clickAdvance * milestoneMult(c.level) * boilMult(c) * combine(mods);
}

// ---------- 看板娘（M 池）----------

export function isResting(s: GameState): boolean {
  return s.mascot.assignment === 'rest' || s.mascot.autoRest;
}

/** 正在工作的區域；休息中 = null。自由活動時是她目前自己選的區域 */
export function workZone(s: GameState): WorkZone | null {
  if (isResting(s)) return null;
  const a = s.mascot.assignment;
  if (a === 'patrol') return s.mascot.patrolZone;
  return a === 'rest' ? null : a;
}

/** 自由活動時可以去的區域：有植物的溫室、有大釜的大釜區、櫃台 */
export function patrolZones(s: GameState): WorkZone[] {
  const out: WorkZone[] = [];
  if (s.slots.some((sl) => sl.plant)) out.push('greenhouse');
  if (s.cauldrons.length > 0) out.push('cauldron');
  out.push('counter');
  return out;
}

export function isTired(s: GameState): boolean {
  return s.mascot.stamina < MASCOT.tiredBelow;
}

/** 疲勞時指派效果減半 */
export function mascotFactor(s: GameState): number {
  return isTired(s) ? MASCOT.tiredFactor : 1;
}

export function mascotMods(s: GameState, stat: StatId): Mod[] {
  const zone = workZone(s);
  if (!zone) return [];
  const f = mascotFactor(s);
  const outfit = s.mascot.outfit;
  const m = (value: number): Mod => ({ stat, pool: 'M', value: value * f });
  switch (stat) {
    case 'growthSpeed':
      return zone === 'greenhouse' ? [m(MASCOT.greenhouseBonus)] : [];
    case 'brewSpeed':
      if (zone !== 'cauldron') return [];
      return outfit === 'robe' ? [m(MASCOT.cauldronBonus), m(OUTFIT_BONUS.robeBrew)] : [m(MASCOT.cauldronBonus)];
    case 'patience':
      if (zone !== 'counter') return [];
      return outfit === 'maid' ? [m(MASCOT.counterPatienceBonus), m(OUTFIT_BONUS.maidPatience)] : [m(MASCOT.counterPatienceBonus)];
    case 'sellPrice':
      return zone === 'counter' && outfit === 'maid' ? [m(OUTFIT_BONUS.maidPrice)] : [];
    default:
      return [];
  }
}

/** 結帳時間：看板娘在櫃台時 -50%（疲勞時只有一半效果） */
export function checkoutTime(s: GameState): number {
  if (workZone(s) !== 'counter') return CUSTOMER.checkout;
  return CUSTOMER.checkout * (1 - (1 - MASCOT.counterCheckoutMult) * mascotFactor(s));
}

// ---------- 開心度兌換（H 池、特殊乘數）----------

export function redeemed(s: GameState, id: string): number {
  return s.redeemed[id] ?? 0;
}

/** 自動採收：有花妖精，或狂熱時刻中 */
export function autoHarvest(s: GameState, slot: SlotState): boolean {
  return slot.fairy || s.feverLeft > 0;
}

function feverMods(s: GameState): Mod[] {
  return s.feverLeft > 0 ? [{ stat: 'brewSpeed', pool: 'S', value: TALENT_FX.feverMult }] : [];
}

export function talentMods(s: GameState, stat: StatId): Mod[] {
  const out: Mod[] = [];
  if (stat === 'growthSpeed' || stat === 'brewSpeed') {
    if (redeemed(s, 'gramophone')) out.push({ stat, pool: 'H', value: TALENT_FX.gramophoneSpeed });
    if (s.feverLeft > 0) out.push({ stat, pool: 'S', value: TALENT_FX.feverMult });
  }
  if (stat === 'sellPrice') {
    const cheer = redeemed(s, 'cheer');
    if (cheer) out.push({ stat, pool: 'H', value: TALENT_FX.cheerPrice * cheer });
    if (redeemed(s, 'celebration')) out.push({ stat, pool: 'S', value: TALENT_FX.celebrationPrice });
  }
  return out;
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

/** 雙口冷凝管雙倍產出機率（加上開心度特權「魔力同調」） */
export function condenserChance(s: GameState): number {
  if (!has(s, 'condenser')) return 0;
  return chance(UPGRADE_FX.condenserChance + TALENT_FX.attunementChance * redeemed(s, 'attunement'));
}

export function drunkChance(s: GameState): number {
  return has(s, 'drunks') ? chance(UPGRADE_FX.drunkChance) : 0;
}

/** 所有大釜以目前等級熬 1 輪需要多少這種原料 */
export function materialPerRound(s: GameState, m: MaterialId): number {
  return s.cauldrons.reduce((sum, c) => sum + (RECIPES[c.recipe].inputs[m] ?? 0) * c.level, 0);
}

/** 原料保留量：設定的百分比 × 1 輪的量（100% = 1 輪）；設 0% 就不保留，其餘至少保留一點 */
export function materialReserve(s: GameState, m: MaterialId): number {
  const pct = s.settings.materials[m].keepPct;
  if (pct <= 0) return 0;
  return Math.max(UPGRADE_FX.materialReserveMin, Math.ceil((materialPerRound(s, m) * pct) / 100));
}

/** 某個收購箱的收購價比例（售價的幾成），沒買 = 0 */
export function cratePct(s: GameState, crateId: string): number {
  const lvl = s.upgrades[crateId] ?? 0;
  return lvl > 0 ? UPGRADE_FX.crateBasePct + UPGRADE_FX.crateStepPct * (lvl - 1) : 0;
}

/** 有沒有任何一個收購箱 */
export function hasAnyCrate(s: GameState): boolean {
  return [...Object.values(CRATE_FOR), CRATE_MATERIALS].some((id) => has(s, id));
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
  return CUSTOMER.qtyMax + Math.floor((s.upgrades.signboard ?? 0) / 10) + (s.upgrades.poster ?? 0);
}

/** 收成量倍率（魔法肥料） */
export function harvestYield(s: GameState): number {
  return combine(globalMods(s, 'harvestYield'));
}

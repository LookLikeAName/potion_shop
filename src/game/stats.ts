// 數值計算：依企劃書第 5 章「同池相加、異池相乘」。
import { BOUNTY, CHANCE_CAP, CUSTOMER, INITIAL_OPEN_SLOTS, MILESTONES, UPGRADE_FX } from './config/balance';
import { DECOR, GIFT_FX, GIFT_MAP, type GiftFx } from './config/gifts';
import { BOND, HAPPINESS_ITEMS, TALENT_FX } from './config/happiness';
import { MASCOT, OUTFIT_BONUS, type WorkZone } from './config/mascot';
import { PLANTS, type MaterialId } from './config/plants';
import { RECIPES, type PotionId } from './config/recipes';
import {
  CRATE_FOR, CRATE_MATERIALS, GLOBAL_UPGRADE_MAP, GLOBAL_UPGRADES, REFINE_FOR, SQUIRREL, TARGET_UPGRADES, type Mod,
  type StatId,
} from './config/upgrades';
import { EVENT, EVENTS } from './config/events';
import type { BuffKind, CauldronState, GameState, SlotState } from './state';

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
  out.push(...mascotMods(s, stat), ...talentMods(s, stat), ...eventMods(s, stat));
  return out;
}

// ---------- 事件的限時增益與事件簿 ----------

/** 某種增益目前的倍率（沒有 = 1；同種同目標只會有一個） */
export function buffMult(s: GameState, kind: BuffKind, target?: number | string): number {
  let m = 1;
  for (const b of s.events.buffs) if (b.kind === kind && b.time > 0 && b.target === target) m *= b.mult;
  return m;
}

/** 事件簿的收集里程碑：每收集 6 個、以及全部收齊時各一次 */
export function codexMilestones(): number[] {
  const out: number[] = [];
  for (let n = EVENT.milestoneEvery; n < EVENTS.length; n += EVENT.milestoneEvery) out.push(n);
  out.push(EVENTS.length);
  return out;
}

/** 事件簿收集了幾種（完成過的事件） */
export function codexCount(s: GameState): number {
  return EVENTS.filter((e) => (s.events.codex[e.id]?.done ?? 0) > 0).length;
}

/** 事件簿的收入倍率（S）：每達成一個里程碑 +3% */
export function codexIncomeMult(s: GameState): number {
  const n = codexCount(s);
  return 1 + EVENT.incomePerMilestone * codexMilestones().filter((m) => n >= m).length;
}

function eventMods(s: GameState, stat: StatId): Mod[] {
  const kind: BuffKind | null = stat === 'growthSpeed' ? 'growth' : stat === 'brewSpeed' ? 'brew'
    : stat === 'arrivalRate' ? 'arrival' : stat === 'sellPrice' ? 'price' : null;
  const out: Mod[] = [];
  if (kind) {
    const m = buffMult(s, kind);
    if (m !== 1) out.push({ stat, pool: 'S', value: m });
  }
  if (stat === 'sellPrice') {
    const c = codexIncomeMult(s);
    if (c !== 1) out.push({ stat, pool: 'S', value: c });
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
    // 事件：這一盆的限時加速（朝露、雨雲寶寶、螢光蝴蝶）
    { stat: 'growthSpeed', pool: 'S', value: buffMult(s, 'potGrowth', s.slots.indexOf(slot)) },
  ]);
}

/**
 * 盆栽每輪的基本採收量：等級 × (1 + 等級 / potYieldCurve)。每升一級增加的量會隨等級變大，
 * 讓盆栽追得上有湯勺、保溫魔法陣、精煉加成的大釜（平衡模擬：原本同等級時原料只夠大釜全速的 5–22%）。
 */
export function potYield(level: number): number {
  const k = UPGRADE_FX.potYieldCurve;
  return k > 0 ? level * (1 + level / k) : level;
}

export function plantClickAdvance(slot: SlotState): number {
  return slot.plant ? PLANTS[slot.plant].clickAdvance * milestoneMult(slot.level) : 0;
}

/** 極速沸騰中的速度倍率 */
export function boilMult(c: CauldronState): number {
  return c.boil > 0 ? UPGRADE_FX.boilMult : 1;
}

/** 大釜的熬煮速度（不管有沒有火蜥蜴；沒有時以 Lv1 火蜥蜴的基礎速度計） */
function brewSpeedOf(s: GameState, c: CauldronState): number {
  const base = c.salamander > 0 ? 0.5 + 0.25 * (c.salamander - 1) : 0.5;
  return base * combine([
    ...globalMods(s, 'brewSpeed'),
    { stat: 'brewSpeed', pool: 'S', value: milestoneMult(c.level) },
    { stat: 'brewSpeed', pool: 'S', value: boilMult(c) },
    // 事件：這一口大釜的限時加速（精靈學徒）
    { stat: 'brewSpeed', pool: 'S', value: buffMult(s, 'cauldronBrew', c.recipe) },
  ]);
}

/** 大釜被動熬煮速度倍率，沒有火蜥蜴 = 0 */
export function brewPassiveSpeed(s: GameState, c: CauldronState): number {
  // 狂熱時刻：沒有火蜥蜴的大釜也全自動
  if (c.salamander <= 0 && s.feverLeft <= 0) return 0;
  return brewSpeedOf(s, c);
}

/** 點擊攪拌的推進量：看板娘指派與狂熱時刻也有效（留聲機只影響被動） */
export function brewClickAdvance(s: GameState, c: CauldronState): number {
  const mods = [...mascotMods(s, 'brewSpeed'), ...feverMods(s)];
  return RECIPES[c.recipe].clickAdvance * milestoneMult(c.level) * boilMult(c) * combine(mods);
}

/**
 * 玩家親手點擊的推進量（秒）：基本點擊量，加上魔力園藝手套／符文攪拌棒的
 * 「等級 × 0.1 秒」自動產量。過勞精靈工會合約的模擬點擊不吃這個加成。
 */
export function plantClickPower(s: GameState, slot: SlotState): number {
  const bonus = (s.upgrades.garden_gloves ?? 0) * UPGRADE_FX.clickBonusSecPerLevel;
  return (plantClickAdvance(slot) + (slot.plant ? bonus * growthSpeed(s, slot) : 0)) * musicBoxMult(s);
}

export function brewClickPower(s: GameState, c: CauldronState): number {
  const bonus = (s.upgrades.rune_stirrer ?? 0) * UPGRADE_FX.clickBonusSecPerLevel;
  return (brewClickAdvance(s, c) + bonus * brewSpeedOf(s, c)) * musicBoxMult(s);
}

/** 精靈音樂盒（擺出來時）：老師親手點擊的效果 ×1.5 */
function musicBoxMult(s: GameState): number {
  return decorFx(s, 'click') ? GIFT_FX.click : 1;
}

// ---------- 看板娘（M 池）----------

/** 被指派到休息室、但體力已經滿了：不睡覺，在休息室悠閒地走動、玩擺設 */
export function isRelaxing(s: GameState): boolean {
  const m = s.mascot;
  return m.assignment === 'rest' && !m.autoRest && m.stamina >= MASCOT.staminaMax - 1e-9;
}

/** 正在休息室睡覺（回復體力中） */
export function isSleeping(s: GameState): boolean {
  return isResting(s) && !isRelaxing(s);
}

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
  // 疲勞減半；擺出星光髮飾 ×1.5
  const f = mascotFactor(s) * (decorFx(s, 'assist') ? GIFT_FX.assist : 1);
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
      return [m(MASCOT.counterPatienceBonus)];
    case 'sellPrice':
      // 在櫃台：售價 +25%（女僕裝再 +50%）
      if (zone !== 'counter') return [];
      return outfit === 'maid' ? [m(MASCOT.counterPriceBonus), m(OUTFIT_BONUS.maidPrice)] : [m(MASCOT.counterPriceBonus)];
    default:
      return [];
  }
}

/**
 * 女僕裝在櫃台：客人每次少買的比例（照原本的數量付錢）。
 * 跟其他指派效果一樣，疲勞時減半、擺出星光髮飾 ×1.5
 */
export function maidQtyCut(s: GameState): number {
  if (workZone(s) !== 'counter' || s.mascot.outfit !== 'maid') return 0;
  return OUTFIT_BONUS.maidQtyCut * mascotFactor(s) * (decorFx(s, 'assist') ? GIFT_FX.assist : 1);
}

/** 有沒有自動結帳（算盤松鼠）；沒有時要玩家親手點客人結帳 */
export function hasAutoCheckout(s: GameState): boolean {
  return has(s, SQUIRREL);
}

/** 客人從隊伍前面走到櫃台的時間（固定，升級不影響） */
export const WALK_TIME = CUSTOMER.walkToCounter / CUSTOMER.walkSpeed;
/** 新客人從門口走到隊伍前面的時間 */
export const ENTER_TIME = CUSTOMER.doorToQueue / CUSTOMER.walkSpeed;

/** 客人到櫃台後的結帳時間：算盤松鼠 Lv1 為基礎時間，之後每級縮短，滿級時 0（走到櫃台的同時就完成訂單） */
export function payTime(s: GameState): number {
  const lvl = Math.max(1, s.upgrades[SQUIRREL] ?? 0);
  const max = GLOBAL_UPGRADE_MAP[SQUIRREL].maxLevel ?? 1;
  const left = max > 1 ? Math.max(0, 1 - (lvl - 1) / (max - 1)) : 1;
  return CUSTOMER.payTime * left;
}

/** 自動結帳一位客人要多久：走到櫃台（固定）+ 結帳 */
export function checkoutTime(s: GameState): number {
  return WALK_TIME + payTime(s);
}

/**
 * 顧客會買走產量的幾成：基礎 40%，每秒服務人數每翻倍 +10%（招牌、算盤松鼠、露米婭在櫃台），
 * 宣傳海報每級 +3%，最高 90%。剩下的交給收購箱。
 */
export function customerShare(s: GameState): number {
  const doublings = Math.log2(Math.max(1, customerThroughput(s) / CUSTOMER.shareRefThroughput));
  const share = CUSTOMER.shareBase + CUSTOMER.sharePerDoubling * doublings
    + UPGRADE_FX.posterSharePerLevel * (s.upgrades.poster ?? 0);
  return Math.min(CUSTOMER.shareMax, share);
}

/** 平均每位客人點幾瓶「基本量」（訂單種數 × 每種 1–3 瓶），用來把需求換算回每張訂單的大小 */
function avgBaseBottles(s: GameState): number {
  const chances = CUSTOMER.linesChance[Math.min(Math.max(1, s.cauldrons.length), 3)] ?? [1];
  const avgLines = chances.reduce((sum, q, k) => sum + q * (k + 1), 0);
  return avgLines * ((CUSTOMER.qtyMin + CUSTOMER.qtyMax) / 2);
}

/**
 * 訂單量倍率：讓顧客平均買走「這種藥水最近的實際產量 × 顧客比例」。
 * 跟著實際產量（原料不夠時產量掉，訂單也變小），所以原料分配不均時不會一直湊不齊。
 */
export function orderScale(s: GameState, p: PotionId): number {
  const types = Math.max(1, s.cauldrons.length);
  // 每位客人平均點到這種藥水幾瓶基本量
  const perCustomer = avgBaseBottles(s) / types;
  // 市場熱度讓需求起伏：熱的時候客人買得比產量多（囤貨有用），冷的時候有剩（收購箱有用）
  const scale = Math.max(1, (s.potionRate[p] * customerShare(s) * s.market.value) / (customerThroughput(s) * perCustomer));
  // 擺出魔法花束：客人心情好，每次多買 20%；女僕裝在櫃台：少買 20%（照原本的數量付錢）
  return scale * (decorFx(s, 'orderQty') ? GIFT_FX.orderQty : 1) * (1 - maidQtyCut(s));
}

/** 店裡站滿、每人都點最多時需要的某種藥水量（藥水保留量 100% 的基準） */
export function fullShopDemand(s: GameState, p: PotionId): number {
  return CUSTOMER.queueMax * maxCustomerQty(s) * orderScale(s, p);
}

/** 藥水保留量：設定的百分比 × 店裡站滿時的最大訂單量（設 0% = 全部收購） */
export function potionReserve(s: GameState, p: PotionId): number {
  return Math.ceil((fullShopDemand(s, p) * s.settings.potions[p].keepPct) / 100);
}

/** 每秒能服務幾位客人：來客速度與自動結帳速度取小（沒有自動結帳時以來客速度估計） */
export function customerThroughput(s: GameState): number {
  const arrivals = arrivalRate(s) / CUSTOMER.interval;
  return hasAutoCheckout(s) ? Math.min(arrivals, 1 / checkoutTime(s)) : arrivals;
}

// ---------- 開心度兌換（H 池、特殊乘數）----------

export function redeemed(s: GameState, id: string): number {
  return s.redeemed[id] ?? 0;
}

// ---------- 名聲、羈絆與開心度倍率 ----------

/** 店舖名聲：累計收入每多 10 倍 +1 級 */
export function renownLevel(s: GameState): number {
  return Math.max(0, Math.floor(Math.log10(Math.max(1, s.stats.goldEarned)) + 1e-9));
}

/** 羈絆等級：用開心度兌換過幾件東西（可重複的算次數；少女的聲援不算） */
export function bondLevel(s: GameState): number {
  return HAPPINESS_ITEMS.reduce((n, i) => n + (BOND.exclude.includes(i.id) ? 0 : redeemed(s, i.id)), 0);
}

/** 開心度倍率：心願、休息、觸碰、每日互動的開心度都乘上它 */
export function happyMult(s: GameState): number {
  return (1 + BOND.renownPerLevel * renownLevel(s)) * (1 + BOND.bondPerLevel * bondLevel(s));
}

// ---------- 休息室擺設（禮物） ----------

/** 目前開放的擺設位數 */
export function decorSlots(s: GameState): number {
  return DECOR.baseSlots + DECOR.slotItems.filter((id) => redeemed(s, id) > 0).length;
}

/** 目前擺出來（在開放的擺設位上）的禮物 */
export function displayedGifts(s: GameState): string[] {
  return s.decor.slice(0, decorSlots(s)).filter((id): id is string => !!id && !!s.gifts[id]);
}

/** 某種擺設效果有沒有生效 */
export function decorFx(s: GameState, fx: GiftFx): boolean {
  return displayedGifts(s).some((id) => GIFT_MAP[id]?.fx === fx);
}

/** 休息時每秒產出的開心度（含離線）：基礎 × 開心度倍率，擺出史萊姆娃娃再 ×1.5 */
export function restHappinessPerSec(s: GameState): number {
  const slime = decorFx(s, 'restHappy') ? GIFT_FX.restHappy : 1;
  return (MASCOT.restHappinessPerHour * happyMult(s) * slime) / 3600;
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
    if (decorFx(s, 'speed')) out.push({ stat, pool: 'H', value: GIFT_FX.speed });
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

/** 某一口大釜的雙倍機率：事件「完美火候」期間每輪都是雙倍 */
export function doubleChance(s: GameState, c: CauldronState): number {
  return buffMult(s, 'double', c.recipe) > 1 ? 1 : condenserChance(s);
}

export function drunkChance(s: GameState): number {
  return has(s, 'drunks') ? chance(UPGRADE_FX.drunkChance) : 0;
}

// ---------- 配方精煉 ----------

export function refineLevel(s: GameState, p: PotionId): number {
  return s.upgrades[REFINE_FOR[p]] ?? 0;
}

/** 精煉後每份藥水需要的原料（每級 +50%，可能有小數） */
export function recipeInputs(s: GameState, p: PotionId): [MaterialId, number][] {
  const mult = 1 + UPGRADE_FX.refineInputPerLevel * refineLevel(s, p);
  return (Object.entries(RECIPES[p].inputs) as [MaterialId, number][]).map(([m, n]) => [m, n * mult]);
}

export function recipeNeeds(s: GameState, p: PotionId, m: MaterialId): number {
  return recipeInputs(s, p).find(([x]) => x === m)?.[1] ?? 0;
}

/** 精煉的售價倍率（每級 +60%） */
export function refinePriceMult(s: GameState, p: PotionId): number {
  return 1 + UPGRADE_FX.refinePricePerLevel * refineLevel(s, p);
}

// ---------- 浮空盆栽 ----------

/** 第幾格是浮空盆栽（開局開放的格數之後） */
export const isFloatingSlot = (i: number) => i >= INITIAL_OPEN_SLOTS;

/** 奇蹟綠手指：浮空盆栽收成量 ×2 */
export function slotYieldMult(s: GameState, i: number): number {
  return isFloatingSlot(i) && redeemed(s, 'green_thumb') ? UPGRADE_FX.greenThumbYield : 1;
}

// ---------- 每秒產量（面板顯示與平衡分析用） ----------

/** 一盆每次採收的量（不含豐收）：等級 × 魔法肥料 × 浮空盆栽綠手指 */
export function harvestPerRound(s: GameState, i: number, slot: SlotState = s.slots[i]): number {
  const mult = slot.plant ? PLANTS[slot.plant].yieldMult : 1;
  return potYield(slot.level) * mult * harvestYield(s) * slotYieldMult(s, i);
}

/** 一盆自動採收時的每秒產量（不含豐收）；slot 可以傳「升級後」的副本來算下一級的效果 */
export function potOutputPerSec(s: GameState, i: number, slot: SlotState = s.slots[i]): number {
  if (!slot.plant) return 0;
  return (harvestPerRound(s, i, slot) * growthSpeed(s, slot)) / PLANTS[slot.plant].growTime;
}

/** 一口大釜原料足夠時每秒熬出幾瓶；c 可以傳「升級後」的副本 */
export function cauldronOutputPerSec(s: GameState, c: CauldronState): number {
  return (c.level * brewPassiveSpeed(s, c)) / RECIPES[c.recipe].brewTime;
}

/** 所有大釜以目前等級熬 1 輪需要多少這種原料 */
export function materialPerRound(s: GameState, m: MaterialId): number {
  return s.cauldrons.reduce((sum, c) => sum + recipeNeeds(s, c.recipe, m) * c.level, 0);
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
  if (lvl <= 0) return 0;
  // 事件「商會緊急收購」：照售價全額收購
  if (buffMult(s, 'crateFull') > 1) return 1;
  return UPGRADE_FX.crateBasePct + UPGRADE_FX.crateStepPct * (lvl - 1);
}

/** 有沒有任何一個收購箱 */
export function hasAnyCrate(s: GameState): boolean {
  return [...Object.values(CRATE_FOR), CRATE_MATERIALS].some((id) => has(s, id));
}

export function sellPrice(s: GameState, potion: PotionId): number {
  return RECIPES[potion].basePrice * refinePriceMult(s, potion) * combine(globalMods(s, 'sellPrice'));
}

/** 來客速度倍率 */
export function arrivalRate(s: GameState): number {
  return combine(globalMods(s, 'arrivalRate'));
}

export function customerPatience(s: GameState): number {
  return CUSTOMER.patience * combine(globalMods(s, 'patience'));
}

/** 每種藥水的基本數量上限（訂單量另外乘上產量倍率，所以這裡固定） */
export function maxCustomerQty(_s: GameState): number {
  return CUSTOMER.qtyMax;
}

/** 收成量倍率（魔法肥料） */
export function harvestYield(s: GameState): number {
  return combine(globalMods(s, 'harvestYield'));
}

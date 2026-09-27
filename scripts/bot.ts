// 平衡模擬用的機器人：點擊、購買、排大釜（balance.ts 與 happiness.ts 共用）
import { MATERIAL_IDS, PLANTS, type MaterialId } from '../src/game/config/plants';
import { RECIPES, type PotionId } from '../src/game/config/recipes';
import { CRATE_FOR, CRATE_MATERIALS, GLOBAL_UPGRADES, SQUIRREL } from '../src/game/config/upgrades';
import * as cmd from '../src/game/commands';
import { checkoutByClick, missingInputs, type SimContext } from '../src/game/sim';
import type { GameState } from '../src/game/state';
import { materialReserve, potionReserve } from '../src/game/stats';

/** 可重現的亂數 */
export function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface BotOptions {
  /** 5 格盆栽各種什麼（R 紅心草、M 月光菇、S 星光藤蔓） */
  alloc: string;
  /** value = 高價配方拖到最左邊；unlock = 維持解鎖順序 */
  cauldronOrder: 'value' | 'unlock';
  /** 有小心願時照題目點（點盆栽、點大釜、點對應的原料／藥水） */
  followWish?: boolean;
}

export const DEFAULT_BOT: BotOptions = { alloc: 'RMSRR', cauldronOrder: 'value' };

/** 某個大釜現在點得動（有原料或正在熬） */
const brewable = (s: GameState, recipe: PotionId) => {
  const c = s.cauldrons.find((x) => x.recipe === recipe);
  return !!c && (c.batch > 0 || missingInputs(s, c).length === 0);
};

/** 照小心願的題目點一下；題目不需要點擊（或點不動）時回傳 false */
function wishClick(s: GameState, ctx: SimContext): boolean {
  const w = s.wish;
  if (!w) return false;
  const potOf = (m?: MaterialId) => s.slots.findIndex((sl) => sl.plant && (!m || sl.plant === m));
  switch (w.kind) {
    case 'clickPot':
    case 'harvest': {
      const i = potOf(w.kind === 'harvest' ? (w.item as MaterialId) : undefined);
      if (i < 0) return false;
      cmd.clickPlant(s, i, ctx);
      return true;
    }
    case 'clickCauldron':
    case 'brew': {
      const target = w.kind === 'brew'
        ? (w.item as PotionId)
        : s.cauldrons.map((c) => c.recipe).find((r) => brewable(s, r));
      if (!target) return false;
      if (!brewable(s, target)) {
        // 缺原料：去點會用到的原料盆栽
        const need = MATERIAL_IDS.find((m) => (RECIPES[target].inputs as Partial<Record<MaterialId, number>>)[m]
          && s.materials[m] < 50);
        const i = potOf(need);
        if (i < 0) return false;
        cmd.clickPlant(s, i, ctx);
        return true;
      }
      cmd.clickCauldron(s, target, ctx);
      return true;
    }
    default:
      return false;
  }
}

/** 點擊一下：（小心願）→ 幫備好貨的客人結帳 → 收成熟的植物 → 沒有火蜥蜴的大釜 → 還在長的盆栽 */
export function botClick(s: GameState, ctx: SimContext, opts: BotOptions = DEFAULT_BOT): void {
  const buyer = s.customers.find((c) => c.status !== 'waiting' && !c.express);
  if (buyer) return void checkoutByClick(s, buyer.id, ctx);
  if (opts.followWish && wishClick(s, ctx)) return;
  const ready = s.slots.findIndex((sl) => sl.plant && sl.ready);
  if (ready >= 0) return void cmd.clickPlant(s, ready, ctx);
  const manual = s.cauldrons.find((c) => c.salamander === 0 && (c.batch > 0 || missingInputs(s, c).length === 0));
  if (manual) return void cmd.clickCauldron(s, manual.recipe, ctx);
  const growing = s.slots.findIndex((sl) => sl.plant && !sl.fairy);
  if (growing >= 0) return void cmd.clickPlant(s, growing, ctx);
  const any = s.slots.findIndex((sl) => sl.plant);
  if (any >= 0) cmd.clickPlant(s, any, ctx);
}

function wantedPlant(s: GameState, i: number, opts: BotOptions): MaterialId {
  const has = (p: PotionId) => s.cauldrons.some((c) => c.recipe === p);
  const want = opts.alloc[i] ?? 'R';
  if (want === 'S' && has('elixir')) return 'starvine';
  if ((want === 'S' || want === 'M') && has('focus')) return 'moonshroom';
  return 'redheart';
}

export type Buy = { label: string; cost: number; run: () => boolean };

function candidates(s: GameState, ctx: SimContext, opts: BotOptions): Buy[] {
  const out: Buy[] = [];
  s.slots.forEach((slot, i) => {
    if (!slot.open) return;
    const want = wantedPlant(s, i, opts);
    if (!slot.plant) {
      out.push({ label: `種植 ${PLANTS[want].name}`, cost: PLANTS[want].seedCost, run: () => cmd.plantSeed(s, i, want) });
      return;
    }
    if (slot.plant !== want) {
      const cost = cmd.replantCost(s, i, want);
      if (cost !== null) out.push({ label: `改種 ${PLANTS[want].name}`, cost, run: () => cmd.replant(s, i, want, ctx) });
    }
    for (const kind of ['potLevel', 'rain', 'fairy'] as const) {
      const key = { kind, slot: i };
      const q = cmd.getQuote(s, key, 1);
      if (q && q.count > 0) out.push({ label: `${kind}#${i}`, cost: q.cost, run: () => cmd.purchase(s, key, 1) });
    }
  });
  for (const c of s.cauldrons) {
    for (const kind of ['cauldronLevel', 'salamander'] as const) {
      const key = { kind, recipe: c.recipe };
      const q = cmd.getQuote(s, key, 1);
      if (q && q.count > 0) out.push({ label: `${kind}:${c.recipe}`, cost: q.cost, run: () => cmd.purchase(s, key, 1) });
    }
  }
  for (const p of cmd.nextLockedRecipes(s)) {
    out.push({ label: `解鎖 ${RECIPES[p].name}`, cost: RECIPES[p].unlockCost, run: () => cmd.unlockRecipe(s, p) });
  }
  for (const u of GLOBAL_UPGRADES) {
    const key = { kind: 'global' as const, id: u.id };
    const q = cmd.getQuote(s, key, 1);
    if (q && q.count > 0) out.push({ label: u.name, cost: q.cost, run: () => cmd.purchase(s, key, 1) });
  }
  return out;
}

/** 某個還沒買的收購箱，對應的庫存已經堆到保留量兩倍以上：玩家會想買它 */
function crateNeeded(s: GameState, label: string): boolean {
  if (!label.startsWith('收購箱：')) return false;
  if (label === '收購箱：原料') {
    return !s.upgrades[CRATE_MATERIALS] && MATERIAL_IDS.some((m) => s.materials[m] > materialReserve(s, m) * 2);
  }
  const p = s.cauldrons.map((c) => c.recipe).find((r) => label.endsWith(RECIPES[r].name));
  return !!p && !s.upgrades[CRATE_FOR[p]] && s.potions[p] > Math.max(20, potionReserve(s, p) * 2);
}

const VALUE_ORDER: PotionId[] = ['elixir', 'focus', 'glow'];

function botArrange(s: GameState, opts: BotOptions): void {
  if (opts.cauldronOrder !== 'value') return;
  VALUE_ORDER.filter((p) => s.cauldrons.some((c) => c.recipe === p)).forEach((p, to) => {
    const from = s.cauldrons.findIndex((c) => c.recipe === p);
    if (from !== to) cmd.moveCauldron(s, from, to);
  });
}

/**
 * 解鎖、種新植物（以及庫存堆積時對應的收購箱）優先存錢；其他就買最便宜的。
 * extra：額外的優先項目（例如禮物），一樣會存錢買
 */
export function botShop(
  s: GameState, ctx: SimContext, log: (label: string) => void, opts: BotOptions = DEFAULT_BOT, extra: Buy[] = [],
): void {
  botArrange(s, opts);
  for (let n = 0; n < 200; n++) {
    const list = candidates(s, ctx, opts);
    // 第一隻算盤松鼠（自動結帳）也優先：沒有它時不點擊就賣不出去
    const isPriority = (b: Buy) => /^(解鎖|種植|改種|fairy)/.test(b.label) || crateNeeded(s, b.label)
      || (b.label === '算盤松鼠' && !s.upgrades[SQUIRREL]);
    const priority = [...list.filter(isPriority), ...extra].sort((a, b) => a.cost - b.cost)[0];
    // 有優先項目時，只買價格低於它 10% 的小東西，其他錢存起來
    const pick = priority && s.gold >= priority.cost
      ? priority
      : list.filter((b) => b.cost <= s.gold && (!priority || b.cost <= priority.cost * 0.1))
        .sort((a, b) => a.cost - b.cost)[0];
    if (!pick || !pick.run()) return;
    log(pick.label);
    if (extra.includes(pick)) extra.splice(extra.indexOf(pick), 1);
  }
}

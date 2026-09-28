// 升級定義。效果一律描述為「修正值 (Mod)」，由 stats.ts 依企劃書第 5 章的疊加規則計算。
import { localized } from '../../i18n';
import type { GameState } from '../state';
import { CUSTOMER } from './balance';
import { RECIPES, type PotionId } from './recipes';

export type StatId = 'growthSpeed' | 'brewSpeed' | 'sellPrice' | 'arrivalRate' | 'patience' | 'harvestYield';

/** G=金幣池 M=看板娘池 H=開心度池（池內相加）；S=特殊乘數（直接相乘） */
export type Pool = 'G' | 'M' | 'H' | 'S';

export interface Mod {
  stat: StatId;
  pool: Pool;
  /** G/M/H：加算值（0.1 = +10%）；S：乘數（2 = ×2） */
  value: number;
}

/** inline = 顯示在各自的卡片裡（浮空盆栽格、配方卡片），不出現在區域的升級清單 */
export type Zone = 'greenhouse' | 'cauldron' | 'counter' | 'system' | 'inline';

export interface GlobalUpgradeDef {
  id: string;
  /** 圖示的資源 ID */
  icon: string;
  name: string;
  desc: string;
  zone: Zone;
  /** 等比價格：第 k 次購買 = base × growth^k */
  cost: { base: number; growth: number };
  /** 指定每一級的價格（有設定時取代 cost，長度即最高等級） */
  costTable?: number[];
  maxLevel?: number;
  mods: (level: number) => Mod[];
  /** 需要滿足條件才會出現、才能購買（例如對應配方已解鎖） */
  requires?: (s: GameState) => boolean;
}

type RawUpgrade = Omit<GlobalUpgradeDef, 'name' | 'desc'>;
const TEXT = ['name', 'desc'] as const;

const none = () => [];

/** 每種藥水的收購箱 ID */
export const CRATE_FOR: Record<PotionId, string> = {
  glow: 'crate_glow', focus: 'crate_focus', elixir: 'crate_elixir',
};
export const CRATE_MATERIALS = 'crate_materials';

/** 魔法招牌：每級來客速度 +15%。上限讓來客速度剛好等於櫃台最快的結帳速度（松鼠滿級時只剩走到櫃台的時間），再高客人只會卡在門外 */
const SIGNBOARD_PER_LEVEL = 0.15;
export const SIGNBOARD_MAX = Math.floor(
  ((CUSTOMER.interval * CUSTOMER.walkSpeed) / CUSTOMER.walkToCounter - 1) / SIGNBOARD_PER_LEVEL,
);

/** 算盤松鼠：自動結帳，升級提高結帳與客人走路速度（到上限 ×3 為止） */
export const SQUIRREL = 'abacus_squirrel';

/** 浮空魔法盆栽：分兩次購買，依序開啟第 4、第 5 格 */
export const FLOATING_POT = 'floating_pot';
export const FLOATING_POT_COSTS = [20_000, 500_000];

/** 每種配方的精煉升級 ID（價格依藥水階級遞增） */
export const REFINE_FOR: Record<PotionId, string> = {
  glow: 'refine_glow', focus: 'refine_focus', elixir: 'refine_elixir',
};
const REFINE_BASE: Record<PotionId, number> = { glow: 5_000, focus: 100_000, elixir: 2_000_000 };

/** 收購箱價格依藥水階級遞增；微光的維持開局就買得起 */
const CRATE_COSTS: Record<PotionId, number[]> = {
  glow: [100, 1500, 6000, 25000],
  focus: [1000, 15000, 60000, 250000],
  elixir: [20000, 300000, 1200000, 5000000],
};

const RAW_UPGRADES: RawUpgrade[] = [
  // ---- 溫室 ----
  {
    id: FLOATING_POT, icon: 'pot_hidden_slot', zone: 'inline',
    cost: { base: FLOATING_POT_COSTS[0], growth: 1 }, costTable: FLOATING_POT_COSTS, mods: none,
  },
  {
    id: 'star_can', icon: 'upg_starsilver_can', zone: 'greenhouse',
    cost: { base: 1500, growth: 1 }, maxLevel: 1, mods: none,
  },
  {
    id: 'shears', icon: 'upg_shears', zone: 'greenhouse',
    cost: { base: 6000, growth: 1 }, maxLevel: 1, mods: none,
  },
  {
    id: 'fertilizer', icon: 'upg_fertilizer', zone: 'greenhouse',
    cost: { base: 1000, growth: 1.6 },
    mods: (l) => [{ stat: 'harvestYield', pool: 'G', value: 0.1 * l }],
  },
  {
    id: 'garden_gloves', icon: 'upg_garden_gloves', zone: 'greenhouse',
    cost: { base: 800, growth: 2 }, mods: none,
  },
  // ---- 大釜 ----
  {
    id: 'warm_circle', icon: 'upg_warm_circle', zone: 'cauldron',
    cost: { base: 1500, growth: 1.6 },
    mods: (l) => [{ stat: 'brewSpeed', pool: 'G', value: 0.15 * l }],
  },
  {
    id: 'servant_ladle', icon: 'upg_servant_ladle', zone: 'cauldron',
    cost: { base: 20000, growth: 10 }, maxLevel: 3,
    mods: (l) => [{ stat: 'brewSpeed', pool: 'S', value: 1.5 ** l }],
  },
  {
    id: 'bellows', icon: 'upg_bellows', zone: 'cauldron',
    cost: { base: 8000, growth: 1 }, maxLevel: 1, mods: none,
  },
  {
    id: 'condenser', icon: 'upg_condenser', zone: 'cauldron',
    cost: { base: 50000, growth: 1 }, maxLevel: 1, mods: none,
  },
  {
    id: 'rune_stirrer', icon: 'upg_rune_stirrer', zone: 'cauldron',
    cost: { base: 1200, growth: 2 }, mods: none,
  },
  // ---- 櫃台 ----
  {
    id: SQUIRREL, icon: 'upg_abacus_squirrel', zone: 'counter',
    cost: { base: 150, growth: 3 }, maxLevel: 9, mods: none,
  },
  {
    id: 'fortune_owl', icon: 'upg_owl', zone: 'counter',
    cost: { base: 200, growth: 1.6 },
    mods: (l) => [{ stat: 'sellPrice', pool: 'G', value: 0.1 * l }],
  },
  {
    id: 'signboard', icon: 'upg_signboard', zone: 'counter',
    cost: { base: 150, growth: 1.3 }, maxLevel: SIGNBOARD_MAX,
    mods: (l) => [{ stat: 'arrivalRate', pool: 'G', value: SIGNBOARD_PER_LEVEL * l }],
  },
  {
    id: 'diffuser', icon: 'upg_diffuser', zone: 'counter',
    cost: { base: 1000, growth: 1 }, maxLevel: 1,
    mods: () => [{ stat: 'patience', pool: 'G', value: 0.3 }],
  },
  {
    id: 'poster', icon: 'upg_poster', zone: 'counter',
    cost: { base: 3000, growth: 2 }, maxLevel: 10, mods: none,
  },
  {
    id: 'bell', icon: 'upg_bell', zone: 'counter',
    cost: { base: 2000, growth: 1 }, maxLevel: 1, mods: none,
  },
  {
    id: 'drunks', icon: 'upg_drunk', zone: 'counter',
    cost: { base: 40000, growth: 1 }, maxLevel: 1, mods: none,
  },
  // 商會收購箱：每種藥水各一個（各自設定保留量），原料一個（只有開關）
  ...(Object.keys(CRATE_FOR) as PotionId[]).map((p): RawUpgrade => ({
    id: CRATE_FOR[p], icon: `potion_${p}`, zone: 'counter',
    cost: { base: CRATE_COSTS[p][0], growth: 1 }, costTable: CRATE_COSTS[p], mods: none,
    requires: (s) => s.cauldrons.some((c) => c.recipe === p),
  })),
  {
    id: CRATE_MATERIALS, icon: 'item_redheart', zone: 'counter',
    cost: { base: 300, growth: 1 }, costTable: [300, 4000, 16000, 64000], mods: none,
  },
  // ---- 配方精煉（顯示在各配方卡片裡）：每級原料需求 +50%、售價 +60%，故意製造原料短缺 ----
  ...(Object.keys(REFINE_FOR) as PotionId[]).map((p): RawUpgrade => ({
    id: REFINE_FOR[p], icon: `potion_${p}`, zone: 'inline',
    cost: { base: REFINE_BASE[p], growth: 4 }, maxLevel: 5, mods: none,
    requires: (s) => s.cauldrons.some((c) => c.recipe === p),
  })),
  // ---- 系統 ----
  {
    id: 'guild_contract', icon: 'upg_guild_contract', zone: 'system',
    cost: { base: 5000000, growth: 1 }, maxLevel: 1, mods: none,
  },
];

/**
 * 名稱與說明在語言檔 upgrade.<id>.name／desc；
 * 各藥水的收購箱與精煉共用一段文字（upgrade.crate／upgrade.refine），帶入藥水名稱
 */
export const GLOBAL_UPGRADES: GlobalUpgradeDef[] = RAW_UPGRADES.map((u) => {
  const potions = Object.keys(CRATE_FOR) as PotionId[];
  const crate = potions.find((p) => CRATE_FOR[p] === u.id);
  if (crate) return localized(u, 'upgrade.crate', TEXT, () => ({ potion: RECIPES[crate].name }));
  const refine = potions.find((p) => REFINE_FOR[p] === u.id);
  if (refine) return localized(u, 'upgrade.refine', TEXT, () => ({ potion: RECIPES[refine].name }));
  if (u.id === 'signboard') return localized(u, 'upgrade.signboard', TEXT, () => ({ max: SIGNBOARD_MAX }));
  return localized(u, `upgrade.${u.id}`, TEXT);
});

export function maxLevelOf(def: GlobalUpgradeDef): number {
  return def.costTable?.length ?? def.maxLevel ?? Infinity;
}

export const GLOBAL_UPGRADE_MAP: Record<string, GlobalUpgradeDef> =
  Object.fromEntries(GLOBAL_UPGRADES.map((u) => [u.id, u]));

/** 針對單一盆栽/大釜購買的升級（價格會乘上階級倍率 TM）；文字在語言檔 target.<id>.name／desc */
export const TARGET_UPGRADES = {
  raincloud: localized({ base: 25, growth: 1.25, perLevel: 0.25 }, 'target.raincloud', TEXT),
  fairy: localized({ base: 50 }, 'target.fairy', TEXT),
  salamander: localized({ base: 30, growth: 1.25 }, 'target.salamander', TEXT),
};

// 升級定義。效果一律描述為「修正值 (Mod)」，由 stats.ts 依企劃書第 5 章的疊加規則計算。
import type { GameState } from '../state';
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

export type Zone = 'greenhouse' | 'cauldron' | 'counter' | 'system';

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

const none = () => [];

/** 每種藥水的收購箱 ID */
export const CRATE_FOR: Record<PotionId, string> = {
  glow: 'crate_glow', focus: 'crate_focus', elixir: 'crate_elixir',
};
export const CRATE_MATERIALS = 'crate_materials';

/** 收購箱價格依藥水階級遞增；微光的維持開局就買得起 */
const CRATE_COSTS: Record<PotionId, number[]> = {
  glow: [100, 1500, 6000, 25000],
  focus: [1000, 15000, 60000, 250000],
  elixir: [20000, 300000, 1200000, 5000000],
};

export const GLOBAL_UPGRADES: GlobalUpgradeDef[] = [
  // ---- 溫室 ----
  {
    id: 'star_can', icon: 'upg_starsilver_can', name: '星銀澆水壺', zone: 'greenhouse',
    desc: '二手市集掏來的魔法水壺，水滴會亂彈。點擊盆栽時，相鄰盆栽也獲得 50% 推進。',
    cost: { base: 1500, growth: 1 }, maxLevel: 1, mods: none,
  },
  {
    id: 'shears', icon: 'upg_shears', name: '附魔園藝剪', zone: 'greenhouse',
    desc: '刻著魔導書符文的剪刀。手動點擊植物時 5% 機率「暴擊生長」：立即收成，產量 ×3。',
    cost: { base: 6000, growth: 1 }, maxLevel: 1, mods: none,
  },
  {
    id: 'fertilizer', icon: 'upg_fertilizer', name: '魔法肥料', zone: 'greenhouse',
    desc: '露米婭自己調配的發光肥料。所有植物每次收成量 +10%/級（可無限升級）。',
    cost: { base: 1000, growth: 1.6 },
    mods: (l) => [{ stat: 'harvestYield', pool: 'G', value: 0.1 * l }],
  },
  // ---- 大釜 ----
  {
    id: 'warm_circle', icon: 'upg_warm_circle', name: '保溫魔法陣', zone: 'cauldron',
    desc: '畫在爐台下的保溫符文。所有大釜被動熬煮速度 +15%/級（可無限升級）。',
    cost: { base: 1500, growth: 1.6 },
    mods: (l) => [{ stat: 'brewSpeed', pool: 'G', value: 0.15 * l }],
  },
  {
    id: 'servant_ladle', icon: 'upg_servant_ladle', name: '隱形僕役湯勺', zone: 'cauldron',
    desc: '自己瘋狂攪拌的漂浮湯勺。所有大釜被動熬煮速度 ×1.5（最多 3 級）。',
    cost: { base: 20000, growth: 10 }, maxLevel: 3,
    mods: (l) => [{ stat: 'brewSpeed', pool: 'S', value: 1.5 ** l }],
  },
  {
    id: 'bellows', icon: 'upg_bellows', name: '龍息風箱', zone: 'cauldron',
    desc: '對同一口大釜連點 10 下（每下間隔 1 秒內），進入 5 秒「極速沸騰」：速度 ×6。之後冷卻 15 秒。',
    cost: { base: 8000, growth: 1 }, maxLevel: 1, mods: none,
  },
  {
    id: 'condenser', icon: 'upg_condenser', name: '雙口冷凝管', zone: 'cauldron',
    desc: '硬接在一起的危險發明。每輪熬煮完成時 15% 機率產出 ×2（原料只扣一份）。',
    cost: { base: 50000, growth: 1 }, maxLevel: 1, mods: none,
  },
  // ---- 櫃台 ----
  {
    id: 'fortune_owl', icon: 'upg_owl', name: '招財貓頭鷹', zone: 'counter',
    desc: '站在收銀機上的木雕貓頭鷹。藥水售價 +10%/級。',
    cost: { base: 200, growth: 1.6 },
    mods: (l) => [{ stat: 'sellPrice', pool: 'G', value: 0.1 * l }],
  },
  {
    id: 'signboard', icon: 'upg_signboard', name: '魔法招牌', zone: 'counter',
    desc: '會對路人拋媚眼的招牌。來客速度 +15%/級，每 10 級顧客需求上限 +1。',
    cost: { base: 150, growth: 1.3 },
    mods: (l) => [{ stat: 'arrivalRate', pool: 'G', value: 0.15 * l }],
  },
  {
    id: 'diffuser', icon: 'upg_diffuser', name: '迷幻擴香儀', zone: 'counter',
    desc: '薄荷與薰衣草香氣讓顧客忘記時間。顧客耐心 +30%。',
    cost: { base: 1000, growth: 1 }, maxLevel: 1,
    mods: () => [{ stat: 'patience', pool: 'G', value: 0.3 }],
  },
  {
    id: 'poster', icon: 'upg_poster', name: '宣傳海報', zone: 'counter',
    desc: '貼滿全鎮的藥水廣告。顧客每種藥水的需求上限 +1/級（可無限升級），讓多出來的產量賣給全價顧客。',
    cost: { base: 3000, growth: 2 }, mods: none,
  },
  {
    id: 'bell', icon: 'upg_bell', name: '叫賣鈴鐺', zone: 'counter',
    desc: '點擊櫃台上的鈴鐺，立刻招來一位顧客。最多存 3 次，每 30 秒回復 1 次。',
    cost: { base: 2000, growth: 1 }, maxLevel: 1, mods: none,
  },
  {
    id: 'drunks', icon: 'upg_drunk', name: '慷慨的酒鬼體質', zone: 'counter',
    desc: '喝醉的冒險者連找零都不要。每筆交易 5% 機率「土豪小費」：金幣 ×2。',
    cost: { base: 40000, growth: 1 }, maxLevel: 1, mods: none,
  },
  // 商會收購箱：每種藥水各一個（各自設定保留量），原料一個（只有開關）
  ...(Object.keys(CRATE_FOR) as PotionId[]).map((p): GlobalUpgradeDef => ({
    id: CRATE_FOR[p], icon: `potion_${p}`, name: `收購箱：${RECIPES[p].name}`, zone: 'counter',
    desc: `${RECIPES[p].name}超過保留量的部分自動收購。Lv1 收購價 30%，每級 +10%（最高 60%）。`,
    cost: { base: CRATE_COSTS[p][0], growth: 1 }, costTable: CRATE_COSTS[p], mods: none,
    requires: (s) => s.cauldrons.some((c) => c.recipe === p),
  })),
  {
    id: CRATE_MATERIALS, icon: 'item_redheart', name: '收購箱：原料', zone: 'counter',
    desc: '多餘的原料自動收購（每種原料可各自開關、設定保留百分比，預設保留大釜熬 3 輪的量）。Lv1 收購價 30%，每級 +10%（最高 60%）。',
    cost: { base: 300, growth: 1 }, costTable: [300, 4000, 16000, 64000], mods: none,
  },
  // ---- 系統 ----
  {
    id: 'guild_contract', icon: 'upg_guild_contract', name: '過勞精靈工會合約', zone: 'system',
    desc: '離線期間，精靈們模擬「每秒點擊 5 次」幫你催熟植物與攪拌大釜。',
    cost: { base: 5000000, growth: 1 }, maxLevel: 1, mods: none,
  },
];

export function maxLevelOf(def: GlobalUpgradeDef): number {
  return def.costTable?.length ?? def.maxLevel ?? Infinity;
}

export const GLOBAL_UPGRADE_MAP: Record<string, GlobalUpgradeDef> =
  Object.fromEntries(GLOBAL_UPGRADES.map((u) => [u.id, u]));

/** 針對單一盆栽/大釜購買的升級（價格會乘上階級倍率 TM） */
export const TARGET_UPGRADES = {
  raincloud: { name: '局部微型雨雲', desc: '生長速度 +25%/級', base: 25, growth: 1.25, perLevel: 0.25 },
  fairy: { name: '貪吃花妖精', desc: '植物成熟時自動採收', base: 50 },
  salamander: {
    name: '鍋底火蜥蜴', desc: 'Lv1 賦予被動熬煮（基礎速度 50%），之後每級 +25%',
    base: 30, growth: 1.25,
  },
};

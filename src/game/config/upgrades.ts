// 升級定義。效果一律描述為「修正值 (Mod)」，由 stats.ts 依企劃書第 5 章的疊加規則計算。
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

export const GLOBAL_UPGRADES: GlobalUpgradeDef[] = [
  // ---- 溫室 ----
  {
    id: FLOATING_POT, icon: 'pot_hidden_slot', name: '浮空魔法盆栽', zone: 'inline',
    desc: '讓花盆飄在溫室半空中，多一格可以種植物。第 1 次開啟第 4 格，第 2 次開啟第 5 格。',
    cost: { base: FLOATING_POT_COSTS[0], growth: 1 }, costTable: FLOATING_POT_COSTS, mods: none,
  },
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
  {
    id: 'garden_gloves', icon: 'upg_garden_gloves', name: '魔力園藝手套', zone: 'greenhouse',
    desc: '戴上就能把魔力注入植物。親手點擊盆栽時，額外推進「0.01 秒 × 等級」的自動生長量（跟著所有生長速度加成變強，可無限升級）。',
    cost: { base: 800, growth: 2 }, mods: none,
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
  {
    id: 'rune_stirrer', icon: 'upg_rune_stirrer', name: '符文攪拌棒', zone: 'cauldron',
    desc: '刻滿加速符文的攪拌棒。親手攪拌大釜時，額外推進「0.01 秒 × 等級」的被動熬煮量（跟著所有熬煮速度加成變強，沒有火蜥蜴也有效，可無限升級）。',
    cost: { base: 1200, growth: 2 }, mods: none,
  },
  // ---- 櫃台 ----
  {
    id: SQUIRREL, icon: 'upg_abacus_squirrel', name: '算盤松鼠', zone: 'counter',
    desc: '抱著小算盤的松鼠店員。Lv1 開始自動幫走到櫃台的客人結帳（一次一位，約 2.1 秒）；之後每級縮短結帳時間，滿級（Lv9）時客人走到櫃台的同時就完成訂單。',
    cost: { base: 150, growth: 3 }, maxLevel: 9, mods: none,
  },
  {
    id: 'fortune_owl', icon: 'upg_owl', name: '招財貓頭鷹', zone: 'counter',
    desc: '站在收銀機上的木雕貓頭鷹。藥水售價 +10%/級。',
    cost: { base: 200, growth: 1.6 },
    mods: (l) => [{ stat: 'sellPrice', pool: 'G', value: 0.1 * l }],
  },
  {
    id: 'signboard', icon: 'upg_signboard', name: '魔法招牌', zone: 'counter',
    desc: `會對路人拋媚眼的招牌。來客速度 +15%/級（最高 Lv ${SIGNBOARD_MAX}：來客速度等於櫃台最快的結帳速度）。`,
    cost: { base: 150, growth: 1.3 }, maxLevel: SIGNBOARD_MAX,
    mods: (l) => [{ stat: 'arrivalRate', pool: 'G', value: SIGNBOARD_PER_LEVEL * l }],
  },
  {
    id: 'diffuser', icon: 'upg_diffuser', name: '迷幻擴香儀', zone: 'counter',
    desc: '薄荷與薰衣草香氣讓顧客忘記時間。顧客耐心 +30%。',
    cost: { base: 1000, growth: 1 }, maxLevel: 1,
    mods: () => [{ stat: 'patience', pool: 'G', value: 0.3 }],
  },
  {
    id: 'poster', icon: 'upg_poster', name: '宣傳海報', zone: 'counter',
    desc: '貼滿全鎮的藥水廣告。顧客買走的產量比例 +3%/級（最多 10 級），讓更多產量賣給全價顧客。',
    cost: { base: 3000, growth: 2 }, maxLevel: 10, mods: none,
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
  // ---- 配方精煉（顯示在各配方卡片裡）：每級原料需求 +50%、售價 +60%，故意製造原料短缺 ----
  ...(Object.keys(REFINE_FOR) as PotionId[]).map((p): GlobalUpgradeDef => ({
    id: REFINE_FOR[p], icon: `potion_${p}`, name: `精煉：${RECIPES[p].name}`, zone: 'inline',
    desc: '改良配方做出更高級的藥水：每級每份原料需求 +50%、售價 +60%（永久套用，原料不夠時大釜會等原料）。',
    cost: { base: REFINE_BASE[p], growth: 4 }, maxLevel: 5, mods: none,
    requires: (s) => s.cauldrons.some((c) => c.recipe === p),
  })),
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

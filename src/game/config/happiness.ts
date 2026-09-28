// 開心度兌換（企劃書第 8 章）

import { localized, localizedList } from '../../i18n';

export type HappinessKind = 'slot' | 'outfit' | 'talent' | 'story';

export interface HappinessItem {
  id: string;
  tier: 1 | 2 | 3 | 4;
  kind: HappinessKind;
  name: string;
  desc: string;
  /** 圖示資源 ID */
  icon: string;
  /** 第 owned 次（從 0 起算）購買的價格（整數開心度） */
  cost: (owned: number) => number;
  max: number;
}

const fixed = (n: number) => () => n;

const RAW_ITEMS: Omit<HappinessItem, 'name' | 'desc'>[] = [
  // Tier 1：休息室擴建（多一格擺設位，禮物擺出來才有效果）
  {
    id: 'decor_slot_3', tier: 1, kind: 'slot', icon: 'icon_decor_slot',
    cost: fixed(3), max: 1,
  },
  {
    id: 'decor_slot_4', tier: 1, kind: 'slot', icon: 'icon_decor_slot',
    cost: fixed(8), max: 1,
  },
  // Tier 2：服裝
  {
    id: 'outfit_maid', tier: 2, kind: 'outfit', icon: 'lumia_chibi_maid_idle',
    cost: fixed(15), max: 1,
  },
  {
    id: 'outfit_pajama', tier: 2, kind: 'outfit', icon: 'lumia_chibi_pajama_idle',
    cost: fixed(20), max: 1,
  },
  {
    id: 'outfit_gardener', tier: 2, kind: 'outfit', icon: 'lumia_chibi_gardener_idle',
    cost: fixed(25), max: 1,
  },
  {
    id: 'outfit_robe', tier: 2, kind: 'outfit', icon: 'lumia_chibi_robe_idle',
    cost: fixed(30), max: 1,
  },
  // Tier 3：特權天賦
  {
    id: 'cheer', tier: 3, kind: 'talent', icon: 'icon_cheer',
    cost: (n) => Math.ceil(2 * 1.35 ** n), max: Infinity,
  },
  {
    id: 'attunement', tier: 3, kind: 'talent', icon: 'icon_attunement',
    cost: (n) => 3 + 2 * n, max: 5,
  },
  {
    id: 'green_thumb', tier: 3, kind: 'talent', icon: 'icon_green_thumb',
    cost: fixed(10), max: 1,
  },
  {
    id: 'telepathy', tier: 3, kind: 'talent', icon: 'icon_telepathy',
    cost: fixed(20), max: 1,
  },
  // Tier 4：深層羈絆
  {
    id: 'celebration', tier: 4, kind: 'story', icon: 'cg_celebration',
    cost: fixed(50), max: 1,
  },
  {
    id: 'vow', tier: 4, kind: 'story', icon: 'cg_starry_vow',
    cost: fixed(100), max: 1,
  },
];

/** 文字在語言檔 redeem.<id>.name／desc */
export const HAPPINESS_ITEMS: HappinessItem[] = RAW_ITEMS.map((i) => localized(i, `redeem.${i.id}`, ['name', 'desc']));

export const HAPPINESS_MAP: Record<string, HappinessItem> =
  Object.fromEntries(HAPPINESS_ITEMS.map((i) => [i.id, i]));

/**
 * 開心度倍率 = (1 + 名聲 × renownPerLevel) × (1 + 羈絆 × bondPerLevel)。
 * 名聲：累計收入每多 10 倍 +1 級（前期成長快）；羈絆：每兌換一件開心度物品 +1 級（少女的聲援不算，後期成長）。
 * 心願、休息、觸碰、每日互動的開心度都乘上它；成就與禮物固定。
 */
export const BOND = {
  renownPerLevel: 0.1,
  bondPerLevel: 0.15,
  /** 不算進羈絆等級的兌換項目（可無限購買） */
  exclude: ['cheer'],
};

export const TALENT_FX = {
  cheerPrice: 0.2,
  attunementChance: 0.1,
  telepathyCapHours: 72,
  celebrationPrice: 3,
  feverSeconds: 60,
  feverMult: 10,
};

/** 劇情事件：標題與台詞在語言檔 story.<id>.title／lines */
const story = (id: string, cg: string) => localizedList(localized({ cg }, `story.${id}`, ['title']), `story.${id}`, ['lines']);
export const STORIES: Record<string, { title: string; cg: string; lines: string[] }> = {
  celebration: story('celebration', 'cg_celebration'),
  vow: story('vow', 'cg_starry_vow'),
};

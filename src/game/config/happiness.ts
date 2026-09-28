// 開心度兌換（企劃書第 8 章）

import { localized } from '../../i18n';

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
  // Tier 4：深層羈絆（主線：序章 → 慶功宴 → 三封遠方的來信 → 星空下的誓約；劇本在 story.ts）
  {
    // 序章：不用兌換，新遊戲一開始就播放，看完就算擁有（之後可以回顧）
    id: 'opening', tier: 4, kind: 'story', icon: 'icon_grimoire',
    cost: fixed(0), max: 1,
  },
  // 劇情的圖示都用魔導書（CG 縮成小圖示看不清楚，也會先暴露劇情畫面）
  {
    id: 'celebration', tier: 4, kind: 'story', icon: 'icon_grimoire',
    cost: fixed(25), max: 1,
  },
  {
    // 結局：收齊三封信、名聲到 STORY.vowRenown 級才能兌換（commands.redeemLock）
    id: 'vow', tier: 4, kind: 'story', icon: 'icon_grimoire',
    cost: fixed(125), max: 1,
  },
];

/**
 * 主線的條件。
 * 誓約的名聲：劇情是「連王國的騎士團都要排隊買」，店要夠有名。npm run happiness：名聲 13 級在積極 8h44m、
 * 純掛機 22h、關掉頁面 37h 達成，都在第三封信之前，所以不會拉長遊戲，只是保證劇情合理；
 * 14 級要到積極 18h、純掛機 42h、關掉頁面 68h，會把結局延後太多。
 */
export const STORY = {
  vowRenown: 13,
};

/** 文字在語言檔 redeem.<id>.name／desc（{renown} = 誓約要的名聲等級） */
export const HAPPINESS_ITEMS: HappinessItem[] = RAW_ITEMS.map((i) =>
  localized(i, `redeem.${i.id}`, ['name', 'desc'], () => ({ renown: STORY.vowRenown })));

export const HAPPINESS_MAP: Record<string, HappinessItem> =
  Object.fromEntries(HAPPINESS_ITEMS.map((i) => [i.id, i]));

/**
 * 開心度倍率 = (1 + 名聲 × renownPerLevel) × (1 + 羈絆 × bondPerLevel)。
 * 名聲：累計收入每多 10 倍 +1 級（前期成長快）；
 * 羈絆：看露米婭累計獲得的開心度（兌換花掉的也算），到 levels[n-1] 升到 Lv n。
 * Lv1～11 照「兌換件數」時期的成長曲線訂（倍率節奏不變）；Lv13～15 是三封遠方來信的條件，
 * 和慶功宴（累計約 160）、誓約（累計約 316）之間的間隔差不多（npm run happiness 的主線時間表）。
 * 心願、休息、觸碰、每日互動的開心度都乘上它；成就與禮物固定。
 */
export const BOND = {
  renownPerLevel: 0.1,
  bondPerLevel: 0.15,
  levels: [3, 7, 12, 20, 28, 38, 50, 62, 78, 100, 125, 160, 200, 240, 280],
};

export const TALENT_FX = {
  cheerPrice: 0.2,
  attunementChance: 0.1,
  telepathyCapHours: 72,
  celebrationPrice: 3,
  feverSeconds: 60,
  feverMult: 10,
};

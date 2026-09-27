// 開心度兌換（企劃書第 8 章）

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

export const HAPPINESS_ITEMS: HappinessItem[] = [
  // Tier 1：休息室擴建（多一格擺設位，禮物擺出來才有效果）
  {
    id: 'decor_slot_3', tier: 1, kind: 'slot', name: '休息室擴建：坐墊旁', icon: 'icon_decor_slot',
    desc: '在坐墊旁的地板多一個擺設位，可以多擺一件禮物。', cost: fixed(3), max: 1,
  },
  {
    id: 'decor_slot_4', tier: 1, kind: 'slot', name: '休息室擴建：樓梯邊', icon: 'icon_decor_slot',
    desc: '在樓梯邊多一個擺設位，可以多擺一件禮物。', cost: fixed(8), max: 1,
  },
  // Tier 2：服裝
  {
    id: 'outfit_maid', tier: 2, kind: 'outfit', name: '典雅女僕裝', icon: 'lumia_chibi_maid_idle',
    desc: '待機時會鞠躬。指派在櫃台時：售價 +50%；客人每次少買 20%，但照原本的數量付錢。', cost: fixed(15), max: 1,
  },
  {
    id: 'outfit_pajama', tier: 2, kind: 'outfit', name: '星空絨毛睡衣', icon: 'lumia_chibi_pajama_idle',
    desc: '互動時會揉眼睛打哈欠。穿著時離線，離線效率 +20%（基礎 50%，最多 90%）。', cost: fixed(20), max: 1,
  },
  {
    id: 'outfit_gardener', tier: 2, kind: 'outfit', name: '花園精靈圍裙裝', icon: 'lumia_chibi_gardener_idle',
    desc: '戴著花冠、會對植物哼歌。指派在溫室時：植物生長速度 +100%。', cost: fixed(25), max: 1,
  },
  {
    id: 'outfit_robe', tier: 2, kind: 'outfit', name: '鍊金大師法袍', icon: 'lumia_chibi_robe_idle',
    desc: '點擊回饋更有自信。指派在大釜區時：熬煮速度 +100%。', cost: fixed(30), max: 1,
  },
  // Tier 3：特權天賦
  {
    id: 'cheer', tier: 3, kind: 'talent', name: '少女的聲援', icon: 'icon_cheer',
    desc: '永久提升藥水售價 +20%（可無限購買，價格遞增）。', cost: (n) => Math.ceil(2 * 1.35 ** n), max: Infinity,
  },
  {
    id: 'attunement', tier: 3, kind: 'talent', name: '魔力同調', icon: 'icon_attunement',
    desc: '雙口冷凝管的雙倍機率 +10%（最多 5 次，價格遞增）。', cost: (n) => 3 + 2 * n, max: 5,
  },
  {
    id: 'green_thumb', tier: 3, kind: 'talent', name: '奇蹟綠手指', icon: 'icon_green_thumb',
    desc: '浮空盆栽（用金幣買的第 4、5 格）的收成量 ×2。', cost: fixed(10), max: 1,
  },
  {
    id: 'telepathy', tier: 3, kind: 'talent', name: '心電感應', icon: 'icon_telepathy',
    desc: '離線收益的計算上限從 12 小時延長到 72 小時，離線效率的衰退也跟著變慢（72 小時才減半）。', cost: fixed(20), max: 1,
  },
  // Tier 4：深層羈絆
  {
    id: 'celebration', tier: 4, kind: 'story', name: '事件：第一次的慶功宴', icon: 'cg_celebration',
    desc: '觸發劇情並解鎖 CG。永久效果：藥水售價 ×3。', cost: fixed(50), max: 1,
  },
  {
    id: 'vow', tier: 4, kind: 'story', name: '事件：星空下的誓言', icon: 'cg_starry_vow',
    desc: '最終劇情。解鎖「狂熱時刻」：每天一次，60 秒內所有生產速度 ×10。', cost: fixed(100), max: 1,
  },
];

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

/** 劇情事件的台詞（CG 美術在 M5 加入） */
export const STORIES: Record<string, { title: string; cg: string; lines: string[] }> = {
  celebration: {
    title: '第一次的慶功宴',
    cg: 'cg_celebration',
    lines: [
      '露米婭：老師老師！今天打烊後可以留一下嗎？',
      '露米婭：鏘鏘～！我用剩下的材料做了蛋糕！雖然…有一點點歪掉。',
      '露米婭：藥水舖能開到現在，全都是老師的功勞。',
      '露米婭：乾杯！敬我們的藥水舖，還有…敬老師！',
      '（從今天起，露米婭充滿自信的笑容讓客人們願意付出三倍的價錢。）',
    ],
  },
  vow: {
    title: '星空下的誓言',
    cg: 'cg_starry_vow',
    lines: [
      '露米婭：老師，今晚的星星好多喔。',
      '露米婭：那天在閣樓翻到您的時候，我還以為只是一本很舊很舊的書。',
      '露米婭：可是您教了我好多好多…不只是配方，還有怎麼相信自己。',
      '露米婭：所以我想跟老師約定——以後也要一直一直，一起經營這間店。',
      '露米婭：……謝謝您，老師。',
      '（魔導書的書頁發出溫暖的光芒。「狂熱時刻」已解鎖！）',
    ],
  },
};

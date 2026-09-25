// 開心度兌換（企劃書第 8 章）

export type HappinessKind = 'furniture' | 'outfit' | 'talent' | 'story';

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
  // Tier 1：家具
  {
    id: 'slime_doll', tier: 1, kind: 'furniture', name: 'Q版史萊姆娃娃', icon: 'furn_slime_doll',
    desc: '露米婭休息時會拿起來揉捏。休息室開心度產出 +0.05/小時。', cost: fixed(1), max: 1,
  },
  {
    id: 'gramophone', tier: 1, kind: 'furniture', name: '復古留聲機', icon: 'furn_gramophone',
    desc: '輕快的音樂讓精靈們更有幹勁。植物生長與大釜熬煮速度 +10%。', cost: fixed(3), max: 1,
  },
  {
    id: 'tea_set', tier: 1, kind: 'furniture', name: '高級魔法紅茶組', icon: 'furn_tea_set',
    desc: '提神醒腦。露米婭工作時體力消耗 -50%。', cost: fixed(5), max: 1,
  },
  // Tier 2：服裝
  {
    id: 'outfit_maid', tier: 2, kind: 'outfit', name: '典雅女僕裝', icon: 'lumia_chibi_maid_idle',
    desc: '待機時會鞠躬。指派在櫃台時：顧客耐心 +200%、售價 +50%。', cost: fixed(15), max: 1,
  },
  {
    id: 'outfit_pajama', tier: 2, kind: 'outfit', name: '星空絨毛睡衣', icon: 'lumia_chibi_pajama_idle',
    desc: '互動時會揉眼睛打哈欠。穿著時離線，離線金幣結算 ×2。', cost: fixed(20), max: 1,
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
    desc: '雙口冷凝管的雙倍機率 +5%（最多 10 次）。', cost: fixed(5), max: 10,
  },
  {
    id: 'green_thumb', tier: 3, kind: 'talent', name: '奇蹟綠手指', icon: 'icon_green_thumb',
    desc: '解鎖溫室的 2 個浮空盆栽格。', cost: fixed(10), max: 1,
  },
  {
    id: 'telepathy', tier: 3, kind: 'talent', name: '心電感應', icon: 'icon_telepathy',
    desc: '離線收益上限從 12 小時延長到 72 小時。', cost: fixed(20), max: 1,
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

export const TALENT_FX = {
  gramophoneSpeed: 0.1,
  teaDrainMult: 0.5,
  slimeRestPerHour: 0.05,
  cheerPrice: 0.2,
  attunementChance: 0.05,
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

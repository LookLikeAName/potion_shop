// 看板娘露米婭：指派、體力、互動（企劃書第 7 章）

export type Assignment = 'patrol' | 'greenhouse' | 'cauldron' | 'counter' | 'rest';
/** 會產生效果的工作區域 */
export type WorkZone = 'greenhouse' | 'cauldron' | 'counter';

export const ASSIGNMENTS: Record<Assignment, { name: string; desc: string }> = {
  patrol: { name: '自由活動', desc: '自己在溫室、大釜區、櫃台之間輪流工作，效果跟著所在的區域，一樣會消耗體力' },
  greenhouse: { name: '溫室', desc: '植物生長速度 +25%' },
  cauldron: { name: '大釜區', desc: '熬煮速度（被動與點擊）+25%' },
  counter: { name: '櫃台', desc: '結帳時間 -50%、顧客耐心 +25%' },
  rest: { name: '休息室', desc: '在坐墊上睡覺：體力回復 ×2，並慢慢產出開心度' },
};

export const MASCOT = {
  staminaMax: 100,
  /** 工作中（包含自由活動）每分鐘消耗 */
  workDrainPerMin: 5,
  /** 自由活動時，每隔幾秒換一個區域（最短、最長） */
  patrolSwitchMin: 25,
  patrolSwitchMax: 45,
  /** 休息每分鐘回復（玩家親手放去休息 ×2） */
  restRegenPerMin: 10,
  playerRestMult: 2,
  /** 體力低於此值：疲勞，指派效果減半 */
  tiredBelow: 25,
  tiredFactor: 0.5,

  /** 指派加成（看板娘池 M） */
  greenhouseBonus: 0.25,
  cauldronBonus: 0.25,
  counterPatienceBonus: 0.25,
  counterCheckoutMult: 0.5,

  /** 休息時每小時產出的開心度（家具另計） */
  restHappinessPerHour: 0.05,

  /** 互動能量：上限、每次觸碰消耗、每小時回滿 */
  energyMax: 100,
  touchCost: 5,
  energyRegenPerHour: 100,
  touchReward: 0.03,
  /** 1 秒內觸碰幾下算狂戳 */
  spamTouches: 4,
  dailyBonus: 0.5,
  /** 每日重置時間（本地時間幾點） */
  dayResetHour: 4,
};

export type OutfitId = 'default' | 'maid' | 'pajama' | 'robe';

export const OUTFITS: Record<OutfitId, { name: string; desc: string; item?: string }> = {
  default: { name: '見習魔女服', desc: '露米婭平常的樣子。' },
  maid: { name: '典雅女僕裝', desc: '指派在櫃台時：顧客耐心 +200%、售價 +50%。', item: 'outfit_maid' },
  pajama: { name: '星空絨毛睡衣', desc: '穿著時離線，離線金幣結算 ×2。', item: 'outfit_pajama' },
  robe: { name: '鍊金大師法袍', desc: '指派在大釜區時：熬煮速度 +100%。', item: 'outfit_robe' },
};

export const OUTFIT_BONUS = {
  maidPatience: 2.0,
  maidPrice: 0.5,
  robeBrew: 1.0,
  pajamaOffline: 2,
};

/**
 * 用金幣送禮物給露米婭換開心度（金幣的長期出口）。
 * 每天每種可以送一次；價格 = 目前收入 × N 分鐘（至少 minPrice），後期也一直有意義。
 */
export interface GiftDef {
  id: string;
  name: string;
  icon: string;
  happiness: number;
  /** 價格相當於幾分鐘的收入 */
  minutes: number;
  minPrice: number;
  line: string;
}

export const GIFTS: GiftDef[] = [
  { id: 'snack', name: '手工點心', icon: 'gift_snack', happiness: 0.1, minutes: 2, minPrice: 200, line: '哇！是點心！老師最好了～' },
  { id: 'bouquet', name: '魔法花束', icon: 'gift_bouquet', happiness: 0.2, minutes: 5, minPrice: 1000, line: '好、好漂亮的花…我會好好插在店裡的！' },
  { id: 'hairpin', name: '星光髮飾', icon: 'gift_hairpin', happiness: 0.35, minutes: 10, minPrice: 5000, line: '這是…給我的嗎？我、我會一直戴著的！' },
];

/** 收入追蹤的平滑時間（秒） */
export const INCOME_SMOOTHING = 120;

export type TouchPart = 'head' | 'cheek';
export type Reaction = 'headpat' | 'poke' | 'panic' | 'shy' | 'idle';

/** 台詞（隨機挑一句） */
export const LINES: Record<Reaction | 'daily' | 'exhausted' | 'woke', string[]> = {
  idle: [
    '老師，今天也一起加油吧！',
    '紅心草今天長得特別有精神呢～',
    '嘿嘿，看我用湯勺彈一段！',
  ],
  headpat: [
    '嘿嘿，只要老師這樣摸摸，剛才背錯配方的事情好像就忘記了呢！',
    '唔…好舒服…再一下下就好…',
    '老師的手是暖暖的魔力呢。',
  ],
  poke: [
    '唔…正在計算利潤呢，老師不要害我分心啦！',
    '臉、臉頰不是用來戳的啦！',
    '哼！…才、才沒有在偷笑呢。',
  ],
  panic: [
    '等等！哇啊！太快了太快了！會變笨的啦！',
    '老、老師冷靜一點！',
  ],
  shy: [
    '今天已經被摸夠多了啦…老師也該工作了！',
    '再摸下去今天就什麼都做不了了啦…',
  ],
  daily: [
    '老師早安！今天也請多多指教！',
    '啊，老師來了！我今天也會努力的！',
  ],
  exhausted: ['呼啊…好睏…我去坐墊上躺一下下就好…'],
  woke: ['睡飽了！我回去工作囉！'],
};

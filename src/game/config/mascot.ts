import { localized, localizedList } from '../../i18n';

// 看板娘露米婭：指派、體力、互動（企劃書第 7 章）

export type Assignment = 'patrol' | 'greenhouse' | 'cauldron' | 'counter' | 'rest';
/** 會產生效果的工作區域 */
export type WorkZone = 'greenhouse' | 'cauldron' | 'counter';

/** 名稱與說明在語言檔 assign.<id>.name／desc */
export const ASSIGNMENTS = Object.fromEntries(
  (['patrol', 'greenhouse', 'cauldron', 'counter', 'rest'] as const).map((a) => [a, localized({}, `assign.${a}`, ['name', 'desc'])]),
) as Record<Assignment, { name: string; desc: string }>;

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
  /** 在櫃台時的售價加成（看板娘池 M，和女僕裝相加） */
  counterPriceBonus: 0.25,

  /**
   * 開著頁面時，休息每小時產出的開心度基礎值：再乘上開心度倍率，擺出史萊姆娃娃另 ×1.5。
   * 模擬：開著頁面不操作的掛機約 36 小時、關掉頁面（每小時上線一次）約 51 小時、積極玩家約 11 小時兌換完
   */
  restHappinessPerHour: 2.9,
  /**
   * 離線（關掉頁面）時休息的開心度另外算，比在線少很多：剛離開每小時 offlineRestPerHour（同樣乘開心度倍率與史萊姆娃娃），
   * 隨離開的時間線性降到 offlineHappyHours 時為 0，之後不再增加（心電感應延長的是金幣的離線上限，開心度最多一樣只算到這裡）。
   * 開著頁面掛機才算在玩，關掉的懲罰比較重
   */
  offlineRestPerHour: 0.63,
  offlineHappyHours: 24,

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

export type OutfitId = 'default' | 'maid' | 'pajama' | 'gardener' | 'robe';

/** 名稱與說明在語言檔 outfit.<id>.name／desc；item = 開心度兌換項目 */
const OUTFIT_ITEMS: Record<OutfitId, string | undefined> = {
  default: undefined, maid: 'outfit_maid', pajama: 'outfit_pajama', gardener: 'outfit_gardener', robe: 'outfit_robe',
};
export const OUTFITS = Object.fromEntries(
  (Object.keys(OUTFIT_ITEMS) as OutfitId[]).map((o) => [o, localized({ item: OUTFIT_ITEMS[o] }, `outfit.${o}`, ['name', 'desc'])]),
) as Record<OutfitId, { name: string; desc: string; item?: string }>;

export const OUTFIT_BONUS = {
  maidPrice: 0.5,
  /** 女僕裝在櫃台：客人每次少買的比例（照原本的數量付錢，省下的藥水可以囤著或交給收購箱） */
  maidQtyCut: 0.2,
  robeBrew: 1.0,
  /** 花園精靈圍裙裝在溫室：生長速度 +100%（和指派的 +25% 同一池相加） */
  gardenerGrowth: 1.0,
  /** 睡衣：離線效率 +20%（加在基礎 50% 上，不再直接乘金幣） */
  pajamaOffline: 0.2,
};

/** 收入追蹤的平滑時間（秒） */
export const INCOME_SMOOTHING = 120;

export type TouchPart = 'head' | 'cheek';
export type Reaction = 'headpat' | 'poke' | 'panic' | 'shy' | 'idle';

/** 台詞（隨機挑一句；語言檔 lines.*） */
export const LINES: Record<Reaction | 'daily' | 'exhausted' | 'woke', string[]> = localizedList(
  {}, 'lines', ['idle', 'headpat', 'poke', 'panic', 'shy', 'daily', 'exhausted', 'woke'],
);

/** 場景中頭上的自言自語泡泡：多久冒一次（秒，最短～最長）、停留多久 */
export const MUTTER = {
  intervalMin: 14,
  intervalMax: 28,
  sleepIntervalMin: 9,
  sleepIntervalMax: 18,
  duration: 4.2,
};

/** 自言自語的台詞：一般、各工作區、各服裝、疲勞、夢話，以及看店裡狀況的台詞 */
export const MUTTER_LINES = localizedList(
  {
    outfit: localizedList({}, 'mutter.outfit', ['default', 'maid', 'pajama', 'robe', 'gardener'] satisfies OutfitId[]),
    /** 走到休息室擺出來的禮物旁邊時 */
    furniture: localizedList({}, 'mutter.furniture', [
      'snack', 'slime_doll', 'gramophone', 'tea_set', 'bouquet', 'hairpin', 'star_lamp', 'music_box', 'dream_catcher', 'crystal_ball',
    ]) as Record<string, string[]>,
  },
  'mutter',
  // 一般、各工作區、自由活動、疲勞、體力滿了在休息室、夢話、看店裡狀況（缺原料、櫃台排滿、狂熱、市場熱度高／低）、
  // 兌換「星空下的誓約」之後才會說的（vow）
  ['global', 'greenhouse', 'cauldron', 'counter', 'patrol', 'tired', 'relax', 'sleep', 'starved', 'crowded', 'fever', 'marketHot', 'marketCold', 'vow'],
);

// 全域平衡參數。對應企劃書 v2，數值為初版，待平衡模擬後調整。

/** 邏輯 tick 長度（秒） */
export const TICK = 0.1;

export const SLOT_COUNT = 5;
export const INITIAL_OPEN_SLOTS = 3;

/** 盆栽/大釜等級里程碑，每達到一個速度 ×2 */
export const MILESTONES = [10, 25, 50, 100] as const;
export const LEVEL_COST_GROWTH = 1.15;

/** 階級倍率 TM（升級價格用） */
export const TIER_MULT: Record<1 | 2 | 3, number> = { 1: 1, 2: 20, 3: 400 };

export const CUSTOMER = {
  /** 基礎來客間隔（秒）。買不到也沒有懲罰，所以初期讓客人來得勤一點 */
  interval: 8,
  /** 開新遊戲後第一位顧客多快出現 */
  firstDelay: 3,
  qtyMin: 1,
  qtyMax: 3,
  queueMax: 3,
  /** 結帳時間（秒） */
  checkout: 1.5,
  /** 急單基礎耐心（秒） */
  patience: 20,
  rushBonus: 1.5,
  /**
   * 一張訂單有幾種藥水的機率（依已解鎖的配方數）。
   * 例：解鎖 3 種時 60% 單品、30% 兩種、10% 三種。
   */
  linesChance: { 1: [1], 2: [0.65, 0.35], 3: [0.6, 0.3, 0.1] } as Record<number, number[]>,
  /** 時間到只湊到部分訂單：整筆價格倍率 */
  partialPriceMult: 0.8,
};

export const OFFLINE = {
  baseCapHours: 12,
  /** 離線模擬步長（秒） */
  step: 10,
  /** 超過這麼久沒有執行，就改用離線結算並顯示報告（秒） */
  reportThreshold: 60,
};

export const CLICK_CAP_PER_SEC = 15;

/** 機率類效果相加後的上限 */
export const CHANCE_CAP = 0.75;

/** 盆栽相鄰關係（星銀澆水壺）：前排 0-1-2 相連，兩個浮空盆栽 3-4 相連 */
export const SLOT_NEIGHBORS: number[][] = [[1], [0, 2], [1], [4], [3]];

/**
 * 豐收：每次收成有機率額外多產出（只會多、不會少）。
 * 等級仍然是「保證產量」，隨機只提供正面驚喜。
 */
export const BOUNTY = {
  chance: 0.2,
  /** 額外產出比例（至少 +1） */
  bonus: 0.5,
};

export const UPGRADE_FX = {
  /** 星銀澆水壺：相鄰盆栽獲得點擊推進量的比例 */
  starCanSplash: 0.5,
  shearsChance: 0.05,
  shearsYield: 3,
  /** 龍息風箱：連點幾下、每下間隔上限（秒） */
  comboClicks: 10,
  comboGap: 1,
  boilTime: 5,
  boilMult: 6,
  /** 極速沸騰結束後的冷卻（秒） */
  boilCooldown: 15,
  condenserChance: 0.15,
  drunkChance: 0.05,
  drunkMult: 2,
  bellMaxCharges: 3,
  bellRecharge: 30,
  /**
   * 商會收購箱：Lv1 收購價 30%，每級 +10%。
   * 顧客數量有上限，收購箱讓「產量」一定能轉成收入；平衡模擬顯示沒有它時前期收入會卡死。
   */
  crateBasePct: 0.3,
  crateStepPct: 0.1,
  /** 收購箱多久結算一次（秒） */
  crateInterval: 1,
  reserveDefault: 20,
  reserveMax: 999,
  /** 原料保留量：足夠所有大釜熬幾輪（依目前等級自動計算） */
  materialReserveRounds: 3,
  materialReserveMin: 20,
  /** 過勞精靈工會合約：離線時模擬每秒點擊次數 */
  contractCps: 5,
};

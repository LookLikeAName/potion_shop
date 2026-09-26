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
  /** 店裡同時最多幾位客人（已經結帳完、正在離開的不算） */
  queueMax: 5,
  /**
   * 結帳（一次只服務一位）：客人不管怎樣都要先走到櫃台（固定時間，升級不影響），再結帳。
   * walkToCounter 要和畫面上排隊第一位到櫃台的距離一致（layout 的 QUEUE_X[0] - CHECKOUT_X），walkSpeed 是走路速度（px/秒）。
   * 結帳時間 payTime 隨算盤松鼠等級縮短，滿級時 0：走到櫃台的同時就完成訂單。
   */
  walkToCounter: 100,
  /** 新客人從畫面外（門口）走到隊伍最前面的距離（px，layout 的 OFFSTAGE_X - QUEUE_X[0]） */
  doorToQueue: 400,
  walkSpeed: 260,
  payTime: 2.1,
  /**
   * 顧客會買走產量的幾成（其餘給收購箱）：基礎 shareBase，每秒服務人數比 shareRefThroughput 每翻倍 +sharePerDoubling，最高 shareMax。
   * 每張訂單的大小由這個比例與實際產量反推，所以需求永遠跟著產量走、原料分配不均也不會一直湊不齊。
   * 平衡模擬比較過：訂單固定或只乘大釜等級時，產量遠超過顧客，收入 96–99% 來自收購箱；
   * 訂單乘上「幾秒的產量」時，前期客人太少只買走一成多、後期結帳太快又需求過量常常湊不齊。
   */
  shareBase: 0.4,
  sharePerDoubling: 0.1,
  shareRefThroughput: 0.125,
  shareMax: 0.9,
  /** 每秒產量的平滑時間（秒） */
  rateSmoothing: 20,
  /** 客人只點有在產的藥水：產量至少是最多那種的這個比例（庫存有的也可以點）；最多那種低於 minOrderRate 時全部都可以點 */
  orderableShare: 0.05,
  minOrderRate: 0.2,
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
  /** 宣傳海報：每級顧客買走的比例 +3%（最多 10 級） */
  posterSharePerLevel: 0.03,
  /** 配方精煉：每級每份原料需求 +50%、售價 +60% */
  refineInputPerLevel: 0.5,
  refinePricePerLevel: 0.6,
  /** 奇蹟綠手指：浮空盆栽收成量倍率 */
  greenThumbYield: 2,
  /** 魔力園藝手套／符文攪拌棒：每級讓親手點擊額外推進幾秒的自動產量 */
  clickBonusSecPerLevel: 0.01,
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
   * 商會收購箱：Lv1 收購價 30%，每級 +10%（最高 60%）。前期產量小時是重要收入，中後期顧客訂單跟著產量成長，收購箱只接住多的。
   * 顧客數量有上限，收購箱讓「產量」一定能轉成收入；平衡模擬顯示沒有它時前期收入會卡死。
   */
  crateBasePct: 0.3,
  crateStepPct: 0.1,
  /** 收購箱多久結算一次（秒） */
  crateInterval: 1,
  /**
   * 收購箱的保留量都用百分比設定（設 0% 就全部收購，上限 keepMax）：
   * 藥水 100% = 店裡站滿、每人都點最多時的量，預設 100%；
   * 原料 100% = 所有大釜以目前等級熬 1 輪的量，預設 300%（3 輪），設了保留時至少保留 materialReserveMin 份。
   */
  potionKeepDefault: 100,
  materialKeepDefault: 300,
  keepMax: 100_000,
  materialReserveMin: 20,
  /** 過勞精靈工會合約：離線時模擬每秒點擊次數 */
  contractCps: 5,
};

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
  shareMax: 1.1,
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

/**
 * 市場熱度：顧客訂單量再乘上這個倍率。每 holdMin～holdMax 秒隨機換一個 min～max 的目標，花約 smoothing 秒慢慢靠過去。
 * 熱度高時需求超過產量（有囤貨才能全價賣掉），低時產量有剩（囤起來或給收購箱），讓保留量與收購箱有取捨。
 * 離線時取平均 1。
 */
export const MARKET = {
  min: 0.7,
  max: 1.4,
  holdMin: 30,
  holdMax: 90,
  smoothing: 12,
};

export const OFFLINE = {
  baseCapHours: 12,
  /**
   * 離線效率：離線結算只拿到模擬產出的這個比例（睡衣、捕夢網各加一點，最多 efficiencyMax），
   * 再乘上時間衰退 0.5^(離開時間 ÷ 計算上限)：離開到計算上限時剩一半。
   * 讓離線永遠比實際在線遊玩少，「久久開一次」不會比常回來划算
   */
  baseEfficiency: 0.5,
  efficiencyMax: 0.9,
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
  /**
   * 盆栽採收量曲線：每輪 = 等級 × (1 + 等級 / 這個值)；0 = 每級固定 +1。
   * 平衡模擬比較（精煉全滿時紅心草供給 ÷ 大釜全速需求）：0 → 10–13%、25 → 50–65%、20 → 75–85%、15 → 90–100%。
   * 選 20：精煉還是會造成一點原料短缺、讓玩家回頭升盆栽，但不會永遠追不上。
   */
  potYieldCurve: 20,
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
   * 收購箱的保留量用「幾秒份」設定（設 0 秒就全部收購，上限 keepMaxSec）：
   * 藥水 = 顧客幾秒的需求量（至少留店裡站滿、每人都點最多時的量），預設 30 秒；
   * 原料 = 所有大釜全速熬煮幾秒的用量（至少 1 輪、至少 materialReserveMin 份），預設 60 秒。
   * 原本用百分比（藥水 100% = 店裡站滿、原料 100% = 大釜熬 1 輪）：後期大釜每秒熬上千輪，
   * 原料就算設到上限也只撐 1–4 秒，收購箱一打開就把庫存收光，極速沸騰時馬上斷料
   */
  potionKeepSec: 30,
  materialKeepSec: 60,
  keepMaxSec: 3600,
  /** 保留秒數的調整量（小、大） */
  keepStepSec: [10, 60] as const,
  materialReserveMin: 20,
  /** 過勞精靈工會合約：離線時模擬每秒點擊次數 */
  contractCps: 5,
};

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
};

export const OFFLINE = {
  baseCapHours: 12,
  /** 離線模擬步長（秒） */
  step: 10,
  /** 超過這麼久沒有執行，就改用離線結算並顯示報告（秒） */
  reportThreshold: 60,
};

export const CLICK_CAP_PER_SEC = 15;

// 場景座標（邏輯解析度 1920×1080）。換上正式背景後依實際圖片微調這裡即可。

export const W = 1920;
export const H = 1080;

export const ZONES = {
  restRoom: { x: 30, y: 92, w: 1290, h: 290, label: '休息室', color: 0x6b4a3a },
  loft: { x: 1320, y: 92, w: 570, h: 290, label: '閣樓', color: 0x5a3e30 },
  greenhouse: { x: 30, y: 400, w: 560, h: 650, label: '溫室', color: 0x3d6a4c },
  workshop: { x: 590, y: 400, w: 680, h: 650, label: '大釜工作區', color: 0x4d4548 },
  shop: { x: 1270, y: 400, w: 620, h: 650, label: '店面', color: 0x7a5334 },
};

// 以下座標對齊正式背景 bg_dollhouse_main（1920×1080）上的地板標記。

/**
 * 盆栽底部中心點：前 3 格站在溫室地板標記上（初始開放），
 * 後 2 格是飄浮在溫室半空中的魔法盆栽（隱藏格），落在前排之間的上方。
 */
export const SLOT_POS = [
  { x: 186, y: 910 },
  { x: 308, y: 910 },
  { x: 433, y: 910 },
  { x: 247, y: 650 },
  { x: 372, y: 650 },
];
/** 從第幾格開始是浮空盆栽 */
export const FLOATING_SLOT_FROM = 3;
/** 佔位背景用的層架高度 */
export const SHELF_Y = 662;

/** 爐台上的三個大釜標記 */
export const CAULDRON_X = [706, 817, 922];
export const CAULDRON_Y = 808;

export const COUNTER = { x: 1140, y: 810, w: 360, h: 175 };
export const DOOR = { x: 1650, y: 520, w: 270, h: 420 };
export const QUEUE_X = [1570, 1705, 1840];
export const QUEUE_Y = 995;
export const OFFSTAGE_X = 2060;

// 露米婭的工作點：櫃台左側，以及站在盆栽/大釜前方偏右（背影），不完全擋住物件
export const LUMIA_COUNTER = { x: 1090, y: 990 };
export const LUMIA_AT_POT = { dx: 44, dy: 50 };
/**
 * 大釜在爐台上而且彼此很近，她只站在大釜列的兩側（最左那口的左邊、最右那口的右邊），
 * 避免擠在中間擋住兩口大釜。
 */
export const LUMIA_AT_CAULDRON = { dx: 80, dy: 70 };

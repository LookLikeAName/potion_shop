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

/** 盆栽底部中心點；前 3 格在地板，後 2 格（隱藏格）在層架上 */
export const SLOT_POS = [
  { x: 140, y: 960 },
  { x: 310, y: 960 },
  { x: 480, y: 960 },
  { x: 225, y: 660 },
  { x: 395, y: 660 },
];
export const SHELF_Y = 662;

export const CAULDRON_X = [715, 930, 1145];
export const CAULDRON_Y = 965;

export const COUNTER = { x: 1290, y: 870, w: 200, h: 170 };
export const DOOR = { x: 1790, y: 760, w: 100, h: 290 };
export const QUEUE_X = [1560, 1665, 1770];
export const QUEUE_Y = 1030;
export const OFFSTAGE_X = 2050;

// M3 做指派系統前，先讓她在二樓休息室走動，避免擋住大釜
export const LUMIA_Y = 368;
export const LUMIA_RANGE: [number, number] = [540, 1250];

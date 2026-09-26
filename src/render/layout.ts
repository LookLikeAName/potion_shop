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

/**
 * 買了升級後出現在場景裡的道具（底部中心點）。
 * 招牌掛在牆上，錨點是上緣。
 */
export const PROPS = {
  starCan: { x: 512, y: 925 },
  owl: { x: 1255, y: 846 },
  bell: { x: 1462, y: 848 },
  diffuser: { x: 1088, y: 704 },
  signboard: { x: 1598, y: 540 },
};

/** 二樓倉庫的收購箱：每種藥水一個、原料一個（底部中心點） */
export const CRATE_POS = {
  glow: { x: 1115, y: 378 },
  focus: { x: 1255, y: 378 },
  elixir: { x: 1395, y: 378 },
  materials: { x: 1535, y: 378 },
};

/** 拖曳露米婭時的指派區域（放開時落在哪一區就指派到哪裡） */
export const ASSIGN_ZONES = {
  rest: { x: 30, y: 80, w: 950, h: 330 },
  patrol: { x: 980, y: 80, w: 910, h: 330 },
  greenhouse: { x: 30, y: 420, w: 560, h: 640 },
  cauldron: { x: 590, y: 420, w: 470, h: 640 },
  counter: { x: 1060, y: 420, w: 860, h: 640 },
} as const;

/** 各樓層角色站立的地板高度 */
export const FLOOR_2F_Y = 372;
export const FLOOR_1F_Y = 985;
/** 1F 與 2F 的分界：目標跨過這條線就用魔法瞬移 */
export const FLOOR_SPLIT_Y = 600;

/** 休息室：坐墊上睡覺的位置 */
export const REST_POS = { x: 405, y: 336 };

/** 休息室家具（開心度兌換後出現） */
export const FURNITURE = {
  slime_doll: { x: 530, y: 350 },
  gramophone: { x: 705, y: 232 },
  tea_set: { x: 790, y: 232 },
};

// 露米婭的工作點：櫃台左側，以及站在盆栽/大釜前方偏右（背影），不完全擋住物件
export const LUMIA_COUNTER = { x: 1090, y: 990 };
export const LUMIA_AT_POT = { dx: 44, dy: 50 };
/**
 * 大釜在爐台上而且彼此很近，她只站在大釜列的兩側（最左那口的左邊、最右那口的右邊），
 * 避免擠在中間擋住兩口大釜。
 */
export const LUMIA_AT_CAULDRON = { dx: 80, dy: 70 };

// 禮物圖鑑與休息室擺設（企劃書 8.0）
// 用金幣買禮物送露米婭：每種只能送一次，價格固定。送的時候給一次開心度，
// 之後變成休息室的擺設，擺出來才有效果。

/** 擺出來時的效果種類 */
export type GiftFx =
  | 'restRegen' | 'restHappy' | 'speed' | 'drain' | 'orderQty'
  | 'assist' | 'wishTime' | 'click' | 'offline' | 'wishReward';

export interface GiftDef {
  id: string;
  name: string;
  /** 圖示資源 ID（也是擺在休息室時的圖） */
  icon: string;
  /** 金幣價格（固定，不會漲） */
  price: number;
  /** 送的時候給的開心度（固定，不乘倍率） */
  happiness: number;
  fx: GiftFx;
  /** 擺出來的效果 */
  desc: string;
  /** 圖鑑上的介紹（送出後才看得到） */
  intro: string;
  line: string;
}

/** 依價格排序：從開店沒多久到後期要存好幾個小時的收入 */
export const GIFTS: GiftDef[] = [
  {
    id: 'snack', name: '手工點心', icon: 'gift_snack', price: 1e3, happiness: 1, fx: 'restRegen',
    desc: '休息時體力回復 +50%。', intro: '親手烤的愛心餅乾配上草莓馬卡龍，用粉紅緞帶綁得漂漂亮亮。露米婭說要留到打烊後再吃，結果當天就吃完了。',
    line: '哇！是點心！老師最好了～',
  },
  {
    id: 'music_box', name: '精靈音樂盒', icon: 'gift_music_box', price: 2e4, happiness: 2, fx: 'click',
    desc: '老師親手點擊的效果 +50%（盆栽與大釜）。', intro: '打開蓋子，小精靈人偶就會在上面轉圈跳舞。聽著它的曲子工作，手上的動作也變得輕快起來。',
    line: '小精靈在裡面跳舞耶！轉一圈、再轉一圈～',
  },
  {
    id: 'slime_doll', name: 'Q版史萊姆娃娃', icon: 'furn_slime_doll', price: 1e6, happiness: 2, fx: 'restHappy',
    desc: '休息時的開心度產出 +50%。', intro: '照著溫室裡那隻愛睡覺的史萊姆做的布偶，捏起來軟綿綿、還會發出噗啾聲。午睡時的最佳夥伴。',
    line: '軟綿綿的！我可以抱著它睡覺嗎？',
  },
  {
    id: 'gramophone', name: '復古留聲機', icon: 'furn_gramophone', price: 5e7, happiness: 3, fx: 'speed',
    desc: '輕快的音樂讓精靈們更有幹勁：植物生長與大釜熬煮速度 +15%。', intro: '從舊貨市集淘來的古董留聲機，喇叭像一朵盛開的花。放起輕快的曲子，連精靈們都跟著打拍子。',
    line: '有音樂的話，工作起來也會特別開心呢♪',
  },
  {
    id: 'tea_set', name: '高級魔法紅茶組', icon: 'furn_tea_set', price: 2e9, happiness: 4, fx: 'drain',
    desc: '提神醒腦：露米婭工作時體力消耗 -50%。', intro: '繪著紫色花紋的高級瓷器茶組，泡出來的魔法紅茶會冒出愛心形狀的蒸氣。喝一口就精神百倍。',
    line: '好香的紅茶…老師要一起喝一杯嗎？',
  },
  {
    id: 'bouquet', name: '魔法花束', icon: 'gift_bouquet', price: 5e10, happiness: 5, fx: 'orderQty',
    desc: '花香讓客人心情變好：顧客每次購買的數量 +20%。', intro: '會微微發光的粉彩花束，花瓣間飄著小小的光點。插在店裡，整間店都香香的。',
    line: '好、好漂亮的花…我會好好插在店裡的！',
  },
  {
    id: 'hairpin', name: '星光髮飾', icon: 'gift_hairpin', price: 1.5e11, happiness: 6, fx: 'assist',
    desc: '露米婭戴著它工作特別有自信：指派到工作區的加成 ×1.5。', intro: '新月與星星造型的金色髮飾，鑲著一顆小小的紫水晶。露米婭戴上之後，照鏡子照了好久。',
    line: '這是…給我的嗎？我、我會一直戴著的！',
  },
  {
    id: 'star_lamp', name: '許願星燈', icon: 'gift_star_lamp', price: 4e11, happiness: 7, fx: 'wishTime',
    desc: '小心願的時限 +30%。', intro: '星星形狀的小桌燈，綁著好幾條許願緞帶。據說對著它說出心願，星星就會幫忙實現。',
    line: '把願望說給星星聽，就會實現喔！',
  },
  {
    id: 'dream_catcher', name: '月光捕夢網', icon: 'gift_dream_catcher', price: 1e12, happiness: 7, fx: 'offline',
    desc: '離線收益 +50%。', intro: '新月形框架的捕夢網，垂著羽毛與星星珠子。掛在床邊，壞夢都會被網子抓走。',
    line: '有了它，晚上一定會做好夢的…呼啊～',
  },
  {
    id: 'crystal_ball', name: '占星水晶球', icon: 'gift_crystal_ball', price: 3e12, happiness: 8, fx: 'wishReward',
    desc: '小心願的開心度獎勵 +25%。', intro: '黃銅底座上的占星水晶球，裡面飄著粉紫色的星霧。露米婭說她在裡面看見了很美好的未來。',
    line: '我看到了…老師和我，一直一直在這間店裡！',
  },
];

export const GIFT_MAP: Record<string, GiftDef> = Object.fromEntries(GIFTS.map((g) => [g.id, g]));

/** 各效果的數值 */
export const GIFT_FX = {
  restRegen: 1.5,
  restHappy: 1.5,
  speed: 0.15,
  drain: 0.5,
  orderQty: 1.2,
  assist: 1.5,
  wishTime: 1.3,
  click: 1.5,
  offline: 1.5,
  wishReward: 1.25,
};

/** 休息室擺設位：一開始 2 格（層架上），開心度兌換「休息室擴建」各 +1 格 */
export const DECOR = {
  baseSlots: 2,
  maxSlots: 4,
  /** 擴建擺設位的開心度兌換項目（依序開放第 3、4 格） */
  slotItems: ['decor_slot_3', 'decor_slot_4'],
};

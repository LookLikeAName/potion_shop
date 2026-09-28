// 禮物圖鑑與休息室擺設（企劃書 8.0）
// 用金幣買禮物送露米婭：每種只能送一次，價格固定。送的時候給一次開心度，
// 之後變成休息室的擺設，擺出來才有效果。

import { localized } from '../../i18n';

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

const GIFT_TEXT = ['name', 'desc', 'intro', 'line'] as const;
type GiftText = (typeof GIFT_TEXT)[number];

/** 依價格排序：從開店沒多久到後期要存好幾個小時的收入 */
const RAW_GIFTS: Omit<GiftDef, GiftText>[] = [
  {
    id: 'snack', icon: 'gift_snack', price: 1e3, happiness: 1, fx: 'restRegen',
  },
  {
    id: 'music_box', icon: 'gift_music_box', price: 2e4, happiness: 2, fx: 'click',
  },
  {
    id: 'slime_doll', icon: 'gift_slime_doll', price: 1e6, happiness: 2, fx: 'restHappy',
  },
  {
    id: 'gramophone', icon: 'gift_gramophone', price: 5e7, happiness: 3, fx: 'speed',
  },
  {
    id: 'tea_set', icon: 'gift_tea_set', price: 2e9, happiness: 4, fx: 'drain',
  },
  {
    id: 'bouquet', icon: 'gift_bouquet', price: 5e10, happiness: 5, fx: 'orderQty',
  },
  {
    id: 'hairpin', icon: 'gift_hairpin', price: 1.5e11, happiness: 6, fx: 'assist',
  },
  {
    id: 'star_lamp', icon: 'gift_star_lamp', price: 4e11, happiness: 7, fx: 'wishTime',
  },
  {
    id: 'dream_catcher', icon: 'gift_dream_catcher', price: 1e12, happiness: 7, fx: 'offline',
  },
  {
    id: 'crystal_ball', icon: 'gift_crystal_ball', price: 3e12, happiness: 8, fx: 'wishReward',
  },
];

/** 文字在語言檔 gift.<id>.name／desc／intro／line */
export const GIFTS: GiftDef[] = RAW_GIFTS.map((g) => localized(g, `gift.${g.id}`, GIFT_TEXT));

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
  /** 月光捕夢網：離線效率 +20%（加在基礎 50% 上） */
  offline: 0.2,
  wishReward: 1.25,
};

/** 休息室擺設位：一開始 2 格（層架上），開心度兌換「休息室擴建」各 +1 格 */
export const DECOR = {
  baseSlots: 2,
  maxSlots: 4,
  /** 擴建擺設位的開心度兌換項目（依序開放第 3、4 格） */
  slotItems: ['decor_slot_3', 'decor_slot_4'],
};

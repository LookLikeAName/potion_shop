// 突發事件與特殊訪客（企劃書第 9 章）
// 所有事件都是正向獎勵：無視或錯過沒有任何懲罰。只在在線、分頁在前景時觸發。
import { localized, localizedList, t, tl } from '../../i18n';

export type EventId =
  | 'goblin' | 'dew' | 'raincloud' | 'butterfly'
  | 'sneeze' | 'bubble' | 'perfect_heat' | 'apprentice'
  | 'hero' | 'merchant' | 'princess' | 'guild_rush'
  | 'dream' | 'letter' | 'fortune' | 'meteor' | 'slime';

/** 事件發生的區域：露米婭指派在該區時出現率 ×2；any = 不分區 */
export type EventZone = 'greenhouse' | 'cauldron' | 'counter' | 'rest' | 'any';

/**
 * 操作方式：
 * tap = 點中目標 goal 下就完成；count = 限時內點越多越好（至少 1 下就算完成）；
 * drag = 拖到盆栽或大釜上；timing = 看準時機點；choice = 三選一
 */
export type EventKind = 'tap' | 'count' | 'drag' | 'timing' | 'choice';

export interface EventDef {
  id: EventId;
  name: string;
  zone: EventZone;
  /** 0 常見、1 少見、2 稀有 */
  rarity: 0 | 1 | 2;
  kind: EventKind;
  /** 限時（秒） */
  time: number;
  /** tap：要點幾下；count：最多算幾下；timing：幾次機會 */
  goal: number;
  /** 圖鑑縮圖與場景圖的資源 ID */
  icon: string;
  /** 出現時的提示（事件橫幅） */
  prompt: string;
  /** 還沒遇過時圖鑑上的模糊提示 */
  hint: string;
  /** 完成後圖鑑上的小故事 */
  story: string;
  /** 露米婭的感想 */
  lumia: string;
  /** 擺出這件禮物時出現率 ×2 */
  decor?: string;
}

const EVENT_TEXT = ['name', 'prompt', 'hint', 'story', 'lumia'] as const;

const RAW_EVENTS: Omit<EventDef, (typeof EVENT_TEXT)[number]>[] = [
  // ---------- 溫室 ----------
  {
    id: 'goblin', zone: 'greenhouse', rarity: 0, kind: 'tap', time: 8, goal: 5,
    icon: 'npc_goblin', decor: 'snack',
  },
  {
    id: 'dew', zone: 'greenhouse', rarity: 0, kind: 'tap', time: 20, goal: 3,
    icon: 'evt_dew',
  },
  {
    id: 'raincloud', zone: 'greenhouse', rarity: 1, kind: 'drag', time: 25, goal: 1,
    icon: 'evt_raincloud', decor: 'bouquet',
  },
  {
    id: 'butterfly', zone: 'greenhouse', rarity: 1, kind: 'count', time: 15, goal: 5,
    icon: 'evt_butterfly', decor: 'music_box',
  },
  // ---------- 大釜 ----------
  {
    id: 'sneeze', zone: 'cauldron', rarity: 0, kind: 'count', time: 8, goal: 8,
    icon: 'evt_spark',
  },
  {
    id: 'bubble', zone: 'cauldron', rarity: 0, kind: 'tap', time: 9, goal: 1,
    icon: 'evt_bubble',
  },
  {
    id: 'perfect_heat', zone: 'cauldron', rarity: 1, kind: 'timing', time: 15, goal: 3,
    icon: 'evt_heat', decor: 'gramophone',
  },
  {
    id: 'apprentice', zone: 'cauldron', rarity: 1, kind: 'drag', time: 25, goal: 1,
    icon: 'evt_apprentice',
  },
  // ---------- 櫃台 ----------
  {
    id: 'hero', zone: 'counter', rarity: 1, kind: 'count', time: 10, goal: 40,
    icon: 'npc_rich_hero',
  },
  {
    id: 'merchant', zone: 'counter', rarity: 0, kind: 'choice', time: 30, goal: 1,
    icon: 'evt_merchant',
  },
  {
    id: 'princess', zone: 'counter', rarity: 2, kind: 'tap', time: 30, goal: 1,
    icon: 'evt_princess', decor: 'bouquet',
  },
  {
    id: 'guild_rush', zone: 'counter', rarity: 0, kind: 'tap', time: 12, goal: 1,
    icon: 'evt_guild',
  },
  // ---------- 休息室與特殊 ----------
  {
    id: 'dream', zone: 'rest', rarity: 0, kind: 'tap', time: 20, goal: 3,
    icon: 'evt_dream', decor: 'dream_catcher',
  },
  {
    // 寄信人與內容待定（配合之後的背景故事），先用佔位文字
    id: 'letter', zone: 'any', rarity: 2, kind: 'tap', time: 20, goal: 1,
    icon: 'evt_letter', decor: 'tea_set',
  },
  {
    id: 'fortune', zone: 'any', rarity: 1, kind: 'choice', time: 30, goal: 1,
    icon: 'evt_fortune', decor: 'crystal_ball',
  },
  {
    id: 'meteor', zone: 'any', rarity: 2, kind: 'count', time: 15, goal: 10,
    icon: 'evt_meteor', decor: 'star_lamp',
  },
  {
    id: 'slime', zone: 'any', rarity: 1, kind: 'tap', time: 12, goal: 3,
    icon: 'evt_slime', decor: 'slime_doll',
  },
];

/** 文字在語言檔 event.<id>.name／prompt／hint／story／lumia */
export const EVENTS: EventDef[] = RAW_EVENTS.map((e) => localized(e, `event.${e.id}`, EVENT_TEXT));

export const EVENT_MAP = Object.fromEntries(EVENTS.map((e) => [e.id, e])) as Record<EventId, EventDef>;

/** 稀有度名稱（語言檔 event.rarity.0～2） */
export const RARITY_NAMES: readonly string[] = localized([] as string[], 'event.rarity', ['0', '1', '2']);

/** 事件出現時露米婭說的話 */
export const EVENT_LINES = localizedList({}, 'event.lines', ['start']);

export const EVENT = {
  /** 檢定間隔：固定 checkMin 秒 + 隨機 0–checkRand 秒（只算前景時間）：8–12 分鐘，平均約 10 分鐘一次 */
  checkMin: 480,
  checkRand: 240,
  /** 每次檢定出現事件的機率（一小時 6 次檢定 × 60% ≈ 3.6 個事件） */
  chance: 0.6,
  /** 權重：稀有度基礎、沒完成過、指派區域、相關擺設 */
  weights: [10, 5, 2] as const,
  unseenMult: 3,
  zoneMult: 2,
  decorMult: 2,
  /** 各稀有度的個別冷卻（秒，前景時間） */
  cooldown: [600, 900, 1800] as const,
  /** 圖鑑：每收集這麼多個（和全部收齊時）收入 +incomePerMilestone */
  milestoneEvery: 6,
  incomePerMilestone: 0.03,
  /** 每個事件第一次完成時的開心度（× 開心度倍率） */
  firstHappy: 0.1,
  /** 秒收入的下限（剛開店收入很少時） */
  minIncome: 1,
  /** 原料報酬的下限（每種） */
  minMaterial: 10,
};

/** 各事件的數值 */
export const EVENT_FX = {
  goblin: { materialSec: 120, growth: 2, buffSec: 90 },
  dew: { yieldSec: 120, growth: 3, buffSec: 90 },
  raincloud: { growth: 3, buffSec: 120 },
  butterfly: { growth: 2, buffSec: 120 },
  /** 每接住一顆火花：所有大釜熬煮 ×2 多 12 秒 */
  sneeze: { brew: 2, secPerHit: 12 },
  bubble: { brewSec: 120 },
  /** 每命中一次：這口大釜 60 秒內每輪都是雙倍 */
  perfect_heat: { secPerHit: 60 },
  apprentice: { brew: 3, buffSec: 120 },
  /** 每點一下 5 秒收入；點滿 hypeAt 下市場熱度拉到 hype */
  hero: { incomePerHit: 5, hypeAt: 30, hype: 1.4, buffSec: 120 },
  princess: { incomeSec: 360 },
  guild_rush: { buffSec: 90 },
  dream: { happy: 0.1 },
  letter: { incomeSec: 420 },
  /** 每顆流星 20 秒收入，全部點到再加倍 */
  meteor: { incomePerHit: 20 },
  slime: { materialSec: 240 },
};

/** 事件簿用：一句話簡介、出現條件（語言檔 event.<id>.summary／need） */
export const EVENT_INFO = Object.fromEntries(
  RAW_EVENTS.map((e) => [e.id, localized({}, `event.${e.id}`, ['summary', 'need'])]),
) as Record<EventId, { summary: string; need: string }>;

/** 事件簿用：完成後能得到的東西（語言檔 event.<id>.reward，數值跟著設定帶入） */
export function eventRewardText(id: EventId): string[] {
  const key = `event.${id}.reward`;
  switch (id) {
    case 'merchant':
      return Object.values(MERCHANT_OFFERS).map((o) => t('event.reward.item', o)).concat(tl(key));
    case 'fortune':
      return Object.values(FORTUNE_CARDS).map((c) => t('event.reward.item', c)).concat(tl(key));
    case 'hero':
      return tl(key, { ...EVENT_FX.hero, goal: EVENT_MAP.hero.goal });
    default:
      return tl(key, EVENT_FX[id]);
  }
}

/** 事件簿用：操作方式（語言檔 event.kind.*） */
export const KIND_NAMES: Record<EventKind, string> = localized({}, 'event.kind', ['tap', 'count', 'drag', 'timing', 'choice']);

/** 流浪行商的商品（每次隨機三樣；文字在語言檔 merchant.<id>.name／desc） */
export type MerchantOffer = 'gold' | 'growth' | 'brew' | 'arrival' | 'materials';
const MERCHANT_ICONS: Record<MerchantOffer, string> = {
  gold: 'icon_gold', growth: 'upg_fertilizer', brew: 'upg_warm_circle', arrival: 'upg_diffuser', materials: 'item_redheart',
};
export const MERCHANT_OFFERS = Object.fromEntries(
  (Object.keys(MERCHANT_ICONS) as MerchantOffer[]).map((k) => [k, localized({ icon: MERCHANT_ICONS[k] }, `merchant.${k}`, ['name', 'desc'])]),
) as Record<MerchantOffer, { name: string; desc: string; icon: string }>;
export const MERCHANT_FX = { goldSec: 120, mult: 2, buffSec: 120, materialSec: 180 };

/** 占卜婆婆的牌（翻開前看不到是哪一張；文字在語言檔 fortune.<id>.name／desc） */
export type FortuneCard = 'sun' | 'star' | 'moon' | 'wheel';
export const FORTUNE_CARDS = Object.fromEntries(
  (['sun', 'star', 'moon', 'wheel'] as const).map((k) => [k, localized({}, `fortune.${k}`, ['name', 'desc'])]),
) as Record<FortuneCard, { name: string; desc: string }>;
export const FORTUNE_FX = { speed: 2, price: 1.5, arrival: 2, buffSec: 180, goldSec: 300 };

/**
 * 三封來信（依序寄來；收齊之後再來的信隨機重讀一封）。
 * 內容待定：之後配合完整的背景故事（露米婭的出身、和老師認識的契機、老師為什麼是魔導書）撰寫，
 * 和兩個開心度劇情、開頭場景串在一起。目前先用佔位文字（語言檔 letter.<n>.title／lines）。
 */
export const LETTERS: { title: string; lines: string[]; bond: number }[] = [2, 4, 6].map((bond, k) =>
  localizedList(localized({ bond }, `letter.${k + 1}`, ['title']), `letter.${k + 1}`, ['lines']),
);

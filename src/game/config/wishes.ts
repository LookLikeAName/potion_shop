// 露米婭的小心願：限時任務（企劃書 7.4）
// 只出玩家能主動推進、可以重複的題目；失敗沒有懲罰。

export type WishKind = 'harvest' | 'brew' | 'crate' | 'clickPot' | 'clickCauldron';

export interface WishRarity {
  name: string;
  chance: number;
  /** 題目量倍率 */
  goal: number;
  /** 獎勵倍率 */
  reward: number;
}

export const WISH = {
  /** 開放後第一個心願的等待秒數；之後每次結束的冷卻（秒） */
  firstDelay: 60,
  cooldownMin: 180,
  cooldownMax: 300,
  /** 找不到可以出的題目時，隔多久再試 */
  retryDelay: 30,
  /** 時限（秒），隨機挑一個 */
  times: [180, 240, 300],
  /**
   * 目標量 = 放置時每秒產量 × 時限 × 係數：完全放置大約只做得到 1/係數（約七八成），
   * 稍微點一點、或把露米婭派過去就能完成
   */
  goalCoef: { harvest: 1.3, brew: 1.3, crate: 1.3 } as Record<'harvest' | 'brew' | 'crate', number>,
  /** 點擊題：每秒幾下 × 時限 */
  clicksPerSec: 0.6,
  /** 出題權重 */
  weights: { harvest: 3, brew: 3, crate: 1.5, clickPot: 1.25, clickCauldron: 1.25 } as Record<WishKind, number>,

  /** 獎勵 = 基礎 × 類型係數 × 稀有度 × (時限 / 基準時限) × 開心度倍率 × 占星水晶球 */
  baseReward: 0.24,
  clickRewardMult: 1.2,
  refTime: 240,
  rarities: [
    { name: '心願', chance: 0.8, goal: 1, reward: 1 },
    { name: '大心願', chance: 0.15, goal: 1.5, reward: 2 },
    { name: '閃亮心願', chance: 0.05, goal: 2, reward: 3 },
  ] as WishRarity[],
  /** 時間到時進度達到這個比例，給原獎勵的 consolation 倍 */
  consolationAt: 0.5,
  consolation: 0.25,
};

/** 露米婭說出心願時的台詞（{what} 換成題目） */
export const WISH_LINES = {
  new: ['老師老師，我有一個小小的心願…', '欸嘿嘿，可以拜託老師一件事嗎？', '突然好想看到那個喔～'],
  done: ['哇！真的實現了！謝謝老師！', '老師最棒了！我好開心～', '嘿嘿，願望成真的感覺真好！'],
  fail: ['沒關係～下次再一起努力！', '差一點點…不過老師辛苦了！'],
};

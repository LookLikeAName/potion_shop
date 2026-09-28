// 效能設定（設定頁可以調整）：只影響畫面，不影響遊戲計算。存在這台裝置的瀏覽器裡，不跟著存檔走。
import { signal } from '@preact/signals';

/** 盆栽與大釜的特效：完整／精簡（只留基本光暈、粒子少）／最少（沒有光暈與粒子） */
export type EffectLevel = 'full' | 'lite' | 'min';
/** 飄字數量：多（原本）／中／少／只顯示重要的（收入、暴擊、雙倍等大字） */
export type FloatLevel = 'many' | 'normal' | 'few' | 'key';
/** 畫質：標準／省電（降低繪製解析度） */
export type Quality = 'high' | 'low';

export interface PerfSettings {
  effects: EffectLevel;
  floats: FloatLevel;
  fps: 60 | 30;
  quality: Quality;
}

const KEY = 'idle-potion-shop/perf';
const DEFAULTS: PerfSettings = { effects: 'full', floats: 'many', fps: 60, quality: 'high' };

function load(): PerfSettings {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? '{}') as Partial<PerfSettings>;
    return { ...DEFAULTS, ...raw };
  } catch {
    return { ...DEFAULTS };
  }
}

export const perf = signal<PerfSettings>(load());

export function setPerf(patch: Partial<PerfSettings>): void {
  perf.value = { ...perf.value, ...patch };
  try {
    localStorage.setItem(KEY, JSON.stringify(perf.value));
  } catch {
    // 存不了：這次開著的期間照樣有效
  }
}

/** 粒子數量的倍率（飄字另外算）；光環只在完整時出現 */
export const PARTICLE_SCALE: Record<EffectLevel, number> = { full: 1, lite: 0.35, min: 0 };

/**
 * 高速模式的「裝飾」等級：完整照實際分級；精簡最多 1 級（光暈，沒有環繞星星、彩虹、閃光）；最少 0（沒有裝飾）。
 * 進度條、植物循環這些「表示很快」的表現照實際分級，不受影響
 */
export function decoTier<T extends number>(tier: T): T | 0 | 1 {
  const e = perf.value.effects;
  if (e === 'min') return 0;
  if (e === 'lite') return Math.min(tier, 1) as T | 0 | 1;
  return tier;
}

/** 各飄字等級：同時上限、同一來源同時上限、同一來源每幀新增上限；key = 只顯示一定要顯示的字 */
export const FLOAT_LIMITS: Record<FloatLevel, { total: number; perSource: number; perFrame: number; keyOnly: boolean }> = {
  many: { total: 250, perSource: 14, perFrame: 3, keyOnly: false },
  normal: { total: 120, perSource: 8, perFrame: 2, keyOnly: false },
  few: { total: 50, perSource: 4, perFrame: 1, keyOnly: false },
  key: { total: 40, perSource: 3, perFrame: 1, keyOnly: true },
};

/** 省電畫質的繪製解析度倍率 */
export const LOW_QUALITY_SCALE = 0.6;

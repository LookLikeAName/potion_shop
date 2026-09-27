// 折線圖的縱軸範圍與刻度（純計算，方便測試）

/**
 * y 軸範圍：
 * - zero：從 0 到最大值（速率）
 * - signed：可以是負的，0 在中間（淨變化）
 * - fit：貼著資料的最小～最大值（庫存：數量很大、變化很小時也看得出起伏）
 */
export type YMode = 'zero' | 'signed' | 'fit';

/** 取好讀的間距：1、2、2.5、5 × 10ⁿ（至少 minStep） */
function niceStep(v: number, minStep = 0): number {
  if (!(v > 0)) return Math.max(1, minStep);
  const p = 10 ** Math.floor(Math.log10(v));
  const f = v / p;
  const n = f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10;
  return Math.max(n * p, minStep);
}

/** 依模式算出 y 軸範圍與三條刻度 */
export function yRange(mode: YMode, values: number[], yMax?: number): { lo: number; hi: number; ticks: number[] } {
  const min = Math.min(...values);
  const max = Math.max(...values);
  if (mode === 'fit') {
    // 庫存這類數量：刻度至少間隔 1 而且是整數（浮點誤差不算小數）；其他至少是數值的千分之一
    const integer = values.every((v) => Math.abs(v - Math.round(v)) < 1e-3);
    let step = niceStep((max - min) / 2, integer ? 1 : Math.max(Math.abs(max) * 1e-3, 1e-6));
    if (integer) step = Math.ceil(step);
    let lo = Math.floor(min / step + 1e-9) * step;
    let hi = Math.ceil(max / step - 1e-9) * step;
    // 幾乎沒變化時：以目前的值為中心上下各留一格，線畫在中間
    if (hi - lo < step * 2 - 1e-9) {
      const mid = Math.round((min + max) / 2 / step) * step;
      lo = mid - step;
      hi = mid + step;
    }
    // 數量不會是負的：別讓縱軸跑到 0 以下
    if (lo < 0 && min >= 0) {
      hi -= lo;
      lo = 0;
    }
    const half = (lo + hi) / 2;
    return { lo, hi, ticks: [lo, integer ? Math.round(half) : half, hi] };
  }
  if (mode === 'signed' && min < 0) {
    const lo = -niceStep(-min);
    const hi = max > 0 ? niceStep(max) : 0;
    return { lo, hi, ticks: hi > 0 ? [lo, 0, hi] : [lo, lo / 2, 0] };
  }
  const hi = yMax ?? niceStep(Math.max(0, max));
  return { lo: 0, hi, ticks: [0, hi / 2, hi] };
}

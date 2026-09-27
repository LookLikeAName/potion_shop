import { describe, expect, it } from 'vitest';
import { yRange } from '../src/ui/chartScale';

describe('折線圖縱軸', () => {
  it('速率從 0 開始，上限取好讀的數字', () => {
    expect(yRange('zero', [0, 3.2, 1])).toEqual({ lo: 0, hi: 5, ticks: [0, 2.5, 5] });
    expect(yRange('zero', [0.2], 1).hi).toBe(1);
  });

  it('淨變化有負值時 0 在中間', () => {
    const r = yRange('signed', [-3, 1.5]);
    expect(r.lo).toBe(-5);
    expect(r.hi).toBe(2);
    expect(r.ticks).toContain(0);
    // 全部是正的就跟速率一樣從 0 開始
    expect(yRange('signed', [0.4, 2]).lo).toBe(0);
  });

  it('庫存貼著資料範圍：數量很大、變化很小也看得出起伏', () => {
    const r = yRange('fit', [1_234_560, 1_234_567, 1_234_590]);
    expect(r.lo).toBeGreaterThan(1_234_000);
    expect(r.hi).toBeLessThan(1_235_000);
    expect(r.hi - r.lo).toBeLessThanOrEqual(100);
    for (const t of r.ticks) expect(Number.isInteger(t)).toBe(true);
  });

  it('庫存沒變化（含浮點誤差）時線在中間，刻度是整數且不會小於 0', () => {
    const r = yRange('fit', [5, 5.0000001, 4.9999999]);
    expect(r).toEqual({ lo: 4, hi: 6, ticks: [4, 5, 6] });
    expect(yRange('fit', [0, 0]).lo).toBe(0);
  });
});

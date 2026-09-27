import { describe, expect, it } from 'vitest';
import { MASCOT, MUTTER_LINES } from '../src/game/config/mascot';
import { formatFull } from '../src/game/format';
import { pickMutter } from '../src/game/mutter';
import { createInitialState } from '../src/game/state';
import { isRelaxing, isSleeping } from '../src/game/stats';

describe('休息室：體力滿了就不睡覺', () => {
  it('被指派到休息室：體力沒滿時睡覺，滿了就悠閒地晃（說放鬆的話，不說夢話）', () => {
    const s = createInitialState();
    s.mascot.assignment = 'rest';
    s.mascot.stamina = 50;
    expect(isSleeping(s)).toBe(true);
    expect(isRelaxing(s)).toBe(false);
    s.mascot.stamina = MASCOT.staminaMax;
    expect(isSleeping(s)).toBe(false);
    expect(isRelaxing(s)).toBe(true);
    for (let k = 0; k < 40; k++) {
      expect(MUTTER_LINES.sleep).not.toContain(pickMutter(s, () => (k + 0.5) / 40));
    }
  });

  it('累倒自動休息時照樣睡到起床，不算悠閒', () => {
    const s = createInitialState();
    s.mascot.autoRest = true;
    s.mascot.stamina = MASCOT.staminaMax;
    expect(isRelaxing(s)).toBe(false);
  });
});

describe('完整數字', () => {
  it('加千分位、不縮寫；小數字保留一位小數', () => {
    expect(formatFull(12_345_678)).toBe('12,345,678');
    expect(formatFull(1234.9)).toBe('1,234');
    expect(formatFull(0.45)).toBe('0.5');
    expect(formatFull(7)).toBe('7');
  });
});

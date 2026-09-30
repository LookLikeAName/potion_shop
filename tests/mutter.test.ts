import { describe, expect, it } from 'vitest';
import { MUTTER_LINES } from '../src/game/config/mascot';
import { pickMutter } from '../src/game/mutter';
import { createInitialState } from '../src/game/state';

/** 抽很多次，收集所有可能出現的台詞 */
function sample(s: ReturnType<typeof createInitialState>): Set<string> {
  const out = new Set<string>();
  for (let k = 0; k < 400; k++) out.add(pickMutter(s, () => (k + 0.5) / 400));
  return out;
}

describe('露米婭自言自語', () => {
  it('睡覺時只說夢話', () => {
    const s = createInitialState();
    s.mascot.assignment = 'rest';
    s.mascot.stamina = 40; // 體力沒滿才會睡覺（滿了會在休息室悠閒地晃）
    for (const line of sample(s)) expect(MUTTER_LINES.sleep).toContain(line);
  });

  it('工作時混合目前工作區、服裝與一般台詞，不會說別區的台詞或夢話', () => {
    const s = createInitialState();
    s.mascot.assignment = 'greenhouse';
    s.mascot.outfit = 'maid';
    s.mascot.stamina = 100;
    s.materials.redheart = 1e6; // 大釜不缺料
    const lines = sample(s);
    expect([...lines].some((l) => MUTTER_LINES.greenhouse.includes(l))).toBe(true);
    expect([...lines].some((l) => MUTTER_LINES.outfit.maid.includes(l))).toBe(true);
    expect([...lines].some((l) => MUTTER_LINES.global.includes(l))).toBe(true);
    for (const l of lines) {
      expect(MUTTER_LINES.cauldron).not.toContain(l);
      expect(MUTTER_LINES.sleep).not.toContain(l);
      expect(MUTTER_LINES.tired).not.toContain(l);
      expect(MUTTER_LINES.outfit.robe).not.toContain(l);
    }
  });

  it('誓約的台詞：兌換「星空下的誓約」之後才會出現（工作與放鬆時），睡覺時不會說', () => {
    const s = createInitialState();
    s.mascot.assignment = 'greenhouse';
    s.mascot.stamina = 100;
    s.materials.redheart = 1e6;
    const has = () => [...sample(s)].some((l) => MUTTER_LINES.vow.includes(l));
    expect(has()).toBe(false);
    s.redeemed.vow = 1;
    expect(has()).toBe(true);
    s.mascot.assignment = 'rest'; // 體力滿了：在休息室放鬆
    expect(has()).toBe(true);
    s.mascot.stamina = 40; // 睡覺：只說夢話
    expect(has()).toBe(false);
  });

  it('疲勞、大釜缺料、狂熱時刻時會出現對應的台詞', () => {
    const s = createInitialState();
    s.mascot.assignment = 'cauldron';
    s.mascot.stamina = 5;
    s.materials.redheart = 0;
    s.feverLeft = 30;
    const lines = [...sample(s)];
    expect(lines.some((l) => MUTTER_LINES.tired.includes(l))).toBe(true);
    expect(lines.some((l) => MUTTER_LINES.starved.includes(l))).toBe(true);
    expect(lines.some((l) => MUTTER_LINES.fever.includes(l))).toBe(true);
  });
});

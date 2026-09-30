// 露米婭的自言自語：依她現在在做什麼、穿什麼、店裡的狀況挑一句（純邏輯，畫面只負責顯示）
import { CUSTOMER } from './config/balance';
import { MUTTER_LINES } from './config/mascot';
import { missingInputs } from './sim';
import type { GameState } from './state';
import { isRelaxing, isResting, isTired, workZone } from './stats';

/** 從一堆（權重, 台詞表）裡抽一句 */
function pickWeighted(groups: [number, string[]][], rng: () => number): string {
  const live = groups.filter(([w, lines]) => w > 0 && lines.length > 0);
  const total = live.reduce((n, [w]) => n + w, 0);
  let r = rng() * total;
  for (const [w, lines] of live) {
    if (r < w) return lines[Math.floor((r / w) * lines.length)];
    r -= w;
  }
  const last = live[live.length - 1][1];
  return last[last.length - 1];
}

/**
 * 挑一句自言自語。睡覺時只說夢話、體力滿了在休息室晃時說放鬆的話；工作時混合：
 * 店裡狀況（有才會出現、權重最高）、目前的工作區、疲勞、服裝、一般台詞。
 */
export function pickMutter(s: GameState, rng: () => number = Math.random): string {
  const L = MUTTER_LINES;
  // 兌換「星空下的誓約」之後：工作與放鬆時偶爾會說起誓約與老師
  const vow = (s.redeemed.vow ?? 0) > 0 ? 2 : 0;
  if (isRelaxing(s)) return pickWeighted([[3, L.relax], [1, L.outfit[s.mascot.outfit]], [1, L.global], [vow, L.vow]], rng);
  if (isResting(s)) return pickWeighted([[1, L.sleep]], rng);
  const zone = workZone(s);
  const starved = s.cauldrons.some((c) => c.batch === 0 && missingInputs(s, c).length > 0);
  const crowded = s.customers.length >= CUSTOMER.queueMax && zone !== 'counter';
  return pickWeighted([
    [s.feverLeft > 0 ? 5 : 0, L.fever],
    [starved && zone !== 'counter' ? 2 : 0, L.starved],
    [crowded ? 2 : 0, L.crowded],
    [s.market.value >= 1.2 ? 2 : 0, L.marketHot],
    [s.market.value <= 0.8 ? 2 : 0, L.marketCold],
    [isTired(s) ? 4 : 0, L.tired],
    [zone ? 3 : 0, zone ? L[zone] : []],
    [s.mascot.assignment === 'patrol' ? 1 : 0, L.patrol],
    [2, L.outfit[s.mascot.outfit]],
    [2, L.global],
    [vow, L.vow],
  ], rng);
}

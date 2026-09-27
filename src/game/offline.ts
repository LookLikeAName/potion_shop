import { OFFLINE } from './config/balance';
import { GIFT_FX } from './config/gifts';
import { TALENT_FX } from './config/happiness';
import { MASCOT, OUTFIT_BONUS } from './config/mascot';
import { MATERIAL_IDS, type MaterialId } from './config/plants';
import { POTION_IDS, type PotionId } from './config/recipes';
import { finishSale, tick, type SimContext } from './sim';
import type { GameState } from './state';
import { decorFx } from './stats';

export interface OfflineReport {
  /** 實際離開秒數 */
  seconds: number;
  /** 被計入的秒數（受上限限制） */
  simulated: number;
  capped: boolean;
  /** 穿著睡衣，金幣已 ×2 */
  pajama: boolean;
  /** 擺出月光捕夢網，金幣已 ×1.5 */
  dream: boolean;
  gold: number;
  materials: Record<MaterialId, number>;
  potions: Record<PotionId, number>;
  happiness: number;
  /** 離開超過開心度的計算上限（之後休息不再增加開心度） */
  happyCapped: boolean;
}

export function offlineCapSeconds(s: GameState): number {
  const hours = (s.redeemed.telepathy ?? 0) > 0 ? TALENT_FX.telepathyCapHours : OFFLINE.baseCapHours;
  return hours * 3600;
}

export function simulateOffline(s: GameState, seconds: number): OfflineReport {
  const cap = offlineCapSeconds(s);
  const simulated = Math.max(0, Math.min(seconds, cap));
  const before = {
    gold: s.gold,
    happiness: s.happiness,
    materials: { ...s.materials },
    potions: { ...s.potions },
  };
  // 期望值模式：機率類效果取平均
  const ctx: SimContext = { rng: () => 0.5, offline: true, emit: () => {} };

  // 已經備好貨的客人直接成交，等待中的客人離開（無懲罰）
  for (const c of [...s.customers]) if (c.status !== 'waiting') finishSale(s, c, ctx);
  s.customers = [];

  let left = simulated;
  while (left > 1e-9) {
    const dt = Math.min(OFFLINE.step, left);
    ctx.offlineElapsed = simulated - left;
    tick(s, dt, ctx);
    left -= dt;
  }

  // 星空絨毛睡衣：穿著時離線金幣 ×2；擺出月光捕夢網再 ×1.5
  const pajama = s.mascot.outfit === 'pajama';
  const dream = decorFx(s, 'offline');
  const mult = (pajama ? OUTFIT_BONUS.pajamaOffline : 1) * (dream ? GIFT_FX.offline : 1);
  if (mult > 1) {
    const extra = (s.gold - before.gold) * (mult - 1);
    s.gold += extra;
    s.stats.goldEarned += extra;
  }

  const diff = <K extends string>(keys: K[], a: Record<K, number>, b: Record<K, number>) =>
    Object.fromEntries(keys.map((k) => [k, b[k] - a[k]])) as Record<K, number>;

  return {
    seconds,
    simulated,
    capped: seconds > cap,
    pajama,
    dream,
    gold: s.gold - before.gold,
    happiness: s.happiness - before.happiness,
    happyCapped: simulated >= MASCOT.offlineHappyHours * 3600,
    materials: diff(MATERIAL_IDS, before.materials, s.materials),
    potions: diff(POTION_IDS, before.potions, s.potions),
  };
}

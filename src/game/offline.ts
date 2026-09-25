import { OFFLINE } from './config/balance';
import { MATERIAL_IDS, type MaterialId } from './config/plants';
import { POTION_IDS, type PotionId } from './config/recipes';
import { finishSale, tick, type SimContext } from './sim';
import type { GameState } from './state';

export interface OfflineReport {
  /** 實際離開秒數 */
  seconds: number;
  /** 被計入的秒數（受上限限制） */
  simulated: number;
  capped: boolean;
  gold: number;
  materials: Record<MaterialId, number>;
  potions: Record<PotionId, number>;
  happiness: number;
}

export function offlineCapSeconds(_s: GameState): number {
  // 心電感應（開心度特權）在 M3 加入後延長到 72 小時
  return OFFLINE.baseCapHours * 3600;
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

  // 正在結帳的客人直接成交，等待中的客人離開（無懲罰）
  for (const c of [...s.customers]) if (c.status === 'checkout') finishSale(s, c, ctx);
  s.customers = [];

  let left = simulated;
  while (left > 1e-9) {
    const dt = Math.min(OFFLINE.step, left);
    tick(s, dt, ctx);
    left -= dt;
  }

  const diff = <K extends string>(keys: K[], a: Record<K, number>, b: Record<K, number>) =>
    Object.fromEntries(keys.map((k) => [k, b[k] - a[k]])) as Record<K, number>;

  return {
    seconds,
    simulated,
    capped: seconds > cap,
    gold: s.gold - before.gold,
    happiness: s.happiness - before.happiness,
    materials: diff(MATERIAL_IDS, before.materials, s.materials),
    potions: diff(POTION_IDS, before.potions, s.potions),
  };
}

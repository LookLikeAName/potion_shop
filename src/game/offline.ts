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
  /** 穿著星空絨毛睡衣（離線效率 +20%） */
  pajama: boolean;
  /** 擺出月光捕夢網（離線效率 +20%） */
  dream: boolean;
  /** 離線效率（睡衣、捕夢網算進去，時間衰退之前） */
  efficiency: number;
  /** 這次離開期間的平均效率（含時間衰退） */
  avgEfficiency: number;
  /** 效率減半的時間（= 計算上限，秒） */
  halfLife: number;
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

/** 離線效率（時間衰退之前）：基礎 50%，睡衣 +20%、月光捕夢網 +20%，最多 90% */
export function offlineEfficiency(s: GameState): number {
  const pajama = s.mascot.outfit === 'pajama' ? OUTFIT_BONUS.pajamaOffline : 0;
  const dream = decorFx(s, 'offline') ? GIFT_FX.offline : 0;
  return Math.min(OFFLINE.efficiencyMax, OFFLINE.baseEfficiency + pajama + dream);
}

/** 時間衰退：離開 t 秒時的倍率 0.5^(t ÷ 計算上限)，離開到計算上限時剩一半（心電感應讓衰退變慢） */
export function offlineDecay(s: GameState, t: number): number {
  return 0.5 ** (t / offlineCapSeconds(s));
}

export function simulateOffline(s: GameState, seconds: number): OfflineReport {
  const cap = offlineCapSeconds(s);
  const simulated = Math.max(0, Math.min(seconds, cap));
  // 遊玩時間：實際離開了多久（超過離線收益上限的部分也算）
  s.stats.playAway += Math.max(0, seconds);
  const before = {
    gold: s.gold,
    happiness: s.happiness,
    materials: { ...s.materials },
    potions: { ...s.potions },
  };
  const pajama = s.mascot.outfit === 'pajama';
  const dream = decorFx(s, 'offline');
  const efficiency = offlineEfficiency(s);
  // 期望值模式：機率類效果取平均
  const ctx: SimContext = { rng: () => 0.5, offline: true, emit: () => {} };

  // 已經備好貨的客人直接成交，等待中的客人離開（無懲罰）
  for (const c of [...s.customers]) if (c.status !== 'waiting') finishSale(s, c, ctx);
  s.customers = [];

  // 離線時露米婭在休息室休息：沒有工作區的指派加成（以前休息的同時還算著指派加成）
  const assignment = s.mascot.assignment;
  s.mascot.assignment = 'rest';

  // 每一步的金幣乘上當時的效率（基礎 × 衰退），其餘的收回
  let raw = 0;
  let kept = 0;
  let left = simulated;
  while (left > 1e-9) {
    const dt = Math.min(OFFLINE.step, left);
    const elapsed = simulated - left;
    ctx.offlineElapsed = elapsed;
    const earned = s.stats.goldEarned;
    tick(s, dt, ctx);
    const gain = s.stats.goldEarned - earned;
    const eff = efficiency * offlineDecay(s, elapsed + dt / 2);
    const cut = gain * (1 - eff);
    s.gold -= cut;
    s.stats.goldEarned -= cut;
    raw += gain;
    kept += gain - cut;
    left -= dt;
  }
  s.mascot.assignment = assignment;

  // 庫存的增加也照同樣的效率（不然囤起來回來再賣，就繞過了離線效率）
  const avgEfficiency = raw > 0 ? kept / raw : efficiency * averageDecay(s, simulated);
  for (const m of MATERIAL_IDS) {
    const d = s.materials[m] - before.materials[m];
    if (d > 0) s.materials[m] = before.materials[m] + d * avgEfficiency;
  }
  for (const p of POTION_IDS) {
    const d = s.potions[p] - before.potions[p];
    if (d > 0) s.potions[p] = before.potions[p] + d * avgEfficiency;
  }

  const diff = <K extends string>(keys: K[], a: Record<K, number>, b: Record<K, number>) =>
    Object.fromEntries(keys.map((k) => [k, b[k] - a[k]])) as Record<K, number>;

  return {
    seconds,
    simulated,
    capped: seconds > cap,
    pajama,
    dream,
    efficiency,
    avgEfficiency,
    halfLife: cap,
    gold: s.gold - before.gold,
    happiness: s.happiness - before.happiness,
    happyCapped: simulated >= MASCOT.offlineHappyHours * 3600,
    materials: diff(MATERIAL_IDS, before.materials, s.materials),
    potions: diff(POTION_IDS, before.potions, s.potions),
  };
}

/** 離開 t 秒的平均衰退倍率（沒有金幣收入時顯示用） */
function averageDecay(s: GameState, t: number): number {
  if (t <= 0) return 1;
  const k = Math.LN2 / offlineCapSeconds(s);
  return (1 - Math.exp(-k * t)) / (k * t);
}

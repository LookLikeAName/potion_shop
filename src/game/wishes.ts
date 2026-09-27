// 露米婭的小心願：出題、累積進度、時限與冷卻（純邏輯）
import { GIFT_FX } from './config/gifts';
import { PLANTS, type MaterialId } from './config/plants';
import { RECIPES, type PotionId } from './config/recipes';
import { WISH, type WishKind } from './config/wishes';
import type { SimContext } from './sim';
import type { GameState, WishState } from './state';
import { cauldronOutputPerSec, decorFx, happyMult, potOutputPerSec } from './stats';

/** 開店、賣出第一筆之後才開始許願 */
export function wishesUnlocked(s: GameState): boolean {
  return s.cauldrons.length > 0 && s.stats.customersServed >= 1;
}

/** 心願只在在線、分頁在前景時進行（離線、背景分頁時時間與進度都暫停） */
const live = (ctx: SimContext) => !ctx.offline && ctx.foreground !== false;

export function tickWish(s: GameState, dt: number, ctx: SimContext): void {
  if (!live(ctx) || !wishesUnlocked(s)) return;
  const w = s.wish;
  if (w) {
    w.time -= dt;
    if (w.time <= 0) endWish(s, ctx, false);
    return;
  }
  s.wishTimer -= dt;
  if (s.wishTimer > 0) return;
  s.wish = rollWish(s, ctx.rng);
  if (s.wish) ctx.emit({ type: 'wish', result: 'new', reward: s.wish.reward });
  else s.wishTimer = WISH.retryDelay;
}

/** 記錄進度（收成、熬煮、收購、點擊時呼叫）；達成就立刻完成 */
export function noteWish(
  s: GameState, ctx: SimContext, kind: WishKind, amount: number, item: MaterialId | PotionId | null = null,
): void {
  const w = s.wish;
  if (!w || w.kind !== kind || !live(ctx) || (w.item && w.item !== item)) return;
  w.progress += amount;
  if (w.progress >= w.goal - 1e-9) endWish(s, ctx, true);
}

function endWish(s: GameState, ctx: SimContext, done: boolean): void {
  const w = s.wish!;
  let reward = 0;
  if (done) reward = w.reward;
  else if (w.progress >= w.goal * WISH.consolationAt) reward = w.reward * WISH.consolation;
  s.happiness += reward;
  if (done) s.stats.wishesDone++;
  else s.stats.wishesFailed++;
  s.wish = null;
  s.wishTimer = WISH.cooldownMin + ctx.rng() * (WISH.cooldownMax - WISH.cooldownMin);
  ctx.emit({ type: 'wish', result: done ? 'done' : 'fail', reward });
}

// ---------- 出題 ----------

interface Option {
  kind: WishKind;
  item: MaterialId | PotionId | null;
  /** 放置時每秒的量（點擊題為每秒點擊數） */
  rate: number;
}

/** 目前做得到的題目：有種的原料、有在產的藥水、有在收購的收購箱、有東西可以點 */
export function wishOptions(s: GameState): Option[] {
  const out: Option[] = [];
  const planted = [...new Set(s.slots.map((sl) => sl.plant).filter((m): m is MaterialId => !!m))];
  for (const m of planted) {
    const rate = s.slots.reduce((n, sl, i) => n + (sl.plant === m ? potOutputPerSec(s, i) : 0), 0);
    if (rate > 0) out.push({ kind: 'harvest', item: m, rate });
  }
  for (const c of s.cauldrons) {
    // 放置產能與最近的實際產量取小：原料不夠時大釜會停，題目不能照滿速出
    const cap = cauldronOutputPerSec(s, c);
    const actual = s.potionRate[c.recipe];
    const rate = cap > 0 ? Math.min(cap, actual) : actual;
    if (rate > 0) out.push({ kind: 'brew', item: c.recipe, rate });
  }
  if (s.crateRate > 0) out.push({ kind: 'crate', item: null, rate: s.crateRate });
  if (planted.length > 0) out.push({ kind: 'clickPot', item: null, rate: WISH.clicksPerSec });
  if (s.cauldrons.length > 0) out.push({ kind: 'clickCauldron', item: null, rate: WISH.clicksPerSec });
  return out;
}

/** 取 2 位有效數字（無條件進位），讓題目好讀 */
function niceGoal(n: number): number {
  if (n < 20) return Math.max(1, Math.ceil(n));
  const p = 10 ** (Math.floor(Math.log10(n)) - 1);
  return Math.ceil(n / p) * p;
}

function pick<T>(list: T[], weight: (t: T) => number, r: number): T {
  const total = list.reduce((n, t) => n + weight(t), 0);
  let x = r * total;
  for (const t of list) {
    x -= weight(t);
    if (x < 0) return t;
  }
  return list[list.length - 1];
}

export function rollWish(s: GameState, rng: () => number): WishState | null {
  const options = wishOptions(s);
  if (options.length === 0) return null;
  // 同種類的題目（例如三種原料）平分那一類的權重
  const perKind = (k: WishKind) => options.filter((o) => o.kind === k).length;
  const o = pick(options, (x) => WISH.weights[x.kind] / perKind(x.kind), rng());
  const rarity = WISH.rarities.indexOf(pick(WISH.rarities, (r) => r.chance, rng()));
  const r = WISH.rarities[rarity];
  const base = WISH.times[Math.floor(rng() * WISH.times.length)];
  const timeMax = base * (decorFx(s, 'wishTime') ? GIFT_FX.wishTime : 1);
  const click = o.kind === 'clickPot' || o.kind === 'clickCauldron';
  // 目標量以「沒有星燈」的時限計算：星燈只是多給時間
  const coef = click ? 1 : WISH.goalCoef[o.kind as 'harvest' | 'brew' | 'crate'];
  const goal = niceGoal(o.rate * base * coef * r.goal);
  const reward = WISH.baseReward * (click ? WISH.clickRewardMult : 1) * r.reward * (base / WISH.refTime)
    * happyMult(s) * (decorFx(s, 'wishReward') ? GIFT_FX.wishReward : 1);
  return {
    kind: o.kind, item: o.item, goal, progress: 0, time: timeMax, timeMax, rarity,
    reward: Math.round(reward * 100) / 100,
  };
}

/** 心願的文字說明 */
export function wishText(w: WishState): string {
  const n = w.goal.toLocaleString('en-US');
  switch (w.kind) {
    case 'harvest': return `想要收成 ${n} 個${PLANTS[w.item as MaterialId].name}`;
    case 'brew': return `想看 ${n} 瓶${RECIPES[w.item as PotionId].name}出爐`;
    case 'crate': return `想讓收購箱收購 ${n} 金`;
    case 'clickPot': return `想請老師幫忙照顧盆栽 ${n} 下`;
    case 'clickCauldron': return `想請老師幫忙攪拌大釜 ${n} 下`;
  }
}

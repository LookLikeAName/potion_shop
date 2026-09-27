// 突發事件：檢定、挑選、進行、獎勵與限時增益（純邏輯）
import {
  EVENT, EVENTS, EVENT_FX, EVENT_MAP, FORTUNE_CARDS, FORTUNE_FX, LETTERS, MERCHANT_FX, MERCHANT_OFFERS,
  type EventDef, type EventId, type FortuneCard, type MerchantOffer,
} from './config/events';
import { SLOT_NEIGHBORS } from './config/balance';
import { MASCOT } from './config/mascot';
import { PLANTS, type MaterialId } from './config/plants';
import { RECIPES, type PotionId } from './config/recipes';
import { formatNumber } from './format';
import type { SimContext } from './sim';
import type { ActiveEvent, Buff, BuffKind, GameState } from './state';
import {
  bondLevel, cauldronOutputPerSec, displayedGifts, happyMult, has, hasAnyCrate, isSleeping, potOutputPerSec,
  renownLevel, workZone,
} from './stats';
import { wishesUnlocked } from './wishes';

/** 事件只在在線、分頁在前景時進行 */
const live = (ctx: SimContext) => !ctx.offline && ctx.foreground !== false;

/** 開店、賣出第一筆之後才會有事件（和小心願一樣） */
export const eventsUnlocked = wishesUnlocked;

export function tickEvents(s: GameState, dt: number, ctx: SimContext): void {
  const ev = s.events;
  // 限時增益照真實時間倒數（背景、離線也算）
  if (ev.buffs.length > 0) {
    for (const b of ev.buffs) b.time -= dt;
    ev.buffs = ev.buffs.filter((b) => b.time > 0);
  }
  if (!live(ctx) || ctx.eventHold || !eventsUnlocked(s)) return;

  const a = ev.active;
  if (a) {
    a.time -= dt;
    // 公主離開了（被結帳或走掉）：事件跟著結束
    const gone = a.customer !== undefined && !s.customers.some((c) => c.id === a.customer);
    if (a.time <= 0 || gone) endEvent(s, ctx);
    return;
  }
  for (const id of Object.keys(ev.cooldowns) as EventId[]) {
    const left = (ev.cooldowns[id] ?? 0) - dt;
    if (left > 0) ev.cooldowns[id] = left;
    else delete ev.cooldowns[id];
  }
  ev.timer -= dt;
  if (ev.timer > 0) return;
  // 檢定：固定 10 分鐘 + 隨機 0–10 分鐘一次，成功才出現事件
  ev.timer = EVENT.checkMin + ctx.rng() * EVENT.checkRand;
  if (ctx.rng() >= EVENT.chance) return;
  const def = rollEvent(s, ctx);
  if (def) startEvent(s, def.id, ctx);
}

// ---------- 條件與權重 ----------

const planted = (s: GameState) => s.slots.map((sl, i) => (sl.plant ? i : -1)).filter((i) => i >= 0);
const isNight = (ctx: SimContext) => ctx.hour !== undefined && (ctx.hour >= 19 || ctx.hour < 5);
const displayed = (s: GameState, gift: string) => displayedGifts(s).includes(gift);
/** 有在產出的大釜 */
const producing = (s: GameState) =>
  s.cauldrons.filter((c) => cauldronOutputPerSec(s, c) > 0 || s.potionRate[c.recipe] > 0);

/** 下一封師父的來信需要的羈絆等級（收齊之後維持最後一封的條件） */
function nextLetter(s: GameState) {
  return LETTERS[Math.min(s.events.letters, LETTERS.length - 1)];
}

/** 這個事件現在能不能出現 */
export function eventAvailable(s: GameState, id: EventId, ctx: SimContext): boolean {
  switch (id) {
    case 'goblin': return planted(s).length >= 1;
    case 'dew': return planted(s).length >= 2;
    case 'raincloud': return s.slots.some((sl) => sl.plant && sl.rain > 0);
    case 'butterfly': return planted(s).length >= 4;
    case 'sneeze': return s.cauldrons.some((c) => c.salamander > 0);
    case 'bubble': return producing(s).length > 0;
    case 'perfect_heat': return has(s, 'condenser') && s.cauldrons.length > 0;
    case 'apprentice': return has(s, 'guild_contract') && s.cauldrons.length > 0;
    case 'hero': return renownLevel(s) >= 5 && s.cauldrons.length > 0;
    case 'merchant': return renownLevel(s) >= 3;
    case 'princess':
      return renownLevel(s) >= 9 && s.cauldrons.some((c) => c.recipe === 'elixir')
        && s.customers.some((c) => c.status !== 'serving');
    case 'guild_rush': return hasAnyCrate(s);
    case 'dream': return isSleeping(s);
    case 'letter': return bondLevel(s) >= nextLetter(s).bond;
    case 'fortune': return !!s.gifts.crystal_ball || renownLevel(s) >= 8;
    case 'meteor': return isNight(ctx) || displayed(s, 'star_lamp');
    case 'slime': return displayed(s, 'slime_doll');
  }
}

/** 出現權重：稀有度 × 沒完成過 ×3 × 露米婭在這一區 ×2 × 擺出相關禮物 ×2 */
export function eventWeight(s: GameState, def: EventDef): number {
  let w = EVENT.weights[def.rarity];
  if (!s.events.codex[def.id]?.done) w *= EVENT.unseenMult;
  const zone = workZone(s);
  if ((def.zone === 'rest' && isSleeping(s)) || (zone && def.zone === zone)) w *= EVENT.zoneMult;
  if (def.decor && displayed(s, def.decor)) w *= EVENT.decorMult;
  return w;
}

/** 目前可以出現的事件（不在冷卻中、不是上一個） */
export function eventPool(s: GameState, ctx: SimContext): EventDef[] {
  const ev = s.events;
  const pool = EVENTS.filter((d) => !ev.cooldowns[d.id] && eventAvailable(s, d.id, ctx));
  // 同一個事件不連續出現（只剩它一個時例外）
  const fresh = pool.filter((d) => d.id !== ev.last);
  return fresh.length > 0 ? fresh : pool;
}

export function rollEvent(s: GameState, ctx: SimContext): EventDef | null {
  const pool = eventPool(s, ctx);
  if (pool.length === 0) return null;
  const total = pool.reduce((n, d) => n + eventWeight(s, d), 0);
  let x = ctx.rng() * total;
  for (const d of pool) {
    x -= eventWeight(s, d);
    if (x < 0) return d;
  }
  return pool[pool.length - 1];
}

// ---------- 開始 ----------

const pickOne = <T>(list: T[], rng: () => number): T => list[Math.floor(rng() * list.length)];

function shuffled<T>(list: T[], rng: () => number): T[] {
  const out = [...list];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

export function startEvent(s: GameState, id: EventId, ctx: SimContext): ActiveEvent {
  const def = EVENT_MAP[id];
  const a: ActiveEvent = { id, time: def.time, timeMax: def.time, hits: 0, tries: 0 };
  switch (id) {
    case 'dew': a.slot = pickOne(planted(s), ctx.rng); break;
    case 'bubble': a.recipe = pickOne(producing(s), ctx.rng).recipe; break;
    case 'perfect_heat': {
      const list = producing(s);
      a.recipe = pickOne(list.length > 0 ? list : s.cauldrons, ctx.rng).recipe;
      break;
    }
    case 'butterfly': a.landed = []; break;
    case 'princess': {
      // 還沒走到櫃台的客人裡挑一位
      const list = s.customers.filter((c) => c.status !== 'serving');
      if (list.length > 0) a.customer = pickOne(list, ctx.rng).id;
      break;
    }
    case 'merchant': a.options = shuffled(Object.keys(MERCHANT_OFFERS), ctx.rng).slice(0, 3); break;
    case 'fortune': a.options = shuffled(Object.keys(FORTUNE_CARDS), ctx.rng).slice(0, 3); break;
    case 'letter': {
      const n = s.events.letters;
      a.letter = n < LETTERS.length ? n : Math.floor(ctx.rng() * LETTERS.length);
      break;
    }
    default: break;
  }
  const ev = s.events;
  ev.active = a;
  ev.last = id;
  const entry = (ev.codex[id] ??= { seen: 0, done: 0 });
  entry.seen++;
  ctx.emit({ type: 'event', id, result: 'start' });
  return a;
}

// ---------- 玩家操作 ----------

export type EventAction =
  /** 點中目標（盆栽、大釜、客人等，需要時帶目標） */
  | { type: 'hit'; customer?: number }
  /** 時機題沒點中 */
  | { type: 'miss' }
  /** 拖曳放到盆栽或大釜上 */
  | { type: 'drop'; slot?: number; recipe?: PotionId }
  /** 三選一 */
  | { type: 'choose'; index: number };

export interface EventActionResult {
  ok: boolean;
  /** 這一下拿到的金幣（土豪勇者、流星） */
  gold?: number;
  /** 螢光蝴蝶停到的盆栽 */
  slot?: number;
  done?: boolean;
}

export function eventAction(s: GameState, action: EventAction, ctx: SimContext): EventActionResult {
  const a = s.events.active;
  if (!a) return { ok: false };
  const def = EVENT_MAP[a.id];
  switch (def.kind) {
    case 'tap': {
      if (action.type !== 'hit') return { ok: false };
      if (a.customer !== undefined && action.customer !== a.customer) return { ok: false };
      a.hits++;
      if (a.hits >= def.goal) {
        completeEvent(s, ctx);
        return { ok: true, done: true };
      }
      return { ok: true };
    }
    case 'count': {
      if (action.type !== 'hit' || a.hits >= def.goal) return { ok: false };
      a.hits++;
      const r = countHit(s, a, ctx);
      if (a.hits >= def.goal) {
        completeEvent(s, ctx);
        return { ...r, done: true };
      }
      return r;
    }
    case 'drag': {
      if (action.type !== 'drop') return { ok: false };
      if (a.id === 'raincloud') {
        if (action.slot === undefined || !s.slots[action.slot]?.plant) return { ok: false };
        a.slot = action.slot;
      } else {
        if (!action.recipe || !s.cauldrons.some((c) => c.recipe === action.recipe)) return { ok: false };
        a.recipe = action.recipe;
      }
      a.hits = 1;
      completeEvent(s, ctx);
      return { ok: true, done: true };
    }
    case 'timing': {
      if (action.type !== 'hit' && action.type !== 'miss') return { ok: false };
      a.tries++;
      if (action.type === 'hit') a.hits++;
      if (a.tries >= def.goal) {
        endEvent(s, ctx);
        return { ok: true, done: true };
      }
      return { ok: true };
    }
    case 'choice': {
      if (action.type !== 'choose' || !a.options?.[action.index]) return { ok: false };
      a.hits = 1;
      a.tries = action.index;
      completeEvent(s, ctx);
      return { ok: true, done: true };
    }
  }
}

/** 計數型事件每點中一下的即時獎勵 */
function countHit(s: GameState, a: ActiveEvent, ctx: SimContext): EventActionResult {
  switch (a.id) {
    case 'hero': return { ok: true, gold: giveGold(s, incomeSec(s) * EVENT_FX.hero.incomePerHit) };
    case 'meteor': return { ok: true, gold: giveGold(s, incomeSec(s) * EVENT_FX.meteor.incomePerHit) };
    case 'butterfly': {
      // 依序停到還沒有蝴蝶的盆栽，都停過了就從頭再疊一次
      const pots = planted(s);
      if (pots.length === 0) return { ok: true };
      const landed = (a.landed ??= []);
      const counts = pots.map((i) => landed.filter((x) => x === i).length);
      const least = Math.min(...counts);
      const choices = pots.filter((_, k) => counts[k] === least);
      const slot = pickOne(choices, ctx.rng);
      landed.push(slot);
      const n = landed.filter((x) => x === slot).length;
      const fx = EVENT_FX.butterfly;
      addBuff(s, { kind: 'potGrowth', target: slot, mult: 1 + (fx.growth - 1) * n, time: fx.buffSec, max: fx.buffSec, source: 'butterfly' }, true);
      return { ok: true, slot };
    }
    default: return { ok: true };
  }
}

// ---------- 結束與獎勵 ----------

/**
 * 時間到（或時機題用完機會）：計數型、時機題只要點中過就算完成；
 * 其他沒完成的就安靜離開，沒有任何懲罰
 */
function endEvent(s: GameState, ctx: SimContext): void {
  const a = s.events.active!;
  const def = EVENT_MAP[a.id];
  if ((def.kind === 'count' || def.kind === 'timing') && a.hits > 0) {
    completeEvent(s, ctx);
    return;
  }
  s.events.active = null;
  s.events.cooldowns[a.id] = EVENT.cooldown[def.rarity];
  ctx.emit({ type: 'event', id: a.id, result: 'leave' });
}

function completeEvent(s: GameState, ctx: SimContext): void {
  const ev = s.events;
  const a = ev.active!;
  const def = EVENT_MAP[a.id];
  const text = applyReward(s, a, ctx);
  const entry = (ev.codex[a.id] ??= { seen: 1, done: 0 });
  const first = entry.done === 0;
  entry.done++;
  s.stats.eventsDone++;
  // 事件簿新增一頁：一點點開心度
  if (first) s.happiness += EVENT.firstHappy * happyMult(s);
  let letter: number | undefined;
  if (a.id === 'letter') {
    letter = a.letter;
    if (a.letter === ev.letters && ev.letters < LETTERS.length) ev.letters++;
  }
  ev.active = null;
  ev.cooldowns[a.id] = EVENT.cooldown[def.rarity];
  ctx.emit({ type: 'event', id: a.id, result: 'done', text, first, letter });
}

/** 秒收入（最近的平均收入；剛開店時有下限） */
export function incomeSec(s: GameState): number {
  return Math.max(EVENT.minIncome, s.incomeRate);
}

function giveGold(s: GameState, gold: number): number {
  s.gold += gold;
  s.stats.goldEarned += gold;
  s.stats.eventGold += gold;
  return gold;
}

/** 每種有種的原料各 sec 秒份的產量（至少 minMaterial 個） */
function giveMaterials(s: GameState, sec: number): string {
  const kinds = [...new Set(planted(s).map((i) => s.slots[i].plant as MaterialId))];
  const parts: string[] = [];
  for (const m of kinds) {
    const rate = s.slots.reduce((n, sl, i) => n + (sl.plant === m ? potOutputPerSec(s, i) : 0), 0);
    const amount = Math.max(EVENT.minMaterial, Math.round(rate * sec));
    s.materials[m] += amount;
    parts.push(`${PLANTS[m].name} +${formatNumber(amount)}`);
  }
  return parts.join('、');
}

/** 加上限時增益；同種同目標的刷新時間（取較長、倍率取較大），stack = 直接覆蓋倍率 */
export function addBuff(s: GameState, b: Buff, stack = false): void {
  const old = s.events.buffs.find((x) => x.kind === b.kind && x.target === b.target);
  if (!old) {
    s.events.buffs.push(b);
    return;
  }
  old.mult = stack ? b.mult : Math.max(old.mult, b.mult);
  old.time = Math.max(old.time, b.time);
  old.max = Math.max(old.max, b.max, old.time);
  old.source = b.source;
}

const buff = (kind: BuffKind, mult: number, sec: number, source: EventId, target?: number | string): Buff =>
  ({ kind, mult, time: sec, max: sec, target, source });

const goldText = (g: number) => `+${formatNumber(g)} 金`;

/** 發獎勵，回傳獎勵說明 */
function applyReward(s: GameState, a: ActiveEvent, ctx: SimContext): string {
  const inc = incomeSec(s);
  switch (a.id) {
    case 'goblin': {
      const fx = EVENT_FX.goblin;
      const got = giveMaterials(s, fx.materialSec);
      addBuff(s, buff('growth', fx.growth, fx.buffSec, a.id));
      return `${got}；所有盆栽生長 ×${fx.growth}（${fx.buffSec} 秒）`;
    }
    case 'dew': {
      const fx = EVENT_FX.dew;
      const i = a.slot ?? 0;
      const slot = s.slots[i];
      if (!slot?.plant) return '';
      const amount = Math.max(EVENT.minMaterial, Math.round(potOutputPerSec(s, i) * fx.yieldSec));
      s.materials[slot.plant] += amount;
      addBuff(s, buff('potGrowth', fx.growth, fx.buffSec, a.id, i));
      return `${PLANTS[slot.plant].name} +${formatNumber(amount)}；這一盆生長 ×${fx.growth}（${fx.buffSec} 秒）`;
    }
    case 'raincloud': {
      const fx = EVENT_FX.raincloud;
      const i = a.slot ?? 0;
      const targets = [i, ...(SLOT_NEIGHBORS[i] ?? [])].filter((k) => s.slots[k]?.plant);
      for (const k of targets) addBuff(s, buff('potGrowth', fx.growth, fx.buffSec, a.id, k));
      return `${targets.length} 盆盆栽生長 ×${fx.growth}（${fx.buffSec} 秒）`;
    }
    case 'butterfly': {
      const n = a.landed?.length ?? 0;
      return `${n} 隻蝴蝶停在盆栽上：生長加速（${EVENT_FX.butterfly.buffSec} 秒）`;
    }
    case 'sneeze': {
      const fx = EVENT_FX.sneeze;
      const sec = a.hits * fx.secPerHit;
      addBuff(s, buff('brew', fx.brew, sec, a.id));
      return `接住 ${a.hits} 顆火花：所有大釜熬煮 ×${fx.brew}（${sec} 秒）`;
    }
    case 'bubble': {
      const c = s.cauldrons.find((x) => x.recipe === a.recipe);
      if (!c) return '';
      const rate = Math.max(cauldronOutputPerSec(s, c), s.potionRate[c.recipe]);
      const amount = Math.max(1, Math.round(rate * EVENT_FX.bubble.brewSec));
      s.potions[c.recipe] += amount;
      return `${RECIPES[c.recipe].name} +${formatNumber(amount)} 瓶`;
    }
    case 'perfect_heat': {
      const sec = a.hits * EVENT_FX.perfect_heat.secPerHit;
      addBuff(s, buff('double', 2, sec, a.id, a.recipe));
      return `命中 ${a.hits} 次：${RECIPES[a.recipe!].name}每輪都是雙倍（${sec} 秒）`;
    }
    case 'apprentice': {
      const fx = EVENT_FX.apprentice;
      addBuff(s, buff('cauldronBrew', fx.brew, fx.buffSec, a.id, a.recipe));
      return `${RECIPES[a.recipe!].name}的大釜熬煮 ×${fx.brew}（${fx.buffSec} 秒）`;
    }
    case 'hero': {
      const fx = EVENT_FX.hero;
      const total = inc * fx.incomePerHit * a.hits;
      if (a.hits >= fx.hypeAt) {
        addBuff(s, buff('market', fx.hype, fx.buffSec, a.id));
        return `搬走 ${a.hits} 箱（${goldText(total)}）；勇者到處宣傳，市場熱度 ×${fx.hype}（${fx.buffSec} 秒）`;
      }
      return `搬走 ${a.hits} 箱（${goldText(total)}）`;
    }
    case 'merchant': {
      const offer = a.options![a.tries] as MerchantOffer;
      const fx = MERCHANT_FX;
      switch (offer) {
        case 'gold': return `${MERCHANT_OFFERS.gold.name}：${goldText(giveGold(s, inc * fx.goldSec))}`;
        case 'growth': addBuff(s, buff('growth', fx.mult, fx.buffSec, a.id)); break;
        case 'brew': addBuff(s, buff('brew', fx.mult, fx.buffSec, a.id)); break;
        case 'arrival': addBuff(s, buff('arrival', fx.mult, fx.buffSec, a.id)); break;
        case 'materials': return `${MERCHANT_OFFERS.materials.name}：${giveMaterials(s, fx.materialSec)}`;
      }
      return `${MERCHANT_OFFERS[offer].name}：${MERCHANT_OFFERS[offer].desc}`;
    }
    case 'princess': return `公主訂下一整季的藥水：${goldText(giveGold(s, inc * EVENT_FX.princess.incomeSec))}`;
    case 'guild_rush': {
      const sec = EVENT_FX.guild_rush.buffSec;
      addBuff(s, buff('crateFull', 2, sec, a.id));
      return `收購箱照售價全額收購（${sec} 秒）`;
    }
    case 'dream': {
      s.mascot.stamina = MASCOT.staminaMax;
      const h = EVENT_FX.dream.happy * happyMult(s);
      s.happiness += h;
      return `露米婭睡得好香：體力回滿、開心度 +${h.toFixed(2)}`;
    }
    case 'letter': return `${LETTERS[a.letter ?? 0].title}：${goldText(giveGold(s, inc * EVENT_FX.letter.incomeSec))}`;
    case 'fortune': {
      const card = a.options![a.tries] as FortuneCard;
      const fx = FORTUNE_FX;
      switch (card) {
        case 'sun':
          addBuff(s, buff('growth', fx.speed, fx.buffSec, a.id));
          addBuff(s, buff('brew', fx.speed, fx.buffSec, a.id));
          break;
        case 'star': addBuff(s, buff('price', fx.price, fx.buffSec, a.id)); break;
        case 'moon': addBuff(s, buff('arrival', fx.arrival, fx.buffSec, a.id)); break;
        case 'wheel': return `「${FORTUNE_CARDS.wheel.name}」：${goldText(giveGold(s, inc * fx.goldSec))}`;
      }
      return `「${FORTUNE_CARDS[card].name}」：${FORTUNE_CARDS[card].desc}`;
    }
    case 'meteor': {
      const fx = EVENT_FX.meteor;
      const each = inc * fx.incomePerHit;
      // 全部點到：再拿一次一樣多
      if (a.hits >= EVENT_MAP.meteor.goal) {
        const bonus = giveGold(s, each * a.hits);
        return `抓住全部 ${a.hits} 顆流星！加碼 ${goldText(bonus)}`;
      }
      return `抓住 ${a.hits} 顆流星（${goldText(each * a.hits)}）`;
    }
    case 'slime': return `史萊姆的見面禮：${giveMaterials(s, EVENT_FX.slime.materialSec)}`;
  }
  void ctx;
  return '';
}

// ---------- 顯示用 ----------

/** 事件簿：這個事件的紀錄 */
export function codexEntry(s: GameState, id: EventId) {
  return s.events.codex[id] ?? { seen: 0, done: 0 };
}

/** 增益的說明（頂部小圖示用） */
export function buffLabel(b: Buff): string {
  const x = `×${Number(b.mult.toFixed(2))}`;
  switch (b.kind) {
    case 'growth': return `所有盆栽生長 ${x}`;
    case 'potGrowth': return `第 ${Number(b.target) + 1} 盆生長 ${x}`;
    case 'brew': return `所有大釜熬煮 ${x}`;
    case 'cauldronBrew': return `${RECIPES[b.target as PotionId]?.name ?? ''}熬煮 ${x}`;
    case 'double': return `${RECIPES[b.target as PotionId]?.name ?? ''}每輪雙倍`;
    case 'crateFull': return '收購箱全價收購';
    case 'arrival': return `來客速度 ${x}`;
    case 'price': return `售價 ${x}`;
    case 'market': return `市場熱度拉到 ×${b.mult}`;
  }
}

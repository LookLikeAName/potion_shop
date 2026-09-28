import { describe, expect, it } from 'vitest';
import { EVENT, EVENTS, EVENT_FX, MERCHANT_FX } from '../src/game/config/events';
import { CRATE_FOR } from '../src/game/config/upgrades';
import { redeem, redeemLock } from '../src/game/commands';
import { eventAction, eventAvailable, eventPool, incomeSec, startEvent, tickEvents } from '../src/game/events';
import { parseSave } from '../src/game/save';
import { tick, type GameEvent, type SimContext } from '../src/game/sim';
import { createInitialState, type GameState } from '../src/game/state';
import {
  codexIncomeMult, cratePct, doubleChance, growthSpeed, happyMult, sellPrice,
} from '../src/game/stats';

function ctx(rng: () => number = () => 0.5, extra: Partial<SimContext> = {}): SimContext & { events: GameEvent[] } {
  const events: GameEvent[] = [];
  return { rng, offline: false, emit: (e) => events.push(e), events, ...extra };
}

function seeded(seed: number) {
  return () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
}

/** 已經開店、賣出第一筆（事件開放），有三盆植物與一口有火蜥蜴的大釜 */
function opened(): GameState {
  const s = createInitialState();
  s.stats.customersServed = 1;
  s.slots.forEach((sl, i) => {
    if (i < 3) {
      sl.plant = 'redheart';
      sl.level = 10;
    }
  });
  s.cauldrons[0].salamander = 1;
  s.incomeRate = 100;
  return s;
}

describe('事件的檢定', () => {
  it('每 8–12 分鐘檢定一次、成功率 60%：一小時平均約 3.6 個事件', () => {
    const s = opened();
    const c = ctx(seeded(7));
    let started = 0;
    c.emit = (e) => {
      if (e.type === 'event' && e.result === 'start') started++;
    };
    const hours = 200;
    for (let t = 0; t < hours * 3600; t++) tickEvents(s, 1, c);
    const perHour = started / hours;
    expect(perHour).toBeGreaterThan(3.1);
    expect(perHour).toBeLessThan(4.1);
  });

  it('背景分頁、離線、劇情視窗開著時不計時也不出現；限時增益照樣倒數', () => {
    for (const extra of [{ foreground: false }, { offline: true }, { eventHold: true }] as Partial<SimContext>[]) {
      const s = opened();
      s.events.buffs.push({ kind: 'growth', mult: 2, time: 10, max: 10, source: 'goblin' });
      const timer = s.events.timer;
      for (let t = 0; t < 5000; t++) tickEvents(s, 1, ctx(() => 0, extra));
      expect(s.events.active).toBeNull();
      expect(s.events.timer).toBe(timer);
      expect(s.events.buffs).toHaveLength(0);
    }
  });

  it('進行中的事件在背景時暫停，回到前景繼續', () => {
    const s = opened();
    startEvent(s, 'dew', ctx());
    const left = s.events.active!.time;
    tickEvents(s, 5, ctx(() => 0.5, { foreground: false }));
    expect(s.events.active!.time).toBe(left);
    tickEvents(s, 5, ctx());
    expect(s.events.active!.time).toBe(left - 5);
  });

  it('條件：流星雨只在晚上（或擺出星燈）；公主要名聲 9 級與精靈羽化靈藥', () => {
    const s = opened();
    expect(eventAvailable(s, 'meteor', ctx(undefined, { hour: 14 }))).toBe(false);
    expect(eventAvailable(s, 'meteor', ctx(undefined, { hour: 22 }))).toBe(true);
    expect(eventAvailable(s, 'meteor', ctx(undefined, { hour: 3 }))).toBe(true);
    s.gifts.star_lamp = true;
    s.decor[0] = 'star_lamp';
    expect(eventAvailable(s, 'meteor', ctx(undefined, { hour: 14 }))).toBe(true);
    expect(eventAvailable(s, 'princess', ctx())).toBe(false);
  });

  it('同一個事件不會連續出現；冷卻中的不會出現', () => {
    const s = opened();
    s.events.last = 'goblin';
    s.events.cooldowns.dew = 100;
    const ids = eventPool(s, ctx()).map((d) => d.id);
    expect(ids).not.toContain('goblin');
    expect(ids).not.toContain('dew');
    expect(ids).toContain('bubble');
  });
});

describe('事件的操作與獎勵', () => {
  it('尋寶地精：點中 5 下完成，拿到原料與生長加速，事件簿新增一頁並給一點開心度', () => {
    const s = opened();
    const c = ctx();
    startEvent(s, 'goblin', c);
    const before = s.materials.redheart;
    const speed = growthSpeed(s, s.slots[0]);
    for (let k = 0; k < 4; k++) expect(eventAction(s, { type: 'hit' }, c).done).toBeFalsy();
    const heart = s.happiness;
    expect(eventAction(s, { type: 'hit' }, c).done).toBe(true);
    expect(s.materials.redheart).toBeGreaterThan(before);
    expect(growthSpeed(s, s.slots[0])).toBeCloseTo(speed * EVENT_FX.goblin.growth);
    expect(s.events.codex.goblin).toEqual({ seen: 1, done: 1 });
    expect(s.happiness - heart).toBeCloseTo(EVENT.firstHappy * happyMult(s));
    expect(s.events.active).toBeNull();
    expect(c.events.some((e) => e.type === 'event' && e.result === 'done' && e.first)).toBe(true);
    // 第二次完成不再給開心度
    startEvent(s, 'goblin', c);
    const h2 = s.happiness;
    for (let k = 0; k < 5; k++) eventAction(s, { type: 'hit' }, c);
    expect(s.happiness).toBe(h2);
  });

  it('時間到沒完成：安靜離開，不扣任何東西', () => {
    const s = opened();
    const c = ctx();
    startEvent(s, 'goblin', c);
    eventAction(s, { type: 'hit' }, c);
    const snap = JSON.stringify({ g: s.gold, m: s.materials, p: s.potions, h: s.happiness });
    tickEvents(s, 100, c);
    expect(s.events.active).toBeNull();
    expect(JSON.stringify({ g: s.gold, m: s.materials, p: s.potions, h: s.happiness })).toBe(snap);
    expect(s.events.codex.goblin?.done).toBe(0);
    expect(s.events.cooldowns.goblin).toBeGreaterThan(0);
  });

  it('計數型（土豪勇者）：每下給金幣，時間到點過就算完成；點滿 30 下市場熱度拉高', () => {
    const s = opened();
    s.stats.goldEarned = 1e6;
    const c = ctx();
    startEvent(s, 'hero', c);
    const gold = s.gold;
    for (let k = 0; k < 30; k++) eventAction(s, { type: 'hit' }, c);
    expect(s.gold - gold).toBeCloseTo(incomeSec(s) * EVENT_FX.hero.incomePerHit * 30, 0);
    tickEvents(s, 100, c);
    expect(s.events.codex.hero?.done).toBe(1);
    expect(s.events.buffs.some((b) => b.kind === 'market')).toBe(true);
  });

  it('拖曳型（雨雲寶寶）：只能放在有植物的盆栽上，放下後那盆和隔壁加速', () => {
    const s = opened();
    s.slots[1].rain = 1;
    const c = ctx();
    startEvent(s, 'raincloud', c);
    expect(eventAction(s, { type: 'drop', slot: 4 }, c).ok).toBe(false);
    expect(eventAction(s, { type: 'drop', slot: 1 }, c).done).toBe(true);
    const kinds = s.events.buffs.filter((b) => b.kind === 'potGrowth').map((b) => b.target).sort();
    expect(kinds).toEqual([0, 1, 2]);
    // 只加速有 buff 的盆栽
    s.slots[3].open = true;
    s.slots[3].plant = 'redheart';
    s.slots[3].level = 10;
    expect(growthSpeed(s, s.slots[0]) / growthSpeed(s, s.slots[3])).toBeCloseTo(EVENT_FX.raincloud.growth);
  });

  it('時機題（完美火候）：3 次機會用完，命中過就讓那口大釜每輪雙倍', () => {
    const s = opened();
    s.upgrades.condenser = 1;
    const c = ctx();
    startEvent(s, 'perfect_heat', c);
    eventAction(s, { type: 'miss' }, c);
    eventAction(s, { type: 'hit' }, c);
    expect(s.events.active).not.toBeNull();
    eventAction(s, { type: 'miss' }, c);
    expect(s.events.active).toBeNull();
    expect(doubleChance(s, s.cauldrons[0])).toBe(1);
    const b = s.events.buffs.find((x) => x.kind === 'double')!;
    expect(b.time).toBe(EVENT_FX.perfect_heat.secPerHit);
  });

  it('三選一（流浪行商）：選到高價收購拿 120 秒收入', () => {
    const s = opened();
    s.stats.goldEarned = 1e4;
    const c = ctx();
    startEvent(s, 'merchant', c);
    const k = s.events.active!.options!.indexOf('gold');
    if (k < 0) return;
    const gold = s.gold;
    eventAction(s, { type: 'choose', index: k }, c);
    expect(s.gold - gold).toBeCloseTo(incomeSec(s) * MERCHANT_FX.goldSec, 0);
  });

  it('商會緊急收購：期間收購箱照全價收購', () => {
    const s = opened();
    s.upgrades[CRATE_FOR.glow] = 1;
    const c = ctx();
    startEvent(s, 'guild_rush', c);
    expect(cratePct(s, CRATE_FOR.glow)).toBeLessThan(1);
    eventAction(s, { type: 'hit' }, c);
    expect(cratePct(s, CRATE_FOR.glow)).toBe(1);
    tick(s, EVENT_FX.guild_rush.buffSec + 1, c);
    expect(cratePct(s, CRATE_FOR.glow)).toBeLessThan(1);
  });

  it('公主：扮成沒有訂單的客人排隊，不會被結帳；只有點中她才算，完成後離開', () => {
    const s = opened();
    s.potions.glow = 1e6;
    const c = ctx();
    startEvent(s, 'princess', c);
    const id = s.events.active!.customer!;
    const princess = s.customers.find((x) => x.id === id)!;
    expect(princess.princess).toBe(true);
    expect(princess.lines).toHaveLength(0);
    // 庫存再多也不會被結帳帶走
    for (let k = 0; k < 100; k++) tick(s, 0.1, c);
    expect(s.customers.find((x) => x.id === id)?.status).toBe('waiting');
    expect(eventAction(s, { type: 'hit', customer: id + 100 }, c).ok).toBe(false);
    expect(eventAction(s, { type: 'hit', customer: id }, c).done).toBe(true);
    expect(s.customers.some((x) => x.princess)).toBe(false);
  });

  it('公主：沒被認出來，時間到就離開；事件被中途結束時也會送走她', () => {
    const s = opened();
    const c = ctx();
    startEvent(s, 'princess', c);
    tickEvents(s, 100, c);
    expect(s.events.active).toBeNull();
    expect(s.customers.some((x) => x.princess)).toBe(false);
    startEvent(s, 'princess', c);
    s.events.active = null;
    tickEvents(s, 0.1, c);
    expect(s.customers.some((x) => x.princess)).toBe(false);
  });
});

describe('主線：遠方的來信', () => {
  /** 已兌換慶功宴、羈絆滿級（累計開心度 300） */
  function story(): GameState {
    const s = opened();
    s.redeemed.celebration = 1;
    s.happiness = 300 - 25;
    return s;
  }
  const receive = (s: GameState, c: SimContext) => eventAction(s, { type: 'hit' }, c);

  it('慶功宴之前不會寄來，也不會出現在隨機檢定裡', () => {
    const s = story();
    delete s.redeemed.celebration;
    s.happiness = 1000;
    const c = ctx(seeded(3));
    for (let t = 0; t < 10 * 3600; t++) {
      tickEvents(s, 1, c);
      expect(s.events.active?.id).not.toBe('letter');
      if (s.events.active) s.events.active = null;
    }
    expect(eventAvailable(story(), 'letter', ctx())).toBe(false);
  });

  it('羈絆到了就馬上寄來（不等檢定）、不限時，收下後照順序算', () => {
    const s = story();
    s.happiness = 200 - 25; // 剛好 Lv13
    s.events.timer = 9999;
    const c = ctx();
    tickEvents(s, 0.1, c);
    expect(s.events.active?.id).toBe('letter');
    expect(s.events.active?.letter).toBe(0);
    for (let t = 0; t < 3600; t++) tickEvents(s, 1, c);
    expect(s.events.active?.id).toBe('letter');
    receive(s, c);
    expect(s.events.letters).toBe(1);
    expect(c.events.some((e) => e.type === 'event' && e.result === 'done' && e.letter === 0)).toBe(true);
    // 第二封要 Lv14：還沒到就不會來
    for (let t = 0; t < 3600; t++) {
      tickEvents(s, 1, c);
      expect(s.events.active?.id).not.toBe('letter');
      if (s.events.active) s.events.active = null;
    }
  });

  it('背景分頁、離線時不會出現；回到頁面時就在等著', () => {
    const s = story();
    tickEvents(s, 1, ctx(() => 0.5, { foreground: false }));
    tickEvents(s, 1, ctx(() => 0.5, { offline: true }));
    expect(s.events.active).toBeNull();
    tickEvents(s, 1, ctx());
    expect(s.events.active?.id).toBe('letter');
  });

  it('三封依序寄來；收齊後不再出現。誓約要收齊三封、名聲 13 級才開放兌換', () => {
    const s = story();
    const c = ctx(seeded(5));
    s.stats.goldEarned = 1e13; // 名聲 13
    expect(redeemLock(s, 'vow')).toEqual({ letters: { n: 0, need: 3 }, renown: { n: 13, need: 13 } });
    expect(redeem(s, 'vow')).toBe(false);
    const got: number[] = [];
    for (let t = 0; t < 5 * 3600; t++) {
      tickEvents(s, 1, c);
      const a = s.events.active;
      if (a?.id === 'letter') {
        got.push(a.letter!);
        receive(s, c);
      } else if (a) s.events.active = null;
    }
    expect(got).toEqual([0, 1, 2]);
    expect(s.events.letters).toBe(3);
    expect(redeemLock(s, 'vow')).toBeNull();
    // 名聲不夠也不行
    s.stats.goldEarned = 1e12;
    expect(redeemLock(s, 'vow')?.renown).toEqual({ n: 12, need: 13 });
    expect(redeem(s, 'vow')).toBe(false);
    s.stats.goldEarned = 1e13;
    expect(redeem(s, 'vow')).toBe(true);
    expect(redeemLock(s, 'vow')).toBeNull();
  });
});

describe('事件簿', () => {
  it('每收集 6 種、以及全部收齊時，收入 +3%', () => {
    const s = opened();
    const price = sellPrice(s, 'glow');
    EVENTS.slice(0, 6).forEach((e) => (s.events.codex[e.id] = { seen: 1, done: 1 }));
    expect(codexIncomeMult(s)).toBeCloseTo(1.03);
    expect(sellPrice(s, 'glow')).toBeCloseTo(price * 1.03);
    EVENTS.forEach((e) => (s.events.codex[e.id] = { seen: 1, done: 1 }));
    expect(codexIncomeMult(s)).toBeCloseTo(1.09);
  });

  it('舊存檔：補上事件資料，丟掉焦晶', () => {
    const old = createInitialState() as unknown as Record<string, unknown>;
    delete old.events;
    old.charCrystal = 3;
    old.version = 2;
    const save = parseSave(JSON.stringify({ version: 2, savedAt: 0, state: old }))!;
    expect(save.state.events.codex).toEqual({});
    expect(save.state.events.timer).toBeGreaterThan(0);
    expect('charCrystal' in save.state).toBe(false);
  });
});

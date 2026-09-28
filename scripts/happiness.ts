// 開心度節奏模擬：積極玩家（全程在線、照小心願點擊）、純掛機玩家（開著頁面不操作，每小時買東西一次），
// 以及對照用的關掉頁面玩家（離線，每小時上線買東西；離線的開心度有衰減懲罰）。
// 記錄每件開心度物品、禮物的取得時間，以及開心度的來源比例。目標：積極約 12 小時、純掛機約 36 小時兌換完（聲援除外）。
// 用法：npm run happiness -- [--out docs/happiness-report.md] [--active-hours 12] [--idle-hours 36]
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { TICK } from '../src/game/config/balance';
import { ACHIEVEMENTS } from '../src/game/config/achievements';
import { GIFTS, GIFT_MAP } from '../src/game/config/gifts';
import { BOND, HAPPINESS_ITEMS } from '../src/game/config/happiness';
import { MASCOT } from '../src/game/config/mascot';
import { POTION_IDS, type PotionId } from '../src/game/config/recipes';
import { WISH, type WishKind } from '../src/game/config/wishes';
import * as cmd from '../src/game/commands';
import { formatNumber } from '../src/game/format';
import { simulateOffline } from '../src/game/offline';
import { tick, type GameEvent, type SimContext } from '../src/game/sim';
import { createInitialState, type GameState } from '../src/game/state';
import { bondLevel, decorSlots, happyMult, renownLevel } from '../src/game/stats';
import { EVENT, EVENT_FX, LETTERS } from '../src/game/config/events';
import { botClick, botEvent, botShop, DEFAULT_BOT, mulberry32, type Buy } from './bot';

const args = process.argv.slice(2);
const argOf = (name: string) => (args.includes(name) ? args[args.indexOf(name) + 1] : undefined);
const OUT = argOf('--out') ?? 'docs/happiness-report.md';
const ACTIVE_HOURS = Number(argOf('--active-hours')) || 12;
// 關掉頁面的對照組要約 50 小時才兌換完，模擬跑 60 小時才看得到
const IDLE_HOURS = Number(argOf('--idle-hours')) || 60;
// 調整用：覆寫設定值比較不同方案
if (argOf('--rest')) MASCOT.restHappinessPerHour = Number(argOf('--rest'));
if (argOf('--wish-base')) WISH.baseReward = Number(argOf('--wish-base'));
if (argOf('--renown')) BOND.renownPerLevel = Number(argOf('--renown'));
if (argOf('--bond')) BOND.bondPerLevel = Number(argOf('--bond'));
if (argOf('--coef')) for (const k of ['harvest', 'brew', 'crate'] as const) WISH.goalCoef[k] = Number(argOf('--coef'));

/** 兌換目標：聲援以外的全部 */
const GOAL_ITEMS = HAPPINESS_ITEMS.filter((i) => i.id !== 'cheer');
const goalCost = GOAL_ITEMS.reduce((n, i) => n + Array.from({ length: i.max }, (_, k) => i.cost(k)).reduce((a, b) => a + b, 0), 0);

/** 擺設偏好：積極玩家重視心願與點擊，掛機玩家重視休息與離線 */
const PREFS = {
  active: ['crystal_ball', 'star_lamp', 'music_box', 'gramophone', 'bouquet', 'slime_doll', 'hairpin', 'tea_set', 'snack', 'dream_catcher'],
  idle: ['slime_doll', 'tea_set', 'gramophone', 'bouquet', 'hairpin', 'snack', 'crystal_ball', 'star_lamp', 'dream_catcher', 'music_box'],
  away: ['dream_catcher', 'slime_doll', 'gramophone', 'bouquet', 'hairpin', 'tea_set', 'snack', 'crystal_ball', 'star_lamp', 'music_box'],
};

interface Sources {
  wish: number;
  rest: number;
  touch: number;
  achievement: number;
  gift: number;
  /** 事件：第一次完成、露米婭的夢話 */
  event: number;
}

interface HourRow {
  hour: number;
  gained: number;
  spent: number;
  mult: number;
  renown: number;
  bond: number;
  wishes: string;
  gps: number;
}

function arrangeDecor(s: GameState, prefs: string[]): void {
  const want = prefs.filter((id) => s.gifts[id]).slice(0, decorSlots(s));
  want.forEach((id, k) => cmd.setDecor(s, k, id));
}

/** 買得起就兌換：先買最便宜的目標物品，全部買完才買聲援 */
function redeemAll(s: GameState, log: (label: string) => void, spend: (n: number) => void): void {
  for (let n = 0; n < 50; n++) {
    const left = GOAL_ITEMS.filter((i) => cmd.redeemCost(s, i.id) !== null)
      .sort((a, b) => cmd.redeemCost(s, a.id)! - cmd.redeemCost(s, b.id)!);
    const next = left[0] ?? HAPPINESS_ITEMS.find((i) => i.id === 'cheer')!;
    const cost = cmd.redeemCost(s, next.id)!;
    if (!cmd.redeem(s, next.id)) return;
    spend(cost);
    log(`♥ ${next.name}`);
  }
}

/** 下一件禮物：價格在「幾分鐘的收入」以內就當成優先項目存錢買 */
function giftBuys(s: GameState, minutes: number, onGift: (id: string) => void): Buy[] {
  const next = GIFTS.find((g) => !s.gifts[g.id]);
  if (!next || next.price > Math.max(1e4, s.incomeRate * minutes * 60)) return [];
  return [{
    label: `🎁 ${next.name}`, cost: next.price,
    run: () => {
      if (!cmd.giveGift(s, next.id)) return false;
      onGift(next.id);
      return true;
    },
  }];
}

function simulate(kind: 'active' | 'idle' | 'away') {
  const s = createInitialState();
  const src: Sources = { wish: 0, rest: 0, touch: 0, achievement: 0, gift: 0, event: 0 };
  const wishStats: Partial<Record<WishKind, { done: number; fail: number }>> = {};
  let currentWish: WishKind | null = null;
  const onEvent = (e: GameEvent) => {
    if (e.type === 'wish') {
      if (e.result === 'new') currentWish = s.wish?.kind ?? null;
      else {
        src.wish += e.reward;
        if (currentWish) {
          const st = (wishStats[currentWish] ??= { done: 0, fail: 0 });
          if (e.result === 'done') st.done++;
          else st.fail++;
        }
      }
    }
    if (e.type === 'achievement') src.achievement += ACHIEVEMENTS.find((a) => a.id === e.id)?.reward ?? 0;
    if (e.type === 'event' && e.result === 'done') {
      if (e.letter !== undefined) log(`✉ ${LETTERS[e.letter].title}（羈絆 Lv ${bondLevel(s)}）`);
      if (e.first) src.event += EVENT.firstHappy * happyMult(s);
      if (e.id === 'dream') src.event += EVENT_FX.dream.happy * happyMult(s);
    }
  };
  const ctx: SimContext = { rng: mulberry32(7), offline: false, emit: onEvent };
  const firsts = new Map<string, number>();
  const log = (label: string) => {
    if (!firsts.has(label)) firsts.set(label, s.time);
  };
  let spent = 0;
  const spend = (n: number) => (spent += n);
  const onGift = (id: string) => {
    src.gift += GIFT_MAP[id].happiness;
    log(`🎁 ${GIFT_MAP[id].name}`);
  };
  let day = 0;
  const touch = () => {
    const r = cmd.touchLumia(s, 'head', false, `d${day}`);
    src.touch += r.gain;
  };
  const rows: HourRow[] = [];
  let lastEarned = 0;
  let lastT = 0;
  const record = (hour: number) => {
    const done = Object.values(wishStats).reduce((n, w) => n + w!.done, 0);
    const fail = Object.values(wishStats).reduce((n, w) => n + w!.fail, 0);
    rows.push({
      hour, gained: s.happiness + spent, spent, mult: happyMult(s), renown: renownLevel(s), bond: bondLevel(s),
      wishes: `${done}/${done + fail}`, gps: (s.stats.goldEarned - lastEarned) / Math.max(1, s.time - lastT),
    });
    lastEarned = s.stats.goldEarned;
    lastT = s.time;
  };
  const shop = (minutes: number) => {
    // 名聲 10 級以上記下達成時間（星空下的誓約的名聲條件用）
    const renown = renownLevel(s);
    if (renown >= 10) log(`★ 名聲 Lv ${renown}`);
    // 主線的信不限時，打開遊戲時一定會收下（掛機、離線的玩家也是）
    if (s.events.active?.id === 'letter') botEvent(s, ctx);
    botShop(s, ctx, () => {}, DEFAULT_BOT, giftBuys(s, minutes, onGift));
    redeemAll(s, log, spend);
    arrangeDecor(s, PREFS[kind]);
  };
  const allDone = () => GOAL_ITEMS.every((i) => cmd.redeemCost(s, i.id) === null);
  let doneAt: number | null = null;

  if (kind === 'active') {
    const bot = { ...DEFAULT_BOT, followWish: true };
    const end = ACTIVE_HOURS * 3600;
    let clickAcc = 0;
    let saved: Record<PotionId, number> | null = null;
    let nextHour = 1;
    touch();
    while (s.time < end - 1e-9) {
      clickAcc += 4 * TICK;
      while (clickAcc >= 1) {
        // 有突發事件時先處理事件
        if (!botEvent(s, ctx)) botClick(s, ctx, bot);
        clickAcc -= 1;
      }
      const sec = Math.round(s.time * 10);
      // 前 30 分鐘每秒逛一次魔導書，之後每 10 秒
      if (sec % (s.time < 1800 ? 10 : 100) === 0) shop(30);
      // 能量每小時回滿 20 次：每 3 分鐘摸一次頭
      if (sec % 1800 === 0 && sec > 0) touch();
      // 收購題：暫時把藥水保留量調成 0 秒（全部收購），結束後調回來
      if (s.wish?.kind === 'crate' && !saved) {
        saved = Object.fromEntries(POTION_IDS.map((p) => [p, s.settings.potions[p].keepSec])) as Record<PotionId, number>;
        for (const p of POTION_IDS) s.settings.potions[p].keepSec = 0;
      } else if (s.wish?.kind !== 'crate' && saved) {
        for (const p of POTION_IDS) s.settings.potions[p].keepSec = saved[p];
        saved = null;
      }
      tick(s, TICK, ctx);
      if (doneAt === null && allDone()) doneAt = s.time;
      if (s.time >= nextHour * 3600 - 1e-9) record(nextHour++);
    }
  } else if (kind === 'idle') {
    // 開著頁面但幾乎不操作：前 10 分鐘點一點，之後不點、不理小心願和事件，每小時打開魔導書買東西一次（每天摸一次頭拿每日獎勵）
    const end = IDLE_HOURS * 3600;
    let clickAcc = 0;
    let nextHour = 1;
    touch();
    while (s.time < end - 1e-9) {
      if (s.time < 600) {
        clickAcc += 4 * TICK;
        while (clickAcc >= 1) {
          botClick(s, ctx, DEFAULT_BOT);
          clickAcc -= 1;
        }
        if (Math.round(s.time * 10) % 10 === 0) shop(60);
      }
      tick(s, TICK, ctx);
      if (s.time >= nextHour * 3600 - 1e-9) {
        shop(60);
        if (nextHour % 24 === 0) {
          day++;
          touch();
        }
        if (doneAt === null && allDone()) doneAt = s.time;
        record(nextHour++);
      }
    }
  } else {
    // 關掉頁面：前 10 分鐘像一般放置玩家一樣點一點，之後離線，每小時上線一次買東西（每天摸一次頭拿每日獎勵）
    let clickAcc = 0;
    while (s.time < 600) {
      clickAcc += 4 * TICK;
      while (clickAcc >= 1) {
        botClick(s, ctx, DEFAULT_BOT);
        clickAcc -= 1;
      }
      if (Math.round(s.time * 10) % 10 === 0) shop(60);
      tick(s, TICK, ctx);
    }
    touch();
    for (let h = 1; h <= IDLE_HOURS; h++) {
      simulateOffline(s, h === 1 ? 3600 - 600 : 3600);
      // 上線：信在離線期間達成條件的話，一回到頁面就寄來
      tick(s, TICK, ctx);
      shop(60);
      if (h % 24 === 0) {
        day++;
        touch();
      }
      if (doneAt === null && allDone()) doneAt = s.time;
      record(h);
    }
  }
  src.rest = s.happiness + spent - src.wish - src.touch - src.achievement - src.gift - src.event;
  return { s, rows, firsts, src, wishStats, spent, doneAt };
}

// ---------- 報告 ----------

const fmtTime = (sec: number) => {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  return h > 0 ? `${h} 小時 ${m} 分` : `${m} 分`;
};

const lines: string[] = [];
const out = (l = '') => lines.push(l);
out('# 開心度節奏模擬報告');
out();
out('> 由 `npm run happiness` 產生。目標：積極玩家約 12 小時、純掛機（開著頁面不操作）約 36 小時兌換完所有開心度物品（少女的聲援除外）。關掉頁面不算在玩，離線的開心度有衰減，只做對照。');
out(`> 兌換目標合計 ${goalCost} ♥；休息基礎每小時 ${MASCOT.restHappinessPerHour} ♥；心願基礎獎勵 ${WISH.baseReward}；倍率 = (1 + ${BOND.renownPerLevel} × 名聲) × (1 + ${BOND.bondPerLevel} × 羈絆)。`);

const PROFILE_DESC = {
  active: `積極玩家：全程在線 ${ACTIVE_HOURS} 小時，每秒點 4 下並照小心願的題目點，每 3 分鐘摸一次頭`,
  idle: `純掛機玩家：開著頁面，前 10 分鐘點一點，之後不點也不理小心願和事件，每小時買東西一次（${IDLE_HOURS} 小時）`,
  away: `對照：關掉頁面的玩家：前 10 分鐘點一點，之後離線，每小時上線買東西一次（${IDLE_HOURS} 小時）`,
};

for (const kind of ['active', 'idle', 'away'] as const) {
  const { s, rows, firsts, src, wishStats, spent, doneAt } = simulate(kind);
  const total = s.happiness + spent;
  out();
  out(`## ${PROFILE_DESC[kind]}`);
  out();
  out(`- 全部兌換完（聲援除外）：**${doneAt === null ? '未完成' : fmtTime(doneAt)}**；結束時羈絆 Lv ${bondLevel(s)}、名聲 Lv ${renownLevel(s)}、倍率 ×${happyMult(s).toFixed(2)}，聲援 ${s.redeemed.cheer ?? 0} 次`);
  const pct = (n: number) => `${Math.round((n / total) * 100)}%`;
  out(`- 開心度來源（共 ${total.toFixed(1)}）：心願 ${src.wish.toFixed(1)}（${pct(src.wish)}）、休息／離線 ${src.rest.toFixed(1)}（${pct(src.rest)}）、禮物 ${src.gift}（${pct(src.gift)}）、成就 ${src.achievement.toFixed(1)}（${pct(src.achievement)}）、觸碰 ${src.touch.toFixed(1)}（${pct(src.touch)}）、事件 ${src.event.toFixed(1)}（${pct(src.event)}）`);
  const ws = Object.entries(wishStats);
  if (ws.length) {
    out(`- 小心願完成率：${ws.map(([k, w]) => `${k} ${w!.done}/${w!.done + w!.fail}`).join('、')}`);
  }
  out();
  out('### 取得時間');
  out();
  out('| 項目 | 時間 |');
  out('|---|---|');
  for (const [label, t] of [...firsts.entries()].sort((a, b) => a[1] - b[1])) out(`| ${label} | ${fmtTime(t)} |`);
  out();
  out('### 每小時');
  out();
  out('| 小時 | 累計獲得 ♥ | 已花 ♥ | 倍率 | 名聲 | 羈絆 | 心願（完成/出現） | 金幣/秒 |');
  out('|---|---|---|---|---|---|---|---|');
  for (const r of rows) {
    out(`| ${r.hour} | ${r.gained.toFixed(1)} | ${r.spent} | ×${r.mult.toFixed(2)} | ${r.renown} | ${r.bond} | ${r.wishes} | ${formatNumber(r.gps)} |`);
  }
}

const report = lines.join('\n') + '\n';
mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, report);
console.log(report);

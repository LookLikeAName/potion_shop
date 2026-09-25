// 平衡模擬：讓機器人照簡單規則玩，記錄解鎖時間與收入曲線，對照企劃書的節奏目標。
// 用法：npm run balance [-- --minutes 180]
import { writeFileSync, mkdirSync } from 'node:fs';
import { CUSTOMER, TICK } from '../src/game/config/balance';
import { MATERIAL_IDS, PLANTS, type MaterialId } from '../src/game/config/plants';
import { RECIPES, type PotionId } from '../src/game/config/recipes';
import { GLOBAL_UPGRADES } from '../src/game/config/upgrades';
import * as cmd from '../src/game/commands';
import { formatNumber } from '../src/game/format';
import { simulateOffline } from '../src/game/offline';
import { missingInputs, tick, type SimContext } from '../src/game/sim';
import { createInitialState, type GameState } from '../src/game/state';
import { arrivalRate } from '../src/game/stats';

const args = process.argv.slice(2);
const MINUTES = Number(args[args.indexOf('--minutes') + 1]) || 180;
const CHECKPOINTS = [1, 2, 5, 10, 15, 20, 30, 45, 60, 90, 120, 180, 240, 360].filter((m) => m <= MINUTES);

/** 可重現的亂數 */
function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface Profile {
  name: string;
  desc: string;
  /** 第 t 秒時玩家是否在線點擊 */
  clicking: (sec: number) => boolean;
  /** 第 t 秒時玩家是否會打開魔導書買東西 */
  shopping: (sec: number) => boolean;
  cps: number;
}

const PROFILES: Profile[] = [
  {
    name: '勤勞玩家',
    desc: '全程在線，每秒點 4 下，隨時購買',
    clicking: () => true,
    shopping: () => true,
    cps: 4,
  },
  {
    name: '放置玩家',
    desc: '前 10 分鐘每秒點 4 下；之後不點擊，每 10 分鐘上線買一次東西',
    clicking: (t) => t < 600,
    shopping: (t) => t < 600 || Math.floor(t) % 600 === 0,
    cps: 4,
  },
];

// ---------- 機器人行為 ----------

/** 點擊一下：優先收成熟的植物 → 沒有火蜥蜴的大釜 → 還在長的盆栽 */
function botClick(s: GameState, ctx: SimContext): void {
  const ready = s.slots.findIndex((sl) => sl.plant && sl.ready);
  if (ready >= 0) return void cmd.clickPlant(s, ready, ctx);
  const manual = s.cauldrons.find((c) => c.salamander === 0 && (c.batch > 0 || missingInputs(s, c).length === 0));
  if (manual) return void cmd.clickCauldron(s, manual.recipe, ctx);
  const growing = s.slots.findIndex((sl) => sl.plant && !sl.fairy);
  if (growing >= 0) return void cmd.clickPlant(s, growing, ctx);
  const any = s.slots.findIndex((sl) => sl.plant);
  if (any >= 0) cmd.clickPlant(s, any, ctx);
}

/** 盆栽的目標植物：第 2 格種月光菇（解鎖專注糖漿後）、第 3 格種星光藤蔓（解鎖羽化靈藥後），其他種紅心草 */
function wantedPlant(s: GameState, i: number): MaterialId {
  const has = (p: PotionId) => s.cauldrons.some((c) => c.recipe === p);
  if (i === 1 && has('focus')) return 'moonshroom';
  if (i === 2 && has('elixir')) return 'starvine';
  return 'redheart';
}

type Buy = { label: string; cost: number; run: () => boolean };

function candidates(s: GameState, ctx: SimContext): Buy[] {
  const out: Buy[] = [];
  s.slots.forEach((slot, i) => {
    if (!slot.open) return;
    const want = wantedPlant(s, i);
    if (!slot.plant) {
      out.push({ label: `種植 ${PLANTS[want].name}`, cost: PLANTS[want].seedCost, run: () => cmd.plantSeed(s, i, want) });
      return;
    }
    if (slot.plant !== want) {
      const cost = cmd.replantCost(s, i, want);
      if (cost !== null) out.push({ label: `改種 ${PLANTS[want].name}`, cost, run: () => cmd.replant(s, i, want, ctx) });
    }
    for (const kind of ['potLevel', 'rain', 'fairy'] as const) {
      const key = { kind, slot: i };
      const q = cmd.getQuote(s, key, 1);
      if (q && q.count > 0) out.push({ label: `${kind}#${i}`, cost: q.cost, run: () => cmd.purchase(s, key, 1) });
    }
  });
  for (const c of s.cauldrons) {
    for (const kind of ['cauldronLevel', 'salamander'] as const) {
      const key = { kind, recipe: c.recipe };
      const q = cmd.getQuote(s, key, 1);
      if (q && q.count > 0) out.push({ label: `${kind}:${c.recipe}`, cost: q.cost, run: () => cmd.purchase(s, key, 1) });
    }
  }
  for (const p of cmd.nextLockedRecipes(s)) {
    out.push({ label: `解鎖 ${RECIPES[p].name}`, cost: RECIPES[p].unlockCost, run: () => cmd.unlockRecipe(s, p) });
  }
  for (const u of GLOBAL_UPGRADES) {
    const key = { kind: 'global' as const, id: u.id };
    const q = cmd.getQuote(s, key, 1);
    if (q && q.count > 0) out.push({ label: u.name, cost: q.cost, run: () => cmd.purchase(s, key, 1) });
  }
  return out;
}

/** 庫存堆積到保留量兩倍以上：玩家會想買收購箱 */
const stockPiling = (s: GameState) =>
  s.cauldrons.some((c) => s.potions[c.recipe] > s.settings.reserve * 2);

/** 解鎖、種新植物（以及庫存堆積時的收購箱）優先存錢；其他就買最便宜的 */
function botShop(s: GameState, ctx: SimContext, log: (label: string) => void): void {
  for (let n = 0; n < 200; n++) {
    const list = candidates(s, ctx);
    const isPriority = (b: Buy) =>
      /^(解鎖|種植|改種)/.test(b.label) || (b.label === '商會收購箱' && !s.upgrades.crate && stockPiling(s));
    const priority = list.filter(isPriority).sort((a, b) => a.cost - b.cost)[0];
    // 有優先項目時，只買價格低於它 10% 的小東西，其他錢存起來
    const pick = priority && s.gold >= priority.cost
      ? priority
      : list.filter((b) => b.cost <= s.gold && (!priority || b.cost <= priority.cost * 0.1))
        .sort((a, b) => a.cost - b.cost)[0];
    if (!pick || !pick.run()) return;
    log(pick.label);
  }
}

// ---------- 模擬 ----------

interface Row {
  min: number;
  gold: number;
  earned: number;
  gps: number;
  pots: string;
  cauldrons: string;
  sold: number;
  rush: number;
  wholesale: number;
  /** 各原料庫存 */
  stock: string;
}

function simulate(p: Profile) {
  const s = createInitialState();
  const ctx: SimContext = { rng: mulberry32(42), offline: false, emit: () => {} };
  const firsts = new Map<string, number>();
  const log = (label: string) => {
    const key = label.replace(/#\d+|:\w+/, '');
    if (!firsts.has(key)) firsts.set(key, s.time);
  };
  const rows: Row[] = [];
  let clickAcc = 0;
  let lastEarned = 0;
  let lastT = 0;
  const end = MINUTES * 60;
  let next = 0;

  while (s.time < end - 1e-9) {
    const t = s.time;
    if (p.clicking(t)) {
      clickAcc += p.cps * TICK;
      while (clickAcc >= 1) {
        botClick(s, ctx);
        clickAcc -= 1;
      }
    }
    if (p.shopping(t) && Math.floor(t * 10) % 10 === 0) botShop(s, ctx, log);
    tick(s, TICK, ctx);

    if (next < CHECKPOINTS.length && s.time >= CHECKPOINTS[next] * 60 - 1e-9) {
      const earned = s.stats.goldEarned;
      rows.push({
        min: CHECKPOINTS[next],
        gold: s.gold,
        earned,
        gps: (earned - lastEarned) / (s.time - lastT),
        pots: s.slots.filter((x) => x.plant).map((x) => `${PLANTS[x.plant!].name[0]}${x.level}`).join(' '),
        cauldrons: s.cauldrons.map((c) => `${RECIPES[c.recipe].name[0]}${c.level}/火${c.salamander}`).join(' '),
        sold: s.stats.potionsSold,
        rush: s.stats.rushServed,
        wholesale: s.stats.potionsWholesaled,
        stock: MATERIAL_IDS.filter((m) => s.materials[m] >= 1)
          .map((m) => `${PLANTS[m].name[0]}${formatNumber(s.materials[m])}`).join(' '),
      });
      lastEarned = earned;
      lastT = s.time;
      next++;
    }
  }

  // 結束時離線 8 小時，看結算收益
  const offline = simulateOffline(structuredClone(s), 8 * 3600);
  return { s, rows, firsts, offline };
}

// ---------- 報告 ----------

const fmtTime = (sec: number) => {
  const m = Math.floor(sec / 60);
  const r = Math.round(sec % 60);
  return m > 0 ? `${m} 分 ${r} 秒` : `${r} 秒`;
};

const lines: string[] = [];
const out = (l = '') => lines.push(l);

out('# 平衡模擬報告');
out();
out(`> 由 \`npm run balance\` 產生，模擬 ${MINUTES} 分鐘。機器人規則見 \`scripts/balance.ts\`。`);
out(`> 基礎來客間隔 ${CUSTOMER.interval} 秒。`);

for (const p of PROFILES) {
  const { s, rows, firsts, offline } = simulate(p);
  out();
  out(`## ${p.name}：${p.desc}`);
  out();
  out('### 第一次購買時間');
  out();
  out('| 項目 | 時間 |');
  out('|---|---|');
  const keys = [
    '種植 紅心草', 'potLevel', 'fairy', 'salamander', 'rain', 'cauldronLevel',
    '解鎖 專注糖漿', '改種 月光菇', '種植 月光菇', '解鎖 精靈羽化靈藥', '改種 星光藤蔓', '種植 星光藤蔓',
    ...GLOBAL_UPGRADES.map((u) => u.name),
  ];
  for (const k of keys) {
    const t = firsts.get(k);
    if (t !== undefined) out(`| ${k} | ${fmtTime(t)} |`);
  }
  const never = keys.filter((k) => !firsts.has(k) && GLOBAL_UPGRADES.some((u) => u.name === k));
  if (never.length) out(`| （未購買）${never.join('、')} | — |`);
  out();
  out('### 收入曲線');
  out();
  out('| 分鐘 | 金幣/秒 | 累計收入 | 盆栽 | 大釜（等級/火蜥蜴） | 原料庫存 | 賣出 | 急單 | 收購 |');
  out('|---|---|---|---|---|---|---|---|---|');
  for (const r of rows) {
    out(`| ${r.min} | ${formatNumber(r.gps)} | ${formatNumber(r.earned)} | ${r.pots} | ${r.cauldrons} | ${r.stock} | ${formatNumber(r.sold)} | ${formatNumber(r.rush)} | ${formatNumber(r.wholesale)} |`);
  }
  out();
  const demand = (arrivalRate(s) / CUSTOMER.interval) * 60;
  out(`- 結束時來客數：每分鐘約 ${demand.toFixed(1)} 位；庫存：${
    s.cauldrons.map((c) => `${RECIPES[c.recipe].name} ${formatNumber(s.potions[c.recipe])}`).join('、')}`);
  out(`- 結束後離線 8 小時：獲得 ${formatNumber(offline.gold)} 金幣（在線最後一段每秒 ${formatNumber(rows.at(-1)!.gps)}，離線平均每秒 ${formatNumber(offline.gold / offline.simulated)}）`);
}

const report = lines.join('\n') + '\n';
mkdirSync('docs', { recursive: true });
writeFileSync('docs/balance-report.md', report);
console.log(report);

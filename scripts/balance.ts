// 平衡模擬：讓機器人照簡單規則玩，記錄解鎖時間與收入曲線，對照企劃書的節奏目標。
// 用法：npm run balance [-- --minutes 180]
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { CUSTOMER, TICK, UPGRADE_FX } from '../src/game/config/balance';
import { MATERIAL_IDS, PLANTS, type MaterialId } from '../src/game/config/plants';
import { RECIPES, type PotionId } from '../src/game/config/recipes';
import {
  CRATE_FOR, CRATE_MATERIALS, GLOBAL_UPGRADE_MAP, GLOBAL_UPGRADES, REFINE_FOR, SQUIRREL,
} from '../src/game/config/upgrades';
import * as cmd from '../src/game/commands';
import { formatNumber } from '../src/game/format';
import { simulateOffline } from '../src/game/offline';
import { checkoutByClick, missingInputs, tick, type SimContext } from '../src/game/sim';
import { createInitialState, type GameState } from '../src/game/state';
import {
  arrivalRate, cauldronOutputPerSec, materialReserve, potOutputPerSec, potionReserve, recipeNeeds,
} from '../src/game/stats';

const args = process.argv.slice(2);
const argOf = (name: string) => (args.includes(name) ? args[args.indexOf(name) + 1] : undefined);
const MINUTES = Number(argOf('--minutes')) || 180;
/** 報告輸出位置（比較不同設定時用，預設 docs/balance-report.md） */
const OUT = argOf('--out') ?? 'docs/balance-report.md';
/** 配方精煉的等級上限：數字或 inf（比較不同設計用；不指定 = 照設定檔） */
const REFINE_MAX = argOf('--refine-max');
if (REFINE_MAX !== undefined) {
  for (const id of Object.values(REFINE_FOR)) GLOBAL_UPGRADE_MAP[id].maxLevel = REFINE_MAX === 'inf' ? Infinity : Number(REFINE_MAX);
}
/** 顧客買走產量的基礎比例（比較用） */
if (argOf('--share-base')) CUSTOMER.shareBase = Number(argOf('--share-base'));
/** 盆栽採收量曲線（比較用，0 = 每級固定 +1） */
if (argOf('--pot-curve') !== undefined) UPGRADE_FX.potYieldCurve = Number(argOf('--pot-curve'));
/** 各植物每輪採收量倍率：「紅心草,月光菇,星光藤蔓」例如 1,2,4（比較用） */
if (argOf('--plant-yield')) {
  argOf('--plant-yield')!.split(',').map(Number).forEach((v, k) => (PLANTS[MATERIAL_IDS[k]].yieldMult = v));
}
/** 收購價：「基礎,每級」例如 0.2,0.05（比較用） */
const CRATE = argOf('--crate');
if (CRATE) [UPGRADE_FX.crateBasePct, UPGRADE_FX.crateStepPct] = CRATE.split(',').map(Number);
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

/** 點擊一下：優先幫備好貨的客人結帳 → 收成熟的植物 → 沒有火蜥蜴的大釜 → 還在長的盆栽 */
function botClick(s: GameState, ctx: SimContext): void {
  const buyer = s.customers.find((c) => c.status !== 'waiting' && !c.express);
  if (buyer) return void checkoutByClick(s, buyer.id, ctx);
  const ready = s.slots.findIndex((sl) => sl.plant && sl.ready);
  if (ready >= 0) return void cmd.clickPlant(s, ready, ctx);
  const manual = s.cauldrons.find((c) => c.salamander === 0 && (c.batch > 0 || missingInputs(s, c).length === 0));
  if (manual) return void cmd.clickCauldron(s, manual.recipe, ctx);
  const growing = s.slots.findIndex((sl) => sl.plant && !sl.fairy);
  if (growing >= 0) return void cmd.clickPlant(s, growing, ctx);
  const any = s.slots.findIndex((sl) => sl.plant);
  if (any >= 0) cmd.clickPlant(s, any, ctx);
}

/**
 * 盆栽分配：--alloc 用字串指定 5 格各種什麼（R 紅心草、M 月光菇、S 星光藤蔓），預設 RMSRR
 * （第 2 格月光菇、第 3 格星光藤蔓、其他紅心草）。配方還沒解鎖時先種用得到的：S → M → R。
 */
const ALLOC = (argOf('--alloc') ?? 'RMSRR').toUpperCase();

function wantedPlant(s: GameState, i: number): MaterialId {
  const has = (p: PotionId) => s.cauldrons.some((c) => c.recipe === p);
  const want = ALLOC[i] ?? 'R';
  if (want === 'S' && has('elixir')) return 'starvine';
  if ((want === 'S' || want === 'M') && has('focus')) return 'moonshroom';
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

/** 某個還沒買的收購箱，對應的庫存已經堆到保留量兩倍以上：玩家會想買它 */
function crateNeeded(s: GameState, label: string): boolean {
  if (!label.startsWith('收購箱：')) return false;
  if (label === '收購箱：原料') {
    return !s.upgrades[CRATE_MATERIALS] && MATERIAL_IDS.some((m) => s.materials[m] > materialReserve(s, m) * 2);
  }
  const p = s.cauldrons.map((c) => c.recipe).find((r) => label.endsWith(RECIPES[r].name));
  return !!p && !s.upgrades[CRATE_FOR[p]] && s.potions[p] > Math.max(20, potionReserve(s, p) * 2);
}

/** 解鎖、種新植物（以及庫存堆積時對應的收購箱）優先存錢；其他就買最便宜的 */
/**
 * 大釜順序：預設（--cauldron-order value）把高價配方拖到最左邊優先拿原料（靈藥 → 專注 → 微光），
 * 像真的玩家會做的；--cauldron-order unlock 則維持解鎖順序（微光在最左邊）
 */
const CAULDRON_ORDER = argOf('--cauldron-order') ?? 'value';
const VALUE_ORDER: PotionId[] = ['elixir', 'focus', 'glow'];

function botArrange(s: GameState): void {
  if (CAULDRON_ORDER !== 'value') return;
  VALUE_ORDER.filter((p) => s.cauldrons.some((c) => c.recipe === p)).forEach((p, to) => {
    const from = s.cauldrons.findIndex((c) => c.recipe === p);
    if (from !== to) cmd.moveCauldron(s, from, to);
  });
}

function botShop(s: GameState, ctx: SimContext, log: (label: string) => void): void {
  botArrange(s);
  for (let n = 0; n < 200; n++) {
    const list = candidates(s, ctx);
    // 第一隻算盤松鼠（自動結帳）也優先：沒有它時不點擊就賣不出去
    const isPriority = (b: Buy) => /^(解鎖|種植|改種|fairy)/.test(b.label) || crateNeeded(s, b.label)
      || (b.label === '算盤松鼠' && !s.upgrades[SQUIRREL]);
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
  /** 上一個記錄點以來，各大釜在等原料的時間比例 */
  starved: string;
  /** 上一個記錄點以來，收入中來自收購箱的比例 */
  crateShare: number;
  /** 上一個記錄點以來，整張訂單都湊齊的客人比例（部分購買、空手離開都算沒滿足） */
  satisfied: number;
  /** 各原料：所有盆栽全速產量 ÷ 所有大釜全速需求 */
  supply: string;
}

/** 藥水收購設定（比較用）：--potion-keep 保留百分比；--potion-sell 0 = 不賣給收購箱 */
const POTION_KEEP = argOf('--potion-keep');
const POTION_SELL = argOf('--potion-sell');

function simulate(p: Profile) {
  const s = createInitialState();
  for (const set of Object.values(s.settings.potions)) {
    if (POTION_KEEP !== undefined) set.keepPct = Number(POTION_KEEP);
    if (POTION_SELL !== undefined) set.sell = POTION_SELL !== '0';
  }
  const ctx: SimContext = { rng: mulberry32(42), offline: false, emit: () => {} };
  const firsts = new Map<string, number>();
  const log = (label: string) => {
    const key = label.replace(/#\d+|:\w+/, '');
    if (!firsts.has(key)) firsts.set(key, s.time);
  };
  const rows: Row[] = [];
  let clickAcc = 0;
  let lastEarned = 0;
  let lastWholesale = 0;
  let lastServed = 0;
  let lastPartial = 0;
  let lastLost = 0;
  let lastT = 0;
  const end = MINUTES * 60;
  let next = 0;
  const starved: Partial<Record<PotionId, number>> = {};

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
    for (const c of s.cauldrons) if (c.batch === 0) starved[c.recipe] = (starved[c.recipe] ?? 0) + TICK;

    if (next < CHECKPOINTS.length && s.time >= CHECKPOINTS[next] * 60 - 1e-9) {
      const earned = s.stats.goldEarned;
      rows.push({
        min: CHECKPOINTS[next],
        gold: s.gold,
        earned,
        gps: (earned - lastEarned) / (s.time - lastT),
        crateShare: earned > lastEarned ? (s.stats.wholesaleGold - lastWholesale) / (earned - lastEarned) : 0,
        satisfied: (() => {
          const served = s.stats.customersServed - lastServed;
          const partial = s.stats.partialSales - lastPartial;
          const lost = s.stats.customersLost - lastLost;
          return served + lost > 0 ? (served - partial) / (served + lost) : 1;
        })(),
        pots: s.slots.filter((x) => x.plant).map((x) => `${PLANTS[x.plant!].name[0]}${x.level}`).join(' '),
        cauldrons: s.cauldrons.map((c) => {
          const refine = s.upgrades[REFINE_FOR[c.recipe]] ?? 0;
          return `${RECIPES[c.recipe].name[0]}${c.level}/火${c.salamander}${refine ? `★${refine}` : ''}`;
        }).join(' '),
        supply: MATERIAL_IDS.map((m) => {
          const need = s.cauldrons.reduce((n, c) => n + recipeNeeds(s, c.recipe, m) * cauldronOutputPerSec(s, c), 0);
          if (need <= 0) return '';
          const made = s.slots.reduce((n, sl, i) => n + (sl.plant === m && sl.fairy ? potOutputPerSec(s, i) : 0), 0);
          return `${Math.round((made / need) * 100)}%`;
        }).filter(Boolean).join(' '),
        starved: s.cauldrons.map((c) => {
          const pct = Math.round(((starved[c.recipe] ?? 0) / (s.time - lastT)) * 100);
          starved[c.recipe] = 0;
          return `${RECIPES[c.recipe].name[0]}${pct}%`;
        }).join(' '),
        sold: s.stats.potionsSold,
        rush: s.stats.rushServed,
        wholesale: s.stats.potionsWholesaled,
        stock: MATERIAL_IDS.filter((m) => s.materials[m] >= 1)
          .map((m) => `${PLANTS[m].name[0]}${formatNumber(s.materials[m])}`).join(' '),
      });
      lastEarned = earned;
      lastWholesale = s.stats.wholesaleGold;
      lastServed = s.stats.customersServed;
      lastPartial = s.stats.partialSales;
      lastLost = s.stats.customersLost;
      lastT = s.time;
      next++;
    }
  }

  if (args.includes('--debug')) {
    console.error(p.name, JSON.stringify({
      rate: s.potionRate, potions: s.potions, reserve: s.cauldrons.map((c) => potionReserve(s, c.recipe)),
      customers: s.customers.map((c) => ({ st: c.status, lines: c.lines.map((l) => `${l.potion}:${l.qty}/${l.delivered}`) })),
      cauldrons: s.cauldrons.map((c) => ({ r: c.recipe, lv: c.level, sal: c.salamander, batch: c.batch })),
      upgrades: s.upgrades, slots: s.slots.map((x) => [x.plant, x.level, x.fairy]), materials: s.materials, gold: s.gold,
    }));
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
  out('| 分鐘 | 金幣/秒 | 收購箱占收入 | 訂單滿足率 | 累計收入 | 盆栽 | 大釜（等級/火蜥蜴/★精煉） | 大釜等原料 | 原料供需 | 原料庫存 | 賣出 | 急單 | 收購 |');
  out('|---|---|---|---|---|---|---|---|---|---|---|---|---|');
  for (const r of rows) {
    out(`| ${r.min} | ${formatNumber(r.gps)} | ${Math.round(r.crateShare * 100)}% | ${Math.round(r.satisfied * 100)}% | ${formatNumber(r.earned)} | ${r.pots} | ${r.cauldrons} | ${r.starved} | ${r.supply} | ${r.stock} | ${formatNumber(r.sold)} | ${formatNumber(r.rush)} | ${formatNumber(r.wholesale)} |`);
  }
  out();
  const demand = (arrivalRate(s) / CUSTOMER.interval) * 60;
  out(`- 結束時來客數：每分鐘約 ${demand.toFixed(1)} 位；庫存：${
    s.cauldrons.map((c) => `${RECIPES[c.recipe].name} ${formatNumber(s.potions[c.recipe])}`).join('、')}`);
  out(`- 結束後離線 8 小時：獲得 ${formatNumber(offline.gold)} 金幣（在線最後一段每秒 ${formatNumber(rows.at(-1)!.gps)}，離線平均每秒 ${formatNumber(offline.gold / offline.simulated)}）`);
}

const report = lines.join('\n') + '\n';
mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, report);
console.log(report);

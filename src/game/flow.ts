// 產銷統計：量測最近一段時間每種原料／藥水平均每秒的產量與消耗，幫玩家找出瓶頸。
// 只在執行期量測（不存檔、不影響模擬）；離線結算或換存檔後重新開始。
import { MATERIAL_IDS, type MaterialId } from './config/plants';
import { POTION_IDS, type PotionId } from './config/recipes';
import type { GameEvent } from './sim';
import type { GameState } from './state';

export type ItemId = MaterialId | PotionId;
const ITEMS: ItemId[] = [...MATERIAL_IDS, ...POTION_IDS];

/** 每個統計桶的長度（秒）與保留幾個桶：平均與折線圖都只看最近約 30 秒（為了效能不保留更久） */
const BUCKET_SEC = 1;
const WINDOW = 30;

type Counts = Record<ItemId, number>;
const zeros = (): Counts => Object.fromEntries(ITEMS.map((i) => [i, 0])) as Counts;

interface Bucket {
  time: number;
  /** 桶開始時的庫存（算消耗 = 產量 − 庫存變化） */
  stock: Counts;
  made: Counts;
  crate: Counts;
  /** 藥水：進門時這種藥水不夠、訂單沒辦法馬上湊齊的客人數 */
  short: Counts;
  /** 各配方的大釜等原料（湊不出一份）的秒數 */
  starved: Record<PotionId, number>;
  income: Income;
  orders: Orders;
  /** 桶結束時的市場熱度 */
  market: number;
}

/** 收入來源（金幣） */
export interface Income {
  customers: number;
  cratePotions: number;
  crateMaterials: number;
}

/**
 * 顧客：整張湊齊成交、只買走部分、空手離開的人數；
 * 進門的人數、其中進門當下訂單沒辦法馬上湊齊（要等貨）的人數
 */
export interface Orders {
  full: number;
  partial: number;
  lost: number;
  arrived: number;
  waited: number;
}

const noIncome = (): Income => ({ customers: 0, cratePotions: 0, crateMaterials: 0 });
const noOrders = (): Orders => ({ full: 0, partial: 0, lost: 0, arrived: 0, waited: 0 });

export interface ItemFlow {
  /** 產量／秒（收成、熬煮完成） */
  made: number;
  /** 使用／秒：原料 = 大釜熬煮用掉；藥水 = 顧客買走 */
  used: number;
  /** 收購箱收購／秒 */
  crate: number;
  /** 庫存淨變化／秒 */
  net: number;
  /** 藥水：這段時間進門時這種藥水不夠、沒辦法馬上湊齊的客人數（不是每秒） */
  short: number;
}

export interface FlowReport {
  /** 實際統計了幾秒 */
  seconds: number;
  items: Record<ItemId, ItemFlow>;
  /** 各配方的大釜在等原料的時間比例（0~1） */
  starved: Record<PotionId, number>;
  /** 每秒平均收入（依來源） */
  income: Income & { total: number };
  /** 這段時間的顧客人數（整張成交／部分／空手離開） */
  orders: Orders;
}

/** 某種原料／藥水每一秒的數值 */
export interface ItemSeries {
  made: number[];
  used: number[];
  crate: number[];
  /** 庫存淨變化／秒（= 產量 − 使用 − 收購） */
  net: number[];
  /** 那一秒結束時的庫存 */
  stock: number[];
  /** 那一秒進門、這種藥水不夠的客人數 */
  short: number[];
}

export interface FlowSeries {
  ago: number[];
  items: Record<ItemId, ItemSeries>;
  /** 各配方的大釜在等原料的時間比例（0~1） */
  starved: Record<PotionId, number[]>;
  income: Record<keyof Income | 'total', number[]>;
  market: number[];
}
const stockOf = (s: GameState, i: ItemId) => (i in s.materials ? s.materials[i as MaterialId] : s.potions[i as PotionId]);

export class FlowTracker {
  private buckets: Bucket[] = [];

  reset(): void {
    this.buckets = [];
  }

  private get cur(): Bucket | undefined {
    return this.buckets[this.buckets.length - 1];
  }

  /** 模擬事件（在線 tick 與玩家點擊都會送進來） */
  note(e: GameEvent): void {
    const b = this.cur;
    if (!b) return;
    if (e.type === 'sale') {
      b.income.customers += e.gold;
      b.orders[e.partial ? 'partial' : 'full']++;
    } else if (e.type === 'customerLeft') b.orders.lost++;
    else if (e.type === 'customerArrived' && e.short) {
      b.orders.arrived++;
      if (e.short.length > 0) b.orders.waited++;
      for (const p of e.short) b.short[p]++;
    }
    else if (e.type === 'harvest') b.made[e.material] += e.amount;
    else if (e.type === 'brewed') b.made[e.recipe] += e.amount;
    else if (e.type === 'wholesale') {
      b.income[e.crate === 'materials' ? 'crateMaterials' : 'cratePotions'] += e.gold;
      if (e.crate !== 'materials') b.crate[e.crate] += e.amount;
      else for (const m of MATERIAL_IDS) b.crate[m] += e.items?.[m] ?? 0;
    }
  }

  /** 每個模擬 tick 之後呼叫 */
  sample(s: GameState, dt: number): void {
    let b = this.cur;
    if (!b || b.time >= BUCKET_SEC - 1e-6) {
      const stock = zeros();
      for (const i of ITEMS) stock[i] = stockOf(s, i);
      b = {
        time: 0, stock, made: zeros(), crate: zeros(), short: zeros(), starved: { glow: 0, focus: 0, elixir: 0 },
        income: noIncome(), orders: noOrders(), market: s.market.value,
      };
      this.buckets.push(b);
      if (this.buckets.length > WINDOW) this.buckets.shift();
    }
    b.time += dt;
    b.market = s.market.value;
    for (const c of s.cauldrons) if (c.batch === 0) b.starved[c.recipe] += dt;
  }

  report(s: GameState): FlowReport | null {
    const first = this.buckets[0];
    const seconds = this.buckets.reduce((t, b) => t + b.time, 0);
    if (!first || seconds < 2) return null;
    const items = {} as Record<ItemId, ItemFlow>;
    for (const i of ITEMS) {
      const made = this.buckets.reduce((n, b) => n + b.made[i], 0);
      const crate = this.buckets.reduce((n, b) => n + b.crate[i], 0);
      const delta = stockOf(s, i) - first.stock[i];
      const consumed = made - delta;
      items[i] = {
        made: made / seconds,
        used: Math.max(0, consumed - crate) / seconds,
        crate: crate / seconds,
        net: delta / seconds,
        short: this.buckets.reduce((n, b) => n + b.short[i], 0),
      };
    }
    const starved = { glow: 0, focus: 0, elixir: 0 };
    for (const p of POTION_IDS) starved[p] = this.buckets.reduce((n, b) => n + b.starved[p], 0) / seconds;
    const income = noIncome();
    const orders = noOrders();
    for (const b of this.buckets) {
      for (const k of Object.keys(income) as (keyof Income)[]) income[k] += b.income[k] / seconds;
      for (const k of Object.keys(orders) as (keyof Orders)[]) orders[k] += b.orders[k];
    }
    const total = income.customers + income.cratePotions + income.crateMaterials;
    return { seconds, items, starved, income: { ...income, total }, orders };
  }

  /**
   * 最近每一秒的數值（折線圖用）：只取已經走完的 1 秒桶，最多 30 個。
   * ago[k] = 第 k 點距離現在幾秒（負數，最後一點最接近 0）。
   */
  series(s: GameState): FlowSeries | null {
    const done = this.buckets.filter((b, k) => k < this.buckets.length - 1 && b.time > 1e-6);
    if (done.length < 2) return null;
    const cur = this.cur!;
    const items = {} as Record<ItemId, ItemSeries>;
    for (const i of ITEMS) {
      const it: ItemSeries = { made: [], used: [], crate: [], net: [], stock: [], short: [] };
      done.forEach((b) => {
        const next = this.buckets[this.buckets.indexOf(b) + 1];
        const end = next ? next.stock[i] : stockOf(s, i);
        const consumed = b.made[i] - (end - b.stock[i]);
        it.made.push(b.made[i] / b.time);
        it.used.push(Math.max(0, consumed - b.crate[i]) / b.time);
        it.crate.push(b.crate[i] / b.time);
        it.net.push((end - b.stock[i]) / b.time);
        it.stock.push(end);
        it.short.push(b.short[i]);
      });
      items[i] = it;
    }
    const starved = { glow: [], focus: [], elixir: [] } as Record<PotionId, number[]>;
    for (const p of POTION_IDS) starved[p] = done.map((b) => b.starved[p] / b.time);
    const income = { customers: [], cratePotions: [], crateMaterials: [], total: [] } as Record<keyof Income | 'total', number[]>;
    for (const b of done) {
      income.customers.push(b.income.customers / b.time);
      income.cratePotions.push(b.income.cratePotions / b.time);
      income.crateMaterials.push(b.income.crateMaterials / b.time);
      income.total.push((b.income.customers + b.income.cratePotions + b.income.crateMaterials) / b.time);
    }
    let t = -cur.time;
    const ago = done.map(() => 0);
    for (let k = done.length - 1; k >= 0; k--) {
      ago[k] = t;
      t -= done[k].time;
    }
    return { ago, items, starved, income, market: done.map((b) => b.market) };
  }
}
// 產銷統計：量測最近一段時間每種原料／藥水平均每秒的產量與消耗，幫玩家找出瓶頸。
// 只在執行期量測（不存檔、不影響模擬）；離線結算或換存檔後重新開始。
import { MATERIAL_IDS, type MaterialId } from './config/plants';
import { POTION_IDS, type PotionId } from './config/recipes';
import type { GameEvent } from './sim';
import type { GameState } from './state';

export type ItemId = MaterialId | PotionId;
const ITEMS: ItemId[] = [...MATERIAL_IDS, ...POTION_IDS];

/** 每個統計桶的長度（秒）與保留幾個桶：平均的是最近約 30 秒 */
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
  /** 各配方的大釜等原料（湊不出一份）的秒數 */
  starved: Record<PotionId, number>;
}

export interface ItemFlow {
  /** 產量／秒（收成、熬煮完成） */
  made: number;
  /** 使用／秒：原料 = 大釜熬煮用掉；藥水 = 顧客買走 */
  used: number;
  /** 收購箱收購／秒 */
  crate: number;
  /** 庫存淨變化／秒 */
  net: number;
}

export interface FlowReport {
  /** 實際統計了幾秒 */
  seconds: number;
  items: Record<ItemId, ItemFlow>;
  /** 各配方的大釜在等原料的時間比例（0~1） */
  starved: Record<PotionId, number>;
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
    if (e.type === 'harvest') b.made[e.material] += e.amount;
    else if (e.type === 'brewed') b.made[e.recipe] += e.amount;
    else if (e.type === 'wholesale') {
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
      b = { time: 0, stock, made: zeros(), crate: zeros(), starved: { glow: 0, focus: 0, elixir: 0 } };
      this.buckets.push(b);
      if (this.buckets.length > WINDOW) this.buckets.shift();
    }
    b.time += dt;
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
      };
    }
    const starved = { glow: 0, focus: 0, elixir: 0 };
    for (const p of POTION_IDS) starved[p] = this.buckets.reduce((n, b) => n + b.starved[p], 0) / seconds;
    return { seconds, items, starved };
  }
}

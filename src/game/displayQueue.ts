// 給畫面用的事件佇列（飄字、特效、產量速率顯示）。數值早就算進遊戲，這裡只影響顯示。
import type { GameEvent } from './sim';

/** 同一個來源（某一盆、某一口大釜、某個收購箱）兩次取走之間最多保留幾個事件；多的合併進它最後一個 */
export const EVENTS_PER_SOURCE = 32;
/** 全部事件的安全上限（背景分頁沒人取走時）：超過就只留最新的一半 */
export const MAX_PENDING_EVENTS = 2000;

/** 可以合併的事件來源；其他事件（成交、成就、心願…）一定保留 */
function sourceKey(e: GameEvent): string | null {
  switch (e.type) {
    case 'harvest': return `h:${e.slot}:${e.crit ? 'c' : e.bounty ? 'b' : ''}`;
    case 'brewed': return `b:${e.recipe}:${e.double ? 'd' : ''}`;
    case 'wholesale': return `w:${e.crate}`;
    default: return null;
  }
}

/** 把 extra 的數量加進 into（同一個來源、同一種事件） */
function merge(into: GameEvent, extra: GameEvent): void {
  if (into.type === 'harvest' && extra.type === 'harvest') into.amount += extra.amount;
  else if (into.type === 'brewed' && extra.type === 'brewed') into.amount += extra.amount;
  else if (into.type === 'wholesale' && extra.type === 'wholesale') {
    into.amount += extra.amount;
    into.gold += extra.gold;
    if (extra.items) {
      into.items ??= {};
      for (const [m, n] of Object.entries(extra.items)) {
        const k = m as keyof typeof extra.items;
        into.items[k] = (into.items[k] ?? 0) + (n ?? 0);
      }
    }
  }
}

/**
 * 產量極快時（例如大釜極速沸騰）一個來源每秒可能有上千個事件：以前佇列滿了就只留最新的，
 * 最後處理的那口大釜會把其他大釜的事件全部擠掉，它們的飄字就停了。
 * 現在每個來源各自有上限，多的合併進它最後一個事件（數量照樣算進去），每個來源都看得到。
 */
export class DisplayQueue {
  private items: GameEvent[] = [];
  private perSource = new Map<string, { count: number; last: GameEvent }>();

  push(e: GameEvent): void {
    const key = sourceKey(e);
    if (key) {
      const src = this.perSource.get(key);
      if (src && src.count >= EVENTS_PER_SOURCE) {
        // 事件物件是這裡自己的副本，合併不會改到別人手上的事件
        merge(src.last, e);
        return;
      }
      const copy = { ...e } as GameEvent;
      if (copy.type === 'wholesale' && copy.items) copy.items = { ...copy.items };
      this.perSource.set(key, { count: (src?.count ?? 0) + 1, last: copy });
      this.items.push(copy);
    } else {
      this.items.push(e);
    }
    if (this.items.length > MAX_PENDING_EVENTS) {
      this.items = this.items.slice(-MAX_PENDING_EVENTS / 2);
      this.perSource.clear();
    }
  }

  drain(): GameEvent[] {
    const out = this.items;
    this.items = [];
    this.perSource.clear();
    return out;
  }

  clear(): void {
    this.items = [];
    this.perSource.clear();
  }

  get length(): number {
    return this.items.length;
  }
}

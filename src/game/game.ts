// 執行期的遊戲物件：以真實經過時間推進模擬、存檔、轉發玩家指令。
import { CLICK_CAP_PER_SEC, OFFLINE, TICK } from './config/balance';
import { MASCOT, type Assignment, type OutfitId, type TouchPart } from './config/mascot';
import type { MaterialId } from './config/plants';
import type { PotionId } from './config/recipes';
import * as cmd from './commands';
import type { BuyMode } from './costs';
import { FlowTracker } from './flow';
import { simulateOffline, type OfflineReport } from './offline';
import { loadGame, saveGame, type SaveFile } from './save';
import { checkoutByClick, tick, type GameEvent, type SimContext } from './sim';
import { createInitialState, type GameState } from './state';
import { DisplayQueue } from './displayQueue';
import { eventAction, type EventAction, type EventActionResult } from './events';

/** 一次補算最多跑幾個 tick（再多就走離線結算） */
const MAX_CATCHUP_TICKS = Math.ceil(OFFLINE.reportThreshold / TICK);
const NOTIFY_INTERVAL_MS = 200;

export class Game {
  state: GameState;
  paused = false;
  /** 產銷統計（最近約 30 秒的平均） */
  readonly flow = new FlowTracker();
  onOffline?: (r: OfflineReport) => void;

  private last: number;
  private acc = 0;
  /** 等著給畫面顯示的事件（只用來顯示特效與飄字，數值已經算進遊戲裡） */
  private events = new DisplayQueue();
  private listeners = new Set<() => void>();
  private lastNotify = 0;
  private clickTimes: number[] = [];
  private touchTimes: number[] = [];
  private ctx: SimContext = {
    rng: Math.random,
    offline: false,
    emit: (e) => {
      // 產銷統計要看到每一個事件；給畫面的佇列會把同一來源太多的事件合併
      this.flow.note(e);
      this.events.push(e);
    },
  };

  constructor(save: SaveFile | null) {
    this.state = save?.state ?? createInitialState();
    // 從存檔時間開始補算，第一次 advance() 就會處理離線收益
    this.last = save ? Math.min(save.savedAt, Date.now()) : Date.now();
  }

  static fromStorage(): Game {
    return new Game(loadGame());
  }

  /** 由畫面更新與背景計時器呼叫 */
  advance(): void {
    const now = Date.now();
    if (this.paused) {
      this.last = now;
      return;
    }
    const elapsed = Math.max(0, (now - this.last) / 1000);
    this.last = now;

    if (elapsed > OFFLINE.reportThreshold) {
      this.acc = 0;
      this.flow.reset();
      const report = simulateOffline(this.state, elapsed);
      this.onOffline?.(report);
      this.notify(true);
      return;
    }

    this.acc += elapsed;
    // 流星雨看現實時間
    this.ctx.hour = new Date(now).getHours();
    let n = 0;
    while (this.acc >= TICK && n < MAX_CATCHUP_TICKS) {
      tick(this.state, TICK, this.ctx);
      this.flow.sample(this.state, TICK);
      this.acc -= TICK;
      n++;
    }
    if (n > 0) this.notify(false);
  }

  pause(): void {
    this.paused = true;
  }

  resume(): void {
    this.paused = false;
    this.last = Date.now();
    this.acc = 0;
  }

  /** 從存檔重新載入（另一個分頁交還控制權時） */
  reload(): void {
    const save = loadGame();
    this.state = save?.state ?? createInitialState();
    this.events.clear();
    this.flow.reset();
    this.acc = 0;
    this.paused = false;
    this.last = save ? Math.min(save.savedAt, Date.now()) : Date.now();
    this.notify(true);
  }

  replaceState(save: SaveFile): void {
    this.state = save.state;
    this.events.clear();
    this.flow.reset();
    this.acc = 0;
    this.last = Date.now();
    this.save();
    this.notify(true);
  }

  save(): void {
    if (!this.paused) saveGame(this.state);
  }

  drainEvents(): GameEvent[] {
    return this.events.drain();
  }

  subscribe(fn: () => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  private notify(force: boolean): void {
    const now = performance.now();
    if (!force && now - this.lastNotify < NOTIFY_INTERVAL_MS) return;
    this.lastNotify = now;
    for (const fn of this.listeners) fn();
  }

  /** 有效點擊上限 15 次/秒 */
  private allowClick(): boolean {
    const now = performance.now();
    this.clickTimes = this.clickTimes.filter((t) => now - t < 1000);
    if (this.clickTimes.length >= CLICK_CAP_PER_SEC) return false;
    this.clickTimes.push(now);
    return true;
  }

  private run<T>(fn: () => T): T {
    const r = fn();
    this.notify(true);
    return r;
  }

  // ---------- 玩家指令 ----------

  clickPlant(slot: number) {
    if (this.paused || !this.allowClick()) return 'none' as const;
    return this.run(() => cmd.clickPlant(this.state, slot, this.ctx));
  }

  clickCauldron(recipe: PotionId) {
    if (this.paused || !this.allowClick()) return 'none' as const;
    return this.run(() => cmd.clickCauldron(this.state, recipe, this.ctx));
  }

  /** 點客人結帳（備好貨的客人立刻成交） */
  clickCustomer(id: number) {
    if (this.paused || !this.allowClick()) return false;
    return this.run(() => checkoutByClick(this.state, id, this.ctx));
  }

  plantSeed(slot: number, m: MaterialId) {
    return this.run(() => cmd.plantSeed(this.state, slot, m));
  }

  // ---------- 看板娘與開心度 ----------

  get today(): string {
    return cmd.dayKeyOf(Date.now());
  }

  assignLumia(a: Assignment) {
    this.run(() => cmd.assignLumia(this.state, a));
  }

  /** 觸碰立繪；1 秒內觸碰 4 下以上算狂戳 */
  touchLumia(part: TouchPart): cmd.TouchResult {
    const now = performance.now();
    this.touchTimes = this.touchTimes.filter((t) => now - t < 1000);
    this.touchTimes.push(now);
    const spam = this.touchTimes.length >= MASCOT.spamTouches;
    return this.run(() => cmd.touchLumia(this.state, part, spam, this.today));
  }

  giveGift(id: string) {
    return this.run(() => cmd.giveGift(this.state, id));
  }

  setDecor(slot: number, id: string | null) {
    return this.run(() => cmd.setDecor(this.state, slot, id));
  }

  /** 分頁在前景與否（小心願與事件只在前景進行） */
  setForeground(on: boolean): void {
    this.ctx.foreground = on;
  }

  /** 劇情、信件、離線報告等視窗開著時，事件暫停 */
  setEventHold(on: boolean): void {
    this.ctx.eventHold = on;
  }

  /** 對進行中的事件操作（點中、拖曳放下、三選一） */
  eventAction(action: EventAction): EventActionResult {
    if (this.paused) return { ok: false };
    // 連點型（土豪勇者、流星）也受每秒點擊上限限制
    if (action.type === 'hit' && !this.allowClick()) return { ok: false };
    return this.run(() => eventAction(this.state, action, this.ctx));
  }

  redeem(id: string) {
    return this.run(() => cmd.redeem(this.state, id));
  }

  equipOutfit(o: OutfitId) {
    return this.run(() => cmd.equipOutfit(this.state, o));
  }

  startFever() {
    return this.run(() => cmd.startFever(this.state, this.today));
  }

  ringBell() {
    if (this.paused) return 'none' as const;
    return this.run(() => cmd.ringBell(this.state, this.ctx));
  }

  moveCauldron(from: number, to: number) {
    return this.run(() => cmd.moveCauldron(this.state, from, to));
  }

  setCrateSell(item: PotionId | MaterialId, on: boolean) {
    this.run(() => cmd.setCrateSell(this.state, item, on));
  }

  setCrateKeep(item: PotionId | MaterialId, pct: number) {
    this.run(() => cmd.setCrateKeep(this.state, item, pct));
  }

  replant(slot: number, m: MaterialId) {
    return this.run(() => cmd.replant(this.state, slot, m, this.ctx));
  }

  unlockRecipe(p: PotionId) {
    return this.run(() => cmd.unlockRecipe(this.state, p));
  }

  quote(key: cmd.PurchaseKey, mode: BuyMode) {
    return cmd.getQuote(this.state, key, mode);
  }

  purchase(key: cmd.PurchaseKey, mode: BuyMode) {
    return this.run(() => cmd.purchase(this.state, key, mode));
  }
}

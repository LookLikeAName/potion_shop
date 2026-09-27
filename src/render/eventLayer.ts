// 突發事件的場景表現：訪客、要點的東西、拖曳。
// 事件的數值與結果都在模擬裡（game.eventAction），這裡只負責畫面與把玩家的操作轉成指令。
// 要點的東西畫在飄字與粒子上面、外圍有脈動光暈，點擊範圍比圖大 1.5 倍；事件進行中那一區的飄字變淡。
import {
  Application, Circle, Container, Graphics, Rectangle, Text, type FederatedPointerEvent,
} from 'pixi.js';
import { EVENT_MAP, type EventId } from '../game/config/events';
import type { PotionId } from '../game/config/recipes';
import type { EventAction } from '../game/events';
import { formatFull } from '../game/format';
import type { Game } from '../game/game';
import type { ActiveEvent, GameState } from '../game/state';
import { showToast } from '../ui/store';
import { H, W, ZONES } from './layout';
import { FONT, Pic, type TextureBank } from './textures';

type Pt = { x: number; y: number };
type Rect = { x: number; y: number; w: number; h: number };

/** 事件層需要知道的場景資訊（由 createScene 提供） */
export interface EventRefs {
  /** 盆栽底部中心（浮空盆栽含漂浮位移） */
  potPos(i: number): Pt;
  /** 某種配方的大釜 x 座標（大釜底部 y 固定） */
  cauldronX(recipe: PotionId): number | null;
  cauldronY: number;
  /** 客人腳底的位置 */
  customerPos(id: number): Pt | null;
  /** 露米婭腳底的位置 */
  lumiaPos(): Pt;
  /** 看得到的收購箱（底部中心） */
  crates(): Pt[];
  float(text: string, x: number, y: number, color: number, big?: boolean): void;
  burst(x: number, y: number, color: number, count?: number, power?: number): void;
  ring(x: number, y: number, color: number, size?: number): void;
  /** 設定要變淡的飄字區域 */
  setDim(r: Rect | null): void;
}

const text = (s: string, size: number, fill = 0xffffff) =>
  new Text({
    text: s,
    style: { fontFamily: FONT, fontSize: size, fill, fontWeight: '700', align: 'center', stroke: { color: 0x2b1d14, width: Math.max(3, size / 6) } },
  });

/** 會蓋住場景的介面（舞台座標）；pointer-events: none 的也算，因為會擋住視線 */
const UI_BLOCKERS = ['.topbar', '.event-banner', '.wish-card', '.buff-bar', '.drawer.open'];

function uiBlockers(): Rect[] {
  const stage = document.getElementById('stage');
  if (!stage) return [];
  const sr = stage.getBoundingClientRect();
  const k = sr.width / W;
  if (!k) return [];
  const out: Rect[] = [];
  for (const sel of UI_BLOCKERS) {
    for (const el of document.querySelectorAll(sel)) {
      const r = el.getBoundingClientRect();
      if (r.width > 0 && r.height > 0) out.push({ x: (r.left - sr.left) / k, y: (r.top - sr.top) / k, w: r.width / k, h: r.height / k });
    }
  }
  return out;
}

/** 0 → 1 → 0 的來回（週期 1） */
const pingpong = (x: number) => 1 - Math.abs(((x % 2) + 2) % 2 - 1);

/**
 * 可以點的東西：圖 + 背後的脈動光暈（白色外框，跟任何背景都分得開）。
 * 點擊範圍是半徑 r 的 1.5 倍
 */
class Target extends Container {
  readonly glow = new Graphics();
  readonly body = new Container();
  alive = true;
  punch = 0;
  /** 被介面蓋住時自動推開（拖曳中的不推，才會跟著手指） */
  avoidUi = true;
  private phase = Math.random() * 6;

  constructor(readonly r: number, onTap: (t: Target, e: FederatedPointerEvent) => void, color = 0xfff6c0) {
    super();
    this.glow
      .circle(0, 0, r * 1.1).fill({ color, alpha: 0.28 })
      .circle(0, 0, r * 1.1).stroke({ width: 4, color: 0xffffff, alpha: 0.9 });
    this.addChild(this.glow, this.body);
    this.eventMode = 'static';
    this.cursor = 'pointer';
    this.hitArea = new Circle(0, 0, r * 1.5);
    this.on('pointerdown', (e: FederatedPointerEvent) => {
      if (!this.alive) return;
      e.stopPropagation();
      onTap(this, e);
    });
  }

  tick(dt: number): void {
    this.phase += dt;
    this.punch = Math.max(0, this.punch - dt * 4);
    const p = 0.5 + 0.5 * Math.sin(this.phase * 5);
    this.glow.alpha = 0.55 + 0.45 * p;
    this.glow.scale.set(1 + 0.12 * p);
    const sq = 1 + Math.sin(this.punch * Math.PI) * 0.25;
    this.body.scale.set(sq, 1 / sq);
  }

  kill(): void {
    this.alive = false;
    this.visible = false;
    this.eventMode = 'none';
  }
}

/** 每個事件的畫面控制 */
interface Stage {
  update(dt: number, a: ActiveEvent, s: GameState): void;
  /** 完成時飄字的位置 */
  anchor(): Pt;
  /** 拖曳用：舞台上的指標事件 */
  move?(p: Pt): void;
  down?(p: Pt): void;
  up?(p: Pt): void;
}

/** 事件進行中要變淡的飄字區域 */
const DIM: Record<EventId, Rect> = {
  goblin: ZONES.greenhouse, dew: ZONES.greenhouse, raincloud: ZONES.greenhouse, butterfly: ZONES.greenhouse,
  sneeze: ZONES.workshop, bubble: ZONES.workshop, perfect_heat: ZONES.workshop, apprentice: ZONES.workshop,
  hero: ZONES.shop, merchant: ZONES.shop, princess: ZONES.shop, guild_rush: { x: 1000, y: 80, w: 700, h: 330 },
  dream: ZONES.restRoom, letter: ZONES.restRoom, fortune: ZONES.shop, slime: ZONES.shop,
  meteor: { x: 0, y: 0, w: W, h: H },
};

/** 事件結束後畫面再留多久（淡出，蝴蝶飛完、泡泡破掉） */
const LINGER = 0.8;

export class EventLayer extends Container {
  private stage: Stage | null = null;
  private current: ActiveEvent | null = null;
  private root = new Container();
  private linger = 0;
  private lastAnchor: Pt = { x: W / 2, y: H / 2 };

  constructor(app: Application, private tex: TextureBank, private game: Game, private refs: EventRefs) {
    super();
    this.addChild(this.root);
    // 拖曳：跟著指標移動、放開、拿著時再點一下放下
    app.stage.on('globalpointermove', (e: FederatedPointerEvent) => this.stage?.move?.({ x: e.global.x, y: e.global.y }));
    app.stage.on('pointerdown', (e: FederatedPointerEvent) => this.stage?.down?.({ x: e.global.x, y: e.global.y }));
    app.stage.on('pointerup', (e: FederatedPointerEvent) => this.stage?.up?.({ x: e.global.x, y: e.global.y }));
    app.stage.on('pointerupoutside', (e: FederatedPointerEvent) => this.stage?.up?.({ x: e.global.x, y: e.global.y }));
  }

  /** 送出操作，回傳結果 */
  private act(action: EventAction) {
    return this.game.eventAction(action);
  }

  update(s: GameState, dt: number): void {
    const a = s.events.active;
    if (a !== this.current) {
      // 事件換了（或結束）：舊的畫面淡出，新的建起來
      if (this.current && this.stage) {
        this.lastAnchor = this.stage.anchor();
        this.linger = LINGER;
        this.root.eventMode = 'none';
      }
      this.current = a;
      if (a) this.build(a, s);
      this.refs.setDim(a ? DIM[a.id] : null);
    }
    if (this.linger > 0) {
      this.linger -= dt;
      this.root.alpha = Math.max(0, this.linger / LINGER);
      if (this.linger <= 0) this.clear();
      else if (this.stage && this.current === null) this.stage.update(dt, this.lastActive!, s);
      return;
    }
    if (a && this.stage) {
      this.lastActive = a;
      this.stage.update(dt, a, s);
      this.avoidUi();
    }
  }

  /**
   * 要點的東西不能被蓋在場景上的介面擋住（頂列、事件橫幅、小心願、增益列、打開的魔導書）：
   * 重疊時往最近的空位推開（往下、往左或往右，不往上）
   */
  private avoidUi(): void {
    const blockers = uiBlockers();
    if (blockers.length === 0) return;
    for (const c of this.root.children) {
      if (!(c instanceof Target) || !c.alive || !c.avoidUi) continue;
      const m = c.r * 1.3;
      for (const b of blockers) {
        if (c.x + m <= b.x || c.x - m >= b.x + b.w || c.y + m <= b.y || c.y - m >= b.y + b.h) continue;
        const down = b.y + b.h + m - c.y;
        const left = c.x - (b.x - m);
        const right = b.x + b.w + m - c.x;
        const canLeft = b.x - m > 0;
        const canRight = b.x + b.w + m < W;
        const best = Math.min(down, canLeft ? left : Infinity, canRight ? right : Infinity);
        if (best === down) c.y += down;
        else if (best === left) c.x -= left;
        else c.x += right;
      }
    }
  }

  private lastActive: ActiveEvent | null = null;

  private clear(): void {
    this.root.removeChildren().forEach((c) => c.destroy({ children: true }));
    this.root.alpha = 1;
    this.root.eventMode = 'passive';
    this.stage = null;
    this.linger = 0;
  }

  /** 事件的結果（由 createScene 的事件處理轉過來） */
  note(e: { id: EventId; result: 'start' | 'done' | 'leave' }): void {
    const p = this.stage?.anchor() ?? this.lastAnchor;
    if (e.result === 'done') {
      this.refs.float('完成！', p.x, p.y - 30, 0xfff08a, true);
      this.refs.burst(p.x, p.y, 0xffe066, 16, 1.4);
      this.refs.ring(p.x, p.y, 0xfff6c0, 1.4);
    }
  }

  private build(a: ActiveEvent, s: GameState): void {
    this.clear();
    this.lastActive = a;
    const make = BUILDERS[a.id];
    this.stage = make.call(this, a, s);
  }

  // ---------- 小工具（給各事件用） ----------

  target(r: number, onTap: (t: Target, e: FederatedPointerEvent) => void, color?: number): Target {
    const t = new Target(r, onTap, color);
    this.root.addChild(t);
    return t;
  }

  pic(id: string, parent: Container, anchorY = 0.5, w?: number, h?: number): Pic {
    const p = new Pic(this.tex, id, w, h);
    p.anchor.set(0.5, anchorY);
    parent.addChild(p);
    return p;
  }

  add<T extends Container>(o: T): T {
    this.root.addChild(o);
    return o;
  }

  /** 點中的回饋 */
  hitFx(t: Target, color = 0xfff08a): void {
    t.punch = 1;
    this.refs.burst(t.x, t.y, color, 10, 1);
  }

  /** 點一下就完成一步的目標：送出 hit，成功時的回饋 */
  tapHit(t: Target, kill: boolean, color?: number, extra?: EventAction): boolean {
    const r = this.act(extra ?? { type: 'hit' });
    if (!r.ok) return false;
    this.hitFx(t, color);
    if (r.gold) this.refs.float(`+${formatFull(r.gold)} 金`, t.x, t.y - 40, 0xffd34d, true);
    if (kill) t.kill();
    return true;
  }

  get refsForStage() {
    return this.refs;
  }

  get gameForStage() {
    return this.game;
  }
}

// ---------- 各事件 ----------

type Builder = (this: EventLayer, a: ActiveEvent, s: GameState) => Stage;

/** 追一個會跑的目標，點中 goal 下 */
const goblin: Builder = function () {
  const t = this.target(52, (tt) => this.tapHit(tt, false, 0x9dff8a));
  const pic = this.pic('npc_goblin', t.body, 1);
  pic.y = 50;
  let time = 0;
  let lastX = 0;
  return {
    update: (dt) => {
      time += dt;
      t.tick(dt);
      const g = ZONES.greenhouse;
      // 在溫室地板上來回跑，一邊跳一邊跑
      const x = g.x + 60 + (g.w - 120) * pingpong(time / 4);
      t.position.set(x, 935 - Math.abs(Math.sin(time * 7)) * 26);
      if (Math.abs(x - lastX) > 0.5) pic.face(x > lastX ? 1 : -1);
      lastX = x;
    },
    anchor: () => ({ x: t.x, y: t.y - 40 }),
  };
};

/** 盆栽上方的 3 顆朝露 */
const dew: Builder = function (a) {
  const slot = a.slot ?? 0;
  const drops = [-48, 0, 48].map((dx) => {
    const t = this.target(24, (tt) => this.tapHit(tt, true, 0xbfe8ff), 0xd8f4ff);
    this.pic('evt_dew', t.body);
    return { t, dx, ph: Math.random() * 6 };
  });
  let time = 0;
  return {
    update: (dt) => {
      time += dt;
      const p = this.refsForStage.potPos(slot);
      for (const d of drops) {
        d.t.tick(dt);
        d.t.position.set(p.x + d.dx, p.y - 245 + Math.sin(time * 2.4 + d.ph) * 8 + (d.dx === 0 ? -30 : 0));
      }
    },
    anchor: () => {
      const p = this.refsForStage.potPos(slot);
      return { x: p.x, y: p.y - 260 };
    },
  };
};

/**
 * 拖曳型：按住拖到目標放開；或點一下拿起來（跟著指標），再點目標放下。
 * resolve 把放下的位置換成指令（null = 不是有效的目標）
 */
function draggable(
  layer: EventLayer, t: Target, home: (time: number) => Pt,
  resolve: (p: Pt) => { action: EventAction; at: Pt } | null, wrongHint: string,
): Stage {
  let mode: 'idle' | 'drag' | 'carry' = 'idle';
  let from: Pt = { x: 0, y: 0 };
  let moved = false;
  let time = 0;
  const hl = layer.add(new Graphics());
  hl.eventMode = 'none';
  const drop = (p: Pt) => {
    const r = resolve(p);
    mode = 'idle';
    if (r && layer.gameForStage.eventAction(r.action).ok) {
      t.kill();
      layer.refsForStage.burst(r.at.x, r.at.y, 0xbfe8ff, 16, 1.2);
      return;
    }
    showToast(wrongHint);
  };
  // 按下目標：開始拖
  t.removeAllListeners('pointerdown');
  t.on('pointerdown', (e: FederatedPointerEvent) => {
    if (!t.alive) return;
    e.stopPropagation();
    if (mode === 'carry') {
      drop({ x: e.global.x, y: e.global.y });
      return;
    }
    mode = 'drag';
    moved = false;
    from = { x: e.global.x, y: e.global.y };
  });
  return {
    update: (dt, _a, _s) => {
      time += dt;
      t.tick(dt);
      t.avoidUi = mode === 'idle';
      if (mode === 'idle') {
        const h = home(time);
        t.position.set(h.x, h.y);
      }
      // 拿著的時候標出可以放的目標
      hl.clear();
      if (mode !== 'idle') {
        const r = resolve({ x: t.x, y: t.y });
        if (r) hl.circle(r.at.x, r.at.y, 70).stroke({ width: 6, color: 0x9dff8a, alpha: 0.9 });
      }
    },
    anchor: () => ({ x: t.x, y: t.y }),
    move: (p) => {
      if (mode === 'idle') return;
      if (mode === 'drag' && Math.hypot(p.x - from.x, p.y - from.y) > 20) moved = true;
      t.position.set(p.x, p.y);
    },
    up: (p) => {
      if (mode !== 'drag') return;
      if (moved) drop(p);
      // 沒有移動：拿起來，再點一下目標放下
      else mode = 'carry';
    },
    down: (p) => {
      // 拿著的時候點畫面其他地方（例如盆栽、大釜）：放在那裡
      if (mode === 'carry') {
        t.position.set(p.x, p.y);
        drop(p);
      }
    },
  };
}

/** 盆栽的中心（放下判定用） */
function potAt(layer: EventLayer, s: GameState, p: Pt): { slot: number; at: Pt } | null {
  let best: { slot: number; at: Pt; d: number } | null = null;
  s.slots.forEach((sl, i) => {
    if (!sl.open || !sl.plant) return;
    const b = layer.refsForStage.potPos(i);
    const at = { x: b.x, y: b.y - 90 };
    const d = Math.hypot(p.x - at.x, p.y - at.y);
    if (d < 110 && (!best || d < best.d)) best = { slot: i, at, d };
  });
  return best;
}

const raincloud: Builder = function (_a, s0) {
  const t = this.target(50, () => {});
  this.pic('evt_raincloud', t.body);
  const game = this.gameForStage;
  return draggable(
    this, t,
    (time) => ({ x: 310 + Math.sin(time * 0.8) * 120, y: 540 + Math.sin(time * 1.7) * 14 }),
    (p) => {
      const hit = potAt(this, game.state ?? s0, p);
      return hit ? { action: { type: 'drop', slot: hit.slot }, at: hit.at } : null;
    },
    '把雨雲寶寶放到有種植物的盆栽上喔',
  );
};

const apprentice: Builder = function () {
  const t = this.target(56, () => {});
  const pic = this.pic('evt_apprentice', t.body, 1);
  pic.y = 60;
  const refs = this.refsForStage;
  const game = this.gameForStage;
  return draggable(
    this, t,
    (time) => ({ x: 640, y: 925 - Math.abs(Math.sin(time * 3)) * 8 }),
    (p) => {
      for (const c of game.state.cauldrons) {
        const x = refs.cauldronX(c.recipe);
        if (x === null) continue;
        const at = { x, y: refs.cauldronY - 60 };
        if (Math.abs(p.x - x) < 70 && p.y > refs.cauldronY - 200 && p.y < refs.cauldronY + 60) {
          return { action: { type: 'drop', recipe: c.recipe }, at };
        }
      }
      return null;
    },
    '把精靈學徒放到大釜上喔',
  );
};

/** 5 隻亂飛的蝴蝶，點中的飛去停在盆栽上 */
const butterfly: Builder = function () {
  const refs = this.refsForStage;
  const g = ZONES.greenhouse;
  const list = Array.from({ length: 5 }, (_, k) => {
    const b = {
      t: null as unknown as Target, cx: g.x + 90 + (k / 4) * (g.w - 180), cy: 560 + (k % 2) * 180,
      ph: Math.random() * 6, fly: null as null | { from: Pt; to: Pt; k: number },
    };
    b.t = this.target(30, (tt) => {
      const r = this.gameForStage.eventAction({ type: 'hit' });
      if (!r.ok) return;
      this.hitFx(tt, 0x9ef0d8);
      tt.alive = false;
      tt.eventMode = 'none';
      if (r.slot !== undefined) {
        const p = refs.potPos(r.slot);
        b.fly = { from: { x: tt.x, y: tt.y }, to: { x: p.x + (Math.random() - 0.5) * 50, y: p.y - 175 }, k: 0 };
      }
    }, 0xc8fff0);
    this.pic('evt_butterfly', b.t.body);
    return b;
  });
  let time = 0;
  return {
    update: (dt) => {
      time += dt;
      for (const b of list) {
        b.t.tick(dt);
        // 翅膀拍動
        b.t.body.scale.x *= 0.75 + 0.25 * Math.abs(Math.sin(time * 14 + b.ph));
        if (b.fly) {
          b.fly.k = Math.min(1, b.fly.k + dt / 0.8);
          const k = 1 - (1 - b.fly.k) ** 2;
          b.t.position.set(b.fly.from.x + (b.fly.to.x - b.fly.from.x) * k, b.fly.from.y + (b.fly.to.y - b.fly.from.y) * k - Math.sin(k * Math.PI) * 60);
          b.t.glow.visible = false;
        } else if (b.t.alive) {
          b.t.position.set(
            Math.max(g.x + 40, Math.min(g.x + g.w - 40, b.cx + Math.sin(time * 0.9 + b.ph) * 150)),
            b.cy + Math.sin(time * 1.3 + b.ph * 2) * 110,
          );
        }
      }
    },
    anchor: () => ({ x: g.x + g.w / 2, y: 560 }),
  };
};

/** 火蜥蜴的噴嚏：火花噴上去再慢慢飄落，點掉它們 */
const sneeze: Builder = function (_a, s) {
  const refs = this.refsForStage;
  const sources = s.cauldrons.filter((c) => c.salamander > 0)
    .map((c) => refs.cauldronX(c.recipe)).filter((x): x is number => x !== null);
  if (sources.length === 0) sources.push(800);
  for (const x of sources) refs.float('哈啾！', x - 50, refs.cauldronY - 40, 0xffb347, true);
  const sparks: { t: Target; vx: number; vy: number; age: number }[] = [];
  let time = 0;
  let spawned = 0;
  return {
    update: (dt, a) => {
      time += dt;
      const goal = EVENT_MAP.sneeze.goal;
      if (spawned < goal && time >= 0.3 + spawned * 0.75) {
        const x = sources[spawned % sources.length] - 50;
        const t = this.target(28, (tt) => this.tapHit(tt, true, 0xffa040), 0xffd9a0);
        this.pic('evt_spark', t.body);
        t.position.set(x, refs.cauldronY - 20);
        sparks.push({ t, vx: (Math.random() - 0.5) * 260, vy: -700 - Math.random() * 160, age: 0 });
        spawned++;
      }
      for (const p of sparks) {
        if (!p.t.alive) continue;
        p.t.tick(dt);
        p.age += dt;
        p.vy = Math.min(p.vy + 900 * dt, 110);
        p.vx *= 1 - Math.min(1, dt * 0.8);
        p.t.x += (p.vx + Math.sin(p.age * 4) * 40) * dt;
        p.t.y += p.vy * dt;
        p.t.rotation = Math.sin(p.age * 6) * 0.3;
        if (p.t.y > 1010) p.t.kill();
      }
      void a;
    },
    anchor: () => ({ x: sources[0] - 50, y: refs.cauldronY - 200 }),
  };
};

/** 大釜冒出的彩虹泡泡，慢慢飄走 */
const bubble: Builder = function (a) {
  const refs = this.refsForStage;
  const x0 = refs.cauldronX(a.recipe!) ?? 800;
  const t = this.target(58, (tt) => {
    if (this.tapHit(tt, true, 0xd8c8ff)) refs.ring(tt.x, tt.y, 0xffffff, 1.2);
  }, 0xf0e8ff);
  const pic = this.pic('evt_bubble', t.body);
  let time = 0;
  return {
    update: (dt) => {
      time += dt;
      t.tick(dt);
      const k = Math.min(1, time / EVENT_MAP.bubble.time);
      t.position.set(x0 + Math.sin(time * 1.6) * 30, refs.cauldronY - 150 - k * 300);
      pic.tint = rainbowTint(time * 0.4);
      t.body.scale.set(0.6 + 0.4 * Math.min(1, time * 2));
    },
    anchor: () => ({ x: t.x, y: t.y }),
  };
};

function rainbowTint(t: number): number {
  const h = (((t % 1) + 1) % 1) * Math.PI * 2;
  const ch = (o: number) => Math.round((0.78 + 0.22 * Math.sin(h + o)) * 255);
  return (ch(0) << 16) | (ch(2.1) << 8) | ch(4.2);
}

/** 火候錶：指針來回擺，金色區間裡點下去 */
const perfectHeat: Builder = function (a) {
  const refs = this.refsForStage;
  const x0 = refs.cauldronX(a.recipe!) ?? 800;
  const GW = 300;
  const GH = 48;
  const gauge = this.add(new Container());
  gauge.position.set(Math.max(GW / 2 + 610, Math.min(1260 - GW / 2, x0)), refs.cauldronY - 250);
  const g = new Graphics();
  const label = text('', 26, 0xfff08a);
  label.anchor.set(0.5);
  label.y = -52;
  gauge.addChild(g, label);
  gauge.eventMode = 'static';
  gauge.cursor = 'pointer';
  gauge.hitArea = new Rectangle(-GW / 2 - 30, -GH / 2 - 40, GW + 60, GH + 80);
  let zone = 0.3 + Math.random() * 0.4;
  const half = 0.11;
  let time = 0;
  let needle = 0;
  let flash = 0;
  gauge.on('pointerdown', (e: FederatedPointerEvent) => {
    e.stopPropagation();
    const hit = Math.abs(needle - zone) <= half;
    const r = this.gameForStage.eventAction({ type: hit ? 'hit' : 'miss' });
    if (!r.ok) return;
    label.text = hit ? '完美火候！' : '差一點…';
    label.style.fill = hit ? 0xfff08a : 0xd0c0b0;
    flash = 1;
    if (hit) refs.burst(gauge.x, gauge.y, 0xffc234, 14, 1.2);
    zone = 0.2 + Math.random() * 0.6;
  });
  return {
    update: (dt, act) => {
      time += dt;
      flash = Math.max(0, flash - dt * 1.5);
      needle = pingpong(time * 0.75);
      const left = EVENT_MAP.perfect_heat.goal - act.tries;
      g.clear()
        .roundRect(-GW / 2 - 8, -GH / 2 - 8, GW + 16, GH + 16, 14).fill({ color: 0x2b1d14, alpha: 0.9 })
        .stroke({ width: 4, color: 0xffffff, alpha: 0.6 + 0.4 * Math.sin(time * 5) })
        .roundRect(-GW / 2, -GH / 2, GW, GH, 10).fill({ color: 0x5a3a2a })
        .roundRect(-GW / 2 + (zone - half) * GW, -GH / 2, half * 2 * GW, GH, 8).fill({ color: 0xffc234, alpha: 0.95 })
        .rect(-GW / 2 + needle * GW - 3, -GH / 2 - 10, 6, GH + 20).fill({ color: 0xffffff });
      for (let k = 0; k < EVENT_MAP.perfect_heat.goal; k++) {
        g.circle((k - 1) * 22, GH / 2 + 20, 7).fill({ color: k < left ? 0xffc234 : 0x5a4a40 }).stroke({ width: 2, color: 0x2b1d14 });
      }
      if (flash <= 0 && label.text) label.text = '';
      label.alpha = Math.min(1, flash * 2);
    },
    anchor: () => ({ x: gauge.x, y: gauge.y }),
  };
};

/** 站在櫃台前的訪客（土豪勇者：連點；行商、占卜婆婆：只是站著，選項在畫面上方） */
function visitor(layer: EventLayer, id: string, tappable: boolean, color = 0xffd34d): { t: Target; stage: Stage } {
  const t = layer.target(88, (tt) => {
    if (tappable) layer.tapHit(tt, false, color);
  });
  const pic = layer.pic(id, t.body, 1);
  pic.y = 95;
  if (!tappable) {
    t.eventMode = 'none';
    t.glow.visible = false;
  }
  let time = 0;
  // 從門口走進來
  const X = 1395;
  return {
    t,
    stage: {
      update: (dt) => {
        time += dt;
        t.tick(dt);
        const k = Math.min(1, time / 0.8);
        t.position.set(1900 + (X - 1900) * (1 - (1 - k) ** 2), 905 - (k < 1 ? Math.abs(Math.sin(time * 12)) * 10 : 0));
      },
      anchor: () => ({ x: t.x, y: t.y - 120 }),
    },
  };
}

const hero: Builder = function () {
  return visitor(this, 'npc_rich_hero', true).stage;
};
const merchant: Builder = function () {
  return visitor(this, 'evt_merchant', false).stage;
};
const fortune: Builder = function () {
  return visitor(this, 'evt_fortune', false).stage;
};

/** 公主：隊伍裡某位客人頭上偶爾閃過皇冠的光（點那位客人） */
const princess: Builder = function (a) {
  const refs = this.refsForStage;
  const g = this.add(new Graphics());
  g.eventMode = 'none';
  let time = 0;
  let last: Pt = { x: 1700, y: 800 };
  return {
    update: (dt) => {
      time += dt;
      const p = a.customer !== undefined ? refs.customerPos(a.customer) : null;
      g.clear();
      if (!p) return;
      last = { x: p.x, y: p.y - 200 };
      // 每 2.4 秒閃一下（0.7 秒）
      const ph = time % 2.4;
      if (ph > 0.7) return;
      const k = Math.sin((ph / 0.7) * Math.PI);
      const cx = p.x + 18;
      const cy = p.y - 190;
      g.poly([cx - 18, cy + 8, cx - 18, cy - 8, cx - 9, cy, cx, cy - 12, cx + 9, cy, cx + 18, cy - 8, cx + 18, cy + 8])
        .fill({ color: 0xffd34d, alpha: k }).stroke({ width: 2, color: 0xffffff, alpha: k });
      g.star(cx + 26, cy - 20, 4, 14 * k + 2, 3).fill({ color: 0xffffff, alpha: k });
    },
    anchor: () => last,
  };
};

/** 所有收購箱一起發光，點任何一個 */
const guildRush: Builder = function () {
  const refs = this.refsForStage;
  const targets = refs.crates().map((p) => {
    const t = this.target(56, (tt) => this.tapHit(tt, false, 0xe8c56a), 0xffe9a8);
    t.position.set(p.x, p.y - 42);
    const mark = text('！', 34, 0xffd34d);
    mark.anchor.set(0.5);
    mark.y = -78;
    t.body.addChild(mark);
    return t;
  });
  let time = 0;
  return {
    update: (dt) => {
      time += dt;
      for (const t of targets) {
        t.tick(dt);
        t.body.children[0].y = -78 + Math.sin(time * 6) * 5;
      }
    },
    anchor: () => (targets[0] ? { x: targets[0].x, y: targets[0].y - 60 } : { x: 1300, y: 250 }),
  };
};

/** 露米婭的夢泡泡：從她頭上一個個飄出來 */
const dream: Builder = function () {
  const refs = this.refsForStage;
  const list: { t: Target; born: number; dx: number }[] = [];
  let time = 0;
  return {
    update: (dt) => {
      time += dt;
      if (list.length < 3 && time >= list.length * 1.1) {
        const t = this.target(30, (tt) => this.tapHit(tt, true, 0xc8d8ff), 0xe0e8ff);
        const g = new Graphics().circle(0, 0, 26).fill({ color: 0xe6eeff, alpha: 0.85 }).stroke({ width: 3, color: 0x9ab0e8 });
        const z = text(['♪', '★', '♥'][list.length], 24, 0x8a9ae0);
        z.anchor.set(0.5);
        t.body.addChild(g, z);
        list.push({ t, born: time, dx: (list.length - 1) * 75 });
      }
      const l = refs.lumiaPos();
      for (const b of list) {
        b.t.tick(dt);
        const age = time - b.born;
        // 休息室在二樓，頭頂上方很快就碰到頂列：只往上飄一點，被介面蓋住時由 avoidUi 推開
        b.t.position.set(l.x + b.dx + Math.sin(age * 1.8) * 14, l.y - 100 - Math.min(90, age * 40));
      }
    },
    anchor: () => {
      const l = refs.lumiaPos();
      return { x: l.x, y: l.y - 200 };
    },
  };
};

/** 貓頭鷹叼著信飛進休息室 */
const letter: Builder = function () {
  const t = this.target(56, (tt) => this.tapHit(tt, true, 0xfff6c0));
  const pic = this.pic('evt_letter', t.body);
  pic.face(-1);
  let time = 0;
  const to = { x: 980, y: 215 };
  return {
    update: (dt) => {
      time += dt;
      t.tick(dt);
      const k = Math.min(1, time / 2.2);
      const e = 1 - (1 - k) ** 3;
      t.position.set(2000 + (to.x - 2000) * e, 150 + (to.y - 150) * e + Math.sin(time * 4) * 10);
      t.body.scale.y *= 0.92 + 0.08 * Math.abs(Math.sin(time * 9));
    },
    anchor: () => ({ x: t.x, y: t.y }),
  };
};

/** 流星雨：畫面變暗，流星一顆顆劃過 */
const meteor: Builder = function () {
  const dark = this.add(new Graphics().rect(0, 0, W, H).fill({ color: 0x0a0a30 }));
  dark.eventMode = 'none';
  dark.alpha = 0;
  const list: { t: Target; trail: Graphics; vx: number; vy: number; age: number }[] = [];
  let time = 0;
  return {
    update: (dt, a) => {
      time += dt;
      dark.alpha = Math.min(0.5, time * 0.5) * (a.time < 1 ? Math.max(0, a.time) : 1);
      const goal = EVENT_MAP.meteor.goal;
      if (list.length < goal && time >= 0.4 + list.length * 1.3) {
        const trail = this.add(new Graphics());
        trail.eventMode = 'none';
        const t = this.target(32, (tt) => {
          if (this.tapHit(tt, true, 0xfff0a0)) trail.visible = false;
        }, 0xfff6c0);
        this.pic('evt_meteor', t.body);
        t.position.set(1000 + Math.random() * 850, 100 + Math.random() * 120);
        list.push({ t, trail, vx: -440 - Math.random() * 120, vy: 220 + Math.random() * 60, age: 0 });
      }
      for (const m of list) {
        if (!m.t.alive) continue;
        m.t.tick(dt);
        m.age += dt;
        m.t.x += m.vx * dt;
        m.t.y += m.vy * dt;
        m.trail.clear()
          .moveTo(m.t.x, m.t.y).lineTo(m.t.x - m.vx * 0.35, m.t.y - m.vy * 0.35)
          .stroke({ width: 8, color: 0xfff6c0, alpha: 0.6 });
        if (m.age > 2.2) {
          m.t.kill();
          m.trail.visible = false;
        }
      }
    },
    anchor: () => ({ x: W / 2, y: 260 }),
  };
};

/** 史萊姆在店裡蹦來蹦去 */
const slime: Builder = function () {
  const t = this.target(44, (tt) => this.tapHit(tt, false, 0x8fe0a0), 0xd8ffe0);
  const pic = this.pic('evt_slime', t.body, 1);
  pic.y = 30;
  let from = 1300;
  let to = 1500;
  let k = 1;
  let wait = 0.3;
  return {
    update: (dt) => {
      t.tick(dt);
      if (k >= 1) {
        wait -= dt;
        if (wait <= 0) {
          from = to;
          to = 1260 + Math.random() * 560;
          k = 0;
          wait = 0.25 + Math.random() * 0.3;
        }
      } else {
        k = Math.min(1, k + dt / 0.55);
      }
      t.position.set(from + (to - from) * k, 950 - Math.sin(k * Math.PI) * 90);
      if (to !== from) pic.face(to > from ? 1 : -1);
    },
    anchor: () => ({ x: t.x, y: t.y - 30 }),
  };
};

const BUILDERS: Record<EventId, Builder> = {
  goblin, dew, raincloud, butterfly,
  sneeze, bubble, perfect_heat: perfectHeat, apprentice,
  hero, merchant, princess, guild_rush: guildRush,
  dream, letter, fortune, meteor, slime,
};

import {
  Application, BitmapFont, BitmapText, Container, Graphics, GraphicsContext, Rectangle, Sprite, Text, Texture,
  type FederatedPointerEvent,
} from 'pixi.js';
import { ACHIEVEMENTS } from '../game/config/achievements';
import { CUSTOMER, UPGRADE_FX } from '../game/config/balance';
import { GIFT_MAP } from '../game/config/gifts';
import { WISH, WISH_LINES } from '../game/config/wishes';
import { ASSIGNMENTS, LINES, MUTTER, MUTTER_LINES, type Assignment } from '../game/config/mascot';
import { pickMutter } from '../game/mutter';
import { PLANTS } from '../game/config/plants';
import { RECIPES, type PotionId } from '../game/config/recipes';
import { activeCombo, nextLockedRecipes } from '../game/commands';
import { formatFull, formatNumber } from '../game/format';
import type { Game } from '../game/game';
import { missingInputs, type CrateKind, type GameEvent } from '../game/sim';
import { CRATE_FOR, CRATE_MATERIALS, SQUIRREL } from '../game/config/upgrades';
import type { CustomerState, GameState } from '../game/state';
import { tutorialStep } from '../game/tutorial';
import { effect } from '@preact/signals';
import { FLOAT_LIMITS, LOW_QUALITY_SCALE, PARTICLE_SCALE, decoTier, perf } from './perf';
import { playSfx, setLoop } from '../audio/sfx';
import { playBubbleVoice } from '../audio/voice';
import {
  autoHarvest, brewPassiveSpeed, growthSpeed, hasAutoCheckout, payTime, has, isRelaxing, isResting, isSleeping, isTired, milestoneCount, recipeInputs,
  decorSlots,
  refineLevel, workZone,
} from '../game/stats';
import { letterOpen, lumiaOpen, openDrawer, showNewEventPage, showToast } from '../ui/store';
import { t } from '../i18n';
import { cursorStyle, startGrabbing } from '../ui/cursors';
import { EVENT_LINES, EVENT_MAP } from '../game/config/events';
import { EventLayer } from './eventLayer';
import {
  ASSIGN_ZONES, CAULDRON_X, CAULDRON_Y, CHECKOUT_X, COUNTER, DOOR, FLOATING_SLOT_FROM, FLOOR_1F_Y, FLOOR_2F_Y, LEAVE_Y,
  CRATE_PANEL_Y, CRATE_POS, DECOR_POS, FLOOR_SPLIT_Y, H, LUMIA_AT_CAULDRON, LUMIA_AT_POT, LUMIA_COUNTER, LUMIA_COUNTER_FRONT, OFFSTAGE_X, PROPS,
  QUEUE_X, QUEUE_Y, REST_POS, SHELF_Y, SLOT_POS, W, ZONES,
} from './layout';
import { PaperDoll } from './paperDoll';
import { Pic, TextureBank, uiFont } from './textures';

/** 頂部資源列的高度（舞台座標；小螢幕時 UI 會放大）：場景上方這段被它蓋住 */
function topBarHeight(): number {
  return document.querySelector<HTMLElement>('.topbar')?.offsetHeight ?? 76;
}

const text = (s: string, size: number, fill = 0xffffff, weight: '400' | '700' = '700') =>
  new Text({
    text: s,
    style: { fontFamily: uiFont(), fontSize: size, fill, fontWeight: weight, align: 'center', stroke: { color: 0x2b1d14, width: Math.max(3, size / 6) } },
  });

const lighten = (c: number, k = 0.45) => lerpColor(c, 0xffffff, k);

/**
 * 顯示速度上限（秒）：一輪收成／熬煮比這個還快時，改用「高速模式」表現，
 * 進度條以這個速度循環（飄字照常每次都跳，保留打擊感）。
 */
const FAST_CYCLE = 0.5;

/**
 * 高速模式分級（0 = 一般）：一輪越短（每秒收成／熬煮越多次），效果越浮誇。
 * 1 級：每秒 2~8 輪；2 級：8~40 輪；3 級：40 輪以上。
 */
type FastTier = 0 | 1 | 2 | 3;
function fastTier(cycle: number): FastTier {
  if (!(cycle < FAST_CYCLE)) return 0;
  if (cycle >= FAST_CYCLE / 4) return 1;
  if (cycle >= FAST_CYCLE / 20) return 2;
  return 3;
}

/** 各級高速模式的表現參數 */
const TIER_FX = {
  1: { plantCycle: 0.22, burst: 6, power: 1, sway: 0.07, bubbles: 4, bubbleSpeed: 3, flash: 0.35, ring: false, size: 16 },
  2: { plantCycle: 0.15, burst: 9, power: 1.2, sway: 0.1, bubbles: 5, bubbleSpeed: 5, flash: 0.6, ring: true, size: 18 },
  3: { plantCycle: 0.1, burst: 12, power: 1.45, sway: 0.13, bubbles: 6, bubbleSpeed: 8, flash: 0.9, ring: true, size: 20 },
} as const;

/** 彩虹色（3 級高速模式用） */
function rainbow(t: number): number {
  const h = ((t % 1) + 1) % 1 * 6;
  const x = 1 - Math.abs((h % 2) - 1);
  const [r, g, b] = h < 1 ? [1, x, 0] : h < 2 ? [x, 1, 0] : h < 3 ? [0, 1, x] : h < 4 ? [0, x, 1] : h < 5 ? [x, 0, 1] : [1, 0, x];
  // 粉彩化，符合可愛的畫風
  const ch = (v: number) => Math.round((0.55 + 0.45 * v) * 255);
  return (ch(r) << 16) | (ch(g) << 8) | ch(b);
}

// 粒子共用同一份幾何，只換顏色與縮放
const DOT = new GraphicsContext().circle(0, 0, 1).fill({ color: 0xffffff });
const RING = new GraphicsContext().circle(0, 0, 50).stroke({ width: 5, color: 0xffffff });

/**
 * 物件池：用完的顯示物件藏起來重複使用，不一直建立／銷毀。
 * 高速模式每秒會噴出上百個粒子與飄字，一直 new / destroy 會讓畫面卡頓、記憶體越積越多。
 */
class Pool<T extends Container> {
  private free: T[] = [];

  constructor(private parent: Container, private make: () => T) {}

  get(): T {
    const o = this.free.pop() ?? this.parent.addChild(this.make());
    o.visible = true;
    return o;
  }

  put(o: T): void {
    o.visible = false;
    this.free.push(o);
  }
}

/** 就地移除已結束的項目（不每幀建立新陣列），回傳剩下的數量 */
function sweep<T extends { life: number }>(items: T[], release: (it: T) => void): void {
  let n = 0;
  for (const it of items) {
    if (it.life > 0) items[n++] = it;
    else release(it);
  }
  items.length = n;
}

interface Particle { g: Graphics; vx: number; vy: number; life: number; max: number; r: number }
interface Ring { g: Graphics; life: number; max: number; from: number; to: number }

/** 簡單的粒子：從某點噴出、受重力落下、淡出；另有擴散的光環（都用物件池） */
class ParticleLayer extends Container {
  constructor() {
    super();
    // 純顯示，不擋點擊
    this.eventMode = 'none';
  }

  private items: Particle[] = [];
  private rings: Ring[] = [];
  private dots = new Pool(this, () => new Graphics(DOT));
  private ringPool = new Pool(this, () => {
    const g = new Graphics(RING);
    g.blendMode = 'add';
    return g;
  });
  private static readonly MAX = 360;
  private static readonly MAX_RINGS = 30;

  burst(x: number, y: number, color: number, count = 8, power = 1): void {
    // 效能設定：精簡時粒子少一點，最少時不噴
    const n = Math.round(count * PARTICLE_SCALE[perf.value.effects]);
    for (let k = 0; k < n; k++) {
      // 滿了就重用最舊的那一顆
      const old = this.items.length >= ParticleLayer.MAX ? this.items.shift()! : null;
      const g = old?.g ?? this.dots.get();
      g.tint = lerpColor(color, 0xffffff, Math.random() * 0.5);
      g.position.set(x, y);
      const a = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI * 1.2;
      const sp = (160 + Math.random() * 220) * power;
      const life = 0.45 + Math.random() * 0.35;
      this.items.push({ g, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life, max: life, r: (3 + Math.random() * 4) * Math.sqrt(power) });
    }
  }

  /** 從中心擴散開的光環 */
  ring(x: number, y: number, color: number, size = 1): void {
    if (perf.value.effects !== 'full') return;
    const old = this.rings.length >= ParticleLayer.MAX_RINGS ? this.rings.shift()! : null;
    const g = old?.g ?? this.ringPool.get();
    g.tint = color;
    g.position.set(x, y);
    this.rings.push({ g, life: 0.4, max: 0.4, from: 0.3 * size, to: 1.3 * size });
  }

  update(dt: number): void {
    for (const p of this.items) {
      p.life -= dt;
      p.vy += 700 * dt;
      p.g.x += p.vx * dt;
      p.g.y += p.vy * dt;
      const k = Math.max(0, p.life / p.max);
      p.g.alpha = k;
      p.g.scale.set(p.r * (0.5 + 0.5 * k));
    }
    sweep(this.items, (p) => this.dots.put(p.g));

    for (const r of this.rings) {
      r.life -= dt;
      const k = 1 - Math.max(0, r.life / r.max);
      r.g.scale.set(r.from + (r.to - r.from) * (1 - (1 - k) ** 2));
      r.g.alpha = Math.max(0, r.life / r.max) * 0.9;
    }
    sweep(this.rings, (r) => this.ringPool.put(r.g));
  }
}

/** 點擊回饋用的四角小星星與細光環 */
const SPARK = new GraphicsContext()
  .poly([0, -1, 0.22, -0.22, 1, 0, 0.22, 0.22, 0, 1, -0.22, 0.22, -1, 0, -0.22, -0.22])
  .fill({ color: 0xffffff });
const TAP_RING = new GraphicsContext().circle(0, 0, 30).stroke({ width: 4, color: 0xffffff });
const TAP_RING_SHADOW = new GraphicsContext().circle(0, 0, 30).stroke({ width: 8, color: 0x2b1d14, alpha: 0.35 });

interface Spark { g: Graphics; vx: number; vy: number; life: number; max: number; size: number; spin: number }
interface TapRing { g: Container; life: number; max: number; size: number; alpha: number }

/**
 * 點擊回饋：點下去的位置冒出光環與小星星，顏色依點到的東西（盆栽綠、大釜橘、客人金、露米婭粉…），
 * 讓玩家看得出剛剛點到了什麼；點到空處只有一個淡淡的小圈
 */
class TapFx extends Container {
  private sparks: Spark[] = [];
  private rings: TapRing[] = [];
  private sparkPool = new Pool(this, () => new Graphics(SPARK));
  private ringPool = new Pool(this, () => {
    const c = new Container();
    c.addChild(new Graphics(TAP_RING_SHADOW), new Graphics(TAP_RING));
    return c;
  });
  private static readonly MAX_SPARKS = 120;

  constructor() {
    super();
    this.eventMode = 'none';
  }

  /** color = null：沒點到可以互動的東西 */
  spawn(x: number, y: number, color: number | null): void {
    const hit = color !== null;
    const c = color ?? 0xffffff;
    const ring = this.ringPool.get();
    (ring.children[1] as Graphics).tint = lighten(c, 0.25);
    ring.position.set(x, y);
    this.rings.push({ g: ring, life: 0.32, max: 0.32, size: hit ? 1.25 : 0.8, alpha: hit ? 1 : 0.5 });
    if (!hit) return;
    const n = 6;
    const start = Math.random() * Math.PI * 2;
    for (let k = 0; k < n; k++) {
      if (this.sparks.length >= TapFx.MAX_SPARKS) this.sparkPool.put(this.sparks.shift()!.g);
      const g = this.sparkPool.get();
      g.tint = lerpColor(c, 0xffffff, 0.2 + Math.random() * 0.4);
      g.position.set(x, y);
      const a = start + (k / n) * Math.PI * 2 + (Math.random() - 0.5) * 0.5;
      const sp = 150 + Math.random() * 110;
      const life = 0.38 + Math.random() * 0.17;
      this.sparks.push({ g, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life, max: life, size: 8 + Math.random() * 5, spin: (Math.random() - 0.5) * 10 });
    }
  }

  update(dt: number): void {
    for (const p of this.sparks) {
      p.life -= dt;
      // 往外飛、慢慢減速，稍微往下飄
      const drag = Math.max(0, 1 - 5 * dt);
      p.vx *= drag;
      p.vy = p.vy * drag + 120 * dt;
      p.g.x += p.vx * dt;
      p.g.y += p.vy * dt;
      p.g.rotation += p.spin * dt;
      const k = Math.max(0, p.life / p.max);
      p.g.alpha = Math.min(1, k * 1.6);
      // 先長大再縮小，像閃一下
      p.g.scale.set(p.size * Math.sin(Math.PI * Math.min(1, (1 - k) * 1.4 + 0.15)));
    }
    sweep(this.sparks, (p) => this.sparkPool.put(p.g));
    for (const r of this.rings) {
      r.life -= dt;
      const k = 1 - Math.max(0, r.life / r.max);
      r.g.scale.set(r.size * (0.35 + 0.9 * (1 - (1 - k) ** 3)));
      r.g.alpha = r.alpha * Math.max(0, r.life / r.max);
    }
    sweep(this.rings, (r) => this.ringPool.put(r.g));
  }
}

/** 高速模式的速率字（實際每秒產量）：級數越高字越大，3 級變彩虹色並跟著節奏跳動 */
function setRateText(label: Text, tier: FastTier, rate: number, time: number): void {
  if (tier === 0) {
    label.text = '';
    return;
  }
  const fx = TIER_FX[tier];
  // 文字一改就要重畫貼圖：數字每秒只更新 4 次；大小用縮放、顏色用 tint（都不用重畫）
  const last = rateTextAt.get(label) ?? -1;
  if (time - last >= 0.25 || time < last || label.text === '') {
    rateTextAt.set(label, time);
    label.text = t('scene.perSec', { n: formatNumber(rate) });
  }
  // 彩虹色與跳動是裝飾（效能設定精簡、最少時不做）
  const deco = decoTier(tier);
  label.tint = deco === 3 ? rainbow(time * 0.8) : 0xffe066;
  const beat = deco >= 2 ? 1 + 0.07 * Math.abs(Math.sin(time * 9)) : 1;
  label.scale.set((fx.size / RATE_TEXT_SIZE) * beat);
}

/** 速率字的基準字級（白字，實際顏色用 tint） */
const RATE_TEXT_SIZE = 16;
const rateTextAt = new WeakMap<Text, number>();

/** 高速模式進度條的閃爍金色 */
const shimmer = (t: number) => lerpColor(0xffc234, 0xfff6c0, 0.5 + 0.5 * Math.sin(t * 12));

/** 量測實際產量（每秒），用平滑平均避免數字亂跳 */
class RateMeter {
  value = 0;
  private recent = 0;

  add(amount: number): void {
    this.recent += amount;
  }

  update(dt: number): void {
    if (dt <= 0) return;
    this.value += (this.recent / dt - this.value) * Math.min(1, dt / 1.5);
    this.recent = 0;
  }
}

function lerpColor(a: number, b: number, k: number): number {
  const ch = (c: number, s: number) => (c >> s) & 255;
  const mix = (s: number) => Math.round(ch(a, s) + (ch(b, s) - ch(a, s)) * k);
  return (mix(16) << 16) | (mix(8) << 8) | mix(0);
}

// ---------- 小元件 ----------

class Bar extends Graphics {
  constructor(private bw: number, private bh = 12) {
    super();
  }
  set(ratio: number, color: number): void {
    const r = Math.max(0, Math.min(1, ratio));
    this.clear()
      .roundRect(-this.bw / 2, 0, this.bw, this.bh, this.bh / 2).fill({ color: 0x1b120c, alpha: 0.75 })
      .roundRect(-this.bw / 2 + 2, 2, Math.max(0, (this.bw - 4) * r), this.bh - 4, (this.bh - 4) / 2).fill({ color });
  }
}

/** 等級徽章（點擊開啟魔導書） */
function badge(onTap: () => void): { view: Container; label: Text } {
  const view = new Container();
  const bg = new Graphics().roundRect(-44, -15, 88, 30, 15).fill({ color: 0x2b1d14, alpha: 0.85 }).stroke({ width: 2, color: 0xd9a441 });
  const label = text('Lv 1', 18, 0xf6e3b4);
  label.anchor.set(0.5);
  view.addChild(bg, label);
  view.eventMode = 'static';
  view.cursor = 'pointer';
  view.on('pointerdown', (e: FederatedPointerEvent) => {
    e.stopPropagation();
    onTap();
  });
  return { view, label };
}

// ---------- 盆栽 ----------

/** 按住盆栽多久（毫秒）打開魔導書的這一盆 */
const POT_HOLD_MS = 500;

class PotView extends Container {
  readonly hud = new Container();
  /** 目前的高速模式分級（聲音用：高速時改成循環環境音） */
  fastTier: FastTier = 0;
  private pot: Pic;
  private plant: Pic;
  private bar = new Bar(96);
  private lv: { view: Container; label: Text };
  private hint = text('', 18, 0xf6e3b4);
  private rain: Pic;
  private fairy: Pic;
  private ready = text('!', 32, 0xffe066);
  private punch = 0;
  private t = Math.random() * 10;
  /** 高速模式下進度條的顯示相位（0~1，以上限速度循環） */
  private visPhase = 0;
  /** 高速模式下植物變換的相位（比進度條更快） */
  private plantPhase = 0;
  /** 高速模式：植物背後的脈動光暈 */
  private aura = new Graphics();
  private rate = new RateMeter();
  private rateText = text('', RATE_TEXT_SIZE, 0xffffff);
  /** 浮空盆栽（隱藏格）：飄在溫室半空，下方有魔法光暈 */
  private floating: boolean;
  private baseY: number;
  private glow = new Graphics();

  constructor(private i: number, tex: TextureBank, private game: Game, private particles: ParticleLayer) {
    super();
    const pos = SLOT_POS[i];
    this.position.set(pos.x, pos.y);
    this.baseY = pos.y;
    this.floating = i >= FLOATING_SLOT_FROM;
    if (this.floating) this.addChild(this.glow);
    this.pot = new Pic(tex, 'pot_t1');
    this.pot.anchor.set(0.5, 1);
    this.plant = new Pic(tex, 'plant_redheart_sprout');
    this.plant.anchor.set(0.5, 1);
    this.bar.y = 8;
    this.lv = badge(() => openDrawer('greenhouse', `slot-${i}`));
    this.lv.view.y = 38;
    this.hint.anchor.set(0.5);
    this.hint.y = -60;
    this.rain = new Pic(tex, 'upg_raincloud');
    this.rain.anchor.set(0.5);
    this.rain.x = 18;
    this.fairy = new Pic(tex, 'upg_fairy');
    this.fairy.anchor.set(0.5);
    this.fairy.x = -46;
    this.ready.anchor.set(0.5);
    this.ready.x = 36;
    // 植物畫在花盆前面，根部落在盆口的土面上
    this.addChild(this.pot, this.aura, this.plant, this.rain, this.fairy);
    // 進度條、徽章等資訊放在獨立圖層，畫在角色前面
    this.hud.position.copyFrom(this.position);
    this.rateText.anchor.set(0.5, 0.5);
    this.rateText.y = 64;
    this.hud.addChild(this.bar, this.lv.view, this.hint, this.ready, this.rateText);
    for (const o of [this.bar, this.hint, this.ready, this.rateText]) o.eventMode = 'none';

    this.eventMode = 'static';
    this.cursor = 'pointer';
    this.hitArea = new Rectangle(-58, -200, 116, 215);
    // 點一下照常催熟／採收；按住不放 0.5 秒打開魔導書、捲到這一盆的卡片
    this.on('pointerdown', (e: FederatedPointerEvent) => {
      this.tap();
      this.startHold(e.global.x, e.global.y);
    });
    const cancel = () => this.cancelHold();
    this.on('pointerup', cancel);
    this.on('pointerupoutside', cancel);
    this.on('pointerout', cancel);
    this.on('globalpointermove', (e: FederatedPointerEvent) => {
      // 手指移動太多就不算長按
      if (this.holdFrom && Math.hypot(e.global.x - this.holdFrom.x, e.global.y - this.holdFrom.y) > 12) this.cancelHold();
    });
  }

  private holdTimer: ReturnType<typeof setTimeout> | null = null;
  private holdFrom: { x: number; y: number } | null = null;

  private startHold(x: number, y: number): void {
    this.cancelHold();
    this.holdFrom = { x, y };
    this.holdTimer = setTimeout(() => {
      this.holdTimer = null;
      this.holdFrom = null;
      openDrawer('greenhouse', `slot-${this.i}`);
    }, POT_HOLD_MS);
  }

  private cancelHold(): void {
    if (this.holdTimer) clearTimeout(this.holdTimer);
    this.holdTimer = null;
    this.holdFrom = null;
  }

  private tap(): void {
    const slot = this.game.state.slots[this.i];
    if (!slot.open) {
      // 打開魔導書並捲到這一格的卡片（下一格可以直接在卡片上購買）
      openDrawer('greenhouse', `slot-${this.i}`);
    } else if (!slot.plant) {
      openDrawer('greenhouse', `slot-${this.i}`);
    } else if (this.game.clickPlant(this.i) !== 'none') {
      this.punch = 1;
      playSfx('tapPot');
    }
  }

  update(s: GameState, dt: number): void {
    const slot = s.slots[this.i];
    this.t += dt;
    this.punch = Math.max(0, this.punch - dt * 5);
    if (this.floating) this.hover();

    const planted = !!slot.plant;
    this.plant.visible = planted;
    this.bar.visible = planted;
    this.lv.view.visible = planted;
    this.rain.visible = planted && slot.rain > 0;
    this.fairy.visible = planted && slot.fairy;
    this.ready.visible = planted && slot.ready;

    if (!slot.open) {
      this.pot.setId('pot_locked');
      this.pot.alpha = this.floating ? 0.85 : 0.55;
      this.hint.text = t('scene.floatingSlot');
      this.hint.y = -110;
      return;
    }
    if (!slot.plant) {
      this.pot.setId('pot_t1');
      this.pot.alpha = 0.6;
      this.hint.text = t('scene.plant');
      this.hint.y = -60;
      return;
    }
    this.hint.text = '';
    this.pot.alpha = 1;

    this.pot.setId(`pot_t${Math.min(3, milestoneCount(slot.level)) + 1}`);

    const def = PLANTS[slot.plant];
    const r = slot.progress / def.growTime;
    // 一輪比顯示上限還快：進度條與植物改用「高速模式」表現，不照真實進度畫（會一直閃成空的）。
    // 進度條以 FAST_CYCLE 循環；植物以更快的速度在幼苗 → 成長中 → 成熟之間變換，
    // 每輪結束「啵」一下：擠壓回彈 + 噴出同色光點。越快（分級越高）效果越浮誇
    const tier: FastTier = autoHarvest(s, slot) ? fastTier(def.growTime / growthSpeed(s, slot)) : 0;
    this.fastTier = tier;
    const fast = tier > 0;
    const fx = tier > 0 ? TIER_FX[tier as 1 | 2 | 3] : null;
    // 裝飾（光暈、星星、彩虹、閃光、粒子、搖擺）照效能設定降級；fx 只管節奏
    const deco = decoTier(tier);
    const dfx = deco > 0 ? TIER_FX[deco as 1 | 2 | 3] : null;
    this.rate.update(dt);
    const potH = this.pot.texture.height * this.pot.baseScale;
    let popped = false;
    if (fx) {
      this.visPhase = (this.visPhase + dt / FAST_CYCLE) % 1;
      const next = this.plantPhase + dt / fx.plantCycle;
      popped = next >= 1;
      this.plantPhase = next % 1;
    }
    const grown = slot.level >= 25 ? 'lush' : 'mature';
    const shown = fast ? this.plantPhase : r;
    const stage = !fast && slot.ready
      ? grown
      : shown < 0.34 ? 'sprout' : shown < 0.67 ? 'growing' : fast ? grown : 'mature';
    this.plant.setId(`plant_${slot.plant}_${stage}`);
    const plantH = this.plant.texture.height * this.plant.baseScale;
    // 植物根部對齊花盆盆口的土面（約在盆高 85% 處）
    this.plant.y = -potH * 0.85;
    const color = deco === 3 ? rainbow(this.t * 0.8) : def.color;
    if (popped && fx) {
      this.punch = 1;
      const py = this.y + this.plant.y - plantH * 0.7;
      if (dfx) {
        this.particles.burst(this.x, py, color, dfx.burst, dfx.power);
        if (dfx.ring) this.particles.ring(this.x, py, lighten(color, 0.3), deco === 3 ? 1.3 : 1);
      }
    }

    const squash = 1 + Math.sin(this.punch * Math.PI) * (fast ? 0.22 : 0.12);
    const bob = fast ? 1 + Math.sin(this.t * 14) * 0.05 : slot.ready ? 1 + Math.sin(this.t * 6) * 0.04 : 1;
    // 高速模式：每輪從 75% 一路長到 115%，並從根部快速搖擺
    const grow = fast ? 0.75 + 0.4 * (1 - (1 - this.plantPhase) ** 3) : 1;
    const base = this.plant.baseScale;
    this.plant.scale.set(base * grow * (fast ? squash : 1), base * grow * bob / squash);
    this.plant.rotation = dfx ? Math.sin(this.t * 22) * dfx.sway : 0;
    this.pot.scale.y = this.pot.baseScale / (1 + (squash - 1) * 0.4);
    // 2 級以上：每次「啵」花盆跟著閃一下
    this.pot.tint = deco >= 2 ? lerpColor(0xffffff, lighten(color, 0.4), this.punch * 0.8) : 0xffffff;
    this.drawAura(deco as FastTier, color, plantH);
    const top = this.plant.y - plantH;
    this.ready.y = top - 10 + Math.sin(this.t * 5) * 6;
    this.rain.y = Math.min(top, -potH - 110) - 22 + Math.sin(this.t * 2) * 4;
    this.fairy.y = -potH * 0.4 + Math.sin(this.t * 3 + 1) * 5;

    if (fast) {
      this.bar.set(this.visPhase, deco === 3 ? lighten(color, 0.2) : shimmer(this.t));
      setRateText(this.rateText, tier, this.rate.value, this.t);
    } else {
      this.bar.set(slot.ready ? 1 : r, slot.ready ? 0xffd34d : lighten(def.color, 0.2));
      setRateText(this.rateText, 0, 0, this.t);
    }
    this.lv.label.text = `Lv ${slot.level}`;
  }

  /** 收成事件（用來量測實際產量） */
  noteHarvest(amount: number): void {
    this.rate.add(amount);
  }

  /** 高速模式：植物背後跟著節奏脈動的光暈；2 級加上環繞的星星，3 級變彩虹色 */
  private drawAura(tier: FastTier, color: number, plantH: number): void {
    this.aura.clear();
    if (tier === 0) return;
    const pulse = 0.5 + 0.5 * Math.sin(this.t * (tier === 3 ? 20 : 12));
    const cy = this.plant.y - plantH * 0.5;
    const grow = 1 + (tier - 1) * 0.18;
    this.aura
      .circle(0, cy, plantH * (0.55 + 0.12 * pulse) * grow).fill({ color: lighten(color, 0.3), alpha: 0.18 + 0.14 * pulse })
      .circle(0, cy, plantH * (0.35 + 0.08 * pulse) * grow).fill({ color: 0xfff6c0, alpha: 0.15 + 0.1 * pulse });
    if (tier >= 2) {
      const n = tier === 3 ? 6 : 4;
      const rx = plantH * 0.62 * grow;
      for (let k = 0; k < n; k++) {
        const a = this.t * (tier === 3 ? 5 : 3) + (k / n) * Math.PI * 2;
        // 橢圓軌道：轉到後面時變小變淡
        const depth = 0.5 + 0.5 * Math.sin(a);
        this.aura
          .star(Math.cos(a) * rx, cy + Math.sin(a) * rx * 0.3, 4, 7 + 5 * depth, 2.5)
          .fill({ color: k % 2 ? 0xfff6c0 : lighten(color, 0.5), alpha: 0.45 + 0.5 * depth });
      }
    }
  }

  /** 上下漂浮、輕微搖晃；光暈留在原處，盆栽飄高時變小變淡 */
  private hover(): void {
    const f = Math.sin(this.t * 1.6 + this.i) * 7;
    this.y = this.baseY + f;
    this.hud.y = this.baseY + f;
    this.rotation = Math.sin(this.t * 1.1 + this.i) * 0.035;
    const pulse = 0.5 + 0.5 * Math.sin(this.t * 2.4 + this.i);
    this.glow.clear()
      .ellipse(0, 26 - f, 50 + f * 0.8, 11).fill({ color: 0xbff5c9, alpha: 0.3 + 0.15 * pulse })
      .ellipse(0, 26 - f, 36 + f * 0.6, 7).stroke({ width: 3, color: 0xfff1a8, alpha: 0.55 + 0.3 * pulse });
  }

  get anchorPoint() {
    return { x: this.x, y: this.y - 150 };
  }
}

// ---------- 大釜 ----------

/**
 * 各階大釜原圖的鍋口位置（比例）：液面中心距離圖片頂端 top、液面寬度 width。
 * 換了大釜圖就要重新量。
 */
const RIM: Record<string, { top: number; width: number }> = {
  cauldron_t1: { top: 0.17, width: 0.64 },
  cauldron_t2: { top: 0.15, width: 0.64 },
  cauldron_t3: { top: 0.11, width: 0.34 },
  cauldron_t4: { top: 0.12, width: 0.62 },
};

class CauldronView extends Container {
  readonly hud = new Container();
  /** 目前的高速模式分級、是否極速沸騰中（聲音用） */
  fastTier: FastTier = 0;
  boiling = false;
  private body: Pic;
  private liquid: Pic;
  private bubbles: Pic[];
  private bar = new Bar(100, 12);
  private lv: { view: Container; label: Text };
  private title = text('', 20, 0xf6e3b4);
  private info = text('', 22, 0xffffff);
  private needs = new Container();
  private salamander: Pic;
  /** 火蜥蜴的呼吸相位（每口氣 +1） */
  private breath = Math.random();
  private ladle: Pic;
  /** 龍息風箱的連擊／沸騰／冷卻字：放在鍋身上、畫在飄字上面（獨立圖層 top），才不會被產出的字擋住 */
  readonly top = new Container();
  private combo = text('', 26, 0xffb347);
  /** 極速沸騰時字前面的火焰圖示、未解鎖配方字前面的鎖 */
  private fireIcon: Pic;
  private lockIcon: Pic;
  private comboPop = 0;
  private wasBoiling = false;
  private comboFill = 0xffb347;
  /** 高速模式：進度條顯示相位、距離上次完成的秒數、實際產量 */
  private visPhase = 0;
  private sinceBrew = 99;
  private rate = new RateMeter();
  /** 高速模式的速率字（放在配方名稱下方） */
  private rateText = text('', RATE_TEXT_SIZE, 0xffffff);
  /** 高速模式：鍋子背後的光暈，以及鍋口的加亮閃光 */
  private aura = new Graphics();
  private flash = new Graphics();
  private shake = 0;
  private punch = 0;
  private t = Math.random() * 10;
  private recipe: PotionId | null = null;
  private locked: PotionId | null = null;
  /** 拖曳中：大釜跟著手指的 x 座標；null = 在原位 */
  dragX: number | null = null;

  constructor(
    readonly i: number, private tex: TextureBank, private game: Game, private particles: ParticleLayer,
    onPress: (view: CauldronView, e: FederatedPointerEvent) => void,
  ) {
    super();
    this.position.set(CAULDRON_X[i], CAULDRON_Y);
    this.body = new Pic(tex, 'cauldron_t1');
    this.body.anchor.set(0.5, 1);
    this.liquid = new Pic(tex, 'fx_liquid_surface');
    this.liquid.anchor.set(0.5);
    this.flash.blendMode = 'add';
    // 一般熬煮用 3 顆泡泡，高速模式依分級最多 6 顆
    this.bubbles = [0, 1, 2, 3, 4, 5].map(() => {
      const b = new Pic(tex, 'fx_bubble');
      b.anchor.set(0.5);
      return b;
    });
    this.salamander = new Pic(tex, 'upg_salamander');
    this.salamander.anchor.set(0.5, 1);
    this.salamander.position.set(-50, 4);
    this.bar.y = 8;
    this.lv = badge(() => this.recipe && openDrawer('cauldron', `recipe-${this.recipe}`));
    this.lv.view.y = 38;
    this.title.anchor.set(0.5);
    this.title.y = 66;
    this.info.anchor.set(0.5);
    this.needs.y = -140;
    this.ladle = new Pic(tex, 'upg_servant_ladle');
    this.ladle.anchor.set(0.5, 0.9);
    this.combo.anchor.set(0.5);
    this.fireIcon = new Pic(tex, 'icon_fire');
    this.fireIcon.anchor.set(0.5);
    this.lockIcon = new Pic(tex, 'icon_lock');
    this.lockIcon.anchor.set(0.5);
    this.rateText.anchor.set(0.5);
    this.rateText.y = 90;
    this.addChild(this.aura, this.body, this.liquid, ...this.bubbles, this.flash, this.salamander, this.ladle);
    // 進度條、徽章、需求等資訊放在獨立圖層，畫在角色前面
    this.hud.position.copyFrom(this.position);
    this.hud.addChild(this.bar, this.lv.view, this.title, this.info, this.lockIcon, this.needs, this.rateText);
    this.top.addChild(this.combo, this.fireIcon);
    this.top.eventMode = 'none';
    // 資訊層只有等級徽章可以點，其他文字與進度條都不擋點擊
    for (const o of [this.bar, this.title, this.info, this.lockIcon, this.needs, this.rateText]) o.eventMode = 'none';

    this.eventMode = 'static';
    this.cursor = 'pointer';
    this.hitArea = new Rectangle(-60, -120, 120, 130);
    this.on('pointerdown', (e: FederatedPointerEvent) => {
      this.tap();
      onPress(this, e);
    });
  }

  get active(): boolean {
    return this.recipe !== null;
  }

  private tap(): void {
    if (this.locked) {
      openDrawer('cauldron', `recipe-${this.locked}`);
      return;
    }
    if (!this.recipe) return;
    const r = this.game.clickCauldron(this.recipe);
    if (r === 'missing') this.shake = 0.35;
    else if (r === 'brew') this.punch = 1;
    // 缺原料時低沉一點、小聲一點
    if (r !== 'none') playSfx('tapCauldron', r === 'missing' ? { rate: 0.7, gain: 0.6 } : {});
  }

  update(s: GameState, dt: number): void {
    this.t += dt;
    this.shake = Math.max(0, this.shake - dt);
    this.punch = Math.max(0, this.punch - dt * 5);
    const c = s.cauldrons[this.i];
    this.recipe = c?.recipe ?? null;
    this.locked = c ? null : nextLockedRecipes(s)[this.i - s.cauldrons.length] ?? null;

    this.visible = !!c || !!this.locked;
    this.hud.visible = this.visible;
    const active = !!c;
    this.bar.visible = active;
    this.lv.view.visible = active;
    this.salamander.visible = active && c.salamander > 0;
    this.ladle.visible = active && has(s, 'servant_ladle');
    this.sinceBrew += dt;
    this.rate.update(dt);
    // 一輪比顯示上限還快、而且最近真的有產出：高速模式（液體常駐、進度條以上限速度循環）
    // 越快（分級越高）效果越浮誇：泡泡更多更快、鍋子閃爍、每輪噴光點，3 級變彩虹色
    const speed = c ? brewPassiveSpeed(s, c) : 0;
    const tier: FastTier = c && speed > 0 && this.sinceBrew < 1 ? fastTier(RECIPES[c.recipe].brewTime / speed) : 0;
    this.fastTier = tier;
    this.boiling = !!c && c.boil > 0;
    const fast = tier > 0;
    const fx = tier > 0 ? TIER_FX[tier as 1 | 2 | 3] : null;
    // 裝飾（光暈、閃光、彩虹、泡泡數、粒子）照效能設定降級；fx 只管節奏
    const deco = decoTier(tier);
    const dfx = deco > 0 ? TIER_FX[deco as 1 | 2 | 3] : null;
    const brewing = !!c && (c.batch > 0 || fast);
    this.liquid.visible = brewing;
    const bubbleCount = brewing ? dfx?.bubbles ?? 3 : 0;
    this.bubbles.forEach((b, k) => (b.visible = k < bubbleCount));
    this.combo.text = '';
    this.fireIcon.visible = false;
    this.lockIcon.visible = false;
    this.aura.clear();
    this.flash.clear();
    setRateText(this.rateText, tier, this.rate.value, this.t);

    if (!c) {
      this.setNeeds('', null, []);
      this.x = this.hud.x = CAULDRON_X[this.i];
      if (!this.locked) return;
      const r = RECIPES[this.locked];
      this.body.setId('cauldron_t1');
      this.body.alpha = 0.3;
      this.body.tint = 0xffffff;
      this.title.text = '';
      // 未解鎖的大釜彼此很近，字小一點才不會疊在一起
      if (this.info.style.fontSize !== 16) this.info.style.fontSize = 16;
      this.info.text = t('scene.lockedRecipe', { name: r.name, cost: formatNumber(r.unlockCost) });
      // 相鄰兩個未解鎖的大釜上下錯開
      this.info.y = -60 - ((this.i - s.cauldrons.length) % 2) * 46;
      // 鎖放在配方名稱（第一行）的左邊
      this.lockIcon.visible = true;
      this.lockIcon.position.set(-this.info.width / 2 - 16, this.info.y - this.info.height / 4);
      return;
    }

    const def = RECIPES[c.recipe];
    if (this.info.style.fontSize !== 22) this.info.style.fontSize = 22;
    const bodyId = `cauldron_t${Math.min(3, milestoneCount(c.level)) + 1}`;
    this.body.alpha = 1;
    this.body.setId(bodyId);
    const boiling = c.boil > 0;
    const jitter = this.shake > 0 ? Math.sin(this.t * 80) * 8 * (this.shake / 0.35)
      : boiling ? Math.sin(this.t * 60) * 2 : 0;
    const homeX = this.dragX ?? CAULDRON_X[this.i];
    this.x = homeX + jitter;
    this.hud.x = homeX;
    // 拖曳中稍微浮起
    const lift = this.dragX !== null ? 1.1 : 1;
    this.scale.set(lift);
    this.hud.scale.set(lift);
    this.alpha = this.dragX !== null ? 0.9 : 1;
    // 高速模式：進度條每循環一次「咕嘟」一下（擠壓回彈 + 從鍋口噴出光點）
    let popped = false;
    if (fx) {
      const next = this.visPhase + dt / FAST_CYCLE;
      popped = next >= 1;
      this.visPhase = next % 1;
      if (popped) this.punch = 1;
    }
    const color = deco === 3 ? rainbow(this.t * 0.8) : def.color;
    const squash = 1 + Math.sin(this.punch * Math.PI) * (fast ? 0.05 + 0.03 * tier : 0.06);
    this.body.scale.y = this.body.baseScale / squash;
    this.body.scale.x = this.body.baseScale * (fast ? 1 + (squash - 1) * 0.5 : 1);
    // 火蜥蜴呼吸：身體慢慢鼓起再縮回（吸氣時縱向鼓得比較多）；熬煮中呼吸快一點，高速模式更快
    if (this.salamander.visible) {
      this.breath += dt * (fast ? 1.4 + tier * 0.3 : brewing ? 0.75 : 0.45);
      const inhale = 0.5 - 0.5 * Math.cos(this.breath * Math.PI * 2);
      const bs = this.salamander.baseScale;
      this.salamander.scale.set(bs * (1 + inhale * 0.04), bs * (1 + inhale * 0.09));
    }
    // 極速沸騰：鍋身泛紅光閃爍；高速模式：鍋身跟著節奏泛出藥水色的光
    const beat = 0.5 + 0.5 * Math.sin(this.t * (10 + tier * 4));
    this.body.tint = boiling ? lerpColor(0xffffff, 0xffa060, 0.5 + 0.5 * Math.sin(this.t * 14))
      : dfx ? lerpColor(0xffffff, lighten(color, 0.35), dfx.flash * 0.6 * beat) : 0xffffff;

    // 鍋內液體：灰階液面圖依配方著色，對齊各階大釜的鍋口
    const bw = this.body.texture.width * this.body.baseScale;
    const bh = this.body.texture.height * this.body.baseScale / squash;
    if (brewing) {
      const rim = RIM[bodyId] ?? { top: 0.2, width: 0.6 };
      const lw = bw * rim.width;
      const ly = -bh + bh * rim.top;
      this.liquid.tint = color;
      this.liquid.width = lw;
      // 高速模式：液面跟著翻騰
      this.liquid.height = lw * 0.3 * (dfx ? 1 + 0.18 * Math.sin(this.t * (18 + deco * 6)) : 1);
      this.liquid.y = ly;
      const bubbleSpeed = fx?.bubbleSpeed ?? 1;
      const rise = 28 + deco * 14;
      this.bubbles.forEach((b, k) => {
        if (k >= bubbleCount) return;
        const ph = (this.t * (1.1 + k * 0.35) * bubbleSpeed + k * 0.37) % 1;
        const size = (lw * 0.16) * (1 - ph * 0.5) * (dfx ? 1 + deco * 0.12 : 1);
        b.tint = lighten(color, 0.5);
        b.width = b.height = size;
        // 泡泡在鍋口寬度內平均分布
        const spread = bubbleCount > 1 ? k / (bubbleCount - 1) - 0.5 : 0;
        b.position.set(spread * lw * 0.62 + (dfx ? Math.sin(this.t * 7 + k) * 4 : 0), ly - ph * rise);
        b.alpha = 1 - ph;
      });
      if (dfx) this.drawFastFx(deco as FastTier, color, lw, ly, beat);
      if (popped && dfx) {
        const px = this.x;
        const py = this.y + ly * this.scale.y;
        this.particles.burst(px, py, color, dfx.burst, dfx.power);
        if (dfx.ring) this.particles.ring(px, py, lighten(color, 0.3), deco === 3 ? 1.4 : 1.1);
      }
    }

    // 隱形僕役湯勺：浮在鍋口右側攪拌
    if (this.ladle.visible) {
      this.ladle.position.set(bw * 0.22, -bh * 0.78 + Math.sin(this.t * 3) * 4);
      this.ladle.rotation = 0.35 + Math.sin(this.t * (boiling ? 12 : 4)) * 0.35;
    }

    if (fast) {
      this.bar.set(this.visPhase, deco === 3 ? lighten(color, 0.2) : shimmer(this.t));
    } else {
      this.bar.set(c.progress / def.brewTime, boiling ? 0xffa040 : lighten(def.color, 0.25));
    }
    this.lv.label.text = `Lv ${c.level}`;
    // 精煉過的配方在名稱後面加星星
    const refine = refineLevel(s, c.recipe);
    this.title.text = refine > 0 ? `${def.name} ${'★'.repeat(refine)}` : def.name;
    this.info.y = -bh - 22;

    // 龍息風箱：連擊數、沸騰倒數、冷卻（放在鍋身中間；圖層跟著資訊層移動、縮放）
    this.top.position.copyFrom(this.hud.position);
    this.top.scale.copyFrom(this.hud.scale);
    this.top.visible = this.hud.visible;
    // 開始沸騰時字彈一下
    if (boiling && !this.wasBoiling) this.comboPop = 1;
    this.wasBoiling = boiling;
    this.comboPop = Math.max(0, this.comboPop - dt * 2.5);
    this.combo.scale.set(1 + Math.sin(this.comboPop * Math.PI) * 0.35);
    if (has(s, 'bellows')) {
      this.combo.y = -bh * 0.5;
      const n = activeCombo(s, c);
      if (boiling) {
        this.combo.text = t('scene.boiling', { n: c.boil.toFixed(1) });
        this.fireIcon.visible = true;
        this.fireIcon.position.set(-(this.combo.width / 2) - 18 * this.combo.scale.x, this.combo.y);
        this.fireIcon.scale.set(this.fireIcon.baseScale * this.combo.scale.y);
      }
      else if (c.boilCooldown > 0) this.combo.text = t('scene.cooldown', { n: Math.ceil(c.boilCooldown) });
      else if (n > 0) this.combo.text = t('scene.combo', { n, max: UPGRADE_FX.comboClicks });
      const fill = boiling ? 0xff8a3c : c.boilCooldown > 0 ? 0xbbbbbb : 0xffb347;
      if (fill !== this.comboFill) this.combo.style.fill = this.comboFill = fill;
    }

    if (fast) {
      // 高速模式的速率字在配方名稱下方（rateText），鍋子上方留給特效
      this.info.text = '';
      this.setNeeds('', null, []);
    } else if (brewing) {
      this.info.text = t('scene.brewing', { n: c.batch });
      this.setNeeds('', null, []);
    } else {
      this.info.text = '';
      const missing = missingInputs(s, c);
      this.setNeeds(`${c.recipe}:${refineLevel(s, c.recipe)}:${missing.join(',')}`, c.recipe, missing, recipeInputs(s, c.recipe));
    }
  }

  /**
   * 高速模式特效：鍋子背後的脈動光暈（2 級起更大），
   * 以及鍋口的加亮閃光（每次「咕嘟」最亮）
   */
  private drawFastFx(tier: FastTier, color: number, lw: number, ly: number, beat: number): void {
    const glow = lighten(color, 0.35);
    const size = 1 + (tier - 1) * 0.2;
    this.aura
      .ellipse(0, ly + 30, lw * (0.95 + 0.1 * beat) * size, lw * (0.65 + 0.08 * beat) * size)
      .fill({ color: glow, alpha: 0.12 + 0.06 * tier * beat });
    const f = Math.min(1, 0.25 + this.punch * 0.75) * TIER_FX[tier as 1 | 2 | 3].flash;
    this.flash
      .ellipse(0, ly, lw * 0.55, lw * 0.2).fill({ color: glow, alpha: 0.35 * f })
      .ellipse(0, ly - 6, lw * 0.3, lw * 0.1).fill({ color: 0xffffff, alpha: 0.4 * f });
  }

  /** 熬煮完成事件（量測實際產量、判斷是否持續在產出） */
  noteBrew(amount: number): void {
    this.rate.add(amount);
    this.sinceBrew = 0;
  }

  /** 閒置時顯示配方需求（只在內容改變時重建） */
  private needsKey = '';
  private setNeeds(key: string, recipe: PotionId | null, missing: string[], inputs: [string, number][] = []): void {
    if (key === this.needsKey) return;
    this.needsKey = key;
    this.needs.removeChildren().forEach((ch) => ch.destroy());
    if (!recipe) return;
    inputs.forEach(([m, need], k) => {
      const icon = new Pic(this.tex, `item_${m}`, 32, 32);
      icon.anchor.set(0.5);
      const x = (k - (inputs.length - 1) / 2) * 60;
      icon.position.set(x - 12, 0);
      const n = text(`×${Number.isInteger(need) ? need : need.toFixed(1)}`, 18, missing.includes(m) ? 0xff7a7a : 0xffffff);
      n.anchor.set(0, 0.5);
      n.position.set(x + 5, 0);
      this.needs.addChild(icon, n);
    });
  }

  get anchorPoint() {
    return { x: this.x, y: this.y - 150 };
  }
}

// ---------- 顧客 ----------

/** 每種藥水的常客造型（依顧客 ID 輪流） */
const NPC_FOR: Record<PotionId, string[]> = {
  glow: ['npc_novice_adventurer', 'npc_drunk_adventurer', 'npc_dwarf_merchant'],
  focus: ['npc_mage_apprentice', 'npc_dwarf_merchant', 'npc_novice_adventurer'],
  elixir: ['npc_elf_noble', 'npc_mage_apprentice'],
};

/** 微服出巡的公主：披著斗篷的專屬造型（兜帽底下藏著小皇冠） */
const PRINCESS_DISGUISE = 'npc_evt_princess';

/** 客人走路速度（px/秒，固定；要和模擬裡走到櫃台的時間一致） */
const CUSTOMER_SPEED = CUSTOMER.walkSpeed;
/** 訂單氣泡每一列的高度 */
const ROW_H = 44;
/** 訂單氣泡（最下面一列的中心）在客人頭頂上的高度（客人圖高約 183） */
const CUSTOMER_BUBBLE_Y = -225;

class CustomerView extends Container {
  targetX = OFFSTAGE_X;
  targetY = QUEUE_Y;
  leaving = false;
  private body: PaperDoll;
  private bubble = new Container();
  private bubbleBg = new Graphics();
  /** 訂單每一項一列：藥水圖示 + 數量 */
  private rows: Text[] = [];
  private icons: Pic[] = [];
  /** 排隊時相鄰客人的氣泡上下錯開（由 CustomerLayer 設定） */
  bubbleLift = 0;
  /** 急單的耐心條；結帳中改顯示結帳進度 */
  private bar = new Bar(96, 10);
  /** 備好貨、可以點他結帳：頭上跳動的金幣 */
  private coin: Pic;
  private punch = 0;
  private t = Math.random() * 10;
  private look = '';

  constructor(tex: TextureBank, public readonly id: number, c: CustomerState, onTap: (id: number) => void) {
    super();
    // 微服出巡的公主：披著斗篷混在客人裡，沒有訂單，頭上是「……」的小氣泡（在店裡東看西看）
    const pool = c.princess ? [PRINCESS_DISGUISE] : NPC_FOR[c.lines[0].potion];
    this.body = new PaperDoll(tex, pool[c.id % pool.length]);
    this.x = OFFSTAGE_X;
    this.y = QUEUE_Y;
    this.bubble.addChild(this.bubbleBg);
    if (c.princess) {
      const dots = new Text({ text: '……', style: { fontFamily: uiFont(), fontSize: 24, fontWeight: '700', fill: 0x4a3426 } });
      dots.anchor.set(0.5);
      this.bubbleBg.roundRect(-45, -ROW_H / 2 - 6, 90, ROW_H + 12, 16).fill({ color: 0xfff6e0 }).stroke({ width: 3, color: 0x2b1d14 });
      this.bubble.addChild(dots);
    }
    // 由下往上排，氣泡底部固定在頭頂
    const n = c.lines.length;
    c.lines.forEach((l, k) => {
      const y = -(n - 1 - k) * ROW_H;
      const icon = new Pic(tex, `potion_${l.potion}`, 38, 38);
      icon.anchor.set(0.5);
      icon.y = y;
      const qty = new Text({ text: '', style: { fontFamily: uiFont(), fontSize: 24, fontWeight: '700', fill: 0x4a3426 } });
      qty.anchor.set(0, 0.5);
      qty.y = y;
      this.rows.push(qty);
      this.icons.push(icon);
      this.bubble.addChild(icon, qty);
    });
    this.bubbleH = n * ROW_H + 12;
    // 急單的耐心條、結帳進度條放在頭頂（氣泡收起來時也看得到）
    this.bubble.y = CUSTOMER_BUBBLE_Y;
    this.coin = new Pic(tex, 'icon_gold', 44, 44);
    this.coin.anchor.set(0.5);
    this.addChild(this.body, this.bubble, this.bar, this.coin);
    // 點客人結帳（備好貨的才會成交）
    this.eventMode = 'static';
    this.cursor = 'pointer';
    this.hitArea = new Rectangle(-58, -205, 116, 215);
    this.on('pointerdown', (e: FederatedPointerEvent) => {
      e.stopPropagation();
      onTap(this.id);
    });
  }

  private bubbleH = ROW_H + 12;

  /** 被點了但還沒備好貨：搖一下 */
  nudge(): void {
    this.punch = 1;
  }

  update(c: CustomerState | undefined, dt: number, s: GameState): void {
    this.t += dt;
    this.punch = Math.max(0, this.punch - dt * 4);
    const speed = CUSTOMER_SPEED;
    const dx = this.targetX - this.x;
    const dy = this.targetY - this.y;
    const dist = Math.hypot(dx, dy);
    const moving = dist > 1;
    const step = Math.min(dist, speed * dt);
    if (moving) {
      this.x += (dx / dist) * step;
      this.y += (dy / dist) * step;
    }
    // 走路時面向前進方向；站定時面向櫃台（左）
    this.body.dir = moving && dx > 0 ? 1 : -1;
    this.body.mode = moving ? 'walk' : 'idle';
    this.body.update(dt, speed);
    this.body.x = Math.sin(this.punch * Math.PI * 4) * 6 * this.punch;
    // 每位客人都顯示訂單氣泡（放置遊戲需要一點資訊量）；相鄰的上下錯開
    this.bubble.visible = !this.leaving && !!c;
    this.bubble.y = CUSTOMER_BUBBLE_Y - this.bubbleLift;
    // 可以點他結帳（還沒點過）：頭上跳動的金幣
    this.coin.visible = !this.leaving && !!c && c.status !== 'waiting' && !c.express;
    // 備好貨可以點：金幣在氣泡正上方跳動
    const bubbleTop = this.bubble.y + ROW_H / 2 + 6 - this.bubbleH;
    if (this.coin.visible) this.coin.position.set(0, bubbleTop - 26 + Math.sin(this.t * 6) * 6);
    if (!c) return;
    if (c.princess) {
      this.bar.visible = false;
      return;
    }

    const packed = c.status !== 'waiting';
    // 等待中：每一項依目前庫存顯示夠不夠（綠 = 夠、紅 = 還缺）
    const enough = c.lines.map((l) => s.potions[l.potion] >= l.qty);
    const look = `${packed}:${c.rush}:${c.partial}:${enough.join()}`;
    if (look !== this.look) {
      this.look = look;
      c.lines.forEach((l, k) => {
        const row = this.rows[k];
        if (packed) {
          row.text = c.partial ? `${formatNumber(l.delivered)}/${formatNumber(l.qty)}` : `${formatNumber(l.qty)}✓`;
          row.style.fill = c.partial && l.delivered < l.qty ? 0xb07a2a : 0x2f8a3a;
        } else {
          row.text = `×${formatNumber(l.qty)}`;
          row.style.fill = !c.rush ? 0x4a3426 : enough[k] ? 0x2f8a3a : 0xc0443e;
        }
      });
      // 最下面一列的中心在 y = 0，氣泡往上長；圖示 + 數字置中，寬度跟著最長的數字
      const contentW = 38 + 8 + Math.max(...this.rows.map((r) => r.width));
      const left = -contentW / 2;
      this.icons.forEach((icon) => (icon.x = left + 19));
      this.rows.forEach((row) => (row.x = left + 46));
      const w = Math.max(90, contentW + 24);
      const top = ROW_H / 2 + 6 - this.bubbleH;
      this.bubbleBg.clear()
        .roundRect(-w / 2, top, w, this.bubbleH, 16)
        .fill({ color: packed ? (c.partial ? 0xfff0cc : 0xdff5d8) : 0xfff6e0 })
        .stroke({ width: 3, color: c.rush && !packed ? 0xe0485f : 0x2b1d14 });
    }
    // 急單顯示耐心；結帳中顯示結帳進度
    // 在櫃台結帳中（算盤松鼠倒數）顯示結帳進度；急單等貨時顯示耐心
    const pay = payTime(s);
    const paying = c.status === 'serving' && c.walk <= 1e-9 && !c.express && hasAutoCheckout(s) && pay > 0;
    this.bar.visible = !this.leaving && (paying || (c.rush && !packed));
    this.bar.y = this.bubble.y + 34;
    if (paying) {
      this.bar.set(1 - c.checkout / pay, 0xffd34d);
    } else if (this.bar.visible) {
      const r = c.patience / c.patienceMax;
      this.bar.set(r, r > 0.5 ? 0x7bd36a : r > 0.25 ? 0xffc34d : 0xff5a5a);
    }
  }
}

class CustomerLayer extends Container {
  private views = new Map<number, CustomerView>();

  constructor(private tex: TextureBank, private game: Game) {
    super();
    this.sortableChildren = true;
  }

  private tap = (id: number) => {
    // 事件「微服出巡的公主」：點中那位客人就認出她
    const ev = this.game.state.events.active;
    if (ev?.id === 'princess' && ev.customer === id) {
      this.game.eventAction({ type: 'hit', customer: id });
      return;
    }
    if (!this.game.clickCustomer(id)) this.views.get(id)?.nudge();
  };

  /** 客人腳底的位置 */
  feetOf(id: number) {
    const v = this.views.get(id);
    return v && !v.leaving ? { x: v.x, y: v.y } : null;
  }

  update(s: GameState, dt: number): void {
    // 結帳中的客人站在櫃台前；備好貨的排在隊伍前面（下一位就是排第一的，走到櫃台的時間才對得上），
    // 還在等貨的排在後面
    let q = 0;
    const order = [...s.customers].sort((a, b) => Number(a.status === 'waiting') - Number(b.status === 'waiting'));
    for (const c of order) {
      let v = this.views.get(c.id);
      if (!v) {
        v = new CustomerView(this.tex, c.id, c, this.tap);
        this.views.set(c.id, v);
        this.addChild(v);
      }
      if (c.status === 'serving') {
        v.targetX = CHECKOUT_X;
      } else {
        v.targetX = QUEUE_X[Math.min(q, QUEUE_X.length - 1)];
        // 相鄰的客人氣泡上下錯開，比較不會疊在一起
        v.bubbleLift = (q % 2) * 50;
        q++;
      }
      v.targetY = QUEUE_Y;
    }
    for (const [id, v] of this.views) {
      const c = s.customers.find((x) => x.id === id);
      if (!c && !v.leaving) {
        // 結帳完（或沒買到）：從排隊的人前面走出門，不再佔位
        v.leaving = true;
        v.targetX = OFFSTAGE_X + 60;
        v.targetY = LEAVE_Y;
        v.eventMode = 'none';
      }
      v.update(c, dt, s);
      // 前排（y 大）畫在前面；同一排越靠近櫃台越前面。
      // 微服出巡的公主排在最前面一層：隊伍擠在一起時，點她的位置一定點得到她
      v.zIndex = v.y * 10 - v.x / 100 + (c?.princess ? 1e5 : 0);
      if (v.leaving && v.x >= OFFSTAGE_X) {
        this.views.delete(id);
        v.destroy({ children: true });
      }
    }
  }

  posOf(id: number) {
    const v = this.views.get(id);
    return v ? { x: v.x, y: v.y - 257 } : null;
  }
}

// ---------- 露米婭：依指派在工作點之間走動、長按拖曳指派、點一下互動 ----------

type Pose = 'idle' | 'walk' | 'back' | 'drag' | 'sleep' | 'tired_walk';

interface Station {
  x: number;
  y: number;
  /** back = 背對鏡頭站在盆栽/大釜前工作；sleep = 在坐墊上睡覺 */
  pose: 'back' | 'idle' | 'sleep';
  dir: 1 | -1;
  /** 走到這裡時可能說的話（休息室的家具旁邊） */
  talk?: string[];
  /** 櫃台的站點：停下來時向客人鞠躬，站著時客人結帳也會鞠躬 */
  counter?: boolean;
}

const LUMIA_SPEED = 120;
const TIRED_SPEED = 60;
const POOF_TIME = 0.28;

/** 露米婭頭上的對話泡泡：彈出 → 停留 → 淡出；說夢話時是淡藍色的雲 */
class SpeechBubble extends Container {
  private bg = new Graphics();
  private words = new Text({
    text: '',
    style: {
      fontFamily: uiFont(), fontSize: 22, fill: 0x4a3426, fontWeight: '700', align: 'center',
      wordWrap: true, breakWords: true, wordWrapWidth: 300, lineHeight: 30,
    },
  });
  private life = 0;
  private max = 1;
  private halfW = 0;
  private h = 0;
  private bodyH = 0;
  private dream = false;
  /** 尖角方向：down = 泡泡在頭頂上；left／right = 泡泡在頭的右邊／左邊（頭頂空間不夠時） */
  private tail: 'down' | 'left' | 'right' = 'down';

  static readonly TAIL = 14;

  constructor() {
    super();
    this.words.anchor.set(0.5, 1);
    this.addChild(this.bg, this.words);
    this.visible = false;
  }

  show(line: string, dream: boolean, duration = MUTTER.duration): void {
    this.words.text = line;
    this.words.style.fill = dream ? 0x4a5a8a : 0x4a3426;
    this.dream = dream;
    const padX = 18;
    const padY = 12;
    const w = this.words.width + padX * 2;
    this.bodyH = this.words.height + padY * 2;
    this.halfW = w / 2;
    this.h = this.bodyH + SpeechBubble.TAIL;
    this.words.y = -SpeechBubble.TAIL - padY;
    this.draw();
    this.life = this.max = duration;
    this.visible = true;
  }

  /** 換尖角方向（泡泡本體位置不變：原點在本體正下方 TAIL 處） */
  setTail(tail: 'down' | 'left' | 'right'): void {
    if (tail === this.tail) return;
    this.tail = tail;
    if (this.visible) this.draw();
  }

  /** 側邊尖角的尖端相對於原點的位置 */
  get sideTip(): { x: number; y: number } {
    const t = SpeechBubble.TAIL;
    const y = -t - this.bodyH / 2 + 6;
    return this.tail === 'right' ? { x: this.halfW + t, y } : { x: -this.halfW - t, y };
  }

  private draw(): void {
    const t = SpeechBubble.TAIL;
    const w = this.halfW * 2;
    const h = this.bodyH;
    const fill = this.dream ? 0xe8f0ff : 0xfffaf0;
    const edge = this.dream ? 0x8aa0d8 : 0x7a5c44;
    this.bg.clear().roundRect(-w / 2, -t - h, w, h, 18).fill({ color: fill, alpha: 0.96 }).stroke({ width: 3, color: edge });
    if (this.tail !== 'down') {
      // 泡泡在頭的旁邊：尖角從本體側邊指向她
      const side = this.tail === 'right' ? 1 : -1;
      const ex = side * (w / 2);
      const my = -t - h / 2;
      const tip = this.sideTip;
      this.bg.poly([ex - side * 2, my - 10, ex - side * 2, my + 8, tip.x, tip.y]).fill({ color: fill }).stroke({ width: 3, color: edge })
        .rect(ex - side * 4 - (side > 0 ? 0 : 4), my - 8, 4, 14).fill({ color: fill });
    } else if (this.dream) {
      // 夢話：往下飄的小泡泡代替尖角
      this.bg.circle(-6, -t + 5, 6).fill({ color: fill }).stroke({ width: 2, color: edge })
        .circle(-14, 2, 4).fill({ color: fill }).stroke({ width: 2, color: edge });
    } else {
      this.bg.poly([-10, -t - 2, 10, -t - 2, -4, 0]).fill({ color: fill }).stroke({ width: 3, color: edge })
        // 蓋掉尖角和框線的接縫
        .rect(-8, -t - 4, 16, 4).fill({ color: fill });
    }
  }

  hide(): void {
    this.life = 0;
    this.visible = false;
  }

  get showing(): boolean {
    return this.visible;
  }

  /** 泡泡寬度的一半與高度（放在畫面邊緣時往內推） */
  get size() {
    return { halfW: this.halfW, h: this.h };
  }

  update(dt: number): void {
    if (!this.visible) return;
    this.life -= dt;
    if (this.life <= 0) {
      this.hide();
      return;
    }
    const age = this.max - this.life;
    // 彈出時稍微超過再回彈；最後 0.4 秒淡出並往上飄
    const pop = age < 0.25 ? 1 + Math.sin((age / 0.25) * Math.PI) * 0.12 - (1 - age / 0.25) * 0.4 : 1;
    this.scale.set(pop);
    this.alpha = Math.min(1, this.life / 0.4);
    this.pivot.y = this.life < 0.4 ? (0.4 - this.life) * 20 : 0;
  }
}

/** 心願泡泡的顏色：普通、大心願、閃亮心願 */
const WISH_COLORS = [0xff8fb8, 0x9a7cff, 0xffc93c];
/** 結帳鞠躬的最短間隔（秒）：客人連續結帳時不會一直彎腰 */
const BOW_COOLDOWN = 1.6;

class LumiaView extends Container {
  private doll: PaperDoll;
  private zz = text('zZ', 26, 0xcfe3ff);
  /** 有小心願時頭上的提醒泡泡（內容在畫面右上角） */
  private wishMark = new Container();
  private wishBg = new Graphics();
  private wishHeart = text('♥', 26, 0xffffff);
  private wishRarity = -1;
  private bubble = new SpeechBubble();
  /** 距離下一次自言自語的秒數（剛開場先等一下） */
  private mutterIn = 5 + Math.random() * 6;
  private sparkle = new Graphics();
  private target: Station | null = null;
  /** 目前站定的站點（走路、瞬移、被拎著時是 null） */
  private here: Station | null = null;
  private stay = 1.5;
  private stateKey = '';
  private t = 0;
  /** 跨樓層時的魔法瞬移：out → 換位置 → in */
  private poof: { phase: 'out' | 'in'; t: number; to: Station } | null = null;
  dragging = false;
  private swing = 0;
  private lastDragX = 0;

  /** speechLayer：對話泡泡放在飄字上面的獨立圖層，才不會被產出的數字擋住 */
  constructor(private tex: TextureBank, speechLayer: Container) {
    super();
    this.doll = new PaperDoll(tex, 'lumia_chibi_idle');
    this.zz.anchor.set(0.5);
    this.wishHeart.anchor.set(0.5);
    this.wishMark.addChild(this.wishBg, this.wishHeart);
    this.addChild(this.sparkle, this.doll, this.zz, this.wishMark);
    speechLayer.addChild(this.bubble);
    this.position.set(LUMIA_COUNTER.x, LUMIA_COUNTER.y);
    // 點擊由獨立的判定區（LumiaDrag.hit）處理
    this.eventMode = 'none';
  }

  /** 目前的動作與服裝（換服裝時馬上換圖，不用等到下一次換動作） */
  private pose: Pose = 'idle';
  private outfit = '';

  private setPose(s: GameState, pose: Pose): void {
    this.pose = pose;
    this.outfit = s.mascot.outfit;
    this.doll.setPose(this.poseId(s, pose));
  }

  /** 依服裝挑圖：有服裝差分的正式圖就用，沒有就退回預設服裝 */
  private poseId(s: GameState, pose: Pose): string {
    const o = s.mascot.outfit;
    if (o !== 'default' && this.tex.hasArt(`lumia_chibi_${o}_${pose}`)) return `lumia_chibi_${o}_${pose}`;
    if (this.tex.hasArt(`lumia_chibi_${pose}`)) return `lumia_chibi_${pose}`;
    const fallback: Record<Pose, Pose> = { idle: 'idle', walk: 'walk', back: 'back', drag: 'idle', sleep: 'idle', tired_walk: 'walk' };
    return `lumia_chibi_${fallback[pose]}`;
  }

  /** 依目前的指派，可以去的地方 */
  private stations(s: GameState): Station[] {
    if (isRelaxing(s)) return this.relaxStations(s);
    if (isResting(s)) return [{ ...REST_POS, pose: 'sleep', dir: -1 }];
    const pots: Station[] = s.slots.flatMap((slot, i) => (slot.plant && i < FLOATING_SLOT_FROM
      ? [{ x: SLOT_POS[i].x + LUMIA_AT_POT.dx, y: SLOT_POS[i].y + LUMIA_AT_POT.dy, pose: 'back' as const, dir: -1 as const }]
      : []));
    const last = s.cauldrons.length - 1;
    const cy = CAULDRON_Y + LUMIA_AT_CAULDRON.dy;
    const cauldrons: Station[] = [];
    if (last >= 0) cauldrons.push({ x: CAULDRON_X[0] - LUMIA_AT_CAULDRON.dx, y: cy, pose: 'back', dir: 1 });
    if (last >= 1) cauldrons.push({ x: CAULDRON_X[last] + LUMIA_AT_CAULDRON.dx, y: cy, pose: 'back', dir: -1 });
    // 櫃台：在櫃台旁與櫃台正前方之間來回走動（客人在右邊，都面向右）
    const counter: Station[] = [
      { ...LUMIA_COUNTER, pose: 'idle', dir: 1, counter: true },
      { ...LUMIA_COUNTER_FRONT, pose: 'idle', dir: 1, counter: true },
    ];
    // 自由活動時跟著模擬選的區域走（workZone 會回傳她目前的區域）
    switch (workZone(s)) {
      case 'greenhouse': return pots.length ? pots : counter;
      case 'cauldron': return cauldrons.length ? cauldrons : counter;
      default: return counter;
    }
  }

  /** 被拖曳中：掛在手指下方，隨移動左右擺盪 */
  dragTo(s: GameState, x: number, y: number, dt: number): void {
    const vx = (x - this.lastDragX) / Math.max(dt, 1 / 120);
    this.lastDragX = x;
    this.swing += (Math.max(-0.5, Math.min(0.5, -vx * 0.0012)) - this.swing) * Math.min(1, dt * 10);
    this.position.set(x, y);
    this.rotation = this.swing + Math.sin(this.t * 3) * 0.04;
    this.setPose(s, 'drag');
    this.doll.mode = 'idle';
    // 讓手（圖片上緣）在指標位置，身體往下垂
    this.doll.y = this.doll.pic.texture.height * this.doll.pic.baseScale * 0.92;
    this.doll.alpha = 1;
    this.zz.visible = false;
    this.bubble.hide();
    this.doll.update(dt);
  }

  /** 上一次鞠躬後經過的秒數（客人很多時不要一直彎腰） */
  private sinceBow = 99;

  /** 結帳成功：站在櫃台（沒有在走路、瞬移、被拎著）時向客人鞠躬 */
  thankCustomer(): void {
    if (this.dragging || this.poof || this.target || !this.here?.counter) return;
    this.bow();
  }

  /** force：走到櫃台停下來時一定鞠躬（不管剛剛是不是才因為結帳鞠躬過） */
  private bow(force = false): void {
    if ((!force && this.sinceBow < BOW_COOLDOWN) || this.doll.bowing) return;
    this.sinceBow = 0;
    this.doll.bow();
  }

  /** 讓她說一句話（累倒、睡醒時）；之後重新計時下一次自言自語 */
  say(line: string): void {
    if (this.dragging) return;
    this.bubble.show(line, false);
    playBubbleVoice(line);
    this.mutterIn = Math.max(this.mutterIn, MUTTER.intervalMin);
  }

  /** 自言自語：隔一段隨機時間冒一句；睡覺時說夢話比較頻繁 */
  private updateMutter(s: GameState, dt: number): void {
    this.bubble.update(dt);
    if (this.bubble.showing) {
      this.placeBubble();
      return;
    }
    this.mutterIn -= dt;
    if (this.mutterIn > 0) return;
    const sleeping = isSleeping(s);
    this.mutterIn = sleeping
      ? MUTTER.sleepIntervalMin + Math.random() * (MUTTER.sleepIntervalMax - MUTTER.sleepIntervalMin)
      : MUTTER.intervalMin + Math.random() * (MUTTER.intervalMax - MUTTER.intervalMin);
    const line = pickMutter(s);
    this.bubble.show(line, sleeping);
    playBubbleVoice(line);
    this.placeBubble();
  }

  /**
   * 泡泡放在頭頂（有 zZ 時再高一點），靠近畫面邊緣時往內推。
   * 頭頂空間不夠（在二樓、泡泡會被頂部資源列擋住）時，改放在頭的旁邊，尖角指向她。
   */
  private placeBubble(): void {
    const h = this.doll.pic.texture.height * this.doll.pic.baseScale;
    const { halfW, h: bh } = this.bubble.size;
    const margin = 12;
    const top = topBarHeight() + margin;
    const y = this.y - h - (this.zz.visible ? 44 : 12);
    // 泡泡在獨立圖層，用場景座標定位（跟著她移動）
    if (y - bh >= top) {
      this.bubble.setTail('down');
      this.bubble.x = Math.max(margin + halfW, Math.min(W - margin - halfW, this.x));
      this.bubble.y = y;
      return;
    }
    // 放在右邊；右邊放不下就放左邊。尖角尖端對著她頭的側邊
    const headX = 34;
    const headY = this.y - h * 0.72;
    const right = this.x + headX + 2 * halfW + SpeechBubble.TAIL + margin <= W;
    this.bubble.setTail(right ? 'left' : 'right');
    const tip = this.bubble.sideTip;
    this.bubble.x = this.x + (right ? headX : -headX) - tip.x;
    this.bubble.y = Math.max(headY - tip.y, top + bh);
  }

  startDrag(): void {
    this.dragging = true;
    this.here = null;
    this.doll.cancelBow();
    this.poof = null;
    this.target = null;
    this.lastDragX = this.x;
  }

  /** 放開：落到該區域的地板上，再走去新的工作點 */
  drop(x: number, floorY: number): void {
    this.dragging = false;
    this.rotation = 0;
    this.swing = 0;
    this.doll.y = 0;
    this.position.set(x, floorY);
    this.target = null;
    this.stay = 0.4;
    this.stateKey = '';
  }

  /** 心願提醒泡泡：頭的左上方輕輕上下飄，說話時先讓位給對話泡泡 */
  private updateWishMark(s: GameState): void {
    const w = s.wish;
    this.wishMark.visible = !!w && !this.dragging && !this.poof && !this.bubble.showing;
    if (!w || !this.wishMark.visible) return;
    if (w.rarity !== this.wishRarity) {
      this.wishRarity = w.rarity;
      this.wishBg.clear()
        .circle(0, 0, 22).fill({ color: WISH_COLORS[w.rarity] ?? WISH_COLORS[0] }).stroke({ width: 3, color: 0x2b1d14 })
        .circle(12, 22, 5).fill({ color: WISH_COLORS[w.rarity] ?? WISH_COLORS[0] }).stroke({ width: 2, color: 0x2b1d14 })
        .circle(18, 32, 3).fill({ color: WISH_COLORS[w.rarity] ?? WISH_COLORS[0] }).stroke({ width: 2, color: 0x2b1d14 });
    }
    const h = this.doll.pic.texture.height * this.doll.pic.baseScale;
    // 在二樓時別被頂部資源列擋住
    const minY = topBarHeight() + 30 - this.y;
    this.wishMark.position.set(-44, Math.max(minY, -h - 18) + Math.sin(this.t * 2.4) * 5);
    // 閃亮心願會一閃一閃
    const pulse = w.rarity === 2 ? 1 + 0.12 * Math.sin(this.t * 8) : 1 + 0.05 * Math.sin(this.t * 3);
    this.wishMark.scale.set(pulse);
  }

  update(s: GameState, dt: number): void {
    this.t += dt;
    this.sinceBow += dt;
    this.updateWishMark(s);
    // 換了服裝：同一個動作馬上換成新服裝的圖
    if (s.mascot.outfit !== this.outfit) this.setPose(s, this.pose);
    if (this.dragging) return;
    // 瞬移中不說話；其他時候照節奏自言自語
    if (this.poof) this.bubble.hide();
    else this.updateMutter(s, dt);
    const doll = this.doll;
    const tired = isTired(s) && !isResting(s);

    // 指派或休息狀態改變：馬上出發去新的地方
    // 睡飽了（體力滿）也算狀態改變：起床開始在休息室走動
    const key = `${s.mascot.assignment}:${workZone(s)}:${isResting(s)}:${isRelaxing(s)}:${s.cauldrons.length}:${s.slots.filter((x) => x.plant).length}`;
    if (key !== this.stateKey) {
      this.stateKey = key;
      this.target = null;
      this.stay = 0;
    }

    // 魔法瞬移動畫
    if (this.poof) {
      this.poof.t += dt;
      const k = Math.min(1, this.poof.t / POOF_TIME);
      if (this.poof.phase === 'out') {
        doll.alpha = 1 - k;
        doll.scale.set(1 - k * 0.6, 1 + k * 0.3);
        if (k >= 1) {
          this.position.set(this.poof.to.x, this.poof.to.y);
          this.poof = { phase: 'in', t: 0, to: this.poof.to };
        }
      } else {
        doll.alpha = k;
        doll.scale.set(0.4 + k * 0.6, 1.3 - k * 0.3);
        if (k >= 1) {
          this.arrive(s, this.poof.to);
          this.poof = null;
        }
      }
      this.drawSparkle(this.poof ? 1 - Math.abs(0.5 - k) : 0);
      doll.update(dt);
      return;
    }
    doll.alpha = 1;
    doll.scale.set(1);
    this.drawSparkle(0);

    if (!this.target) {
      this.stay -= dt;
      if (this.stay <= 0) {
        const all = this.stations(s);
        const options = all.filter((st) => Math.hypot(st.x - this.x, st.y - this.y) > 30);
        this.target = options[Math.floor(Math.random() * options.length)] ?? null;
        if (this.target) this.here = null;
        this.stay = 3 + Math.random() * 5;
        // 只有一個點而且已經在那裡：擺好姿勢
        if (!this.target && all[0]) this.arrive(s, all[0]);
      }
      this.updateZz(s, dt);
      doll.update(dt);
      return;
    }

    // 目標在另一層樓：用魔法瞬移
    const otherFloor = (this.y < FLOOR_SPLIT_Y) !== (this.target.y < FLOOR_SPLIT_Y);
    if (otherFloor) {
      this.poof = { phase: 'out', t: 0, to: this.target };
      this.target = null;
      return;
    }

    const dx = this.target.x - this.x;
    const dy = this.target.y - this.y;
    const dist = Math.hypot(dx, dy);
    const speed = tired ? TIRED_SPEED : LUMIA_SPEED;
    const step = speed * dt;
    if (dist <= step) {
      this.arrive(s, this.target);
      this.target = null;
    } else {
      this.x += (dx / dist) * step;
      this.y += (dy / dist) * step;
      this.setPose(s, tired ? 'tired_walk' : 'walk');
      doll.mode = 'walk';
      doll.cancelBow();
      if (Math.abs(dx) > 2) doll.dir = dx > 0 ? 1 : -1;
    }
    this.updateZz(s, dt);
    doll.update(dt, speed);
  }

  private arrive(s: GameState, st: Station): void {
    const moved = this.here !== st;
    this.here = st;
    this.position.set(st.x, st.y);
    // 走到櫃台的站點停下來：向客人鞠躬
    if (st.counter && moved) this.bow(true);
    this.setPose(s, st.pose === 'back' ? 'back' : st.pose === 'sleep' ? 'sleep' : 'idle');
    this.doll.mode = st.pose === 'back' ? 'work' : 'idle';
    this.doll.dir = st.dir;
    // 休息室的家具旁邊：有機率說一句跟它有關的話
    if (st.talk && Math.random() < 0.7) this.say(st.talk[Math.floor(Math.random() * st.talk.length)]);
  }

  /**
   * 體力滿了還在休息室：在房間裡走來走去，兌換過的家具旁邊也是停留點
   * （史萊姆娃娃在坐墊旁、留聲機與紅茶組在邊桌）
   */
  private relaxStations(s: GameState): Station[] {
    const y = FLOOR_2F_Y - 6;
    const spots: Station[] = [
      { x: 190, y, pose: 'idle', dir: -1 },
      { x: REST_POS.x - 40, y, pose: 'idle', dir: 1 },
      { x: 880, y, pose: 'idle', dir: -1 },
    ];
    const open = decorSlots(s);
    DECOR_POS.forEach((pos, k) => {
      const id = k < open ? s.decor[k] : null;
      if (!id || !s.gifts[id]) return;
      const talk = MUTTER_LINES.furniture[id];
      spots.push({ x: pos.x + (pos.x > REST_POS.x + 200 ? -10 : 50), y, pose: 'idle', dir: pos.x > REST_POS.x + 200 ? 1 : -1, talk });
    });
    return spots;
  }

  /** 睡覺或疲勞時頭上冒 zZ */
  private updateZz(s: GameState, _dt: number): void {
    const sleepy = isSleeping(s) || (isTired(s) && !isResting(s));
    this.zz.visible = sleepy && !this.dragging;
    if (!this.zz.visible) return;
    const h = this.doll.pic.texture.height * this.doll.pic.baseScale;
    this.zz.position.set(34, -h - 10 + Math.sin(this.t * 2) * 6);
    this.zz.alpha = 0.6 + 0.4 * Math.sin(this.t * 3);
  }

  private drawSparkle(strength: number): void {
    this.sparkle.clear();
    if (strength <= 0) return;
    for (let k = 0; k < 6; k++) {
      const a = this.t * 4 + (k * Math.PI) / 3;
      this.sparkle.circle(Math.cos(a) * 50, -90 + Math.sin(a) * 60, 5).fill({ color: 0xfff1a8, alpha: strength });
    }
    this.sparkle.circle(0, -90, 70 * strength).fill({ color: 0xc9a0ff, alpha: 0.25 * strength });
  }

  /** 互動判定用的範圍（相對於腳底） */
  get hitBox() {
    return new Rectangle(this.x - 55, this.y - 200, 110, 200);
  }
}

/** 新手教學：上下跳動的箭頭，指著這一步要點的東西（箭頭尖端在 target） */
class TutorialPointer extends Container {
  private g = new Graphics();
  private t = 0;

  constructor() {
    super();
    this.g
      .poly([-26, -70, 26, -70, 26, -34, 44, -34, 0, 0, -44, -34, -26, -34])
      .fill({ color: 0xffd34d })
      .stroke({ width: 5, color: 0x2b1d14, join: 'round' });
    this.addChild(this.g);
    this.eventMode = 'none';
    this.visible = false;
  }

  update(target: { x: number; y: number } | null, dt: number): void {
    this.visible = !!target;
    if (!target) return;
    this.t += dt;
    const bob = Math.abs(Math.sin(this.t * 4)) * 16;
    this.position.set(target.x, target.y - bob);
    this.g.alpha = 0.85 + 0.15 * Math.sin(this.t * 8);
  }
}

/** 拖曳露米婭時，標示放開後會指派到哪一區 */
class ZoneHighlight extends Container {
  private g = new Graphics();
  private caption = text('', 30, 0xffffff);
  private current: Assignment | null = null;

  constructor() {
    super();
    this.caption.anchor.set(0.5);
    this.addChild(this.g, this.caption);
    this.visible = false;
    this.eventMode = 'none';
  }

  show(zone: Assignment | null): void {
    this.visible = !!zone;
    if (!zone || zone === this.current) return;
    this.current = zone;
    const z = ASSIGN_ZONES[zone];
    this.g.clear()
      .roundRect(z.x, z.y, z.w, z.h, 18).fill({ color: 0xfff1a8, alpha: 0.18 })
      .stroke({ width: 5, color: 0xffd34d, alpha: 0.9 });
    this.caption.text = `${ASSIGNMENTS[zone].name}\n${ASSIGNMENTS[zone].desc}`;
    this.caption.position.set(z.x + z.w / 2, z.y + 60);
  }
}

function zoneAt(x: number, y: number): Assignment | null {
  for (const [id, z] of Object.entries(ASSIGN_ZONES) as [Assignment, (typeof ASSIGN_ZONES)[Assignment]][]) {
    if (x >= z.x && x <= z.x + z.w && y >= z.y && y <= z.y + z.h) return id;
  }
  return null;
}

/** 長按（或按住拖動）露米婭 → 拎起來指派；短按 → 打開互動視窗 */
class LumiaDrag {
  readonly hit = new Container();
  private down: { t: number; x: number; y: number } | null = null;
  private pointer = { x: 0, y: 0 };
  private active = false;

  constructor(
    app: Application, private game: Game, private lumia: LumiaView, private highlight: ZoneHighlight,
    private onDragChange: (dragging: boolean) => void,
  ) {
    this.hit.eventMode = 'static';
    this.hit.cursor = 'grab';
    this.hit.on('pointerdown', (e: FederatedPointerEvent) => {
      this.down = { t: performance.now(), x: e.global.x, y: e.global.y };
      this.pointer = { x: e.global.x, y: e.global.y };
    });
    app.stage.on('globalpointermove', (e: FederatedPointerEvent) => {
      this.pointer = { x: e.global.x, y: e.global.y };
    });
    const end = () => this.release();
    window.addEventListener('pointerup', end);
    window.addEventListener('pointercancel', end);
  }

  update(s: GameState, dt: number): void {
    this.hit.hitArea = this.lumia.hitBox;
    if (this.down && !this.active) {
      const moved = Math.hypot(this.pointer.x - this.down.x, this.pointer.y - this.down.y) > 12;
      if (moved || performance.now() - this.down.t > 250) {
        this.active = true;
        this.lumia.startDrag();
        this.onDragChange(true);
      }
    }
    if (this.active) {
      this.lumia.dragTo(s, this.pointer.x, this.pointer.y, dt);
      this.highlight.show(zoneAt(this.pointer.x, this.pointer.y));
    }
  }

  private release(): void {
    if (!this.down) return;
    const wasDrag = this.active;
    this.down = null;
    this.active = false;
    this.highlight.show(null);
    if (!wasDrag) {
      lumiaOpen.value = true;
      return;
    }
    const zone = zoneAt(this.pointer.x, this.pointer.y) ?? this.game.state.mascot.assignment;
    const floorY = this.pointer.y < FLOOR_SPLIT_Y ? FLOOR_2F_Y : FLOOR_1F_Y;
    const x = Math.max(60, Math.min(W - 60, this.pointer.x));
    this.lumia.drop(x, floorY);
    this.onDragChange(false);
    this.game.assignLumia(zone);
    showToast(t('scene.assigned', { zone: ASSIGNMENTS[zone].name, desc: ASSIGNMENTS[zone].desc }));
  }
}

/** 狂熱時刻的四周暈光：中間透明、往四周漸漸變成暖金色（只畫一次，用加亮混合疊在畫面上） */
function feverVignette(): Texture {
  const c = document.createElement('canvas');
  c.width = 320;
  c.height = 180;
  const g = c.getContext('2d')!;
  const grad = g.createRadialGradient(160, 90, 40, 160, 90, 190);
  grad.addColorStop(0, 'rgba(255, 196, 96, 0)');
  grad.addColorStop(0.55, 'rgba(255, 190, 90, 0)');
  grad.addColorStop(0.85, 'rgba(255, 176, 72, 0.35)');
  grad.addColorStop(1, 'rgba(255, 160, 60, 0.7)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 320, 180);
  return Texture.from(c);
}

interface Mote { g: Graphics; life: number; max: number; vx: number; vy: number; r: number; phase: number }

/**
 * 狂熱時刻：畫面四周柔和的暖金色暈光（慢慢呼吸，開始、結束時淡入淡出），
 * 加上從下往上慢慢飄的金色光點（數量跟著效能設定）
 */
class FeverOverlay extends Container {
  private t = 0;
  /** 0 → 1：狂熱開始時淡入、結束時淡出 */
  private k = 0;
  private glow = new Sprite(feverVignette());
  private motes: Mote[] = [];
  private pool = new Pool(this, () => {
    const g = new Graphics(DOT);
    g.blendMode = 'add';
    return g;
  });
  private spawnAcc = 0;

  constructor() {
    super();
    this.eventMode = 'none';
    this.glow.width = W;
    this.glow.height = H;
    this.glow.blendMode = 'add';
    this.addChild(this.glow);
    this.visible = false;
  }

  update(s: GameState, dt: number): void {
    this.t += dt;
    const on = s.feverLeft > 0;
    this.k = Math.max(0, Math.min(1, this.k + (on ? dt / 0.6 : -dt / 0.8)));
    this.visible = this.k > 0 || this.motes.length > 0;
    if (!this.visible) return;
    // 暈光慢慢呼吸（約 2.6 秒一次），不閃爍
    this.glow.alpha = this.k * (0.75 + 0.25 * Math.sin(this.t * 2.4));

    // 光點：完整每秒約 22 顆，精簡 8 顆，最少不飄
    const rate = on ? { full: 22, lite: 8, min: 0 }[perf.value.effects] : 0;
    this.spawnAcc += rate * dt;
    while (this.spawnAcc >= 1) {
      this.spawnAcc -= 1;
      const g = this.pool.get();
      g.tint = Math.random() < 0.7 ? 0xffd98a : 0xfff4d6;
      g.position.set(Math.random() * W, H - 20 + Math.random() * 40);
      const life = 3 + Math.random() * 2.5;
      this.motes.push({
        g, life, max: life, vx: (Math.random() - 0.5) * 20, vy: -(90 + Math.random() * 110),
        r: 2.5 + Math.random() * 3.5, phase: Math.random() * 6,
      });
    }
    for (const m of this.motes) {
      m.life -= dt;
      m.g.x += (m.vx + Math.sin(this.t * 1.6 + m.phase) * 14) * dt;
      m.g.y += m.vy * dt;
      const age = 1 - m.life / m.max;
      // 淡入、飄到一半最亮、最後淡出；閃爍很輕
      const fade = Math.min(1, age * 5, (m.life / m.max) * 3);
      m.g.alpha = Math.max(0, fade * (0.55 + 0.25 * Math.sin(this.t * 5 + m.phase)));
      m.g.scale.set(m.r);
    }
    sweep(this.motes, (m) => this.pool.put(m.g));
  }
}

// ---------- 升級道具（買了才出現在場景裡） ----------

/** 算盤松鼠結帳動作的秒數，以及動作做到多少以後才能接下一次 */
const SQUIRREL_ANIM_TIME = 0.5;
const SQUIRREL_RESTART_AT = 0.5;

/** 滑鼠停在擺設上多久（秒；手機為長按）才顯示效果 */
const DECOR_TIP_DELAY = 0.5;

/** 休息室擺設的說明框：名稱 + 擺出來的效果 */
class DecorTip extends Container {
  private bg = new Graphics();
  private title = new Text({ text: '', style: { fontFamily: uiFont(), fontSize: 22, fontWeight: '700', fill: 0x4a3426 } });
  private body = new Text({
    text: '',
    style: {
      fontFamily: uiFont(), fontSize: 18, fontWeight: '700', fill: 0x2f6f6a,
      wordWrap: true, breakWords: true, wordWrapWidth: 300, lineHeight: 26,
    },
  });

  constructor() {
    super();
    this.addChild(this.bg, this.title, this.body);
    this.eventMode = 'none';
    this.visible = false;
  }

  /** 放在物件（x 為中心、top～bottom 為上下緣）的上方；上方會被頂部資源列擋住時放在下方 */
  show(title: string, body: string, x: number, top: number, bottom: number): void {
    this.title.text = title;
    this.body.text = body;
    const pad = 14;
    const w = Math.max(this.title.width, this.body.width) + pad * 2;
    const h = this.title.height + 6 + this.body.height + pad * 2;
    this.title.position.set(pad, pad);
    this.body.position.set(pad, pad + this.title.height + 6);
    this.bg.clear().roundRect(0, 0, w, h, 14).fill({ color: 0xfffaf0, alpha: 0.97 }).stroke({ width: 3, color: 0xd9a441 });
    const margin = 10;
    const above = top - h - 8;
    this.position.set(
      Math.max(margin, Math.min(W - margin - w, x - w / 2)),
      above >= topBarHeight() + margin ? above : bottom + 8,
    );
    this.visible = true;
  }

  hide(): void {
    this.visible = false;
  }
}

class PropsLayer extends Container {
  private items: { upg: string; when: (s: GameState) => boolean; pic: Pic; bob: number; baseY: number }[] = [];
  private decor: Pic[];
  /** 擺設說明框（畫在最上層，由 createScene 加到舞台） */
  readonly tip = new DecorTip();
  /** 滑鼠停在（或手指按住）第 k 格擺設上的時間 */
  private hover: { k: number; t: number; touch: boolean } | null = null;
  private tipFor = -1;
  private suppressTap = false;

  private endHover(): void {
    this.hover = null;
    this.tipFor = -1;
    this.tip.hide();
  }
  private bell: Pic;
  private bellPips = new Graphics();
  private bellPunch = 0;
  /** 算盤松鼠：每完成一筆結帳就拉長再縮回、左右搖一下（squirrelAnim 從 0 跑到 1） */
  private squirrel: Pic;
  private squirrelAnim = 1;
  private crates = new Map<CrateKind, { box: Container; pic: Pic; baseScale: number; punch: number; icon: Pic; iconY: number }>();
  private t = 0;

  constructor(tex: TextureBank, private game: Game) {
    super();
    const add = (
      upg: string, id: string, pos: { x: number; y: number }, bob = 0, anchorY = 1,
      when: (s: GameState) => boolean = (s) => has(s, upg),
    ) => {
      const pic = new Pic(tex, id);
      pic.anchor.set(0.5, anchorY);
      pic.position.set(pos.x, pos.y);
      pic.eventMode = 'none';
      this.addChild(pic);
      this.items.push({ upg, when, pic, bob, baseY: pos.y });
      return pic;
    };
    add('star_can', 'upg_starsilver_can', PROPS.starCan);
    add('fortune_owl', 'upg_owl', PROPS.owl);
    this.squirrel = add(SQUIRREL, 'upg_abacus_squirrel', PROPS.squirrel, 1);
    add('diffuser', 'upg_diffuser', PROPS.diffuser, 1.5);
    add('signboard', 'upg_signboard', PROPS.signboard, 0, 0);
    // 休息室擺設位：擺出來的禮物（圖跟著擺的東西換）。
    // 點一下打開擺設頁面；滑鼠停在上面 0.5 秒（手機長按）顯示效果
    this.decor = DECOR_POS.map((pos, k) => {
      const pic = new Pic(tex, 'gift_gramophone', pos.w, pos.h);
      pic.anchor.set(0.5, 1);
      pic.position.set(pos.x, pos.y);
      pic.eventMode = 'static';
      pic.cursor = 'pointer';
      pic.on('pointerover', (e: FederatedPointerEvent) => {
        if (e.pointerType === 'mouse') this.hover = { k, t: 0, touch: false };
      });
      pic.on('pointerout', () => {
        if (this.hover?.k === k && !this.hover.touch) this.endHover();
      });
      pic.on('pointerdown', (e: FederatedPointerEvent) => {
        this.suppressTap = false;
        if (e.pointerType !== 'mouse') this.hover = { k, t: 0, touch: true };
      });
      const release = () => {
        if (this.hover?.touch) this.endHover();
      };
      pic.on('pointerup', release);
      pic.on('pointerupoutside', release);
      pic.on('pointertap', () => {
        // 長按看完效果放開，不要順便打開頁面
        if (this.suppressTap) {
          this.suppressTap = false;
          return;
        }
        this.endHover();
        openDrawer('decor');
      });
      pic.visible = false;
      this.addChild(pic);
      return pic;
    });

    // 叫賣鈴鐺：可以點
    this.bell = add('bell', 'upg_bell', PROPS.bell);
    this.bell.eventMode = 'static';
    this.bell.cursor = 'pointer';
    this.bell.on('pointerdown', () => this.ring());
    this.bellPips.position.set(PROPS.bell.x, PROPS.bell.y + 12);
    this.addChild(this.bellPips);

    // 收購箱：二樓倉庫裡一字排開，每買一個就多一個箱子；箱子正面的木板上貼對應的藥水／原料圖示，點了打開設定
    for (const kind of Object.keys(CRATE_POS) as CrateKind[]) {
      const pos = CRATE_POS[kind];
      const box = new Container();
      box.position.set(pos.x, pos.y);
      const pic = new Pic(tex, 'upg_crate');
      pic.anchor.set(0.5, 1);
      const h = pic.texture.height * pic.baseScale;
      // 正面木板約占箱子高度的 44%，圖示比木板小一點
      const iconSize = Math.round(h * 0.38);
      const icon = new Pic(tex, kind === 'materials' ? 'item_redheart' : `potion_${kind}`, iconSize, iconSize);
      icon.anchor.set(0.5);
      box.addChild(pic, icon);
      box.eventMode = 'static';
      box.cursor = 'pointer';
      box.on('pointerdown', () => openDrawer('counter', 'crate-reserve'));
      this.addChild(box);
      this.crates.set(kind, { box, punch: 0, baseScale: pic.baseScale, pic, icon, iconY: -h * CRATE_PANEL_Y });
    }
  }

  /**
   * 完成一筆結帳：算盤松鼠拉長再縮回、搖一下。
   * 結帳很快時不要每筆都從頭開始（會一直抖），動作做到一半以後才接下一次
   */
  bumpSquirrel(): void {
    if (this.squirrel.visible && this.squirrelAnim >= SQUIRREL_RESTART_AT) this.squirrelAnim = 0;
  }

  /** 看得到的收購箱（底部中心） */
  visibleCrates(): { x: number; y: number }[] {
    return [...this.crates.values()].filter((c) => c.box.visible).map((c) => ({ x: c.box.x, y: c.box.y }));
  }

  /** 收購時讓對應的箱子彈一下，並回傳飄字位置 */
  bumpCrate(kind: CrateKind): { x: number; y: number } | null {
    const c = this.crates.get(kind);
    if (!c || !c.box.visible) return null;
    c.punch = 1;
    return { x: c.box.x, y: c.box.y - 130 };
  }

  private ring(): void {
    const r = this.game.ringBell();
    if (r === 'ok') this.bellPunch = 1;
    else if (r === 'empty') showToast(t('scene.bellEmpty'));
    else if (r === 'full') showToast(t('scene.queueFull'));
  }

  update(s: GameState, dt: number): void {
    this.t += dt;
    this.bellPunch = Math.max(0, this.bellPunch - dt * 3);
    for (const it of this.items) {
      it.pic.visible = it.when(s);
      if (it.bob) it.pic.y = it.baseY + Math.sin(this.t * it.bob) * 2;
    }
    const open = decorSlots(s);
    this.decor.forEach((pic, k) => {
      const id = k < open ? s.decor[k] : null;
      const gift = id && s.gifts[id] ? GIFT_MAP[id] : null;
      pic.visible = !!gift;
      if (gift) pic.setId(gift.icon);
    });
    // 停留 0.5 秒後顯示擺設的效果（擺設被換掉或收起來時跟著更新／關掉）
    if (this.hover) {
      this.hover.t += dt;
      const k = this.hover.k;
      const pic = this.decor[k];
      const id = k < open ? s.decor[k] : null;
      const gift = id && s.gifts[id] && pic.visible ? GIFT_MAP[id] : null;
      if (!gift) {
        this.endHover();
      } else if (this.hover.t >= DECOR_TIP_DELAY && this.tipFor !== k) {
        this.tipFor = k;
        if (this.hover.touch) this.suppressTap = true;
        const h = pic.texture.height * pic.baseScale;
        this.tip.show(gift.name, t('scene.decorTip', { desc: gift.desc }), pic.x, pic.y - h, pic.y);
      }
    }
    // 算盤松鼠的結帳動作：先往上拉長，再壓扁回彈（體積大致不變），同時左右搖擺，越來越小
    this.squirrelAnim = Math.min(1, this.squirrelAnim + dt / SQUIRREL_ANIM_TIME);
    const sq = this.squirrel;
    if (this.squirrelAnim < 1) {
      const p = this.squirrelAnim;
      const fade = 1 - p;
      const sy = 1 + 0.28 * Math.sin(p * Math.PI * 2) * fade;
      sq.scale.set(sq.baseScale / Math.sqrt(sy), sq.baseScale * sy);
      sq.rotation = Math.sin(p * Math.PI * 4) * 0.14 * fade;
    } else if (sq.rotation !== 0) {
      sq.scale.set(sq.baseScale);
      sq.rotation = 0;
    }
    // 招牌輕輕搖晃
    const sign = this.items.find((i) => i.upg === 'signboard')!.pic;
    sign.rotation = Math.sin(this.t * 1.3) * 0.05;
    // 鈴鐺被搖時左右擺
    this.bell.rotation = Math.sin(this.bellPunch * 20) * 0.4 * this.bellPunch;

    // 收購箱：買了才出現；收購時擠壓彈跳
    for (const [kind, c] of this.crates) {
      c.box.visible = has(s, kind === 'materials' ? CRATE_MATERIALS : CRATE_FOR[kind]);
      c.punch = Math.max(0, c.punch - dt * 4);
      const squash = 1 + Math.sin(c.punch * Math.PI) * 0.12;
      c.pic.scale.set(c.baseScale * squash, c.baseScale / squash);
      // 圖示跟著木板一起擠壓
      c.icon.y = c.iconY / squash;
      c.icon.scale.set(c.icon.baseScale * squash, c.icon.baseScale / squash);
    }

    // 鈴鐺剩餘次數
    this.bellPips.clear();
    this.bellPips.visible = this.bell.visible;
    if (this.bell.visible) {
      for (let k = 0; k < UPGRADE_FX.bellMaxCharges; k++) {
        this.bellPips.circle((k - 1) * 14, 0, 5)
          .fill({ color: k < s.bellCharges ? 0xffd34d : 0x3a2a20 })
          .stroke({ width: 2, color: 0x2b1d14 });
      }
    }
  }

}

// ---------- 大釜拖曳排序 ----------

/** 長按 0.3 秒後左右拖曳大釜，放開時移到最近的位置 */
class CauldronDrag {
  /** 拖曳中把大釜與它的名稱、等級等資訊搬到這個最上層，才看得到自己拿起了哪一口 */
  topLayer: Container | null = null;
  /** 被搬上去的物件原本的位置，放開後放回去 */
  private lifted: { obj: Container; parent: Container; index: number }[] = [];
  private view: CauldronView | null = null;
  private downAt = 0;
  private startX = 0;
  private startY = 0;
  private pointerX = 0;
  private moved = false;
  private dragging = false;

  constructor(app: Application, private game: Game) {
    app.stage.eventMode = 'static';
    app.stage.hitArea = new Rectangle(0, 0, W, H);
    app.stage.on('globalpointermove', (e: FederatedPointerEvent) => {
      if (!this.view) return;
      this.pointerX = e.global.x;
      if (Math.hypot(e.global.x - this.startX, e.global.y - this.startY) > 24) this.moved = true;
    });
    const end = () => this.release();
    window.addEventListener('pointerup', end);
    window.addEventListener('pointercancel', end);
  }

  press(view: CauldronView, e: FederatedPointerEvent): void {
    if (!view.active || this.game.state.cauldrons.length < 2) return;
    this.view = view;
    this.downAt = performance.now();
    this.startX = this.pointerX = e.global.x;
    this.startY = e.global.y;
    this.moved = false;
    this.dragging = false;
  }

  update(): void {
    const v = this.view;
    if (!v) return;
    if (!this.dragging) {
      if (this.moved) {
        this.view = null; // 手指滑開：不是長按
        return;
      }
      if (performance.now() - this.downAt < 300) return;
      this.dragging = true;
      startGrabbing();
      this.lift(v);
    }
    const n = this.game.state.cauldrons.length;
    v.dragX = Math.max(CAULDRON_X[0], Math.min(CAULDRON_X[n - 1], this.pointerX));
  }

  private release(): void {
    const v = this.view;
    this.view = null;
    if (!v || !this.dragging) return;
    this.dragging = false;
    const n = this.game.state.cauldrons.length;
    let to = 0;
    for (let k = 1; k < n; k++) {
      if (Math.abs(CAULDRON_X[k] - v.dragX!) < Math.abs(CAULDRON_X[to] - v.dragX!)) to = k;
    }
    v.dragX = null;
    this.drop();
    if (this.game.moveCauldron(v.i, to)) showToast(t('scene.cauldronMoved'));
  }

  /** 拿起來：大釜本體與資訊層都移到最上層 */
  private lift(v: CauldronView): void {
    if (!this.topLayer) return;
    for (const obj of [v, v.hud]) {
      const parent = obj.parent;
      if (!parent) continue;
      this.lifted.push({ obj, parent, index: parent.getChildIndex(obj) });
      this.topLayer.addChild(obj);
    }
  }

  /** 放下：放回原本的圖層與順序 */
  private drop(): void {
    for (const { obj, parent, index } of this.lifted) {
      parent.addChildAt(obj, Math.min(index, parent.children.length));
    }
    this.lifted = [];
  }
}

// ---------- 飄字 ----------

/*
 * 飄字的數量上限在 perf.ts 的 FLOAT_LIMITS（設定頁可以調）：
 * 同時存在的上限（產量極快時避免物件無限增加拖慢畫面；超過就收掉最舊的，新的照樣出現）、
 * 同一個來源（某一盆、某一口大釜…）同時最多幾個字（避免殘影糊成一片）、
 * 同一個來源每一幀最多新增幾個字（一幀內湧出幾十個時，多的會疊在一起看不出來）
 */
/**
 * 每個來源估算每秒冒幾個字（指數平均，時間常數 FLOAT_RATE_TAU 秒）：
 * 超過 FLOAT_RATE_OK 個／秒時，那個來源的字動得更快、更早消失（最多快 FLOAT_MAX_SPEEDUP 倍），
 * 讓新的字有位置出現，不會因為舊的還沒消失就被丟掉
 */
const FLOAT_RATE_TAU = 2;
const FLOAT_RATE_OK = 3;
const FLOAT_MAX_SPEEDUP = 4;
/** 大釜一般產出的飄字：往上彈的力道與左右散開的幅度（雙倍的大字維持原本的高度） */
const CAULDRON_FLOAT_LAUNCH = 0.5;
const CAULDRON_FLOAT_SPREAD = 1.3;
/** 飄字停留時間（秒），最後 FLOAT_FADE 秒淡出 */
const FLOAT_LIFE = 1.6;
const FLOAT_FADE = 0.5;
/** 飄字大小（相對於 40px 的點陣字）：一般 20px、大字（暴擊、急單、雙倍）28px */
const FLOAT_SIZE = 0.5;
const FLOAT_BIG_SIZE = 0.7;
/** 一樓的飄字不會飄進二樓（浮空盆栽的字才不會蓋住在休息室睡覺的露米婭） */
const FLOAT_1F_CEILING = ZONES.greenhouse.y + 30;

/**
 * 飄字用點陣字（大量飄字時比一般文字省效能）：白字深色描邊，再用 tint 上色。
 * 字型先用名稱安裝一次，所有飄字共用：PixiJS 會依「樣式物件」自動產生點陣字型，
 * 每個飄字各有一份樣式的話，每個都會建一份自己的字型貼圖（上百份），並一直跳效能警告。
 * 安裝的字型遇到新的字（中文名稱、數字）會自動補進去
 */
const FLOAT_FONT = 'float-text';
const FLOAT_STYLE = { fontFamily: FLOAT_FONT, fontSize: 40 };

function installFloatFont(): void {
  BitmapFont.install({
    name: FLOAT_FONT,
    style: { fontFamily: uiFont(), fontSize: 40, fill: 0xffffff, fontWeight: '700', stroke: { color: 0x2b1d14, width: 7 } },
    chars: [['0', '9'], ['a', 'z'], ['A', 'Z'], ' +-.,/%×！？：（）金'],
  });
}

/**
 * 產出、收入的飄字：每個字往不同方向彈出去（左右散開、先往上再慢慢落下），
 * 停留久一點把附近的畫面塞滿，保留放置遊戲的資訊量與爽快感。
 */
/** 飄字選項 */
interface FloatOpts {
  /** 大字（暴擊、雙倍、急單） */
  big?: boolean;
  /** 一定顯示，不受每幀新增上限影響（收入、大字） */
  always?: boolean;
  /** 來源（例如 pot:0、cauldron:glow），用來估算它每秒冒幾個字 */
  key?: string;
  /** 往上彈的力道倍率（小於 1 = 停在比較低的位置） */
  launch?: number;
  /** 左右散開的幅度倍率 */
  spread?: number;
  /** 事件的回饋字：事件進行中不跟著變淡 */
  bright?: boolean;
}

/** 事件進行中，事件區域裡的飄字淡到這個透明度（讓要點的東西看得清楚） */
const FLOAT_DIM_ALPHA = 0.3;

interface FloatItem {
  t: BitmapText;
  life: number;
  vx: number;
  vy: number;
  spin: number;
  size: number;
  top: number;
  /** 來源；以及時間流速（來源冒字越快，字動得越快、越早消失） */
  key: string;
  speed: number;
  bright: boolean;
}

class FloatLayer extends Container {
  constructor() {
    super();
    // 字型在場景建立時（網頁字型載入後）才安裝，字形才會用正確的字體畫
    installFloatFont();
    // 純顯示，不擋點擊（飄字常常蓋在盆栽與大釜上）
    this.eventMode = 'none';
  }

  private items: FloatItem[] = [];
  private pool = new Pool(this, () => {
    const t = new BitmapText({ text: '', style: FLOAT_STYLE });
    t.anchor.set(0.5);
    return t;
  });
  /** 各來源：估計的每秒字數、上次冒字的時間、這一幀新增了幾個、目前有幾個字 */
  private sources = new Map<string, { rate: number; last: number; frame: number; count: number }>();
  private now = 0;
  /** 事件進行中的區域：裡面的飄字變淡（null = 不變淡）；dimK 是漸變的程度 */
  dimRect: { x: number; y: number; w: number; h: number } | null = null;
  private dimK = 0;
  private lastDim: { x: number; y: number; w: number; h: number } | null = null;

  spawn(s: string, x: number, y: number, color: number, opts: FloatOpts = {}): void {
    const { big = false, always = big, key = 'misc', launch = 1, spread = 1, bright = false } = opts;
    // 效能設定的上限（「只顯示重要的」= 只留一定要顯示的字：收入、暴擊、雙倍、事件）
    const lim = FLOAT_LIMITS[perf.value.floats];
    if (lim.keyOnly && !always) return;
    let src = this.sources.get(key);
    if (!src) {
      src = { rate: 0, last: this.now, frame: 0, count: 0 };
      this.sources.set(key, src);
    }
    src.rate = src.rate * Math.exp(-(this.now - src.last) / FLOAT_RATE_TAU) + 1 / FLOAT_RATE_TAU;
    src.last = this.now;
    if (!always && src.frame >= lim.perFrame) return;
    src.frame++;
    // 這個來源的字太多、或全部的字太多：收掉最舊的，讓新的出現（設定調低上限時一次收到上限以內）
    while (src.count >= lim.perSource) {
      const i = this.items.findIndex((it) => it.key === key);
      if (i < 0) {
        src.count = 0;
        break;
      }
      this.recycle(i);
    }
    while (this.items.length > 0 && this.items.length >= lim.total) this.recycle(0);
    const t = this.pool.get();
    if (t.text !== s) t.text = s;
    t.tint = color;
    t.alpha = 1;
    t.position.set(x + (Math.random() - 0.5) * 30, y);
    const size = big ? FLOAT_BIG_SIZE : FLOAT_SIZE;
    t.scale.set(size * 0.6);
    // 隨機的彈射軌道：左右散開的幅度、往上的力道都不同
    const side = Math.random() < 0.5 ? -1 : 1;
    src.count++;
    this.items.push({
      t, life: FLOAT_LIFE, size, top: y >= ZONES.greenhouse.y ? FLOAT_1F_CEILING : 20,
      vx: side * (30 + Math.random() * 150) * spread,
      vy: -(200 + Math.random() * 180) * launch,
      spin: (Math.random() - 0.5) * 0.25,
      key,
      speed: Math.max(1, Math.min(FLOAT_MAX_SPEEDUP, src.rate / FLOAT_RATE_OK)),
      bright,
    });
  }

  private recycle(index: number): void {
    if (index < 0 || index >= this.items.length) return;
    const [it] = this.items.splice(index, 1);
    this.pool.put(it.t);
    const src = this.sources.get(it.key);
    if (src) src.count--;
  }

  update(realDt: number): void {
    this.now += realDt;
    for (const src of this.sources.values()) src.frame = 0;
    // 事件開始／結束時慢慢變淡／恢復
    if (this.dimRect) this.lastDim = this.dimRect;
    this.dimK = Math.max(0, Math.min(1, this.dimK + (this.dimRect ? 1 : -1) * realDt * 4));
    const r = this.lastDim;
    const dim = 1 - (1 - FLOAT_DIM_ALPHA) * this.dimK;
    for (const it of this.items) {
      // 整條軌跡照同樣的形狀跑，只是時間流速變快
      const dt = realDt * it.speed;
      it.life -= dt;
      const age = FLOAT_LIFE - it.life;
      it.vy += 420 * dt;
      it.vx *= 1 - Math.min(1, dt * 1.2);
      it.t.x += it.vx * dt;
      // 往上彈出後慢慢往下飄（下落速度有上限，停留在附近）
      it.t.y += Math.min(it.vy, 40) * dt;
      // 碰到天花板就停止往上（一樓的字不進二樓）
      if (it.t.y < it.top) {
        it.t.y = it.top;
        it.vy = Math.max(it.vy, 0);
      }
      it.t.rotation = it.spin * Math.min(1, age * 3);
      // 出現時先放大再回彈
      const pop = age < 0.18 ? 0.6 + (age / 0.18) * 0.55 : Math.max(1, 1.15 - (age - 0.18) * 1.5);
      it.t.scale.set(it.size * pop);
      it.t.alpha = Math.min(1, it.life / FLOAT_FADE);
      if (r && this.dimK > 0 && !it.bright && it.t.x >= r.x && it.t.x <= r.x + r.w && it.t.y >= r.y && it.t.y <= r.y + r.h) {
        it.t.alpha *= dim;
      }
    }
    sweep(this.items, (it) => {
      this.pool.put(it.t);
      const src = this.sources.get(it.key);
      if (src) src.count--;
    });
  }
}

// ---------- 背景 ----------

function buildBackground(tex: TextureBank): Container {
  const root = new Container();
  if (tex.hasArt('bg_dollhouse_main')) {
    const bg = new Pic(tex, 'bg_dollhouse_main', W, H);
    root.addChild(bg);
    return root;
  }
  // 佔位背景：畫出兩層樓娃娃屋的區域
  const g = new Graphics();
  g.rect(0, 0, W, H).fill({ color: 0x1c130e });
  g.roundRect(14, 80, W - 28, H - 70, 18).fill({ color: 0x2b1d14 });
  for (const z of Object.values(ZONES)) {
    g.rect(z.x, z.y, z.w, z.h).fill({ color: z.color });
    g.rect(z.x, z.y + z.h - 14, z.w, 14).fill({ color: 0x241710 });
  }
  // 溫室玻璃屋頂與層架
  g.rect(ZONES.greenhouse.x, ZONES.greenhouse.y, ZONES.greenhouse.w, 60).fill({ color: 0xbfe3d0, alpha: 0.25 });
  g.rect(ZONES.greenhouse.x + 110, SHELF_Y, 340, 12).fill({ color: 0x6b4a2e });
  // 櫃台與門
  g.roundRect(COUNTER.x, COUNTER.y, COUNTER.w, COUNTER.h, 6).fill({ color: 0x9a6a3e }).stroke({ width: 4, color: 0x5a3a20 });
  g.rect(DOOR.x, DOOR.y, DOOR.w, DOOR.h).fill({ color: 0x2e1c10 }).stroke({ width: 4, color: 0x6b4a2e });
  // 沙發示意
  g.roundRect(200, 280, 260, 90, 24).fill({ color: 0x8b4f5c });
  root.addChild(g);
  for (const z of Object.values(ZONES)) {
    const t = text(z.label, 30, 0xf6e3b4);
    t.alpha = 0.55;
    t.position.set(z.x + 18, z.y + 12);
    root.addChild(t);
  }
  const note = text('(placeholder: bg_dollhouse_main)', 18, 0xf6e3b4, '400');
  note.alpha = 0.4;
  note.position.set(ZONES.loft.x + 18, ZONES.loft.y + 60);
  root.addChild(note);
  return root;
}

// ---------- 組裝 ----------

export async function createScene(host: HTMLElement, game: Game, resolution: number): Promise<Application> {
  const app = new Application();
  await app.init({ width: W, height: H, background: 0x1c130e, antialias: true, resolution, autoDensity: true });
  host.appendChild(app.canvas);
  // 效能設定：畫面更新率上限、省電畫質（降低繪製解析度），改了馬上套用
  effect(() => {
    const p = perf.value;
    app.ticker.maxFPS = p.fps === 30 ? 30 : 0;
    const res = resolution * (p.quality === 'low' ? LOW_QUALITY_SCALE : 1);
    if (app.renderer.resolution !== res) app.renderer.resize(W, H, res);
  });
  if (import.meta.env.DEV) Object.assign(window, { __app: app });
  // 遊戲游標：場景物件設的 cursor（pointer／grab）換成遊戲的圖；一般狀態沿用頁面的游標
  const cursors = app.renderer.events.cursorStyles;
  for (const k of ['pointer', 'grab', 'grabbing'] as const) cursors[k] = cursorStyle(k);

  const tex = new TextureBank(app);
  await tex.init();

  const drag = new CauldronDrag(app, game);
  const particles = new ParticleLayer();
  const tapFx = new TapFx();
  const pots = SLOT_POS.map((_, i) => new PotView(i, tex, game, particles));
  const cauldrons = CAULDRON_X.map((_, i) => new CauldronView(i, tex, game, particles, (v, e) => drag.press(v, e)));
  const props = new PropsLayer(tex, game);
  const customers = new CustomerLayer(tex, game);
  const speechLayer = new Container();
  // 純顯示的圖層不參與點擊判定：舞台是 static（拖曳要用），被動的文字蓋在大釜上時會搶走點擊
  speechLayer.eventMode = 'none';
  const lumia = new LumiaView(tex, speechLayer);
  const floats = new FloatLayer();
  const highlight = new ZoneHighlight();
  const fever = new FeverOverlay();
  const pointer = new TutorialPointer();
  // 教學箭頭指著的地方：第一個有植物的盆栽、第一口大釜、可以結帳的客人（頭上金幣的上方）、露米婭頭上
  const pointerTarget = (s: GameState): { x: number; y: number } | null => {
    switch (tutorialStep(s)) {
      case 'pot': {
        const i = s.slots.findIndex((sl) => sl.plant);
        return i >= 0 ? pots[i].anchorPoint : null;
      }
      case 'cauldron': {
        // 原料還不夠熬一鍋：先指回盆栽（有植物的第一盆）
        const c = s.cauldrons[0];
        const short = c.batch <= 0 && recipeInputs(s, c.recipe).some(([m, n]) => s.materials[m] < n);
        const i = s.slots.findIndex((sl) => sl.plant);
        return short && i >= 0 ? pots[i].anchorPoint : cauldrons[0].anchorPoint;
      }
      case 'checkout': {
        const c = s.customers.find((x) => x.status !== 'waiting' && !x.express && !x.princess);
        const p = c ? customers.feetOf(c.id) : null;
        return p ? { x: p.x, y: p.y - 310 } : null;
      }
      case 'assign': return lumia.dragging ? null : { x: lumia.x, y: lumia.y - 230 };
      default: return null;
    }
  };
  // 露米婭平常畫在盆栽與大釜前面；被拎起來時移到最上層
  const lumiaLayer = new Container();
  const dragLayer = new Container();
  drag.topLayer = dragLayer;
  lumiaLayer.addChild(lumia);
  const lumiaDrag = new LumiaDrag(app, game, lumia, highlight, (dragging) => {
    (dragging ? dragLayer : lumiaLayer).addChild(lumia);
    if (dragging) startGrabbing();
  });
  // 突發事件：畫在飄字、粒子、對話泡泡上面，要點的東西不會被擋住
  const events = new EventLayer(app, tex, game, {
    potPos: (i) => ({ x: pots[i].x, y: pots[i].y }),
    cauldronX: (recipe) => {
      const idx = game.state.cauldrons.findIndex((c) => c.recipe === recipe);
      return idx >= 0 ? cauldrons[idx].x : null;
    },
    cauldronY: CAULDRON_Y,
    customerPos: (id) => customers.feetOf(id),
    lumiaPos: () => ({ x: lumia.x, y: lumia.y }),
    crates: () => props.visibleCrates(),
    float: (s, x, y, color, big = false) => floats.spawn(s, x, y, color, { big, always: true, key: 'event', bright: true }),
    burst: (x, y, color, count, power) => particles.burst(x, y, color, count, power),
    ring: (x, y, color, size) => particles.ring(x, y, color, size),
    setDim: (r) => (floats.dimRect = r),
  });
  // 後排（y 較小）的盆栽先畫，才會被前排擋住
  const potsByDepth = [...pots].sort((p, q) => p.y - q.y);
  app.stage.addChild(
    // 進度條、徽章等資訊層在露米婭下面，不會擋到她；
    // 她的點擊判定也在這些之上：重疊時優先抓得到她（擋住了就把她拖到別處）
    buildBackground(tex), props, ...potsByDepth, ...cauldrons, particles,
    ...potsByDepth.map((p) => p.hud), ...cauldrons.map((c) => c.hud),
    lumiaLayer, lumiaDrag.hit, customers, floats, ...cauldrons.map((c) => c.top), speechLayer, events, props.tip, fever, pointer, highlight, dragLayer,
    tapFx,
  );

  // 點擊回饋：在「捕獲」階段先看到每一次點擊（有些物件會擋住往上傳），依點到的東西決定顏色
  const tapColors: [Container, number][] = [
    ...pots.map((p): [Container, number] => [p, 0x8fe07a]),
    ...cauldrons.map((c): [Container, number] => [c, 0xffa94d]),
    [customers, 0xffd34d],
    [lumiaDrag.hit, 0xff8fb8],
    [lumia, 0xff8fb8],
    [events, 0xfff08a],
    [props, 0x9ee8ff],
  ];
  app.stage.addEventListener('pointerdown', (e: FederatedPointerEvent) => {
    let color: number | null = null;
    for (let o = e.target as Container | null; o && o !== app.stage && color === null; o = o.parent) {
      color = tapColors.find(([c]) => c === o)?.[1] ?? null;
    }
    tapFx.spawn(e.global.x, e.global.y, color);
  }, { capture: true });

  const onEvent = (e: GameEvent, s: GameState) => {
    switch (e.type) {
      case 'harvest': {
        const pot = pots[e.slot];
        pot.noteHarvest(e.amount);
        const p = pot.anchorPoint;
        const name = PLANTS[e.material].name;
        const color = lighten(PLANTS[e.material].color);
        const label = `+${formatNumber(e.amount)} ${name}`;
        const key = `pot:${e.slot}`;
        // 高速模式的盆栽不一下一下響（改成溫室的循環環境音）；暴擊稍微高一點
        if (pot.fastTier === 0) playSfx('harvest', { key, rate: e.crit ? 1.25 : 1 });
        if (e.crit) floats.spawn(t('float.crit', { label }), p.x, p.y - 20, 0xffe066, { big: true, key });
        else if (e.bounty) floats.spawn(t('float.bounty', { label }), p.x, p.y - 10, 0x9dff8a, { key });
        else floats.spawn(label, p.x, p.y, color, { key });
        break;
      }
      case 'brewed': {
        const idx = s.cauldrons.findIndex((c) => c.recipe === e.recipe);
        if (idx < 0) break;
        const view = cauldrons[idx];
        view.noteBrew(e.amount);
        // 高速模式的大釜不一下一下響（改成大釜的循環環境音）
        if (view.fastTier === 0) playSfx('brew', { key: `cauldron:${e.recipe}`, rate: e.double ? 1.15 : 1 });
        const p = view.anchorPoint;
        const name = RECIPES[e.recipe].name;
        const color = lighten(RECIPES[e.recipe].color);
        const label = `+${formatNumber(e.amount)} ${name}`;
        // 雙倍的大字彈得高；一般產出彈得低、散得開，填滿大釜上方的區域（兩者分開計算，大字不會擠掉一般的字）
        if (e.double) floats.spawn(t('float.double', { label }), p.x, p.y - 20, 0x9ee8ff, { big: true, key: `cauldron:${e.recipe}:double` });
        else floats.spawn(label, p.x, p.y, color, { key: `cauldron:${e.recipe}`, launch: CAULDRON_FLOAT_LAUNCH, spread: CAULDRON_FLOAT_SPREAD });
        break;
      }
      // 極速沸騰：鍋身上的連擊字會變成「🔥 極速沸騰」並彈一下，不另外飄字（以前會被產出的字擋住）
      case 'sale': {
        // 收銀機（成交很頻繁時音效本身有最短間隔與同時上限）
        playSfx('sale');
        props.bumpSquirrel();
        lumia.thankCustomer();
        const p = customers.posOf(e.id) ?? { x: COUNTER.x + 100, y: COUNTER.y - 40 };
        const note = e.tip ? t('float.tip') : e.rush ? t('float.rush') : e.partial ? t('float.partial') : '';
        floats.spawn(t('float.gold', { n: formatFull(e.gold) }) + note, p.x, p.y, 0xffd34d, { big: e.rush || e.tip, always: true, key: 'sale' });
        break;
      }
      case 'wholesale': {
        // 從對應的收購箱跳出來
        const p = props.bumpCrate(e.crate);
        if (!p) break;
        const what = t(e.crate === 'materials' ? 'float.crateMaterials' : 'float.cratePotions', { n: formatNumber(e.amount) });
        floats.spawn(t('float.crate', { n: formatFull(e.gold), what }), p.x, p.y, 0xe8c56a, { always: true, key: `crate:${e.crate}` });
        break;
      }
      // 極速沸騰：「呼」一聲；沸騰中的劈啪聲在每幀的循環音處理
      case 'boil':
        playSfx('boil');
        break;
      case 'achievement': {
        const a = ACHIEVEMENTS.find((x) => x.id === e.id);
        if (a) showToast(t('toast.achievement', { name: a.name, n: a.reward }), 2200, { id: 'icon_trophy', glyph: '🏆' }, 'achievement');
        break;
      }
      case 'wish': {
        const say = (lines: string[]) => lumia.say(lines[Math.floor(Math.random() * lines.length)]);
        const heart = `+${e.reward.toFixed(2).replace(/\.?0+$/, '')} ♥`;
        if (e.result === 'new') {
          say(WISH_LINES.new);
          const r = WISH.rarities[s.wish?.rarity ?? 0];
          if (s.wish && s.wish.rarity > 0) showToast(t('toast.bigWish', { name: r.name }), 2200, { id: 'icon_wish', glyph: '✨' }, 'wish');
          else playSfx('wish');
        } else if (e.result === 'done') {
          say(WISH_LINES.done);
          floats.spawn(t('float.wishDone', { heart }), lumia.x + 120, lumia.y - 140, 0xff8fb8, { big: true });
        } else {
          say(WISH_LINES.fail);
          if (e.reward > 0) floats.spawn(t('float.wishTried', { heart }), lumia.x + 120, lumia.y - 140, 0xffc0d8, { always: true });
        }
        break;
      }
      case 'event': {
        events.note(e);
        const def = EVENT_MAP[e.id];
        if (e.result === 'start') {
          playSfx('event');
          lumia.say(EVENT_LINES.start[Math.floor(Math.random() * EVENT_LINES.start.length)]);
        } else if (e.result === 'done') {
          const book = e.first ? `　${t('toast.eventNewPage')}` : '';
          // 前面放這個事件自己的圖（訪客、道具）
          showToast(t('toast.eventDone', { name: def.name, text: e.text ?? '' }) + book, 5000, { id: def.icon, glyph: '🎉' });
          // 主線的信：打開信（讀完接著播感想），不跳事件簿，免得蓋在信上
          if (e.letter !== undefined) letterOpen.value = e.letter;
          else if (e.first) showNewEventPage(e.id);
        } else {
          showToast(t('toast.eventLeft', { name: def.name }));
        }
        break;
      }
      case 'mascot': {
        showToast(t(e.kind === 'exhausted' ? 'toast.exhausted' : 'toast.woke'));
        const lines = LINES[e.kind];
        lumia.say(lines[Math.floor(Math.random() * lines.length)]);
        break;
      }
      default:
        break;
    }
  };

  app.ticker.add((ticker) => {
    game.advance();
    // 分頁在背景時畫面更新很慢，動畫仍以真實時間前進（上限 1 秒避免瞬移太遠）
    const dt = Math.min(1, ticker.deltaMS / 1000);
    const s = game.state;
    drag.update();
    props.update(s, dt);
    for (const p of pots) p.update(s, dt);
    for (const c of cauldrons) c.update(s, dt);
    customers.update(s, dt);
    lumia.update(s, dt);
    lumiaDrag.update(s, dt);
    fever.update(s, dt);
    pointer.update(pointerTarget(s), dt);
    // 循環音：高速模式的溫室沙沙聲、大釜咕嘟聲（越快稍微大聲一點），極速沸騰中的劈啪聲
    const potTier = Math.max(0, ...pots.map((p) => p.fastTier));
    const cauldronTier = Math.max(0, ...cauldrons.map((c) => c.fastTier));
    setLoop('ambGreenhouse', potTier > 0 ? 0.55 + 0.15 * (potTier - 1) : 0);
    setLoop('ambCauldron', cauldronTier > 0 ? 0.55 + 0.15 * (cauldronTier - 1) : 0);
    setLoop('boilLoop', cauldrons.some((c) => c.boiling) ? 1 : 0);
    events.update(s, dt);
    for (const e of game.drainEvents()) onEvent(e, s);
    particles.update(dt);
    tapFx.update(dt);
    floats.update(dt);
  });

  return app;
}

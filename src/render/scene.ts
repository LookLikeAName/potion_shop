import {
  Application, BitmapText, Container, Graphics, GraphicsContext, Rectangle, Text, type FederatedPointerEvent,
} from 'pixi.js';
import { ACHIEVEMENTS } from '../game/config/achievements';
import { CUSTOMER, UPGRADE_FX } from '../game/config/balance';
import { ASSIGNMENTS, LINES, MUTTER, type Assignment } from '../game/config/mascot';
import { pickMutter } from '../game/mutter';
import { PLANTS } from '../game/config/plants';
import { RECIPES, type PotionId } from '../game/config/recipes';
import { activeCombo, nextLockedRecipes } from '../game/commands';
import { formatNumber } from '../game/format';
import type { Game } from '../game/game';
import { missingInputs, type CrateKind, type GameEvent } from '../game/sim';
import { CRATE_FOR, CRATE_MATERIALS, SQUIRREL } from '../game/config/upgrades';
import type { CustomerState, GameState } from '../game/state';
import {
  autoHarvest, brewPassiveSpeed, growthSpeed, hasAutoCheckout, payTime, has, isResting, isTired, milestoneCount, recipeInputs, redeemed,
  refineLevel, workZone,
} from '../game/stats';
import { lumiaOpen, openDrawer, showToast } from '../ui/store';
import {
  ASSIGN_ZONES, CAULDRON_X, CAULDRON_Y, CHECKOUT_X, COUNTER, DOOR, FLOATING_SLOT_FROM, FLOOR_1F_Y, FLOOR_2F_Y, LEAVE_Y,
  CRATE_POS, FLOOR_SPLIT_Y, FURNITURE, H, LUMIA_AT_CAULDRON, LUMIA_AT_POT, LUMIA_COUNTER, OFFSTAGE_X, PROPS,
  QUEUE_X, QUEUE_Y, REST_POS, SHELF_Y, SLOT_POS, W, ZONES,
} from './layout';
import { PaperDoll } from './paperDoll';
import { FONT, Pic, TextureBank } from './textures';

const text = (s: string, size: number, fill = 0xffffff, weight: '400' | '700' = '700') =>
  new Text({
    text: s,
    style: { fontFamily: FONT, fontSize: size, fill, fontWeight: weight, align: 'center', stroke: { color: 0x2b1d14, width: Math.max(3, size / 6) } },
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
  1: { plantCycle: 0.22, burst: 6, power: 1, sway: 0.07, bubbles: 4, bubbleSpeed: 3, flash: 0.35, ring: false, mark: '⚡', size: 16 },
  2: { plantCycle: 0.15, burst: 9, power: 1.2, sway: 0.1, bubbles: 5, bubbleSpeed: 5, flash: 0.6, ring: true, mark: '⚡⚡', size: 18 },
  3: { plantCycle: 0.1, burst: 12, power: 1.45, sway: 0.13, bubbles: 6, bubbleSpeed: 8, flash: 0.9, ring: true, mark: '⚡⚡⚡', size: 20 },
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
    for (let k = 0; k < count; k++) {
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


/** 高速模式的速率字：級數越高 ⚡ 越多、字越大，3 級變彩虹色並跟著節奏跳動 */
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
    label.text = `${fx.mark}${formatNumber(rate)}/秒`;
  }
  label.tint = tier === 3 ? rainbow(time * 0.8) : 0xffe066;
  const beat = tier >= 2 ? 1 + 0.07 * Math.abs(Math.sin(time * 9)) : 1;
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

class PotView extends Container {
  readonly hud = new Container();
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

    this.eventMode = 'static';
    this.cursor = 'pointer';
    this.hitArea = new Rectangle(-58, -200, 116, 215);
    this.on('pointerdown', () => this.tap());
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
      this.hint.text = '浮空格';
      this.hint.y = -110;
      return;
    }
    if (!slot.plant) {
      this.pot.setId('pot_t1');
      this.pot.alpha = 0.6;
      this.hint.text = '＋ 種植';
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
    const fast = tier > 0;
    const fx = tier > 0 ? TIER_FX[tier as 1 | 2 | 3] : null;
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
    const color = tier === 3 ? rainbow(this.t * 0.8) : def.color;
    if (popped && fx) {
      this.punch = 1;
      const py = this.y + this.plant.y - plantH * 0.7;
      this.particles.burst(this.x, py, color, fx.burst, fx.power);
      if (fx.ring) this.particles.ring(this.x, py, lighten(color, 0.3), tier === 3 ? 1.3 : 1);
    }

    const squash = 1 + Math.sin(this.punch * Math.PI) * (fast ? 0.22 : 0.12);
    const bob = fast ? 1 + Math.sin(this.t * 14) * 0.05 : slot.ready ? 1 + Math.sin(this.t * 6) * 0.04 : 1;
    // 高速模式：每輪從 75% 一路長到 115%，並從根部快速搖擺
    const grow = fast ? 0.75 + 0.4 * (1 - (1 - this.plantPhase) ** 3) : 1;
    const base = this.plant.baseScale;
    this.plant.scale.set(base * grow * (fast ? squash : 1), base * grow * bob / squash);
    this.plant.rotation = fx ? Math.sin(this.t * 22) * fx.sway : 0;
    this.pot.scale.y = this.pot.baseScale / (1 + (squash - 1) * 0.4);
    // 2 級以上：每次「啵」花盆跟著閃一下
    this.pot.tint = tier >= 2 ? lerpColor(0xffffff, lighten(color, 0.4), this.punch * 0.8) : 0xffffff;
    this.drawAura(tier, color, plantH);
    const top = this.plant.y - plantH;
    this.ready.y = top - 10 + Math.sin(this.t * 5) * 6;
    this.rain.y = Math.min(top, -potH - 110) - 22 + Math.sin(this.t * 2) * 4;
    this.fairy.y = -potH * 0.4 + Math.sin(this.t * 3 + 1) * 5;

    if (fast) {
      this.bar.set(this.visPhase, tier === 3 ? lighten(color, 0.2) : shimmer(this.t));
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
  private body: Pic;
  private liquid: Pic;
  private bubbles: Pic[];
  private bar = new Bar(100, 12);
  private lv: { view: Container; label: Text };
  private title = text('', 20, 0xf6e3b4);
  private info = text('', 22, 0xffffff);
  private needs = new Container();
  private salamander: Pic;
  private ladle: Pic;
  private combo = text('', 22, 0xffb347);
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
    this.rateText.anchor.set(0.5);
    this.rateText.y = 90;
    this.addChild(this.aura, this.body, this.liquid, ...this.bubbles, this.flash, this.salamander, this.ladle);
    // 進度條、徽章、需求等資訊放在獨立圖層，畫在角色前面
    this.hud.position.copyFrom(this.position);
    this.hud.addChild(this.bar, this.lv.view, this.title, this.info, this.needs, this.combo, this.rateText);

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
    const fast = tier > 0;
    const fx = tier > 0 ? TIER_FX[tier as 1 | 2 | 3] : null;
    const brewing = !!c && (c.batch > 0 || fast);
    this.liquid.visible = brewing;
    const bubbleCount = brewing ? fx?.bubbles ?? 3 : 0;
    this.bubbles.forEach((b, k) => (b.visible = k < bubbleCount));
    this.combo.text = '';
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
      this.info.text = `🔒 ${r.name}\n${formatNumber(r.unlockCost)} 金幣`;
      // 相鄰兩個未解鎖的大釜上下錯開
      this.info.y = -60 - ((this.i - s.cauldrons.length) % 2) * 46;
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
    const color = tier === 3 ? rainbow(this.t * 0.8) : def.color;
    const squash = 1 + Math.sin(this.punch * Math.PI) * (fast ? 0.05 + 0.03 * tier : 0.06);
    this.body.scale.y = this.body.baseScale / squash;
    this.body.scale.x = this.body.baseScale * (fast ? 1 + (squash - 1) * 0.5 : 1);
    // 極速沸騰：鍋身泛紅光閃爍；高速模式：鍋身跟著節奏泛出藥水色的光
    const beat = 0.5 + 0.5 * Math.sin(this.t * (10 + tier * 4));
    this.body.tint = boiling ? lerpColor(0xffffff, 0xffa060, 0.5 + 0.5 * Math.sin(this.t * 14))
      : fx ? lerpColor(0xffffff, lighten(color, 0.35), fx.flash * 0.6 * beat) : 0xffffff;

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
      this.liquid.height = lw * 0.3 * (fx ? 1 + 0.18 * Math.sin(this.t * (18 + tier * 6)) : 1);
      this.liquid.y = ly;
      const bubbleSpeed = fx?.bubbleSpeed ?? 1;
      const rise = 28 + tier * 14;
      this.bubbles.forEach((b, k) => {
        if (k >= bubbleCount) return;
        const ph = (this.t * (1.1 + k * 0.35) * bubbleSpeed + k * 0.37) % 1;
        const size = (lw * 0.16) * (1 - ph * 0.5) * (fx ? 1 + tier * 0.12 : 1);
        b.tint = lighten(color, 0.5);
        b.width = b.height = size;
        // 泡泡在鍋口寬度內平均分布
        const spread = bubbleCount > 1 ? k / (bubbleCount - 1) - 0.5 : 0;
        b.position.set(spread * lw * 0.62 + (fx ? Math.sin(this.t * 7 + k) * 4 : 0), ly - ph * rise);
        b.alpha = 1 - ph;
      });
      if (fx) this.drawFastFx(tier, color, lw, ly, beat);
      if (popped && fx) {
        const px = this.x;
        const py = this.y + ly * this.scale.y;
        this.particles.burst(px, py, color, fx.burst, fx.power);
        if (fx.ring) this.particles.ring(px, py, lighten(color, 0.3), tier === 3 ? 1.4 : 1.1);
      }
    }

    // 隱形僕役湯勺：浮在鍋口右側攪拌
    if (this.ladle.visible) {
      this.ladle.position.set(bw * 0.22, -bh * 0.78 + Math.sin(this.t * 3) * 4);
      this.ladle.rotation = 0.35 + Math.sin(this.t * (boiling ? 12 : 4)) * 0.35;
    }

    if (fast) {
      this.bar.set(this.visPhase, tier === 3 ? lighten(color, 0.2) : shimmer(this.t));
    } else {
      this.bar.set(c.progress / def.brewTime, boiling ? 0xffa040 : lighten(def.color, 0.25));
    }
    this.lv.label.text = `Lv ${c.level}`;
    // 精煉過的配方在名稱後面加星星
    const refine = refineLevel(s, c.recipe);
    this.title.text = refine > 0 ? `${def.name} ${'★'.repeat(refine)}` : def.name;
    this.info.y = -bh - 22;

    // 龍息風箱：連擊數、沸騰倒數、冷卻
    if (has(s, 'bellows')) {
      this.combo.y = -bh - 52;
      const n = activeCombo(s, c);
      if (boiling) this.combo.text = `🔥 極速沸騰 ${c.boil.toFixed(1)}s`;
      else if (c.boilCooldown > 0) this.combo.text = `冷卻 ${Math.ceil(c.boilCooldown)}s`;
      else if (n > 0) this.combo.text = `連擊 ${n}/${UPGRADE_FX.comboClicks}`;
      const fill = boiling ? 0xff8a3c : c.boilCooldown > 0 ? 0xbbbbbb : 0xffb347;
      if (fill !== this.comboFill) this.combo.style.fill = this.comboFill = fill;
    }

    if (fast) {
      // 高速模式的速率字在配方名稱下方（rateText），鍋子上方留給特效
      this.info.text = '';
      this.setNeeds('', null, []);
    } else if (brewing) {
      this.info.text = `熬煮中 ×${c.batch}`;
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

/** 客人走路速度（px/秒，固定；要和模擬裡走到櫃台的時間一致） */
const CUSTOMER_SPEED = CUSTOMER.walkSpeed;
/** 訂單氣泡每一列的高度 */
const ROW_H = 44;

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
    const pool = NPC_FOR[c.lines[0].potion];
    this.body = new PaperDoll(tex, pool[c.id % pool.length]);
    this.x = OFFSTAGE_X;
    this.y = QUEUE_Y;
    this.bubble.addChild(this.bubbleBg);
    // 由下往上排，氣泡底部固定在頭頂
    const n = c.lines.length;
    c.lines.forEach((l, k) => {
      const y = -(n - 1 - k) * ROW_H;
      const icon = new Pic(tex, `potion_${l.potion}`, 38, 38);
      icon.anchor.set(0.5);
      icon.y = y;
      const qty = new Text({ text: '', style: { fontFamily: FONT, fontSize: 24, fontWeight: '700', fill: 0x4a3426 } });
      qty.anchor.set(0, 0.5);
      qty.y = y;
      this.rows.push(qty);
      this.icons.push(icon);
      this.bubble.addChild(icon, qty);
    });
    this.bubbleH = n * ROW_H + 12;
    // 急單的耐心條、結帳進度條放在頭頂（氣泡收起來時也看得到）
    this.bar.y = -226;
    this.bubble.y = -258;
    this.coin = new Pic(tex, 'icon_gold', 44, 44);
    this.coin.anchor.set(0.5);
    this.addChild(this.body, this.bubble, this.bar, this.coin);
    // 點客人結帳（備好貨的才會成交）
    this.eventMode = 'static';
    this.cursor = 'pointer';
    this.hitArea = new Rectangle(-65, -240, 130, 250);
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
    this.bubble.y = -258 - this.bubbleLift;
    // 可以點他結帳（還沒點過）：頭上跳動的金幣
    this.coin.visible = !this.leaving && !!c && c.status !== 'waiting' && !c.express;
    // 備好貨可以點：金幣在氣泡正上方跳動
    const bubbleTop = this.bubble.y + ROW_H / 2 + 6 - this.bubbleH;
    if (this.coin.visible) this.coin.position.set(0, bubbleTop - 26 + Math.sin(this.t * 6) * 6);
    if (!c) return;

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
    if (!this.game.clickCustomer(id)) this.views.get(id)?.nudge();
  };

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
      // 前排（y 大）畫在前面；同一排越靠近櫃台越前面
      v.zIndex = v.y * 10 - v.x / 100;
      if (v.leaving && v.x >= OFFSTAGE_X) {
        this.views.delete(id);
        v.destroy({ children: true });
      }
    }
  }

  posOf(id: number) {
    const v = this.views.get(id);
    return v ? { x: v.x, y: v.y - 290 } : null;
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
      fontFamily: FONT, fontSize: 22, fill: 0x4a3426, fontWeight: '700', align: 'center',
      wordWrap: true, breakWords: true, wordWrapWidth: 300, lineHeight: 30,
    },
  });
  private life = 0;
  private max = 1;
  private halfW = 0;
  private h = 0;

  constructor() {
    super();
    this.words.anchor.set(0.5, 1);
    this.addChild(this.bg, this.words);
    this.visible = false;
  }

  show(line: string, dream: boolean, duration = MUTTER.duration): void {
    this.words.text = line;
    this.words.style.fill = dream ? 0x4a5a8a : 0x4a3426;
    const padX = 18;
    const padY = 12;
    const tail = 14;
    const w = this.words.width + padX * 2;
    const h = this.words.height + padY * 2;
    this.halfW = w / 2;
    this.h = h + tail;
    this.words.y = -tail - padY;
    const fill = dream ? 0xe8f0ff : 0xfffaf0;
    const edge = dream ? 0x8aa0d8 : 0x7a5c44;
    this.bg.clear().roundRect(-w / 2, -tail - h, w, h, 18).fill({ color: fill, alpha: 0.96 }).stroke({ width: 3, color: edge });
    if (dream) {
      // 夢話：往下飄的小泡泡代替尖角
      this.bg.circle(-6, -tail + 5, 6).fill({ color: fill }).stroke({ width: 2, color: edge })
        .circle(-14, 2, 4).fill({ color: fill }).stroke({ width: 2, color: edge });
    } else {
      this.bg.poly([-10, -tail - 2, 10, -tail - 2, -4, 0]).fill({ color: fill }).stroke({ width: 3, color: edge })
        // 蓋掉尖角和框線的接縫
        .rect(-8, -tail - 4, 16, 4).fill({ color: fill });
    }
    this.life = this.max = duration;
    this.visible = true;
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

class LumiaView extends Container {
  private doll: PaperDoll;
  private zz = text('zZ', 26, 0xcfe3ff);
  private bubble = new SpeechBubble();
  /** 距離下一次自言自語的秒數（剛開場先等一下） */
  private mutterIn = 5 + Math.random() * 6;
  private sparkle = new Graphics();
  private target: Station | null = null;
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
    this.addChild(this.sparkle, this.doll, this.zz);
    speechLayer.addChild(this.bubble);
    this.position.set(LUMIA_COUNTER.x, LUMIA_COUNTER.y);
    // 點擊由獨立的判定區（LumiaDrag.hit）處理
    this.eventMode = 'none';
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
    if (isResting(s)) return [{ ...REST_POS, pose: 'sleep', dir: -1 }];
    const pots: Station[] = s.slots.flatMap((slot, i) => (slot.plant && i < FLOATING_SLOT_FROM
      ? [{ x: SLOT_POS[i].x + LUMIA_AT_POT.dx, y: SLOT_POS[i].y + LUMIA_AT_POT.dy, pose: 'back' as const, dir: -1 as const }]
      : []));
    const last = s.cauldrons.length - 1;
    const cy = CAULDRON_Y + LUMIA_AT_CAULDRON.dy;
    const cauldrons: Station[] = [];
    if (last >= 0) cauldrons.push({ x: CAULDRON_X[0] - LUMIA_AT_CAULDRON.dx, y: cy, pose: 'back', dir: 1 });
    if (last >= 1) cauldrons.push({ x: CAULDRON_X[last] + LUMIA_AT_CAULDRON.dx, y: cy, pose: 'back', dir: -1 });
    const counter: Station = { ...LUMIA_COUNTER, pose: 'idle', dir: 1 };
    // 自由活動時跟著模擬選的區域走（workZone 會回傳她目前的區域）
    switch (workZone(s)) {
      case 'greenhouse': return pots.length ? pots : [counter];
      case 'cauldron': return cauldrons.length ? cauldrons : [counter];
      default: return [counter];
    }
  }

  /** 被拖曳中：掛在手指下方，隨移動左右擺盪 */
  dragTo(s: GameState, x: number, y: number, dt: number): void {
    const vx = (x - this.lastDragX) / Math.max(dt, 1 / 120);
    this.lastDragX = x;
    this.swing += (Math.max(-0.5, Math.min(0.5, -vx * 0.0012)) - this.swing) * Math.min(1, dt * 10);
    this.position.set(x, y);
    this.rotation = this.swing + Math.sin(this.t * 3) * 0.04;
    this.doll.setPose(this.poseId(s, 'drag'));
    this.doll.mode = 'idle';
    // 讓手（圖片上緣）在指標位置，身體往下垂
    this.doll.y = this.doll.pic.texture.height * this.doll.pic.baseScale * 0.92;
    this.doll.alpha = 1;
    this.zz.visible = false;
    this.bubble.hide();
    this.doll.update(dt);
  }

  /** 讓她說一句話（累倒、睡醒時）；之後重新計時下一次自言自語 */
  say(line: string): void {
    if (this.dragging) return;
    this.bubble.show(line, false);
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
    const sleeping = isResting(s);
    this.mutterIn = sleeping
      ? MUTTER.sleepIntervalMin + Math.random() * (MUTTER.sleepIntervalMax - MUTTER.sleepIntervalMin)
      : MUTTER.intervalMin + Math.random() * (MUTTER.intervalMax - MUTTER.intervalMin);
    this.bubble.show(pickMutter(s), sleeping);
    this.placeBubble();
  }

  /** 泡泡放在頭頂（有 zZ 時再高一點），靠近畫面邊緣時往內推 */
  private placeBubble(): void {
    const h = this.doll.pic.texture.height * this.doll.pic.baseScale;
    const { halfW, h: bh } = this.bubble.size;
    const margin = 12;
    // 泡泡在獨立圖層，用場景座標定位（跟著她移動）
    this.bubble.x = Math.max(margin + halfW, Math.min(W - margin - halfW, this.x));
    const y = this.y - h - (this.zz.visible ? 44 : 12);
    this.bubble.y = Math.max(y, margin + bh);
  }

  startDrag(): void {
    this.dragging = true;
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

  update(s: GameState, dt: number): void {
    this.t += dt;
    if (this.dragging) return;
    // 瞬移中不說話；其他時候照節奏自言自語
    if (this.poof) this.bubble.hide();
    else this.updateMutter(s, dt);
    const doll = this.doll;
    const tired = isTired(s) && !isResting(s);

    // 指派或休息狀態改變：馬上出發去新的地方
    const key = `${s.mascot.assignment}:${workZone(s)}:${isResting(s)}:${s.cauldrons.length}:${s.slots.filter((x) => x.plant).length}`;
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
      doll.setPose(this.poseId(s, tired ? 'tired_walk' : 'walk'));
      doll.mode = 'walk';
      if (Math.abs(dx) > 2) doll.dir = dx > 0 ? 1 : -1;
    }
    this.updateZz(s, dt);
    doll.update(dt, speed);
  }

  private arrive(s: GameState, st: Station): void {
    this.position.set(st.x, st.y);
    const pose: Pose = st.pose === 'back' ? 'back' : st.pose === 'sleep' ? 'sleep' : 'idle';
    this.doll.setPose(this.poseId(s, pose));
    this.doll.mode = st.pose === 'back' ? 'work' : 'idle';
    this.doll.dir = st.dir;
  }

  /** 睡覺或疲勞時頭上冒 zZ */
  private updateZz(s: GameState, _dt: number): void {
    const sleepy = isResting(s) || isTired(s);
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
    showToast(`露米婭：交給我吧！（${ASSIGNMENTS[zone].name}：${ASSIGNMENTS[zone].desc}）`);
  }
}

/** 狂熱時刻：畫面邊框閃耀金光 */
class FeverOverlay extends Graphics {
  private t = 0;

  update(s: GameState, dt: number): void {
    this.t += dt;
    this.clear();
    if (s.feverLeft <= 0) return;
    const a = 0.45 + 0.35 * Math.sin(this.t * 6);
    this.rect(8, 84, W - 16, H - 92).stroke({ width: 14, color: 0xffd34d, alpha: a });
    this.rect(22, 98, W - 44, H - 120).stroke({ width: 6, color: 0xff8fb8, alpha: a * 0.7 });
  }
}

// ---------- 升級道具（買了才出現在場景裡） ----------

class PropsLayer extends Container {
  private items: { upg: string; when: (s: GameState) => boolean; pic: Pic; bob: number; baseY: number }[] = [];
  private bell: Pic;
  private bellPips = new Graphics();
  private bellPunch = 0;
  private crates = new Map<CrateKind, { box: Container; pic: Pic; baseScale: number; punch: number }>();
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
    add(SQUIRREL, 'upg_abacus_squirrel', PROPS.squirrel, 1);
    add('diffuser', 'upg_diffuser', PROPS.diffuser, 1.5);
    add('signboard', 'upg_signboard', PROPS.signboard, 0, 0);
    // 休息室家具（開心度兌換）
    for (const [id, pos] of Object.entries(FURNITURE)) {
      add(id, `furn_${id}`, pos, 0, 1, (s) => redeemed(s, id) > 0);
    }

    // 叫賣鈴鐺：可以點
    this.bell = add('bell', 'upg_bell', PROPS.bell);
    this.bell.eventMode = 'static';
    this.bell.cursor = 'pointer';
    this.bell.on('pointerdown', () => this.ring());
    this.bellPips.position.set(PROPS.bell.x, PROPS.bell.y + 12);
    this.addChild(this.bellPips);

    // 收購箱：二樓倉庫裡一字排開，每買一個就多一個箱子；箱蓋上放對應的藥水／原料圖示，點了打開設定
    for (const kind of Object.keys(CRATE_POS) as CrateKind[]) {
      const pos = CRATE_POS[kind];
      const box = new Container();
      box.position.set(pos.x, pos.y);
      const pic = new Pic(tex, 'upg_crate');
      pic.anchor.set(0.5, 1);
      const icon = new Pic(tex, kind === 'materials' ? 'item_redheart' : `potion_${kind}`, 34, 34);
      icon.anchor.set(0.5);
      icon.y = -pic.texture.height * pic.baseScale - 12;
      box.addChild(pic, icon);
      box.eventMode = 'static';
      box.cursor = 'pointer';
      box.on('pointerdown', () => openDrawer('counter', 'crate-reserve'));
      this.addChild(box);
      this.crates.set(kind, { box, punch: 0, baseScale: pic.baseScale, pic });
    }
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
    else if (r === 'empty') showToast('鈴鐺還在充能中…');
    else if (r === 'full') showToast('櫃台已經排滿客人了');
  }

  update(s: GameState, dt: number): void {
    this.t += dt;
    this.bellPunch = Math.max(0, this.bellPunch - dt * 3);
    for (const it of this.items) {
      it.pic.visible = it.when(s);
      if (it.bob) it.pic.y = it.baseY + Math.sin(this.t * it.bob) * 2;
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
    if (this.game.moveCauldron(v.i, to)) showToast('已調整大釜順序：左邊的大釜優先取得原料');
  }
}

// ---------- 飄字 ----------

/** 同時存在的飄字上限：產量極快時避免物件無限增加拖慢畫面（超過就重用最舊的） */
const MAX_FLOATS = 250;
/** 每一幀最多新增幾個飄字（事件太多時多的就不顯示，數字照樣算進遊戲） */
const MAX_FLOATS_PER_FRAME = 8;
/** 飄字停留時間（秒），最後 FLOAT_FADE 秒淡出 */
const FLOAT_LIFE = 1.6;
const FLOAT_FADE = 0.5;
/** 飄字大小（相對於 40px 的點陣字）：一般 20px、大字（暴擊、急單、雙倍）28px */
const FLOAT_SIZE = 0.5;
const FLOAT_BIG_SIZE = 0.7;
/** 一樓的飄字不會飄進二樓（浮空盆栽的字才不會蓋住在休息室睡覺的露米婭） */
const FLOAT_1F_CEILING = ZONES.greenhouse.y + 30;

/** 飄字用點陣字（大量飄字時比一般文字省效能）：白字深色描邊，再用 tint 上色 */
const FLOAT_STYLE = {
  fontFamily: FONT, fontSize: 40, fill: 0xffffff, fontWeight: '700' as const,
  stroke: { color: 0x2b1d14, width: 7 },
};

/**
 * 產出、收入的飄字：每個字往不同方向彈出去（左右散開、先往上再慢慢落下），
 * 停留久一點把附近的畫面塞滿，保留放置遊戲的資訊量與爽快感。
 */
class FloatLayer extends Container {
  private items: { t: BitmapText; life: number; vx: number; vy: number; spin: number; size: number; top: number }[] = [];
  private pool = new Pool(this, () => {
    const t = new BitmapText({ text: '', style: FLOAT_STYLE });
    t.anchor.set(0.5);
    return t;
  });
  private spawnedThisFrame = 0;

  /** always：一定顯示（收入、大字）；其他飄字每幀有上限 */
  spawn(s: string, x: number, y: number, color: number, big = false, always = big): void {
    if (!always && this.spawnedThisFrame >= MAX_FLOATS_PER_FRAME) return;
    this.spawnedThisFrame++;
    // 滿了就重用最舊的那一個
    const old = this.items.length >= MAX_FLOATS ? this.items.shift()! : null;
    const t = old?.t ?? this.pool.get();
    if (t.text !== s) t.text = s;
    t.tint = color;
    t.alpha = 1;
    t.position.set(x + (Math.random() - 0.5) * 30, y);
    const size = big ? FLOAT_BIG_SIZE : FLOAT_SIZE;
    t.scale.set(size * 0.6);
    // 隨機的彈射軌道：左右散開的幅度、往上的力道都不同
    const side = Math.random() < 0.5 ? -1 : 1;
    this.items.push({
      t, life: FLOAT_LIFE, size, top: y >= ZONES.greenhouse.y ? FLOAT_1F_CEILING : 20,
      vx: side * (30 + Math.random() * 150),
      vy: -(200 + Math.random() * 180),
      spin: (Math.random() - 0.5) * 0.25,
    });
  }

  update(dt: number): void {
    this.spawnedThisFrame = 0;
    for (const it of this.items) {
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
    }
    sweep(this.items, (it) => this.pool.put(it.t));
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
  const note = text('（佔位背景 — 正式圖：bg_dollhouse_main）', 18, 0xf6e3b4, '400');
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
  if (import.meta.env.DEV) Object.assign(window, { __app: app });

  const tex = new TextureBank(app);
  await tex.init();

  const drag = new CauldronDrag(app, game);
  const particles = new ParticleLayer();
  const pots = SLOT_POS.map((_, i) => new PotView(i, tex, game, particles));
  const cauldrons = CAULDRON_X.map((_, i) => new CauldronView(i, tex, game, particles, (v, e) => drag.press(v, e)));
  const props = new PropsLayer(tex, game);
  const customers = new CustomerLayer(tex, game);
  const speechLayer = new Container();
  const lumia = new LumiaView(tex, speechLayer);
  const floats = new FloatLayer();
  const highlight = new ZoneHighlight();
  const fever = new FeverOverlay();
  // 露米婭平常畫在盆栽與大釜前面；被拎起來時移到最上層
  const lumiaLayer = new Container();
  const dragLayer = new Container();
  lumiaLayer.addChild(lumia);
  const lumiaDrag = new LumiaDrag(app, game, lumia, highlight, (dragging) =>
    (dragging ? dragLayer : lumiaLayer).addChild(lumia));
  // 後排（y 較小）的盆栽先畫，才會被前排擋住
  const potsByDepth = [...pots].sort((p, q) => p.y - q.y);
  app.stage.addChild(
    // 進度條、徽章等資訊層在露米婭下面，不會擋到她；
    // 她的點擊判定也在這些之上：重疊時優先抓得到她（擋住了就把她拖到別處）
    buildBackground(tex), props, ...potsByDepth, ...cauldrons, particles,
    ...potsByDepth.map((p) => p.hud), ...cauldrons.map((c) => c.hud),
    lumiaLayer, lumiaDrag.hit, customers, floats, speechLayer, fever, highlight, dragLayer,
  );

  const cauldronPoint = (s: GameState, recipe: PotionId) => {
    const idx = s.cauldrons.findIndex((c) => c.recipe === recipe);
    return idx < 0 ? null : cauldrons[idx].anchorPoint;
  };

  const onEvent = (e: GameEvent, s: GameState) => {
    switch (e.type) {
      case 'harvest': {
        const pot = pots[e.slot];
        pot.noteHarvest(e.amount);
        const p = pot.anchorPoint;
        const name = PLANTS[e.material].name;
        const color = lighten(PLANTS[e.material].color);
        const label = `+${formatNumber(e.amount)} ${name}`;
        if (e.crit) floats.spawn(`暴擊生長！${label}`, p.x, p.y - 20, 0xffe066, true);
        else if (e.bounty) floats.spawn(`豐收！${label}`, p.x, p.y - 10, 0x9dff8a);
        else floats.spawn(label, p.x, p.y, color);
        break;
      }
      case 'brewed': {
        const idx = s.cauldrons.findIndex((c) => c.recipe === e.recipe);
        if (idx < 0) break;
        const view = cauldrons[idx];
        view.noteBrew(e.amount);
        const p = view.anchorPoint;
        const name = RECIPES[e.recipe].name;
        const color = lighten(RECIPES[e.recipe].color);
        const label = `+${formatNumber(e.amount)} ${name}`;
        if (e.double) floats.spawn(`雙倍！${label}`, p.x, p.y - 20, 0x9ee8ff, true);
        else floats.spawn(label, p.x, p.y, color);
        break;
      }
      case 'boil': {
        const p = cauldronPoint(s, e.recipe);
        if (p) floats.spawn('極速沸騰！', p.x, p.y - 40, 0xff8a3c, true);
        break;
      }
      case 'sale': {
        const p = customers.posOf(e.id) ?? { x: COUNTER.x + 100, y: COUNTER.y - 40 };
        const note = e.tip ? '（土豪小費！）' : e.rush ? '（急單！）' : e.partial ? '（部分購買）' : '';
        floats.spawn(`+${formatNumber(e.gold)} 金${note}`, p.x, p.y, 0xffd34d, e.rush || e.tip, true);
        break;
      }
      case 'wholesale': {
        // 從對應的收購箱跳出來
        const p = props.bumpCrate(e.crate);
        if (!p) break;
        const what = e.crate === 'materials' ? `${formatNumber(e.amount)} 份原料` : `${formatNumber(e.amount)} 瓶`;
        floats.spawn(`+${formatNumber(e.gold)} 金（收購 ${what}）`, p.x, p.y, 0xe8c56a, false, true);
        break;
      }
      case 'achievement': {
        const a = ACHIEVEMENTS.find((x) => x.id === e.id);
        if (a) showToast(`🏆 成就達成：${a.name}（+${a.reward} ♥）`);
        break;
      }
      case 'mascot': {
        showToast(e.kind === 'exhausted' ? '露米婭累壞了，去休息室睡一下…' : '露米婭睡飽了，回去工作囉！');
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
    for (const e of game.drainEvents()) onEvent(e, s);
    particles.update(dt);
    floats.update(dt);
  });

  return app;
}

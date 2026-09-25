import { Application, Container, Graphics, Rectangle, Text, type FederatedPointerEvent } from 'pixi.js';
import { ACHIEVEMENTS } from '../game/config/achievements';
import { UPGRADE_FX } from '../game/config/balance';
import { ASSIGNMENTS, type Assignment } from '../game/config/mascot';
import { PLANTS } from '../game/config/plants';
import { RECIPES, type PotionId } from '../game/config/recipes';
import { activeCombo, nextLockedRecipes } from '../game/commands';
import { formatNumber } from '../game/format';
import type { Game } from '../game/game';
import { missingInputs, type GameEvent } from '../game/sim';
import type { CustomerState, GameState } from '../game/state';
import {
  autoHarvest, brewPassiveSpeed, growthSpeed, has, isResting, isTired, milestoneCount, redeemed, workZone,
} from '../game/stats';
import { lumiaOpen, openDrawer, showToast } from '../ui/store';
import {
  ASSIGN_ZONES, CAULDRON_X, CAULDRON_Y, COUNTER, DOOR, FLOATING_SLOT_FROM, FLOOR_1F_Y, FLOOR_2F_Y,
  FLOOR_SPLIT_Y, FURNITURE, H, LUMIA_AT_CAULDRON, LUMIA_AT_POT, LUMIA_COUNTER, OFFSTAGE_X, PROPS,
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

/** 植物在高速模式下的變換循環（秒）：比進度條更快，畫面更有刺激感 */
const PLANT_FAST_CYCLE = 0.22;

/** 簡單的粒子：從某點噴出、受重力落下、淡出 */
class ParticleLayer extends Container {
  private items: { g: Graphics; vx: number; vy: number; life: number; max: number }[] = [];
  private static readonly MAX = 320;

  burst(x: number, y: number, color: number, count = 8, power = 1): void {
    for (let k = 0; k < count; k++) {
      if (this.items.length >= ParticleLayer.MAX) this.items.shift()!.g.destroy();
      const g = new Graphics().circle(0, 0, 3 + Math.random() * 4).fill({ color: lerpColor(color, 0xffffff, Math.random() * 0.5) });
      g.position.set(x, y);
      const a = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI * 1.2;
      const sp = (160 + Math.random() * 220) * power;
      const life = 0.45 + Math.random() * 0.35;
      this.addChild(g);
      this.items.push({ g, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life, max: life });
    }
  }

  update(dt: number): void {
    for (const p of this.items) {
      p.life -= dt;
      p.vy += 700 * dt;
      p.g.x += p.vx * dt;
      p.g.y += p.vy * dt;
      p.g.alpha = Math.max(0, p.life / p.max);
      p.g.scale.set(0.5 + 0.5 * (p.life / p.max));
    }
    for (const p of this.items.filter((i) => i.life <= 0)) p.g.destroy();
    this.items = this.items.filter((i) => i.life > 0);
  }
}

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
  private rateText = text('', 16, 0xffe066);
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
      showToast('隱藏盆栽格：需要開心度特權「奇蹟綠手指」（尚未開放）');
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
      this.hint.text = '隱藏格';
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

    const tier = Math.min(3, milestoneCount(slot.level));
    this.pot.setId(`pot_t${tier + 1}`);

    const def = PLANTS[slot.plant];
    const r = slot.progress / def.growTime;
    // 一輪比顯示上限還快：進度條與植物改用「高速模式」表現，不照真實進度畫（會一直閃成空的）。
    // 進度條以 FAST_CYCLE 循環；植物以更快的 PLANT_FAST_CYCLE 在幼苗 → 成長中 → 成熟之間變換，
    // 每輪結束「啵」一下：擠壓回彈 + 噴出同色光點
    const fast = autoHarvest(s, slot) && def.growTime / growthSpeed(s, slot) < FAST_CYCLE;
    this.rate.update(dt);
    const potH = this.pot.texture.height * this.pot.baseScale;
    let popped = false;
    if (fast) {
      this.visPhase = (this.visPhase + dt / FAST_CYCLE) % 1;
      const next = this.plantPhase + dt / PLANT_FAST_CYCLE;
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
    if (popped) {
      this.punch = 1;
      this.particles.burst(this.x, this.y + this.plant.y - plantH * 0.7, def.color, 7);
    }

    const squash = 1 + Math.sin(this.punch * Math.PI) * (fast ? 0.22 : 0.12);
    const bob = fast ? 1 + Math.sin(this.t * 14) * 0.05 : slot.ready ? 1 + Math.sin(this.t * 6) * 0.04 : 1;
    // 高速模式：每輪從 75% 一路長到 115%，並從根部快速搖擺
    const grow = fast ? 0.75 + 0.4 * (1 - (1 - this.plantPhase) ** 3) : 1;
    const base = this.plant.baseScale;
    this.plant.scale.set(base * grow * (fast ? squash : 1), base * grow * bob / squash);
    this.plant.rotation = fast ? Math.sin(this.t * 22) * 0.07 : 0;
    this.pot.scale.y = this.pot.baseScale / (1 + (squash - 1) * 0.4);
    this.drawAura(fast, def.color, plantH);
    const top = this.plant.y - plantH;
    this.ready.y = top - 10 + Math.sin(this.t * 5) * 6;
    this.rain.y = Math.min(top, -potH - 110) - 22 + Math.sin(this.t * 2) * 4;
    this.fairy.y = -potH * 0.4 + Math.sin(this.t * 3 + 1) * 5;

    if (fast) {
      this.bar.set(this.visPhase, shimmer(this.t));
      this.rateText.text = `⚡${formatNumber(this.rate.value)}/秒`;
    } else {
      this.bar.set(slot.ready ? 1 : r, slot.ready ? 0xffd34d : lighten(def.color, 0.2));
      this.rateText.text = '';
    }
    this.lv.label.text = `Lv ${slot.level}`;
  }

  /** 收成事件（用來量測實際產量） */
  noteHarvest(amount: number): void {
    this.rate.add(amount);
  }

  /** 高速模式：植物背後跟著節奏脈動的光暈 */
  private drawAura(on: boolean, color: number, plantH: number): void {
    this.aura.clear();
    if (!on) return;
    const pulse = 0.5 + 0.5 * Math.sin(this.t * 12);
    const cy = this.plant.y - plantH * 0.5;
    this.aura
      .circle(0, cy, plantH * (0.55 + 0.12 * pulse)).fill({ color: lighten(color, 0.3), alpha: 0.18 + 0.14 * pulse })
      .circle(0, cy, plantH * (0.35 + 0.08 * pulse)).fill({ color: 0xfff6c0, alpha: 0.15 + 0.1 * pulse });
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
  private shake = 0;
  private punch = 0;
  private t = Math.random() * 10;
  private recipe: PotionId | null = null;
  private locked: PotionId | null = null;
  /** 拖曳中：大釜跟著手指的 x 座標；null = 在原位 */
  dragX: number | null = null;

  constructor(
    readonly i: number, private tex: TextureBank, private game: Game,
    onPress: (view: CauldronView, e: FederatedPointerEvent) => void,
  ) {
    super();
    this.position.set(CAULDRON_X[i], CAULDRON_Y);
    this.body = new Pic(tex, 'cauldron_t1');
    this.body.anchor.set(0.5, 1);
    this.liquid = new Pic(tex, 'fx_liquid_surface');
    this.liquid.anchor.set(0.5);
    this.bubbles = [0, 1, 2].map(() => {
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
    this.addChild(this.body, this.liquid, ...this.bubbles, this.salamander, this.ladle);
    // 進度條、徽章、需求等資訊放在獨立圖層，畫在角色前面
    this.hud.position.copyFrom(this.position);
    this.hud.addChild(this.bar, this.lv.view, this.title, this.info, this.needs, this.combo);

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
    const speed = c ? brewPassiveSpeed(s, c) : 0;
    const fast = !!c && speed > 0 && RECIPES[c.recipe].brewTime / speed < FAST_CYCLE && this.sinceBrew < 1;
    const brewing = !!c && (c.batch > 0 || fast);
    this.liquid.visible = brewing;
    for (const b of this.bubbles) b.visible = brewing;
    this.combo.text = '';

    if (!c) {
      this.setNeeds('', null, []);
      this.x = this.hud.x = CAULDRON_X[this.i];
      if (!this.locked) return;
      const r = RECIPES[this.locked];
      this.body.setId('cauldron_t1');
      this.body.alpha = 0.3;
      this.title.text = '';
      this.info.text = `🔒 ${r.name}\n${formatNumber(r.unlockCost)} 金幣`;
      this.info.y = -60;
      return;
    }

    const def = RECIPES[c.recipe];
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
    const squash = 1 + Math.sin(this.punch * Math.PI) * 0.06;
    this.body.scale.y = this.body.baseScale / squash;
    // 極速沸騰：鍋身泛紅光閃爍
    this.body.tint = boiling ? lerpColor(0xffffff, 0xffa060, 0.5 + 0.5 * Math.sin(this.t * 14)) : 0xffffff;

    // 鍋內液體：灰階液面圖依配方著色，對齊各階大釜的鍋口
    const bw = this.body.texture.width * this.body.baseScale;
    const bh = this.body.texture.height * this.body.baseScale / squash;
    if (brewing) {
      const rim = RIM[bodyId] ?? { top: 0.2, width: 0.6 };
      const lw = bw * rim.width;
      const ly = -bh + bh * rim.top;
      this.liquid.tint = def.color;
      this.liquid.width = lw;
      this.liquid.height = lw * 0.3;
      this.liquid.y = ly;
      const bubbleSpeed = fast ? 3 : 1;
      this.bubbles.forEach((b, k) => {
        const ph = (this.t * (1.1 + k * 0.35) * bubbleSpeed + k * 0.37) % 1;
        const size = (lw * 0.16) * (1 - ph * 0.5);
        b.tint = lighten(def.color, 0.5);
        b.width = b.height = size;
        b.position.set((k - 1) * lw * 0.28, ly - ph * 28);
        b.alpha = 1 - ph;
      });
    }

    // 隱形僕役湯勺：浮在鍋口右側攪拌
    if (this.ladle.visible) {
      this.ladle.position.set(bw * 0.22, -bh * 0.78 + Math.sin(this.t * 3) * 4);
      this.ladle.rotation = 0.35 + Math.sin(this.t * (boiling ? 12 : 4)) * 0.35;
    }

    if (fast) {
      this.visPhase = (this.visPhase + dt / FAST_CYCLE) % 1;
      this.bar.set(this.visPhase, shimmer(this.t));
    } else {
      this.bar.set(c.progress / def.brewTime, boiling ? 0xffa040 : lighten(def.color, 0.25));
    }
    this.lv.label.text = `Lv ${c.level}`;
    this.title.text = def.name;
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
      this.info.text = `高速熬煮 ⚡${formatNumber(this.rate.value)}/秒`;
      this.setNeeds('', null, []);
    } else if (brewing) {
      this.info.text = `熬煮中 ×${c.batch}`;
      this.setNeeds('', null, []);
    } else {
      this.info.text = '';
      const missing = missingInputs(s, c);
      this.setNeeds(`${c.recipe}:${missing.join(',')}`, c.recipe, missing);
    }
  }

  /** 熬煮完成事件（量測實際產量、判斷是否持續在產出） */
  noteBrew(amount: number): void {
    this.rate.add(amount);
    this.sinceBrew = 0;
  }

  /** 閒置時顯示配方需求（只在內容改變時重建） */
  private needsKey = '';
  private setNeeds(key: string, recipe: PotionId | null, missing: string[]): void {
    if (key === this.needsKey) return;
    this.needsKey = key;
    this.needs.removeChildren().forEach((ch) => ch.destroy());
    if (!recipe) return;
    const inputs = Object.entries(RECIPES[recipe].inputs);
    inputs.forEach(([m, need], k) => {
      const icon = new Pic(this.tex, `item_${m}`, 32, 32);
      icon.anchor.set(0.5);
      const x = (k - (inputs.length - 1) / 2) * 56;
      icon.position.set(x - 12, 0);
      const n = text(`×${need}`, 18, missing.includes(m) ? 0xff7a7a : 0xffffff);
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

const CUSTOMER_SPEED = 260;
/** 訂單氣泡每一列的高度 */
const ROW_H = 44;

class CustomerView extends Container {
  targetX = OFFSTAGE_X;
  leaving = false;
  private body: PaperDoll;
  private bubble = new Container();
  private bubbleBg = new Graphics();
  /** 訂單每一項一列：藥水圖示 + 數量 */
  private rows: Text[] = [];
  private patience = new Bar(96, 10);
  private look = '';

  constructor(tex: TextureBank, public readonly id: number, c: CustomerState) {
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
      icon.position.set(-20, y);
      const qty = new Text({ text: '', style: { fontFamily: FONT, fontSize: 24, fontWeight: '700', fill: 0x4a3426 } });
      qty.anchor.set(0, 0.5);
      qty.position.set(4, y);
      this.rows.push(qty);
      this.bubble.addChild(icon, qty);
    });
    this.bubbleH = n * ROW_H + 12;
    this.patience.y = 34;
    this.bubble.addChild(this.patience);
    this.bubble.y = -258;
    this.addChild(this.body, this.bubble);
  }

  private bubbleH = ROW_H + 12;

  update(c: CustomerState | undefined, dt: number, s: GameState): void {
    const dx = this.targetX - this.x;
    const moving = Math.abs(dx) > 1;
    this.x += Math.sign(dx) * Math.min(Math.abs(dx), CUSTOMER_SPEED * dt);
    // 走路時面向前進方向；站定時面向櫃台（左）
    this.body.dir = moving && dx > 0 ? 1 : -1;
    this.body.mode = moving ? 'walk' : 'idle';
    this.body.update(dt, CUSTOMER_SPEED);
    this.bubble.visible = !this.leaving && !!c;
    if (!c) return;

    const checkout = c.status === 'checkout';
    // 等待中：每一項依目前庫存顯示夠不夠（綠 = 夠、紅 = 還缺）
    const enough = c.lines.map((l) => s.potions[l.potion] >= l.qty);
    const look = `${checkout}:${c.rush}:${c.partial}:${enough.join()}`;
    if (look !== this.look) {
      this.look = look;
      c.lines.forEach((l, k) => {
        const row = this.rows[k];
        if (checkout) {
          row.text = c.partial ? `${l.delivered}/${l.qty}` : '✓';
          row.style.fill = c.partial && l.delivered < l.qty ? 0xb07a2a : 0x2f8a3a;
        } else {
          row.text = `×${l.qty}`;
          row.style.fill = !c.rush ? 0x4a3426 : enough[k] ? 0x2f8a3a : 0xc0443e;
        }
      });
      // 最下面一列的中心在 y = 0，氣泡往上長
      const top = ROW_H / 2 + 6 - this.bubbleH;
      this.bubbleBg.clear()
        .roundRect(-50, top, 100, this.bubbleH, 16)
        .fill({ color: checkout ? (c.partial ? 0xfff0cc : 0xdff5d8) : 0xfff6e0 })
        .stroke({ width: 3, color: c.rush && !checkout ? 0xe0485f : 0x2b1d14 });
    }
    this.patience.visible = c.rush && !checkout;
    if (this.patience.visible) {
      const r = c.patience / c.patienceMax;
      this.patience.set(r, r > 0.5 ? 0x7bd36a : r > 0.25 ? 0xffc34d : 0xff5a5a);
    }
  }
}

class CustomerLayer extends Container {
  private views = new Map<number, CustomerView>();

  constructor(private tex: TextureBank) {
    super();
  }

  update(s: GameState, dt: number): void {
    const alive = new Set<number>();
    s.customers.forEach((c, q) => {
      alive.add(c.id);
      let v = this.views.get(c.id);
      if (!v) {
        v = new CustomerView(this.tex, c.id, c);
        this.views.set(c.id, v);
        this.addChild(v);
      }
      v.targetX = QUEUE_X[q] ?? QUEUE_X[QUEUE_X.length - 1];
    });
    for (const [id, v] of this.views) {
      const c = s.customers.find((x) => x.id === id);
      if (!alive.has(id) && !v.leaving) {
        v.leaving = true;
        v.targetX = OFFSTAGE_X + 60;
      }
      v.update(c, dt, s);
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

class LumiaView extends Container {
  private doll: PaperDoll;
  private zz = text('zZ', 26, 0xcfe3ff);
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

  constructor(private tex: TextureBank) {
    super();
    this.doll = new PaperDoll(tex, 'lumia_chibi_idle');
    this.zz.anchor.set(0.5);
    this.addChild(this.sparkle, this.doll, this.zz);
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
    this.doll.update(dt);
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
  private crate: Pic;
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

    // 收購箱：點了打開保留量設定
    this.crate = add('crate', 'upg_crate', PROPS.crate);
    this.crate.eventMode = 'static';
    this.crate.cursor = 'pointer';
    this.crate.on('pointerdown', () => openDrawer('counter', 'crate-reserve'));
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

  get crateVisible(): boolean {
    return this.crate.visible;
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

/** 同時存在的飄字上限：產量極快時避免物件無限增加拖慢畫面（超過就先移除最舊的） */
const MAX_FLOATS = 160;

class FloatLayer extends Container {
  private items: { t: Text; life: number; vx: number; vy: number }[] = [];

  spawn(s: string, x: number, y: number, color: number, big = false): void {
    if (this.items.length >= MAX_FLOATS) this.items.shift()!.t.destroy();
    const t = text(s, big ? 40 : 26, color);
    t.anchor.set(0.5);
    t.position.set(x, y);
    this.addChild(t);
    this.items.push({ t, life: 1.3, vx: (Math.random() - 0.5) * 60, vy: -220 });
  }

  update(dt: number): void {
    for (const it of this.items) {
      it.life -= dt;
      it.vy += 260 * dt;
      it.t.x += it.vx * dt;
      it.t.y += Math.min(it.vy, 30) * dt;
      it.t.alpha = Math.min(1, it.life / 0.4);
    }
    for (const it of this.items.filter((i) => i.life <= 0)) it.t.destroy();
    this.items = this.items.filter((i) => i.life > 0);
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
  const cauldrons = CAULDRON_X.map((_, i) => new CauldronView(i, tex, game, (v, e) => drag.press(v, e)));
  const props = new PropsLayer(tex, game);
  const customers = new CustomerLayer(tex);
  const lumia = new LumiaView(tex);
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
    lumiaLayer, lumiaDrag.hit, customers, floats, fever, highlight, dragLayer,
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
        floats.spawn(`+${formatNumber(e.gold)} 金${note}`, p.x, p.y, 0xffd34d, e.rush || e.tip);
        break;
      }
      case 'wholesale': {
        if (!props.crateVisible) break;
        const what = [
          e.amount > 0 ? `${formatNumber(e.amount)} 瓶` : '',
          e.materials > 0 ? `${formatNumber(e.materials)} 份原料` : '',
        ].filter(Boolean).join('、');
        floats.spawn(`+${formatNumber(e.gold)} 金（收購 ${what}）`, PROPS.crate.x, PROPS.crate.y - 100, 0xe8c56a);
        break;
      }
      case 'achievement': {
        const a = ACHIEVEMENTS.find((x) => x.id === e.id);
        if (a) showToast(`🏆 成就達成：${a.name}（+${a.reward} ♥）`);
        break;
      }
      case 'mascot':
        showToast(e.kind === 'exhausted' ? '露米婭累壞了，去休息室睡一下…' : '露米婭睡飽了，回去工作囉！');
        break;
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

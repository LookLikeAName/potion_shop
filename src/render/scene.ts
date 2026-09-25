import { Application, Container, Graphics, Rectangle, Text, type FederatedPointerEvent } from 'pixi.js';
import { UPGRADE_FX } from '../game/config/balance';
import { PLANTS } from '../game/config/plants';
import { RECIPES, type PotionId } from '../game/config/recipes';
import { activeCombo, nextLockedRecipes } from '../game/commands';
import { formatNumber } from '../game/format';
import type { Game } from '../game/game';
import { missingInputs, type GameEvent } from '../game/sim';
import type { CustomerState, GameState } from '../game/state';
import { has, milestoneCount } from '../game/stats';
import { openDrawer, showToast } from '../ui/store';
import {
  CAULDRON_X, CAULDRON_Y, COUNTER, DOOR, FLOATING_SLOT_FROM, H, LUMIA_AT_CAULDRON, LUMIA_AT_POT,
  LUMIA_COUNTER, OFFSTAGE_X, PROPS, QUEUE_X, QUEUE_Y, SHELF_Y, SLOT_POS, W, ZONES,
} from './layout';
import { PaperDoll } from './paperDoll';
import { FONT, Pic, TextureBank } from './textures';

const text = (s: string, size: number, fill = 0xffffff, weight: '400' | '700' = '700') =>
  new Text({
    text: s,
    style: { fontFamily: FONT, fontSize: size, fill, fontWeight: weight, align: 'center', stroke: { color: 0x2b1d14, width: Math.max(3, size / 6) } },
  });

const lighten = (c: number, k = 0.45) => lerpColor(c, 0xffffff, k);

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
  /** 浮空盆栽（隱藏格）：飄在溫室半空，下方有魔法光暈 */
  private floating: boolean;
  private baseY: number;
  private glow = new Graphics();

  constructor(private i: number, tex: TextureBank, private game: Game) {
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
    this.addChild(this.pot, this.plant, this.rain, this.fairy);
    // 進度條、徽章等資訊放在獨立圖層，畫在角色前面
    this.hud.position.copyFrom(this.position);
    this.hud.addChild(this.bar, this.lv.view, this.hint, this.ready);

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
    const stage = slot.ready
      ? slot.level >= 25 ? 'lush' : 'mature'
      : r < 0.34 ? 'sprout' : r < 0.67 ? 'growing' : 'mature';
    this.plant.setId(`plant_${slot.plant}_${stage}`);

    const squash = 1 + Math.sin(this.punch * Math.PI) * 0.12;
    const bob = slot.ready ? 1 + Math.sin(this.t * 6) * 0.04 : 1;
    // 植物根部對齊花盆盆口的土面（約在盆高 85% 處）
    const potH = this.pot.texture.height * this.pot.baseScale;
    this.plant.y = -potH * 0.85;
    this.plant.scale.y = this.plant.baseScale * bob / squash;
    this.pot.scale.y = this.pot.baseScale / (1 + (squash - 1) * 0.4);
    const top = this.plant.y - this.plant.texture.height * this.plant.baseScale;
    this.ready.y = top - 10 + Math.sin(this.t * 5) * 6;
    this.rain.y = Math.min(top, -potH - 110) - 22 + Math.sin(this.t * 2) * 4;
    this.fairy.y = -potH * 0.4 + Math.sin(this.t * 3 + 1) * 5;

    this.bar.set(slot.ready ? 1 : r, slot.ready ? 0xffd34d : lighten(def.color, 0.2));
    this.lv.label.text = `Lv ${slot.level}`;
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
    const brewing = !!c && c.batch > 0;
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
      this.bubbles.forEach((b, k) => {
        const ph = (this.t * (1.1 + k * 0.35) + k * 0.37) % 1;
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

    this.bar.set(c.progress / def.brewTime, boiling ? 0xffa040 : lighten(def.color, 0.25));
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

    if (brewing) {
      this.info.text = `熬煮中 ×${c.batch}`;
      this.setNeeds('', null, []);
    } else {
      this.info.text = '';
      const missing = missingInputs(s, c);
      this.setNeeds(`${c.recipe}:${missing.join(',')}`, c.recipe, missing);
    }
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

class CustomerView extends Container {
  targetX = OFFSTAGE_X;
  leaving = false;
  private body: PaperDoll;
  private bubble = new Container();
  private bubbleBg = new Graphics();
  private qty = new Text({ text: '', style: { fontFamily: FONT, fontSize: 24, fontWeight: '700', fill: 0x4a3426 } });
  private patience = new Bar(96, 10);
  private look = '';

  constructor(tex: TextureBank, public readonly id: number, c: CustomerState) {
    super();
    const pool = NPC_FOR[c.potion];
    this.body = new PaperDoll(tex, pool[c.id % pool.length]);
    this.x = OFFSTAGE_X;
    this.y = QUEUE_Y;
    const icon = new Pic(tex, `potion_${c.potion}`, 40, 40);
    icon.anchor.set(0.5);
    icon.x = -18;
    this.qty.anchor.set(0, 0.5);
    this.qty.x = 6;
    this.patience.y = 34;
    this.bubble.addChild(this.bubbleBg, icon, this.qty, this.patience);
    this.bubble.y = -258;
    this.addChild(this.body, this.bubble);
  }

  update(c: CustomerState | undefined, dt: number): void {
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
    const look = `${checkout}:${c.rush}`;
    if (look !== this.look) {
      this.look = look;
      this.qty.text = checkout ? '✓' : `×${c.qty}`;
      this.qty.style.fill = checkout ? 0x2f8a3a : 0x4a3426;
      this.bubbleBg.clear()
        .roundRect(-50, -28, 100, 56, 16).fill({ color: checkout ? 0xdff5d8 : 0xfff6e0 })
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
      v.update(c, dt);
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

// ---------- 露米婭（M3 指派系統前：在店裡的工作點之間走動） ----------

interface Station {
  x: number;
  y: number;
  /** back = 背對鏡頭站在盆栽/大釜前工作 */
  pose: 'back' | 'idle';
  dir: 1 | -1;
}

const LUMIA_SPEED = 120;

class LumiaView extends Container {
  private doll: PaperDoll;
  private target: Station | null = null;
  private stay = 1.5;

  constructor(tex: TextureBank) {
    super();
    this.doll = new PaperDoll(tex, 'lumia_chibi_idle');
    this.addChild(this.doll);
    this.position.set(LUMIA_COUNTER.x, LUMIA_COUNTER.y);
    // 不擋住後方盆栽/大釜的點擊
    this.eventMode = 'none';
  }

  /** 目前可以去的工作點：已種植的前排盆栽、已解鎖的大釜、櫃台旁 */
  private stations(s: GameState): Station[] {
    const out: Station[] = [{ ...LUMIA_COUNTER, pose: 'idle', dir: 1 }];
    s.slots.forEach((slot, i) => {
      if (slot.plant && i < 3) {
        out.push({ x: SLOT_POS[i].x + LUMIA_AT_POT.dx, y: SLOT_POS[i].y + LUMIA_AT_POT.dy, pose: 'back', dir: -1 });
      }
    });
    const last = s.cauldrons.length - 1;
    const y = CAULDRON_Y + LUMIA_AT_CAULDRON.dy;
    if (last >= 0) out.push({ x: CAULDRON_X[0] - LUMIA_AT_CAULDRON.dx, y, pose: 'back', dir: 1 });
    if (last >= 1) out.push({ x: CAULDRON_X[last] + LUMIA_AT_CAULDRON.dx, y, pose: 'back', dir: -1 });
    return out;
  }

  update(s: GameState, dt: number): void {
    const doll = this.doll;
    if (!this.target) {
      // 停留中
      this.stay -= dt;
      if (this.stay <= 0) {
        const options = this.stations(s).filter((st) => Math.hypot(st.x - this.x, st.y - this.y) > 30);
        this.target = options[Math.floor(Math.random() * options.length)] ?? null;
        this.stay = 3 + Math.random() * 5;
      }
      doll.update(dt);
      return;
    }

    const dx = this.target.x - this.x;
    const dy = this.target.y - this.y;
    const dist = Math.hypot(dx, dy);
    const step = LUMIA_SPEED * dt;
    if (dist <= step) {
      this.position.set(this.target.x, this.target.y);
      doll.setPose(this.target.pose === 'back' ? 'lumia_chibi_back' : 'lumia_chibi_idle');
      doll.mode = this.target.pose === 'back' ? 'work' : 'idle';
      doll.dir = this.target.dir;
      this.target = null;
    } else {
      this.x += (dx / dist) * step;
      this.y += (dy / dist) * step;
      doll.setPose('lumia_chibi_walk');
      doll.mode = 'walk';
      if (Math.abs(dx) > 2) doll.dir = dx > 0 ? 1 : -1;
    }
    doll.update(dt, LUMIA_SPEED);
  }
}

// ---------- 升級道具（買了才出現在場景裡） ----------

class PropsLayer extends Container {
  private items: { upg: string; pic: Pic; bob: number }[] = [];
  private bell: Pic;
  private bellPips = new Graphics();
  private bellPunch = 0;
  private crate: Pic;
  private t = 0;

  constructor(tex: TextureBank, private game: Game) {
    super();
    const add = (upg: string, id: string, pos: { x: number; y: number }, bob = 0, anchorY = 1) => {
      const pic = new Pic(tex, id);
      pic.anchor.set(0.5, anchorY);
      pic.position.set(pos.x, pos.y);
      pic.eventMode = 'none';
      this.addChild(pic);
      this.items.push({ upg, pic, bob });
      return pic;
    };
    add('star_can', 'upg_starsilver_can', PROPS.starCan);
    add('fortune_owl', 'upg_owl', PROPS.owl);
    add('diffuser', 'upg_diffuser', PROPS.diffuser, 1.5);
    add('signboard', 'upg_signboard', PROPS.signboard, 0, 0);

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
      it.pic.visible = has(s, it.upg);
      if (it.bob) it.pic.y = PROPS.diffuser.y + Math.sin(this.t * it.bob) * 2;
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

class FloatLayer extends Container {
  private items: { t: Text; life: number; vx: number; vy: number }[] = [];

  spawn(s: string, x: number, y: number, color: number, big = false): void {
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
  const pots = SLOT_POS.map((_, i) => new PotView(i, tex, game));
  const cauldrons = CAULDRON_X.map((_, i) => new CauldronView(i, tex, game, (v, e) => drag.press(v, e)));
  const props = new PropsLayer(tex, game);
  const customers = new CustomerLayer(tex);
  const lumia = new LumiaView(tex);
  const floats = new FloatLayer();
  // 後排（y 較小）的盆栽先畫，才會被前排擋住
  const potsByDepth = [...pots].sort((p, q) => p.y - q.y);
  app.stage.addChild(
    buildBackground(tex), props, ...potsByDepth, ...cauldrons, lumia, customers,
    ...potsByDepth.map((p) => p.hud), ...cauldrons.map((c) => c.hud), floats,
  );

  const cauldronPoint = (s: GameState, recipe: PotionId) => {
    const idx = s.cauldrons.findIndex((c) => c.recipe === recipe);
    return idx < 0 ? null : cauldrons[idx].anchorPoint;
  };

  const onEvent = (e: GameEvent, s: GameState) => {
    switch (e.type) {
      case 'harvest': {
        const p = pots[e.slot].anchorPoint;
        const label = `+${formatNumber(e.amount)} ${PLANTS[e.material].name}`;
        if (e.crit) floats.spawn(`暴擊生長！${label}`, p.x, p.y - 20, 0xffe066, true);
        else if (e.bounty) floats.spawn(`豐收！${label}`, p.x, p.y - 10, 0x9dff8a);
        else floats.spawn(label, p.x, p.y, lighten(PLANTS[e.material].color));
        break;
      }
      case 'brewed': {
        const p = cauldronPoint(s, e.recipe);
        if (!p) break;
        const label = `+${formatNumber(e.amount)} ${RECIPES[e.recipe].name}`;
        if (e.double) floats.spawn(`雙倍！${label}`, p.x, p.y - 20, 0x9ee8ff, true);
        else floats.spawn(label, p.x, p.y, lighten(RECIPES[e.recipe].color));
        break;
      }
      case 'boil': {
        const p = cauldronPoint(s, e.recipe);
        if (p) floats.spawn('極速沸騰！', p.x, p.y - 40, 0xff8a3c, true);
        break;
      }
      case 'sale': {
        const p = customers.posOf(e.id) ?? { x: COUNTER.x + 100, y: COUNTER.y - 40 };
        const note = e.tip ? '（土豪小費！）' : e.rush ? '（急單！）' : '';
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
    for (const e of game.drainEvents()) onEvent(e, s);
    floats.update(dt);
  });

  return app;
}

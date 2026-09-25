import { Application, Container, Graphics, Rectangle, Text, type FederatedPointerEvent } from 'pixi.js';
import { PLANTS } from '../game/config/plants';
import { RECIPES, type PotionId } from '../game/config/recipes';
import { nextLockedRecipes } from '../game/commands';
import { formatNumber } from '../game/format';
import type { Game } from '../game/game';
import { missingInputs, type GameEvent } from '../game/sim';
import type { CustomerState, GameState } from '../game/state';
import { milestoneCount } from '../game/stats';
import { openDrawer, showToast } from '../ui/store';
import {
  CAULDRON_X, CAULDRON_Y, COUNTER, DOOR, H, LUMIA_RANGE, LUMIA_Y, OFFSTAGE_X, QUEUE_X, QUEUE_Y,
  SHELF_Y, SLOT_POS, W, ZONES,
} from './layout';
import { FONT, Pic, TextureBank } from './textures';

const text = (s: string, size: number, fill = 0xffffff, weight: '400' | '700' = '700') =>
  new Text({
    text: s,
    style: { fontFamily: FONT, fontSize: size, fill, fontWeight: weight, align: 'center', stroke: { color: 0x2b1d14, width: Math.max(3, size / 6) } },
  });

const lighten = (c: number, k = 0.45) => {
  const r = (c >> 16) & 255, g = (c >> 8) & 255, b = c & 255;
  const f = (v: number) => Math.round(v + (255 - v) * k);
  return (f(r) << 16) | (f(g) << 8) | f(b);
};

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
  private pot: Pic;
  private plant: Pic;
  private bar = new Bar(110);
  private lv: { view: Container; label: Text };
  private hint = text('', 20, 0xf6e3b4);
  private rain: Pic;
  private fairy: Pic;
  private ready = text('!', 34, 0xffe066);
  private punch = 0;
  private t = Math.random() * 10;

  constructor(private i: number, tex: TextureBank, private game: Game) {
    super();
    const pos = SLOT_POS[i];
    this.position.set(pos.x, pos.y);
    this.pot = new Pic(tex, 'pot_t1');
    this.pot.anchor.set(0.5, 1);
    this.plant = new Pic(tex, 'plant_redheart_sprout');
    this.plant.anchor.set(0.5, 1);
    this.plant.y = -78;
    this.bar.y = 10;
    this.lv = badge(() => openDrawer('greenhouse', `slot-${i}`));
    this.lv.view.y = 44;
    this.hint.anchor.set(0.5);
    this.hint.y = -120;
    this.rain = new Pic(tex, 'upg_raincloud');
    this.rain.anchor.set(0.5);
    this.rain.position.set(20, -240);
    this.fairy = new Pic(tex, 'upg_fairy');
    this.fairy.anchor.set(0.5);
    this.fairy.position.set(-56, -30);
    this.ready.anchor.set(0.5);
    this.ready.position.set(40, -200);
    this.addChild(this.plant, this.pot, this.rain, this.fairy, this.bar, this.lv.view, this.hint, this.ready);

    this.eventMode = 'static';
    this.cursor = 'pointer';
    this.hitArea = new Rectangle(-70, -230, 140, 250);
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

    const planted = !!slot.plant;
    this.plant.visible = planted;
    this.bar.visible = planted;
    this.lv.view.visible = planted;
    this.rain.visible = planted && slot.rain > 0;
    this.fairy.visible = planted && slot.fairy;
    this.ready.visible = planted && slot.ready;

    if (!slot.open) {
      this.pot.setId('pot_locked');
      this.pot.alpha = 0.55;
      this.hint.text = '隱藏格';
      return;
    }
    if (!slot.plant) {
      this.pot.setId('pot_t1');
      this.pot.alpha = 0.6;
      this.hint.text = '＋ 種植';
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
    this.plant.scale.y = Math.abs(this.plant.scale.x) * bob / squash;
    this.pot.scale.y = Math.abs(this.pot.scale.x) / (1 + (squash - 1) * 0.4);
    this.ready.y = -200 + Math.sin(this.t * 5) * 6;
    this.rain.y = -240 + Math.sin(this.t * 2) * 4;
    this.fairy.y = -30 + Math.sin(this.t * 3 + 1) * 5;

    this.bar.set(slot.ready ? 1 : r, slot.ready ? 0xffd34d : lighten(def.color, 0.2));
    this.lv.label.text = `Lv ${slot.level}`;
  }

  get anchorPoint() {
    return { x: this.x, y: this.y - 170 };
  }
}

// ---------- 大釜 ----------

class CauldronView extends Container {
  private body: Pic;
  private liquid = new Graphics();
  private bar = new Bar(150, 14);
  private lv: { view: Container; label: Text };
  private title = text('', 20, 0xf6e3b4);
  private info = text('', 22, 0xffffff);
  private needs = new Container();
  private salamander: Pic;
  private shake = 0;
  private punch = 0;
  private t = Math.random() * 10;
  private recipe: PotionId | null = null;
  private locked: PotionId | null = null;

  constructor(private i: number, private tex: TextureBank, private game: Game) {
    super();
    this.position.set(CAULDRON_X[i], CAULDRON_Y);
    this.body = new Pic(tex, 'cauldron_t1');
    this.body.anchor.set(0.5, 1);
    this.salamander = new Pic(tex, 'upg_salamander');
    this.salamander.anchor.set(0.5, 1);
    this.salamander.position.set(-62, 4);
    this.bar.y = 10;
    this.lv = badge(() => this.recipe && openDrawer('cauldron', `recipe-${this.recipe}`));
    this.lv.view.y = 46;
    this.title.anchor.set(0.5);
    this.title.y = 76;
    this.info.anchor.set(0.5);
    this.info.y = -215;
    this.needs.y = -215;
    this.addChild(this.body, this.liquid, this.salamander, this.bar, this.lv.view, this.title, this.info, this.needs);

    this.eventMode = 'static';
    this.cursor = 'pointer';
    this.hitArea = new Rectangle(-110, -200, 220, 215);
    this.on('pointerdown', () => this.tap());
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
    const active = !!c;
    this.bar.visible = active;
    this.lv.view.visible = active;
    this.salamander.visible = active && c.salamander > 0;
    this.liquid.clear();

    if (!c) {
      this.setNeeds('', null, []);
      if (!this.locked) return;
      const r = RECIPES[this.locked];
      this.body.setId('cauldron_t1');
      this.body.alpha = 0.3;
      this.title.text = '';
      this.info.text = `🔒 ${r.name}\n${formatNumber(r.unlockCost)} 金幣`;
      this.info.y = -110;
      return;
    }

    const def = RECIPES[c.recipe];
    this.body.alpha = 1;
    this.body.setId(`cauldron_t${Math.min(3, milestoneCount(c.level)) + 1}`);
    this.x = CAULDRON_X[this.i] + (this.shake > 0 ? Math.sin(this.t * 80) * 8 * (this.shake / 0.35) : 0);
    const squash = 1 + Math.sin(this.punch * Math.PI) * 0.06;
    this.body.scale.y = Math.abs(this.body.scale.x) / squash;

    // 鍋內液體（依配方著色）
    const brewing = c.batch > 0;
    const top = -this.body.height * 0.8;
    this.liquid
      .ellipse(0, top, 70, 16)
      .fill({ color: brewing ? def.color : 0x3a3230, alpha: brewing ? 0.95 : 0.6 });
    if (brewing) {
      for (let k = 0; k < 3; k++) {
        const ph = (this.t * (1.2 + k * 0.3) + k * 0.37) % 1;
        this.liquid.circle(-40 + k * 40, top - ph * 30, 6 * (1 - ph) + 2).fill({ color: lighten(def.color), alpha: 1 - ph });
      }
    }

    this.bar.set(c.progress / def.brewTime, lighten(def.color, 0.25));
    this.lv.label.text = `Lv ${c.level}`;
    this.title.text = def.name;
    this.info.y = -215;

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
      const icon = new Pic(this.tex, `item_${m}`, 38, 38);
      icon.anchor.set(0.5);
      const x = (k - (inputs.length - 1) / 2) * 76;
      icon.position.set(x - 14, 0);
      const n = text(`×${need}`, 20, missing.includes(m) ? 0xff7a7a : 0xffffff);
      n.anchor.set(0, 0.5);
      n.position.set(x + 8, 0);
      this.needs.addChild(icon, n);
    });
  }

  get anchorPoint() {
    return { x: this.x, y: this.y - 230 };
  }
}

// ---------- 顧客 ----------

const NPC_FOR: Record<PotionId, string[]> = {
  glow: ['npc_novice_adventurer', 'npc_dwarf_merchant'],
  focus: ['npc_mage_apprentice'],
  elixir: ['npc_elf_noble'],
};

class CustomerView extends Container {
  targetX = OFFSTAGE_X;
  leaving = false;
  private body: Pic;
  private bubble = new Container();
  private bubbleBg = new Graphics();
  private qty = text('', 22);
  private patience = new Bar(90, 10);
  private t = Math.random() * 10;
  private look = '';

  constructor(tex: TextureBank, public readonly id: number, c: CustomerState) {
    super();
    const pool = NPC_FOR[c.potion];
    this.body = new Pic(tex, pool[c.id % pool.length]);
    this.body.anchor.set(0.5, 1);
    this.x = OFFSTAGE_X;
    this.y = QUEUE_Y;
    const icon = new Pic(tex, `potion_${c.potion}`, 40, 40);
    icon.anchor.set(0.5);
    icon.x = -18;
    this.qty.anchor.set(0, 0.5);
    this.qty.x = 6;
    this.patience.y = 30;
    this.bubble.addChild(this.bubbleBg, icon, this.qty, this.patience);
    this.bubble.y = -205;
    this.addChild(this.body, this.bubble);
  }

  update(c: CustomerState | undefined, dt: number): void {
    this.t += dt;
    const dx = this.targetX - this.x;
    const step = 520 * dt;
    const moving = Math.abs(dx) > 1;
    this.x += Math.sign(dx) * Math.min(Math.abs(dx), step);
    this.body.face(dx > 0 ? 1 : -1);
    this.body.y = moving ? -Math.abs(Math.sin(this.t * 12)) * 8 : 0;
    this.bubble.visible = !this.leaving && !!c;
    if (!c) return;

    const checkout = c.status === 'checkout';
    const look = `${checkout}:${c.rush}`;
    if (look !== this.look) {
      this.look = look;
      this.qty.text = checkout ? '✓' : `×${c.qty}`;
      this.qty.style.fill = checkout ? 0x2f8a3a : 0xffffff;
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
    return v ? { x: v.x, y: v.y - 220 } : null;
  }
}

// ---------- 露米婭（M3 前先做簡單巡邏） ----------

class LumiaView extends Container {
  private body: Pic;
  private dir: 1 | -1 = 1;
  private pause = 2;
  private t = 0;

  constructor(tex: TextureBank) {
    super();
    this.body = new Pic(tex, 'lumia_chibi_idle');
    this.body.anchor.set(0.5, 1);
    this.addChild(this.body);
    this.position.set(LUMIA_RANGE[0] + 60, LUMIA_Y);
    this.eventMode = 'none';
  }

  update(dt: number): void {
    this.t += dt;
    if (this.pause > 0) {
      this.pause -= dt;
      this.body.setId('lumia_chibi_idle');
      this.body.y = Math.sin(this.t * 2.5) * 2;
      return;
    }
    this.x += this.dir * 90 * dt;
    this.body.setId(Math.floor(this.t * 4) % 2 ? 'lumia_chibi_walk_a' : 'lumia_chibi_walk_b');
    this.body.face(this.dir);
    this.body.y = -Math.abs(Math.sin(this.t * 8)) * 5;
    const [lo, hi] = LUMIA_RANGE;
    if (this.x < lo || this.x > hi) {
      this.x = Math.max(lo, Math.min(hi, this.x));
      this.dir = this.dir === 1 ? -1 : 1;
      this.pause = 1 + Math.random() * 2;
    } else if (Math.random() < dt * 0.15) {
      this.pause = 1.5 + Math.random() * 2.5;
    }
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

  const tex = new TextureBank(app);
  await tex.init();

  const pots = SLOT_POS.map((_, i) => new PotView(i, tex, game));
  const cauldrons = CAULDRON_X.map((_, i) => new CauldronView(i, tex, game));
  const customers = new CustomerLayer(tex);
  const lumia = new LumiaView(tex);
  const floats = new FloatLayer();
  app.stage.addChild(buildBackground(tex), ...pots, ...cauldrons, customers, lumia, floats);

  const onEvent = (e: GameEvent, s: GameState) => {
    switch (e.type) {
      case 'harvest': {
        const p = pots[e.slot].anchorPoint;
        floats.spawn(`+${formatNumber(e.amount)} ${PLANTS[e.material].name}`, p.x, p.y, lighten(PLANTS[e.material].color));
        break;
      }
      case 'brewed': {
        const idx = s.cauldrons.findIndex((c) => c.recipe === e.recipe);
        if (idx < 0) break;
        const p = cauldrons[idx].anchorPoint;
        floats.spawn(`+${formatNumber(e.amount)} ${RECIPES[e.recipe].name}`, p.x, p.y, lighten(RECIPES[e.recipe].color));
        break;
      }
      case 'sale': {
        const p = customers.posOf(e.id) ?? { x: COUNTER.x + 100, y: COUNTER.y - 40 };
        floats.spawn(`+${formatNumber(e.gold)} 金${e.rush ? '（急單！）' : ''}`, p.x, p.y, 0xffd34d, e.rush);
        break;
      }
      default:
        break;
    }
  };

  app.ticker.add((ticker) => {
    game.advance();
    const dt = Math.min(0.25, ticker.deltaMS / 1000);
    const s = game.state;
    for (const p of pots) p.update(s, dt);
    for (const c of cauldrons) c.update(s, dt);
    customers.update(s, dt);
    lumia.update(dt);
    for (const e of game.drainEvents()) onEvent(e, s);
    floats.update(dt);
  });

  return app;
}

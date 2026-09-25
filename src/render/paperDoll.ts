// 紙娃娃劇風格的角色：只用一張圖，靠上下彈跳、擠壓伸展、左右翻面來表現動作。
import { Container } from 'pixi.js';
import { Pic, type TextureBank } from './textures';

export type DollMode = 'idle' | 'walk' | 'work';

/** 走一步（一次彈跳）的距離 px */
const STRIDE = 46;
const HOP_HEIGHT = 12;
/** 翻面所需秒數：寬度從 +1 縮到 0 再翻到 -1，像把紙片轉過來 */
const TURN_TIME = 0.16;

export class PaperDoll extends Container {
  readonly pic: Pic;
  /** 目前朝向：1 = 右、-1 = 左 */
  dir: 1 | -1 = -1;
  mode: DollMode = 'idle';

  private flip = 1;
  private phase = 0;
  private t = Math.random() * 10;

  constructor(bank: TextureBank, id: string) {
    super();
    this.pic = new Pic(bank, id);
    this.pic.anchor.set(0.5, 1);
    this.addChild(this.pic);
    this.flip = this.targetFlip();
  }

  setPose(id: string): void {
    this.pic.setId(id);
  }

  /** @param speed 目前移動速度（px/秒），用來決定彈跳節奏 */
  update(dt: number, speed = 0): void {
    this.t += dt;

    // 翻面：線性穿過 0，看起來像紙片轉身
    const target = this.targetFlip();
    const step = (2 / TURN_TIME) * dt;
    this.flip = this.flip < target ? Math.min(target, this.flip + step) : Math.max(target, this.flip - step);

    let sx = 1;
    let sy = 1;
    let y = 0;
    let rot = 0;
    if (this.mode === 'walk') {
      this.phase += (Math.PI * Math.max(speed, 60) * dt) / STRIDE;
      const air = Math.abs(Math.sin(this.phase));
      const land = (1 - air) ** 4; // 落地瞬間壓扁
      y = -air * HOP_HEIGHT;
      sy = 1 - 0.1 * land + 0.04 * air;
      sx = 1 + 0.08 * land - 0.02 * air;
      rot = Math.sin(this.phase) * 0.06 * this.dir; // 前後搖擺
    } else if (this.mode === 'work') {
      const beat = Math.abs(Math.sin(this.t * 4.5));
      y = -beat * 5;
      sy = 1 - 0.05 * (1 - beat);
      sx = 1 + 0.04 * (1 - beat);
      rot = Math.sin(this.t * 2.25) * 0.03;
    } else {
      const breath = Math.sin(this.t * 2.2);
      sy = 1 + 0.015 * breath;
      sx = 1 - 0.01 * breath;
    }

    const base = this.pic.baseScale;
    this.pic.scale.set(base * sx * this.flip, base * sy);
    this.pic.y = y;
    this.pic.rotation = rot;
  }

  private targetFlip(): 1 | -1 {
    return this.dir === this.pic.facing ? 1 : -1;
  }
}

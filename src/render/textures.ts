import { Application, Assets, Container, Graphics, Sprite, Text, Texture } from 'pixi.js';
import { ASSETS, ASSET_MAP, ART_URLS, type AssetDef } from '../assets/manifest';

export const FONT = '"Noto Sans TC", "Microsoft JhengHei", "PingFang TC", "Heiti TC", sans-serif';

/** 有正式圖就載入，沒有就產生「色塊 + 名稱」的佔位圖 */
export class TextureBank {
  private map = new Map<string, Texture>();

  constructor(private app: Application) {}

  async init(): Promise<void> {
    await Promise.all(ASSETS.map(async (def) => {
      const url = ART_URLS[def.id];
      if (url) {
        try {
          this.map.set(def.id, await Assets.load<Texture>(url));
          return;
        } catch (err) {
          console.warn(`[assets] 無法載入 ${def.id}，改用佔位圖`, err);
        }
      }
      this.map.set(def.id, this.placeholder(def));
    }));
  }

  hasArt(id: string): boolean {
    return !!ART_URLS[id];
  }

  get(id: string): Texture {
    return this.map.get(id) ?? Texture.WHITE;
  }

  private placeholder(def: AssetDef): Texture {
    const c = new Container();
    const g = new Graphics();
    const { w, h, color } = def;
    if (def.shape === 'circle') g.circle(w / 2, h / 2, Math.min(w, h) / 2 - 2);
    else g.roundRect(2, 2, w - 4, h - 4, def.shape === 'round' ? Math.min(w, h) * 0.3 : 8);
    g.fill({ color, alpha: 0.92 }).stroke({ width: 3, color: 0x2b1d14, alpha: 0.8 });
    c.addChild(g);
    const label = new Text({
      text: def.label,
      style: {
        fontFamily: FONT, fontSize: Math.max(12, Math.min(w, h) / (def.label.length > 3 ? 5 : 3)),
        fill: 0xffffff, fontWeight: '700', align: 'center',
        stroke: { color: 0x2b1d14, width: 4 },
      },
    });
    label.anchor.set(0.5);
    label.position.set(w / 2, h / 2);
    c.addChild(label);
    const tex = this.app.renderer.generateTexture({ target: c, resolution: 2 });
    c.destroy({ children: true });
    return tex;
  }
}

/** 依資源 ID 顯示的 Sprite，自動縮放到指定大小（保持比例） */
export class Pic extends Sprite {
  private id = '';

  constructor(private bank: TextureBank, id: string, private boxW?: number, private boxH?: number) {
    super();
    this.setId(id);
  }

  setId(id: string): void {
    if (id === this.id) return;
    this.id = id;
    this.texture = this.bank.get(id);
    const def = ASSET_MAP[id];
    const w = this.boxW ?? def?.w ?? this.texture.width;
    const h = this.boxH ?? def?.h ?? this.texture.height;
    const s = Math.min(w / this.texture.width, h / this.texture.height);
    const flip = Math.sign(this.scale.x) || 1;
    this.scale.set(s * flip, s);
  }

  /** 左右翻轉（保持大小） */
  face(dir: 1 | -1): void {
    this.scale.x = Math.abs(this.scale.x) * dir;
  }
}

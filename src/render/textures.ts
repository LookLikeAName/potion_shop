import { Application, Assets, Container, Graphics, Sprite, Text, Texture } from 'pixi.js';
import { ASSETS, ASSET_MAP, ART_URLS, type AssetDef } from '../assets/manifest';
import { currentLang } from '../i18n';

const FONT_TC = '"Noto Sans TC", "Microsoft JhengHei", "PingFang TC", "Heiti TC", sans-serif';
/** 日文要用日文字型，漢字的字形才對（中文字型的「骨」「直」等寫法不同） */
const FONT_JA = '"Noto Sans JP", "Hiragino Kaku Gothic ProN", "Yu Gothic UI", "Meiryo", ' + FONT_TC;

/** 場景文字的字型（依目前語言；和 styles.css 的 :lang(ja) 一致） */
export function uiFont(): string {
  return currentLang() === 'ja' ? FONT_JA : FONT_TC;
}

/** CG 只在介面（劇情、事件簿）用網頁圖片顯示，場景用不到 */
const inScene = (def: AssetDef) => !def.id.startsWith('cg_');

/** 場景要載入成貼圖的正式圖網址（開場預先下載用） */
export function sceneTextureUrls(): string[] {
  return ASSETS.filter(inScene).map((def) => ART_URLS[def.id]).filter((u): u is string => !!u);
}

/** 有正式圖就載入，沒有就產生「色塊 + 名稱」的佔位圖 */
export class TextureBank {
  private map = new Map<string, Texture>();

  constructor(private app: Application) {}

  async init(): Promise<void> {
    // CG 不載入成貼圖（每張 1792×1008，全部載入會佔掉上百 MB 的顯示記憶體、拖慢開場）
    await Promise.all(ASSETS.filter(inScene).map(async (def) => {
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
        fontFamily: uiFont(), fontSize: Math.max(12, Math.min(w, h) / (def.label.length > 3 ? 5 : 3)),
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
  private dir: 1 | -1 = 1;
  private fit = 1;

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
    this.fit = Math.min(w / this.texture.width, h / this.texture.height);
    this.scale.set(this.fit, this.fit);
    this.face(this.dir);
  }

  /** 面向右 (1) 或左 (-1)；會依原圖面向自動決定要不要翻轉 */
  face(dir: 1 | -1): void {
    this.dir = dir;
    // 佔位圖是對稱的色塊，不必翻轉
    const facing = this.bank.hasArt(this.id) ? ASSET_MAP[this.id]?.facing ?? 1 : dir;
    this.scale.x = this.fit * (dir === facing ? 1 : -1);
  }

  /** 以顯示框縮放後的原始比例（不含翻轉、擠壓） */
  get baseScale(): number {
    return this.fit;
  }

  /** 原圖面向（佔位圖視為朝右） */
  get facing(): 1 | -1 {
    return this.bank.hasArt(this.id) ? ASSET_MAP[this.id]?.facing ?? 1 : 1;
  }
}

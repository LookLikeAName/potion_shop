// 電腦版的遊戲游標（src/assets/art/cursors，由 scripts/import_art.py 產生 32px／64px 與點擊位置）。
// 網頁介面用 CSS 變數 --cursor-<種類>，Pixi 場景用 cursorStyles，兩邊同一套。
// 另外兩個狀態由這裡切換：按住可以點的東西時換成「點下去」，拖曳中換成「握住的手」。
import hotspots from '../assets/art/cursors/hotspots.json';

export type CursorKind = 'default' | 'pointer' | 'press' | 'grab' | 'grabbing' | 'disabled';

const KINDS: CursorKind[] = ['default', 'pointer', 'press', 'grab', 'grabbing', 'disabled'];
/** 沒有圖、或瀏覽器不支援時的系統游標 */
const FALLBACK: Record<CursorKind, string> = {
  default: 'default', pointer: 'pointer', press: 'pointer', grab: 'grab', grabbing: 'grabbing', disabled: 'not-allowed',
};

const FILES = import.meta.glob('../assets/art/cursors/*.png', { eager: true, query: '?url', import: 'default' }) as Record<string, string>;
/** 每張游標的顯示大小與點擊位置（1x 圖的像素座標） */
const HOTSPOTS: Record<string, { size: number; '1x': number[]; '2x': number[] }> = hotspots;

const styles: Record<CursorKind, string> = { ...FALLBACK };

const urlOf = (kind: CursorKind): string | undefined => FILES[`../assets/art/cursors/cursor_${kind}.png`];

function build(kind: CursorKind): string {
  const id = `cursor_${kind}`;
  const one = urlOf(kind);
  const spot = HOTSPOTS[id]?.['1x'];
  if (!one || !spot) return FALLBACK[kind];
  const two = FILES[`../assets/art/cursors/${id}@2x.png`];
  const [x, y] = spot;
  // 高解析度螢幕用 64px 的圖（image-set），不支援時退回 32px
  const hiDpi = two && `image-set(url("${one}") 1x, url("${two}") 2x) ${x} ${y}, ${FALLBACK[kind]}`;
  if (hiDpi && CSS.supports('cursor', hiDpi)) return hiDpi;
  return `url("${one}") ${x} ${y}, ${FALLBACK[kind]}`;
}

/** 某種游標的 CSS 值（給 Pixi 的 cursorStyles 用） */
export function cursorStyle(kind: CursorKind): string {
  return styles[kind];
}

/** 拖曳開始時呼叫：放開滑鼠前都顯示握住的手 */
export function startGrabbing(): void {
  document.documentElement.classList.add('grabbing');
}

/**
 * 目前指著的東西是不是「可以點」（網頁元素看計算後的 cursor；畫布看 Pixi 設的 cursor）。
 * 用圖片網址比對（打包後小圖可能被內嵌成 data URL，看不到檔名）
 */
function isPointer(el: Element): boolean {
  const c = el instanceof HTMLElement && el.style.cursor ? el.style.cursor : getComputedStyle(el).cursor;
  const url = urlOf('pointer');
  return c === 'pointer' || (!!url && c.includes(url));
}

/** 啟用遊戲游標（只在有滑鼠的裝置；觸控裝置沒有游標） */
export function installCursors(): void {
  if (!matchMedia('(any-pointer: fine)').matches) return;
  const root = document.documentElement;
  for (const k of KINDS) {
    styles[k] = build(k);
    root.style.setProperty(`--cursor-${k}`, styles[k]);
  }
  root.classList.add('game-cursors');
  const release = () => root.classList.remove('pressing', 'grabbing');
  window.addEventListener('pointerdown', (e) => {
    if (e.pointerType === 'mouse' && e.target instanceof Element && isPointer(e.target)) root.classList.add('pressing');
  }, { capture: true });
  window.addEventListener('pointerup', release);
  window.addEventListener('pointercancel', release);
  window.addEventListener('blur', release);
}

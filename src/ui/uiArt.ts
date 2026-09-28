// 魔導書的書本素材（紙張、皮革、角落花紋、分隔線）：有繪製的素材時設成 CSS 變數，styles.css 疊在底色上；
// 沒有的時候變數維持 none，只用 CSS 畫的配色
import { ART_URLS } from '../assets/manifest';

const VARS: Record<string, string> = {
  ui_page_texture: '--tex-page',
  ui_leather_texture: '--tex-leather',
  ui_corner: '--ui-corner',
  ui_divider: '--ui-divider',
};

export function installUiArt(): void {
  const root = document.documentElement;
  for (const [id, v] of Object.entries(VARS)) {
    const url = ART_URLS[id];
    if (url) root.style.setProperty(v, `url("${url}")`);
  }
}

import { ART_URLS } from '../assets/manifest';
import { Icon } from './Icon';

/**
 * 介面的小圖示：有繪製的素材就用素材，還沒有的時候暫時顯示文字符號（原本的 emoji）或另一張圖。
 * 素材匯入（scripts/import_art.py）後會自動換上，不用改程式。
 */
export function Glyph({ id, text, alt, size = 1.1 }: {
  id: string;
  /** 沒有素材時顯示的文字符號 */
  text?: string;
  /** 沒有素材時改用的另一張圖 */
  alt?: string;
  size?: number;
}) {
  if (ART_URLS[id]) return <Icon id={id} size={size} />;
  if (alt && ART_URLS[alt]) return <Icon id={alt} size={size} />;
  return <span class="glyph" aria-hidden="true">{text}</span>;
}

/** 開心度（愛心）圖示：數字旁邊用 */
export function Heart({ size = 0.95 }: { size?: number }) {
  return <Glyph id="icon_happiness" text="♥" size={size} />;
}

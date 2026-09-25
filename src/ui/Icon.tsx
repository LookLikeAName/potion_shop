import { ART_URLS, ASSET_MAP } from '../assets/manifest';

const hex = (n: number) => `#${n.toString(16).padStart(6, '0')}`;

/** DOM 用圖示：有正式圖就顯示圖片，沒有就顯示色塊佔位 */
export function Icon({ id, size = 1.2 }: { id: string; size?: number }) {
  const style = { width: `${size}em`, height: `${size}em` };
  const url = ART_URLS[id];
  if (url) return <img class="icon" src={url} style={style} alt="" draggable={false} />;
  const def = ASSET_MAP[id];
  return (
    <span class="icon ph" style={{ ...style, background: def ? hex(def.color) : '#888' }}>
      {def?.label.replace('\n', '').slice(0, 1) ?? '?'}
    </span>
  );
}

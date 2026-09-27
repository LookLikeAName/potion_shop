import { useEffect, useRef, useState } from 'preact/hooks';
import { WISH } from '../game/config/wishes';
import { formatFull } from '../game/format';
import { wishText } from '../game/wishes';
import { drawerOpen, openDrawer, useGame } from './store';

/** 開心度顯示成「整數 + 小數」：+2.35、+0.5 */
export const fmtHeart = (n: number) => n.toFixed(2).replace(/\.?0+$/, '');

interface Pop {
  id: number;
  text: string;
}

/**
 * 頂列的開心度：整數 + 一顆愛心，愛心的水位是小數部分。
 * 一次拿到比較多時冒出「+x」，裝滿一顆時愛心跳一下。
 */
export function HeartMeter() {
  const game = useGame();
  const h = game.state.happiness;
  const whole = Math.floor(h + 1e-9);
  const frac = Math.max(0, Math.min(1, h - whole));
  const last = useRef(h);
  const popId = useRef(0);
  const [pops, setPops] = useState<Pop[]>([]);
  const [burst, setBurst] = useState(0);

  useEffect(() => {
    const gain = h - last.current;
    const before = Math.floor(last.current + 1e-9);
    last.current = h;
    // 休息的開心度是一點一點進來的，太小的就只看水位上升
    if (gain >= 0.01) {
      const id = ++popId.current;
      setPops((p) => [...p.slice(-3), { id, text: `+${fmtHeart(gain)}` }]);
      setTimeout(() => setPops((p) => p.filter((x) => x.id !== id)), 1200);
    }
    if (whole > before && gain > 0) setBurst((n) => n + 1);
  }, [h]);

  return (
    <button class="res res-btn heart-meter" title="開心度（點擊打開兌換）" onClick={() => openDrawer('lumia')}>
      <span class={`heart ${burst ? 'burst' : ''}`} key={burst}>
        <svg viewBox="0 0 32 30" aria-hidden="true">
          <defs>
            <clipPath id="heart-clip"><path d={HEART} /></clipPath>
          </defs>
          <path d={HEART} class="heart-empty" />
          <rect class="heart-fill" x="0" y="0" width="32" height="30" clip-path="url(#heart-clip)"
            style={{ transform: `scaleY(${frac})` }} />
          <path d={HEART} class="heart-line" />
        </svg>
      </span>
      <b class="heart-count">{whole}</b>
      {pops.map((p) => <span key={p.id} class="heart-pop">{p.text}</span>)}
    </button>
  );
}

const HEART = 'M16 29C6 21 1 15 1 8.8 1 4.2 4.6 1 8.8 1c3 0 5.6 1.7 7.2 4.3C17.6 2.7 20.2 1 23.2 1 27.4 1 31 4.2 31 8.8 31 15 26 21 16 29z';

/** 畫面右上角的小心願卡片：題目、進度、剩餘時間與獎勵 */
export function WishCard() {
  const game = useGame();
  const w = game.state.wish;
  if (!w) return null;
  const r = WISH.rarities[w.rarity] ?? WISH.rarities[0];
  const pct = Math.min(100, (w.progress / w.goal) * 100);
  const secs = Math.max(0, Math.ceil(w.time));
  const time = secs >= 60 ? `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}` : `${secs} 秒`;
  return (
    <div class={`wish-card rarity-${w.rarity} ${drawerOpen.value ? 'shift' : ''}`}>
      <div class="wish-head">
        <span class="wish-name">♥ 露米婭的{r.name}</span>
        <span class={`wish-time ${secs <= 30 ? 'urgent' : ''}`}>⏳ {time}</span>
      </div>
      <div class="wish-text">{wishText(w)}</div>
      <div class="wish-bar"><div class="wish-fill" style={{ width: `${pct}%` }} /></div>
      <div class="wish-foot">
        <span>{formatFull(Math.min(w.progress, w.goal))} / {formatFull(w.goal)}</span>
        <span class="wish-reward">完成 +{fmtHeart(w.reward)} ♥</span>
      </div>
    </div>
  );
}

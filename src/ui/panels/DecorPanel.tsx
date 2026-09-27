import { signal } from '@preact/signals';
import { ART_URLS, ASSET_MAP } from '../../assets/manifest';
import { DECOR, GIFTS, GIFT_MAP, type GiftDef } from '../../game/config/gifts';
import { formatNumber } from '../../game/format';
import { decorSlots } from '../../game/stats';
import { Icon } from '../Icon';
import { dragGhost, openDrawer, showToast, useGame } from '../store';

/** 擺設位的名稱（依 DECOR_POS 的順序） */
const SLOT_NAMES = ['層架左', '層架右', '坐墊旁', '樓梯邊'];

/** 拖曳中指標下方的擺設位（高亮用） */
const hoverSlot = signal<number | null>(null);
/** 點一下選起來的禮物（再點擺設位放上去；觸控時不用拖曳也能擺） */
const picked = signal<string | null>(null);

/** 瀏覽器座標 → #ui 內的座標（舞台有縮放） */
function toLocal(cx: number, cy: number): { x: number; y: number } {
  const ui = document.getElementById('ui')!;
  const r = ui.getBoundingClientRect();
  const scale = r.width / ui.offsetWidth || 1;
  return { x: (cx - r.left) / scale, y: (cy - r.top) / scale };
}

function slotAt(cx: number, cy: number): number | null {
  const el = document.elementFromPoint(cx, cy)?.closest<HTMLElement>('[data-slot]');
  return el ? Number(el.dataset.slot) : null;
}

/** 禮物的大圖；沒有正式圖時用佔位色塊。silhouette = 還沒送過，只顯示剪影 */
function GiftArt({ gift, silhouette }: { gift: GiftDef; silhouette?: boolean }) {
  const url = ART_URLS[gift.icon];
  if (url) return <img class={`gift-art ${silhouette ? 'silhouette' : ''}`} src={url} alt="" draggable={false} />;
  const def = ASSET_MAP[gift.icon];
  const bg = silhouette ? '#3a2a20' : `#${(def?.color ?? 0x888888).toString(16).padStart(6, '0')}`;
  return <span class={`gift-art ph ${silhouette ? 'silhouette' : ''}`} style={{ background: bg }}>{silhouette ? '?' : def?.label.slice(0, 2)}</span>;
}

export function DecorPanel() {
  const game = useGame();
  const s = game.state;
  const open = decorSlots(s);
  const count = GIFTS.filter((g) => s.gifts[g.id]).length;

  /**
   * 按住禮物（圖鑑裡的或擺設位上的）開始拖曳：放到擺設位就擺上去（已經擺在別格的會互換，不會重複），
   * 從擺設位拖到外面就收起來。沒有移動就當成點一下。
   */
  const startDrag = (e: PointerEvent, id: string, from: number | null) => {
    if (e.button !== 0) return;
    const sx = e.clientX;
    const sy = e.clientY;
    let dragging = false;
    const move = (ev: PointerEvent) => {
      if (!dragging && Math.hypot(ev.clientX - sx, ev.clientY - sy) < 6) return;
      dragging = true;
      picked.value = null;
      dragGhost.value = { icon: GIFT_MAP[id].icon, ...toLocal(ev.clientX, ev.clientY) };
      const k = slotAt(ev.clientX, ev.clientY);
      hoverSlot.value = k !== null && k < decorSlots(game.state) ? k : null;
    };
    const end = (ev: PointerEvent, cancel: boolean) => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', onCancel);
      dragGhost.value = null;
      hoverSlot.value = null;
      if (cancel) return;
      if (!dragging) {
        // 點一下：圖鑑裡的禮物選起來（再點擺設位放上去）
        if (from === null) picked.value = picked.value === id ? null : id;
        return;
      }
      const k = slotAt(ev.clientX, ev.clientY);
      if (k !== null) {
        if (k < decorSlots(game.state)) game.setDecor(k, id);
      } else if (from !== null) {
        game.setDecor(from, null);
      }
    };
    const up = (ev: PointerEvent) => end(ev, false);
    const onCancel = (ev: PointerEvent) => end(ev, true);
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', onCancel);
  };

  const tapSlot = (k: number) => {
    if (!picked.value || k >= open) return;
    game.setDecor(k, picked.value);
    picked.value = null;
  };

  const buy = (g: GiftDef) => {
    if (game.giveGift(g.id)) showToast(`露米婭：${g.line}（+${g.happiness} ♥）`);
  };

  return (
    <div class="cards">
      <button class="btn back-btn" onClick={() => openDrawer('lumia', 'lumia-bond')}>◀ 回到露米婭</button>
      <div class="card" id="decor-slots">
        <div class="card-title"><Icon id="furn_slime_doll" /> 休息室擺設 <span class="lv">{open}/{DECOR.maxSlots} 格</span></div>
        <div class="decor-slots">
          {Array.from({ length: DECOR.maxSlots }, (_, k) => {
            const id = k < open ? s.decor[k] : null;
            const g = id && s.gifts[id] ? GIFT_MAP[id] : null;
            const cls = [
              'decor-slot', k >= open ? 'locked' : '', g ? 'filled' : '',
              hoverSlot.value === k ? 'hover' : '', picked.value && k < open ? 'target' : '',
            ].join(' ');
            return (
              <div class={cls} data-slot={k} key={k} onClick={() => tapSlot(k)}>
                {k >= open ? (
                  <span class="slot-lock">🔒<small>開心度兌換<br />「休息室擴建」</small></span>
                ) : g ? (
                  <>
                    <div class="slot-art" onPointerDown={(e) => startDrag(e as PointerEvent, g.id, k)}>
                      <GiftArt gift={g} />
                    </div>
                    <button class="slot-remove" aria-label="收起來" onClick={(e) => { e.stopPropagation(); game.setDecor(k, null); }}>✕</button>
                  </>
                ) : (
                  <span class="slot-empty">＋</span>
                )}
                <span class="slot-name">{SLOT_NAMES[k]}</span>
              </div>
            );
          })}
        </div>
        <p class="hint">
          把下面圖鑑裡的禮物<b>拖到格子裡</b>擺出來，擺出來才有效果（也可以先點禮物、再點格子）。
          拖到別的格子會互換，拖出格子或按 ✕ 就收起來。
        </p>
      </div>

      <div class="card" id="decor-book">
        <div class="card-title">🎁 禮物圖鑑 <span class="lv">{count}/{GIFTS.length}</span></div>
        <p class="hint">用金幣買禮物送露米婭，每種只能送一次、價格不會漲。送出時開心度增加，之後可以擺在休息室。</p>
        <div class="gift-book">
          {GIFTS.map((g, i) => {
            const owned = !!s.gifts[g.id];
            const shown = owned && s.decor.slice(0, open).includes(g.id);
            return (
              <div class={`gift-entry ${owned ? 'owned' : 'unknown'} ${picked.value === g.id ? 'picked' : ''}`} key={g.id}>
                <div class="gift-no">No.{String(i + 1).padStart(2, '0')}{shown && <span class="gift-shown">擺出中</span>}</div>
                <div
                  class="gift-frame"
                  onPointerDown={owned ? (e) => startDrag(e as PointerEvent, g.id, null) : undefined}
                >
                  <GiftArt gift={g} silhouette={!owned} />
                </div>
                <div class="gift-name">{owned ? g.name : '？？？'}</div>
                {owned ? (
                  <>
                    <div class="gift-fx">{g.desc}</div>
                    <div class="gift-intro">{g.intro}</div>
                  </>
                ) : (
                  <button class="buy-btn gift-buy" disabled={s.gold < g.price} onClick={() => buy(g)}>
                    <Icon id="icon_gold" size={1} /> {formatNumber(g.price)}
                    <span class="buy-count">+{g.happiness}♥</span>
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/** 拖曳中跟著指標的禮物圖（放在 #ui 最上層） */
export function DragGhost() {
  const g = dragGhost.value;
  if (!g) return null;
  const url = ART_URLS[g.icon];
  return (
    <div class="drag-ghost" style={{ left: `${g.x}px`, top: `${g.y}px` }}>
      {url ? <img src={url} alt="" /> : <Icon id={g.icon} size={3} />}
    </div>
  );
}

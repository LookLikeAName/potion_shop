import type { PurchaseKey } from '../game/commands';
import { formatNumber } from '../game/format';
import { buyMode, useGame } from './store';
import { Icon } from './Icon';

interface Props {
  k: PurchaseKey;
  title: string;
  desc?: string;
  /** 目前狀態，例如「Lv 3」 */
  status?: string;
  /** 已買滿時顯示的文字 */
  doneText?: string;
}

export function BuyButton({ k, title, desc, status, doneText = '已擁有' }: Props) {
  const game = useGame();
  const q = game.quote(k, buyMode.value);
  if (!q) return null;
  const done = q.count === 0;
  return (
    <div class="buy-row">
      <div class="buy-text">
        <div class="buy-title">
          {title} {status && <span class="buy-status">{status}</span>}
        </div>
        {desc && <div class="buy-desc">{desc}</div>}
      </div>
      <button
        class="buy-btn"
        disabled={done || !q.affordable}
        onClick={() => game.purchase(k, buyMode.value)}
      >
        {done ? doneText : (
          <>
            {q.count > 1 && <span class="buy-count">×{q.count}</span>}
            <Icon id="icon_gold" size={1} /> {formatNumber(q.cost)}
          </>
        )}
      </button>
    </div>
  );
}

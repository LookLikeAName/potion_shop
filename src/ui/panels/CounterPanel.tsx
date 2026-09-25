import { CUSTOMER } from '../../game/config/balance';
import { RECIPES } from '../../game/config/recipes';
import { GLOBAL_UPGRADES } from '../../game/config/upgrades';
import { formatNumber, formatSeconds } from '../../game/format';
import { arrivalRate, customerPatience, maxCustomerQty, sellPrice } from '../../game/stats';
import { BuyButton } from '../BuyButton';
import { Icon } from '../Icon';
import { useGame } from '../store';

export function CounterPanel() {
  const game = useGame();
  const s = game.state;
  return (
    <div class="cards">
      <div class="card">
        <div class="card-title">營業狀況</div>
        <div class="stats">
          <span>來客間隔 <b>{formatSeconds(CUSTOMER.interval / arrivalRate(s))}</b></span>
          <span>需求 {CUSTOMER.qtyMin}–{maxCustomerQty(s)} 瓶</span>
          <span>急單耐心 {formatSeconds(customerPatience(s))}</span>
          <span>急單獎勵 ×{CUSTOMER.rushBonus}</span>
        </div>
        <div class="stats">
          {s.cauldrons.map((c) => (
            <span key={c.recipe}>
              <Icon id={`potion_${c.recipe}`} size={1} /> {RECIPES[c.recipe].name} {formatNumber(sellPrice(s, c.recipe))} 金
            </span>
          ))}
        </div>
      </div>
      <div class="card">
        <div class="card-title">櫃台升級</div>
        {GLOBAL_UPGRADES.filter((u) => u.zone === 'counter').map((u) => (
          <BuyButton
            key={u.id} k={{ kind: 'global', id: u.id }} title={u.name} desc={u.desc}
            status={u.maxLevel === 1 ? undefined : `Lv ${s.upgrades[u.id] ?? 0}`}
          />
        ))}
      </div>
    </div>
  );
}

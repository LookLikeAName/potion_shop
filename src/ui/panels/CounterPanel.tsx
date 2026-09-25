import { CUSTOMER, UPGRADE_FX } from '../../game/config/balance';
import { MATERIAL_IDS, PLANTS } from '../../game/config/plants';
import { RECIPES } from '../../game/config/recipes';
import { formatNumber, formatSeconds } from '../../game/format';
import {
  arrivalRate, cratePct, customerPatience, has, materialReserve, maxCustomerQty, sellPrice,
} from '../../game/stats';
import { GlobalUpgrades } from '../GlobalUpgrades';
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
      {has(s, 'crate') && <ReserveCard />}
      <GlobalUpgrades zone="counter" title="櫃台升級" />
      <GlobalUpgrades zone="system" title="特殊合約" />
    </div>
  );
}

const STEPS = [-10, -1, 1, 10];

/** 收購箱：設定每種藥水要保留多少給顧客 */
function ReserveCard() {
  const game = useGame();
  const s = game.state;
  const reserve = s.settings.reserve;
  return (
    <div class="card" id="crate-reserve">
      <div class="card-title"><Icon id="upg_crate" /> 收購箱保留量</div>
      <p class="hint">
        每種藥水保留 <b>{reserve}</b> 瓶給顧客，超過的部分以售價 {Math.round(cratePct(s) * 100)}% 自動收購。
        顧客付全價，所以保留量太少會少賺急單與小費。
      </p>
      <div class="row stepper">
        {STEPS.slice(0, 2).map((d) => (
          <button key={d} class="btn" disabled={reserve <= 0} onClick={() => game.setReserve(reserve + d)}>{d}</button>
        ))}
        <span class="stepper-value">{reserve}</span>
        {STEPS.slice(2).map((d) => (
          <button key={d} class="btn" disabled={reserve >= UPGRADE_FX.reserveMax} onClick={() => game.setReserve(reserve + d)}>
            +{d}
          </button>
        ))}
      </div>

      <label class="toggle">
        <input
          type="checkbox" checked={s.settings.sellMaterials}
          onChange={(e) => game.setSellMaterials(e.currentTarget.checked)}
        />
        也收購多餘的原料
      </label>
      <p class="hint">
        自動保留足夠所有大釜熬 {UPGRADE_FX.materialReserveRounds} 輪的原料，其餘低價收購（熬成藥水賣會划算得多）。
      </p>
      {s.settings.sellMaterials && (
        <div class="stats">
          {MATERIAL_IDS.filter((m) => s.slots.some((sl) => sl.plant === m) || s.materials[m] >= 1).map((m) => (
            <span key={m}>
              <Icon id={`item_${m}`} size={1} /> 保留 {formatNumber(materialReserve(s, m))}，
              每份 {formatNumber2(PLANTS[m].sellValue * cratePct(s))} 金
            </span>
          ))}
        </div>
      )}

      <div class="stats">
        <span>已收購 {formatNumber(s.stats.potionsWholesaled)} 瓶</span>
        <span>原料 {formatNumber(s.stats.materialsWholesaled)} 份</span>
        <span>收購所得 {formatNumber(s.stats.wholesaleGold)} 金</span>
      </div>
    </div>
  );
}

/** 小於 10 的金額顯示兩位小數 */
const formatNumber2 = (n: number) => (n < 10 ? n.toFixed(2) : formatNumber(n));

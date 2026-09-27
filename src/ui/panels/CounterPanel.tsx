import { CUSTOMER, UPGRADE_FX } from '../../game/config/balance';
import { MATERIAL_IDS, PLANTS, type MaterialId } from '../../game/config/plants';
import { RECIPES, type PotionId } from '../../game/config/recipes';
import { formatNumber, formatSeconds } from '../../game/format';
import { CRATE_FOR, CRATE_MATERIALS } from '../../game/config/upgrades';
import { crateSetting } from '../../game/commands';
import {
  arrivalRate, checkoutTime, cratePct, customerPatience, customerShare, has, hasAnyCrate, hasAutoCheckout,
  materialPerRound, customerDemand, materialDemand,
  fullShopDemand, materialReserve, maxCustomerQty, orderScale, potionReserve, sellPrice,
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
          <span>
            結帳 <b>{hasAutoCheckout(s) ? `${formatSeconds(checkoutTime(s))}／位` : '要親手點客人'}</b>
          </span>
          <span>店裡最多 {CUSTOMER.queueMax} 位</span>
          <MarketHeat />
          <span>急單耐心 {formatSeconds(customerPatience(s))}</span>
          <span>急單獎勵 ×{CUSTOMER.rushBonus}</span>
        </div>
        <p class="hint">
          客人一次一位走到櫃台結帳（走路時間固定）。備好貨的客人頭上會出現金幣，<b>點他</b>就會在走到櫃台的同時完成訂單；
          買了算盤松鼠後會自動結帳，升級縮短結帳時間，滿級時走到櫃台就完成。
          客人會買走每種藥水產量的 <b>{Math.round(customerShare(s) * 100)}%</b>（櫃台越快、海報越多比例越高，最高
          {Math.round(CUSTOMER.shareMax * 100)}%），訂單量跟著實際產量走，其餘交給收購箱。整張湊齊才全價成交；
          耐心用完還湊不齊，會買走現有的部分，價格 ×{CUSTOMER.partialPriceMult * 100}%。
        </p>
        <div class="stats">
          {s.cauldrons.map((c) => (
            <span key={c.recipe}>
              <Icon id={`potion_${c.recipe}`} size={1} /> {RECIPES[c.recipe].name} {formatNumber(sellPrice(s, c.recipe))} 金，
              每人 {formatNumber(CUSTOMER.qtyMin * orderScale(s, c.recipe))}–{formatNumber(maxCustomerQty(s) * orderScale(s, c.recipe))} 瓶
            </span>
          ))}
        </div>
      </div>
      {hasAnyCrate(s) && <CrateCard />}
      <GlobalUpgrades zone="counter" title="櫃台升級" />
      <GlobalUpgrades zone="system" title="特殊合約" />
    </div>
  );
}

/** 市場熱度：客人訂單量的倍率，箭頭表示正在變熱或變冷 */
export function MarketHeat() {
  const game = useGame();
  const m = game.state.market;
  const arrow = m.target > m.value + 0.02 ? '▲' : m.target < m.value - 0.02 ? '▼' : '';
  const tone = m.value >= 1.15 ? 'hot' : m.value <= 0.85 ? 'cold' : '';
  return (
    <span class={`market ${tone}`} title="市場熱度：客人訂單量的倍率，每隔一陣子會變。熱的時候需求超過產量，有囤貨才賣得完；冷的時候產量有剩。">
      市場熱度 <b>×{m.value.toFixed(2)}</b>{arrow}
    </span>
  );
}

/**
 * 收購箱設定：藥水和原料用同一套邏輯——每種都有「要不要賣」開關，以及保留幾秒份。
 * 藥水 = 顧客幾秒的需求量；原料 = 所有大釜全速熬煮幾秒的用量。
 */
function CrateCard() {
  const game = useGame();
  const s = game.state;
  const potionCrates = s.cauldrons.map((c) => c.recipe).filter((p) => has(s, CRATE_FOR[p]));
  const matPct = cratePct(s, CRATE_MATERIALS);
  return (
    <div class="card" id="crate-reserve">
      <div class="card-title"><Icon id="upg_crate" /> 收購箱設定</div>
      <p class="hint">
        每種藥水和原料都可以決定<b>要不要賣給收購箱</b>，以及<b>保留幾秒份</b>（超過的才收購；0 秒 = 全部收購）。
        藥水保留「顧客幾秒的需求量」：先留給付全價的客人，市場熱度高時需求會超過產量，有囤貨才湊得齊；
        原料保留「所有大釜全速熬煮幾秒的用量」：極速沸騰、升級大釜時用量會突然變大，留一點才不會斷料。
        收購價很低，能賣給客人、能熬成藥水都比較划算。
      </p>

      {potionCrates.map((p) => (
        <CrateRow
          key={p} item={p} icon={`potion_${p}`} name={RECIPES[p].name}
          price={`收購價 ${Math.round(cratePct(s, CRATE_FOR[p]) * 100)}%`}
          keep={`保留 ${formatNumber(potionReserve(s, p))} 瓶`}
          base={`顧客需求約 ${formatNumber(customerDemand(s, p))}/秒（至少留店裡站滿時的 ${formatNumber(fullShopDemand(s, p))} 瓶）`}
        />
      ))}

      {matPct > 0 && MATERIAL_IDS.filter((m) => shownMaterial(s, m)).map((m) => {
        const use = materialDemand(s, m);
        return (
          <CrateRow
            key={m} item={m} icon={`item_${m}`} name={PLANTS[m].name}
            price={`每份 ${formatNumber2(PLANTS[m].sellValue * matPct)} 金`}
            keep={`保留 ${formatNumber(materialReserve(s, m))} 份`}
            base={use > 0
              ? `大釜全速用 ${formatNumber(use)}/秒（至少留 1 輪的量）`
              : materialPerRound(s, m) > 0 ? '大釜還沒有火蜥蜴：至少留 1 輪的量' : '目前沒有大釜用到它'}
          />
        );
      })}

      <div class="stats">
        <span>已收購 {formatNumber(s.stats.potionsWholesaled)} 瓶</span>
        <span>原料 {formatNumber(s.stats.materialsWholesaled)} 份</span>
        <span>收購所得 {formatNumber(s.stats.wholesaleGold)} 金</span>
      </div>
    </div>
  );
}

/** 有種、有庫存或大釜會用到的原料才列出來 */
function shownMaterial(s: ReturnType<typeof useGame>['state'], m: MaterialId): boolean {
  return s.slots.some((sl) => sl.plant === m) || s.materials[m] >= 1 || materialPerRound(s, m) > 0;
}

const [SMALL, BIG] = UPGRADE_FX.keepStepSec;
const SEC_STEPS = [-BIG, -SMALL, SMALL, BIG];

/** 保留秒數：30 秒、2 分、1 分 30 秒 */
function fmtKeep(sec: number): string {
  if (sec < 60) return `${sec} 秒`;
  const m = Math.floor(sec / 60);
  const r = sec % 60;
  return r ? `${m} 分 ${r} 秒` : `${m} 分`;
}

/** 開關按鈕（賣／不賣） */
export function Switch({ on, onChange, label }: { on: boolean; onChange: (on: boolean) => void; label: [string, string] }) {
  return (
    <button type="button" role="switch" aria-checked={on} class={`switch ${on ? 'on' : ''}`} onClick={() => onChange(!on)}>
      <span class="switch-track"><span class="switch-knob" /></span>
      <span class="switch-label">{on ? label[0] : label[1]}</span>
    </button>
  );
}

/**
 * 一種藥水或原料的收購設定：要不要賣（開關）+ 保留幾秒份。
 * 保留量不賣的時候也一直顯示、可以調整，先調好再打開賣出
 */
function CrateRow(props: {
  item: PotionId | MaterialId; icon: string; name: string; price: string; keep: string; base: string;
}) {
  const game = useGame();
  const set = crateSetting(game.state, props.item);
  return (
    <div class={`mat-row crate-row ${set.sell ? '' : 'off'}`}>
      <div class="crate-head">
        <Icon id={props.icon} /> <b>{props.name}</b>
        <span class="crate-price">{props.price}</span>
        <Switch on={set.sell} onChange={(on) => game.setCrateSell(props.item, on)} label={['收購中', '不賣']} />
      </div>
      <div class="row stepper">
        <span class="stepper-label">保留</span>
        {SEC_STEPS.slice(0, 2).map((d) => (
          <button key={d} class="btn" disabled={set.keepSec <= 0} onClick={() => game.setCrateKeep(props.item, set.keepSec + d)}>
            {d}s
          </button>
        ))}
        <span class="stepper-value" title="保留幾秒份">{fmtKeep(set.keepSec)}</span>
        {SEC_STEPS.slice(2).map((d) => (
          <button
            key={d} class="btn" disabled={set.keepSec >= UPGRADE_FX.keepMaxSec}
            onClick={() => game.setCrateKeep(props.item, set.keepSec + d)}
          >
            +{d}s
          </button>
        ))}
      </div>
      <div class="stats">
        <span><b>{props.keep}</b></span>
        <span>{props.base}</span>
      </div>
    </div>
  );
}

/** 小於 10 的金額顯示兩位小數 */
const formatNumber2 = (n: number) => (n < 10 ? n.toFixed(2) : formatNumber(n));

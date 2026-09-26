import { useRef, useState } from 'preact/hooks';
import { CUSTOMER, UPGRADE_FX } from '../../game/config/balance';
import { MATERIAL_IDS, PLANTS, type MaterialId } from '../../game/config/plants';
import { RECIPES, type PotionId } from '../../game/config/recipes';
import { formatNumber, formatSeconds, parseAmount } from '../../game/format';
import { CRATE_FOR, CRATE_MATERIALS } from '../../game/config/upgrades';
import {
  arrivalRate, cratePct, customerPatience, has, hasAnyCrate, materialPerRound, materialReserve, maxCustomerQty,
  sellPrice,
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
        <p class="hint">
          解鎖多種配方後，顧客的訂單可能包含好幾種藥水（氣泡中綠色 = 庫存夠、紅色 = 還缺）。
          整張湊齊才全價成交；耐心用完還湊不齊，顧客會買走現有的部分，價格 ×{CUSTOMER.partialPriceMult * 100}%。
        </p>
        <div class="stats">
          {s.cauldrons.map((c) => (
            <span key={c.recipe}>
              <Icon id={`potion_${c.recipe}`} size={1} /> {RECIPES[c.recipe].name} {formatNumber(sellPrice(s, c.recipe))} 金
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

/** 保留量按鈕的單位：一次加減 1、100 或 1K */
const UNITS = [1, 100, 1000] as const;
type Unit = (typeof UNITS)[number];

/** 按鈕上的加減量文字：+100、−1K… */
const stepLabel = (d: number) => `${d < 0 ? '−' : '+'}${formatNumber(Math.abs(d))}`;

/** 收購箱設定：每種藥水各自的保留量；每種原料各自的開關與保留百分比 */
function CrateCard() {
  const game = useGame();
  const s = game.state;
  const [unit, setUnit] = useState<Unit>(1);
  const potionCrates = s.cauldrons.map((c) => c.recipe).filter((p) => has(s, CRATE_FOR[p]));
  const matPct = cratePct(s, CRATE_MATERIALS);
  return (
    <div class="card" id="crate-reserve">
      <div class="card-title"><Icon id="upg_crate" /> 收購箱設定</div>

      {potionCrates.length > 0 && (
        <>
          <p class="hint">
            每種藥水保留設定的數量給顧客，超過的部分自動收購。顧客付全價，所以保留量太少會少賺急單與小費。
            數字可以直接輸入（例如 500、2K、1.5M）。
          </p>
          <div class="modes unit-modes">
            每次加減
            {UNITS.map((u) => (
              <button key={u} class={`mode ${unit === u ? 'active' : ''}`} onClick={() => setUnit(u)}>
                {formatNumber(u)}
              </button>
            ))}
          </div>
        </>
      )}

      {potionCrates.map((p) => (
        <PotionReserveRow key={p} potion={p} unit={unit} />
      ))}

      {matPct > 0 && (
        <div class="crate-row">
          <div class="crate-name">
            <Icon id="item_redheart" /> 原料收購
            <span class="buy-status">收購價 {Math.round(matPct * 100)}%</span>
          </div>
          <p class="hint">
            每種原料可以各自決定要不要賣，以及保留多少：100% = 所有大釜以目前等級熬 1 輪的量
            （設定保留時至少留 {UPGRADE_FX.materialReserveMin} 份；0% = 全部賣掉）。
            原料收購價很低，熬成藥水賣會划算得多。
          </p>
          {MATERIAL_IDS.filter((m) => shownMaterial(s, m)).map((m) => (
            <MaterialRow key={m} m={m} />
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

/** 有種、有庫存或大釜會用到的原料才列出來 */
function shownMaterial(s: ReturnType<typeof useGame>['state'], m: MaterialId): boolean {
  return s.slots.some((sl) => sl.plant === m) || s.materials[m] >= 1 || materialPerRound(s, m) > 0;
}

function PotionReserveRow({ potion: p, unit }: { potion: PotionId; unit: Unit }) {
  const game = useGame();
  const s = game.state;
  const reserve = s.settings.reserves[p];
  return (
    <div class="crate-row">
      <div class="crate-name">
        <Icon id={`potion_${p}`} /> {RECIPES[p].name}
        <span class="buy-status">收購價 {Math.round(cratePct(s, CRATE_FOR[p]) * 100)}%</span>
      </div>
      <div class="row stepper">
        {[-10 * unit, -unit].map((d) => (
          <button key={d} class="btn" disabled={reserve <= 0} onClick={() => game.setReserve(p, reserve + d)}>
            {stepLabel(d)}
          </button>
        ))}
        <AmountInput value={reserve} onCommit={(n) => game.setReserve(p, n)} title="保留量" />
        {[unit, 10 * unit].map((d) => (
          <button
            key={d} class="btn" disabled={reserve >= UPGRADE_FX.reserveMax} onClick={() => game.setReserve(p, reserve + d)}
          >
            {stepLabel(d)}
          </button>
        ))}
      </div>
    </div>
  );
}

const PCT_STEPS = [-100, -10, 10, 100];

function MaterialRow({ m }: { m: MaterialId }) {
  const game = useGame();
  const s = game.state;
  const set = s.settings.materials[m];
  const perRound = materialPerRound(s, m);
  const price = PLANTS[m].sellValue * cratePct(s, CRATE_MATERIALS);
  return (
    <div class="mat-row">
      <label class="toggle">
        <input type="checkbox" checked={set.sell} onChange={(e) => game.setMaterialSell(m, e.currentTarget.checked)} />
        <Icon id={`item_${m}`} /> {PLANTS[m].name}
        <span class="buy-status">{set.sell ? `每份 ${formatNumber2(price)} 金` : '不賣'}</span>
      </label>
      {set.sell && (
        <>
          <div class="row stepper">
            {PCT_STEPS.slice(0, 2).map((d) => (
              <button key={d} class="btn" disabled={set.keepPct <= 0} onClick={() => game.setMaterialKeep(m, set.keepPct + d)}>
                {d}%
              </button>
            ))}
            <span class="stepper-value" title="保留百分比">{set.keepPct}%</span>
            {PCT_STEPS.slice(2).map((d) => (
              <button
                key={d} class="btn" disabled={set.keepPct >= UPGRADE_FX.materialKeepMax}
                onClick={() => game.setMaterialKeep(m, set.keepPct + d)}
              >
                +{d}%
              </button>
            ))}
          </div>
          <div class="stats">
            <span>保留 <b>{formatNumber(materialReserve(s, m))}</b> 份</span>
            <span>{perRound > 0 ? `大釜 1 輪用 ${formatNumber(perRound)} 份` : '目前沒有大釜用到它'}</span>
          </div>
        </>
      )}
    </div>
  );
}

/** 可以直接輸入的數量（支援 K、M），按 Enter 或離開欄位時生效 */
function AmountInput({ value, onCommit, title }: { value: number; onCommit: (n: number) => void; title: string }) {
  const [draft, setDraft] = useState<string | null>(null);
  const cancelled = useRef(false);
  const commit = () => {
    const n = draft === null || cancelled.current ? null : parseAmount(draft);
    if (n !== null) onCommit(n);
    cancelled.current = false;
    setDraft(null);
  };
  return (
    <input
      class="stepper-value amount-input" title={title} inputMode="decimal"
      value={draft ?? formatNumber(value)}
      onFocus={(e) => {
        setDraft(String(value));
        requestAnimationFrame(() => e.currentTarget?.select());
      }}
      onInput={(e) => setDraft(e.currentTarget.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') e.currentTarget.blur();
        else if (e.key === 'Escape') {
          cancelled.current = true;
          e.currentTarget.blur();
        }
      }}
    />
  );
}

/** 小於 10 的金額顯示兩位小數 */
const formatNumber2 = (n: number) => (n < 10 ? n.toFixed(2) : formatNumber(n));

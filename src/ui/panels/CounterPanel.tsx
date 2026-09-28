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
import { t, tx } from '../../i18n';
import { GlobalUpgrades } from '../GlobalUpgrades';
import { Icon } from '../Icon';
import { useGame } from '../store';

export function CounterPanel() {
  const game = useGame();
  const s = game.state;
  return (
    <div class="cards">
      <div class="card">
        <div class="card-title">{t('counter.status')}</div>
        <div class="stats">
          <span>{tx('counter.arrival', { v: <b>{formatSeconds(CUSTOMER.interval / arrivalRate(s))}</b> })}</span>
          <span>
            {tx('counter.checkout', {
              v: <b>{hasAutoCheckout(s) ? t('counter.checkoutEach', { t: formatSeconds(checkoutTime(s)) }) : t('counter.checkoutManual')}</b>,
            })}
          </span>
          <span>{t('counter.queueMax', { n: CUSTOMER.queueMax })}</span>
          <MarketHeat />
          <span>{t('counter.rushPatience', { t: formatSeconds(customerPatience(s)) })}</span>
          <span>{t('counter.rushBonus', { x: CUSTOMER.rushBonus })}</span>
        </div>
        <p class="hint">
          {tx(
            'counter.intro',
            { tap: <b>{t('counter.tapHim')}</b>, share: <b>{Math.round(customerShare(s) * 100)}%</b> },
            { max: Math.round(CUSTOMER.shareMax * 100), partial: CUSTOMER.partialPriceMult * 100 },
          )}
        </p>
        <div class="stats">
          {s.cauldrons.map((c) => (
            <span key={c.recipe}>
              <Icon id={`potion_${c.recipe}`} size={1} /> {t('counter.potionLine', {
                name: RECIPES[c.recipe].name, price: formatNumber(sellPrice(s, c.recipe)),
                min: formatNumber(CUSTOMER.qtyMin * orderScale(s, c.recipe)), max: formatNumber(maxCustomerQty(s) * orderScale(s, c.recipe)),
              })}
            </span>
          ))}
        </div>
      </div>
      {hasAnyCrate(s) && <CrateCard />}
      <GlobalUpgrades zone="counter" title={t('counter.upgrades')} />
      <GlobalUpgrades zone="system" title={t('counter.contracts')} />
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
    <span class={`market ${tone}`} title={t('counter.marketTip')}>
      {tx('counter.market', { v: <b>×{m.value.toFixed(2)}</b> })}{arrow}
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
      <div class="card-title"><Icon id="upg_crate" /> {t('crate.title')}</div>
      <p class="hint">
        {tx('crate.intro', { sell: <b>{t('crate.introSell')}</b>, keep: <b>{t('crate.introKeep')}</b> })}
      </p>

      {potionCrates.map((p) => (
        <CrateRow
          key={p} item={p} icon={`potion_${p}`} name={RECIPES[p].name}
          price={t('crate.price', { pct: Math.round(cratePct(s, CRATE_FOR[p]) * 100) })}
          keep={t('crate.keepPotion', { n: formatNumber(potionReserve(s, p)) })}
          base={t('crate.basePotion', { n: formatNumber(customerDemand(s, p)), full: formatNumber(fullShopDemand(s, p)) })}
        />
      ))}

      {matPct > 0 && MATERIAL_IDS.filter((m) => shownMaterial(s, m)).map((m) => {
        const use = materialDemand(s, m);
        return (
          <CrateRow
            key={m} item={m} icon={`item_${m}`} name={PLANTS[m].name}
            price={t('crate.priceMat', { n: formatNumber2(PLANTS[m].sellValue * matPct) })}
            keep={t('crate.keepMat', { n: formatNumber(materialReserve(s, m)) })}
            base={use > 0
              ? t('crate.baseMat', { n: formatNumber(use) })
              : t(materialPerRound(s, m) > 0 ? 'crate.baseNoSalamander' : 'crate.baseUnused')}
          />
        );
      })}

      <div class="stats">
        <span>{t('crate.statPotions', { n: formatNumber(s.stats.potionsWholesaled) })}</span>
        <span>{t('crate.statMaterials', { n: formatNumber(s.stats.materialsWholesaled) })}</span>
        <span>{t('crate.statGold', { n: formatNumber(s.stats.wholesaleGold) })}</span>
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
  if (sec < 60) return t('format.seconds', { s: sec });
  const m = Math.floor(sec / 60);
  const r = sec % 60;
  return r ? t('format.minutes', { m, s: r }) : t('format.minutesOnly', { m });
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
        <Switch on={set.sell} onChange={(on) => game.setCrateSell(props.item, on)} label={[t('crate.on'), t('crate.off')]} />
      </div>
      <div class="row stepper">
        <span class="stepper-label">{t('crate.keep')}</span>
        {SEC_STEPS.slice(0, 2).map((d) => (
          <button key={d} class="btn" disabled={set.keepSec <= 0} onClick={() => game.setCrateKeep(props.item, set.keepSec + d)}>
            {d}s
          </button>
        ))}
        <span class="stepper-value" title={t('crate.keepTip')}>{fmtKeep(set.keepSec)}</span>
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

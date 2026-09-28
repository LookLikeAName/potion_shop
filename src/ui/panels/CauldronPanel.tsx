import { UPGRADE_FX } from '../../game/config/balance';
import type { MaterialId } from '../../game/config/plants';
import { PLANTS } from '../../game/config/plants';
import { RECIPES, type RecipeDef } from '../../game/config/recipes';
import { GLOBAL_UPGRADE_MAP, REFINE_FOR, TARGET_UPGRADES, maxLevelOf } from '../../game/config/upgrades';
import { nextLockedRecipes } from '../../game/commands';
import { formatCycle, formatNumber, formatRate } from '../../game/format';
import type { CauldronState } from '../../game/state';
import {
  brewPassiveSpeed, cauldronOutputPerSec, milestoneMult, nextMilestone, recipeInputs, refineLevel, refinePriceMult,
  sellPrice,
} from '../../game/stats';
import { t, tx } from '../../i18n';
import { BuyButton } from '../BuyButton';
import { GlobalUpgrades } from '../GlobalUpgrades';
import { Glyph } from '../Glyph';
import { Icon } from '../Icon';
import { useGame } from '../store';

/** 每份藥水的原料（已解鎖的配方會套用精煉後的需求） */
function Inputs({ r, inputs }: { r: RecipeDef; inputs?: [MaterialId, number][] }) {
  return (
    <span class="inputs">
      {(inputs ?? (Object.entries(r.inputs) as [MaterialId, number][])).map(([m, n]) => (
        <span key={m}><Icon id={`item_${m}`} size={1} />{t('cauldron.input', { name: PLANTS[m].name, n: formatAmount(n) })}</span>
      ))}
    </span>
  );
}

/** 原料份數：整數照常，精煉後的小數留一位 */
const formatAmount = (n: number) => (Number.isInteger(n) ? formatNumber(n) : n.toFixed(1));

export function CauldronPanel() {
  const game = useGame();
  const s = game.state;
  return (
    <div class="cards">
      <p class="hint">
        {t('cauldron.intro')}<br />
        {tx('cauldron.order', { left: <b>{t('cauldron.leftFirst')}</b>, drag: <b>{t('cauldron.dragHow')}</b> })}
      </p>
      <GlobalUpgrades zone="cauldron" title={t('cauldron.tools')} />
      {s.cauldrons.map((c) => <CauldronCard key={c.recipe} c={c} />)}
      {nextLockedRecipes(s).map((p) => {
        const r = RECIPES[p];
        return (
          <div class="card locked" id={`recipe-${p}`} key={p}>
            <div class="card-title"><Icon id={`potion_${p}`} /> <Glyph id="icon_lock" text="🔒" size={1.1} /> {r.name}</div>
            <div class="stats">
              <Inputs r={r} />
              <span>{t('cauldron.brewTime', { n: r.brewTime })}</span>
              <span>{t('cauldron.price', { n: r.basePrice })}</span>
            </div>
            <div class="buy-row">
              <div class="buy-text"><div class="buy-title">{t('cauldron.unlock')}</div></div>
              <button class="buy-btn" disabled={s.gold < r.unlockCost} onClick={() => game.unlockRecipe(p)}>
                <Icon id="icon_gold" size={1} /> {formatNumber(r.unlockCost)}
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function CauldronCard({ c }: { c: CauldronState }) {
  const game = useGame();
  const s = game.state;
  const r = RECIPES[c.recipe];
  const passive = brewPassiveSpeed(s, c);
  const next = nextMilestone(c.level);
  const refine = refineLevel(s, c.recipe);
  const refineId = REFINE_FOR[c.recipe];
  const refineMax = maxLevelOf(GLOBAL_UPGRADE_MAP[refineId]);
  // 原料足夠時每秒熬出幾瓶，以及再升一級會多多少
  const perSec = cauldronOutputPerSec(s, c);
  const gainLevel = cauldronOutputPerSec(s, { ...c, level: c.level + 1 }) - perSec;
  const gainSal = cauldronOutputPerSec(s, { ...c, salamander: c.salamander + 1 }) - perSec;
  const nextText = (gain: number) => (gain > 0 ? t('cauldron.nextLevel', { n: formatRate(gain) }) : '');
  return (
    <div class="card" id={`recipe-${c.recipe}`}>
      <div class="card-title">
        <Icon id={`potion_${c.recipe}`} /> {r.name}
        {refine > 0 && <span class="refine-stars" title={t('cauldron.refineLv', { n: refine })}>{Array.from({ length: refine }, (_, k) => <Glyph key={k} id="icon_star" text="★" size={0.9} />)}</span>}
        <span class="lv">Lv {c.level}</span>
      </div>
      <div class="stats">
        <Inputs r={r} inputs={recipeInputs(s, c.recipe)} />
        <span>{tx('cauldron.batch', { n: <b>{c.level}</b> })}</span>
        <span>{tx('cauldron.passive', { t: <b>{passive > 0 ? formatCycle(r.brewTime / passive) : t('format.none')}</b> })}</span>
        {passive > 0 && <span>{tx('cauldron.perSec', { n: <b>{formatRate(perSec)}</b> })}</span>}
        <span>{t('cauldron.price', { n: formatNumber(sellPrice(s, c.recipe)) })}</span>
        {next && <span>{t('green.milestone', { lv: next, x: milestoneMult(next) / milestoneMult(c.level) })}</span>}
      </div>
      <BuyButton
        k={{ kind: 'cauldronLevel', recipe: c.recipe }} title={t('cauldron.upgrade')} desc={t('cauldron.upgradeDesc') + nextText(gainLevel)}
      />
      <BuyButton
        k={{ kind: 'salamander', recipe: c.recipe }} title={TARGET_UPGRADES.salamander.name} icon="upg_salamander" status={`Lv ${c.salamander}`}
        desc={t('cauldron.salamanderDesc') + nextText(gainSal)}
      />
      <BuyButton
        k={{ kind: 'global', id: refineId }} title={t('cauldron.refine')} icon="upg_refine"
        status={Number.isFinite(refineMax) ? t('cauldron.refineOf', { n: refine, max: refineMax }) : t('cauldron.refineLv', { n: refine })}
        desc={t('cauldron.refineDesc', {
          input: UPGRADE_FX.refineInputPerLevel * 100, price: UPGRADE_FX.refinePricePerLevel * 100,
          inputX: formatAmount(1 + UPGRADE_FX.refineInputPerLevel * refine), priceX: formatAmount(refinePriceMult(s, c.recipe)),
        })}
        doneText={t('cauldron.refineMax')}
      />
    </div>
  );
}

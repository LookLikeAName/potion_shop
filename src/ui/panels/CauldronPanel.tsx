import { UPGRADE_FX } from '../../game/config/balance';
import type { MaterialId } from '../../game/config/plants';
import { PLANTS } from '../../game/config/plants';
import { RECIPES, type RecipeDef } from '../../game/config/recipes';
import { GLOBAL_UPGRADE_MAP, REFINE_FOR, maxLevelOf } from '../../game/config/upgrades';
import { nextLockedRecipes } from '../../game/commands';
import { formatCycle, formatNumber, formatRate } from '../../game/format';
import type { CauldronState } from '../../game/state';
import {
  brewPassiveSpeed, cauldronOutputPerSec, milestoneMult, nextMilestone, recipeInputs, refineLevel, refinePriceMult,
  sellPrice,
} from '../../game/stats';
import { BuyButton } from '../BuyButton';
import { GlobalUpgrades } from '../GlobalUpgrades';
import { Icon } from '../Icon';
import { useGame } from '../store';

/** 每份藥水的原料（已解鎖的配方會套用精煉後的需求） */
function Inputs({ r, inputs }: { r: RecipeDef; inputs?: [MaterialId, number][] }) {
  return (
    <span class="inputs">
      {(inputs ?? (Object.entries(r.inputs) as [MaterialId, number][])).map(([m, n]) => (
        <span key={m}><Icon id={`item_${m}`} size={1} />{PLANTS[m].name} ×{formatAmount(n)}</span>
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
        點擊大釜可攪拌加速。沒有火蜥蜴時，大釜只能靠點擊熬煮。<br />
        共用原料時，<b>最左邊的大釜優先</b>。在場景中<b>長按大釜再左右拖曳</b>可以調整順序。
      </p>
      <GlobalUpgrades zone="cauldron" title="工坊設備" />
      {s.cauldrons.map((c) => <CauldronCard key={c.recipe} c={c} />)}
      {nextLockedRecipes(s).map((p) => {
        const r = RECIPES[p];
        return (
          <div class="card locked" id={`recipe-${p}`} key={p}>
            <div class="card-title"><Icon id={`potion_${p}`} /> 🔒 {r.name}</div>
            <div class="stats">
              <Inputs r={r} />
              <span>熬煮 {r.brewTime} 秒</span>
              <span>售價 {r.basePrice} 金</span>
            </div>
            <div class="buy-row">
              <div class="buy-text"><div class="buy-title">解鎖配方與大釜</div></div>
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
  const nextText = (gain: number) => (gain > 0 ? `（下一級：每秒 +${formatRate(gain)} 瓶）` : '');
  return (
    <div class="card" id={`recipe-${c.recipe}`}>
      <div class="card-title">
        <Icon id={`potion_${c.recipe}`} /> {r.name}
        {refine > 0 && <span class="refine-stars" title={`精煉 ${refine} 級`}>{'★'.repeat(refine)}</span>}
        <span class="lv">Lv {c.level}</span>
      </div>
      <div class="stats">
        <Inputs r={r} inputs={recipeInputs(s, c.recipe)} />
        <span>一次最多熬 <b>{c.level}</b> 份</span>
        <span>被動熬煮 <b>{passive > 0 ? formatCycle(r.brewTime / passive) : '無'}</b></span>
        {passive > 0 && <span>原料足夠時每秒約 <b>{formatRate(perSec)}</b> 瓶</span>}
        <span>售價 {formatNumber(sellPrice(s, c.recipe))} 金</span>
        {next && <span>Lv {next} 時速度 ×{milestoneMult(next) / milestoneMult(c.level)}</span>}
      </div>
      <BuyButton
        k={{ kind: 'cauldronLevel', recipe: c.recipe }} title="升級大釜" desc={`每級批量 +1${nextText(gainLevel)}`}
      />
      <BuyButton
        k={{ kind: 'salamander', recipe: c.recipe }} title="鍋底火蜥蜴" icon="upg_salamander" status={`Lv ${c.salamander}`}
        desc={`Lv1 讓大釜自己熬煮（基礎速度 50%），之後每級 +25%${nextText(gainSal)}`}
      />
      <BuyButton
        k={{ kind: 'global', id: refineId }} title="配方精煉" icon="upg_refine"
        status={Number.isFinite(refineMax) ? `${refine}/${refineMax} 級` : `${refine} 級`}
        desc={`每級每份原料 +${UPGRADE_FX.refineInputPerLevel * 100}%、售價 +${UPGRADE_FX.refinePricePerLevel * 100}%（永久套用）。目前原料 ×${formatAmount(1 + UPGRADE_FX.refineInputPerLevel * refine)}、售價 ×${formatAmount(refinePriceMult(s, c.recipe))}`}
        doneText="已精煉到最高"
      />
    </div>
  );
}

import type { MaterialId } from '../../game/config/plants';
import { PLANTS } from '../../game/config/plants';
import { RECIPES, type RecipeDef } from '../../game/config/recipes';
import { nextLockedRecipes } from '../../game/commands';
import { formatNumber, formatSeconds } from '../../game/format';
import type { CauldronState } from '../../game/state';
import { brewPassiveSpeed, milestoneMult, nextMilestone, sellPrice } from '../../game/stats';
import { BuyButton } from '../BuyButton';
import { Icon } from '../Icon';
import { useGame } from '../store';

function Inputs({ r }: { r: RecipeDef }) {
  return (
    <span class="inputs">
      {(Object.entries(r.inputs) as [MaterialId, number][]).map(([m, n]) => (
        <span key={m}><Icon id={`item_${m}`} size={1} />{PLANTS[m].name} ×{n}</span>
      ))}
    </span>
  );
}

export function CauldronPanel() {
  const game = useGame();
  const s = game.state;
  return (
    <div class="cards">
      <p class="hint">
        點擊大釜可攪拌加速。沒有火蜥蜴時，大釜只能靠點擊熬煮。<br />
        共用原料時，<b>最左邊的大釜優先</b>（拖曳換位置將在後續版本開放）。
      </p>
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
  return (
    <div class="card" id={`recipe-${c.recipe}`}>
      <div class="card-title">
        <Icon id={`potion_${c.recipe}`} /> {r.name} <span class="lv">Lv {c.level}</span>
      </div>
      <div class="stats">
        <Inputs r={r} />
        <span>一次最多熬 <b>{c.level}</b> 份</span>
        <span>被動熬煮 <b>{passive > 0 ? formatSeconds(r.brewTime / passive) : '無'}</b></span>
        <span>售價 {formatNumber(sellPrice(s, c.recipe))} 金</span>
        {next && <span>Lv {next} 時速度 ×{milestoneMult(next) / milestoneMult(c.level)}</span>}
      </div>
      <BuyButton k={{ kind: 'cauldronLevel', recipe: c.recipe }} title="升級大釜" desc="每級批量 +1" />
      <BuyButton
        k={{ kind: 'salamander', recipe: c.recipe }} title="鍋底火蜥蜴" status={`Lv ${c.salamander}`}
        desc="Lv1 讓大釜自己熬煮（基礎速度 50%），之後每級 +25%"
      />
    </div>
  );
}

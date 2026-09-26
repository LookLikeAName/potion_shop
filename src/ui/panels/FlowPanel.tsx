import { MATERIAL_IDS, PLANTS, type MaterialId } from '../../game/config/plants';
import { RECIPES, type PotionId } from '../../game/config/recipes';
import type { FlowReport, ItemFlow } from '../../game/flow';
import { formatNumber, formatRate } from '../../game/format';
import { customerDemand } from '../../game/sim';
import type { GameState } from '../../game/state';
import { brewPassiveSpeed, customerShare, recipeNeeds } from '../../game/stats';
import { Icon } from '../Icon';
import { useGame } from '../store';

/** 大釜以目前速度全速熬煮時，每秒需要多少這種原料（只算有自動熬煮的大釜） */
function brewDemand(s: GameState, m: MaterialId): number {
  return s.cauldrons.reduce((sum, c) => {
    const need = recipeNeeds(s, c.recipe, m);
    return sum + (need * c.level * brewPassiveSpeed(s, c)) / RECIPES[c.recipe].brewTime;
  }, 0);
}

type Tone = 'warn' | 'ok' | 'info';

function materialHint(s: GameState, m: MaterialId, f: ItemFlow, r: FlowReport): [Tone, string] | null {
  const demand = brewDemand(s, m);
  const users = s.cauldrons.filter((c) => RECIPES[c.recipe].inputs[m]);
  const starved = Math.max(0, ...users.map((c) => r.starved[c.recipe]));
  if (users.length === 0) return f.made > 0 ? ['info', '目前沒有大釜用到它，只能靠收購箱換錢'] : null;
  if (demand > 0 && f.made < demand * 0.95) {
    return ['warn', `產量只有大釜全速需求的 ${Math.round((f.made / demand) * 100)}%：升級種這個的盆栽`];
  }
  if (starved > 0.15) return ['warn', `大釜有 ${Math.round(starved * 100)}% 的時間在等原料：升級種這個的盆栽`];
  if (f.crate > 0 || (demand > 0 && f.made > demand * 1.2)) {
    return ['ok', '有剩：可以升級大釜，把多的原料熬成藥水（比收購划算）'];
  }
  return null;
}

function potionHint(s: GameState, p: PotionId, f: ItemFlow, r: FlowReport): [Tone, string] | null {
  const starved = r.starved[p];
  if (starved > 0.15) return ['warn', `大釜有 ${Math.round(starved * 100)}% 的時間在等原料：先補原料產量`];
  if (s.potions[p] < 1 && f.made < customerDemand(s, p) * 0.9) return ['warn', '賣得比熬得快：升級大釜'];
  if (f.crate > 0) return ['ok', '有剩：多的由收購箱收購。可以提升來客、升級售價'];
  return null;
}

/** 帶正負號的速率；接近 0 就只顯示 0 */
function Signed({ v }: { v: number }) {
  const text = formatRate(Math.abs(v));
  if (text === '0') return <b>0</b>;
  return <b class={v > 0 ? 'plus' : 'minus'}>{v > 0 ? '+' : '−'}{text}</b>;
}

function FlowRow(props: {
  icon: string; name: string; stock: number; f: ItemFlow; usedLabel: string;
  demand?: { label: string; value: number }; hint: [Tone, string] | null;
}) {
  const { f } = props;
  return (
    <div class="flow-row">
      <div class="flow-head">
        <Icon id={props.icon} />
        <b>{props.name}</b>
        <span class="flow-stock">庫存 {formatNumber(props.stock)}</span>
      </div>
      <div class="flow-grid">
        <span>產量<Signed v={f.made} /></span>
        <span>{props.usedLabel}<Signed v={-f.used} /></span>
        <span>收購<Signed v={-f.crate} /></span>
        <span>淨變化<Signed v={f.net} /></span>
      </div>
      {props.demand && props.demand.value > 0 && (
        <div class="flow-demand">{props.demand.label} ≈ {formatRate(props.demand.value)}/秒</div>
      )}
      {props.hint && <div class={`flow-hint ${props.hint[0]}`}>{props.hint[1]}</div>}
    </div>
  );
}

/** 平均收入與來源（顧客、藥水收購箱、原料收購箱），以及顧客的訂單有沒有湊齊 */
function IncomeCard({ r }: { r: FlowReport }) {
  const game = useGame();
  const s = game.state;
  const { income, orders } = r;
  const sources: [string, string, number][] = [
    ['顧客', 'icon_gold', income.customers],
    ['藥水收購箱', 'upg_crate', income.cratePotions],
    ['原料收購箱', 'item_redheart', income.crateMaterials],
  ];
  const served = orders.full + orders.partial + orders.lost;
  return (
    <div class="card">
      <div class="card-title">
        <Icon id="icon_gold" /> 平均收入
        <span class="flow-stock"><b class="income-total">{formatRate(income.total)}</b> 金／秒</span>
      </div>
      <div class="income-bar">
        {sources.map(([label, , v], k) => income.total > 0 && v > 0 && (
          <span key={label} class={`seg seg-${k}`} style={{ width: `${(v / income.total) * 100}%` }} />
        ))}
      </div>
      <div class="income-list">
        {sources.map(([label, icon, v], k) => (
          <span key={label}>
            <i class={`dot seg-${k}`} /><Icon id={icon} size={1} /> {label}
            <b>{formatRate(v)}</b>
            <em>{income.total > 0 ? Math.round((v / income.total) * 100) : 0}%</em>
          </span>
        ))}
      </div>
      <div class="stats">
        <span>顧客買走產量的 <b>{Math.round(customerShare(s) * 100)}%</b>（其餘給收購箱）</span>
        {served > 0 && (
          <span>
            訂單湊齊 <b>{Math.round((orders.full / served) * 100)}%</b>
            {orders.partial > 0 && `・部分購買 ${orders.partial} 人`}
            {orders.lost > 0 && `・空手離開 ${orders.lost} 人`}
          </span>
        )}
      </div>
    </div>
  );
}

/** 產銷統計：每種原料／藥水最近平均每秒的產量、使用、收購，幫玩家判斷該升級哪裡 */
export function FlowPanel() {
  const game = useGame();
  const s = game.state;
  const r = game.flow.report(s);
  if (!r) {
    return <div class="cards"><div class="card"><p class="hint">統計中…（需要幾秒鐘的資料）</p></div></div>;
  }
  const used = new Set(s.cauldrons.flatMap((c) => Object.keys(RECIPES[c.recipe].inputs)));
  const planted = new Set(s.slots.map((x) => x.plant).filter(Boolean));
  const mats = MATERIAL_IDS.filter((m) => planted.has(m) || used.has(m) || s.materials[m] >= 1);
  return (
    <div class="cards">
      <p class="hint">
        最近 {Math.round(r.seconds)} 秒的平均（每秒）。「產量」少於「使用＋收購」時庫存會下降；
        原料被收購代表產量有剩，大釜常在等原料則代表原料不夠。
      </p>
      <IncomeCard r={r} />
      <div class="card">
        <div class="card-title">原料</div>
        {mats.length === 0 && <p class="hint">還沒有種任何植物。</p>}
        {mats.map((m) => (
          <FlowRow
            key={m} icon={`item_${m}`} name={PLANTS[m].name} stock={s.materials[m]} f={r.items[m]}
            usedLabel="熬煮" demand={{ label: '大釜全速需要', value: brewDemand(s, m) }}
            hint={materialHint(s, m, r.items[m], r)}
          />
        ))}
      </div>
      <div class="card">
        <div class="card-title">藥水</div>
        {s.cauldrons.length === 0 && <p class="hint">還沒有大釜。</p>}
        {s.cauldrons.map(({ recipe: p }) => (
          <FlowRow
            key={p} icon={`potion_${p}`} name={RECIPES[p].name} stock={s.potions[p]} f={r.items[p]}
            usedLabel="售出" demand={{ label: '顧客需求約', value: customerDemand(s, p) }}
            hint={potionHint(s, p, r.items[p], r)}
          />
        ))}
      </div>
    </div>
  );
}

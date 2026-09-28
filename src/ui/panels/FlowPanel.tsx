import { MARKET } from '../../game/config/balance';
import { MATERIAL_IDS, PLANTS, type MaterialId } from '../../game/config/plants';
import { RECIPES, type PotionId } from '../../game/config/recipes';
import type { FlowReport, ItemFlow, ItemId } from '../../game/flow';
import { formatExact, formatNumber, formatRate } from '../../game/format';
import { customerDemand } from '../../game/sim';
import type { GameState } from '../../game/state';
import { customerShare, materialDemand, sellPrice } from '../../game/stats';
import { localized, t, tx } from '../../i18n';
import { Icon } from '../Icon';
import { LineChart } from '../LineChart';
import { MarketHeat } from './CounterPanel';
import { flowDetail, useGame } from '../store';

/** 大釜以目前速度全速熬煮時，每秒需要多少這種原料（只算有自動熬煮的大釜；和收購箱的原料保留量同一套算法） */
const brewDemand = materialDemand;

type Tone = 'warn' | 'ok' | 'info';

function materialHint(s: GameState, m: MaterialId, f: ItemFlow, r: FlowReport): [Tone, string] | null {
  const demand = brewDemand(s, m);
  const users = s.cauldrons.filter((c) => RECIPES[c.recipe].inputs[m]);
  const starved = Math.max(0, ...users.map((c) => r.starved[c.recipe]));
  if (users.length === 0) return f.made > 0 ? ['info', t('flow.hint.unused')] : null;
  if (demand > 0 && f.made < demand * 0.95) {
    return ['warn', t('flow.hint.lowYield', { pct: Math.round((f.made / demand) * 100) })];
  }
  if (starved > 0.15) return ['warn', t('flow.hint.starvedMat', { pct: Math.round(starved * 100) })];
  if (f.crate > 0 || (demand > 0 && f.made > demand * 1.2)) {
    return ['ok', t('flow.hint.matSurplus')];
  }
  return null;
}

function potionHint(s: GameState, p: PotionId, f: ItemFlow, r: FlowReport): [Tone, string] | null {
  const starved = r.starved[p];
  if (starved > 0.15) {
    // 左邊的大釜先拿原料：這口大釜比左邊的更值錢時，建議把它拖到更左邊
    const idx = s.cauldrons.findIndex((c) => c.recipe === p);
    const cheaperLeft = s.cauldrons.slice(0, idx).some((c) => sellPrice(s, c.recipe) < sellPrice(s, p));
    const tip = cheaperLeft ? t('flow.hint.moveLeft') : '';
    return ['warn', t('flow.hint.starvedPotion', { pct: Math.round(starved * 100), tip })];
  }
  if (s.potions[p] < 1 && f.made < customerDemand(s, p) * 0.9) return ['warn', t('flow.hint.sellingOut')];
  // 顧客需求會跟著產量調整，平常很少缺貨；進門時不夠的客人一多，就是產能還差一點
  if (f.short > 0) {
    const ratio = f.short / Math.max(1, r.orders.arrived);
    const hot = s.market.value > 1.1 ? t('flow.hint.hot') : '';
    const tip = f.crate > 0
      ? t('flow.hint.shortCrate')
      : t('flow.hint.shortCapacity');
    return [ratio >= SHORT_WARN ? 'warn' : 'info', t('flow.hint.short', { sec: WINDOW_SEC, n: f.short, hot, tip })];
  }
  if (f.crate > 0) return ['ok', t('flow.hint.potionSurplus')];
  return null;
}

/** 進門時缺貨的客人超過這個比例，提示變成警告 */
const SHORT_WARN = 0.2;
const WINDOW_SEC = 30;

/** 帶正負號的速率；接近 0 就只顯示 0 */
function Signed({ v }: { v: number }) {
  const text = formatRate(Math.abs(v));
  if (text === '0') return <b>0</b>;
  return <b class={v > 0 ? 'plus' : 'minus'}>{v > 0 ? '+' : '−'}{text}</b>;
}

function FlowRow(props: {
  icon: string; name: string; stock: number; f: ItemFlow; usedLabel: string;
  demand?: { label: string; value: number }; hint: [Tone, string] | null;
  /** 點了打開這一項的詳細圖表（詳細頁本身不給） */
  onOpen?: () => void;
  /** 庫存顯示完整數字（詳細頁） */
  fullStock?: boolean;
  /** 藥水：顯示進門時不夠的客人數 */
  potion?: boolean;
}) {
  const { f } = props;
  return (
    <div class={`flow-row ${props.onOpen ? 'clickable' : ''}`} onClick={props.onOpen}>
      <div class="flow-head">
        <Icon id={props.icon} />
        <b>{props.name}</b>
        <span class="flow-stock">{t('flow.stock', { n: props.fullStock ? fullCount(props.stock) : formatNumber(props.stock) })}</span>
        {props.onOpen && <span class="flow-more">{t('flow.chart')}</span>}
      </div>
      <div class="flow-grid">
        <span>{t('flow.made')}<Signed v={f.made} /></span>
        <span>{props.usedLabel}<Signed v={-f.used} /></span>
        <span>{t('flow.crate')}<Signed v={-f.crate} /></span>
        <span>{t('flow.net')}<Signed v={f.net} /></span>
      </div>
      {props.demand && props.demand.value > 0 && (
        <div class="flow-demand">
          {t('flow.demand', { label: props.demand.label, n: formatRate(props.demand.value) })}
          {props.potion && tx('flow.shortCount', { n: <b class={f.short > 0 ? 'minus' : ''}>{f.short}</b> }, { sec: WINDOW_SEC })}
        </div>
      )}
      {props.hint && <div class={`flow-hint ${props.hint[0]}`}>{props.hint[1]}</div>}
    </div>
  );
}

/** 平均收入與來源（顧客、藥水收購箱、原料收購箱），以及顧客的訂單有沒有湊齊 */
function IncomeCard({ r, onOpen }: { r: FlowReport; onOpen?: () => void }) {
  const game = useGame();
  const s = game.state;
  const { income, orders } = r;
  const sources: [string, string, number][] = [
    [INCOME_LABELS.customers, 'icon_gold', income.customers],
    [INCOME_LABELS.cratePotions, 'upg_crate', income.cratePotions],
    [INCOME_LABELS.crateMaterials, 'item_redheart', income.crateMaterials],
  ];
  const served = orders.full + orders.partial + orders.lost;
  return (
    <div class={`card ${onOpen ? 'clickable' : ''}`} onClick={onOpen}>
      <div class="card-title">
        <Icon id="icon_gold" /> {t('flow.income')}
        <span class="flow-stock">{tx('flow.goldPerSec', { n: <b class="income-total">{formatRate(income.total)}</b> })}</span>
        {onOpen && <span class="flow-more">{t('flow.chart')}</span>}
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
        <span>{tx('flow.customerShare', { pct: <b>{Math.round(customerShare(s) * 100)}%</b> })}</span>
        <MarketHeat />
        {served > 0 && (
          <span>
            {tx('flow.ordersFull', { pct: <b>{Math.round((orders.full / served) * 100)}%</b> })}
            {orders.partial > 0 && t('flow.ordersPartial', { n: orders.partial })}
            {orders.lost > 0 && t('flow.ordersLost', { n: orders.lost })}
          </span>
        )}
        {orders.arrived > 0 && (
          <span>
            {tx('flow.waited', {
              arrived: <b>{orders.arrived}</b>, waited: <b class={orders.waited > 0 ? 'minus' : ''}>{orders.waited}</b>,
            }, { sec: WINDOW_SEC, pct: Math.round((orders.waited / orders.arrived) * 100) })}
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
  if (r && flowDetail.value) return <FlowDetail id={flowDetail.value} r={r} />;
  if (!r) {
    return <div class="cards"><div class="card"><p class="hint">{t('flow.collecting')}</p></div></div>;
  }
  const used = new Set(s.cauldrons.flatMap((c) => Object.keys(RECIPES[c.recipe].inputs)));
  const planted = new Set(s.slots.map((x) => x.plant).filter(Boolean));
  const mats = MATERIAL_IDS.filter((m) => planted.has(m) || used.has(m) || s.materials[m] >= 1);
  return (
    <div class="cards">
      <p class="hint">
        {t('flow.intro', { sec: Math.round(r.seconds), window: WINDOW_SEC })}
      </p>
      <IncomeCard r={r} onOpen={() => openDetail('income')} />
      <div class="card">
        <div class="card-title">{t('flow.materials')}</div>
        {mats.length === 0 && <p class="hint">{t('flow.noPlants')}</p>}
        {mats.map((m) => (
          <FlowRow
            key={m} icon={`item_${m}`} name={PLANTS[m].name} stock={s.materials[m]} f={r.items[m]}
            usedLabel={t('flow.brewed')} demand={{ label: t('flow.brewDemand'), value: brewDemand(s, m) }}
            hint={materialHint(s, m, r.items[m], r)} onOpen={() => openDetail(m)}
          />
        ))}
      </div>
      <div class="card">
        <div class="card-title">{t('flow.potions')}</div>
        {s.cauldrons.length === 0 && <p class="hint">{t('flow.noCauldrons')}</p>}
        {s.cauldrons.map(({ recipe: p }) => (
          <FlowRow
            key={p} icon={`potion_${p}`} name={RECIPES[p].name} stock={s.potions[p]} f={r.items[p]}
            usedLabel={t('flow.sold')} demand={{ label: t('flow.customerDemand'), value: customerDemand(s, p) }} potion
            hint={potionHint(s, p, r.items[p], r)} onOpen={() => openDetail(p)}
          />
        ))}
      </div>
    </div>
  );
}

/** 圖表顏色（已驗證在羊皮紙底色上的對比與色盲區分）：產量、使用、收購 */
const FLOW_COLORS = { made: '#1f9e6a', used: '#e0662e', crate: '#2a78d6' };
/** 收入來源的顏色：顧客、藥水收購箱、原料收購箱；合計用墨色 */
const INCOME_COLORS = { customers: '#b87d0a', cratePotions: '#2a78d6', crateMaterials: '#c94f86', total: '#4a3426' };
const INCOME_LABELS = localized({}, 'flow.source', ['customers', 'cratePotions', 'crateMaterials']);
const STOCK_COLOR = '#2f6f6a';
const NET_COLOR = '#c94f86';
/** 每種配方固定一個顏色（顏色跟著配方走，不跟著順序） */
const RECIPE_COLORS: Record<PotionId, string> = { glow: '#e0662e', focus: '#2a78d6', elixir: '#1f9e6a' };

const pct = (n: number) => `${Math.round(n * 100)}%`;
/** 帶正負號（淨變化用） */
const signed = (fmt: (n: number) => string) => (n: number) => (n > 0 ? `+${fmt(n)}` : fmt(n));
/** 庫存：完整數字，不縮寫 */
const fullCount = (n: number) => Math.floor(n + 1e-9).toLocaleString('en-US');

/** 打開某一項的詳細圖表，並捲回最上面 */
function openDetail(id: ItemId | 'income'): void {
  flowDetail.value = id;
  document.querySelector('.drawer-body')?.scrollTo(0, 0);
}

function closeDetail(): void {
  flowDetail.value = null;
  document.querySelector('.drawer-body')?.scrollTo(0, 0);
}

/** 單一原料／藥水（或收入）的詳細頁：最近 30 秒的折線圖 */
function FlowDetail({ id, r }: { id: ItemId | 'income'; r: FlowReport }) {
  const game = useGame();
  const s = game.state;
  const ser = game.flow.series(s);
  const back = <button class="btn back-btn" onClick={closeDetail}>{t('flow.back')}</button>;
  if (!ser) {
    return <div class="cards">{back}<div class="card"><p class="hint">{t('flow.collecting')}</p></div></div>;
  }
  if (id === 'income') {
    return (
      <div class="cards">
        {back}
        <IncomeCard r={r} />
        <div class="card">
          <div class="card-title">{t('flow.incomePerSec')}</div>
          <LineChart
            ago={ser.ago} format={formatRate} tipFormat={formatExact}
            series={[
              { label: t('flow.total'), color: INCOME_COLORS.total, values: ser.income.total },
              ...(['customers', 'cratePotions', 'crateMaterials'] as const).map((k) => (
                { label: INCOME_LABELS[k], color: INCOME_COLORS[k], values: ser.income[k] })),
            ]}
          />
        </div>
        <div class="card">
          <div class="card-title">{t('flow.market')}</div>
          <LineChart
            ago={ser.ago} format={(n) => `×${n.toFixed(2)}`} yMax={MARKET.max}
            series={[{ label: t('flow.heat'), color: INCOME_COLORS.cratePotions, values: ser.market }]}
            refLine={{ label: t('flow.normal'), value: 1 }}
          />
          <p class="hint">{t('flow.marketHint')}</p>
        </div>
      </div>
    );
  }
  const isMat = id in s.materials;
  const it = ser.items[id];
  const name = isMat ? PLANTS[id as MaterialId].name : RECIPES[id as PotionId].name;
  const icon = isMat ? `item_${id}` : `potion_${id}`;
  const usedLabel = isMat ? t('flow.brewed') : t('flow.sold');
  const f = r.items[id];
  const demand = isMat ? brewDemand(s, id as MaterialId) : customerDemand(s, id as PotionId);
  const demandLabel = t(isMat ? 'flow.brewDemand' : 'flow.customerDemand');
  const hint = isMat ? materialHint(s, id as MaterialId, f, r) : potionHint(s, id as PotionId, f, r);
  // 原料：用到它的大釜；藥水：它自己的大釜
  const users = isMat ? s.cauldrons.filter((c) => RECIPES[c.recipe].inputs[id as MaterialId]) : s.cauldrons.filter((c) => c.recipe === id);
  return (
    <div class="cards">
      {back}
      <div class="card">
        <FlowRow
          icon={icon} name={name} stock={isMat ? s.materials[id as MaterialId] : s.potions[id as PotionId]} f={f}
          usedLabel={usedLabel} hint={hint} fullStock potion={!isMat}
          demand={{ label: demandLabel, value: demand }}
        />
      </div>
      <div class="card">
        <div class="card-title">{t(isMat ? 'flow.madeTitleMat' : 'flow.madeTitlePotion')}</div>
        <LineChart
          ago={ser.ago} format={formatRate} tipFormat={formatExact}
          series={[
            { label: t(isMat ? 'flow.made' : 'flow.brewedOut'), color: FLOW_COLORS.made, values: it.made },
            { label: usedLabel, color: FLOW_COLORS.used, values: it.used },
            { label: t('flow.crate'), color: FLOW_COLORS.crate, values: it.crate },
          ]}
          refLine={demand > 0 ? { label: demandLabel, value: demand } : undefined}
        />
      </div>
      <div class="card">
        <div class="card-title">{t('flow.stockTitle')}</div>
        <LineChart ago={ser.ago} format={fullCount} yMode="fit" series={[{ label: t('flow.stockTitle'), color: STOCK_COLOR, values: it.stock }]} />
        <p class="hint">{t('flow.stockHint')}</p>
      </div>
      <div class="card">
        <div class="card-title">{t('flow.netPerSec')}</div>
        <LineChart
          ago={ser.ago} format={signed(formatRate)} tipFormat={signed(formatExact)} yMode="signed"
          series={[{ label: t('flow.net'), color: NET_COLOR, values: it.net }]}
        />
        <p class="hint">{t('flow.netHint', { used: usedLabel })}</p>
      </div>
      {!isMat && (
        <div class="card">
          <div class="card-title">{t('flow.shortTitle')}</div>
          <LineChart
            ago={ser.ago} format={(n) => (Number.isInteger(n) ? `${n}` : n.toFixed(1))}
            series={[{ label: t('flow.people'), color: FLOW_COLORS.used, values: it.short }]}
          />
          <p class="hint">{t('flow.shortHint', { name })}</p>
        </div>
      )}
      {users.length > 0 && (
        <div class="card">
          <div class="card-title">{t(isMat ? 'flow.starvedTitleMat' : 'flow.starvedTitlePotion')}</div>
          <LineChart
            ago={ser.ago} format={pct} yMax={1}
            series={users.map((c) => ({
              label: RECIPES[c.recipe].name, color: RECIPE_COLORS[c.recipe],
              values: ser.starved[c.recipe],
            }))}
          />
          <p class="hint">{t('flow.starvedHint')}</p>
        </div>
      )}
    </div>
  );
}
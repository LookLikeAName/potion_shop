import { useEffect, useRef } from 'preact/hooks';
import { OFFLINE } from '../game/config/balance';
import { GIFT_MAP } from '../game/config/gifts';
import { MASCOT, OUTFITS } from '../game/config/mascot';
import { MATERIAL_IDS, PLANTS } from '../game/config/plants';
import { POTION_IDS, RECIPES } from '../game/config/recipes';
import type { BuyMode } from '../game/costs';
import { formatDuration, formatNumber } from '../game/format';
import { canStartFever } from '../game/commands';
import { t, tx } from '../i18n';
import { Icon } from './Icon';
import { HeartMeter, WishCard, fmtHeart } from './Happiness';
import { LumiaModal } from './LumiaModal';
import { CauldronPanel } from './panels/CauldronPanel';
import { CounterPanel } from './panels/CounterPanel';
import { DecorPanel, DragGhost } from './panels/DecorPanel';
import { FlowPanel } from './panels/FlowPanel';
import { GreenhousePanel } from './panels/GreenhousePanel';
import { LumiaPanel, StoryModal } from './panels/LumiaPanel';
import { SettingsPanel } from './panels/SettingsPanel';
import { BuffBar, EventBanner, LetterModal } from './Events';
import { EventBookPanel, EventDetailModal } from './panels/EventBookPanel';
import {
  buyMode, drawerFocus, drawerOpen, drawerTab, eventDetail, letterOpen, lockState, lumiaOpen, offlineReport, openDrawer,
  requestTakeover, storyId, toast, useGame, type DrawerTab,
} from './store';

export function App() {
  const game = useGame();
  // 劇情、信件、離線報告、互動視窗開著時，事件的計時暫停（不會在看劇情時錯過事件）
  const hold = !!storyId.value || letterOpen.value !== null || !!offlineReport.value || lumiaOpen.value
    || !!eventDetail.value || lockState.value !== 'ok';
  useEffect(() => game.setEventHold(hold), [hold]);
  return (
    <>
      <TopBar />
      <WishCard />
      <EventBanner />
      <BuffBar />
      <Drawer />
      <LumiaModal />
      <StoryModal />
      <EventDetailModal />
      <LetterModal />
      <OfflineModal />
      <LockOverlay />
      <DragGhost />
      {toast.value && <div class="toast" key={toast.value.id}>{toast.value.text}</div>}
    </>
  );
}

function TopBar() {
  const game = useGame();
  const s = game.state;
  const planted = new Set(s.slots.map((x) => x.plant).filter(Boolean));
  const unlocked = new Set(s.cauldrons.map((c) => c.recipe));
  return (
    <div class="topbar">
      <div class="res gold" title={t('top.gold')}><Icon id="icon_gold" /> {formatNumber(s.gold)}</div>
      {/* 點原料或藥水打開產銷統計 */}
      <button class="res-group res-btn" title={t('top.flow')} onClick={() => openDrawer('flow')}>
        {MATERIAL_IDS.filter((m) => planted.has(m) || s.materials[m] >= 1).map((m) => (
          <div class="res" key={m} title={PLANTS[m].name}><Icon id={`item_${m}`} /> {formatNumber(s.materials[m])}</div>
        ))}
      </button>
      <button class="res-group res-btn" title={t('top.flow')} onClick={() => openDrawer('flow')}>
        {POTION_IDS.filter((p) => unlocked.has(p) || s.potions[p] >= 1).map((p) => (
          <div class="res" key={p} title={RECIPES[p].name}><Icon id={`potion_${p}`} /> {formatNumber(s.potions[p])}</div>
        ))}
      </button>
      <HeartMeter />

      <FeverButton />
      <button class="book-btn" onClick={() => (drawerOpen.value = !drawerOpen.value)}>
        {t('top.book')}
      </button>
    </div>
  );
}

/** 狂熱時刻（星空下的誓言解鎖）：每天一次 */
function FeverButton() {
  const game = useGame();
  const s = game.state;
  if (!s.redeemed.vow) return null;
  if (s.feverLeft > 0) return <div class="fever-btn active"><Icon id="icon_fever" /> {t('top.feverOn', { n: Math.ceil(s.feverLeft) })}</div>;
  const ready = canStartFever(s, game.today);
  return (
    <button class="fever-btn" disabled={!ready} onClick={() => game.startFever()} title={t('top.feverTip')}>
      <Icon id="icon_fever" /> {t(ready ? 'top.fever' : 'top.feverUsed')}
    </button>
  );
}

/** 魔導書的分頁：左側的書籤，只顯示圖示（名稱在語言檔 tab.<id>，滑過時顯示）；沒有圖的用文字符號 */
const TABS: { id: DrawerTab; icon?: string; glyph?: string }[] = [
  { id: 'greenhouse', icon: 'pot_t2' },
  { id: 'cauldron', icon: 'cauldron_t1' },
  { id: 'counter', icon: 'upg_abacus_squirrel' },
  { id: 'flow', icon: 'icon_gold' },
  { id: 'lumia', icon: 'lumia_chibi_idle' },
  { id: 'settings', glyph: '⚙' },
];

/** 禮物圖鑑、事件簿是露米婭分頁底下的頁面 */
const bookmarkOf = (tab: DrawerTab): DrawerTab => (tab === 'decor' || tab === 'events' ? 'lumia' : tab);

const MODES: BuyMode[] = [1, 10, 'max'];

function Drawer() {
  const bodyRef = useRef<HTMLDivElement>(null);
  const open = drawerOpen.value;
  const tab = drawerTab.value;
  const focus = drawerFocus.value;

  // 換分頁時從最上面開始（有指定要捲到的卡片時交給下面處理）
  useEffect(() => {
    if (!focus && bodyRef.current) bodyRef.current.scrollTop = 0;
  }, [tab]);

  // 從場景點徽章打開時，捲動到對應卡片並閃一下
  useEffect(() => {
    if (!open || !focus) return;
    const el = bodyRef.current?.querySelector<HTMLElement>(`#${focus}`);
    if (el) {
      el.scrollIntoView({ block: 'start', behavior: 'smooth' });
      el.classList.remove('flash');
      void el.offsetWidth;
      el.classList.add('flash');
    }
    drawerFocus.value = null;
  }, [open, tab, focus]);

  return (
    <aside class={`drawer ${open ? 'open' : ''}`}>
      <nav class="bookmarks">
        <button class="close" onClick={() => (drawerOpen.value = false)} aria-label={t('common.close')}>✕</button>
        {TABS.map((x) => (
          <button
            key={x.id} class={`bookmark ${bookmarkOf(tab) === x.id ? 'active' : ''}`}
            data-label={t(`tab.${x.id}`)} aria-label={t(`tab.${x.id}`)} onClick={() => (drawerTab.value = x.id)}
          >
            {x.icon ? <Icon id={x.icon} size={1.8} /> : <span class="bookmark-glyph">{x.glyph}</span>}
          </button>
        ))}
      </nav>
      <div class="drawer-main">
      <div class="drawer-title">
        <b>{t(`tab.${bookmarkOf(tab)}`)}</b>
        {(tab === 'greenhouse' || tab === 'cauldron' || tab === 'counter') && (
          <div class="modes">
            {t('top.buyQty')}
            {MODES.map((m) => (
              <button key={m} class={`mode ${buyMode.value === m ? 'active' : ''}`} onClick={() => (buyMode.value = m)}>
                {m === 'max' ? t('top.buyMax') : `×${m}`}
              </button>
            ))}
          </div>
        )}
      </div>
      <div class="drawer-body" ref={bodyRef}>
        {tab === 'greenhouse' && <GreenhousePanel />}
        {tab === 'cauldron' && <CauldronPanel />}
        {tab === 'counter' && <CounterPanel />}
        {tab === 'flow' && <FlowPanel />}
        {tab === 'lumia' && <LumiaPanel />}
        {tab === 'decor' && <DecorPanel />}
        {tab === 'events' && <EventBookPanel />}
        {tab === 'settings' && <SettingsPanel />}
      </div>
      </div>
    </aside>
  );
}

function OfflineModal() {
  const r = offlineReport.value;
  if (!r) return null;
  const mats = MATERIAL_IDS.filter((m) => Math.abs(r.materials[m]) >= 1);
  const pots = POTION_IDS.filter((p) => Math.abs(r.potions[p]) >= 1);
  const sign = (n: number) => (n >= 0 ? '+' : '') + formatNumber(n);
  return (
    <div class="modal-back">
      <div class="modal">
        <h2>{t('offline.title')}</h2>
        <p>{t('offline.away', { t: formatDuration(r.seconds) })}</p>
        <p class="big">{tx('offline.gold', { icon: <Icon id="icon_gold" />, n: <b>{formatNumber(r.gold)}</b> })}</p>
        <p class="hint">
          {t('offline.efficiency', { pct: Math.round(r.efficiency * 100) })}
          {(r.pajama || r.dream) && t('offline.efficiencyParts', {
            base: Math.round(OFFLINE.baseEfficiency * 100),
            parts: [r.pajama && OUTFITS.pajama.name, r.dream && GIFT_MAP.dream_catcher.name].filter(Boolean).map((n) => `＋${n}`).join(''),
          })}
          {t('offline.decay', { t: formatDuration(r.halfLife), pct: Math.round(r.avgEfficiency * 100) })}
        </p>
        {r.happiness >= 0.005 && (
          <p>{tx('offline.happy', { icon: <Icon id="icon_happiness" />, n: <b>+{fmtHeart(r.happiness)}</b> })}</p>
        )}
        {r.simulated >= 3 * 3600 && (
          <p class="hint">
            {t('offline.happyDecay', { hours: MASCOT.offlineHappyHours, capped: r.happyCapped ? t('offline.happyCapped') : '' })}
          </p>
        )}
        {(mats.length > 0 || pots.length > 0) && (
          <div class="report-list">
            {mats.map((m) => <span key={m}><Icon id={`item_${m}`} /> {t('offline.item', { name: PLANTS[m].name, n: sign(r.materials[m]) })}</span>)}
            {pots.map((p) => <span key={p}><Icon id={`potion_${p}`} /> {t('offline.item', { name: RECIPES[p].name, n: sign(r.potions[p]) })}</span>)}
          </div>
        )}
        {r.capped && <p class="hint">{t('offline.capped', { t: formatDuration(r.simulated) })}</p>}
        <button class="btn primary" onClick={() => (offlineReport.value = null)}>{t('offline.ok')}</button>
      </div>
    </div>
  );
}

function LockOverlay() {
  const st = lockState.value;
  if (st === 'ok') return null;
  return (
    <div class="modal-back">
      <div class="modal">
        <h2>{t(st === 'blocked' ? 'lock.blocked' : 'lock.lost')}</h2>
        <p>{t('lock.hint')}</p>
        <button class="btn primary" onClick={() => requestTakeover()}>{t('lock.takeover')}</button>
      </div>
    </div>
  );
}

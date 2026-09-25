import { useEffect, useRef } from 'preact/hooks';
import { MATERIAL_IDS, PLANTS } from '../game/config/plants';
import { POTION_IDS, RECIPES } from '../game/config/recipes';
import type { BuyMode } from '../game/costs';
import { formatDuration, formatHappiness, formatNumber } from '../game/format';
import { canStartFever } from '../game/commands';
import { Icon } from './Icon';
import { LumiaModal } from './LumiaModal';
import { CauldronPanel } from './panels/CauldronPanel';
import { CounterPanel } from './panels/CounterPanel';
import { GreenhousePanel } from './panels/GreenhousePanel';
import { LumiaPanel, StoryModal } from './panels/LumiaPanel';
import { SettingsPanel } from './panels/SettingsPanel';
import {
  buyMode, drawerFocus, drawerOpen, drawerTab, lockState, offlineReport, openDrawer, requestTakeover, toast,
  useGame, type DrawerTab,
} from './store';

export function App() {
  return (
    <>
      <TopBar />
      <Drawer />
      <LumiaModal />
      <StoryModal />
      <OfflineModal />
      <LockOverlay />
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
      <div class="res gold" title="金幣"><Icon id="icon_gold" /> {formatNumber(s.gold)}</div>
      <div class="res-group">
        {MATERIAL_IDS.filter((m) => planted.has(m) || s.materials[m] >= 1).map((m) => (
          <div class="res" key={m} title={PLANTS[m].name}><Icon id={`item_${m}`} /> {formatNumber(s.materials[m])}</div>
        ))}
      </div>
      <div class="res-group">
        {POTION_IDS.filter((p) => unlocked.has(p) || s.potions[p] >= 1).map((p) => (
          <div class="res" key={p} title={RECIPES[p].name}><Icon id={`potion_${p}`} /> {formatNumber(s.potions[p])}</div>
        ))}
      </div>
      <button class="res res-btn" title="開心度（點擊打開兌換）" onClick={() => openDrawer('lumia')}>
        <Icon id="icon_happiness" /> {formatHappiness(s.happiness)}
      </button>
      <FeverButton />
      <button class="book-btn" onClick={() => (drawerOpen.value = !drawerOpen.value)}>
        📖 魔導書
      </button>
    </div>
  );
}

/** 狂熱時刻（星空下的誓言解鎖）：每天一次 */
function FeverButton() {
  const game = useGame();
  const s = game.state;
  if (!s.redeemed.vow) return null;
  if (s.feverLeft > 0) return <div class="fever-btn active">✨ 狂熱中 {Math.ceil(s.feverLeft)}s</div>;
  const ready = canStartFever(s, game.today);
  return (
    <button class="fever-btn" disabled={!ready} onClick={() => game.startFever()} title="60 秒內所有生產速度 ×10，每天一次">
      ✨ {ready ? '狂熱時刻' : '今天已使用'}
    </button>
  );
}

const TABS: { id: DrawerTab; label: string }[] = [
  { id: 'greenhouse', label: '溫室' },
  { id: 'cauldron', label: '大釜' },
  { id: 'counter', label: '櫃台' },
  { id: 'lumia', label: '露米婭' },
  { id: 'settings', label: '設定' },
];

const MODES: BuyMode[] = [1, 10, 'max'];

function Drawer() {
  const bodyRef = useRef<HTMLDivElement>(null);
  const open = drawerOpen.value;
  const tab = drawerTab.value;
  const focus = drawerFocus.value;

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
      <div class="drawer-head">
        <div class="tabs">
          {TABS.map((t) => (
            <button key={t.id} class={`tab ${tab === t.id ? 'active' : ''}`} onClick={() => (drawerTab.value = t.id)}>
              {t.label}
            </button>
          ))}
        </div>
        <button class="close" onClick={() => (drawerOpen.value = false)} aria-label="關閉">✕</button>
      </div>
      {tab !== 'settings' && tab !== 'lumia' && (
        <div class="modes">
          購買數量
          {MODES.map((m) => (
            <button key={m} class={`mode ${buyMode.value === m ? 'active' : ''}`} onClick={() => (buyMode.value = m)}>
              {m === 'max' ? '最大' : `×${m}`}
            </button>
          ))}
        </div>
      )}
      <div class="drawer-body" ref={bodyRef}>
        {tab === 'greenhouse' && <GreenhousePanel />}
        {tab === 'cauldron' && <CauldronPanel />}
        {tab === 'counter' && <CounterPanel />}
        {tab === 'lumia' && <LumiaPanel />}
        {tab === 'settings' && <SettingsPanel />}
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
        <h2>歡迎回來，老師！</h2>
        <p>你離開了 {formatDuration(r.seconds)}。</p>
        <p class="big">精靈們努力工作，獲得 <Icon id="icon_gold" /> <b>{formatNumber(r.gold)}</b> 金幣！</p>
        {r.pajama && <p class="hint">露米婭穿著星空絨毛睡衣，睡得特別香甜：離線金幣 ×2！</p>}
        {r.happiness > 0.00005 && (
          <p>看板娘充分休息，開心度增加 <Icon id="icon_happiness" /> <b>{formatHappiness(r.happiness)}</b>！</p>
        )}
        {(mats.length > 0 || pots.length > 0) && (
          <div class="report-list">
            {mats.map((m) => <span key={m}><Icon id={`item_${m}`} /> {PLANTS[m].name} {sign(r.materials[m])}</span>)}
            {pots.map((p) => <span key={p}><Icon id={`potion_${p}`} /> {RECIPES[p].name} {sign(r.potions[p])}</span>)}
          </div>
        )}
        {r.capped && <p class="hint">離線收益最多計算 {formatDuration(r.simulated)}。</p>}
        <button class="btn primary" onClick={() => (offlineReport.value = null)}>太好了！</button>
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
        <h2>{st === 'blocked' ? '遊戲已在其他分頁開啟' : '遊戲已在其他分頁繼續'}</h2>
        <p>同一份存檔一次只能在一個分頁執行，避免進度互相覆蓋。</p>
        <button class="btn primary" onClick={() => requestTakeover()}>在這裡繼續</button>
      </div>
    </div>
  );
}

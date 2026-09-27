import { useState } from 'preact/hooks';
import { ART_URLS } from '../../assets/manifest';
import { ACHIEVEMENTS } from '../../game/config/achievements';
import { HAPPINESS_ITEMS, STORIES, type HappinessItem } from '../../game/config/happiness';
import { MASCOT } from '../../game/config/mascot';
import { redeemCost } from '../../game/commands';
import { formatHappiness } from '../../game/format';
import { bondLevel, happyMult, renownLevel, restHappinessPerSec } from '../../game/stats';
import { fmtHeart } from '../Happiness';
import { Icon } from '../Icon';
import { MascotControls, StaminaBar, mascotStatus } from '../LumiaModal';
import { lumiaOpen, openDrawer, showToast, storyId, useGame } from '../store';

const TIERS: { tier: 1 | 2 | 3 | 4; title: string; hint: string }[] = [
  { tier: 1, title: '休息室擴建', hint: '多一格擺設位，可以多擺一件禮物' },
  { tier: 2, title: '百變看板娘', hint: '買了之後在上方「服裝」切換' },
  { tier: 3, title: '特權天賦', hint: '金幣買不到的永久強化' },
  { tier: 4, title: '深層羈絆', hint: '專屬劇情與終局獎勵' },
];

export function LumiaPanel() {
  const game = useGame();
  const s = game.state;
  const done = ACHIEVEMENTS.filter((a) => s.achievements[a.id]).length;
  return (
    <div class="cards">
      <div class="card" id="lumia-status">
        <div class="card-title">
          <Icon id="lumia_chibi_idle" /> 露米婭
          <button class="btn primary talk-btn" onClick={() => (lumiaOpen.value = true)}>和她互動</button>
        </div>
        <StaminaBar s={s} />
        <p class="hint">目前：{mascotStatus(s)}</p>
        <MascotControls />
      </div>

      <BondCard />

      <div class="card" id="lumia-redeem">
        <div class="card-title">
          <Icon id="icon_happiness" /> 開心度兌換
          <span class="lv">♥ {formatHappiness(s.happiness)}</span>
        </div>
        <p class="hint">兌換只花整數部分。每兌換一件（少女的聲援除外）羈絆等級 +1，之後得到的開心度都會變多。</p>
        {TIERS.map((t) => (
          <div key={t.tier} class="tier">
            <div class="tier-title">Tier {t.tier}：{t.title}<span class="tier-hint">{t.hint}</span></div>
            {HAPPINESS_ITEMS.filter((i) => i.tier === t.tier).map((i) => <RedeemRow key={i.id} item={i} />)}
          </div>
        ))}
      </div>

      <div class="card">
        <div class="card-title">🏆 成就 <span class="lv">{done}/{ACHIEVEMENTS.length}</span></div>
        <div class="achievements">
          {ACHIEVEMENTS.map((a) => (
            <div key={a.id} class={`ach ${s.achievements[a.id] ? 'done' : ''}`}>
              <span>{s.achievements[a.id] ? '✔' : '・'} {a.name}</span>
              <span class="ach-reward">+{a.reward} ♥</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/** 名聲、羈絆與開心度倍率，以及目前各來源的節奏 */
function BondCard() {
  const game = useGame();
  const s = game.state;
  const renown = renownLevel(s);
  const bond = bondLevel(s);
  const mult = happyMult(s);
  const rest = restHappinessPerSec(s) * 3600;
  return (
    <div class="card" id="lumia-bond">
      <div class="card-title"><Icon id="icon_happiness" /> 名聲與羈絆 <span class="lv">開心度 ×{mult.toFixed(2)}</span></div>
      <div class="bond-grid">
        <span><em>店舖名聲</em><b>Lv {renown}</b><small>累計收入每多 10 倍 +1</small></span>
        <span><em>羈絆</em><b>Lv {bond}</b><small>每用開心度兌換一件 +1</small></span>
      </div>
      <p class="hint">
        小心願、休息、摸頭戳臉頰得到的開心度都乘上倍率（成就與禮物固定）。
        休息時每小時約 +{fmtHeart(rest)} ♥（離線也算，但離開越久越少，{MASCOT.offlineHappyHours} 小時後不再增加）；已完成 {s.stats.wishesDone} 個小心願。
      </p>
      <button class="btn primary" onClick={() => openDrawer('decor')}>🎁 禮物圖鑑與休息室擺設</button>
    </div>
  );
}

function RedeemRow({ item }: { item: HappinessItem }) {
  const game = useGame();
  const s = game.state;
  const owned = s.redeemed[item.id] ?? 0;
  const cost = redeemCost(s, item.id);
  const affordable = cost !== null && Math.floor(s.happiness + 1e-9) >= cost;

  const buy = () => {
    if (!game.redeem(item.id)) return;
    if (item.kind === 'story') storyId.value = item.id;
    else showToast(`已兌換：${item.name}`);
  };

  return (
    <div class="buy-row">
      <div class="buy-text">
        <div class="buy-title">
          <Icon id={item.icon} /> {item.name}
          {owned > 0 && <span class="buy-status">{item.max === Infinity ? `已兌換 ${owned} 次` : item.max > 1 ? `${owned}/${item.max}` : '已擁有'}</span>}
        </div>
        <div class="buy-desc">{item.desc}</div>
      </div>
      {item.kind === 'story' && owned > 0 ? (
        <button class="buy-btn" onClick={() => (storyId.value = item.id)}>回顧劇情</button>
      ) : (
        <button class="buy-btn heart" disabled={!affordable} onClick={buy}>
          {cost === null ? '已擁有' : `♥ ${cost}`}
        </button>
      )}
    </div>
  );
}

/** 劇情事件：逐句播放（CG 在 M5 加入） */
export function StoryModal() {
  const id = storyId.value;
  if (!id) return null;
  return <Story key={id} id={id} />;
}

function Story({ id }: { id: string }) {
  const story = STORIES[id];
  const [i, setI] = useState(0);
  const last = i >= story.lines.length - 1;
  const cg = ART_URLS[story.cg];
  return (
    <div class="modal-back story-back">
      <div class="modal story">
        <h2>{story.title}</h2>
        <div class="cg">{cg ? <img src={cg} alt={story.title} /> : <span>CG（正式美術在之後加入）</span>}</div>
        <div class="speech story-line">{story.lines[i]}</div>
        <button class="btn primary" onClick={() => (last ? (storyId.value = null) : setI(i + 1))}>
          {last ? '結束' : '繼續 ▶'}
        </button>
      </div>
    </div>
  );
}

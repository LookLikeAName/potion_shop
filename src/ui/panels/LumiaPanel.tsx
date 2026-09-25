import { useState } from 'preact/hooks';
import { ART_URLS } from '../../assets/manifest';
import { ACHIEVEMENTS } from '../../game/config/achievements';
import { HAPPINESS_ITEMS, STORIES, type HappinessItem } from '../../game/config/happiness';
import { GIFTS } from '../../game/config/mascot';
import { giftAvailable, giftPrice, redeemCost } from '../../game/commands';
import { formatHappiness, formatNumber } from '../../game/format';
import { Icon } from '../Icon';
import { MascotControls, StaminaBar, mascotStatus } from '../LumiaModal';
import { lumiaOpen, showToast, storyId, useGame } from '../store';

const TIERS: { tier: 1 | 2 | 3 | 4; title: string; hint: string }[] = [
  { tier: 1, title: '日常陪伴與小確幸', hint: '家具會出現在休息室' },
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

      <GiftCard />

      <div class="card">
        <div class="card-title">
          <Icon id="icon_happiness" /> 開心度兌換
          <span class="lv">♥ {formatHappiness(s.happiness)}</span>
        </div>
        <p class="hint">開心度來自：摸頭戳臉頰、她在休息室睡覺、每日第一次互動、達成成就。兌換只花整數部分。</p>
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

/** 用金幣送禮物：每天每種一次，價格跟著收入走 */
function GiftCard() {
  const game = useGame();
  const s = game.state;
  const today = game.today;
  return (
    <div class="card" id="lumia-gifts">
      <div class="card-title">🎁 送禮物給露米婭</div>
      <p class="hint">每天每種可以送一次（凌晨 4 點重置）。價格大約是目前幾分鐘的收入。</p>
      {GIFTS.map((g) => {
        const available = giftAvailable(s, g.id, today);
        const price = giftPrice(s, g.id);
        return (
          <div class="buy-row" key={g.id}>
            <div class="buy-text">
              <div class="buy-title"><Icon id={g.icon} /> {g.name}</div>
              <div class="buy-desc">開心度 +{g.happiness}（約 {g.minutes} 分鐘的收入）</div>
            </div>
            <button
              class="buy-btn" disabled={!available || s.gold < price}
              onClick={() => game.giveGift(g.id) && showToast(`露米婭：${g.line}（+${g.happiness} ♥）`)}
            >
              {available ? <><Icon id="icon_gold" size={1} /> {formatNumber(price)}</> : '今天送過了'}
            </button>
          </div>
        );
      })}
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

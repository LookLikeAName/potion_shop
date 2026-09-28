import { useState } from 'preact/hooks';
import { ART_URLS } from '../../assets/manifest';
import { ACHIEVEMENTS } from '../../game/config/achievements';
import { HAPPINESS_ITEMS, STORIES, type HappinessItem } from '../../game/config/happiness';
import { MASCOT } from '../../game/config/mascot';
import { redeemCost } from '../../game/commands';
import { formatHappiness } from '../../game/format';
import { EVENTS } from '../../game/config/events';
import { bondLevel, codexCount, happyMult, renownLevel, restHappinessPerSec } from '../../game/stats';
import { localized, t } from '../../i18n';
import { fmtHeart } from '../Happiness';
import { Icon } from '../Icon';
import { MascotControls, StaminaBar, mascotStatus } from '../LumiaModal';
import { lumiaOpen, openDrawer, showToast, storyId, useGame } from '../store';

/** 兌換的四個階層（標題與提示在語言檔 redeem.tier<n>.title／hint） */
const TIERS = ([1, 2, 3, 4] as const).map((tier) => localized({ tier }, `redeem.tier${tier}`, ['title', 'hint']));

export function LumiaPanel() {
  const game = useGame();
  const s = game.state;
  const done = ACHIEVEMENTS.filter((a) => s.achievements[a.id]).length;
  return (
    <div class="cards">
      <div class="card" id="lumia-status">
        <div class="card-title">
          <Icon id="lumia_chibi_idle" /> {t('common.lumia')}
          <button class="btn primary talk-btn" onClick={() => (lumiaOpen.value = true)}>{t('lumia.talk')}</button>
        </div>
        <StaminaBar s={s} />
        <p class="hint fixed-lines l2">{t('lumia.now', { status: mascotStatus(s) })}</p>
        <MascotControls />
      </div>

      <BondCard />

      <div class="card" id="lumia-redeem">
        <div class="card-title">
          <Icon id="icon_happiness" /> {t('redeem.title')}
          <span class="lv">♥ {formatHappiness(s.happiness)}</span>
        </div>
        <p class="hint">{t('redeem.intro')}</p>
        {TIERS.map((tier) => (
          <div key={tier.tier} class="tier">
            <div class="tier-title">{t('redeem.tierTitle', { n: tier.tier, title: tier.title })}<span class="tier-hint">{tier.hint}</span></div>
            {HAPPINESS_ITEMS.filter((i) => i.tier === tier.tier).map((i) => <RedeemRow key={i.id} item={i} />)}
          </div>
        ))}
      </div>

      <div class="card">
        <div class="card-title">{t('lumia.achievements')} <span class="lv">{done}/{ACHIEVEMENTS.length}</span></div>
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
      <div class="card-title"><Icon id="icon_happiness" /> {t('bond.title')} <span class="lv">{t('bond.mult', { x: mult.toFixed(2) })}</span></div>
      <div class="bond-grid">
        <span><em>{t('bond.renown')}</em><b>Lv {renown}</b><small>{t('bond.renownHow')}</small></span>
        <span><em>{t('bond.bond')}</em><b>Lv {bond}</b><small>{t('bond.bondHow')}</small></span>
      </div>
      <p class="hint">
        {t('bond.hint', { rest: fmtHeart(rest), hours: MASCOT.offlineHappyHours, wishes: s.stats.wishesDone })}
      </p>
      <button class="btn primary" onClick={() => openDrawer('decor')}>{t('bond.giftsBtn')}</button>
      <button class="btn primary" onClick={() => openDrawer('events')}>
        {t('bond.eventsBtn', { n: codexCount(s), total: EVENTS.length })}
      </button>
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
    else showToast(t('redeem.done', { name: item.name }));
  };

  return (
    <div class="buy-row">
      <div class="buy-text">
        <div class="buy-title">
          <Icon id={item.icon} /> {item.name}
          {owned > 0 && <span class="buy-status">{item.max === Infinity ? t('redeem.times', { n: owned }) : item.max > 1 ? `${owned}/${item.max}` : t('common.owned')}</span>}
        </div>
        <div class="buy-desc">{item.desc}</div>
      </div>
      {item.kind === 'story' && owned > 0 ? (
        <button class="buy-btn" onClick={() => (storyId.value = item.id)}>{t('redeem.replay')}</button>
      ) : (
        <button class="buy-btn heart" disabled={!affordable} onClick={buy}>
          {cost === null ? t('common.owned') : `♥ ${cost}`}
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
        <div class="cg">{cg ? <img src={cg} alt={story.title} /> : <span>{t('common.cgPending')}</span>}</div>
        <div class="speech story-line">{story.lines[i]}</div>
        <button class="btn primary" onClick={() => (last ? (storyId.value = null) : setI(i + 1))}>
          {last ? t('story.end') : t('story.next')}
        </button>
      </div>
    </div>
  );
}

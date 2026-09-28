import { useEffect, useState } from 'preact/hooks';
import { ART_URLS } from '../../assets/manifest';
import { ACHIEVEMENTS } from '../../game/config/achievements';
import { HAPPINESS_ITEMS, type HappinessItem } from '../../game/config/happiness';
import { SCENES, isScene, speakerName, type SceneId } from '../../game/config/story';
import { MASCOT } from '../../game/config/mascot';
import { redeemCost, redeemLock } from '../../game/commands';
import { formatHappiness } from '../../game/format';
import { EVENTS } from '../../game/config/events';
import { bondProgress, codexCount, happyMult, renownLevel, restHappinessPerSec } from '../../game/stats';
import { localized, t } from '../../i18n';
import { fmtHeart } from '../Happiness';
import { Glyph, Heart } from '../Glyph';
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
          <span class="lv"><Heart /> {formatHappiness(s.happiness)}</span>
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
        <div class="card-title"><Glyph id="icon_trophy" text="🏆" size={1.3} /> {t('lumia.achievements')} <span class="lv">{done}/{ACHIEVEMENTS.length}</span></div>
        <div class="achievements">
          {ACHIEVEMENTS.map((a) => (
            <div key={a.id} class={`ach ${s.achievements[a.id] ? 'done' : ''}`}>
              <span>{s.achievements[a.id] ? <Glyph id="icon_check" text="✔" size={0.9} /> : '・'} {a.name}</span>
              <span class="ach-reward">+{a.reward} <Heart size={0.85} /></span>
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
  const bond = bondProgress(s);
  const mult = happyMult(s);
  const rest = restHappinessPerSec(s) * 3600;
  return (
    <div class="card" id="lumia-bond">
      <div class="card-title"><Icon id="icon_happiness" /> {t('bond.title')} <span class="lv">{t('bond.mult', { x: mult.toFixed(2) })}</span></div>
      <div class="bond-grid">
        <span><em>{t('bond.renown')}</em><b>Lv {renown}</b><small>{t('bond.renownHow')}</small></span>
        <span>
          <em>{t('bond.bond')}</em><b>Lv {bond.level}</b>
          <small>{bond.next === null
            ? t('bond.bondMax', { n: fmtHeart(bond.earned) })
            : t('bond.bondNext', { n: fmtHeart(bond.earned), next: bond.next })}</small>
        </span>
      </div>
      <p class="hint">
        {t('bond.hint', { rest: fmtHeart(rest), hours: MASCOT.offlineHappyHours, wishes: s.stats.wishesDone })}
      </p>
      <button class="btn primary" onClick={() => openDrawer('decor')}><Glyph id="icon_gift" text="🎁" size={1.2} /> {t('bond.giftsBtn')}</button>
      <button class="btn primary" onClick={() => openDrawer('events')}>
        <Icon id="icon_event_book" size={1.2} /> {t('bond.eventsBtn', { n: codexCount(s), total: EVENTS.length })}
      </button>
    </div>
  );
}

function RedeemRow({ item }: { item: HappinessItem }) {
  const game = useGame();
  const s = game.state;
  const owned = s.redeemed[item.id] ?? 0;
  const cost = redeemCost(s, item.id);
  const lock = redeemLock(s, item.id);
  const affordable = cost !== null && !lock && Math.floor(s.happiness + 1e-9) >= cost;

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
        {lock && (
          <div class="buy-desc locked">
            {([['letters', 'redeem.lockLetters'], ['renown', 'redeem.lockRenown']] as const).map(([k, key]) => (
              <div key={k}>
                {lock[k].n >= lock[k].need ? <Glyph id="icon_check" text="✔" size={0.9} /> : <Glyph id="icon_lock" text="🔒" size={0.9} />}
                {' '}{t(key, lock[k])}
              </div>
            ))}
          </div>
        )}
      </div>
      {item.kind === 'story' && owned > 0 ? (
        <button class="buy-btn" onClick={() => (storyId.value = item.id)}>{t('redeem.replay')}</button>
      ) : (
        <button class="buy-btn heart" disabled={!affordable} onClick={buy}>
          {cost === null ? t('common.owned') : <><Heart /> {cost}</>}
        </button>
      )}
    </div>
  );
}

/** 劇情：逐句播放（劇本在 config/story.ts） */
export function StoryModal() {
  const id = storyId.value;
  if (!id || !isScene(id)) return null;
  return <Story key={id} id={id} />;
}

function Story({ id }: { id: SceneId }) {
  const game = useGame();
  const scene = SCENES[id];
  const [i, setI] = useState(0);
  const last = i >= scene.lines.length - 1;
  const line = scene.lines[i];
  const cg = scene.cg ? ART_URLS[scene.cg] : null;
  const end = () => {
    // 序章看完（或中途關掉）就算擁有，不會每次開遊戲都再播；之後可以在深層羈絆回顧
    if (id === 'opening' && !game.state.redeemed.opening) game.redeem('opening');
    storyId.value = null;
  };
  const next = () => (last ? end() : setI(i + 1));
  const prev = () => setI(Math.max(0, i - 1));
  // 鍵盤：← 上一句、→／Enter／空白鍵 下一句、Esc 關掉
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') prev();
      else if (e.key === 'ArrowRight' || e.key === 'Enter' || e.key === ' ') next();
      else if (e.key === 'Escape') end();
      else return;
      e.preventDefault();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });
  const name = speakerName(line.who);
  return (
    <div class="modal-back story-back">
      <div class={`modal story ${scene.cg ? '' : 'no-cg'}`}>
        <button class="close modal-close" onClick={end} aria-label={t('common.close')} title={t('story.close')}>
          <Glyph id="icon_close" text="✕" size={1.2} />
        </button>
        <h2>{scene.title}</h2>
        {scene.cg && <div class="cg">{cg ? <img src={cg} alt={scene.title} /> : <span>{t('common.cgPending')}</span>}</div>}
        <div class={`speech story-line who-${line.who}`} key={line.id}>
          {/* 名字後面接著動作（小字），台詞在下面；旁白沒有這一列 */}
          {(name || line.act) && (
            <div class="story-head">
              {name && <span class="story-name">{name}</span>}
              {line.act && <span class="story-act">{t('story.act', { act: line.act })}</span>}
            </div>
          )}
          {line.text && <div class="story-text">{line.text}</div>}
        </div>
        <div class="story-foot">
          <button class="btn story-prev" disabled={i === 0} onClick={prev}>{t('story.prev')}</button>
          <span class="story-page">{i + 1} / {scene.lines.length}</span>
          <button class="btn primary" onClick={next}>
            {last ? t('story.end') : t('story.next')}
          </button>
        </div>
      </div>
    </div>
  );
}

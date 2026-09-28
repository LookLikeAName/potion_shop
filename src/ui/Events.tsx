import { EVENT_MAP, LETTERS, MERCHANT_OFFERS, RARITY_NAMES, type MerchantOffer } from '../game/config/events';
import { buffLabel } from '../game/events';
import { t } from '../i18n';
import { formatSeconds } from '../game/format';
import { Glyph } from './Glyph';
import { Icon } from './Icon';
import { drawerOpen, letterOpen, storyId, useGame } from './store';

const clock = (sec: number) => {
  const s = Math.max(0, Math.ceil(sec));
  return s >= 60 ? `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}` : formatSeconds(s);
};

/** 畫面上方中央的事件橫幅：名稱、怎麼做、進度與剩餘時間；三選一的事件在這裡選 */
export function EventBanner() {
  const game = useGame();
  const a = game.state.events.active;
  if (!a) return null;
  const def = EVENT_MAP[a.id];
  let progress = '';
  if (def.kind === 'tap' && def.goal > 1) progress = `${a.hits} / ${def.goal}`;
  else if (def.kind === 'count') progress = `${a.hits} / ${def.goal}`;
  else if (def.kind === 'timing') progress = t('banner.timing', { left: def.goal - a.tries, hits: a.hits });
  return (
    <div class={`event-banner rarity-${def.rarity} ${drawerOpen.value ? 'shift' : ''}`}>
      <div class="event-head">
        <Icon id={def.icon} size={1.3} />
        <span class="event-name">{def.name}</span>
        <span class="event-rarity">{RARITY_NAMES[def.rarity]}</span>
        {!def.mainline && <span class={`event-time ${a.time <= 5 ? 'urgent' : ''}`}><Glyph id="icon_hourglass" text="⏳" size={0.95} /> {clock(a.time)}</span>}
      </div>
      <div class="event-prompt">{def.prompt}</div>
      {progress && <div class="event-progress">{progress}</div>}
      {a.id === 'merchant' && (
        <div class="event-choices">
          {a.options!.map((o, k) => {
            const offer = MERCHANT_OFFERS[o as MerchantOffer];
            return (
              <button key={o} class="event-choice" onClick={() => game.eventAction({ type: 'choose', index: k })}>
                <Icon id={offer.icon} size={1.6} />
                <b>{offer.name}</b>
                <small>{offer.desc}</small>
              </button>
            );
          })}
        </div>
      )}
      {a.id === 'fortune' && (
        <div class="event-choices">
          {a.options!.map((o, k) => (
            <button key={o} class="event-choice card-back" onClick={() => game.eventAction({ type: 'choose', index: k })}
              title={t('banner.flip')}>
              <span class="card-star"><Glyph id="icon_star" text="★" size={1.6} /></span>
              <small>{t('banner.cardN', { n: k + 1 })}</small>
            </button>
          ))}
        </div>
      )}
      {/* 主線事件不限時：不顯示倒數 */}
      {!def.mainline && <div class="event-bar"><div class="event-fill" style={{ width: `${(a.time / a.timeMax) * 100}%` }} /></div>}
    </div>
  );
}

/** 畫面左上角：事件給的限時增益與剩餘時間 */
export function BuffBar() {
  const game = useGame();
  const buffs = game.state.events.buffs;
  if (buffs.length === 0) return null;
  return (
    <div class="buff-bar">
      {buffs.map((b, k) => (
        <div class="buff" key={`${b.kind}:${b.target ?? ''}:${k}`} title={EVENT_MAP[b.source].name}>
          <Icon id={EVENT_MAP[b.source].icon} size={1} />
          <span>{buffLabel(b)}</span>
          <b>{clock(b.time)}</b>
        </div>
      ))}
    </div>
  );
}

/** 遠方的來信：稱呼、內文、結尾（靠右）；收好之後接著播露米婭的感想 */
export function LetterModal() {
  const i = letterOpen.value;
  if (i === null) return null;
  const l = LETTERS[i];
  const keep = () => {
    letterOpen.value = null;
    storyId.value = l.scene;
  };
  return (
    <div class="modal-back">
      <div class="modal letter">
        <h2><Glyph id="icon_letter" text="✉" alt="evt_letter" size={1.2} /> {l.title}</h2>
        {l.note && <div class="letter-note">{t('story.act', { act: l.note })}</div>}
        <div class={`letter-body letter-${i + 1}`}>
          <p class="letter-to">{l.to}</p>
          {l.body.map((p, k) => <p key={k}>{p}</p>)}
          <div class="letter-closing">
            {l.closing.map((p, k) => <p key={k}>{p}</p>)}
          </div>
        </div>
        <button class="btn primary" onClick={keep}>{t('letter.keep')}</button>
      </div>
    </div>
  );
}

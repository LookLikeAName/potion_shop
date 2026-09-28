import { ART_URLS, ASSET_MAP } from '../../assets/manifest';
import { GIFT_MAP } from '../../game/config/gifts';
import {
  EVENT, EVENTS, EVENT_INFO, EVENT_MAP, KIND_NAMES, LETTERS, RARITY_NAMES, eventRewardText, type EventDef,
} from '../../game/config/events';
import { codexCount, codexMilestones } from '../../game/stats';
import { t } from '../../i18n';
import { Glyph } from '../Glyph';
import { Icon } from '../Icon';
import { eventDetail, eventNewPage, letterOpen, openDrawer, useGame } from '../store';

/** 事件的圖；silhouette = 還沒完成，只顯示剪影 */
function EventArt({ def, silhouette }: { def: EventDef; silhouette: boolean }) {
  const url = ART_URLS[def.icon];
  if (url) return <img class={`gift-art ${silhouette ? 'silhouette' : ''}`} src={url} alt="" draggable={false} />;
  const a = ASSET_MAP[def.icon];
  const bg = silhouette ? '#3a2a20' : `#${(a?.color ?? 0x888888).toString(16).padStart(6, '0')}`;
  return (
    <span class={`gift-art ph ${silhouette ? 'silhouette' : ''}`} style={{ background: bg }}>
      {silhouette ? '?' : a?.label.replace('\n', '').slice(0, 2)}
    </span>
  );
}

/** 事件簿：只列出名稱與簡介，點一下打開詳細視窗；收集里程碑給永久收入加成 */
export function EventBookPanel() {
  const game = useGame();
  const s = game.state;
  const count = codexCount(s);
  const miles = codexMilestones();
  const reached = miles.filter((m) => count >= m).length;
  return (
    <div class="cards">
      <button class="btn back-btn" onClick={() => openDrawer('lumia', 'lumia-bond')}>{t('common.backToLumia')}</button>
      <div class="card" id="event-milestones">
        <div class="card-title">
          <Icon id="icon_event_book" /> {t('book.title')} <span class="lv">{count}/{EVENTS.length}</span>
        </div>
        <p class="hint">
          {t('book.intro', { every: EVENT.milestoneEvery, pct: EVENT.incomePerMilestone * 100 })}
        </p>
        <div class="milestones">
          {miles.map((m) => (
            <span key={m} class={`milestone ${count >= m ? 'done' : ''}`}>
              {count >= m ? <Glyph id="icon_check" text="✔" size={0.9} /> : '・'} {t(m === EVENTS.length ? 'book.milestoneAll' : 'book.milestone', { n: m, pct: EVENT.incomePerMilestone * 100 })}
            </span>
          ))}
        </div>
        <p class="hint">{t('book.bonus', { pct: Math.round(reached * EVENT.incomePerMilestone * 100), n: s.stats.eventsDone })}</p>
      </div>

      <div class="card" id="event-book">
        <div class="gift-book">
          {EVENTS.map((def, i) => {
            const e = s.events.codex[def.id];
            const done = (e?.done ?? 0) > 0;
            const seen = (e?.seen ?? 0) > 0;
            return (
              <button class={`gift-entry event-entry ${done ? 'owned' : 'unknown'}`} key={def.id} onClick={() => (eventDetail.value = def.id)}>
                <div class="gift-no">
                  No.{String(i + 1).padStart(2, '0')}
                  <span class={`event-rarity-chip r${def.rarity}`}>{RARITY_NAMES[def.rarity]}</span>
                </div>
                <div class="gift-frame"><EventArt def={def} silhouette={!done} /></div>
                <div class="gift-name">{done || seen ? def.name : t('common.unknown')}</div>
                <div class="gift-intro">{done ? EVENT_INFO[def.id].summary : seen ? t('book.seenShort') : def.hint}</div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/** 事件的詳細視窗：CG、故事、出現條件、操作、加成（還沒完成的只顯示提示） */
export function EventDetailModal() {
  const game = useGame();
  const id = eventDetail.value;
  if (!id) return null;
  const s = game.state;
  const def = EVENT_MAP[id];
  const e = s.events.codex[id];
  const done = (e?.done ?? 0) > 0;
  const seen = (e?.seen ?? 0) > 0;
  const idx = EVENTS.indexOf(def);
  const close = () => {
    eventDetail.value = null;
    eventNewPage.value = null;
  };
  const step = (d: number) => (eventDetail.value = EVENTS[(idx + d + EVENTS.length) % EVENTS.length].id);
  const fresh = eventNewPage.value === id;
  const cg = ART_URLS[`cg_evt_${id}`];
  const decor = def.decor ? GIFT_MAP[def.decor] : null;
  return (
    <div class="modal-back" onClick={(ev) => ev.target === ev.currentTarget && close()}>
      <div class={`modal event-detail rarity-${def.rarity}`}>
        <button class="close modal-close" onClick={close} aria-label={t('common.close')}><Glyph id="icon_close" text="✕" size={1.2} /></button>
        <div class="event-detail-head">
          <span class="gift-no">No.{String(idx + 1).padStart(2, '0')}</span>
          <h2>{done || seen ? def.name : t('common.unknown')}</h2>
          <span class={`event-rarity-chip r${def.rarity}`}>{RARITY_NAMES[def.rarity]}</span>
          {fresh && <span class="event-new-page"><Icon id="icon_event_book" size={1} /> {t('book.newPage')}</span>}
        </div>
        <div class={`cg event-cg ${done ? '' : 'locked'}`}>
          {done && cg ? <img src={cg} alt={def.name} />
            : <span class="event-cg-ph"><EventArt def={def} silhouette={!done} />{done && <small>{t('common.cgPending')}</small>}</span>}
        </div>
        {done ? (
          <div class="event-detail-body">
            <p class="event-story">{def.story}</p>
            <p class="event-lumia">{t('book.lumiaSays', { line: def.lumia })}</p>
            <dl class="event-facts">
              <dt>{t('book.need')}</dt><dd>{EVENT_INFO[id].need}</dd>
              <dt>{t('book.zone')}</dt><dd>{t(`book.zone.${def.zone}`)}{def.zone !== 'any' && t('book.zoneHint')}</dd>
              {decor && <><dt>{t('book.decor')}</dt><dd>{t('book.decorHint', { name: decor.name })}</dd></>}
              <dt>{t('book.kind')}</dt><dd>{t('book.kindLine', { kind: KIND_NAMES[def.kind], prompt: def.prompt, sec: def.time })}</dd>
              <dt>{t('book.rewards')}</dt>
              <dd><ul>{eventRewardText(id).map((t) => <li key={t}>{t}</li>)}</ul></dd>
              <dt>{t('book.record')}</dt><dd>{t('book.recordLine', { seen: e!.seen, done: e!.done })}</dd>
            </dl>
            {id === 'letter' && s.events.letters > 0 && (
              <div class="event-letters">
                {LETTERS.slice(0, s.events.letters).map((l, k) => (
                  <button key={k} class="buy-btn" onClick={() => (letterOpen.value = k)}><Glyph id="icon_letter" text="✉" alt="evt_letter" /> {l.title}</button>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div class="event-detail-body">
            <p class="event-story">{t(seen ? 'book.seenLong' : 'book.unseen')}</p>
            <p class="hint">{t('book.hint', { hint: def.hint })}</p>
            <p class="hint">{t('book.unlockHint')}</p>
          </div>
        )}
        <div class="event-detail-nav">
          <button class="btn" onClick={() => step(-1)}>{t('common.prev')}</button>
          <button class="btn" onClick={() => step(1)}>{t('common.next')}</button>
        </div>
      </div>
    </div>
  );
}


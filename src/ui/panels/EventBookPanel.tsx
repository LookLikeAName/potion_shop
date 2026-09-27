import { ART_URLS, ASSET_MAP } from '../../assets/manifest';
import { GIFT_MAP } from '../../game/config/gifts';
import {
  EVENT, EVENTS, EVENT_INFO, EVENT_MAP, KIND_NAMES, LETTERS, RARITY_NAMES, eventRewardText, type EventDef,
} from '../../game/config/events';
import { codexCount, codexMilestones } from '../../game/stats';
import { Icon } from '../Icon';
import { eventDetail, letterOpen, openDrawer, useGame } from '../store';

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
      <button class="btn back-btn" onClick={() => openDrawer('lumia', 'lumia-bond')}>◀ 回到露米婭</button>
      <div class="card" id="event-milestones">
        <div class="card-title">
          <Icon id="icon_event_book" /> 事件簿 <span class="lv">{count}/{EVENTS.length}</span>
        </div>
        <p class="hint">
          店裡偶爾會發生突發事件（只在畫面開著的時候），完成後就會記在這裡，點一下可以看詳細內容。
          錯過了也沒關係，之後還會再來。每收集 {EVENT.milestoneEvery} 種、以及全部收齊時，收入永久 +{EVENT.incomePerMilestone * 100}%；
          每種事件第一次完成時，露米婭也會開心一點。
        </p>
        <div class="milestones">
          {miles.map((m) => (
            <span key={m} class={`milestone ${count >= m ? 'done' : ''}`}>
              {count >= m ? '✔' : '・'} {m === EVENTS.length ? '全部收齊' : `收集 ${m} 種`}：收入 +{EVENT.incomePerMilestone * 100}%
            </span>
          ))}
        </div>
        <p class="hint">目前收入加成：+{Math.round(reached * EVENT.incomePerMilestone * 100)}%・已完成 {s.stats.eventsDone} 次事件</p>
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
                <div class="gift-name">{done || seen ? def.name : '？？？'}</div>
                <div class="gift-intro">{done ? EVENT_INFO[def.id].summary : seen ? '遇見過，但還沒完成。' : def.hint}</div>
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
  const close = () => (eventDetail.value = null);
  const step = (d: number) => (eventDetail.value = EVENTS[(idx + d + EVENTS.length) % EVENTS.length].id);
  const cg = ART_URLS[`cg_evt_${id}`];
  const decor = def.decor ? GIFT_MAP[def.decor] : null;
  return (
    <div class="modal-back" onClick={(ev) => ev.target === ev.currentTarget && close()}>
      <div class={`modal event-detail rarity-${def.rarity}`}>
        <button class="close modal-close" onClick={close} aria-label="關閉">✕</button>
        <div class="event-detail-head">
          <span class="gift-no">No.{String(idx + 1).padStart(2, '0')}</span>
          <h2>{done || seen ? def.name : '？？？'}</h2>
          <span class={`event-rarity-chip r${def.rarity}`}>{RARITY_NAMES[def.rarity]}</span>
        </div>
        <div class={`cg event-cg ${done ? '' : 'locked'}`}>
          {done && cg ? <img src={cg} alt={def.name} />
            : <span class="event-cg-ph"><EventArt def={def} silhouette={!done} />{done && <small>CG（正式美術之後加入）</small>}</span>}
        </div>
        {done ? (
          <div class="event-detail-body">
            <p class="event-story">{def.story}</p>
            <p class="event-lumia">露米婭：「{def.lumia}」</p>
            <dl class="event-facts">
              <dt>出現條件</dt><dd>{EVENT_INFO[id].need}</dd>
              <dt>出現區域</dt><dd>{ZONE_NAMES[def.zone]}{def.zone !== 'any' && '（露米婭在這一區工作時更常出現）'}</dd>
              {decor && <><dt>相關擺設</dt><dd>擺出「{decor.name}」時更常出現</dd></>}
              <dt>操作</dt><dd>{KIND_NAMES[def.kind]}：{def.prompt}（限時 {def.time} 秒）</dd>
              <dt>可以獲得</dt>
              <dd><ul>{eventRewardText(id).map((t) => <li key={t}>{t}</li>)}</ul></dd>
              <dt>紀錄</dt><dd>遇見 {e!.seen} 次・完成 {e!.done} 次</dd>
            </dl>
            {id === 'letter' && s.events.letters > 0 && (
              <div class="event-letters">
                {LETTERS.slice(0, s.events.letters).map((l, k) => (
                  <button key={k} class="buy-btn" onClick={() => (letterOpen.value = k)}>✉ {l.title}</button>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div class="event-detail-body">
            <p class="event-story">{seen ? '遇見過，但還沒完成。下次出現時試試看吧！' : '還沒遇見過的事件。'}</p>
            <p class="hint">提示：{def.hint}</p>
            <p class="hint">完成後會解鎖這個事件的圖、故事與詳細資訊。</p>
          </div>
        )}
        <div class="event-detail-nav">
          <button class="btn" onClick={() => step(-1)}>◀ 上一個</button>
          <button class="btn" onClick={() => step(1)}>下一個 ▶</button>
        </div>
      </div>
    </div>
  );
}

const ZONE_NAMES = { greenhouse: '溫室', cauldron: '大釜區', counter: '櫃台', rest: '休息室', any: '不分區' } as const;

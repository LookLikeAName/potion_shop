import { ART_URLS, ASSET_MAP } from '../../assets/manifest';
import { EVENT, EVENTS, LETTERS, RARITY_NAMES, type EventDef } from '../../game/config/events';
import { codexCount, codexMilestones } from '../../game/stats';
import { Icon } from '../Icon';
import { letterOpen, openDrawer, useGame } from '../store';

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

/** 事件簿：遇過的事件與故事；收集里程碑給永久收入加成 */
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
          店裡偶爾會發生突發事件（只在畫面開著的時候），完成後就會記在這裡。
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
              <div class={`gift-entry event-entry ${done ? 'owned' : 'unknown'}`} key={def.id}>
                <div class="gift-no">
                  No.{String(i + 1).padStart(2, '0')}
                  <span class={`event-rarity-chip r${def.rarity}`}>{RARITY_NAMES[def.rarity]}</span>
                </div>
                <div class="gift-frame"><EventArt def={def} silhouette={!done} /></div>
                <div class="gift-name">{done || seen ? def.name : '？？？'}</div>
                {done ? (
                  <>
                    <div class="gift-intro">{def.story}</div>
                    <div class="event-lumia">露米婭：「{def.lumia}」</div>
                    <div class="event-count">遇見 {e!.seen} 次・完成 {e!.done} 次</div>
                    {def.id === 'letter' && s.events.letters > 0 && (
                      <div class="event-letters">
                        {LETTERS.slice(0, s.events.letters).map((l, k) => (
                          <button key={k} class="buy-btn" onClick={() => (letterOpen.value = k)}>✉ {l.title}</button>
                        ))}
                      </div>
                    )}
                  </>
                ) : (
                  <div class="gift-intro">{seen ? '遇見過，但還沒完成。' : ''}{def.hint}</div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

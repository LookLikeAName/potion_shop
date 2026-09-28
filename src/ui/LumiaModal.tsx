import { useRef, useState } from 'preact/hooks';
import { ART_URLS } from '../assets/manifest';
import { ASSIGNMENTS, LINES, MASCOT, OUTFITS, type Assignment, type OutfitId, type Reaction, type TouchPart } from '../game/config/mascot';
import { outfitOwned } from '../game/commands';
import { formatHappiness } from '../game/format';
import { isRelaxing, isResting, isSleeping, isTired, workZone } from '../game/stats';
import type { GameState } from '../game/state';
import { t, tx } from '../i18n';
import { Glyph } from './Glyph';
import { lumiaOpen, useGame } from './store';

const pick = (lines: string[]) => lines[Math.floor(Math.random() * lines.length)];

const EXPRESSION: Record<Reaction, string> = {
  idle: 'happy', headpat: 'headpat', poke: 'poke', panic: 'panic', shy: 'shy',
};

/**
 * 立繪：依服裝與表情挑有正式圖的版本（服裝 + 表情 → 服裝基本 → 預設服裝表情 → 預設基本），
 * 都沒有就退回 Q 版圖
 */
function portraitUrl(outfit: OutfitId, reaction: Reaction): { url?: string; chibi: boolean } {
  const expr = EXPRESSION[reaction];
  const candidates = outfit === 'default'
    ? [`portrait_lumia_${expr}`, 'portrait_lumia_base']
    : [`portrait_lumia_${outfit}_${expr}`, `portrait_lumia_${outfit}`, `portrait_lumia_${expr}`, 'portrait_lumia_base'];
  for (const id of candidates) if (ART_URLS[id]) return { url: ART_URLS[id], chibi: false };
  const chibi = ART_URLS[`lumia_chibi_${outfit}_idle`] ?? ART_URLS.lumia_chibi_idle;
  return { url: chibi, chibi: true };
}

/** 目前狀態的一句話說明 */
export function mascotStatus(s: GameState): string {
  const m = s.mascot;
  if (m.autoRest) return t('status.exhausted');
  if (isRelaxing(s)) return t('status.relaxing');
  if (m.assignment === 'rest') return t('status.sleeping');
  const here = workZone(s);
  const zone = here ? ASSIGNMENTS[here].name : t('status.shop');
  const prefix = m.assignment === 'patrol' ? t('status.patrolPrefix') : '';
  return t(isTired(s) ? 'status.tired' : 'status.working', { prefix, zone });
}

export function StaminaBar({ s }: { s: GameState }) {
  const pct = (s.mascot.stamina / MASCOT.staminaMax) * 100;
  const color = pct < MASCOT.tiredBelow ? '#e0485f' : pct < 50 ? '#e8b93a' : '#6cc36a';
  return (
    <div class="meter">
      <span class="meter-label">{t('lumia.stamina')}</span>
      <div class="meter-track"><div class="meter-fill" style={{ width: `${pct}%`, background: color }} /></div>
      <span class="meter-value">{Math.floor(s.mascot.stamina)}</span>
    </div>
  );
}

/** 指派與服裝的按鈕（互動視窗與分頁共用） */
export function MascotControls() {
  const game = useGame();
  const s = game.state;
  const active = isResting(s) && s.mascot.autoRest ? null : s.mascot.assignment;
  return (
    <>
      <div class="chip-label">{t('lumia.assign')}</div>
      <div class="chips">
        {(Object.keys(ASSIGNMENTS) as Assignment[]).map((a) => (
          <button
            key={a} class={`chip ${active === a ? 'active' : ''}`} title={ASSIGNMENTS[a].desc}
            onClick={() => game.assignLumia(a)}
          >
            {ASSIGNMENTS[a].name}
          </button>
        ))}
      </div>
      {/* 說明固定留好行數：換指派、換服裝時說明變長，整個欄位才不會跟著變高 */}
      <p class="hint fixed-lines l3">{t('lumia.assignHint', { desc: ASSIGNMENTS[s.mascot.assignment].desc })}</p>
      <div class="chip-label">{t('lumia.outfit')}</div>
      <div class="chips">
        {(Object.keys(OUTFITS) as OutfitId[]).filter((o) => outfitOwned(s, o)).map((o) => (
          <button
            key={o} class={`chip ${s.mascot.outfit === o ? 'active' : ''}`} title={OUTFITS[o].desc}
            onClick={() => game.equipOutfit(o)}
          >
            {OUTFITS[o].name}
          </button>
        ))}
      </div>
      <p class="hint fixed-lines l2">{OUTFITS[s.mascot.outfit].desc}</p>
    </>
  );
}

interface Pop {
  id: number;
  text: string;
  x: number;
  y: number;
}

export function LumiaModal() {
  const game = useGame();
  const [reaction, setReaction] = useState<Reaction>('idle');
  const [line, setLine] = useState(() => pick(LINES.idle));
  const [pops, setPops] = useState<Pop[]>([]);
  const [anim, setAnim] = useState(0);
  const popId = useRef(0);
  if (!lumiaOpen.value) return null;
  const s = game.state;
  const portrait = portraitUrl(s.mascot.outfit, reaction);

  const touch = (part: TouchPart, e: MouseEvent) => {
    const r = game.touchLumia(part);
    setReaction(r.reaction);
    setLine((r.daily ? pick(LINES.daily) + '\n' : '') + pick(LINES[r.reaction]));
    setAnim((n) => n + 1);
    const rect = (e.currentTarget as HTMLElement).parentElement!.getBoundingClientRect();
    const text = r.gain > 0 ? `+${formatHappiness(r.gain).replace(/0+$/, '')} ♥${r.daily ? t('lumia.daily') : ''}` : r.reaction === 'panic' ? '！？' : '…';
    const id = ++popId.current;
    // 以視窗內的百分比定位，避免舞台縮放造成偏移
    const pop = { id, text, x: ((e.clientX - rect.left) / rect.width) * 100, y: ((e.clientY - rect.top) / rect.height) * 100 };
    setPops((p) => [...p, pop]);
    setTimeout(() => setPops((p) => p.filter((x) => x.id !== id)), 1100);
  };

  const energyPct = (s.mascot.energy / MASCOT.energyMax) * 100;
  const resting = isSleeping(s);

  return (
    <div class="modal-back" onClick={(e) => e.target === e.currentTarget && (lumiaOpen.value = false)}>
      <div class="modal lumia-modal">
        <button class="close modal-close" onClick={() => (lumiaOpen.value = false)} aria-label={t('common.close')}><Glyph id="icon_close" text="✕" size={1.2} /></button>
        <div class={`portrait ${portrait.chibi ? 'chibi' : ''} react-${reaction}`} key={anim}>
          {/* 觸碰區跟著圖片本身（圖片縮放、靠底對齊時，頭的判定才會在頭上）：上方是頭，下方是臉頰／身體 */}
          <div class="portrait-figure">
            {portrait.url && <img src={portrait.url} alt={t('common.lumia')} draggable={false} />}
            <button class="touch-zone head" aria-label={t('lumia.headpat')} onClick={(e) => touch('head', e)} />
            <button class="touch-zone cheek" aria-label={t('lumia.poke')} onClick={(e) => touch('cheek', e)} />
            {pops.map((p) => <span key={p.id} class="pop" style={{ left: `${p.x}%`, top: `${p.y}%` }}>{p.text}</span>)}
          </div>
        </div>
        <div class="lumia-side">
          <h2>{t('common.lumia')}</h2>
          <div class="speech">{resting && reaction === 'idle' ? t('lumia.asleep') : line}</div>
          <div class="meter">
            <span class="meter-label">{t('lumia.energy')}</span>
            <div class="meter-track"><div class="meter-fill" style={{ width: `${energyPct}%`, background: '#ff8fb8' }} /></div>
            <span class="meter-value">{Math.floor(s.mascot.energy)}</span>
          </div>
          <StaminaBar s={s} />
          <p class="hint">
            {tx('lumia.touchHint', { head: <b>{t('lumia.head')}</b>, cheek: <b>{t('lumia.cheek')}</b> }, { n: MASCOT.touchReward, daily: MASCOT.dailyBonus })}
          </p>
          <p class="hint fixed-lines l2">{t('lumia.now', { status: mascotStatus(s) })}</p>
          <MascotControls />
        </div>
      </div>
    </div>
  );
}

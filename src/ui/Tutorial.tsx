// 新手教學（邏輯在 game/tutorial.ts）：上方的教學卡（配合場景裡的箭頭），以及第二口大釜的說明視窗
import { INTRO_STEPS, tutorialStep } from '../game/tutorial';
import { t, tl } from '../i18n';
import { drawerOpen, storyId, useGame } from './store';

/** 一開始的四步：畫面上方的教學卡；事件進行中、劇情播放中先讓開 */
export function TutorialCard() {
  const game = useGame();
  const s = game.state;
  const step = tutorialStep(s);
  if (!step || step === 'order' || s.events.active || storyId.value) return null;
  const n = INTRO_STEPS.indexOf(step) + 1;
  return (
    <div class={`tutorial-card ${drawerOpen.value ? 'shift' : ''}`}>
      <div class="tutorial-head">
        <span class="tutorial-n">{t('tutorial.step', { n, total: INTRO_STEPS.length })}</span>
        <b>{t(`tutorial.${step}.title`)}</b>
        <button class="tutorial-skip" onClick={() => game.skipTutorial()}>{t('tutorial.skip')}</button>
      </div>
      <p>{t(`tutorial.${step}.body`)}</p>
      {/* 指派這一步沒有要點的東西：看完按「知道了」（真的換了指派也算） */}
      {step === 'assign' && <button class="btn primary" onClick={() => game.finishTutorial('assign')}>{t('tutorial.ok')}</button>}
    </div>
  );
}

/** 第一次有第二口大釜：說明順序（左邊先拿原料）與怎麼調換 */
export function CauldronOrderModal() {
  const game = useGame();
  if (tutorialStep(game.state) !== 'order' || storyId.value) return null;
  return (
    <div class="modal-back">
      <div class="modal tutorial-modal">
        <h2>{t('tutorial.order.title')}</h2>
        {tl('tutorial.order.body').map((p, k) => <p key={k}>{p}</p>)}
        <button class="btn primary" onClick={() => game.finishTutorial('order')}>{t('tutorial.ok')}</button>
      </div>
    </div>
  );
}

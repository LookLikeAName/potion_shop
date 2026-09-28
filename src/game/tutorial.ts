// 新手教學：只在新遊戲一開始出現，其他內容讓玩家自己摸索。
// 1. 點盆栽（第一次收成）→ 2. 點大釜（第一次熬出藥水）→ 3. 點客人結帳（第一次賣出）
// → 4. 露米婭可以指派到不同區域（按「知道了」，或真的換了指派）。
// 另外，第一次有第二口大釜時跳出視窗，說明大釜的順序（左邊先拿原料）與怎麼調換。
import type { GameEvent } from './sim';
import type { GameState } from './state';

export type TutorialStep = 'pot' | 'cauldron' | 'checkout' | 'assign' | 'order';

/** 一開始依序出現的步驟（order 另外在有第二口大釜時出現） */
export const INTRO_STEPS: TutorialStep[] = ['pot', 'cauldron', 'checkout', 'assign'];

/** 目前要顯示的教學；序章還沒看完、或都做完了 = null */
export function tutorialStep(s: GameState): TutorialStep | null {
  if (!s.redeemed.opening) return null;
  const intro = INTRO_STEPS.find((k) => !s.tutorial[k]);
  if (intro) return intro;
  if (s.cauldrons.length >= 2 && !s.tutorial.order) return 'order';
  return null;
}

/**
 * 客人會不會來：序章看完、教學走到「幫客人結帳」之後才開店（跳過教學的話馬上開店）。
 * 之前客人不來、也不累積來客計時，教學時不會一直堆積客人
 */
export function customersOpen(s: GameState): boolean {
  if (!s.redeemed.opening) return false;
  const step = tutorialStep(s);
  return step !== 'pot' && step !== 'cauldron';
}

/** 玩家做到了這一步要的事：收成、熬出藥水、賣出 */
export function noteTutorial(s: GameState, e: GameEvent): void {
  const step = tutorialStep(s);
  const done =
    (step === 'pot' && e.type === 'harvest')
    || (step === 'cauldron' && e.type === 'brewed')
    || (step === 'checkout' && e.type === 'sale');
  if (done) s.tutorial[step] = true;
}

/** 按「知道了」（或換了露米婭的指派）完成這一步 */
export function finishTutorial(s: GameState, step: TutorialStep): void {
  s.tutorial[step] = true;
}

/** 跳過教學：一開始的步驟全部當成做過（第二口大釜的說明也不再出現） */
export function skipTutorial(s: GameState): void {
  for (const k of [...INTRO_STEPS, 'order' as const]) s.tutorial[k] = true;
}

import { describe, expect, it } from 'vitest';
import { CUSTOMER } from '../src/game/config/balance';
import { SOURCE } from '../src/i18n';
import { parseSave } from '../src/game/save';
import { spawnCustomer, tick, type GameEvent, type SimContext } from '../src/game/sim';
import { createCauldron, createInitialState, createNewGame } from '../src/game/state';
import {
  INTRO_STEPS, customersOpen, finishTutorial, noteTutorial, skipTutorial, tutorialStep,
} from '../src/game/tutorial';

const ev = (type: 'harvest' | 'brewed' | 'sale') => ({ type }) as GameEvent;
const ctx = (): SimContext => ({ rng: () => 0.99, offline: false, emit: () => {} });

describe('新手教學', () => {
  it('序章看完才開始；盆栽 → 大釜 → 結帳 → 露米婭的指派，各自做到才往下', () => {
    const s = createNewGame();
    expect(tutorialStep(s)).toBeNull();
    s.redeemed.opening = 1;
    expect(tutorialStep(s)).toBe('pot');
    // 還沒輪到的步驟做了也不算
    noteTutorial(s, ev('sale'));
    noteTutorial(s, ev('brewed'));
    expect(tutorialStep(s)).toBe('pot');
    noteTutorial(s, ev('harvest'));
    expect(tutorialStep(s)).toBe('cauldron');
    noteTutorial(s, ev('brewed'));
    expect(tutorialStep(s)).toBe('checkout');
    noteTutorial(s, ev('sale'));
    expect(tutorialStep(s)).toBe('assign');
    finishTutorial(s, 'assign');
    expect(tutorialStep(s)).toBeNull();
  });

  it('第二口大釜：一開始的教學做完之後，第一次有兩口時說明一次', () => {
    const s = createNewGame();
    s.redeemed.opening = 1;
    for (const k of INTRO_STEPS) s.tutorial[k] = true;
    expect(tutorialStep(s)).toBeNull();
    s.cauldrons.push(createCauldron('focus'));
    expect(tutorialStep(s)).toBe('order');
    finishTutorial(s, 'order');
    expect(tutorialStep(s)).toBeNull();
  });

  it('跳過教學：全部當成做過；版本 6 之前的存檔也是', () => {
    const s = createNewGame();
    s.redeemed.opening = 1;
    skipTutorial(s);
    s.cauldrons.push(createCauldron('focus'));
    expect(tutorialStep(s)).toBeNull();
    const fresh = createNewGame();
    expect(parseSave(JSON.stringify({ version: 6, savedAt: 1, state: fresh }))!.state.tutorial).toEqual({});
    const old = parseSave(JSON.stringify({ version: 5, savedAt: 1, state: { ...fresh, version: 5 } }))!.state;
    old.cauldrons.push(createCauldron('focus'));
    expect(tutorialStep(old)).toBeNull();
    expect(old.tutorial.firstOrder).toBe(true);
    // 模擬與測試用的開局狀態：當成已經做完教學，照常營業
    expect(tutorialStep(createInitialState())).toBeNull();
    expect(customersOpen(createInitialState())).toBe(true);
  });

  it('每一步的文字都在語言檔裡', () => {
    const keys = [
      'tutorial.step', 'tutorial.skip', 'tutorial.ok', 'tutorial.order.title', 'tutorial.order.body',
      ...INTRO_STEPS.flatMap((k) => [`tutorial.${k}.title`, `tutorial.${k}.body`]),
    ];
    expect(keys.filter((k) => !(k in SOURCE))).toEqual([]);
  });
});

describe('開店：新遊戲的客人', () => {
  const run = (s: ReturnType<typeof createNewGame>, sec: number) => {
    const c = ctx();
    for (let t = 0; t < sec * 10; t++) tick(s, 0.1, c);
  };

  it('序章、盆栽、大釜這幾步客人不來，也不累積來客計時；走到結帳才開店', () => {
    const s = createNewGame();
    const timer = s.customerTimer;
    run(s, 300);
    expect(s.customers).toHaveLength(0);
    expect(s.customerTimer).toBe(timer);
    s.redeemed.opening = 1;
    run(s, 300);
    expect(s.customers).toHaveLength(0);
    s.tutorial.pot = true;
    s.tutorial.cauldron = true;
    expect(customersOpen(s)).toBe(true);
    // 照原本的開場間隔，第一位客人很快就來
    run(s, CUSTOMER.firstDelay + 1);
    expect(s.customers.length).toBeGreaterThan(0);
  });

  it('第一位客人只買一瓶（跳過教學也一樣），之後照常', () => {
    const s = createNewGame();
    s.redeemed.opening = 1;
    skipTutorial(s);
    expect(customersOpen(s)).toBe(true);
    s.cauldrons.push(createCauldron('focus'), createCauldron('elixir'));
    s.cauldrons.forEach((c) => (c.level = 50));
    const first = spawnCustomer(s, ctx());
    expect(first.lines).toEqual([expect.objectContaining({ qty: 1 })]);
    // 第二位起：rng 0.99 → 三種藥水、數量乘上大釜等級
    const second = spawnCustomer(s, ctx());
    expect(second.lines.length).toBeGreaterThan(1);
  });
});

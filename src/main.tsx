import { render } from 'preact';
import { TabLock } from './engine/tabLock';
import { Game } from './game/game';
import { createScene } from './render/scene';
import { H, W } from './render/layout';
import { App } from './ui/App';
import { bindGame, lockState, offlineReport, showToast, uiTick } from './ui/store';
import './ui/styles.css';

const AUTOSAVE_MS = 30_000;
const BACKGROUND_TICK_MS = 1000;

/** 把 1920×1080 的舞台等比縮放到視窗大小；UI 在小螢幕上放大一些 */
function fitStage(stage: HTMLElement): number {
  const scale = Math.min(window.innerWidth / W, window.innerHeight / H);
  stage.style.transform = `translate(-50%, -50%) scale(${scale})`;
  stage.style.setProperty('--uiz', String(Math.min(1.8, Math.max(1, 0.55 / scale))));
  return scale;
}

async function main() {
  const stage = document.getElementById('stage')!;
  const scale = fitStage(stage);
  window.addEventListener('resize', () => fitStage(stage));

  const lock = new TabLock();
  const hasLock = await lock.tryAcquire();

  const game = Game.fromStorage();
  game.onOffline = (r) => {
    if (r.seconds >= 60) offlineReport.value = r;
  };
  game.subscribe(() => uiTick.value++);
  // 開發模式下方便在瀏覽器主控台檢查狀態
  if (import.meta.env.DEV) Object.assign(window, { __game: game });
  if (!hasLock) {
    game.pause();
    lockState.value = 'blocked';
  }

  lock.onLost = () => {
    game.save();
    game.pause();
    lockState.value = 'lost';
  };

  bindGame(game, async () => {
    await lock.takeover();
    game.reload();
    lockState.value = 'ok';
  });

  render(<App />, document.getElementById('ui')!);

  const resolution = Math.min(2, Math.max(0.75, scale * (window.devicePixelRatio || 1)));
  await createScene(document.getElementById('scene')!, game, resolution);

  // 背景分頁時畫面更新會停止，靠計時器繼續推進（瀏覽器可能把它降到每分鐘一次，
  // 所以 Game 以真實經過時間計算）
  setInterval(() => game.advance(), BACKGROUND_TICK_MS);
  setInterval(() => game.save(), AUTOSAVE_MS);
  // 小心願只在分頁在前景時進行：切到背景前先把前景的時間算完，回來時先補算背景的時間
  game.setForeground(document.visibilityState === 'visible');
  document.addEventListener('visibilitychange', () => {
    const visible = document.visibilityState === 'visible';
    game.advance();
    game.setForeground(visible);
    if (!visible) game.save();
  });
  window.addEventListener('pagehide', () => game.save());
}

main().catch((err) => {
  console.error(err);
  showToast('遊戲載入失敗，請重新整理頁面');
});

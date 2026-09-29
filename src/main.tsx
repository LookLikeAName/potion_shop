import { render } from 'preact';
import { TabLock } from './engine/tabLock';
import { installAudioUnlock, onAudioUnlock } from './audio/engine';
import { playMusic, trackFor } from './audio/music';
import { loadVoiceManifest } from './audio/voice';
import { sceneReady, startPreload } from './assets/preload';
import { t } from './i18n';
import { initI18n } from './i18n/load';
import { installCursors } from './ui/cursors';
import { installUiArt } from './ui/uiArt';
import { Game } from './game/game';
import { createScene } from './render/scene';
import { H, W } from './render/layout';
import { App } from './ui/App';
import { bindGame, lockState, offlineReport, showToast, takeRememberedTitle, titleOpen, uiTick } from './ui/store';
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
  // 先決定語言、載入語言檔，之後所有文字才查得到
  await initI18n();
  // 聲音：第一次點擊／按鍵時喚醒；先讀語音清單（音效在素材預先下載的最後一批準備）
  installAudioUnlock();
  void loadVoiceManifest();
  // 配樂：第一次操作之後開始播（瀏覽器不讓網頁自己出聲）
  onAudioUnlock(() => playMusic(trackFor('main')));
  installCursors();
  installUiArt();
  const stage = document.getElementById('stage')!;
  const scale = fitStage(stage);
  window.addEventListener('resize', () => fitStage(stage));

  const lock = new TabLock();
  const hasLock = await lock.tryAcquire();

  const game = Game.fromStorage();
  // 素材下載完之前都停在標題畫面（顯示進度）。第一次進入遊戲、或在標題畫面換了語言而重新載入的，
  // 下載完之後留在標題畫面等玩家按開始；其他人下載完直接進遊戲
  const stayOnTitle = takeRememberedTitle() || game.isNew;
  titleOpen.value = true;
  game.onOffline = (r) => {
    if (r.seconds >= 60) offlineReport.value = r;
  };
  game.subscribe(() => uiTick.value++);
  // 開發模式：主控台指令（__game、__events.help()）。正式建置時這段與 devCommands 整個被拿掉
  if (import.meta.env.DEV) void import('./dev/devCommands').then((m) => m.installDevCommands(game));
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

  // 依優先順序下載素材：標題的標誌與背景 → 場景貼圖 → 其餘
  const preload = startPreload({ opening: !game.state.redeemed.opening, outfit: game.state.mascot.outfit });
  void preload.all.then(() => {
    if (!stayOnTitle) titleOpen.value = false;
  });
  await preload.scene;
  const resolution = Math.min(2, Math.max(0.75, scale * (window.devicePixelRatio || 1)));
  await createScene(document.getElementById('scene')!, game, resolution);
  // 等場景畫出第一格，再把標題畫面的背景換成實際的遊戲畫面
  requestAnimationFrame(() => requestAnimationFrame(() => { sceneReady.value = true; }));

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
  showToast(t('common.loadFailed'));
});

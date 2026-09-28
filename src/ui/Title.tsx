// 標題畫面：背景是實際的遊戲畫面（變暗；開著標題時不計算產量）。
// 素材下載完之前顯示進度條、不能開始；場景還沒畫好時先用主背景圖墊著。
import { ART_URLS } from '../assets/manifest';
import { assetsReady, loadProgress, sceneReady } from '../assets/preload';
import { currentLang, t } from '../i18n';
import { drawerOpen, drawerTab, titleOpen, useGame } from './store';

export function TitleScreen() {
  const game = useGame();
  if (!titleOpen.value) return null;
  const fullLogo = ART_URLS[`ui_logo_${currentLang()}`];
  const emblem = ART_URLS.ui_title_logo;
  const bg = ART_URLS.bg_dollhouse_main;
  const started = !!game.state.redeemed.opening;
  const ready = assetsReady.value;
  const { done, total } = loadProgress.value;
  const pct = Math.floor((done / Math.max(1, total)) * 100);
  const settings = () => { drawerTab.value = 'settings'; drawerOpen.value = true; };
  const start = () => { drawerOpen.value = false; titleOpen.value = false; };
  return (
    <div class="title-screen">
      {bg && <div class={`title-backdrop${sceneReady.value ? ' hidden' : ''}`} style={{ backgroundImage: `url("${bg}")` }} />}
      <div class="title-logo">
        {fullLogo
          ? <img class="title-logo-full" src={fullLogo} alt={t('app.title')} />
          : (<>{emblem && <img class="title-emblem" src={emblem} alt="" />}<h1 class="title-name">{t('app.title')}</h1></>)}
      </div>
      <div class="title-buttons">
        {ready
          ? <button class="btn primary title-btn title-start" onClick={start}>{t(started ? 'title.continue' : 'title.start')}</button>
          : (
            <div class="title-loading" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct}>
              <div class="title-loading-bar"><div class="title-loading-fill" style={{ width: `${pct}%` }} /></div>
              <div class="title-loading-text">{t('title.loading', { pct })}</div>
            </div>
          )}
        <button class="btn title-btn" onClick={settings}>{t('title.settings')}</button>
      </div>
    </div>
  );
}

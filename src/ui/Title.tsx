// 標題畫面：第一次進入遊戲（沒有存檔、或重新開始）時顯示，之後可以從設定回到這裡。
// 背景是實際的遊戲畫面（調暗；標題畫面開著時遊戲不前進，見 Game.setTitleHold）。
// 標誌用各語言做好的完整標誌 ui_logo_<語言>；沒有的語言用沒有文字的外框 ui_title_logo 疊上遊戲名稱，
// 外框也沒有時只顯示文字。
import { ART_URLS } from '../assets/manifest';
import { currentLang, t } from '../i18n';
import { drawerOpen, drawerTab, titleOpen, useGame } from './store';

export function TitleScreen() {
  const game = useGame();
  if (!titleOpen.value) return null;
  const fullLogo = ART_URLS[`ui_logo_${currentLang()}`];
  const emblem = ART_URLS.ui_title_logo;
  // 已經看過序章：從設定回到標題的，按鈕是「繼續」
  const started = !!game.state.redeemed.opening;
  const settings = () => {
    drawerTab.value = 'settings';
    drawerOpen.value = true;
  };
  const start = () => {
    drawerOpen.value = false;
    titleOpen.value = false;
  };
  return (
    <div class="title-screen">
      <div class="title-logo">
        {fullLogo ? (
          <img class="title-logo-full" src={fullLogo} alt={t('app.title')} />
        ) : (
          <>
            {emblem && <img class="title-emblem" src={emblem} alt="" />}
            <h1 class="title-name">{t('app.title')}</h1>
          </>
        )}
      </div>
      <div class="title-buttons">
        <button class="btn primary title-btn" onClick={start}>{t(started ? 'title.continue' : 'title.start')}</button>
        <button class="btn title-btn" onClick={settings}>{t('title.settings')}</button>
      </div>
    </div>
  );
}

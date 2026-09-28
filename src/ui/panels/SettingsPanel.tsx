import { useState } from 'preact/hooks';
import { formatDuration, formatNumber } from '../../game/format';
import { clearSave, exportSave, importSave, toSaveFile } from '../../game/save';
import { createInitialState } from '../../game/state';
import { currentLang, t, tx, type Lang } from '../../i18n';
import { availableLangs, switchLang } from '../../i18n/load';
import { showToast, useGame } from '../store';

/** 遊玩時間：合計 = 遊戲開著（其中畫面在前景）＋ 離開（關掉遊戲、離線） */
function PlayTime() {
  const st = useGame().state.stats;
  const total = st.playOnline + st.playAway;
  return (
    <div class="play-time">
      <div class="play-total">{tx('settings.playTotal', { t: <b>{formatDuration(total)}</b> })}</div>
      <div class="stats">
        <span>{tx('settings.playFront', { t: <b>{formatDuration(st.playForeground)}</b> })}</span>
        <span>{tx('settings.playBack', { t: <b>{formatDuration(Math.max(0, st.playOnline - st.playForeground))}</b> })}</span>
        <span>{tx('settings.playAway', { t: <b>{formatDuration(st.playAway)}</b> })}</span>
      </div>
    </div>
  );
}

export function SettingsPanel() {
  const game = useGame();
  const s = game.state;
  const [exported, setExported] = useState('');
  const [importText, setImportText] = useState('');
  const [confirmReset, setConfirmReset] = useState(false);

  const doExport = async () => {
    const str = exportSave(s);
    setExported(str);
    try {
      await navigator.clipboard.writeText(str);
      showToast(t('settings.copied'));
    } catch {
      showToast(t('settings.copyManual'));
    }
  };

  const doImport = () => {
    const save = importSave(importText);
    if (!save) {
      showToast(t('settings.invalid'));
      return;
    }
    game.replaceState(save);
    setImportText('');
    showToast(t('settings.imported'));
  };

  const doReset = () => {
    if (!confirmReset) {
      setConfirmReset(true);
      return;
    }
    clearSave();
    game.replaceState(toSaveFile(createInitialState()));
    setConfirmReset(false);
    showToast(t('settings.resetDone'));
  };

  const changeLang = (l: Lang) => {
    if (l === currentLang()) return;
    game.save();
    switchLang(l);
  };

  return (
    <div class="cards">
      {/* 有第二種語言的語言檔時才出現 */}
      {availableLangs().length > 1 && <div class="card">
        <div class="card-title">{t('settings.language')}</div>
        <div class="chips">
          {availableLangs().map((l) => (
            <button key={l.id} class={`chip ${currentLang() === l.id ? 'active' : ''}`} onClick={() => changeLang(l.id)}>
              {l.name}
            </button>
          ))}
        </div>
      </div>}
      <div class="card">
        <div class="card-title">{t('settings.stats')}</div>
        <PlayTime />
        <div class="stats">
          <span>{t('settings.goldEarned', { n: formatNumber(s.stats.goldEarned) })}</span>
          <span>{t('settings.potionsSold', { n: formatNumber(s.stats.potionsSold) })}</span>
          <span>{t('settings.customersServed', { n: formatNumber(s.stats.customersServed) })}</span>
          <span>{t('settings.rushServed', { n: formatNumber(s.stats.rushServed) })}</span>
          <span>{t('settings.wholesaled', { n: formatNumber(s.stats.potionsWholesaled) })}</span>
        </div>
      </div>
      <div class="card">
        <div class="card-title">{t('settings.save')}</div>
        <p class="hint">{t('settings.saveHint')}</p>
        <div class="row">
          <button class="btn" onClick={() => { game.save(); showToast(t('settings.saved')); }}>{t('settings.saveNow')}</button>
          <button class="btn" onClick={doExport}>{t('settings.export')}</button>
        </div>
        {exported && <textarea class="save-text" readOnly value={exported} onFocus={(e) => e.currentTarget.select()} />}
        <textarea
          class="save-text" placeholder={t('settings.importPlaceholder')}
          value={importText} onInput={(e) => setImportText(e.currentTarget.value)}
        />
        <div class="row">
          <button class="btn" disabled={!importText.trim()} onClick={doImport}>{t('settings.import')}</button>
          <button class={`btn danger`} onClick={doReset}>{t(confirmReset ? 'settings.resetConfirm' : 'settings.reset')}</button>
        </div>
      </div>
    </div>
  );
}

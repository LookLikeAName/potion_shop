import { useState } from 'preact/hooks';
import { formatDuration, formatNumber } from '../../game/format';
import { clearSave, exportSave, importSave, toSaveFile } from '../../game/save';
import { createNewGame } from '../../game/state';
import { currentLang, t, tx, type Lang } from '../../i18n';
import { availableLangs, switchLang } from '../../i18n/load';
import { drawerOpen, rememberTitle, showToast, titleOpen, useGame } from '../store';
import { perf, setPerf, type PerfSettings } from '../../render/perf';

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

/** 效能：特效、飄字、更新率、畫質（只影響畫面；存在這台裝置） */
function PerfSettingsCard() {
  const p = perf.value;
  const row = <K extends keyof PerfSettings>(key: K, label: string, options: [PerfSettings[K], string][]) => (
    <div class="perf-row">
      <span class="perf-label">{label}</span>
      <div class="chips">
        {options.map(([v, name]) => (
          <button key={String(v)} class={`chip ${p[key] === v ? 'active' : ''}`} onClick={() => setPerf({ [key]: v } as Partial<PerfSettings>)}>
            {name}
          </button>
        ))}
      </div>
    </div>
  );
  return (
    <div class="card">
      <div class="card-title">{t('settings.perf')}</div>
      <p class="hint">{t('settings.perfHint')}</p>
      {row('effects', t('settings.effects'), [['full', t('settings.effects.full')], ['lite', t('settings.effects.lite')], ['min', t('settings.effects.min')]])}
      {row('floats', t('settings.floats'), [
        ['many', t('settings.floats.many')], ['normal', t('settings.floats.normal')], ['few', t('settings.floats.few')], ['key', t('settings.floats.key')],
      ])}
      {row('fps', t('settings.fps'), [[60, t('settings.fpsN', { n: 60 })], [30, t('settings.fpsN', { n: 30 })]])}
      {row('quality', t('settings.quality'), [['high', t('settings.quality.high')], ['low', t('settings.quality.low')]])}
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
    // 重新開始 = 新遊戲：回到標題畫面，按「開始」後播序章、走新手教學
    game.replaceState(toSaveFile(createNewGame()));
    setConfirmReset(false);
    showToast(t('settings.resetDone'));
    drawerOpen.value = false;
    titleOpen.value = true;
  };

  const backToTitle = () => {
    game.save();
    drawerOpen.value = false;
    titleOpen.value = true;
  };

  const changeLang = (l: Lang) => {
    if (l === currentLang()) return;
    game.save();
    // 在標題畫面換語言：重新載入之後回到標題畫面
    if (titleOpen.value) rememberTitle();
    switchLang(l);
  };

  return (
    <div class="cards">
      {/* 在標題畫面打開設定時不用再回到標題 */}
      {!titleOpen.value && (
        <div class="card">
          <button class="btn" onClick={backToTitle}>{t('settings.backToTitle')}</button>
        </div>
      )}
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
      <PerfSettingsCard />
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

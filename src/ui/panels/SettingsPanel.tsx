import { useState } from 'preact/hooks';
import { formatNumber } from '../../game/format';
import { clearSave, exportSave, importSave, toSaveFile } from '../../game/save';
import { createInitialState } from '../../game/state';
import { showToast, useGame } from '../store';

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
      showToast('存檔字串已複製到剪貼簿');
    } catch {
      showToast('請手動複製下方的存檔字串');
    }
  };

  const doImport = () => {
    const save = importSave(importText);
    if (!save) {
      showToast('存檔字串無效');
      return;
    }
    game.replaceState(save);
    setImportText('');
    showToast('存檔已匯入');
  };

  const doReset = () => {
    if (!confirmReset) {
      setConfirmReset(true);
      return;
    }
    clearSave();
    game.replaceState(toSaveFile(createInitialState()));
    setConfirmReset(false);
    showToast('已重新開始');
  };

  return (
    <div class="cards">
      <div class="card">
        <div class="card-title">統計</div>
        <div class="stats">
          <span>累計金幣 {formatNumber(s.stats.goldEarned)}</span>
          <span>賣出藥水 {formatNumber(s.stats.potionsSold)}</span>
          <span>服務顧客 {formatNumber(s.stats.customersServed)}</span>
          <span>完成急單 {formatNumber(s.stats.rushServed)}</span>
          <span>收購箱收購 {formatNumber(s.stats.potionsWholesaled)} 瓶</span>
        </div>
      </div>
      <div class="card">
        <div class="card-title">存檔</div>
        <p class="hint">遊戲每 30 秒自動存檔。清除瀏覽器資料會讓存檔消失，建議定期匯出備份。</p>
        <div class="row">
          <button class="btn" onClick={() => { game.save(); showToast('已存檔'); }}>立即存檔</button>
          <button class="btn" onClick={doExport}>匯出存檔</button>
        </div>
        {exported && <textarea class="save-text" readOnly value={exported} onFocus={(e) => e.currentTarget.select()} />}
        <textarea
          class="save-text" placeholder="貼上存檔字串後按「匯入」"
          value={importText} onInput={(e) => setImportText(e.currentTarget.value)}
        />
        <div class="row">
          <button class="btn" disabled={!importText.trim()} onClick={doImport}>匯入</button>
          <button class={`btn danger`} onClick={doReset}>{confirmReset ? '確定要刪除全部進度？' : '重新開始'}</button>
        </div>
      </div>
    </div>
  );
}

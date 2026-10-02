// 瀏覽器端：決定語言、載入語言檔（只在 main.tsx 用；模擬與測試不經過這裡，一律是原文）
import { LANGS, SOURCE_LANG, t, useDict, type Dict, type Lang } from '.';

const STORAGE_KEY = 'idle-potion-shop-lang';

/** 翻譯好的語言檔（依語言分開打包，用到才下載；原文已經直接打包在 i18n/index.ts） */
const FILES = import.meta.glob<Dict>(['../locales/*/*.json', '!../locales/zh-TW/*.json'], { import: 'default' });

function filesOf(l: Lang): (() => Promise<Dict>)[] {
  return Object.entries(FILES).filter(([path]) => path.startsWith(`../locales/${l}/`)).map(([, load]) => load);
}

/** 有語言檔的語言（原文一定有） */
export function availableLangs(): typeof LANGS {
  return LANGS.filter((l) => l.id === SOURCE_LANG || filesOf(l.id).length > 0);
}

function detect(): Lang {
  const ok = new Set(availableLangs().map((l) => l.id));
  let saved: string | null = null;
  try {
    saved = localStorage.getItem(STORAGE_KEY);
  } catch {
    // 無痕模式等情況讀不到，用預設語言
  }
  if (saved && ok.has(saved as Lang)) return saved as Lang;
  // 沒選過語言：看使用者系統（瀏覽器）的第一語言。中文（不分地區）→ 繁體中文、日文 → 日文、其他 → 英文；
  // 玩家在設定裡換過語言就記住
  return systemLang(ok);
}

function systemLang(ok: Set<Lang>): Lang {
  const tag = (navigator.languages?.[0] ?? navigator.language ?? '').toLowerCase();
  const want: Lang = tag.startsWith('zh') ? SOURCE_LANG : tag.startsWith('ja') ? 'ja' : 'en';
  return ok.has(want) ? want : SOURCE_LANG;
}

export async function initI18n(): Promise<void> {
  const l = detect();
  if (l !== SOURCE_LANG) {
    const parts = await Promise.all(filesOf(l).map((load) => load()));
    useDict(l, Object.assign({}, ...parts));
  }
  document.documentElement.lang = l === 'zh-TW' ? 'zh-Hant' : l;
  // index.html 裡的文字（原文寫死在 HTML，換語言時在這裡蓋掉）
  document.title = t('app.title');
  const rotate = document.getElementById('rotate-hint');
  if (rotate) rotate.textContent = t('app.rotate');
}

/** 換語言：記下來後重新載入頁面（場景裡的文字都是建立時決定的，重新載入最單純） */
export function switchLang(l: Lang): void {
  try {
    localStorage.setItem(STORAGE_KEY, l);
  } catch {
    // 存不了就只換這一次
  }
  location.reload();
}

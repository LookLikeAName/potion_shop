// 多語言：所有給玩家看的文字都放在 src/locales/<語言>/*.json，程式裡用 key 取用。
// 原文是繁體中文（zh-TW），其他語言由 tools/translate 產生；缺的 key 自動退回中文。
//
// 文字格式：
// - {name}：換成變數
// - {n|單數|複數}：依 n 的數量選字（英文用；中日文不需要），例如 "{n} {n|potion|potions}"
// - 值可以是字串陣列（隨機台詞、多行劇情）
import zhDialogue from '../locales/zh-TW/dialogue.json';
import zhEvents from '../locales/zh-TW/events.json';
import zhItems from '../locales/zh-TW/items.json';
import zhUi from '../locales/zh-TW/ui.json';

export type Lang = 'zh-TW' | 'ja' | 'en';
export type Dict = Record<string, string | string[]>;
export type Vars = Record<string, string | number>;

export const LANGS: { id: Lang; name: string }[] = [
  { id: 'zh-TW', name: '繁體中文' },
  { id: 'ja', name: '日本語' },
  { id: 'en', name: 'English' },
];

export const SOURCE_LANG: Lang = 'zh-TW';
/** 原文（永遠載入，其他語言缺字時退回這裡） */
export const SOURCE: Dict = { ...zhUi, ...zhItems, ...zhEvents, ...zhDialogue };

let lang: Lang = SOURCE_LANG;
let dict: Dict = SOURCE;
let plural = new Intl.PluralRules(SOURCE_LANG);

export function currentLang(): Lang {
  return lang;
}

/** 換成已經載入好的語言字典（由 i18n/load.ts 呼叫；測試也可以直接用） */
export function useDict(l: Lang, d: Dict): void {
  lang = l;
  dict = l === SOURCE_LANG ? SOURCE : d;
  plural = new Intl.PluralRules(l);
}

function lookup(key: string): string | string[] | undefined {
  return dict[key] ?? SOURCE[key];
}

export function hasText(key: string): boolean {
  return lookup(key) !== undefined;
}

const TOKEN = /\{(\w+)(?:\|([^|}]*)\|([^}]*))?\}/g;

function fill(s: string, vars: Vars): string {
  return s.replace(TOKEN, (m, name: string, one?: string, other?: string) => {
    const v = vars[name];
    if (v === undefined) return m;
    if (one !== undefined) return plural.select(Number(v)) === 'one' ? one : other!;
    return String(v);
  });
}

/** 取一段文字（陣列會用換行接起來）；找不到時回傳 key，方便發現漏掉的字 */
export function t(key: string, vars?: Vars): string {
  const v = lookup(key);
  if (v === undefined) return key;
  const s = Array.isArray(v) ? v.join('\n') : v;
  return vars ? fill(s, vars) : s;
}

/** 取一組文字（隨機台詞、多行劇情） */
export function tl(key: string, vars?: Vars): string[] {
  const v = lookup(key);
  if (v === undefined) return [key];
  const arr = Array.isArray(v) ? v : [v];
  return vars ? arr.map((s) => fill(s, vars)) : arr;
}

/**
 * 文字裡夾著元件（例如粗體的數字）：把 {name} 換成 parts[name]，回傳陣列直接放進 JSX。
 * 其他變數照 t() 的規則。
 */
export function tx<T>(key: string, parts: Record<string, T>, vars?: Vars): (string | T)[] {
  const s = t(key, vars);
  const out: (string | T)[] = [];
  let last = 0;
  for (const m of s.matchAll(/\{(\w+)\}/g)) {
    if (!(m[1] in parts)) continue;
    if (m.index > last) out.push(s.slice(last, m.index));
    out.push(parts[m[1]]);
    last = m.index + m[0].length;
  }
  if (last < s.length) out.push(s.slice(last));
  return out;
}

/**
 * 讓設定資料的文字欄位變成「讀取時才查字典」：obj.name → t(`${prefix}.name`)。
 * 設定檔只留 ID 與數值，文字全部在語言檔裡。
 */
export function localized<T extends object, const F extends string>(
  obj: T, prefix: string, fields: readonly F[], vars?: () => Vars,
): T & { readonly [K in F]: string } {
  for (const f of fields) {
    Object.defineProperty(obj, f, { get: () => t(`${prefix}.${f}`, vars?.()), enumerable: true, configurable: true });
  }
  return obj as T & { readonly [K in F]: string };
}

/** 同上，欄位是字串陣列 */
export function localizedList<T extends object, const F extends string>(
  obj: T, prefix: string, fields: readonly F[],
): T & { readonly [K in F]: string[] } {
  for (const f of fields) {
    Object.defineProperty(obj, f, { get: () => tl(`${prefix}.${f}`), enumerable: true, configurable: true });
  }
  return obj as T & { readonly [K in F]: string[] };
}

/** 陣列裡隨機挑一句 */
export function pickLine(key: string): string {
  const arr = tl(key);
  return arr[Math.floor(Math.random() * arr.length)];
}

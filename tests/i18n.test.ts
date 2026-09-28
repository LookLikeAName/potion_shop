import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { SOURCE, SOURCE_LANG, t, tl, tx, useDict, type Dict } from '../src/i18n';
import { ACHIEVEMENTS } from '../src/game/config/achievements';
import {
  EVENTS, EVENT_INFO, FORTUNE_CARDS, KIND_NAMES, LETTERS, MERCHANT_OFFERS, RARITY_NAMES, eventRewardText,
} from '../src/game/config/events';
import { GIFTS } from '../src/game/config/gifts';
import { HAPPINESS_ITEMS, STORIES } from '../src/game/config/happiness';
import { ASSIGNMENTS, LINES, MUTTER_LINES, OUTFITS } from '../src/game/config/mascot';
import { PLANTS } from '../src/game/config/plants';
import { RECIPES } from '../src/game/config/recipes';
import { GLOBAL_UPGRADES, TARGET_UPGRADES } from '../src/game/config/upgrades';
import { WISH, WISH_LINES } from '../src/game/config/wishes';

const ROOT = join(__dirname, '..', 'src');
const LOCALES = join(ROOT, 'locales');

/** 看起來像沒查到、直接回傳 key 的字串 */
const looksLikeKey = (s: string) => /^[a-z][\w]*(\.[\w]+)+$/.test(s);

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = join(dir, e.name);
    if (e.isDirectory()) return e.name === 'locales' ? [] : sourceFiles(p);
    return /\.tsx?$/.test(e.name) ? [p] : [];
  });
}

/** 文字裡的 {變數} 名稱（含 {n|單數|複數} 的 n） */
function varsOf(s: string | string[]): string[] {
  const text = Array.isArray(s) ? s.join('\n') : s;
  return [...new Set([...text.matchAll(/\{(\w+)(?:\|[^}]*)?\}/g)].map((m) => m[1]))].sort();
}

function loadLang(lang: string): Dict {
  const dir = join(LOCALES, lang);
  return Object.assign({}, ...readdirSync(dir).filter((f) => f.endsWith('.json')).map((f) => JSON.parse(readFileSync(join(dir, f), 'utf8'))));
}

afterEach(() => useDict(SOURCE_LANG, SOURCE));

describe('語言檔', () => {
  it('程式裡寫死的 key 都存在於原文', () => {
    const missing: string[] = [];
    for (const f of sourceFiles(ROOT)) {
      const src = readFileSync(f, 'utf8');
      for (const m of src.matchAll(/\b(?:t|tl|tx|tr)\(\s*'([^'`$]+)'/g)) {
        if (!(m[1] in SOURCE)) missing.push(`${f.slice(ROOT.length + 1)}: ${m[1]}`);
      }
    }
    expect(missing).toEqual([]);
  });

  it('設定資料的文字都查得到（沒有漏掉的 key）', () => {
    const texts: string[] = [
      ...EVENTS.flatMap((e) => [e.name, e.prompt, e.hint, e.story, e.lumia, ...eventRewardText(e.id)]),
      ...Object.values(EVENT_INFO).flatMap((i) => [i.summary, i.need]),
      ...Object.values(KIND_NAMES), ...RARITY_NAMES,
      ...Object.values(MERCHANT_OFFERS).flatMap((o) => [o.name, o.desc]),
      ...Object.values(FORTUNE_CARDS).flatMap((c) => [c.name, c.desc]),
      ...LETTERS.flatMap((l) => [l.title, ...l.lines]),
      ...GIFTS.flatMap((g) => [g.name, g.desc, g.intro, g.line]),
      ...HAPPINESS_ITEMS.flatMap((i) => [i.name, i.desc]),
      ...Object.values(STORIES).flatMap((s) => [s.title, ...s.lines]),
      ...GLOBAL_UPGRADES.flatMap((u) => [u.name, u.desc]),
      ...Object.values(TARGET_UPGRADES).flatMap((u) => [u.name, u.desc]),
      ...ACHIEVEMENTS.map((a) => a.name),
      ...Object.values(PLANTS).map((p) => p.name), ...Object.values(RECIPES).map((r) => r.name),
      ...Object.values(ASSIGNMENTS).flatMap((a) => [a.name, a.desc]),
      ...Object.values(OUTFITS).flatMap((o) => [o.name, o.desc]),
      ...Object.values(LINES).flat(), ...WISH_LINES.new, ...WISH_LINES.done, ...WISH_LINES.fail,
      ...WISH.rarities.map((r) => r.name),
      ...(['global', 'greenhouse', 'cauldron', 'counter', 'patrol', 'tired', 'relax', 'sleep', 'starved', 'crowded', 'fever', 'marketHot', 'marketCold'] as const)
        .flatMap((k) => MUTTER_LINES[k]),
      ...Object.values(MUTTER_LINES.outfit).flat(),
      ...GIFTS.flatMap((g) => MUTTER_LINES.furniture[g.id] ?? []),
    ];
    expect(texts.filter((s) => !s || looksLikeKey(s) || /\{\w+\}/.test(s))).toEqual([]);
  });

  it('所有翻譯檔：key 都在原文裡、變數一致、陣列長度一樣', () => {
    const problems: string[] = [];
    for (const lang of readdirSync(LOCALES).filter((d) => d !== SOURCE_LANG)) {
      const dict = loadLang(lang);
      for (const [k, v] of Object.entries(dict)) {
        const src = SOURCE[k];
        if (src === undefined) { problems.push(`${lang} ${k}: 原文沒有這個 key`); continue; }
        if (Array.isArray(src) !== Array.isArray(v)) problems.push(`${lang} ${k}: 字串／陣列不一致`);
        else if (Array.isArray(src) && src.length !== (v as string[]).length) problems.push(`${lang} ${k}: 陣列長度不同`);
        if (varsOf(src).join() !== varsOf(v).join()) problems.push(`${lang} ${k}: 變數 ${varsOf(v)} ≠ 原文 ${varsOf(src)}`);
      }
    }
    expect(problems).toEqual([]);
  });
});

describe('文字格式', () => {
  it('變數、單複數、夾元件', () => {
    useDict('en', { 'x.potions': '{n} {n|potion|potions}', 'x.gold': 'Got {icon} {n} gold' });
    expect(t('x.potions', { n: 1 })).toBe('1 potion');
    expect(t('x.potions', { n: 3 })).toBe('3 potions');
    expect(tx('x.gold', { icon: 'ICON' }, { n: 5 })).toEqual(['Got ', 'ICON', ' 5 gold']);
    // 翻譯缺的 key 退回原文
    expect(t('format.seconds', { s: 3 })).toBe('3 秒');
  });

  it('陣列取值；找不到的 key 原樣回傳', () => {
    expect(tl('decor.slotNames')).toHaveLength(4);
    expect(t('no.such.key')).toBe('no.such.key');
  });
});

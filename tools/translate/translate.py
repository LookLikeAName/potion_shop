"""
命令列：翻譯語言檔。

  python tools/translate/translate.py ja en          翻譯沒翻的、原文改過的、格式錯的（鎖定的不動）
  python tools/translate/translate.py ja --keys "event.*"   只翻符合的 key
  python tools/translate/translate.py ja --all       全部重翻（鎖定的一樣不動）
  python tools/translate/translate.py ja --check     只檢查，不呼叫 API
  python tools/translate/translate.py ja --dry-run   列出會翻哪些、分幾批、要送出多少字

API 金鑰放在環境變數（預設 GEMINI_API_KEY，可在 config.json 改），模型與網址見 config.json。
網頁介面：python tools/translate/gui.py
"""
from __future__ import annotations

import argparse
import json
import sys
from fnmatch import fnmatchcase

import core


def main() -> int:
    if hasattr(sys.stdout, 'reconfigure'):
        sys.stdout.reconfigure(encoding='utf-8')
    p = argparse.ArgumentParser(description='翻譯 src/locales 的語言檔')
    p.add_argument('langs', nargs='+', help='目標語言，例如 ja en')
    p.add_argument('--keys', action='append', default=[], help='只處理符合的 key（可用 * 萬用字元，可重複）')
    p.add_argument('--all', action='store_true', help='不管有沒有翻過，全部重翻（鎖定的除外）')
    p.add_argument('--include-locked', action='store_true', help='連鎖定的也重翻')
    p.add_argument('--check', action='store_true', help='只檢查目前的譯文')
    p.add_argument('--dry-run', action='store_true', help='不呼叫 API，只列出要翻的內容')
    args = p.parse_args()

    cfg = core.load_config()
    code = 0
    for lang in args.langs:
        if lang == core.SOURCE_LANG:
            print('{} 是原文，不用翻'.format(lang))
            continue
        rows = core.rows(lang)
        if args.check:
            bad = [r for r in rows if r['status'] != 'ok']
            by = {}
            for r in bad:
                by.setdefault(r['status'], []).append(r)
            print('{}：共 {} 段，正常 {}'.format(lang, len(rows), len(rows) - len(bad)))
            for st, rs in by.items():
                print('  {} {} 段'.format(st, len(rs)))
                for r in rs[:20]:
                    print('    {}{}'.format(r['key'], '：' + '；'.join(r['issues']) if r['issues'] else ''))
                if len(rs) > 20:
                    print('    …')
            code |= 1 if bad else 0
            continue

        if args.all:
            keys = [r['key'] for r in rows if args.include_locked or not r['locked']]
        else:
            keys = [r['key'] for r in rows if r['status'] != 'ok' and (args.include_locked or not r['locked'])]
        if args.keys:
            keys = [k for k in keys if any(fnmatchcase(k, pat) for pat in args.keys)]
        if not keys:
            print('{}：沒有需要翻譯的文字'.format(lang))
            continue

        src = core.Catalog(core.SOURCE_LANG).entries()
        if args.dry_run:
            batches = core.make_batches([(k, src[k]) for k in keys], cfg['batch_size'], cfg['batch_chars'])
            chars = sum(len(json.dumps(src[k], ensure_ascii=False)) for k in keys)
            print('{}：{} 段、{} 批、原文約 {} 字'.format(lang, len(keys), len(batches), chars))
            for k in keys[:30]:
                print('  ' + k)
            if len(keys) > 30:
                print('  …')
            continue

        api_key = core.api_key_from_env(cfg)
        if not api_key:
            print('找不到 API 金鑰：請設定環境變數 {}'.format(cfg['api_key_env']))
            return 2
        res = core.translate(lang, keys, cfg, api_key)
        code |= 1 if res['failed'] else 0
    return code


if __name__ == '__main__':
    sys.exit(main())

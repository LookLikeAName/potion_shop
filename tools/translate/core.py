"""
翻譯工具的核心：讀寫語言檔、找出要翻的文字、呼叫 LLM、驗證結果。
只用 Python 標準函式庫（3.8 以上），不需要 pip install。

語言檔：src/locales/<語言>/<分類>.json，內容是 { key: 字串 或 字串陣列 }。
原文是 zh-TW；其他語言的檔名、key 都跟原文一樣。
翻譯紀錄（每段原文的雜湊、是不是人工修改過、鎖定）存在 tools/translate/state/<語言>.json。
"""
from __future__ import annotations

import hashlib
import json
import os
import re
import time
import urllib.error
import urllib.request
from concurrent.futures import ThreadPoolExecutor
from fnmatch import fnmatchcase
from pathlib import Path
from typing import Callable, Dict, List, Optional, Tuple, Union

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent.parent
LOCALES = ROOT / 'src' / 'locales'
STATE_DIR = HERE / 'state'
SOURCE_LANG = 'zh-TW'

Value = Union[str, List[str]]

LANG_NAMES = {'ja': 'Japanese', 'en': 'English', 'zh-TW': 'Traditional Chinese (Taiwan)'}

DEFAULT_CONFIG = {
    # OpenAI 相容的 /chat/completions 端點。Gemini：https://generativelanguage.googleapis.com/v1beta/openai/
    'base_url': 'https://generativelanguage.googleapis.com/v1beta/openai/',
    'model': 'gemini-2.5-flash',
    # API 金鑰從這個環境變數讀（不寫進任何檔案）
    'api_key_env': 'GEMINI_API_KEY',
    'temperature': 0.3,
    # 每次請求最多幾段文字、最多多少字（原文字數）
    'batch_size': 40,
    'batch_chars': 5000,
    # 同時送出的請求數（免費額度的速率限制較嚴時設 1）
    'concurrency': 2,
    # 要求模型只回 JSON（大部分 OpenAI 相容服務都支援；不支援時改 false）
    'json_mode': True,
    'max_retries': 3,
    'timeout': 120,
}


# ---------------------------------------------------------------- 設定

def load_config() -> dict:
    cfg = dict(DEFAULT_CONFIG)
    path = HERE / 'config.json'
    if path.exists():
        cfg.update(json.loads(path.read_text(encoding='utf-8')))
    return cfg


def save_config(cfg: dict) -> None:
    keep = {k: cfg[k] for k in DEFAULT_CONFIG if k in cfg}
    (HERE / 'config.json').write_text(json.dumps(keep, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')


def read_json(path: Path, default):
    if not path.exists():
        return default
    return json.loads(path.read_text(encoding='utf-8'))


def write_json(path: Path, data) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    text = json.dumps(data, ensure_ascii=False, indent=2) + '\n'
    with open(path, 'w', encoding='utf-8', newline='\n') as f:
        f.write(text)


# ---------------------------------------------------------------- 語言檔

class Catalog:
    """一個語言的全部文字：key → 值，並記得每個 key 在哪個檔案"""

    def __init__(self, lang: str):
        self.lang = lang
        self.files: Dict[str, Dict[str, Value]] = {}
        d = LOCALES / lang
        if d.exists():
            for f in sorted(d.glob('*.json')):
                self.files[f.stem] = json.loads(f.read_text(encoding='utf-8'))

    def entries(self) -> Dict[str, Value]:
        out: Dict[str, Value] = {}
        for data in self.files.values():
            out.update(data)
        return out

    def file_of(self, key: str) -> Optional[str]:
        for name, data in self.files.items():
            if key in data:
                return name
        return None


def available_langs() -> List[str]:
    return sorted(p.name for p in LOCALES.iterdir() if p.is_dir() and p.name != SOURCE_LANG)


def source_hash(v: Value) -> str:
    return hashlib.sha1(json.dumps(v, ensure_ascii=False).encode('utf-8')).hexdigest()[:12]


# ---------------------------------------------------------------- 驗證

VAR_RE = re.compile(r'\{(\w+)(?:\|[^}]*)?\}')
CJK_RE = re.compile(r'[㐀-鿿]')
# 平假名＋片假名；不含中間點「・」(U+30FB)：它是遊戲裡共用的分隔符號，英文譯文也會保留
KANA_RE = re.compile(r'[぀-ヺー-ヿ]')


def vars_of(v: Value) -> List[str]:
    text = '\n'.join(v) if isinstance(v, list) else v
    return sorted(set(VAR_RE.findall(text)))


def check(lang: str, src: Value, tr: Value) -> List[str]:
    """譯文的問題（空的＝沒問題）"""
    issues = []
    if isinstance(src, list) != isinstance(tr, list):
        return ['型別不一致（原文是{}）'.format('陣列' if isinstance(src, list) else '字串')]
    if isinstance(src, list) and len(src) != len(tr):
        issues.append('陣列長度 {} ≠ 原文 {}'.format(len(tr), len(src)))
    parts = tr if isinstance(tr, list) else [tr]
    if any(not isinstance(p, str) for p in parts):
        return ['內容不是字串']
    src_parts = src if isinstance(src, list) else [src]
    if any(not p.strip() for p, s in zip(parts, src_parts) if s.strip()):
        issues.append('有空白的譯文')
    if vars_of(src) != vars_of(tr):
        issues.append('變數 {} ≠ 原文 {}'.format(vars_of(tr), vars_of(src)))
    if '|' in ''.join(parts) and lang != 'en':
        for m in re.finditer(r'\{\w+\|', ''.join(parts)):
            issues.append('只有英文可以用單複數語法 {n|…|…}')
            break
    text = ''.join(parts)
    if lang == 'en' and (CJK_RE.search(text) or KANA_RE.search(text)):
        issues.append('英文譯文裡還有中日文')
    # 日文可能整句都是漢字（「言語 / Language」「大釜」「設定」），只有夠長的句子跟原文一字不差時才當成漏翻
    if lang == 'ja' and tr == src and len(CJK_RE.findall(VAR_RE.sub('', text))) >= 4:
        issues.append('跟中文原文一樣，可能沒翻成日文')
    return issues


# ---------------------------------------------------------------- 翻譯紀錄

class State:
    """每個 key 翻譯時的原文雜湊、來源（ai／human）、是否鎖定"""

    def __init__(self, lang: str):
        self.lang = lang
        self.path = STATE_DIR / '{}.json'.format(lang)
        self.data: Dict[str, dict] = read_json(self.path, {})

    def save(self) -> None:
        write_json(self.path, dict(sorted(self.data.items())))

    def get(self, key: str) -> dict:
        return self.data.get(key, {})

    def mark(self, key: str, src: Value, by: str, locked: Optional[bool] = None, model: str = '') -> None:
        e = self.data.setdefault(key, {})
        e['hash'] = source_hash(src)
        e['by'] = by
        if model:
            e['model'] = model
        if locked is not None:
            e['locked'] = locked
        e['time'] = time.strftime('%Y-%m-%d %H:%M')


def status_of(key: str, src: Value, target: Dict[str, Value], state: State, lang: str) -> Tuple[str, List[str]]:
    """missing 沒翻／stale 原文改過／invalid 格式錯／ok；另外回傳問題清單"""
    if key not in target:
        return 'missing', []
    issues = check(lang, src, target[key])
    st = state.get(key)
    if st.get('hash') != source_hash(src):
        return 'stale', issues
    if issues:
        return 'invalid', issues
    return 'ok', []


def rows(lang: str) -> List[dict]:
    """給網頁介面的總表"""
    src_cat = Catalog(SOURCE_LANG)
    tgt = Catalog(lang).entries()
    state = State(lang)
    out = []
    for fname, data in src_cat.files.items():
        for key, src in data.items():
            status, issues = status_of(key, src, tgt, state, lang)
            st = state.get(key)
            out.append({
                'key': key, 'file': fname, 'source': src, 'target': tgt.get(key),
                'status': status, 'issues': issues,
                'locked': bool(st.get('locked')), 'by': st.get('by', ''), 'time': st.get('time', ''),
            })
    return out


# ---------------------------------------------------------------- 寫回語言檔

def write_target(lang: str, target: Dict[str, Value]) -> None:
    """依原文的檔案與順序寫出譯文（原文刪掉的 key 一併移除）"""
    src_cat = Catalog(SOURCE_LANG)
    for fname, data in src_cat.files.items():
        out = {k: target[k] for k in data if k in target}
        path = LOCALES / lang / '{}.json'.format(fname)
        if out or path.exists():
            write_json(path, out)


def set_translation(lang: str, key: str, value: Value, by: str = 'human', locked: Optional[bool] = None) -> List[str]:
    src = Catalog(SOURCE_LANG).entries()
    if key not in src:
        raise KeyError(key)
    issues = check(lang, src[key], value)
    target = Catalog(lang).entries()
    target[key] = value
    write_target(lang, target)
    state = State(lang)
    # 人工修改的自動鎖定：之後自動翻譯不會蓋掉（原文改了會標成「原文已改」）
    state.mark(key, src[key], by, locked=True if (by == 'human' and locked is None) else locked)
    state.save()
    return issues


def set_source(key: str, value: Value) -> List[str]:
    """
    修改中文原文（只改字，不改結構）：變數要一樣（程式傳進來的變數是固定的），
    陣列長度要一樣（有些陣列是照位置取的，例如擺設位名稱）。
    改完之後各語言的這一段會自動變成「原文已改」。
    """
    cat = Catalog(SOURCE_LANG)
    fname = cat.file_of(key)
    if fname is None:
        raise KeyError(key)
    old = cat.files[fname][key]
    if isinstance(old, list) != isinstance(value, list):
        return ['型別不能改（原文是{}）'.format('陣列' if isinstance(old, list) else '字串')]
    if isinstance(old, list) and len(old) != len(value):
        return ['陣列要維持 {} 句'.format(len(old))]
    parts = value if isinstance(value, list) else [value]
    if any(not p.strip() for p in parts):
        return ['不能是空白']
    if vars_of(old) != vars_of(value):
        return ['變數要跟原本一樣：{}'.format(' '.join('{' + v + '}' for v in vars_of(old)) or '（沒有變數）')]
    cat.files[fname][key] = value
    write_json(LOCALES / SOURCE_LANG / '{}.json'.format(fname), cat.files[fname])
    return []


def set_locked(lang: str, key: str, locked: bool) -> None:
    state = State(lang)
    state.data.setdefault(key, {})['locked'] = locked
    state.save()


# ---------------------------------------------------------------- 提示詞

def match_notes(key: str, notes: Dict[str, str]) -> List[str]:
    return [n for pat, n in notes.items() if fnmatchcase(key, pat)]


def glossary_for(lang: str, texts: List[str]) -> List[Tuple[str, str, str]]:
    """這批原文裡出現的術語（原文、譯名、備註）"""
    gl = read_json(HERE / 'glossary.json', {})
    joined = '\n'.join(texts)
    out = []
    for term, e in gl.get('terms', {}).items():
        if term in joined and e.get(lang):
            out.append((term, e[lang], e.get('note', '')))
    return out


def build_messages(lang: str, batch: List[Tuple[str, Value]]) -> List[dict]:
    style = read_json(HERE / 'style.json', {})
    notes = read_json(HERE / 'context.json', {}).get('notes', {})
    name = LANG_NAMES.get(lang, lang)
    texts = [('\n'.join(v) if isinstance(v, list) else v) for _, v in batch]
    gl = glossary_for(lang, texts)

    rules = [
        'Translate each value from Traditional Chinese (Taiwan) into natural {}.'.format(name),
        'Keep every placeholder in curly braces exactly as written, e.g. {n}, {name}, {pct}. Do not translate, rename, add or remove placeholders. You may move them to fit the grammar.',
        'Keep emoji and symbols (♥ ★ 🔒 📖 ✉ ⏳ ▶ ◀ › × ・ ＋ −) and the abbreviation "Lv".',
        'If a value is an array, return an array with exactly the same number of items, in the same order.',
        'Keep line breaks (\\n) where the source has them.',
        'Return ONLY a JSON object mapping each key to its translation. No comments, no markdown.',
    ]
    if lang == 'en':
        rules.append('For English plurals you MAY use the plural form {n|singular|plural}, e.g. "{n} {n|potion|potions}" (n is an existing placeholder). Use it only when a count placeholder decides the noun.')
    else:
        rules.append('Do not use the {n|…|…} plural syntax.')
    rules += style.get('common', []) + style.get(lang, [])

    sys_parts = [
        'You are a professional game localizer for a cozy, kawaii Japanese-anime style idle game '
        '"Mascot Girl\'s Idle Potion Shop": the player is a magical grimoire (called "老師" = the teacher) '
        'who guides Lumia (露米婭), a cheerful young apprentice witch, in running a two-story potion shop '
        'with a greenhouse, cauldrons and a counter.',
        'Rules:\n' + '\n'.join('- ' + r for r in rules),
    ]
    if gl:
        sys_parts.append('Glossary (always use these translations):\n' + '\n'.join(
            '- {} → {}{}'.format(t, tr, ' ({})'.format(n) if n else '') for t, tr, n in gl))
    payload = {}
    ctx_lines = []
    for key, v in batch:
        payload[key] = v
        ns = match_notes(key, notes)
        if ns:
            ctx_lines.append('- {}: {}'.format(key, ' / '.join(ns)))
    user = ''
    if ctx_lines:
        user += 'Context for some keys:\n' + '\n'.join(ctx_lines) + '\n\n'
    user += 'Translate these values into {}:\n'.format(name) + json.dumps(payload, ensure_ascii=False, indent=1)
    return [{'role': 'system', 'content': '\n\n'.join(sys_parts)}, {'role': 'user', 'content': user}]


# ---------------------------------------------------------------- 呼叫 API

class ApiError(Exception):
    pass


def call_llm(cfg: dict, messages: List[dict], api_key: str) -> str:
    url = cfg['base_url'].rstrip('/') + '/chat/completions'
    body = {'model': cfg['model'], 'messages': messages, 'temperature': cfg['temperature']}
    if cfg.get('json_mode'):
        body['response_format'] = {'type': 'json_object'}
    data = json.dumps(body).encode('utf-8')
    last = ''
    for attempt in range(cfg['max_retries'] + 1):
        req = urllib.request.Request(url, data=data, headers={
            'Content-Type': 'application/json', 'Authorization': 'Bearer ' + api_key,
        })
        try:
            with urllib.request.urlopen(req, timeout=cfg['timeout']) as r:
                res = json.loads(r.read().decode('utf-8'))
            return res['choices'][0]['message']['content'] or ''
        except urllib.error.HTTPError as e:
            last = 'HTTP {}: {}'.format(e.code, e.read().decode('utf-8', 'replace')[:300])
            # 速率限制與伺服器錯誤：等一下再試；其他錯誤（金鑰、模型名稱）直接放棄
            if e.code not in (429, 500, 502, 503, 504):
                raise ApiError(last)
        except (urllib.error.URLError, TimeoutError, OSError, KeyError, ValueError) as e:
            last = str(e)
        time.sleep(min(60, 4 * 2 ** attempt))
    raise ApiError(last)


def parse_reply(text: str) -> dict:
    text = text.strip()
    m = re.search(r'```(?:json)?\s*(.*?)```', text, re.S)
    if m:
        text = m.group(1)
    start, end = text.find('{'), text.rfind('}')
    if start < 0 or end < 0:
        raise ValueError('回覆裡沒有 JSON')
    return json.loads(text[start:end + 1])


# ---------------------------------------------------------------- 翻譯流程

def pending_keys(lang: str, include_stale_locked: bool = False) -> List[str]:
    """需要翻譯的 key：沒翻的、原文改過的、格式錯的（鎖定的不動）"""
    out = []
    for r in rows(lang):
        if r['status'] == 'ok':
            continue
        if r['locked'] and not include_stale_locked:
            continue
        out.append(r['key'])
    return out


def make_batches(items: List[Tuple[str, Value]], size: int, chars: int) -> List[List[Tuple[str, Value]]]:
    batches: List[List[Tuple[str, Value]]] = []
    cur: List[Tuple[str, Value]] = []
    n = 0
    for k, v in items:
        c = len(json.dumps(v, ensure_ascii=False))
        if cur and (len(cur) >= size or n + c > chars):
            batches.append(cur)
            cur, n = [], 0
        cur.append((k, v))
        n += c
    if cur:
        batches.append(cur)
    return batches


def translate(lang: str, keys: List[str], cfg: dict, api_key: str,
              log: Callable[[str], None] = print, progress: Callable[[int, int], None] = lambda a, b: None,
              stop: Callable[[], bool] = lambda: False) -> dict:
    """翻譯指定的 key，寫回語言檔；回傳 {done, failed: {key: 問題}}"""
    src = Catalog(SOURCE_LANG).entries()
    items = [(k, src[k]) for k in keys if k in src]
    batches = make_batches(items, cfg['batch_size'], cfg['batch_chars'])
    total = len(items)
    done_n = 0
    failed: Dict[str, List[str]] = {}
    results: Dict[str, Value] = {}
    log('{}：{} 段文字，分成 {} 批（模型 {}）'.format(lang, total, len(batches), cfg['model']))
    progress(0, total)

    def run(batch: List[Tuple[str, Value]]) -> Tuple[Dict[str, Value], Dict[str, List[str]]]:
        todo = list(batch)
        good: Dict[str, Value] = {}
        bad: Dict[str, List[str]] = {}
        # 格式不合格的段落單獨重翻，最多兩次
        for attempt in range(3):
            if not todo or stop():
                break
            try:
                reply = parse_reply(call_llm(cfg, build_messages(lang, todo), api_key))
            except (ApiError, ValueError) as e:
                for k, _ in todo:
                    bad[k] = ['API 或回覆格式錯誤：{}'.format(str(e)[:200])]
                if isinstance(e, ApiError):
                    break
                continue
            retry = []
            for k, v in todo:
                if k not in reply:
                    bad[k] = ['模型沒有回這一段']
                    retry.append((k, v))
                    continue
                issues = check(lang, v, reply[k])
                if issues:
                    bad[k] = issues
                    retry.append((k, v))
                else:
                    good[k] = reply[k]
                    bad.pop(k, None)
            todo = retry
        return good, bad

    with ThreadPoolExecutor(max_workers=max(1, int(cfg['concurrency']))) as pool:
        for good, bad in pool.map(run, batches):
            results.update(good)
            failed.update(bad)
            done_n += len(good) + len(bad)
            progress(done_n, total)
            log('  完成 {}/{}（這批成功 {}、失敗 {}）'.format(done_n, total, len(good), len(bad)))
            # 每批做完就存，中途停止也不會白翻
            if good:
                _save_results(lang, good, src, cfg['model'])

    for k, issues in failed.items():
        log('  ✗ {}：{}'.format(k, '；'.join(issues)))
    log('完成：成功 {}、失敗 {}'.format(len(results), len(failed)))
    return {'done': len(results), 'failed': failed}


def _save_results(lang: str, good: Dict[str, Value], src: Dict[str, Value], model: str) -> None:
    target = Catalog(lang).entries()
    target.update(good)
    write_target(lang, target)
    state = State(lang)
    for k in good:
        prev = state.get(k).get('locked', False)
        state.mark(k, src[k], 'ai', locked=prev, model=model)
    state.save()


def api_key_from_env(cfg: dict) -> str:
    return os.environ.get(cfg.get('api_key_env') or '', '')

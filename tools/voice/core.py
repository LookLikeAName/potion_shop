"""
語音工具的核心：設計露米婭與老師的聲音（Gemini 語音設計），批次產生劇情與泡泡台詞的配音。
只用 Python 標準函式庫（3.8 以上）；有 ffmpeg 時把 WAV 轉成 MP3（檔案小很多）。

- 台詞從哪裡來：src/game/config/script.json（劇情的說話順序、泡泡台詞的 key 開頭）
  + 語言檔 src/locales/<配音語言>/*.json 的文字。所有語言共用同一套配音。
- 聲音設定：tools/voice/profiles.json（每個角色的聲音描述、候選聲音、正式使用的 voice_id）。
- 每句的語氣：預設用劇本的動作描述（script.<ID>.act），可以在 tools/voice/styles.json 逐句改。
- 產生紀錄：tools/voice/state.json（每句的內容雜湊與音效設定雜湊：文字、語氣、聲音改了要重新呼叫 API；
  只有音效改了，用 tools/voice/raw/ 留著的原始音檔在本機重新處理就好）。
- 音效（後製）：每個角色的 fx（音效控制台「套用到批次」的設定），處理見 fx.py。
- 輸出：public/voice/<台詞 ID>.<mp3|wav>，清單 public/voice/manifest.json（遊戲讀這個）。
"""
from __future__ import annotations

import base64
import hashlib
import io
import json
import os
import re
import subprocess
import time
import urllib.error
import urllib.parse
import urllib.request
import wave
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from typing import Callable, Dict, List, Optional, Tuple

import fx

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent.parent
LOCALES = ROOT / 'src' / 'locales'
SCRIPT = ROOT / 'src' / 'game' / 'config' / 'script.json'
OUT = ROOT / 'public' / 'voice'
SAMPLES = HERE / 'samples'
# 批次產生的原始音檔（套音效之前）：只改音效時從這裡重新處理，不用再呼叫 API
RAW = HERE / 'raw'

DEFAULT_CONFIG = {
    'base_url': 'https://generativelanguage.googleapis.com/v1beta',
    'model': 'gemini-3.8-flash-tts',
    # 「AI 細化」聲音敘述用的文字模型
    'refine_model': 'gemini-3.5-flash-lite',
    # API 金鑰從這個環境變數讀（不寫進任何檔案）
    'api_key_env': 'GEMINI_API_KEY',
    # 配音用哪個語言的文字（src/locales 底下的資料夾名稱）；所有語言共用這一套配音
    'voice_lang': 'ja',
    # 建立聲音時的 language_code
    'language_code': 'ja-JP',
    # mp3（需要 ffmpeg）或 wav
    'output_format': 'mp3',
    'mp3_bitrate': '64k',
    # 沒有另外指定語氣時，用劇本的動作描述當這句的語氣
    'act_as_style': True,
    'concurrency': 2,
    'max_retries': 3,
    'timeout': 120,
}

DEFAULT_PROFILES = {
    'lumia': {
        'name': '露米婭',
        'gender': 'female',
        'description': (
            'A 20-year-old apprentice witch who runs a cozy magic potion shop. Speaks natural, native Japanese. '
            'Bright, youthful and energetic voice with a warm, slightly high pitch; cheerful and earnest, a little clumsy, '
            'easily excited, very expressive. Clear articulation, natural anime heroine delivery, never nasal or shrill.'
        ),
        # 建立聲音後自動用這個聲音唸一次（建立時 API 附的試聽是模型自己挑的句子，常常是英文）
        'intro': (
            'はじめまして！見習い魔女のルミアです。先生の工房で、代理店長としてポーション屋さんをやっています。'
            '失敗することもあるけど、毎日がんばってますよ！よろしくお願いしますね！'
        ),
        'voice_id': '',
        'candidates': [],
        # 批次產生時套用的音效（音效控制台按「套用到批次」存進來）；None = 不處理
        'fx': None,
    },
    'book': {
        'name': '魔導書（老師）',
        'gender': '',
        'description': (
            '（請依角色設定填寫：年齡、性別、音色、口音、平常說話的語氣。老師是撫養露米婭長大的鍊金術師，'
            '把自己的意識留在一本會說話的魔導書裡；語氣溫和、有點愛碎碎念、偶爾開玩笑。建議加上 Speaks natural, native Japanese.）'
        ),
        'intro': (
            'やあ、私はこの魔導書……いや、ルミアの先生だ。見ての通り、今は一冊の本の姿をしている。'
            '工房のことなら何でも教えてあげよう。まったく、あの子は目が離せなくて困るよ。'
        ),
        'voice_id': '',
        'candidates': [],
        'fx': None,
    },
}


# ---------------------------------------------------------------- 檔案

def read_json(path: Path, default):
    if not path.exists():
        return default
    return json.loads(path.read_text(encoding='utf-8'))


def write_json(path: Path, data) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with open(path, 'w', encoding='utf-8', newline='\n') as f:
        f.write(json.dumps(data, ensure_ascii=False, indent=2) + '\n')


def load_config() -> dict:
    cfg = dict(DEFAULT_CONFIG)
    cfg.update(read_json(HERE / 'config.json', {}))
    return cfg


def save_config(cfg: dict) -> None:
    write_json(HERE / 'config.json', {k: cfg[k] for k in DEFAULT_CONFIG if k in cfg})


def load_profiles() -> dict:
    data = read_json(HERE / 'profiles.json', {})
    out = {}
    for k, d in DEFAULT_PROFILES.items():
        out[k] = {**d, **data.get(k, {})}
    return out


def save_profiles(p: dict) -> None:
    write_json(HERE / 'profiles.json', p)


def load_styles() -> Dict[str, str]:
    return read_json(HERE / 'styles.json', {})


def save_styles(s: Dict[str, str]) -> None:
    write_json(HERE / 'styles.json', dict(sorted((k, v) for k, v in s.items() if v.strip())))


def load_speech() -> Dict[str, dict]:
    """逐句改過的「送給模型的台詞」：{ID: {text: 改過的台詞, base: 改的時候的原始台詞}}"""
    return read_json(HERE / 'speech.json', {})


def set_speech(line_id: str, speech: str, original: str) -> None:
    """改送給模型的台詞；清空或和原始台詞一樣 = 恢復用原始台詞"""
    data = load_speech()
    if not speech.strip() or speech == original:
        data.pop(line_id, None)
    else:
        data[line_id] = {'text': speech, 'base': original}
    write_json(HERE / 'speech.json', dict(sorted(data.items())))


def api_key_from_env(cfg: dict) -> str:
    return os.environ.get(cfg['api_key_env'], '').strip()


def ffmpeg_path() -> Optional[str]:
    return fx.ffmpeg()


# ---------------------------------------------------------------- 台詞

def locale(lang: str) -> Dict[str, object]:
    out: Dict[str, object] = {}
    d = LOCALES / lang
    if d.exists():
        for f in sorted(d.glob('*.json')):
            out.update(json.loads(f.read_text(encoding='utf-8')))
    return out


def script() -> dict:
    return json.loads(SCRIPT.read_text(encoding='utf-8'))


# 句子：到句號、問號、驚嘆號（可以連續，後面可以接右引號）為止
SENTENCE = re.compile(r'[^。！？!?]+(?:[。！？!?]+[」』）)"]*|$)')


def split_sentences(text: str, min_len: int = 20) -> List[str]:
    """
    信件的一段 → 配音的小句：依句子切，太短的句子和下一句合在一起（每小句至少 min_len 字，
    最後剩下很短的就併進前一句）。同樣的文字永遠切成同樣的結果（ID 才穩定）。
    """
    sents = [s for s in SENTENCE.findall(text) if s.strip()]
    parts: List[str] = []
    cur = ''
    for s in sents:
        cur += s
        if len(cur) >= min_len:
            parts.append(cur)
            cur = ''
    if cur:
        if parts and len(cur) < 8:
            parts[-1] += cur
        else:
            parts.append(cur)
    return parts or [text]


def collect_lines(cfg: dict) -> List[dict]:
    """
    所有要配音的台詞：{id, speaker, kind, text（原始台詞＝字幕）, speech（送給模型的台詞）, speechEdited,
    speechOutdated（改過之後原始台詞又改了）, act, style, styleOverride}
    """
    sc = script()
    cat = locale(cfg['voice_lang'])
    styles = load_styles()
    speech = load_speech()
    voiced = set(sc.get('voiced', []))
    lines: List[dict] = []

    def add(line_id: str, speaker: str, kind: str, text: str, act: str, context: str = '') -> None:
        override = styles.get(line_id, '')
        style = override or (act if cfg.get('act_as_style') else '')
        sp = speech.get(line_id)
        lines.append({
            'id': line_id, 'speaker': speaker, 'kind': kind, 'text': text, 'act': act, 'context': context,
            'speech': sp['text'] if sp else text, 'speechEdited': bool(sp),
            'speechOutdated': bool(sp) and sp.get('base') != text,
            'style': style, 'styleOverride': override,
        })

    for scene, s in sc['scenes'].items():
        for speaker, n in s['lines']:
            if speaker not in voiced:
                continue
            line_id = '{}.{}'.format(scene, n)
            text = cat.get('script.' + line_id)
            act = cat.get('script.{}.act'.format(line_id))
            if not text:
                continue  # 只有動作的句子不配音
            add(line_id, speaker, 'story', str(text), str(act or ''))

    bubble = sc.get('bubbles', {})
    prefixes = bubble.get('prefixes', [])
    for key in sorted(cat):
        v = cat[key]
        if not isinstance(v, list) or not any(key.startswith(p) for p in prefixes):
            continue
        for k, text in enumerate(v):
            add('{}.{:02d}'.format(key, k + 1), bubble.get('speaker', 'lumia'), 'bubble', str(text), '')

    # 老師的信：稱呼、每一段內文、結尾，各自依句子拆成小句（context = 這一段的全文，給語氣參考）
    letters = sc.get('letters', {})
    for n in letters.get('ids', []):
        key = 'letter.{}'.format(n)
        pieces = []
        if cat.get(key + '.to'):
            pieces.append(('to', 1, str(cat[key + '.to'])))
        for part in ('body', 'closing'):
            v = cat.get('{}.{}'.format(key, part))
            for k, text in enumerate(v if isinstance(v, list) else []):
                pieces.append((part, k + 1, str(text)))
        for part, k, text in pieces:
            subs = split_sentences(text)
            for j, s in enumerate(subs):
                add('{}.{}.{:02d}.{}'.format(key, part, k, j + 1), letters.get('speaker', 'book'), 'letter', s, '',
                    text if len(subs) > 1 else '')
    return lines


def content_hash(text: str, style: str, voice_id: str, cfg: dict) -> str:
    raw = json.dumps([text, style, voice_id, cfg['model'], cfg['output_format']], ensure_ascii=False)
    return hashlib.sha1(raw.encode('utf-8')).hexdigest()[:12]


def raw_path(line_id: str) -> Path:
    return RAW / '{}.wav'.format(line_id)


def has_raw(line_id: str, st: dict) -> bool:
    """有沒有原始音檔可以重新處理：raw/ 裡有，或輸出檔本身就是沒套音效的原音（音效功能之前產生的）"""
    if raw_path(line_id).exists():
        return True
    file = st.get('file', '')
    return bool(file) and (OUT / file).exists() and not st.get('fx')


def line_status(l: dict, vid: str, speaker_fx: Optional[dict], st: dict, cfg: dict) -> str:
    """
    novoice：角色還沒選聲音／none：還沒產生／stale：文字、語氣或聲音改了（要呼叫 API）／
    fx：只有音效或輸出格式改了（本機用原始音檔重新處理，不用 API）／ok：完成
    """
    if not vid:
        return 'novoice'
    file = st.get('file', '')
    if not file or not (OUT / file).exists():
        return 'none'
    if st.get('hash') != content_hash(l['speech'], l['style'], vid, cfg):
        return 'stale'
    # 要 MP3、現在也有 ffmpeg，但之前沒有 ffmpeg 時存成 WAV 的：要重新轉檔
    fmt_ok = not (cfg['output_format'] == 'mp3' and ffmpeg_path() and file.endswith('.wav'))
    if fmt_ok and st.get('fx', '') == fx.key(speaker_fx):
        return 'ok'
    return 'fx' if has_raw(l['id'], st) else 'stale'


def rows(cfg: dict) -> List[dict]:
    """批次產生頁的總表（每句的狀態見 line_status）"""
    profiles = load_profiles()
    state = read_json(HERE / 'state.json', {})
    out = []
    for l in collect_lines(cfg):
        p = profiles.get(l['speaker'], {})
        st = state.get(l['id'], {})
        status = line_status(l, p.get('voice_id', ''), p.get('fx'), st, cfg)
        file = st.get('file', '')
        exists = bool(file) and (OUT / file).exists()
        out.append({**l, 'status': status, 'file': file if exists else '', 'time': st.get('time', ''),
                    'fxApplied': bool(st.get('fx'))})
    return out


def pending_ids(cfg: dict) -> List[str]:
    return [r['id'] for r in rows(cfg) if r['status'] in ('none', 'stale', 'fx')]


def test_lines(cfg: dict, speaker: str) -> List[dict]:
    """試講用：這個角色的所有劇情台詞與信件（送給模型的版本，配音語言）與它的語氣，{id, text, style}"""
    return [
        {'id': l['id'], 'text': l['speech'], 'style': l['style']}
        for l in collect_lines(cfg) if l['speaker'] == speaker and l['kind'] in ('story', 'letter')
    ]


# ---------------------------------------------------------------- API

class ApiError(Exception):
    pass


class RateLimitError(ApiError):
    """429：用量到上限（例如每天的請求數）。重試也沒用，批次產生遇到就整個停下來"""


def _request(cfg: dict, api_key: str, method: str, path: str, body: Optional[dict] = None) -> dict:
    url = cfg['base_url'].rstrip('/') + '/' + path.lstrip('/')
    data = json.dumps(body).encode('utf-8') if body is not None else None
    last = ''
    for attempt in range(int(cfg['max_retries']) + 1):
        req = urllib.request.Request(url, data=data, method=method, headers={
            'Content-Type': 'application/json', 'x-goog-api-key': api_key,
        })
        try:
            with urllib.request.urlopen(req, timeout=float(cfg['timeout'])) as r:
                raw = r.read().decode('utf-8')
                return json.loads(raw) if raw.strip() else {}
        except urllib.error.HTTPError as e:
            last = '{} {}'.format(e.code, e.read().decode('utf-8', 'replace')[:500])
            # 用量到上限：重試也沒用，直接回報（批次產生會整個停下來）
            if e.code == 429:
                raise RateLimitError(last)
            # 伺服器錯誤：等一下再試；其他錯誤（金鑰、參數）直接回報
            if e.code not in (500, 502, 503, 504):
                break
        except (urllib.error.URLError, TimeoutError, OSError) as e:
            last = str(e)
        time.sleep(min(30, 2 ** attempt * 2))
    raise ApiError(last or 'request failed')


def find_audio(obj) -> Optional[Tuple[str, bytes]]:
    """在回應裡找音訊（mime 類型含 audio 的 base64 資料）；API 回應的欄位名稱不確定，寬鬆地找"""
    if isinstance(obj, dict):
        mime = obj.get('mime_type') or obj.get('mimeType') or ''
        data = obj.get('data')
        if isinstance(data, str) and ('audio' in str(mime) or obj.get('type') == 'audio'):
            return str(mime or 'audio/wav'), base64.b64decode(data)
        for v in obj.values():
            found = find_audio(v)
            if found:
                return found
    elif isinstance(obj, list):
        for v in obj:
            found = find_audio(v)
            if found:
                return found
    return None


def to_wav(mime: str, data: bytes) -> bytes:
    """API 可能回 WAV，也可能回原始 PCM（audio/L16;rate=24000）：統一成 WAV"""
    if data[:4] == b'RIFF':
        return data
    m = re.search(r'rate=(\d+)', mime)
    rate = int(m.group(1)) if m else 24000
    buf = io.BytesIO()
    with wave.open(buf, 'wb') as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(rate)
        w.writeframes(data)
    return buf.getvalue()


def find_voice_id(obj) -> str:
    """建立聲音的回應裡的 ID（voice_... 或 voices/voice_...）"""
    if isinstance(obj, dict):
        for k in ('voice_id', 'voiceId', 'id', 'name'):
            v = obj.get(k)
            if isinstance(v, str) and 'voice' in v:
                return v.split('/')[-1]
        for v in obj.values():
            found = find_voice_id(v)
            if found:
                return found
    elif isinstance(obj, list):
        for v in obj:
            found = find_voice_id(v)
            if found:
                return found
    return ''


def create_voice(cfg: dict, api_key: str, speaker: str, gender: str, description: str,
                 name: str = '') -> Tuple[str, Optional[bytes]]:
    """建立（存下）一個聲音，回傳 (voice_id, 試聽 WAV)。name = 聲音名稱（雲端上的 display_name）"""
    voice = {
        'model': cfg['model'],
        'type': 'prompted',
        'display_name': (name.strip() or 'potion-shop-{}-{}'.format(speaker, time.strftime('%Y%m%d-%H%M%S')))[:60],
        'language_code': cfg['language_code'],
        'prompted': {'input': description},
    }
    if gender:
        voice['gender'] = gender
    res = _request(cfg, api_key, 'POST', 'voices', {'store': True, 'voice': voice})
    vid = find_voice_id(res)
    if not vid:
        raise ApiError('回應裡找不到 voice_id：{}'.format(json.dumps(res, ensure_ascii=False)[:300]))
    audio = find_audio(res)
    return vid, (to_wav(*audio) if audio else None)


def _field(obj: dict, *names: str) -> str:
    """回應的欄位名稱可能是 snake_case 或 camelCase：依序找第一個有值的"""
    for n in names:
        v = obj.get(n)
        if v:
            return str(v)
    return ''


def voice_info(v: dict) -> dict:
    """雲端聲音 → {voice_id, display_name, language_code, gender, description, model, created}"""
    if isinstance(v.get('voice'), dict):
        v = {**v, **v['voice']}
    prompted = v.get('prompted') or {}
    return {
        'voice_id': find_voice_id(v),
        'display_name': _field(v, 'display_name', 'displayName'),
        'language_code': _field(v, 'language_code', 'languageCode'),
        'gender': _field(v, 'gender').lower(),
        'description': _field(prompted, 'input', 'text') if isinstance(prompted, dict) else '',
        'model': _field(v, 'model'),
        'created': _field(v, 'create_time', 'createTime', 'created'),
    }


def list_voices(cfg: dict, api_key: str) -> List[dict]:
    """雲端上的所有聲音（會一頁一頁讀完）"""
    out: List[dict] = []
    token = ''
    for _ in range(20):
        res = _request(cfg, api_key, 'GET', 'voices' + ('?page_token=' + urllib.parse.quote(token) if token else ''))
        for v in res.get('voices') or res.get('items') or []:
            out.append(voice_info(v))
        token = _field(res, 'next_page_token', 'nextPageToken')
        if not token:
            break
    return out


def get_voice(cfg: dict, api_key: str, voice_id: str) -> Tuple[dict, Optional[bytes]]:
    """讀一個雲端聲音的詳細資料，回傳 (資訊, 試聽 WAV 或 None)"""
    res = _request(cfg, api_key, 'GET', 'voices/{}'.format(voice_id))
    info = voice_info(res)
    info['voice_id'] = info['voice_id'] or voice_id
    audio = find_audio(res)
    if not audio:
        # 試聽可能直接是 base64 字串欄位（sample_audio），沒有標 mime 類型
        v = res.get('voice') if isinstance(res.get('voice'), dict) else res
        raw = v.get('sample_audio') or v.get('sampleAudio')
        if isinstance(raw, dict):
            raw = raw.get('data')
        if isinstance(raw, str) and raw:
            try:
                audio = ('audio/wav', base64.b64decode(raw))
            except ValueError:
                audio = None
    return info, (to_wav(*audio) if audio else None)


def delete_voice(cfg: dict, api_key: str, voice_id: str) -> None:
    _request(cfg, api_key, 'DELETE', 'voices/{}'.format(voice_id))


def synthesize(cfg: dict, api_key: str, voice_id: str, text: str, style: str = '') -> bytes:
    """用某個聲音唸一句，回傳 WAV"""
    content = {'type': 'text', 'text': text}
    if style.strip():
        content['annotations'] = [{'type': 'speech_metadata', 'style': style.strip()}]
    body = {
        'model': cfg['model'],
        'input': [{'type': 'user_input', 'content': [content]}],
        'response_format': {'type': 'audio'},
        'generation_config': {'speech_config': [{'voice': voice_id}]},
    }
    res = _request(cfg, api_key, 'POST', 'interactions', body)
    audio = find_audio(res)
    if not audio:
        raise ApiError('回應裡找不到音訊：{}'.format(json.dumps(res, ensure_ascii=False)[:300]))
    return to_wav(*audio)


# ---------------------------------------------------------------- AI 細化聲音敘述

REFINE_SYSTEM = """You are an expert voice director who writes voice-design prompts for Gemini text-to-speech \
(the `prompted.input` of a designed custom voice).

How Gemini voice design works (follow this):
- The prompt defines the PERMANENT identity of a voice: age range, gender, vocal timbre and texture, pitch range, \
accent / native language, typical pace and rhythm, articulation, resonance, and the baseline energy and attitude.
- Situational emotions ("angry now", "whispering this line") do NOT belong here; they are given per line later as a \
style annotation. Keep only traits that should hold for every line.
- Clear, concise, consistent descriptions give cleaner and more stable voices than long or contradictory paragraphs.

Your task: rewrite the user's draft into a better voice-design prompt.
- The draft and the direction may be written in any language (often Chinese). Understand them, but always WRITE THE \
NEW PROMPT IN {language_name} (the language the voice will speak), translating everything the user wrote.
- Keep everything the user asked for and their intent. Never contradict it.
- Add the concrete details they probably want but did not write (for example: an age range, where the pitch sits, \
breathiness or clarity, resonance, pace, how the voice sounds when excited vs. calm, native pronunciation of the \
voice language), chosen to fit the character they describe.
- If the user gives a direction for this revision, apply it.
- Write the prompt in {language_name}, 2 to 4 sentences, concise (about 90 English words or 200 characters for \
Chinese / Japanese). No lists, no quotes, no script lines, no names of real people or real voice actors.
- The voice will mainly speak {language}; state (in {language_name}) that it speaks natural, native {language_name}.

Reply with JSON only: {{"prompt": "<the new prompt, written in {language_name}>", "notes": "<in Traditional Chinese \
(繁體中文), 2 to 5 short bullet lines starting with ・ that explain what you added or changed and why>"}}"""

LANGUAGE_NAMES = {'ja': 'Japanese', 'en': 'English', 'zh': 'Mandarin Chinese', 'cmn': 'Mandarin Chinese', 'ko': 'Korean'}


def refine_description(cfg: dict, api_key: str, draft: str, direction: str = '', gender: str = '',
                       character: str = '', intro: str = '') -> dict:
    """
    用文字模型把聲音敘述寫得更完整；回傳 {prompt, notes}（使用者確認後才套用）。
    新的敘述用配音的語言寫（language_code，例如 ja-JP → 日文），草稿與方向用中文寫也會翻過去；說明用繁體中文。
    """
    lang = cfg.get('language_code', 'ja-JP')
    lang_name = LANGUAGE_NAMES.get(lang.split('-')[0].lower(), lang)
    parts = ['Draft voice description:\n' + (draft.strip() or '(empty)')]
    if character:
        parts.append('Character name: ' + character)
    if gender:
        parts.append('Gender of the voice: ' + gender)
    if intro.strip():
        parts.append('A line this character says (for personality only, do not quote it): ' + intro.strip())
    if direction.strip():
        parts.append('Direction for this revision (from the user, may be in Chinese): ' + direction.strip())
    body = {
        'systemInstruction': {'parts': [{'text': REFINE_SYSTEM.format(language=lang, language_name=lang_name)}]},
        'contents': [{'role': 'user', 'parts': [{'text': '\n\n'.join(parts)}]}],
        'generationConfig': {'responseMimeType': 'application/json', 'temperature': 0.8},
    }
    res = _request(cfg, api_key, 'POST', 'models/{}:generateContent'.format(cfg['refine_model']), body)
    try:
        text = ''.join(p.get('text', '') for p in res['candidates'][0]['content']['parts'])
        data = json.loads(text[text.index('{'):text.rindex('}') + 1])
        return {'prompt': str(data['prompt']).strip(), 'notes': str(data.get('notes', '')).strip()}
    except (KeyError, IndexError, ValueError) as e:
        raise ApiError('看不懂模型的回應（{}）：{}'.format(e, json.dumps(res, ensure_ascii=False)[:300]))


# ---------------------------------------------------------------- 轉檔

def encode(wav: bytes, cfg: dict) -> Tuple[bytes, str]:
    """WAV → 設定的格式；要 MP3 但沒有 ffmpeg 時存 WAV"""
    if cfg['output_format'] == 'mp3':
        ff = ffmpeg_path()
        if ff:
            r = subprocess.run(
                [ff, '-hide_banner', '-loglevel', 'error', '-i', 'pipe:0', '-ac', '1', '-b:a', cfg['mp3_bitrate'], '-f', 'mp3', 'pipe:1'],
                input=wav, stdout=subprocess.PIPE, stderr=subprocess.PIPE, check=False,
            )
            if r.returncode == 0 and r.stdout:
                return r.stdout, 'mp3'
    return wav, 'wav'


# ---------------------------------------------------------------- 批次產生

def write_manifest() -> None:
    """public/voice/manifest.json：有檔案的台詞 ID → 檔名（遊戲只播清單裡有的）"""
    state = read_json(HERE / 'state.json', {})
    files = {k: v['file'] for k, v in sorted(state.items()) if v.get('file') and (OUT / v['file']).exists()}
    write_json(OUT / 'manifest.json', {'files': files})


def raw_audio(line_id: str, st: dict) -> bytes:
    """這句的原始音檔（沒套音效）；舊的輸出檔（音效功能之前產生的）第一次用到時存進 raw/"""
    p = raw_path(line_id)
    if p.exists():
        return p.read_bytes()
    data = (OUT / st['file']).read_bytes()
    wav = data if data[:4] == b'RIFF' else fx.decode(data)
    RAW.mkdir(parents=True, exist_ok=True)
    p.write_bytes(wav)
    return wav


def plan(cfg: dict, ids: List[str], mode: str = 'auto') -> Dict[str, List[str]]:
    """
    這些句子各要怎麼做：{'api': 要呼叫 API 的, 'local': 本機重新處理就好的, 'skip': 做不了的}
    mode：auto = 依狀態決定（產生待處理的）／api = 全部重新呼叫 API（單句「重做」、勾選的）／
          local = 只在本機重新套音效（沒有原始音檔的跳過）
    """
    by_id = {r['id']: r for r in rows(cfg)}
    state = read_json(HERE / 'state.json', {})
    out: Dict[str, List[str]] = {'api': [], 'local': [], 'skip': []}
    for i in ids:
        r = by_id.get(i)
        if not r or r['status'] == 'novoice':
            out['skip'].append(i)
        elif mode == 'local':
            out['local' if r['file'] and r['status'] != 'stale' and has_raw(i, state.get(i, {})) else 'skip'].append(i)
        elif mode == 'api' or r['status'] in ('none', 'stale'):
            out['api'].append(i)
        elif r['status'] == 'fx':
            out['local'].append(i)
        else:
            out['skip'].append(i)
    return out


def generate(cfg: dict, api_key: str, ids: List[str], log: Callable[[str], None] = print,
             progress: Callable[[int, int], None] = lambda a, b: None, stop: Callable[[], bool] = lambda: False,
             mode: str = 'auto') -> dict:
    profiles = load_profiles()
    by_id = {l['id']: l for l in collect_lines(cfg)}
    todo = plan(cfg, ids, mode)
    jobs = [(by_id[i], True) for i in todo['api']] + [(by_id[i], False) for i in todo['local']]
    total = len(jobs)
    done = 0
    failed: Dict[str, str] = {}
    if cfg['output_format'] == 'mp3' and not ffmpeg_path():
        log('沒有 ffmpeg：先存成 WAV（檔案比較大），也不能套音效。WSL：sudo apt install ffmpeg')
    if todo['skip']:
        log('跳過 {} 句（角色還沒選聲音、或沒有原始音檔可以重新處理）'.format(len(todo['skip'])))
    log('處理 {} 句：呼叫 API 重新產生 {} 句、只在本機重新套音效 {} 句（模型 {}，配音語言 {}）'.format(
        total, len(todo['api']), len(todo['local']), cfg['model'], cfg['voice_lang']))
    speakers = sorted({l['speaker'] for l, _ in jobs})
    log('音效（兩種都會套用）：' + '／'.join(
        '{} {}'.format(profiles[s]['name'], '不處理' if fx.is_neutral(profiles[s].get('fx')) else '套用批次設定 ' + fx.key(profiles[s].get('fx')))
        for s in speakers))
    if todo['api'] and not api_key:
        log('錯誤：沒有 API 金鑰')
        return {'done': 0, 'failed': {i: '沒有 API 金鑰' for i in todo['api']}}
    progress(0, total)
    OUT.mkdir(parents=True, exist_ok=True)
    RAW.mkdir(parents=True, exist_ok=True)

    limited: List[str] = []  # 撞到用量上限的錯誤訊息：之後要呼叫 API 的句子都不做了

    def run(job: Tuple[dict, bool]) -> Tuple[str, Optional[dict], Optional[str]]:
        line, use_api = job
        if stop():
            return line['id'], None, '已停止'
        if use_api and limited:
            return line['id'], None, '已停止（API 用量到上限）'
        p = profiles.get(line['speaker'], {})
        vid = p.get('voice_id', '')
        if not vid:
            return line['id'], None, '這個角色還沒選聲音'
        try:
            if use_api:
                raw = synthesize(cfg, api_key, vid, line['speech'], line['style'])
                raw_path(line['id']).write_bytes(raw)
                h = content_hash(line['speech'], line['style'], vid, cfg)
            else:
                st = read_json(HERE / 'state.json', {}).get(line['id'], {})
                raw = raw_audio(line['id'], st)
                h = st.get('hash', '')
            data, ext = encode(fx.render(raw, p.get('fx')), cfg)
        except RateLimitError as e:
            if not limited:
                limited.append(str(e))
                log('⚠ API 用量到上限（429），停止呼叫 API：剩下要呼叫 API 的句子都不做了（本機處理的照常）。')
                log('   ' + str(e)[:400])
            return line['id'], None, '已停止（API 用量到上限）'
        except (ApiError, fx.FxError) as e:
            return line['id'], None, str(e)[:300]
        name = '{}.{}'.format(line['id'], ext)
        # 換了格式：舊的檔案刪掉
        for old in OUT.glob(line['id'] + '.*'):
            if old.name != name and old.suffix in ('.mp3', '.wav', '.ogg'):
                old.unlink()
        (OUT / name).write_bytes(data)
        return line['id'], {'hash': h, 'fx': fx.key(p.get('fx')), 'file': name, 'time': time.strftime('%Y-%m-%d %H:%M')}, None

    with ThreadPoolExecutor(max_workers=max(1, int(cfg['concurrency']))) as pool:
        for line_id, entry, err in pool.map(run, jobs):
            done += 1
            progress(done, total)
            if err:
                failed[line_id] = err
                if not err.startswith('已停止'):
                    log('  ✗ {}：{}'.format(line_id, err))
                continue
            state = read_json(HERE / 'state.json', {})
            state[line_id] = entry
            write_json(HERE / 'state.json', state)
            how = '呼叫 API' if line_id in todo['api'] else '本機'
            log('  ✓ {}（{}{}）'.format(line_id, how, '＋音效 ' + entry['fx'] if entry['fx'] else '，不套音效'))
    write_manifest()
    stopped = sum(1 for e in failed.values() if e.startswith('已停止'))
    log('完成：成功 {}、失敗 {}{}'.format(total - len(failed), len(failed) - stopped,
                                     '、沒做 {}（停止）'.format(stopped) if stopped else ''))
    if limited:
        log('API 用量到上限：等上限重置後，再按「產生待處理的」就會接著做沒做完的句子。')
    return {'done': total - len(failed), 'failed': failed}


# ---------------------------------------------------------------- 聲音設計（候選聲音）

def sample_path(name: str) -> Path:
    return SAMPLES / name


def save_sample(wav: bytes, prefix: str) -> str:
    SAMPLES.mkdir(parents=True, exist_ok=True)
    name = '{}-{}.wav'.format(prefix, time.strftime('%Y%m%d-%H%M%S-') + hashlib.sha1(wav[:2048]).hexdigest()[:6])
    (SAMPLES / name).write_bytes(wav)
    return name

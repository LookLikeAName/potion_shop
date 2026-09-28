"""
語音工具的核心：設計露米婭與老師的聲音（Gemini 語音設計），批次產生劇情與泡泡台詞的配音。
只用 Python 標準函式庫（3.8 以上）；有 ffmpeg 時把 WAV 轉成 MP3（檔案小很多）。

- 台詞從哪裡來：src/game/config/script.json（劇情的說話順序、泡泡台詞的 key 開頭）
  + 語言檔 src/locales/<配音語言>/*.json 的文字。所有語言共用同一套配音。
- 聲音設定：tools/voice/profiles.json（每個角色的聲音描述、候選聲音、正式使用的 voice_id）。
- 每句的語氣：預設用劇本的動作描述（script.<ID>.act），可以在 tools/voice/styles.json 逐句改。
- 產生紀錄：tools/voice/state.json（每句的內容雜湊，文字、語氣、聲音改了就要重做）。
- 輸出：public/voice/<台詞 ID>.<mp3|wav>，清單 public/voice/manifest.json（遊戲讀這個）。
"""
from __future__ import annotations

import base64
import hashlib
import io
import json
import os
import re
import shutil
import subprocess
import time
import urllib.error
import urllib.request
import wave
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from typing import Callable, Dict, List, Optional, Tuple

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent.parent
LOCALES = ROOT / 'src' / 'locales'
SCRIPT = ROOT / 'src' / 'game' / 'config' / 'script.json'
OUT = ROOT / 'public' / 'voice'
SAMPLES = HERE / 'samples'

DEFAULT_CONFIG = {
    'base_url': 'https://generativelanguage.googleapis.com/v1beta',
    'model': 'gemini-3.8-flash-tts',
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
    return shutil.which('ffmpeg')


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

    def add(line_id: str, speaker: str, kind: str, text: str, act: str) -> None:
        override = styles.get(line_id, '')
        style = override or (act if cfg.get('act_as_style') else '')
        sp = speech.get(line_id)
        lines.append({
            'id': line_id, 'speaker': speaker, 'kind': kind, 'text': text, 'act': act,
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
    return lines


def content_hash(text: str, style: str, voice_id: str, cfg: dict) -> str:
    raw = json.dumps([text, style, voice_id, cfg['model'], cfg['output_format']], ensure_ascii=False)
    return hashlib.sha1(raw.encode('utf-8')).hexdigest()[:12]


def rows(cfg: dict) -> List[dict]:
    """批次產生頁的總表：每句的狀態 none（還沒產生）／stale（文字、語氣或聲音改了）／ok／novoice（角色還沒選聲音）"""
    profiles = load_profiles()
    state = read_json(HERE / 'state.json', {})
    # 要 MP3、現在也有 ffmpeg，但之前沒有 ffmpeg 時存成 WAV 的：也算要重做
    want_mp3 = cfg['output_format'] == 'mp3' and bool(ffmpeg_path())
    out = []
    for l in collect_lines(cfg):
        vid = profiles.get(l['speaker'], {}).get('voice_id', '')
        st = state.get(l['id'], {})
        file = st.get('file', '')
        exists = bool(file) and (OUT / file).exists()
        if not vid:
            status = 'novoice'
        elif not exists:
            status = 'none'
        elif st.get('hash') != content_hash(l['speech'], l['style'], vid, cfg) or (want_mp3 and file.endswith('.wav')):
            status = 'stale'
        else:
            status = 'ok'
        out.append({**l, 'status': status, 'file': file if exists else '', 'time': st.get('time', '')})
    return out


def pending_ids(cfg: dict) -> List[str]:
    return [r['id'] for r in rows(cfg) if r['status'] in ('none', 'stale')]


def test_lines(cfg: dict, speaker: str) -> List[dict]:
    """試講用：這個角色的所有劇情台詞（送給模型的版本，配音語言）與它的語氣，{id, text, style}"""
    return [
        {'id': l['id'], 'text': l['speech'], 'style': l['style']}
        for l in collect_lines(cfg) if l['speaker'] == speaker and l['kind'] == 'story'
    ]


# ---------------------------------------------------------------- API

class ApiError(Exception):
    pass


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
            # 太多請求、伺服器錯誤：等一下再試；其他錯誤（金鑰、參數）直接回報
            if e.code not in (429, 500, 502, 503, 504):
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
        for k in ('voice_id', 'id', 'name'):
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


def create_voice(cfg: dict, api_key: str, speaker: str, gender: str, description: str) -> Tuple[str, Optional[bytes]]:
    """建立（存下）一個聲音，回傳 (voice_id, 試聽 WAV)"""
    voice = {
        'model': cfg['model'],
        'type': 'prompted',
        'display_name': 'potion-shop-{}-{}'.format(speaker, time.strftime('%Y%m%d-%H%M%S')),
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


def list_voices(cfg: dict, api_key: str) -> List[dict]:
    res = _request(cfg, api_key, 'GET', 'voices')
    items = res.get('voices') or res.get('items') or []
    out = []
    for v in items:
        out.append({
            'voice_id': find_voice_id(v),
            'display_name': v.get('display_name') or v.get('displayName') or '',
            'language_code': v.get('language_code') or v.get('languageCode') or '',
        })
    return out


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


def generate(cfg: dict, api_key: str, ids: List[str], log: Callable[[str], None] = print,
             progress: Callable[[int, int], None] = lambda a, b: None, stop: Callable[[], bool] = lambda: False) -> dict:
    profiles = load_profiles()
    by_id = {l['id']: l for l in collect_lines(cfg)}
    todo = [by_id[i] for i in ids if i in by_id]
    total = len(todo)
    done = 0
    failed: Dict[str, str] = {}
    if cfg['output_format'] == 'mp3' and not ffmpeg_path():
        log('沒有 ffmpeg：先存成 WAV（檔案比較大）。在 WSL 可以用 sudo apt install ffmpeg 安裝，之後重做就會轉成 MP3。')
    log('產生 {} 句（模型 {}，配音語言 {}）'.format(total, cfg['model'], cfg['voice_lang']))
    progress(0, total)
    OUT.mkdir(parents=True, exist_ok=True)

    def run(line: dict) -> Tuple[str, Optional[str], Optional[str], str]:
        if stop():
            return line['id'], None, '已停止', ''
        vid = profiles.get(line['speaker'], {}).get('voice_id', '')
        if not vid:
            return line['id'], None, '這個角色還沒選聲音', ''
        try:
            data, ext = encode(synthesize(cfg, api_key, vid, line['speech'], line['style']), cfg)
        except ApiError as e:
            return line['id'], None, str(e)[:300], ''
        name = '{}.{}'.format(line['id'], ext)
        # 換了格式：舊的檔案刪掉
        for old in OUT.glob(line['id'] + '.*'):
            if old.name != name and old.suffix in ('.mp3', '.wav', '.ogg'):
                old.unlink()
        (OUT / name).write_bytes(data)
        return line['id'], name, None, content_hash(line['speech'], line['style'], vid, cfg)

    with ThreadPoolExecutor(max_workers=max(1, int(cfg['concurrency']))) as pool:
        for line_id, name, err, h in pool.map(run, todo):
            done += 1
            progress(done, total)
            if err:
                failed[line_id] = err
                log('  ✗ {}：{}'.format(line_id, err))
                continue
            state = read_json(HERE / 'state.json', {})
            state[line_id] = {'hash': h, 'file': name, 'time': time.strftime('%Y-%m-%d %H:%M')}
            write_json(HERE / 'state.json', state)
            log('  ✓ {}'.format(line_id))
    write_manifest()
    log('完成：成功 {}、失敗 {}'.format(total - len(failed), len(failed)))
    return {'done': total - len(failed), 'failed': failed}


# ---------------------------------------------------------------- 聲音設計（候選聲音）

def sample_path(name: str) -> Path:
    return SAMPLES / name


def save_sample(wav: bytes, prefix: str) -> str:
    SAMPLES.mkdir(parents=True, exist_ok=True)
    name = '{}-{}.wav'.format(prefix, time.strftime('%Y%m%d-%H%M%S-') + hashlib.sha1(wav[:2048]).hexdigest()[:6])
    (SAMPLES / name).write_bytes(wav)
    return name

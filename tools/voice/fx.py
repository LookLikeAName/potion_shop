"""
音效控制台的後製處理（用 ffmpeg）：試聽、比較區、批次產生都走這同一條處理鏈，聽到的就是輸出的。

處理順序：
  裁掉前後靜音 → 音高／速度（rubberband，可保留共振峰）→ 低切 → 四段 EQ → 齒音抑制 → 壓縮
  → 殘響（卷積，IR 由程式產生）→ 響度標準化（EBU R128 兩段式）或固定增益 → 防爆音限制 → 前後保留一點空白與淡入淡出

設定是一個 dict（見 DEFAULT）。enabled = False 或所有數值都是中性時不處理，原音直接輸出。
"""
from __future__ import annotations

import hashlib
import json
import math
import random
import re
import shutil
import struct
import subprocess
import tempfile
import wave
from pathlib import Path
from typing import Dict, List, Optional

HERE = Path(__file__).resolve().parent
CACHE = HERE / 'samples' / '.fx'
USER_PRESETS = HERE / 'fx_presets.json'
# 處理方式改了就加一，舊的處理結果全部重做
VERSION = 1
RATE = 24000

# 每個參數：預設值、範圍（給介面用，也用來把數值限制在合理範圍）
PARAMS: Dict[str, dict] = {
    'trim': {'default': True},
    'pad': {'default': 60, 'min': 0, 'max': 400},              # 裁掉靜音後，前後保留多少毫秒
    'pitch': {'default': 0.0, 'min': -6.0, 'max': 6.0},        # 半音
    'formant': {'default': True},                               # 保留共振峰（關掉 = 變聲器感，升調會像小孩／花栗鼠）
    'tempo': {'default': 1.0, 'min': 0.7, 'max': 1.4},         # 語速倍率（不影響音高）
    'highpass': {'default': 0, 'min': 0, 'max': 300},          # 低切 Hz，0 = 關
    'low': {'default': 0.0, 'min': -12.0, 'max': 12.0},        # 厚度 200Hz
    'mid': {'default': 0.0, 'min': -12.0, 'max': 12.0},        # 鼻音／悶 1kHz
    'presence': {'default': 0.0, 'min': -12.0, 'max': 12.0},   # 清晰度 3.5kHz
    'air': {'default': 0.0, 'min': -12.0, 'max': 12.0},        # 空氣感 8kHz
    'deess': {'default': 0, 'min': 0, 'max': 100},             # 齒音抑制 %
    'comp': {'default': 0, 'min': 0, 'max': 100},              # 壓縮量 %
    'reverb': {'default': 0, 'min': 0, 'max': 100},            # 殘響量 %
    'room': {'default': 0.5, 'min': 0.2, 'max': 2.0},          # 殘響長度（秒）
    'normalize': {'default': False},                            # 響度標準化
    'loudness': {'default': -16.0, 'min': -24.0, 'max': -12.0},  # 目標響度 LUFS
    'gain': {'default': 0.0, 'min': -12.0, 'max': 12.0},       # 不做響度標準化時的增益 dB
}
DEFAULT = {'enabled': True, **{k: v['default'] for k, v in PARAMS.items()}}

# 內建的起點（使用者另存的在 fx_presets.json）
BUILTIN_PRESETS = {
    '原音': {'enabled': False},
    '基本整理': {'trim': True, 'pad': 60, 'highpass': 70, 'comp': 25, 'normalize': True, 'loudness': -16.0},
    '明亮可愛': {'trim': True, 'pad': 60, 'pitch': 1.0, 'tempo': 1.03, 'highpass': 90, 'low': -1.5,
             'presence': 2.5, 'air': 3.0, 'deess': 20, 'comp': 30, 'normalize': True, 'loudness': -16.0},
    '溫暖沉穩': {'trim': True, 'pad': 80, 'pitch': -0.8, 'tempo': 0.97, 'highpass': 60, 'low': 2.5, 'mid': -1.5,
             'air': -1.0, 'comp': 30, 'reverb': 12, 'room': 0.6, 'normalize': True, 'loudness': -16.0},
    '小房間': {'trim': True, 'pad': 60, 'highpass': 70, 'comp': 25, 'reverb': 18, 'room': 0.45,
            'normalize': True, 'loudness': -16.0},
}

# 需要的 ffmpeg 濾鏡（缺哪個，就停用對應的功能）
FILTERS = {
    'silenceremove': ('trim',), 'areverse': ('trim',), 'rubberband': ('pitch', 'tempo', 'formant'),
    'highpass': ('highpass',), 'lowshelf': ('low',), 'equalizer': ('mid', 'presence'), 'highshelf': ('air',),
    'deesser': ('deess',), 'acompressor': ('comp',), 'afir': ('reverb', 'room'), 'loudnorm': ('normalize', 'loudness'),
    'alimiter': (), 'afade': (), 'adelay': ('pad',), 'apad': ('pad',), 'aresample': (),
}


class FxError(Exception):
    pass


def ffmpeg() -> Optional[str]:
    return shutil.which('ffmpeg')


_filters_cache: Optional[set] = None


def available_filters() -> set:
    global _filters_cache
    if _filters_cache is None:
        ff = ffmpeg()
        if not ff:
            _filters_cache = set()
        else:
            r = subprocess.run([ff, '-hide_banner', '-filters'], capture_output=True, check=False)
            _filters_cache = set(re.findall(r'^\s*\S+\s+(\w+)\s', r.stdout.decode('utf-8', 'replace'), re.M))
    return _filters_cache


def status() -> dict:
    """介面用：有沒有 ffmpeg、缺哪些濾鏡、因此停用哪些參數"""
    have = available_filters()
    missing = [f for f in FILTERS if f not in have]
    disabled = sorted({p for f in missing for p in FILTERS[f]})
    return {'ffmpeg': bool(ffmpeg()), 'missing': missing, 'disabled': disabled}


def normalize(fx: Optional[dict]) -> dict:
    """補齊預設值、限制在範圍內、四捨五入（同樣的聲音得到同樣的設定，快取與雜湊才穩定）"""
    out = dict(DEFAULT)
    if not fx:
        out['enabled'] = False
        return out
    out['enabled'] = bool(fx.get('enabled', True))
    for k, p in PARAMS.items():
        v = fx.get(k, p['default'])
        if isinstance(p['default'], bool):
            out[k] = bool(v)
            continue
        try:
            v = float(v)
        except (TypeError, ValueError):
            v = float(p['default'])
        v = min(p['max'], max(p['min'], v))
        out[k] = round(v, 2) if isinstance(p['default'], float) else int(round(v))
    return out


def is_neutral(fx: Optional[dict]) -> bool:
    """不會改變聲音的設定（關閉，或每個效果都沒開）"""
    f = normalize(fx)
    if not f['enabled']:
        return True
    return (not f['trim'] and f['pitch'] == 0 and f['tempo'] == 1 and f['highpass'] == 0
            and f['low'] == f['mid'] == f['presence'] == f['air'] == 0 and f['deess'] == 0 and f['comp'] == 0
            and f['reverb'] == 0 and not f['normalize'] and f['gain'] == 0)


def key(fx: Optional[dict]) -> str:
    """設定的雜湊（批次判斷要不要重新處理）；不處理 = 空字串"""
    if is_neutral(fx):
        return ''
    raw = json.dumps([VERSION, normalize(fx)], sort_keys=True)
    return hashlib.sha1(raw.encode('utf-8')).hexdigest()[:10]


# ---------------------------------------------------------------- 預設組合

def load_presets() -> Dict[str, dict]:
    user = {}
    if USER_PRESETS.exists():
        user = json.loads(USER_PRESETS.read_text(encoding='utf-8'))
    out = {k: normalize({**v, 'enabled': v.get('enabled', True)}) for k, v in BUILTIN_PRESETS.items()}
    out.update({k: normalize(v) for k, v in user.items()})
    return out


def save_preset(name: str, fx: Optional[dict]) -> None:
    user = json.loads(USER_PRESETS.read_text(encoding='utf-8')) if USER_PRESETS.exists() else {}
    if fx is None:
        user.pop(name, None)
    else:
        user[name] = normalize(fx)
    with open(USER_PRESETS, 'w', encoding='utf-8', newline='\n') as f:
        f.write(json.dumps(dict(sorted(user.items())), ensure_ascii=False, indent=2) + '\n')


# ---------------------------------------------------------------- 殘響的脈衝響應

def impulse(room: float, wet: float) -> Path:
    """
    殘響用的脈衝響應（WAV）：第一個取樣是 1（乾聲原樣通過），之後是指數衰減、稍微悶一點的雜訊（殘響）。
    卷積一次就同時得到「乾聲 + 殘響」，不用另外混音。room = 衰減到 -60dB 的秒數，wet = 殘響量 0～1。
    """
    CACHE.mkdir(parents=True, exist_ok=True)
    path = CACHE / 'ir-{:.2f}-{:.2f}.wav'.format(room, wet)
    if path.exists():
        return path
    rng = random.Random(7)
    pre = int(RATE * 0.012)  # 預延遲 12ms：殘響和乾聲分開一點，比較清楚
    n = int(RATE * room)
    tail = []
    lp = 0.0
    for i in range(n):
        lp += 0.35 * (rng.uniform(-1, 1) - lp)  # 一階低通：高頻少一點，比較像木造的房間
        tail.append(lp * math.exp(-6.9 * i / n))
    energy = math.sqrt(sum(v * v for v in tail)) or 1.0
    scale = wet * 0.55 / energy  # 殘響的能量 = 乾聲的 wet × 0.55 倍
    samples = [1.0] + [0.0] * (pre - 1) + [v * scale for v in tail]
    with wave.open(str(path), 'wb') as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(RATE)
        w.writeframes(b''.join(struct.pack('<h', max(-32767, min(32767, int(v * 32767)))) for v in samples))
    return path


# ---------------------------------------------------------------- 處理鏈

def needed_filters(f: dict) -> set:
    """這組設定實際會用到的濾鏡"""
    need = {'aresample', 'alimiter'}
    if f['trim']:
        need |= {'silenceremove', 'areverse', 'afade'} | ({'adelay', 'apad'} if f['pad'] else set())
    if f['pitch'] != 0 or f['tempo'] != 1:
        need.add('rubberband')
    for p, flt in (('highpass', 'highpass'), ('low', 'lowshelf'), ('mid', 'equalizer'), ('presence', 'equalizer'),
                   ('air', 'highshelf'), ('deess', 'deesser'), ('comp', 'acompressor'), ('reverb', 'afir')):
        if f[p]:
            need.add(flt)
    if f['normalize']:
        need.add('loudnorm')
    return need


def _chain_before_loudness(f: dict) -> List[str]:
    chain: List[str] = []
    if f['trim']:
        # 前面的靜音直接裁；後面的靜音：反轉 → 裁前面 → 再反轉回來
        s = 'silenceremove=start_periods=1:start_threshold=-45dB:start_silence=0.02'
        chain += [s, 'areverse', s, 'areverse']
    if f['pitch'] != 0 or f['tempo'] != 1:
        chain.append('rubberband=pitch={:.5f}:tempo={:.4f}:formant={}:pitchq=quality'.format(
            2 ** (f['pitch'] / 12), f['tempo'], 'preserved' if f['formant'] else 'shifted'))
    if f['highpass']:
        chain.append('highpass=f={}:poles=2'.format(f['highpass']))
    if f['low']:
        chain.append('lowshelf=f=200:g={}'.format(f['low']))
    if f['mid']:
        chain.append('equalizer=f=1000:t=o:w=1.2:g={}'.format(f['mid']))
    if f['presence']:
        chain.append('equalizer=f=3500:t=o:w=1.3:g={}'.format(f['presence']))
    if f['air']:
        chain.append('highshelf=f=8000:g={}'.format(f['air']))
    if f['deess']:
        chain.append('deesser=i={:.2f}:m=0.5:f=0.5'.format(f['deess'] / 100))
    if f['comp']:
        a = f['comp'] / 100
        thr_db = -12 - 18 * a          # 0% → -12dB、100% → -30dB 開始壓
        ratio = 1.5 + 4.5 * a          # 1.5:1 → 6:1
        makeup = 10 ** ((-thr_db * (1 - 1 / ratio)) * 0.5 / 20)  # 補回大約一半被壓掉的音量
        chain.append('acompressor=threshold={:.5f}:ratio={:.2f}:attack=5:release=90:knee=4:makeup={:.3f}'.format(
            10 ** (thr_db / 20), ratio, min(8.0, makeup)))
    return chain


def _run(ff: str, graph: str, src: Path, ir: Optional[Path], out: Optional[Path]) -> str:
    cmd = [ff, '-hide_banner', '-nostats', '-y', '-i', str(src)]
    if ir:
        cmd += ['-i', str(ir)]
    cmd += ['-filter_complex', graph, '-map', '[o]']
    cmd += ['-ac', '1', '-c:a', 'pcm_s16le', str(out)] if out else ['-f', 'null', '-']
    r = subprocess.run(cmd, capture_output=True, check=False)
    err = r.stderr.decode('utf-8', 'replace')
    if r.returncode != 0:
        last = err.strip().splitlines()[-1][:300] if err.strip() else ''
        raise FxError('ffmpeg 失敗：{}'.format(last or r.returncode))
    return err


def render(wav: bytes, fx: Optional[dict]) -> bytes:
    """套用音效，回傳 WAV（24kHz 單聲道 16-bit）。中性的設定直接回傳原音"""
    if is_neutral(fx):
        return wav
    ff = ffmpeg()
    if not ff:
        raise FxError('沒有 ffmpeg，無法套用音效（WSL：sudo apt install ffmpeg）')
    f = normalize(fx)
    lacking = sorted(needed_filters(f) - available_filters())
    if lacking:
        raise FxError('這個 ffmpeg 沒有需要的濾鏡：{}'.format('、'.join(lacking)))
    with tempfile.TemporaryDirectory() as tmp:
        src = Path(tmp) / 'in.wav'
        out = Path(tmp) / 'out.wav'
        src.write_bytes(wav)
        chain = _chain_before_loudness(f)
        ir = impulse(f['room'], f['reverb'] / 100) if f['reverb'] else None
        head = '[0:a]{}[p];'.format(','.join(chain) if chain else 'anull')
        head += '[p][1:a]afir=gtype=none:dry=1:wet=1[q];' if ir else '[p]anull[q];'
        if f['normalize']:
            # 第一段：量出目前的響度；第二段：用量到的數值做線性的標準化（不會像單段那樣忽大忽小）
            target = 'I={}:TP=-1.5:LRA=11'.format(f['loudness'])
            log = _run(ff, head + '[q]loudnorm={}:print_format=json[o]'.format(target), src, ir, None)
            try:
                m = json.loads(log[log.rindex('{'):log.rindex('}') + 1])
                level = ('loudnorm={}:measured_I={}:measured_TP={}:measured_LRA={}:measured_thresh={}:offset={}:linear=true'
                         .format(target, m['input_i'], m['input_tp'], m['input_lra'], m['input_thresh'], m['target_offset']))
                if not math.isfinite(float(m['input_i'])):
                    level = 'anull'  # 幾乎沒有聲音（量不到響度）
            except (ValueError, KeyError):
                level = 'loudnorm={}'.format(target)
        else:
            level = 'volume={}dB'.format(f['gain']) if f['gain'] else 'anull'
        tail = [level, 'aresample={}'.format(RATE), 'alimiter=limit=0.891:level=false:attack=3:release=40']
        if f['trim']:
            # 裁切之後補一點前後的空白，並淡入淡出，避免切口爆音
            tail += ['afade=t=in:d=0.005', 'areverse', 'afade=t=in:d=0.02', 'areverse']
            if f['pad']:
                tail += ['adelay={}'.format(f['pad']), 'apad=pad_dur={:.3f}'.format(f['pad'] / 1000)]
        _run(ff, head + '[q]{}[o]'.format(','.join(tail)), src, ir, out)
        return out.read_bytes()


def render_cached(src: Path, fx: Optional[dict]) -> Path:
    """試聽用：同一個檔案＋同一組設定只處理一次（結果放在 samples/.fx/）"""
    if is_neutral(fx):
        return src
    CACHE.mkdir(parents=True, exist_ok=True)
    data = src.read_bytes()
    if data[:4] != b'RIFF':
        data = decode(data)
    h = hashlib.sha1(data).hexdigest()[:12]
    path = CACHE / '{}-{}.wav'.format(h, key(fx))
    if not path.exists():
        path.write_bytes(render(data, fx))
        _prune()
    return path


def decode(data: bytes) -> bytes:
    """MP3 之類的 → WAV（24kHz 單聲道）"""
    ff = ffmpeg()
    if not ff:
        raise FxError('沒有 ffmpeg，無法讀取 MP3')
    with tempfile.TemporaryDirectory() as tmp:
        src, out = Path(tmp) / 'in', Path(tmp) / 'out.wav'
        src.write_bytes(data)
        r = subprocess.run([ff, '-hide_banner', '-loglevel', 'error', '-y', '-i', str(src), '-ac', '1', '-ar', str(RATE),
                            '-c:a', 'pcm_s16le', str(out)], capture_output=True, check=False)
        if r.returncode != 0:
            raise FxError('ffmpeg 轉檔失敗：' + r.stderr.decode('utf-8', 'replace')[:200])
        return out.read_bytes()


def _prune(keep: int = 400) -> None:
    files = sorted((p for p in CACHE.glob('*.wav') if not p.name.startswith('ir-')), key=lambda p: p.stat().st_mtime)
    for p in files[:-keep]:
        try:
            p.unlink()
        except OSError:
            pass

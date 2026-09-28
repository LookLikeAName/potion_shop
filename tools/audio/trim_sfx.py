"""
把找到的音效檔處理成遊戲用的音效：切掉前後的無聲、結尾短短淡出、轉成 MP3，
放到 src/assets/audio/sfx/<音效 ID>.mp3（遊戲有這個檔就用它取代合成的聲音）。需要 ffmpeg。

  python3 tools/audio/trim_sfx.py <來源檔> <音效 ID>
  python3 tools/audio/trim_sfx.py public/sound_effect/cash-register-kaching-sound-effect.mp3 sale

選項：
  --threshold -50   低於這個音量（dB）算無聲
  --keep 0.01       聲音開始前多留幾秒（不要切到起音）
  --tail 0.05       聲音結束後多留幾秒（不要切到餘韻）
  --fade 0.06       結尾淡出幾秒
  --mono            轉成單聲道（檔案更小）
  --gain 0          音量調整（dB，例如 -3）

音效 ID 見 src/audio/sfx.ts：harvest、brew、tapPot、tapCauldron、boil、sale、notify、achievement、event、wish；
循環音 ambGreenhouse、ambCauldron、boilLoop（循環音不要淡出，加 --fade 0）。
"""
from __future__ import annotations

import argparse
import json
import re
import shutil
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent.parent
OUT_DIR = ROOT / 'src' / 'assets' / 'audio' / 'sfx'


def duration(ff_probe: str, path: Path) -> float:
    r = subprocess.run([ff_probe, '-v', 'error', '-show_entries', 'format=duration', '-of', 'json', str(path)],
                       stdout=subprocess.PIPE, check=True)
    return float(json.loads(r.stdout)['format']['duration'])


def sound_range(ff: str, path: Path, threshold: float, total: float) -> tuple:
    """用 silencedetect 找出有聲音的範圍（開頭與結尾的無聲切掉；中間的短暫無聲保留）"""
    r = subprocess.run([ff, '-hide_banner', '-i', str(path), '-af', 'silencedetect=noise={}dB:d=0.03'.format(threshold),
                        '-f', 'null', '-'], stderr=subprocess.PIPE, stdout=subprocess.DEVNULL, check=True)
    log = r.stderr.decode('utf-8', 'replace')
    starts = [float(x) for x in re.findall(r'silence_start: ([\d.]+)', log)]
    ends = [float(x) for x in re.findall(r'silence_end: ([\d.]+)', log)]
    begin, finish = 0.0, total
    # 檔案一開始就是無聲：第一段無聲結束的地方是聲音的開頭
    if starts and starts[0] <= 0.001 and ends:
        begin = ends[0]
    # 最後一段無聲一直到檔案結尾：它開始的地方是聲音的結尾
    if starts and (len(ends) < len(starts) or ends[-1] >= total - 0.01):
        finish = starts[-1]
    return begin, max(begin + 0.01, finish)


def main() -> int:
    if hasattr(sys.stdout, 'reconfigure'):
        sys.stdout.reconfigure(encoding='utf-8')
    p = argparse.ArgumentParser(description='切掉音效前後的無聲，轉成遊戲用的 MP3')
    p.add_argument('src', type=Path)
    p.add_argument('id', help='音效 ID（輸出檔名）')
    p.add_argument('--threshold', type=float, default=-50)
    p.add_argument('--keep', type=float, default=0.01)
    p.add_argument('--tail', type=float, default=0.05)
    p.add_argument('--fade', type=float, default=0.06)
    p.add_argument('--mono', action='store_true')
    p.add_argument('--gain', type=float, default=0)
    p.add_argument('--bitrate', default='128k')
    a = p.parse_args()

    ff, fp = shutil.which('ffmpeg'), shutil.which('ffprobe')
    if not ff or not fp:
        print('需要 ffmpeg（WSL：sudo apt install ffmpeg）')
        return 2
    if not a.src.exists():
        print('找不到來源檔：{}'.format(a.src))
        return 2

    # 有聲音的範圍：開頭往前多留一點（不要切到起音），結尾多留一點再淡出（不要切到餘韻）
    total = duration(fp, a.src)
    begin, finish = sound_range(ff, a.src, a.threshold, total)
    start = max(0.0, begin - a.keep)
    end = min(total, finish + a.tail)
    length = end - start
    filters = ['atrim=start={:.3f}:end={:.3f}'.format(start, end), 'asetpts=PTS-STARTPTS']
    if a.fade > 0 and length > a.fade * 2:
        filters.append('afade=t=out:st={:.3f}:d={}'.format(length - a.fade, a.fade))
    if a.gain:
        filters.append('volume={}dB'.format(a.gain))
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    out = OUT_DIR / '{}.mp3'.format(a.id)
    cmd = [ff, '-hide_banner', '-loglevel', 'error', '-y', '-i', str(a.src), '-af', ','.join(filters)]
    if a.mono:
        cmd += ['-ac', '1']
    cmd += ['-b:a', a.bitrate, str(out)]
    subprocess.run(cmd, check=True)
    # 同一個 ID 其他格式的舊檔刪掉（遊戲只取一個）
    for old in OUT_DIR.glob('{}.*'.format(a.id)):
        if old != out and old.suffix in ('.mp3', '.ogg', '.wav'):
            old.unlink()
    print('{} → {}'.format(a.src, out.relative_to(ROOT)))
    print('長度 {:.2f} 秒 → {:.2f} 秒'.format(duration(fp, a.src), duration(fp, out)))
    return 0


if __name__ == '__main__':
    sys.exit(main())

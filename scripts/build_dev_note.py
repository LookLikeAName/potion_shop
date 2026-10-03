#!/usr/bin/env python3
"""開發筆記：src/credit/develop_note.md → public/dev-note/index.html（遊戲的魔導書風格，網址 /dev-note/）。

用法（WSL，需要 Pillow；宣傳影片需要 ffmpeg）：
    python3 scripts/build_dev_note.py

筆記的寫法（簡單的 Markdown）：
  - 第一行 = 標題、第二個非空白行 = 日期
  - 每一行文字是一段（行尾不是句號、驚嘆號這類符號的，和下一行接成同一段）；「1. 」開頭的連續幾行是編號清單
  - ![說明](檔名) = 圖片（檔案放在 src/credit/）；緊接在圖片下一行的文字 = 圖片說明
  - 用括號包起來的一整行，例如「(這邊沒有截圖)」= 旁註
  - (promo video?) 或 (promo video) = 放宣傳影片（promo/lumia_promo.mp4）
  - 很短（12 字以內）、完全沒有標點的一行（例如署名）靠右擺
圖片會轉成 WebP、最寬 1400px；宣傳影片另外壓成網頁用的版本（Cloudflare Pages 單一檔案上限 25MB）。
"""
import html
import re
import shutil
import subprocess
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / 'src' / 'credit'
NOTE = SRC / 'develop_note.md'
OUT = ROOT / 'public' / 'dev-note'
IMG = OUT / 'img'
UI = ROOT / 'src' / 'assets' / 'art' / 'ui'
PROMO = ROOT / 'promo' / 'lumia_promo.mp4'

MAX_W = 1400
QUALITY = 80

# 圖片的替代文字（筆記裡寫的是「alt text」時用這個）
ALT = {
    'game_dev_project_prompt': '和 Gemini 討論遊戲企劃的對話',
    'char_lumia_ref': '露米婭的角色設定圖',
    'asserts_preview': '用 Grok 生成的美術素材一覽',
    'early_tutorial-1': '遊戲畫面：新手教學',
    'early_tutorial': '遊戲畫面：新手教學',
    'balance-report': '遊戲平衡的模擬報告',
    'translate_tool': '翻譯工具',
    'voice_tool_0': '語音工具：聲音設計',
    'voice_tool_1': '語音工具：音效控制台與比較區',
    'early_title': '遊戲的標題畫面',
}


def webp(src: Path, dst: Path, max_w=MAX_W, quality=QUALITY) -> tuple:
    im = Image.open(src)
    im = im.convert('RGBA' if im.mode in ('RGBA', 'LA', 'P') else 'RGB')
    if im.width > max_w:
        im = im.resize((max_w, round(im.height * max_w / im.width)), Image.LANCZOS)
    im.save(dst, 'WEBP', quality=quality, method=6)
    return im.size


def promo_video():
    """
    網頁用的宣傳影片（1080p、比較高的壓縮）與封面圖。需要 ffmpeg（WSL 有，Windows 沒有）：
    沒有 ffmpeg 時沿用上次壓好的影片與封面
    """
    mp4 = OUT / 'promo.mp4'
    poster = IMG / 'promo_poster.webp'
    if not shutil.which('ffmpeg'):
        if mp4.exists() and poster.exists():
            print('注意：沒有 ffmpeg，沿用上次壓好的宣傳影片（要更新影片請在 WSL 執行）')
            return mp4.name, 'img/' + poster.name, mp4.stat().st_size
        print('警告：沒有 ffmpeg，也沒有之前壓好的影片：頁面裡不會有宣傳影片。請在 WSL 執行這個腳本')
        return None
    if not PROMO.exists():
        print('警告：找不到 {}：頁面裡不會有宣傳影片'.format(PROMO))
        return None
    subprocess.run(['ffmpeg', '-hide_banner', '-loglevel', 'error', '-y', '-i', str(PROMO),
                    '-c:v', 'libx264', '-preset', 'slow', '-crf', '25', '-pix_fmt', 'yuv420p',
                    '-c:a', 'aac', '-b:a', '128k', '-movflags', '+faststart', str(mp4)], check=True)
    frame = OUT / '_poster.png'
    subprocess.run(['ffmpeg', '-hide_banner', '-loglevel', 'error', '-y', '-ss', '21.0', '-i', str(PROMO),  # 封面：結尾的標誌畫面
                    '-frames:v', '1', str(frame)], check=True)
    webp(frame, poster, 1280, 78)
    frame.unlink()
    return mp4.name, 'img/' + poster.name, mp4.stat().st_size


def render_body(lines, video):
    out = []
    i = 0
    n = len(lines)
    while i < n:
        line = lines[i].strip()
        if not line:
            i += 1
            continue
        m = re.match(r'!\[(.*?)\]\((.+?)\)$', line)
        if m:
            name = m.group(2)
            stem = Path(name).stem
            alt = m.group(1) if m.group(1) and m.group(1) != 'alt text' else ALT.get(stem, '')
            dst = IMG / (stem + '.webp')
            w, h = webp(SRC / name, dst)
            caption = ''
            # 緊接在圖片下一行的文字 = 圖片說明
            if i + 1 < n and lines[i + 1].strip() and not lines[i + 1].strip().startswith('!['):
                caption = lines[i + 1].strip()
                i += 1
            out.append('<figure><a class="zoom" href="img/{0}"><img src="img/{0}" width="{1}" height="{2}" alt="{3}" loading="lazy"></a>{4}</figure>'.format(
                dst.name, w, h, html.escape(alt, quote=True), '<figcaption>{}</figcaption>'.format(html.escape(caption)) if caption else ''))
            i += 1
            continue
        if re.match(r'^\(promo video\??\)$', line, re.I):
            if video:
                name, poster, _ = video
                out.append('<figure class="video"><video controls playsinline preload="none" poster="{}"><source src="{}" type="video/mp4"></video></figure>'.format(poster, name))
            i += 1
            continue
        if re.match(r'^\d+\.\s', line):
            items = []
            while i < n and re.match(r'^\d+\.\s', lines[i].strip()):
                items.append(re.sub(r'^\d+\.\s*', '', lines[i].strip()))
                i += 1
            out.append('<ol>{}</ol>'.format(''.join('<li>{}</li>'.format(html.escape(x)) for x in items)))
            continue
        if re.match(r'^[(（].*[)）]$', line):
            out.append('<p class="aside">{}</p>'.format(html.escape(line)))
            i += 1
            continue
        # 句子在行尾斷開（不是以句號、驚嘆號這類符號結尾）：和下一行接成同一段
        text = line
        while (i + 1 < n and lines[i + 1].strip() and not re.search(r'[。！？!?」』)）…~～]$', text)
               and not re.match(r'(!\[|\d+\.\s|[(（])', lines[i + 1].strip())):
            i += 1
            text += lines[i].strip()
        # 很短、完全沒有標點的一行（署名）：靠右擺
        is_sign = len(text) <= 12 and not re.search(r'[。！？!?，、,.:：；;「」()（）]', text)
        out.append('<p{}>{}</p>'.format(' class="signature"' if is_sign else '', html.escape(text)))
        i += 1
    return '\n'.join(out)


PAGE = '''<!doctype html>
<html lang="zh-Hant">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{title}｜露米婭的藥水工坊</title>
<meta name="description" content="一個人、50 小時，用 AI 做出《露米婭的藥水工坊》的開發筆記。">
<meta name="theme-color" content="#2b1d14">
<link rel="icon" type="image/png" sizes="32x32" href="../favicon-32.png">
<style>
  :root {{
    --ink: #4a3426; --ink-soft: #7a5c44; --gold: #d9a441; --teal: #2f6f6a;
    --cover: #6b3a26; --cover-dark: #3e2217; --page: #f5e8c8; --page-deep: #e9d6ab; --page-edge: #d8c093;
    --leather: #2b1d14;
  }}
  * {{ box-sizing: border-box; }}
  html {{ background: #1c130e; }}
  body {{
    margin: 0; min-height: 100vh; color: var(--ink);
    font: 17px/1.95 "Noto Sans TC", "Microsoft JhengHei", "PingFang TC", "Heiti TC", sans-serif;
    background: url(img/ui_leather_texture.webp), linear-gradient(100deg, var(--cover-dark), var(--cover) 30%, var(--cover-dark));
    background-size: 320px, cover; background-attachment: fixed;
    padding: 28px 16px 56px;
  }}
  .wrap {{ max-width: 860px; margin: 0 auto; }}
  header {{ text-align: center; margin-bottom: 18px; }}
  header img {{ width: min(520px, 88%); height: auto; filter: drop-shadow(0 8px 16px rgba(0, 0, 0, .55)); }}
  /* 書頁：羊皮紙、左邊是書脊的陰影、四角的花紋 */
  .page {{
    position: relative; padding: 46px clamp(22px, 6vw, 70px) 54px;
    border-radius: 6px 16px 16px 6px;
    background: url(img/ui_page_texture.webp), radial-gradient(ellipse at 55% 30%, #fbf2dc, var(--page) 55%, var(--page-deep));
    background-size: 600px, cover;
    box-shadow: inset 2.2em 0 2em -1.6em rgba(90, 55, 25, .5), 3px 0 0 var(--page-deep), 6px 0 0 var(--page-edge),
      9px 0 0 var(--page-deep), 12px 0 0 var(--page-edge), 0 18px 40px rgba(0, 0, 0, .55);
  }}
  .corner {{ position: absolute; width: 64px; height: 64px; background: url(img/ui_corner.webp) center / contain no-repeat; opacity: .9; pointer-events: none; }}
  .corner.tl {{ top: 10px; left: 14px; }}
  .corner.tr {{ top: 10px; right: 10px; transform: scaleX(-1); }}
  .corner.bl {{ bottom: 10px; left: 14px; transform: scaleY(-1); }}
  .corner.br {{ bottom: 10px; right: 10px; transform: rotate(180deg); }}
  h1 {{ margin: 0; text-align: center; font-size: clamp(28px, 5vw, 38px); letter-spacing: .25em; color: #5a3a22; text-indent: .25em; }}
  .date {{ text-align: center; color: var(--ink-soft); letter-spacing: .1em; margin: 2px 0 0; }}
  .divider {{ height: 26px; margin: 18px auto 26px; width: min(460px, 90%); background: url(img/ui_divider.webp) center / 100% 100% no-repeat; }}
  p {{ margin: 0 0 1.05em; text-align: justify; }}
  p.aside {{ color: var(--ink-soft); font-size: .9em; text-align: center; }}
  p.signature {{ text-align: right; margin-top: 1.6em; font-weight: 700; letter-spacing: .15em; color: #5a3a22; }}
  ol {{ list-style: none; counter-reset: n; margin: .2em 0 1.4em; padding: .7em 1em; background: rgba(255, 250, 238, .75);
    border: 1.5px solid var(--page-edge); border-radius: 12px; box-shadow: 0 2px 0 rgba(120, 85, 45, .12); }}
  ol li {{ counter-increment: n; display: flex; gap: .7em; align-items: baseline; padding: .2em 0; }}
  ol li::before {{ content: counter(n); flex: none; display: inline-grid; place-items: center; width: 1.7em; height: 1.7em; border-radius: 50%;
    font-weight: 700; font-size: .85em; color: #fff7e2; background: linear-gradient(#e2b35a, #b07a2a); box-shadow: 0 2px 0 #7a5420; transform: translateY(-.1em); }}
  /* 圖片：夾在書頁上的照片 */
  figure {{ margin: 1.6em auto 1.9em; text-align: center; }}
  figure a.zoom {{ display: inline-block; padding: 10px; background: #fffaf0; border: 1.5px solid var(--page-edge); border-radius: 10px;
    box-shadow: 0 6px 18px rgba(90, 60, 30, .28); transform: rotate(-.6deg); transition: transform .2s; cursor: zoom-in; max-width: 100%; }}
  figure:nth-of-type(even) a.zoom {{ transform: rotate(.6deg); }}
  figure a.zoom:hover {{ transform: rotate(0) scale(1.01); }}
  figure img {{ display: block; max-width: 100%; height: auto; border-radius: 4px; }}
  figcaption {{ margin-top: .7em; color: var(--ink-soft); font-size: .9em; }}
  figure.video video {{ width: 100%; border-radius: 10px; border: 3px solid var(--gold); box-shadow: 0 8px 22px rgba(0, 0, 0, .35); background: #000; }}
  footer {{ text-align: center; margin-top: 30px; }}
  .btn {{ display: inline-block; padding: .55em 2.2em; border-radius: 999px; font-weight: 700; letter-spacing: .08em; text-decoration: none; color: #4a2c12;
    background: linear-gradient(#ffe7a6, #e2b35a 55%, #c9902f); border: 2px solid #7a5420; box-shadow: 0 4px 0 #6a4518, 0 8px 18px rgba(0, 0, 0, .45); }}
  .btn:hover {{ filter: brightness(1.07); }}
  /* 點圖片放大 */
  .lightbox {{ position: fixed; inset: 0; display: none; place-items: center; background: rgba(18, 12, 8, .88); cursor: zoom-out; padding: 20px; z-index: 9; }}
  .lightbox.show {{ display: grid; }}
  .lightbox img {{ max-width: 100%; max-height: 100%; border-radius: 8px; box-shadow: 0 10px 40px rgba(0, 0, 0, .6); }}
  @media (max-width: 600px) {{
    body {{ font-size: 16px; padding: 18px 10px 40px; }}
    .corner {{ width: 40px; height: 40px; }}
  }}
</style>
</head>
<body>
<div class="wrap">
  <header><a href="../"><img src="img/logo.webp" alt="露米婭的藥水工坊" width="{logo_w}" height="{logo_h}"></a></header>
  <article class="page">
    <span class="corner tl"></span><span class="corner tr"></span><span class="corner bl"></span><span class="corner br"></span>
    <h1>{title}</h1>
    <p class="date">{date}</p>
    <div class="divider"></div>
{body}
    <div class="divider"></div>
  </article>
  <footer><a class="btn" href="../">▶ 開始遊玩</a></footer>
</div>
<div class="lightbox" id="lightbox"><img alt=""></div>
<script>
  const box = document.getElementById('lightbox');
  document.querySelectorAll('a.zoom').forEach((a) => a.addEventListener('click', (e) => {{
    e.preventDefault();
    box.querySelector('img').src = a.getAttribute('href');
    box.querySelector('img').alt = a.querySelector('img').alt;
    box.classList.add('show');
  }}));
  box.addEventListener('click', () => box.classList.remove('show'));
  document.addEventListener('keydown', (e) => {{ if (e.key === 'Escape') box.classList.remove('show'); }});
</script>
</body>
</html>
'''


def main():
    # 清掉舊的圖片（筆記改了、圖片換了），但留著宣傳影片與封面（沒有 ffmpeg 時要沿用）
    IMG.mkdir(parents=True, exist_ok=True)
    for p in IMG.iterdir():
        if p.name != 'promo_poster.webp':
            p.unlink()
    lines = NOTE.read_text(encoding='utf-8').splitlines()
    texts = [k for k, l in enumerate(lines) if l.strip()]
    title = lines[texts[0]].strip()
    date = lines[texts[1]].strip()
    rest = lines[texts[1] + 1:]
    # 書本的材質與標誌（遊戲裡同一套素材）
    for name, w in (('ui_leather_texture', 512), ('ui_page_texture', 600), ('ui_corner', 160), ('ui_divider', 920)):
        webp(UI / (name + '.webp'), IMG / (name + '.webp'), w, 82)
    lw, lh = webp(UI / 'ui_logo_zh-TW.webp', IMG / 'logo.webp', 1040, 85)
    video = promo_video()
    body = render_body(rest, video)
    (OUT / 'index.html').write_text(PAGE.format(title=html.escape(title), date=html.escape(date), body=body,
                                                logo_w=lw, logo_h=lh), encoding='utf-8')
    before = sum(p.stat().st_size for p in SRC.glob('*.png'))
    imgs = sum(p.stat().st_size for p in IMG.glob('*'))
    print('完成：{}'.format(OUT / 'index.html'))
    print('圖片：原始 {:.1f} MB → {:.1f} MB（含書本材質與標誌）'.format(before / 1e6, imgs / 1e6))
    if video:
        print('宣傳影片（網頁版）：{:.1f} MB'.format(video[2] / 1e6))


if __name__ == '__main__':
    main()

#!/usr/bin/env python3
"""宣傳影片：遊戲畫面（實際截圖與錄影）、CG、立繪、Q 版人物、標誌、配樂 + 露米婭的宣傳台詞（promo/lumia-voice_ad.wav）。

用法（WSL，需要 ffmpeg 與 Pillow）：
    python3 scripts/make_promo.py                       # 輸出 promo/lumia_promo.mp4
    python3 scripts/make_promo.py --preview 1.2 9 18    # 只輸出這幾秒的畫面（promo/preview_*.png）檢查構圖

遊戲畫面先用 scripts/capture_screens.py（Windows 的 Python + Edge）拍到 promo/shots/。
畫面用 Pillow 一格一格畫（運鏡、轉場、字幕、Q 版人物），再交給 ffmpeg 和聲音一起編碼。
台詞的時間點對應語音檔（換了語音要調整 SHOTS 與 CAPTIONS）。
"""
import argparse
import math
import random
import subprocess
import sys
import tempfile
from functools import lru_cache
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter, ImageFont

ROOT = Path(__file__).resolve().parent.parent
ART = ROOT / 'IdlePotionShop_ArtAssets' / 'public' / 'assets'
SHOTS = ROOT / 'promo' / 'shots'
VOICE = ROOT / 'promo' / 'lumia-voice_ad.wav'
BGM = ROOT / 'public' / 'BGM' / '星屑のメロディ.mp3'
OUT_DIR = ROOT / 'promo'
FONT = '/mnt/c/Windows/Fonts/BIZ-UDGothicB.ttc'

W, H, FPS = 1920, 1080, 30
DURATION = 22.0        # 結尾留久一點（QR code 要有時間掃）
VOICE_DELAY = 0.4      # 語音從第幾秒開始
XFADE = 0.45           # 轉場的長度（秒，以切點為中心）

# 鏡頭：(起始縮放, 結束縮放, 起始中心, 結束中心)；縮放 1 = 看到整張，中心是 0～1 的相對位置
# 畫面：[開始, 結束, 種類, 素材, 鏡頭, 進場的轉場]；切點都在台詞的停頓
SHOTS_PLAN = [
    (0.0, 1.9, 'clip', 'early_title_clip', (1.0, 1.06, (0.5, 0.45), (0.5, 0.42)), 'black'),
    (1.9, 4.6, 'clip', 'late_clip', (1.55, 1.45, (0.2, 0.68), (0.72, 0.68)), 'iris'),
    (4.6, 6.2, 'still', 'cg/cg_evt_dew.png', (1.05, 1.16, (0.55, 0.45), (0.62, 0.42)), 'whip'),
    (6.2, 7.8, 'clip', 'late_fever_clip', (1.45, 1.9, (0.44, 0.6), (0.44, 0.63)), 'zoom'),
    (7.8, 9.95, 'still', 'cg/cg_celebration.png', (1.12, 1.02, (0.45, 0.45), (0.45, 0.48)), 'flash'),
    (9.95, 11.85, 'clip', 'late_clip', (1.45, 1.35, (0.8, 0.74), (0.83, 0.74)), 'slideup'),
    (11.85, 14.35, 'montage', None, None, 'wipe'),
    (14.35, 17.5, 'still', 'cg/cg_starry_vow.png', (1.18, 1.0, (0.5, 0.42), (0.5, 0.5)), 'fade'),
    (17.5, DURATION, 'endcard', None, None, 'fade'),
]

# 字幕（影片時間）：句尾的「、」「。」省略，句中的保留
CAPTIONS = [
    (0.6, 1.8, 'いらっしゃいませ！'),
    (1.9, 4.5, 'ルミアのポーション工房へようこそ！'),
    (4.75, 6.2, '薬草を育てて'),
    (6.3, 7.8, 'ぐつぐつ煮込んで……'),
    (8.0, 9.9, 'ポーション、完成です！'),
    (10.3, 11.85, 'あなたが留守の間も'),
    (11.95, 14.3, 'お店はちゃんと開けておきますね'),
    (14.7, 17.4, '目指せ、世界一のポーション屋さん！'),
]

URL = 'lumiaspotionshop.pages.dev'
QR_URL = 'https://lumiaspotionshop.pages.dev/'
TAGLINE = 'ブラウザで今すぐ遊べる！'
END_X = 640  # 結尾：標誌、標語、網址、QR code 排成一欄的中心


# ---------------------------------------------------------------- 小工具

def clamp01(x):
    return min(1.0, max(0.0, x))


def ease(x):
    x = clamp01(x)
    return x * x * (3 - 2 * x)


def ease_out(x):
    x = clamp01(x)
    return 1 - (1 - x) ** 3


def ease_out_back(x):
    x = clamp01(x)
    c = 1.4
    return 1 + (c + 1) * (x - 1) ** 3 + c * (x - 1) ** 2


def load(rel):
    return Image.open(ART / rel).convert('RGBA')


def cover(im, w=2304, h=1296):
    """裁成 16:9、縮放成 w×h（比畫面大，鏡頭推近時不會糊）"""
    r = im.width / im.height
    if r > 16 / 9:
        cw = int(im.height * 16 / 9)
        im = im.crop(((im.width - cw) // 2, 0, (im.width - cw) // 2 + cw, im.height))
    else:
        ch = int(im.width * 9 / 16)
        im = im.crop((0, (im.height - ch) // 2, im.width, (im.height - ch) // 2 + ch))
    return im.convert('RGB').resize((w, h), Image.LANCZOS)


def camera(src, p, cam, extra_zoom=1.0, shake=(0, 0)):
    """運鏡：從 src 取出目前鏡頭看到的範圍，縮放成 W×H"""
    z0, z1, c0, c1 = cam
    e = ease(p)
    k = (z0 + (z1 - z0) * e) * extra_zoom
    cx = c0[0] + (c1[0] - c0[0]) * e
    cy = c0[1] + (c1[1] - c0[1]) * e
    sw, sh = src.size
    vw, vh = sw / k, sh / k
    ox = min(max(cx * sw - vw / 2, 0), sw - vw) + shake[0] * vw / W
    oy = min(max(cy * sh - vh / 2, 0), sh - vh) + shake[1] * vh / H
    s = vw / W
    return src.transform((W, H), Image.AFFINE, (s, 0, ox, 0, s, oy), Image.BILINEAR)


def fit_h(im, h):
    return im.resize((max(1, round(im.width * h / im.height)), h), Image.LANCZOS)


def fit_w(im, w):
    return im.resize((w, max(1, round(im.height * w / im.width))), Image.LANCZOS)


def with_alpha(im, a):
    if a >= 1:
        return im
    im = im.copy()
    im.putalpha(im.getchannel('A').point(lambda v: int(v * a)))
    return im


def text_image(text, size, stroke=7, fill=(255, 250, 238), stroke_fill=(43, 29, 20)):
    font = ImageFont.truetype(FONT, size)
    d = ImageDraw.Draw(Image.new('RGBA', (1, 1)))
    l, t, r, b = d.textbbox((0, 0), text, font=font, stroke_width=stroke)
    im = Image.new('RGBA', (r - l + 24, b - t + 24), (0, 0, 0, 0))
    shadow = Image.new('RGBA', im.size, (0, 0, 0, 0))
    ImageDraw.Draw(shadow).text((12 - l + 3, 12 - t + 5), text, font=font, fill=(0, 0, 0, 150),
                                stroke_width=stroke, stroke_fill=(0, 0, 0, 150))
    im.alpha_composite(shadow.filter(ImageFilter.GaussianBlur(5)))
    ImageDraw.Draw(im).text((12 - l, 12 - t), text, font=font, fill=fill, stroke_width=stroke, stroke_fill=stroke_fill)
    return im


def qr_card(url, size=250):
    """QR code（深棕色畫在奶油色的圓角卡片上，和遊戲的配色一致）；需要 segno（pip install --user segno）"""
    import segno
    qr = segno.make(url, error='m')
    matrix = [list(row) for row in qr.matrix]
    n = len(matrix)
    quiet = 2
    cell = size // (n + quiet * 2)
    side = cell * (n + quiet * 2)
    code = Image.new('RGBA', (side, side), (255, 248, 232, 255))
    d = ImageDraw.Draw(code)
    for y, row in enumerate(matrix):
        for x, v in enumerate(row):
            if v:
                d.rectangle(((x + quiet) * cell, (y + quiet) * cell, (x + quiet + 1) * cell - 1, (y + quiet + 1) * cell - 1), fill=(43, 29, 20, 255))
    pad = 14
    card = Image.new('RGBA', (side + pad * 2 + 20, side + pad * 2 + 20), (0, 0, 0, 0))
    sh = Image.new('RGBA', card.size, (0, 0, 0, 0))
    ImageDraw.Draw(sh).rounded_rectangle((12, 16, card.width - 8, card.height - 4), 22, fill=(0, 0, 0, 150))
    card.alpha_composite(sh.filter(ImageFilter.GaussianBlur(8)))
    ImageDraw.Draw(card).rounded_rectangle((6, 6, card.width - 14, card.height - 14), 20, fill=(255, 248, 232, 255), outline=(217, 164, 65, 255), width=4)
    card.alpha_composite(code, (6 + pad, 6 + pad))
    return card


def soft_mask(draw_fn, scale=4):
    """先在小畫布上畫遮罩再放大（邊緣比較柔和）"""
    m = Image.new('L', (W // scale, H // scale), 0)
    draw_fn(ImageDraw.Draw(m), scale)
    return m.resize((W, H), Image.BILINEAR)


class Clip:
    """錄下來的連續畫面（promo/shots/<名稱>/0000.jpg…，frames.txt 是每格的時間）"""

    def __init__(self, name):
        self.dir = SHOTS / name
        self.times = [float(x) for x in (self.dir / 'frames.txt').read_text().split()]

    def at(self, t):
        t = t % max(0.1, self.times[-1])  # 不夠長就從頭再播
        k = max(0, min(len(self.times) - 1, next((i for i, x in enumerate(self.times) if x > t), len(self.times)) - 1))
        return _frame(str(self.dir / '{:04d}.jpg'.format(k)))


@lru_cache(maxsize=48)
def _frame(path):
    return Image.open(path).convert('RGB')


# ---------------------------------------------------------------- 影片

class Promo:
    def __init__(self):
        self.stills = {}
        self.clips = {}
        for _, _, kind, src, _, _ in SHOTS_PLAN:
            if kind == 'still':
                self.stills[src] = cover(load(src))
            elif kind == 'clip':
                self.clips[src] = Clip(src)
        self.logo_end = fit_w(load('logo/ui_logo_ja.png'), 860)
        self.qr = qr_card(QR_URL, 300)
        self.lumia_hello = fit_h(load('portraits/portrait_lumia_happy.png'), 980)
        self.lumia_wave = fit_h(load('portraits/portrait_lumia_shy.png'), 1000)
        self.chibi_idle = fit_h(load('lumia/lumia_chibi_idle.png'), 300)
        self.chibi_garden = fit_h(load('lumia/lumia_chibi_gardener_walk.png'), 330).transpose(Image.FLIP_LEFT_RIGHT)  # 原圖朝左 → 往右走
        self.chibi_walk = fit_h(load('lumia/lumia_chibi_walk.png'), 300)
        self.chibi_end = fit_h(load('lumia/lumia_chibi_idle.png'), 230)
        self.captions = [(a, b, text_image(t, 62)) for a, b, t in CAPTIONS]
        self.tagline = text_image(TAGLINE, 66)
        self.url = text_image(URL, 46, stroke=5, fill=(255, 226, 150))
        # 字幕底下的暗色漸層
        band = Image.new('L', (1, 300))
        band.putdata([int(150 * (y / 300) ** 1.6) for y in range(300)])
        self.band = Image.new('RGBA', (W, 300), (18, 12, 8, 255))
        self.band.putalpha(band.resize((W, 300)))
        # 結尾、拼貼的背景：主背景／遊戲畫面模糊、調暗
        end = cover(load('bg/bg_dollhouse_main.png'), W, H).filter(ImageFilter.GaussianBlur(10))
        self.end_bg = Image.blend(end, Image.new('RGB', (W, H), (24, 16, 12)), 0.5)
        late = Image.open(SHOTS / 'late_main.png').convert('RGB').filter(ImageFilter.GaussianBlur(14))
        self.montage_bg = Image.blend(late, Image.new('RGB', (W, H), (20, 14, 10)), 0.55)
        self.panels = [self.panel(SHOTS / ('late_book_{}.png'.format(n))) for n in ('greenhouse', 'cauldron', 'lumia')]
        # 「完成」的閃光星星（固定的亂數，每次輸出一樣）
        rng = random.Random(3)
        self.sparkles = [(rng.uniform(0.1, 0.9) * W, rng.uniform(0.08, 0.7) * H, rng.uniform(14, 34), rng.uniform(0, 1)) for _ in range(26)]

    def panel(self, path):
        """拼貼用的截圖：縮小、加上白色邊框與陰影"""
        im = Image.open(path).convert('RGB').resize((880, 495), Image.LANCZOS)
        card = Image.new('RGBA', (880 + 40, 495 + 40), (0, 0, 0, 0))
        sh = Image.new('RGBA', card.size, (0, 0, 0, 0))
        ImageDraw.Draw(sh).rounded_rectangle((14, 18, card.width - 10, card.height - 6), 18, fill=(0, 0, 0, 160))
        card.alpha_composite(sh.filter(ImageFilter.GaussianBlur(9)))
        ImageDraw.Draw(card).rounded_rectangle((8, 8, card.width - 12, card.height - 12), 16, fill=(255, 246, 225, 255))
        card.paste(im, (20, 20))
        return card

    # ---------- 各畫面（t = 影片時間）
    def shot(self, i, t):
        a, b, kind, src, cam, _ = SHOTS_PLAN[i]
        lo, hi = a - XFADE / 2, b + XFADE / 2
        p = (t - lo) / (hi - lo)
        if kind == 'endcard':
            return self.endcard(t - a)
        if kind == 'montage':
            return self.montage(t - a, b - a)
        if kind == 'clip':
            frame = camera(self.clips[src].at(max(0.0, t - lo)), p, cam)
        else:
            shake = (0, 0)
            if src.endswith('cg_celebration.png') and 0 <= t - a < 0.35:  # 「完成！」：畫面晃一下
                d = (1 - (t - a) / 0.35) * 14
                shake = (math.sin(t * 90) * d, math.cos(t * 70) * d)
            frame = camera(self.stills[src], p, cam, shake=shake)
        frame = frame.convert('RGBA')
        overlay = getattr(self, 'over_{}'.format(i), None)
        if overlay:
            overlay(frame, t - a, b - a)
        return frame

    def over_0(self, frame, tl, dur):
        """標題畫面：Q 版露米婭在右下角跳出來、輕輕彈跳"""
        q = ease_out_back((tl - 0.25) / 0.45)
        if q > 0:
            y = H - 330 - abs(math.sin(tl * 6)) * 18 + (1 - q) * 300
            frame.alpha_composite(self.chibi_idle, (W - 300, int(y)))

    def over_1(self, frame, tl, dur):
        """遊戲畫面：立繪從右邊滑進來"""
        q = ease_out((tl - 0.3) / 0.6)
        if q > 0:
            frame.alpha_composite(with_alpha(self.lumia_hello, q), (int(W - self.lumia_hello.width + 60 + (1 - q) * 380), H - self.lumia_hello.height + 70))

    def over_2(self, frame, tl, dur):
        """溫室：Q 版園丁露米婭從左走到右"""
        x = -260 + (W + 300) * (tl / dur) * 0.55
        y = H - 400 - abs(math.sin(tl * 9)) * 16
        frame.alpha_composite(self.chibi_garden, (int(x), int(y)))

    def over_4(self, frame, tl, dur):
        """「完成！」：一閃一閃的星星"""
        d = ImageDraw.Draw(frame)
        for x, y, r, ph in self.sparkles:
            a = clamp01(math.sin((tl * 3.2 + ph) * math.pi))
            if a <= 0.05 or tl < 0.1:
                continue
            rr = r * (0.6 + 0.4 * a)
            pts = []
            for k in range(8):
                ang = math.pi / 4 * k
                rad = rr if k % 2 == 0 else rr * 0.28
                pts.append((x + math.cos(ang) * rad, y + math.sin(ang) * rad))
            d.polygon(pts, fill=(255, 245, 200, int(230 * a)))

    def over_5(self, frame, tl, dur):
        """櫃台：Q 版露米婭從右走到左"""
        x = W - 120 - (W * 0.6) * (tl / dur)
        y = H - 420 - abs(math.sin(tl * 9)) * 16
        frame.alpha_composite(self.chibi_walk, (int(x), int(y)))

    def montage(self, tl, dur):
        """魔導書的三個分頁截圖依序滑進來（溫室 → 大釜 → 露米婭）"""
        frame = camera(self.montage_bg, tl / dur, (1.0, 1.05, (0.5, 0.5), (0.5, 0.5))).convert('RGBA')
        spots = [(70, 70, -3.0), (520, 300, 2.5), (970, 520, -2.0)]
        for k, (card, (x, y, rot)) in enumerate(zip(self.panels, spots)):
            q = ease_out((tl - k * 0.45) / 0.55)
            if q <= 0:
                continue
            c = card.rotate(rot * q, resample=Image.BICUBIC, expand=True)
            frame.alpha_composite(with_alpha(c, clamp01(q * 1.5)), (int(x + (1 - q) * 900), int(y + (1 - q) * 60)))
        return frame

    def endcard(self, tl):
        frame = self.end_bg.convert('RGBA')
        q = ease_out((tl + 0.1) / 0.6)
        frame.alpha_composite(with_alpha(self.lumia_wave, q), (int(W - self.lumia_wave.width + 10 + (1 - q) * 200), H - self.lumia_wave.height + 40))
        q = (tl - 0.05) / 0.5
        if q > 0:
            s = 0.75 + 0.25 * ease_out_back(q)
            logo = self.logo_end.resize((int(self.logo_end.width * s), int(self.logo_end.height * s)), Image.LANCZOS)
            frame.alpha_composite(with_alpha(logo, ease(q * 1.5)), (int(END_X - logo.width / 2), int(250 - logo.height / 2)))
        for im, start, y in ((self.tagline, 0.45, 470), (self.url, 0.65, 560)):
            q = ease((tl - start) / 0.4)
            if q > 0:
                frame.alpha_composite(with_alpha(im, q), (int(END_X - im.width / 2), int(y + (1 - q) * 20)))
        # QR code：最後彈出來
        q = (tl - 0.85) / 0.45
        if q > 0:
            s = 0.7 + 0.3 * ease_out_back(q)
            qr = self.qr.resize((int(self.qr.width * s), int(self.qr.height * s)), Image.LANCZOS) if s != 1 else self.qr
            frame.alpha_composite(with_alpha(qr, ease(q * 1.6)), (int(END_X - qr.width / 2), int(820 - qr.height / 2)))
        # Q 版露米婭在網址旁邊跳一跳
        q = ease_out_back((tl - 0.8) / 0.4)
        if q > 0:
            hop = abs(math.sin((tl - 0.8) * 5)) * 26
            frame.alpha_composite(self.chibi_end, (130, int(H - 260 - hop + (1 - q) * 260)))
        return frame

    # ---------- 轉場：A = 前一個畫面、B = 下一個畫面、p = 0～1
    def transition(self, kind, A, B, p):
        e = ease(p)
        if kind == 'iris':  # 從中間開一個圓
            r = e * math.hypot(W, H) / 2
            mask = soft_mask(lambda d, s: d.ellipse(((W / 2 - r) / s, (H / 2 - r) / s, (W / 2 + r) / s, (H / 2 + r) / s), fill=255))
            return Image.composite(B, A, mask)
        if kind == 'whip':  # 快速橫移：舊的往左甩出去、新的從右邊進來（帶一點動態模糊）
            x = int(e * W)
            out = Image.new('RGBA', (W, H))
            out.paste(A, (-x, 0))
            out.paste(B, (W - x, 0))
            if 0.15 < p < 0.85:
                out = out.filter(ImageFilter.BoxBlur(int(10 * math.sin(p * math.pi))))
            return out
        if kind == 'zoom':  # 穿越：舊的放大淡出、新的從放大縮回來
            a = A.resize((int(W * (1 + 0.6 * e)), int(H * (1 + 0.6 * e))), Image.BILINEAR)
            a = a.crop(((a.width - W) // 2, (a.height - H) // 2, (a.width - W) // 2 + W, (a.height - H) // 2 + H))
            s = 1.25 - 0.25 * e
            b = B.resize((int(W * s), int(H * s)), Image.BILINEAR)
            b = b.crop(((b.width - W) // 2, (b.height - H) // 2, (b.width - W) // 2 + W, (b.height - H) // 2 + H))
            return Image.blend(a, b, e)
        if kind == 'flash':  # 白色閃光
            white = Image.new('RGBA', (W, H), (255, 252, 240, 255))
            return Image.blend(A, white, ease(p * 2)) if p < 0.5 else Image.blend(white, B, ease(p * 2 - 1))
        if kind == 'slideup':  # 新的從下面滑上來
            y = int((1 - ease_out(p)) * H)
            out = A.copy()
            out.paste(B, (0, y))
            return out
        if kind == 'wipe':  # 斜向劃過（帶一條亮邊）
            x = -0.3 * W + e * 1.6 * W
            def poly(d, s):
                d.polygon([(0, 0), ((x + 0.15 * W) / s, 0), ((x - 0.15 * W) / s, H / s), (0, H / s)], fill=255)
            out = Image.composite(B, A, soft_mask(poly))
            edge = Image.new('RGBA', (W, H), (0, 0, 0, 0))
            ImageDraw.Draw(edge).polygon([(x + 0.15 * W, 0), (x + 0.15 * W + 24, 0), (x - 0.15 * W + 24, H), (x - 0.15 * W, H)], fill=(255, 236, 190, 170))
            out.alpha_composite(edge.filter(ImageFilter.GaussianBlur(6)))
            return out
        return Image.blend(A, B, e)  # fade

    # ---------- 一格
    def frame(self, t):
        live = [i for i, (a, b, *_rest) in enumerate(SHOTS_PLAN) if a - XFADE / 2 <= t < b + XFADE / 2]
        if len(live) == 1 or t < XFADE / 2:
            img = self.shot(live[0], t)
        else:
            i, j = live[0], live[-1]
            cut = SHOTS_PLAN[j][0]
            p = (t - (cut - XFADE / 2)) / XFADE
            img = self.transition(SHOTS_PLAN[j][5], self.shot(i, t), self.shot(j, t), p)
        img = img.convert('RGBA')
        if t < SHOTS_PLAN[-1][0] + 0.1:
            img.alpha_composite(self.band, (0, H - 300))
            # 字幕只在自己的時間內淡入淡出（相鄰兩句不會疊在一起）
            for a, b, cap in self.captions:
                if a <= t <= b:
                    al = min(1.0, (t - a) / 0.12, (b - t) / 0.12)
                    img.alpha_composite(with_alpha(cap, al), (int(W / 2 - cap.width / 2), H - 70 - cap.height))
        img = img.convert('RGB')
        if t < 0.35:  # 開頭從黑畫面淡入
            img = Image.blend(Image.new('RGB', (W, H)), img, t / 0.35)
        return img


def processed_voice(tmp):
    """套用露米婭在遊戲裡的音效設定（不裁靜音、不改語速，時間點才對得上）"""
    sys.path.insert(0, str(ROOT / 'tools' / 'voice'))
    import core
    import fx
    setting = core.load_profiles()['lumia'].get('fx')
    out = Path(tmp) / 'voice.wav'
    wav = VOICE.read_bytes()
    if setting:
        wav = fx.render(wav, {**setting, 'trim': False, 'tempo': 1.0})
    out.write_bytes(wav)
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--preview', nargs='*', type=float)
    ap.add_argument('--out', default=str(OUT_DIR / 'lumia_promo.mp4'))
    args = ap.parse_args()
    OUT_DIR.mkdir(exist_ok=True)
    promo = Promo()
    if args.preview:
        for t in args.preview:
            promo.frame(t).save(OUT_DIR / 'preview_{:05.2f}.png'.format(t))
        print('preview:', ', '.join('preview_{:05.2f}.png'.format(t) for t in args.preview))
        return
    with tempfile.TemporaryDirectory() as tmp:
        voice = processed_voice(tmp)
        # 配樂墊在底下：語音出現時自動壓低（sidechain），最後淡出；整體響度 -15 LUFS（網路影片常見的大小）
        graph = (
            '[1:a]atrim=0:{d},asetpts=PTS-STARTPTS,aresample=44100,aformat=channel_layouts=stereo,volume=0.55,'
            'afade=t=in:st=0:d=0.5,afade=t=out:st={fo}:d=1.8[bgm];'
            '[2:a]aresample=44100,aformat=channel_layouts=stereo,adelay={ms}|{ms},apad,atrim=0:{d},asplit=2[v1][v2];'
            '[bgm][v1]sidechaincompress=threshold=0.03:ratio=6:attack=20:release=400[duck];'
            '[duck][v2]amix=inputs=2:duration=first,volume=2,loudnorm=I=-15:TP=-1.5:LRA=11,aresample=44100[a]'
        ).format(d=DURATION, fo=DURATION - 1.8, ms=int(VOICE_DELAY * 1000))
        cmd = ['ffmpeg', '-hide_banner', '-loglevel', 'error', '-y',
               '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-s', '{}x{}'.format(W, H), '-r', str(FPS), '-i', '-',
               '-i', str(BGM), '-i', str(voice),
               '-filter_complex', graph, '-map', '0:v', '-map', '[a]',
               '-c:v', 'libx264', '-preset', 'slow', '-crf', '18', '-pix_fmt', 'yuv420p',
               '-c:a', 'aac', '-b:a', '192k', '-movflags', '+faststart', '-t', str(DURATION), args.out]
        p = subprocess.Popen(cmd, stdin=subprocess.PIPE)
        n = int(DURATION * FPS)
        for k in range(n):
            p.stdin.write(promo.frame(k / FPS).tobytes())
            if k % 60 == 0:
                print('  {:5.1f}s'.format(k / FPS), flush=True)
        p.stdin.close()
        if p.wait() != 0:
            sys.exit('ffmpeg 失敗')
    print('完成：', args.out)


if __name__ == '__main__':
    main()

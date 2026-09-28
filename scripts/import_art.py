#!/usr/bin/env python3
"""把美術原圖匯入遊戲：縮到遊戲需要的大小並轉成 WebP。

用法（在 WSL 專案根目錄）：
    python3 scripts/import_art.py [來源資料夾]

來源預設為 IdlePotionShop_ArtAssets/，會遞迴找所有 .png/.jpg/.webp，
依檔名（= 資源 ID）輸出到 src/assets/art/<分類>/<資源ID>.webp。
- 透明背景的圖會自動裁掉四周的空白。
- src/assets/art/ 視為產出資料夾：來源已經刪除的圖，對應的輸出也會一併刪除。
原圖不會被修改，之後有新的素材包可以重複執行。
"""
import json
import os
import sys
from PIL import Image, ImageDraw

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = sys.argv[1] if len(sys.argv) > 1 else os.path.join(ROOT, 'IdlePotionShop_ArtAssets')
DST = os.path.join(ROOT, 'src', 'assets', 'art')

# (ID 前綴, 輸出分類, 最長邊上限 px)。上限約為遊戲內顯示尺寸的 2 倍。
RULES = [
    ('bg_', 'bg', 1920),
    ('cg_', 'cg', 1920),
    ('portrait_', 'portraits', 1400),
    ('lumia_', 'lumia', 420),
    ('npc_', 'npc', 420),
    ('cauldron_', 'cauldrons', 360),
    ('pot_', 'plants', 280),
    ('plant_', 'plants', 320),
    ('item_', 'icons', 160),
    ('potion_', 'icons', 160),
    ('icon_', 'icons', 160),
    ('upg_', 'upgrades', 256),
    # 禮物（也是休息室擺設，顯示約 80–100px；原本的家具 furn_ 已經改名併進來）
    ('gift_', 'gifts', 256),
    ('evt_', 'events', 420),
    ('fx_', 'fx', 256),
    # 標題畫面的標誌很大（寬約 900px，高解析度螢幕會再放大），給大一點的上限
    ('ui_logo_', 'ui', 1600),
    ('ui_title_logo', 'ui', 1600),
    ('ui_', 'ui', 1024),
    ('app_icon', 'ui', 512),
]
# 只當參考用、不進遊戲的圖
SKIP = {'char_lumia_ref'}


def rule_for(asset_id):
    for prefix, folder, limit in RULES:
        if asset_id.startswith(prefix):
            return folder, limit
    return None


# 個別原圖的校正（原圖不動，每次匯入時套用；素材資料夾重新同步也不會跑掉）：
# match = 輸出成和這張一樣的畫布大小；scale／dx／dy = 原圖縮放後放在畫布上的位置（對齊同服裝其他表情的頭與身體，
# 由 importer 外的自動對位算出）；clear_white = 從這些點（原圖座標）把相連的白色背景殘塊清成透明
ADJUST = {
    # 原圖的畫布比其他表情大、人物比較小，互動視窗裡位置會偏
    'portrait_lumia_gardener_panic': {
        'match': 'portrait_lumia_gardener_happy', 'scale': 0.81, 'dx': -72, 'dy': 12,
    },
}


def adjust(im, asset_id, src_dir):
    fix = ADJUST.get(asset_id)
    if not fix:
        return im
    im = im.convert('RGBA')
    for x, y in fix.get('clear_white', []):
        ImageDraw.floodfill(im, (x, y), (255, 255, 255, 0), thresh=40)
    ref = Image.open(os.path.join(src_dir, fix['match'] + '.png'))
    scaled = im.resize((round(im.width * fix['scale']), round(im.height * fix['scale'])), Image.LANCZOS)
    out = Image.new('RGBA', ref.size, (0, 0, 0, 0))
    out.paste(scaled, (fix['dx'], fix['dy']), scaled)
    return out


TRIM_PAD = 6


def trim(im):
    """裁掉透明邊，保留一點邊距"""
    if im.mode != 'RGBA':
        return im
    bbox = im.getchannel('A').getbbox()
    if not bbox:
        return im
    l, t, r, b = bbox
    return im.crop((max(0, l - TRIM_PAD), max(0, t - TRIM_PAD),
                    min(im.width, r + TRIM_PAD), min(im.height, b + TRIM_PAD)))


# 游標的顯示大小（CSS px；另外輸出 2 倍大給高解析度螢幕）。魔法杖是細長的斜線，同樣 32px 看起來比箭頭小很多，放大到 48
CURSOR_SIZE = {'cursor_pointer': 48, 'cursor_press': 48}
CURSOR_BASE = 32
CURSOR_DIR = os.path.join(DST, 'cursors')


def import_cursor(im, asset_id, hotspots, produced):
    """
    滑鼠游標：輸出 1 倍與 2 倍大（高解析度螢幕）的 PNG（瀏覽器對 PNG 游標支援最好），並算出點擊位置。
    箭頭、魔法杖類：尖端是圖的最左上角，貼齊左上擺放，點擊位置取最靠左上的不透明像素；
    手（cursor_grab*）：置中，點擊位置是中心。
    """
    im = im.convert('RGBA')
    alpha = im.getchannel('A')
    bbox = alpha.point(lambda v: 255 if v > 40 else 0).getbbox()
    im = im.crop(bbox)
    hand = asset_id.startswith('cursor_grab')
    side = max(im.size)
    base = CURSOR_SIZE.get(asset_id, CURSOR_BASE)
    hotspots[asset_id] = {'size': base}
    os.makedirs(CURSOR_DIR, exist_ok=True)
    for scale in (1, 2):
        size = base * scale
        pad = scale
        k = (size - pad * 2) / side
        small = im.resize((max(1, round(im.width * k)), max(1, round(im.height * k))), Image.LANCZOS)
        canvas = Image.new('RGBA', (size, size), (0, 0, 0, 0))
        at = ((size - small.width) // 2, (size - small.height) // 2) if hand else (pad, pad)
        canvas.alpha_composite(small, at)
        if hand:
            hx, hy = size // 2, size // 2
        else:
            a = canvas.getchannel('A').load()
            hx, hy = min(((x, y) for y in range(size) for x in range(size) if a[x, y] > 128), key=lambda p: (p[0] + p[1], p[1]))
        suffix = '' if scale == 1 else f'@{scale}x'
        out = os.path.join(CURSOR_DIR, f'{asset_id}{suffix}.png')
        canvas.save(out, 'PNG', optimize=True)
        produced.add(os.path.abspath(out))
        hotspots[asset_id][f'{scale}x'] = [hx, hy]
    print(f'  cursors/{asset_id}.png  {base}／{base * 2}px  點擊位置 {hotspots[asset_id]["1x"]}')


def main():
    count, before, after = 0, 0, 0
    produced = set()
    hotspots = {}
    for dirpath, _, files in os.walk(SRC):
        for name in sorted(files):
            asset_id, ext = os.path.splitext(name)
            if ext.lower() not in ('.png', '.jpg', '.jpeg', '.webp') or asset_id in SKIP:
                continue
            if asset_id.startswith('cursor_'):
                import_cursor(Image.open(os.path.join(dirpath, name)), asset_id, hotspots, produced)
                continue
            rule = rule_for(asset_id)
            if not rule:
                print(f'  ? 略過（未知的資源 ID 前綴）: {name}')
                continue
            folder, limit = rule
            src = os.path.join(dirpath, name)
            im = Image.open(src)
            im = adjust(im, asset_id, dirpath)
            im = im.convert('RGBA' if im.mode in ('RGBA', 'LA', 'P') else 'RGB')
            # 立繪不裁邊：同一套服裝的表情差分要維持一樣的構圖，互動視窗裡的位置才不會跳動
            if not asset_id.startswith('portrait_'):
                im = trim(im)
            im.thumbnail((limit, limit), Image.LANCZOS)
            out_dir = os.path.join(DST, folder)
            os.makedirs(out_dir, exist_ok=True)
            out = os.path.join(out_dir, asset_id + '.webp')
            im.save(out, 'WEBP', quality=88, method=6)
            produced.add(os.path.abspath(out))
            count += 1
            before += os.path.getsize(src)
            after += os.path.getsize(out)
            print(f'  {folder}/{asset_id}.webp  {im.width}x{im.height}')
    print(f'匯入 {count} 張：{before / 1e6:.1f} MB → {after / 1e6:.1f} MB')
    if hotspots:
        path = os.path.join(CURSOR_DIR, 'hotspots.json')
        with open(path, 'w', encoding='utf-8', newline='\n') as f:
            json.dump(dict(sorted(hotspots.items())), f, indent=2)
            f.write('\n')
        produced.add(os.path.abspath(path))

    # 來源已刪除的圖，把舊的輸出也移除
    for dirpath, _, files in os.walk(DST):
        for name in files:
            path = os.path.abspath(os.path.join(dirpath, name))
            generated = name.endswith('.webp') or os.path.abspath(dirpath) == os.path.abspath(CURSOR_DIR)
            if generated and path not in produced:
                os.remove(path)
                print(f'  - 移除（來源已不存在）: {os.path.relpath(path, DST)}')


if __name__ == '__main__':
    main()

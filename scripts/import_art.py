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
import os
import sys
from PIL import Image

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
    ('furn_', 'furniture', 360),
    ('fx_', 'fx', 256),
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


def main():
    count, before, after = 0, 0, 0
    produced = set()
    for dirpath, _, files in os.walk(SRC):
        for name in sorted(files):
            asset_id, ext = os.path.splitext(name)
            if ext.lower() not in ('.png', '.jpg', '.jpeg', '.webp') or asset_id in SKIP:
                continue
            rule = rule_for(asset_id)
            if not rule:
                print(f'  ? 略過（未知的資源 ID 前綴）: {name}')
                continue
            folder, limit = rule
            src = os.path.join(dirpath, name)
            im = Image.open(src)
            im = trim(im.convert('RGBA' if im.mode in ('RGBA', 'LA', 'P') else 'RGB'))
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

    # 來源已刪除的圖，把舊的輸出也移除
    for dirpath, _, files in os.walk(DST):
        for name in files:
            path = os.path.abspath(os.path.join(dirpath, name))
            if name.endswith('.webp') and path not in produced:
                os.remove(path)
                print(f'  - 移除（來源已不存在）: {os.path.relpath(path, DST)}')


if __name__ == '__main__':
    main()

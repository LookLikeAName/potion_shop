# M3 新增美術需求（看板娘與開心度）

補充 [`ArtAssetPrompts.md`](ArtAssetPrompts.md)。共用區塊（[STYLE]、[ISOLATE]、[LUMIA]、[CHIBI]）請參考主文件第 0 章。
生成後一樣放進 `IdlePotionShop_ArtAssets/`，再執行 `python3 scripts/import_art.py`。

---

## 1. 主文件裡已經有、M3 開始會用到的素材

以下的 Prompt 在主文件裡，M3 功能做好之後就會實際出現在遊戲中，建議優先生成：

| 資源 ID | 主文件章節 | 用在哪裡 | 目前 |
|---|---|---|---|
| `lumia_chibi_sleep` | 2.1 | 在休息室坐墊上睡覺 | 暫時用站姿 + zZ |
| `lumia_chibi_tired_walk` | 2.1 | 體力低於 25 時走路 | 暫時用一般走路圖 |
| `portrait_lumia_base`、`_happy`、`_headpat`、`_poke`、`_panic`、`_shy` | 2.3 | 點她打開的互動視窗 | 暫時用 Q 版圖 |
| `portrait_lumia_maid`、`_pajama`、`_robe` | 2.3 | 穿服裝時的互動視窗 | 暫時用 Q 版圖 |
| `lumia_chibi_maid_idle/walk/back`、`pajama_*`、`robe_*` | 2.2 | 穿服裝時的場景角色 | 暫時用預設服裝 |
| `furn_slime_doll`、`furn_gramophone`、`furn_tea_set` | 8 | 休息室家具 | 佔位色塊 |
| `cg_celebration`、`cg_starry_vow` | 11 | 劇情事件 | 佔位文字 |

> **`lumia_chibi_sleep` 的方向說明：** 她會躺在二樓的紫色大坐墊上，請畫成「側躺捲成一團」，**橫向構圖（比例 3:2）**，頭朝左。
> **服裝差分**請沿用現在的 `lumia_chibi_idle`、`walk`、`back`、`drag` 的姿勢，只換衣服（上傳對應的原圖用圖片編輯），方向要一致（朝左）。

---

## 2. 新增：服裝版的「被拎起來」（★）

拖曳露米婭時使用。上傳 `lumia_chibi_drag.png` 用圖片編輯：

```
Same character, same pose, same framing, same art style and background. Change only the outfit to: {服裝描述}
```

| 資源 ID | {服裝描述}（同主文件 2.2） |
|---|---|
| `lumia_chibi_maid_drag` | an elegant classic long black maid dress with a white frilled apron, white headdress instead of the witch hat, small teal ribbon at the collar |
| `lumia_chibi_pajama_drag` | a fluffy navy-blue onesie pajama covered in tiny yellow stars and moons, with a soft nightcap with a pompom instead of the witch hat |
| `lumia_chibi_robe_drag` | a long flowing deep-purple alchemist master robe with gold embroidered runes and a high collar, a grand pointed purple witch hat with a gold band, a small monocle |

---

## 3. 新增：特權天賦圖示（★★）

開心度兌換清單中的圖示。**比例 1:1**，遊戲內約 48px。

**模板：**
```
Japanese anime style, kawaii and heartwarming, 2D fantasy game item icon, soft cel shading, clean dark-brown outline, bold readable silhouette, vibrant colors, storybook quality. {ITEM}. single isolated subject, centered, entire subject fully in frame with generous margin, plain solid pure white background, no ground shadow, no text, no watermark.
```

| 資源 ID | 天賦 | {ITEM} |
|---|---|---|
| `icon_cheer` | 少女的聲援（售價 +20%） | a pair of small cute cheering pom-poms in pink and gold with sparkles and a tiny heart, cheerful and energetic |
| `icon_attunement` | 魔力同調（冷凝管雙倍機率） | two glowing magic crystals, one teal and one violet, connected by a swirling ribbon of light, resonating together |
| `icon_green_thumb` | 奇蹟綠手指（解鎖浮空盆栽） | a small glowing green magical sprout floating above an open palm-shaped leaf, with tiny sparkles and a faint golden ring beneath it |
| `icon_telepathy` | 心電感應（離線上限 72 小時） | an ancient grimoire and a small witch hat connected by a glowing pink heart-shaped thread of light, dreamy and warm |

---

## 4. 選配：狂熱時刻圖示（★）

目前頂部按鈕用文字「✨ 狂熱時刻」。如果想要圖示：

| 資源 ID | {ITEM}（用第 3 章模板） |
|---|---|
| `icon_fever` | a burst of golden sparkles and shooting stars swirling around a glowing potion bottle, radiant and festive |

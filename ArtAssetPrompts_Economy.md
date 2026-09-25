# 新增美術需求：金幣出口（無限升級、送禮物）

補充 [`ArtAssetPrompts.md`](ArtAssetPrompts.md)。生成後放進 `IdlePotionShop_ArtAssets/`，再執行 `python3 scripts/import_art.py`。
這些都只用在魔導書介面的清單圖示（遊戲內約 48px），**比例 1:1**，優先度 ★★。

**共用模板：**
```
Japanese anime style, kawaii and heartwarming, 2D fantasy game item icon, soft cel shading, clean dark-brown outline, bold readable silhouette, vibrant colors, storybook quality. {ITEM}. single isolated subject, centered, entire subject fully in frame with generous margin, plain solid pure white background, no ground shadow, no text, no watermark.
```

## 1. 無限升級

| 資源 ID | 升級 | {ITEM} |
|---|---|---|
| `upg_fertilizer` | 魔法肥料（收成量 +10%/級） | a small burlap sack of glowing green magical fertilizer with sparkling leaf-shaped granules spilling out, a tiny sprout sticking out of the top |
| `upg_warm_circle` | 保溫魔法陣（被動熬煮 +15%/級） | a round glowing orange-gold magic circle with flame runes, seen from a slight angle, gentle warm heat shimmer rising from it |
| `upg_poster` | 宣傳海報（顧客需求上限 +1/級） | a cute hand-drawn parchment advertisement poster pinned with a tack, showing a big smiling potion bottle and sparkles, corners slightly curled |

## 2. 送給露米婭的禮物

| 資源 ID | 禮物 | {ITEM} |
|---|---|---|
| `gift_snack` | 手工點心 | a small plate of homemade heart-shaped cookies and a strawberry macaron, wrapped with a little pink ribbon |
| `gift_bouquet` | 魔法花束 | a small bouquet of glowing pastel flowers with tiny floating light motes, tied with a teal ribbon |
| `gift_hairpin` | 星光髮飾 | a delicate golden hairpin shaped like a crescent moon and a star with a small amethyst gem, softly sparkling |

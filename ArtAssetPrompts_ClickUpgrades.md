# 新增美術需求：點擊強化（無限升級）與配方精煉

> 浮空魔法盆栽的圖示直接沿用現有的 `pot_hidden_slot`，不需要新圖。

補充 [`ArtAssetPrompts.md`](ArtAssetPrompts.md)。生成後放進 `IdlePotionShop_ArtAssets/public/assets/upgrades/`，再執行 `python3 scripts/import_art.py`。
這些都只用在魔導書介面的清單圖示（遊戲內約 48px），**比例 1:1**，優先度 ★★。

**共用模板**（和 [`ArtAssetPrompts_Economy.md`](ArtAssetPrompts_Economy.md) 相同）：
```
Japanese anime style, kawaii and heartwarming, 2D fantasy game item icon, soft cel shading, clean dark-brown outline, bold readable silhouette, vibrant colors, storybook quality. {ITEM}. single isolated subject, centered, entire subject fully in frame with generous margin, plain solid pure white background, no ground shadow, no text, no watermark.
```

| 資源 ID | 升級 | {ITEM} |
|---|---|---|
| `upg_garden_gloves` | 魔力園藝手套（溫室：親手點擊額外推進自動生長量） | a pair of cute soft green gardening gloves with little leaf patterns and a glowing four-leaf clover charm on the cuff, tiny green magic sparkles swirling from the fingertips |
| `upg_abacus_squirrel` | 算盤松鼠（櫃台：自動結帳） | a tiny fluffy chestnut-brown squirrel shopkeeper wearing a little green apron, hugging a small wooden abacus with colorful beads, a gold coin tucked in its big fluffy tail, cheerful sparkling eyes |
| `upg_refine` | 配方精煉（大釜卡片裡；每級原料 +50%、售價 +60%） | an elegant glass alchemy distillation flask with a swirling glowing pink-and-gold liquid, a small golden star-shaped stopper, tiny five-pointed star sparkles floating around it |
| `upg_rune_stirrer` | 符文攪拌棒（大釜：親手攪拌額外推進熬煮量） | a long wooden alchemy stirring rod engraved with glowing purple runes along its length, a small crystal set in the handle, a few potion droplets and sparkles flying off the tip |

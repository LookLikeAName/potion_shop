# 突發事件的美術素材（M4）

這裡是 **17 個突發事件**要用的訪客、道具與圖示，共 **19 張**（目前遊戲裡是程式畫的佔位色塊）。

* **用途：** 每張圖同時是**場景裡要點的東西**（會加上白框光暈，顯示尺寸見表格）和**事件簿的縮圖**（約 120px）。所以輪廓要清楚、一眼看得出是什麼，小尺寸也認得出來。
* **角色（訪客）：** 全身、站姿，**朝左**（和顧客一樣），腳底平穩；比例和現有的顧客 NPC 一致（Q 版，頭身約 2.5–3）。
* **去背：** 純白背景生成後去背；白色或很淺的物件（朝露、泡泡、夢泡泡、流星）改用純綠色背景 `#00FF00`（表格有標註）。
* **比例：** 依表格；原圖邊長 1024 以上即可，匯入時會自動裁邊、縮圖。
* **放置位置：** `IdlePotionShop_ArtAssets/public/assets/` 下，檔名 = 資源 ID，之後用 `scripts/import_art.py` 匯入（分類 `events`）。

**共用模板**（把 `{OBJECT}` 換成表格裡的描述）：
```
Japanese anime style, kawaii and heartwarming, 2D fantasy game art, cozy and whimsical, soft cel shading, clean dark-brown lineart, bold readable silhouette, storybook quality, game asset. {OBJECT}. single isolated subject, centered, entire subject fully in frame with generous margin, plain solid pure white background, no ground shadow, no text, no watermark.
```

**角色用模板**（訪客）：
```
Japanese anime style, kawaii and heartwarming, 2D fantasy game art, chibi character about 2.5 to 3 heads tall, soft cel shading, clean dark-brown lineart, bold readable silhouette, game sprite. {OBJECT}. full body, standing, three-quarter view facing left, feet flat on the ground, single isolated character, entire body fully in frame with generous margin, plain solid pure white background, no ground shadow, no text, no watermark.
```

---

## A. 訪客（角色模板，★★★）

| 資源 ID | 事件 | 顯示尺寸 | 比例 | {OBJECT} |
|---|---|---|---|---|
| `evt_goblin` | 迷路的尋寶地精 | 90×100 | 1:1 | a small mischievous green treasure-hunting goblin with big pointy ears and a tiny lantern on his head, carrying an oversized lumpy cloth sack bursting with seeds, herbs and shiny trinkets, running pose with one leg lifted, cheeky grin |
| `evt_apprentice` | 精靈學徒來實習 | 90×120 | 3:4 | a tiny nervous but determined elf apprentice in a green work apron and oversized guild cap, hugging a stirring paddle taller than himself, sweat drop, sparkling eager eyes |
| `evt_hero` | 土豪勇者的掃貨 | 157×190 | 4:5 | a flashy rich hero adventurer in shiny gold-trimmed armor and a red cape, one hand tossing a bulging coin purse, gold coins flying, big confident laugh, a little crown-shaped hair ornament |
| `evt_merchant` | 流浪行商 | 157×190 | 4:5 | a friendly wandering merchant with a huge overstuffed backpack full of scrolls, jars and trinkets, wide-brimmed traveler hat, round glasses, kind smile, a tiny creature peeking out of the backpack |
| `evt_princess` | 微服出巡的公主（事件簿用） | 145×183 | 4:5 | a cute young princess in disguise wearing a plain hooded brown cloak, the hood slipping to reveal a small tiara and golden hair, finger on lips in a "shh" gesture, playful wink |
| `evt_fortune` | 占卜婆婆 | 145×183 | 4:5 | a small kindly old fortune-teller granny in a deep purple starry shawl, holding a crooked walking staff topped with a star, a few tarot cards floating around her, gentle mysterious smile |

## B. 小動物與道具（共用模板，★★★）

| 資源 ID | 事件 | 顯示尺寸 | 比例 | {OBJECT} |
|---|---|---|---|---|
| `evt_raincloud` | 雨雲寶寶 | 100×68 | 3:2 | a tiny cute baby rain cloud with a round happy face and rosy cheeks, a few small raindrops falling from it, soft blue-gray fluffy puffs |
| `evt_butterfly` | 螢光蝴蝶 | 52×44 | 1:1 | a small glowing firefly butterfly with translucent mint and cyan wings, sparkling scales drifting off the wings, wings open, top-down view（綠底 `#00FF00`） |
| `evt_slime` | 史萊姆搬家 | 80×64 | 5:4 | a round bouncy green jelly slime with big shiny eyes and a happy open mouth, carrying a tiny bundle of herbs on its head, glossy highlights |
| `evt_letter` | 遠方的來信 | 96×80 | 6:5 | a cute brown owl flying with wings spread, holding a sealed envelope with a red wax seal in its beak, side view facing left |
| `evt_dew` | 溫室的星塵朝露 | 44×52 | 5:6 | a single glowing dewdrop with tiny golden star dust sparkling inside, teardrop shape, soft pale blue shine（綠底 `#00FF00`） |
| `evt_bubble` | 彩虹大泡泡 | 120×120 | 1:1 | a big iridescent soap bubble with rainbow swirls on its surface and a tiny reflection of a cozy shop inside, soft white highlights（綠底 `#00FF00`；遊戲裡會再上彩虹色調） |
| `evt_spark` | 火蜥蜴打噴嚏 | 40×40 | 1:1 | a small bright magical fire spark shaped like a cute teardrop flame with a tiny star in the center, orange and golden glow |
| `evt_meteor` | 窗外的流星雨 | 64×64 | 1:1 | a cute little shooting star, five-pointed star head with a short glowing pastel tail trailing to the upper right, soft golden light（綠底 `#00FF00`） |

## C. 事件簿圖示（共用模板，簡單圖示風格，★★）

這些事件在場景裡是程式畫的（火候錶、收購箱的光、夢泡泡、牌背），圖只用在事件簿與橫幅。

| 資源 ID | 事件 | 比例 | {OBJECT} |
|---|---|---|---|
| `evt_heat` | 完美火候 | 1:1 | a round brass alchemy temperature gauge with a golden needle pointing into a glowing gold zone, small flame underneath, simple icon style |
| `evt_guild` | 商會緊急收購 | 1:1 | a wooden guild buyback crate with a glowing golden exclamation mark above it and a small sealed notice pinned to the front, simple icon style |
| `evt_dream` | 露米婭的夢話 | 1:1 | a soft floating dream bubble with a tiny sleeping crescent moon and little stars inside, pastel lavender and blue, simple icon style（綠底 `#00FF00`） |
| `evt_card_back` | 占卜婆婆的牌背 | 9:13 | the back of a tarot card, deep purple with an ornate gold border and a golden star and crescent moon in the center, front view, flat |
| `icon_event_book` | 事件簿（按鈕圖示） | 1:1 | a cute thick storybook with a blue leather cover, a golden star clasp and a few colorful bookmark ribbons sticking out, simple icon style |

## 生成進度檢查表

- [ ] A. 訪客（6）：地精、精靈學徒、土豪勇者、流浪行商、公主、占卜婆婆
- [ ] B. 小動物與道具（8）：雨雲寶寶、螢光蝴蝶、史萊姆、送信貓頭鷹、星塵朝露、彩虹泡泡、火花、流星
- [ ] C. 事件簿圖示（5）：火候錶、商會收購、夢泡泡、牌背、事件簿

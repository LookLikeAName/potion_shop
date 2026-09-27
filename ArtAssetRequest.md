# 美術素材製作需求（完整版）

> **2026-09-28：這份清單的 45 張已經全部完成並匯入遊戲。**

這份文件列出《看板娘的放置藥水舖》目前還需要製作的 **45 張**美術素材。每一張都附上可以直接使用的完整英文 Prompt。

---

## 1. 遊戲與畫風

**遊戲簡介：** 2D 網頁放置經營遊戲。玩家經營一間奇幻世界的魔法藥水舖，店面是「兩層樓娃娃屋剖面」的視角：一樓由左到右是溫室（種植物的盆栽）、鍊金工作區（熬藥水的大釜）、店面（櫃台與顧客），二樓是看板娘的休息室與倉庫閣樓。看板娘「露米婭」是一位見習魔女，在店裡走動工作。店裡偶爾會發生突發事件（小動物、訪客跑進來），玩家點擊它們可以拿到獎勵。

**畫風：** 日式動漫風格、可愛溫馨路線。圓潤的造型、柔和的配色、大而有神的眼睛，氣氛像溫馨的日系奇幻動畫或手遊。暖色的燭光色調，搭配藍綠色與紫色的魔法點綴。**避免**寫實、美式卡通、陰暗厚重的畫風。

如果生成結果偏寫實或偏美式，可以在 Prompt 最後補上：`not realistic, not western cartoon, not dark or gritty`

---

## 2. 輸出規格（所有素材共通）

* **檔名：** 使用每張素材標示的「資源 ID」，例如 `evt_raincloud.png`。
* **格式：** PNG。原圖邊長至少 **1024px**（遊戲會自動縮小、裁掉四周空白）。
* **背景：**
  * 標示「白底」的：純白背景（`#FFFFFF`），之後會去背，所以**不要有地面陰影、不要有邊框或文字**。
  * 標示「綠底」的：純綠色背景（`#00FF00`），用在白色或很淺的物件，避免去背時把物件吃掉。
  * 標示「完整插圖」的（CG）：有完整背景的插畫，不需要去背。
* **構圖：** 單一物件或角色、置中、完整入鏡，四周留適當空白。
* **方向：** 角色與會移動的訪客一律**面向左邊**（三分之四側面朝左），和遊戲裡其他角色一致。
* **可讀性：** 很多素材在遊戲裡顯示得很小（表格有標「遊戲內顯示尺寸」），請讓**輪廓簡單清楚、顏色對比夠**，縮小後也認得出是什麼。
* **建議：** 每張生成 3–4 張候選，挑風格最一致的。露米婭相關的圖，如果工具支援參考圖，請附上露米婭的角色參考圖，外觀才會一致。

---

## 3. 角色設定：露米婭（Lumia）

20 歲的成年女性見習魔女、鍊金師，也是藥水舖的看板娘。個性開朗、有點冒失。

**外觀（平常的服裝）：**
凌亂的及肩銅橘色頭髮，頭頂有一撮翹起的呆毛；大而閃亮的紫水晶色眼睛；臉上有淡淡的雀斑；戴一頂有點歪的深藍綠色小魔女帽，帽帶上插著紅色的葉子小枝；奶油色泡泡袖襯衫、棕色皮革馬甲背心（黃銅釦子）、深藍綠色短披風（金色星星釦）、酒紅色及膝裙、腰帶上掛著三個小玻璃瓶、棕色綁帶靴。

**新服裝「花園精靈圍裙裝」（本次要畫的服裝）：**
粉嫩的鼠尾草綠園丁洋裝（泡泡袖）、奶油色亞麻圍裙（大口袋裡塞滿種子包）、**用粉色與白色小花編成的花冠取代魔女帽**、一個小小的嫩芽髮夾、棕色綁帶靴、腰帶上掛著一個小澆水壺吊飾。

---

## 4. 素材清單（共 45 張）

| 優先 | 分類 | 張數 |
|---|---|---|
| ★★★ | A. 事件的訪客 | 4 |
| ★★★ | B. 事件的小動物與道具 | 8 |
| ★★ | C. 露米婭 Q 版（花園精靈圍裙裝） | 6 |
| ★★ | D. 圖示 | 4 |
| ★ | E. 露米婭立繪（花園精靈圍裙裝） | 6 |
| ★ | F. 事件插圖（CG） | 17 |

---

## A. 事件的訪客（★★★，4 張）

Q 版角色（約 2.5–3 頭身），全身、站姿、**面向左**、雙腳踩穩。會站在店裡被玩家點擊，也會當成圖鑑的縮圖。**白底**。

### `evt_apprentice` — 精靈學徒
* 用途：工會派來實習的精靈學徒，玩家把他拖到大釜上幫忙攪拌。
* 比例 3:4｜遊戲內顯示約 90×120

```
Japanese anime style, kawaii and heartwarming, 2D fantasy game art, cozy and whimsical, soft cel shading with gentle gradients, clean dark-brown lineart, bold readable silhouette, storybook quality, game sprite. Chibi character about 2.5 heads tall. A tiny nervous but determined elf apprentice with pointy ears, wearing a green work apron and an oversized guild cap, hugging a wooden stirring paddle taller than himself, a small sweat drop, sparkling eager eyes. Full body, standing, three-quarter view facing left, feet flat on the ground. Single isolated character, centered, entire body fully in frame with generous margin, plain solid pure white background, no ground shadow, no text, no watermark, no border.
```

### `evt_merchant` — 流浪行商
* 用途：站在櫃台前，讓玩家從三樣商品裡挑一樣。
* 比例 4:5｜遊戲內顯示約 157×190

```
Japanese anime style, kawaii and heartwarming, 2D fantasy game art, cozy and whimsical, soft cel shading with gentle gradients, clean dark-brown lineart, bold readable silhouette, storybook quality, game sprite. Chibi character about 2.5 heads tall. A friendly wandering merchant carrying a huge overstuffed backpack full of scrolls, glass jars and trinkets, wearing a wide-brimmed traveler hat and round glasses, kind warm smile, a tiny cute creature peeking out of the backpack. Full body, standing, three-quarter view facing left, feet flat on the ground. Single isolated character, centered, entire body fully in frame with generous margin, plain solid pure white background, no ground shadow, no text, no watermark, no border.
```

### `evt_fortune` — 占卜婆婆
* 用途：站在櫃台前，讓玩家從三張蓋著的牌裡翻一張。
* 比例 4:5｜遊戲內顯示約 145×183

```
Japanese anime style, kawaii and heartwarming, 2D fantasy game art, cozy and whimsical, soft cel shading with gentle gradients, clean dark-brown lineart, bold readable silhouette, storybook quality, game sprite. Chibi character about 2.5 heads tall. A small kindly old fortune-teller granny wearing a deep purple shawl covered in tiny stars, holding a crooked wooden walking staff topped with a golden star, a few tarot cards floating around her, gentle mysterious smile. Full body, standing, three-quarter view facing left, feet flat on the ground. Single isolated character, centered, entire body fully in frame with generous margin, plain solid pure white background, no ground shadow, no text, no watermark, no border.
```

### `evt_princess` — 微服出巡的公主
* 用途：只在圖鑑顯示（事件中她扮成一般客人排隊）。要表現「偷偷出巡、被發現了」的感覺。
* 比例 4:5｜遊戲內顯示約 145×183

```
Japanese anime style, kawaii and heartwarming, 2D fantasy game art, cozy and whimsical, soft cel shading with gentle gradients, clean dark-brown lineart, bold readable silhouette, storybook quality, game sprite. Chibi character about 2.5 heads tall. A cute young princess in disguise wearing a plain hooded brown traveler cloak, the hood slipping back to reveal a small golden tiara and long golden hair, one finger on her lips in a "shh" gesture, playful wink. Full body, standing, three-quarter view facing left, feet flat on the ground. Single isolated character, centered, entire body fully in frame with generous margin, plain solid pure white background, no ground shadow, no text, no watermark, no border.
```

---

## B. 事件的小動物與道具（★★★，8 張）

會在店裡飄、跑、掉落，讓玩家點擊。顯示很小，**輪廓要非常清楚**。

### `evt_raincloud` — 雨雲寶寶（白底）
* 用途：飄進溫室的小雨雲，玩家把它拖到盆栽上下雨。
* 比例 3:2｜遊戲內顯示約 100×68

```
Japanese anime style, kawaii and heartwarming, 2D fantasy game art, cozy and whimsical, soft cel shading with gentle gradients, clean dark-brown lineart, bold readable silhouette, storybook quality, game asset. A tiny cute baby rain cloud with a round happy face and rosy cheeks, soft blue-gray fluffy puffs, a few small raindrops falling from underneath. Front view. Single isolated subject, centered, entire subject fully in frame with generous margin, plain solid pure white background, no ground shadow, no text, no watermark, no border.
```

### `evt_butterfly` — 螢光蝴蝶（綠底）
* 用途：在溫室裡亂飛的發光蝴蝶，點了會停到盆栽上。
* 比例 1:1｜遊戲內顯示約 52×44

```
Japanese anime style, kawaii and heartwarming, 2D fantasy game art, cozy and whimsical, soft cel shading with gentle gradients, clean dark-brown lineart, bold readable silhouette, storybook quality, game asset. A small glowing firefly butterfly with translucent mint and cyan wings, sparkling scales drifting off the wings, wings fully open, top-down view. Single isolated subject, centered, entire subject fully in frame with generous margin, plain solid chroma green (#00FF00) background, no ground shadow, no text, no watermark, no border.
```

### `evt_slime` — 史萊姆（白底）
* 用途：在店裡蹦來蹦去的野生史萊姆，頭上頂著撿來的藥草當見面禮。
* 比例 5:4｜遊戲內顯示約 80×64

```
Japanese anime style, kawaii and heartwarming, 2D fantasy game art, cozy and whimsical, soft cel shading with gentle gradients, clean dark-brown lineart, bold readable silhouette, storybook quality, game asset. A round bouncy green jelly slime with big shiny eyes and a happy open mouth, glossy highlights, carrying a tiny bundle of herbs on top of its head. Three-quarter view facing left. Single isolated subject, centered, entire subject fully in frame with generous margin, plain solid pure white background, no ground shadow, no text, no watermark, no border.
```

### `evt_letter` — 送信的貓頭鷹（白底）
* 用途：叼著一封信從窗外飛進休息室。
* 比例 6:5｜遊戲內顯示約 96×80

```
Japanese anime style, kawaii and heartwarming, 2D fantasy game art, cozy and whimsical, soft cel shading with gentle gradients, clean dark-brown lineart, bold readable silhouette, storybook quality, game asset. A cute round brown owl flying with its wings spread wide, holding a sealed envelope with a red wax seal in its beak. Side view facing left. Single isolated subject, centered, entire subject fully in frame with generous margin, plain solid pure white background, no ground shadow, no text, no watermark, no border.
```

### `evt_dew` — 星塵朝露（綠底）
* 用途：盆栽上方凝結的發光露珠，玩家點下來收集。
* 比例 5:6｜遊戲內顯示約 44×52

```
Japanese anime style, kawaii and heartwarming, 2D fantasy game art, cozy and whimsical, soft cel shading with gentle gradients, clean dark-brown lineart, bold readable silhouette, storybook quality, game asset. A single glowing dewdrop in a teardrop shape, soft pale blue shine, tiny golden star dust sparkling inside it, a small white highlight. Front view. Single isolated subject, centered, entire subject fully in frame with generous margin, plain solid chroma green (#00FF00) background, no ground shadow, no text, no watermark, no border.
```

### `evt_bubble` — 彩虹大泡泡（綠底）
* 用途：從大釜冒出來、慢慢往上飄的大泡泡，點破它。遊戲裡會再加上彩虹色的變化，所以本體偏淡、偏白一點比較好。
* 比例 1:1｜遊戲內顯示約 120×120

```
Japanese anime style, kawaii and heartwarming, 2D fantasy game art, cozy and whimsical, soft cel shading with gentle gradients, clean dark-brown lineart, bold readable silhouette, storybook quality, game asset. A big round iridescent soap bubble with soft rainbow swirls on its surface, bright white highlights, and a tiny reflection of a cozy shop window inside. Front view. Single isolated subject, centered, entire subject fully in frame with generous margin, plain solid chroma green (#00FF00) background, no ground shadow, no text, no watermark, no border.
```

### `evt_spark` — 火蜥蜴噴出的火花（白底）
* 用途：大釜底下的火蜥蜴打噴嚏噴出的火花，會飄落下來讓玩家接。
* 比例 1:1｜遊戲內顯示約 40×40

```
Japanese anime style, kawaii and heartwarming, 2D fantasy game art, cozy and whimsical, soft cel shading with gentle gradients, clean dark-brown lineart, bold readable silhouette, storybook quality, game asset. A small bright magical fire spark shaped like a cute teardrop flame, orange and golden glow, a tiny white star in its center. Front view. Single isolated subject, centered, entire subject fully in frame with generous margin, plain solid pure white background, no ground shadow, no text, no watermark, no border.
```

### `evt_meteor` — 流星（綠底）
* 用途：流星雨事件中劃過夜空的流星，由右上往左下飛。
* 比例 1:1｜遊戲內顯示約 64×64

```
Japanese anime style, kawaii and heartwarming, 2D fantasy game art, cozy and whimsical, soft cel shading with gentle gradients, clean dark-brown lineart, bold readable silhouette, storybook quality, game asset. A cute little shooting star: a plump five-pointed star head with a short glowing pastel tail trailing toward the upper right, soft golden light. Single isolated subject, centered, entire subject fully in frame with generous margin, plain solid chroma green (#00FF00) background, no ground shadow, no text, no watermark, no border.
```

---

## C. 露米婭 Q 版・花園精靈圍裙裝（★★，6 張）

露米婭在場景裡走動、工作時用的 Q 版圖，每個動作一張（遊戲裡靠彈跳、擠壓、翻面做動畫，不需要逐格）。**Q 版 2.5 頭身、面向左（背影那張除外）、白底**。遊戲內顯示高度約 180px。

> 這 6 張要和她平常服裝的 Q 版圖**姿勢、比例、方向一致，只換衣服**。如果工具支援圖片編輯，建議上傳平常服裝的同一個動作圖，用下面的 Prompt 只換服裝。

### `lumia_chibi_gardener_idle` — 待機（比例 1:1）

```
Japanese anime style, kawaii and heartwarming, 2D fantasy game art, soft cel shading, clean dark-brown lineart, warm palette. Chibi super-deformed style, 2.5 heads tall, rounded simple shapes, thick clean outline, readable as a small game sprite, full body visible. Lumia, a 20-year-old adult woman apprentice witch alchemist, messy shoulder-length copper-orange hair with one springy ahoge strand, cute Japanese anime-style face with big sparkling amethyst-purple eyes, light freckles, wearing a pastel sage-green gardener dress with puff sleeves and a cream linen apron with big pockets full of seed packets, a wreath crown of small pink and white flowers instead of a witch hat, a tiny sprout hairpin, brown lace-up boots, a small watering can charm hanging from her belt. Standing relaxed with a cheerful smile, holding an oversized wooden ladle over her shoulder. Three-quarter view facing left. Single isolated subject, centered, entire subject fully in frame with generous margin, plain solid pure white background, no ground shadow, no text, no watermark.
```

### `lumia_chibi_gardener_walk` — 走路（比例 1:1）

```
Japanese anime style, kawaii and heartwarming, 2D fantasy game art, soft cel shading, clean dark-brown lineart, warm palette. Chibi super-deformed style, 2.5 heads tall, rounded simple shapes, thick clean outline, readable as a small game sprite, full body visible. Lumia, a 20-year-old adult woman apprentice witch alchemist, messy shoulder-length copper-orange hair with one springy ahoge strand, cute Japanese anime-style face with big sparkling amethyst-purple eyes, light freckles, wearing a pastel sage-green gardener dress with puff sleeves and a cream linen apron with big pockets full of seed packets, a wreath crown of small pink and white flowers instead of a witch hat, a tiny sprout hairpin, brown lace-up boots, a small watering can charm hanging from her belt. Walking mid-stride, arms swinging, happy expression. Three-quarter view facing left. Single isolated subject, centered, entire subject fully in frame with generous margin, plain solid pure white background, no ground shadow, no text, no watermark.
```

### `lumia_chibi_gardener_back` — 背影工作（比例 1:1）
* 用途：她站在盆栽或大釜前面工作時用，看到的是背影。

```
Japanese anime style, kawaii and heartwarming, 2D fantasy game art, soft cel shading, clean dark-brown lineart, warm palette. Chibi super-deformed style, 2.5 heads tall, rounded simple shapes, thick clean outline, readable as a small game sprite, full body visible. Lumia, a young woman apprentice witch with messy shoulder-length copper-orange hair and one springy ahoge strand, wearing a pastel sage-green gardener dress with puff sleeves, the bow of a cream linen apron tied at her back, a wreath crown of small pink and white flowers on her head, brown lace-up boots, a small watering can charm hanging from her belt. Seen from behind (back view), standing and working at something in front of her, holding an oversized wooden ladle. Single isolated subject, centered, entire subject fully in frame with generous margin, plain solid pure white background, no ground shadow, no text, no watermark.
```

### `lumia_chibi_gardener_drag` — 被拎起來（比例 1:1）
* 用途：玩家用滑鼠把她抓起來換工作區時用，畫面上方是被拎住的地方。

```
Japanese anime style, kawaii and heartwarming, 2D fantasy game art, soft cel shading, clean dark-brown lineart, warm palette. Chibi super-deformed style, 2.5 heads tall, rounded simple shapes, thick clean outline, readable as a small game sprite, full body visible. Lumia, a 20-year-old adult woman apprentice witch alchemist, messy shoulder-length copper-orange hair with one springy ahoge strand, cute Japanese anime-style face with big sparkling amethyst-purple eyes, light freckles, wearing a pastel sage-green gardener dress with puff sleeves and a cream linen apron with big pockets full of seed packets, a wreath crown of small pink and white flowers instead of a witch hat, a tiny sprout hairpin, brown lace-up boots, a small watering can charm hanging from her belt. Being lifted up by the back of her collar, dangling in the air, feet kicking, resigned deadpan "not again" expression. Front view, slightly facing left. Single isolated subject, centered, entire subject fully in frame with generous margin, plain solid pure white background, no ground shadow, no text, no watermark.
```

### `lumia_chibi_gardener_sleep` — 睡覺（比例 3:2，橫向）
* 用途：她在休息室的大坐墊上睡覺。請畫成側躺捲成一團，**頭朝左**，橫長構圖。

```
Japanese anime style, kawaii and heartwarming, 2D fantasy game art, soft cel shading, clean dark-brown lineart, warm palette. Chibi super-deformed style, 2.5 heads tall, rounded simple shapes, thick clean outline, readable as a small game sprite, full body visible. Lumia, a 20-year-old adult woman apprentice witch alchemist, messy shoulder-length copper-orange hair with one springy ahoge strand, cute Japanese anime-style face, light freckles, wearing a pastel sage-green gardener dress with puff sleeves and a cream linen apron, a wreath crown of small pink and white flowers slipping off her head, brown lace-up boots. Curled up into a small round ball sleeping peacefully, lying on her side with her head to the left, eyes closed, tiny content smile. Wide horizontal composition. Single isolated subject, centered, entire subject fully in frame with generous margin, plain solid pure white background, no ground shadow, no text, no watermark.
```

### `lumia_chibi_gardener_tired_walk` — 疲勞走路（比例 1:1）

```
Japanese anime style, kawaii and heartwarming, 2D fantasy game art, soft cel shading, clean dark-brown lineart, warm palette. Chibi super-deformed style, 2.5 heads tall, rounded simple shapes, thick clean outline, readable as a small game sprite, full body visible. Lumia, a 20-year-old adult woman apprentice witch alchemist, messy shoulder-length copper-orange hair with one springy ahoge strand, cute Japanese anime-style face with amethyst-purple eyes, light freckles, wearing a pastel sage-green gardener dress with puff sleeves and a cream linen apron with big pockets full of seed packets, a slightly crooked wreath crown of small pink and white flowers instead of a witch hat, a tiny sprout hairpin, brown lace-up boots, a small watering can charm hanging from her belt. Dragging her feet while walking, slouched shoulders, half-closed sleepy eyes, an oversized wooden ladle dragging on the floor behind her. Three-quarter view facing left. Single isolated subject, centered, entire subject fully in frame with generous margin, plain solid pure white background, no ground shadow, no text, no watermark.
```

---

## D. 圖示（★★，4 張）

只在介面清單與圖鑑裡當小圖示（約 48–120px），**越簡單越好**、圖示風格。比例 1:1。

### `evt_heat` — 完美火候（白底）

```
Japanese anime style, kawaii and heartwarming, 2D fantasy game item icon, soft cel shading, clean dark-brown outline, bold readable silhouette, vibrant colors, storybook quality. A round brass alchemy temperature gauge with a golden needle pointing into a glowing gold zone, a small cute flame underneath, simple icon style. Single isolated subject, centered, entire subject fully in frame with generous margin, plain solid pure white background, no ground shadow, no text, no watermark, no border.
```

### `evt_guild` — 商會緊急收購（白底）

```
Japanese anime style, kawaii and heartwarming, 2D fantasy game item icon, soft cel shading, clean dark-brown outline, bold readable silhouette, vibrant colors, storybook quality. A sturdy wooden merchant guild crate with iron bands, a glowing golden exclamation mark floating above it, a small sealed notice with a red wax seal pinned to the front, simple icon style. Single isolated subject, centered, entire subject fully in frame with generous margin, plain solid pure white background, no ground shadow, no text, no watermark, no border.
```

### `evt_dream` — 夢話泡泡（綠底）

```
Japanese anime style, kawaii and heartwarming, 2D fantasy game item icon, soft cel shading, clean dark-brown outline, bold readable silhouette, soft pastel colors, storybook quality. A soft floating dream bubble with a tiny sleeping crescent moon and little stars inside, pastel lavender and baby blue, simple icon style. Single isolated subject, centered, entire subject fully in frame with generous margin, plain solid chroma green (#00FF00) background, no ground shadow, no text, no watermark, no border.
```

### `icon_event_book` — 事件簿（白底）
* 用途：打開「事件簿」（收集遇過的事件的圖鑑）的按鈕圖示。

```
Japanese anime style, kawaii and heartwarming, 2D fantasy game item icon, soft cel shading, clean dark-brown outline, bold readable silhouette, vibrant colors, storybook quality. A cute thick storybook with a blue leather cover, a golden star-shaped clasp and a few colorful bookmark ribbons sticking out of the pages, simple icon style. Single isolated subject, centered, entire subject fully in frame with generous margin, plain solid pure white background, no ground shadow, no text, no watermark, no border.
```

---

## E. 露米婭立繪・花園精靈圍裙裝（★，6 張）

點露米婭時跳出的互動視窗用的**半身立繪**（腰部以上），遊戲內顯示高度約 700–900px。比例 **2:3（直向）**、**白底**。

* 姿勢固定為：正面、身體左右對稱、雙手自然垂在兩側**不遮住身體**、看向鏡頭、頭髮一束一束分明（之後要拆件做成 Live2D）。
* 玩家點她的頭和臉頰互動，所以頭部要在畫面上方約 40% 的位置。
* 先畫第一張基礎立繪，其餘 5 張是**同一張圖只換表情**。如果工具支援圖片編輯，建議上傳第一張，再用各表情的 Prompt 修改。

### `portrait_lumia_gardener` — 基礎立繪（溫柔的笑容）

```
Japanese anime style, kawaii and heartwarming, 2D fantasy game art, high quality anime illustration, soft cel shading with gentle gradients, clean dark-brown lineart, warm lighting. Half-body portrait from the waist up, front-facing, symmetrical relaxed pose, arms relaxed at her sides not overlapping the body, looking at the viewer, gentle happy smile, mouth closed, eyes open, hair strands clearly separated. Lumia, a 20-year-old adult woman apprentice witch alchemist, messy shoulder-length copper-orange hair with one springy ahoge strand, cute Japanese anime-style face with big sparkling amethyst-purple eyes, light freckles, wearing a pastel sage-green gardener dress with puff sleeves and a cream linen apron with big pockets full of seed packets, a wreath crown of small pink and white flowers instead of a witch hat, a tiny sprout hairpin, a small watering can charm hanging from her belt. Single isolated subject, centered, plain solid pure white background, no text, no watermark.
```

### 表情差分（5 張）

如果用圖片編輯：上傳 `portrait_lumia_gardener`，使用
`Same character, same pose, same outfit, same framing and background. Only change the facial expression and small details: {表情}`

如果不能用圖片編輯：用上面基礎立繪的完整 Prompt，把 `gentle happy smile, mouth closed, eyes open` 換成下面的表情描述。

| 資源 ID | 什麼時候出現 | {表情} |
|---|---|---|
| `portrait_lumia_gardener_happy` | 打開視窗、一般對話 | big bright open-mouth smile, sparkling eyes |
| `portrait_lumia_gardener_headpat` | 被摸頭 | eyes closed blissfully like a content cat, shoulders slightly raised and neck tucked in, soft blush, small happy smile |
| `portrait_lumia_gardener_poke` | 被戳臉頰 | puffed-up cheeks pretending to be angry, one eye peeking, holding back a smile, light blush |
| `portrait_lumia_gardener_panic` | 被狂戳 | panicked dot-shaped eyes, flailing hands raised in the air, sweat drops, mouth open in a flustered yell, leaning back |
| `portrait_lumia_gardener_shy` | 互動次數用完 | shy embarrassed smile, blushing, waving one hand in front of her as if saying "that's enough" |

---

## F. 事件插圖 CG（★，17 張）

玩家完成一個突發事件後，在「事件簿」裡點開那個事件會看到的插圖。**完整插圖（有背景，不用去背）**，比例 **16:9 橫向**（例如 1920×1080）。場景都在溫馨的兩層樓奇幻藥水舖裡。

**圖中出現露米婭時，外觀請依第 3 節**（下面的 Prompt 已經寫進她的外觀）。

### `cg_evt_goblin` — 迷路的尋寶地精

```
Japanese anime style, kawaii and heartwarming, 2D fantasy game illustration, event CG, cozy and whimsical, soft cel shading, clean dark-brown lineart, warm lighting, storybook quality. A little green goblin with big pointy ears carrying a huge sack spilling seeds and herbs, running between flower pots in a glass-roofed greenhouse, while Lumia chases him holding a watering can. Lumia is a young woman apprentice witch with messy shoulder-length copper-orange hair, big amethyst-purple eyes, light freckles, a small crooked dark-teal witch hat with a red leafy sprig, cream puff-sleeve blouse, brown corset vest and a short dark-teal cape. Inside a cozy fantasy potion shop, wide 16:9 composition, detailed background, no text, no watermark.
```

### `cg_evt_dew` — 溫室的星塵朝露

```
Japanese anime style, kawaii and heartwarming, 2D fantasy game illustration, event CG, cozy and whimsical, soft cel shading, clean dark-brown lineart, warm lighting, storybook quality. Early morning in a glass-roofed greenhouse full of potted magical plants, glowing star-dust dewdrops sparkling on the leaves, soft golden sunrise light, Lumia carefully collecting a glowing dewdrop into a small glass vial. Lumia is a young woman apprentice witch with messy shoulder-length copper-orange hair, big amethyst-purple eyes, light freckles, a small crooked dark-teal witch hat with a red leafy sprig, cream puff-sleeve blouse, brown corset vest and a short dark-teal cape. Inside a cozy fantasy potion shop, wide 16:9 composition, detailed background, no text, no watermark.
```

### `cg_evt_raincloud` — 雨雲寶寶

```
Japanese anime style, kawaii and heartwarming, 2D fantasy game illustration, event CG, cozy and whimsical, soft cel shading, clean dark-brown lineart, warm lighting, storybook quality. A tiny smiling baby rain cloud with rosy cheeks happily raining over a row of flower pots in a greenhouse, a small rainbow in the mist, Lumia laughing with both hands raised in the drizzle. Lumia is a young woman apprentice witch with messy shoulder-length copper-orange hair, big amethyst-purple eyes, light freckles, a small crooked dark-teal witch hat with a red leafy sprig, cream puff-sleeve blouse, brown corset vest and a short dark-teal cape. Inside a cozy fantasy potion shop, wide 16:9 composition, detailed background, no text, no watermark.
```

### `cg_evt_butterfly` — 螢光蝴蝶

```
Japanese anime style, kawaii and heartwarming, 2D fantasy game illustration, event CG, cozy and whimsical, soft cel shading, clean dark-brown lineart, warm lighting, storybook quality. Glowing mint and cyan firefly butterflies filling a greenhouse at dusk, one butterfly landing on the tip of Lumia's nose, she is cross-eyed and delighted. Lumia is a young woman apprentice witch with messy shoulder-length copper-orange hair, big amethyst-purple eyes, light freckles, a small crooked dark-teal witch hat with a red leafy sprig, cream puff-sleeve blouse, brown corset vest and a short dark-teal cape. Inside a cozy fantasy potion shop, wide 16:9 composition, detailed background, no text, no watermark.
```

### `cg_evt_sneeze` — 火蜥蜴打噴嚏

```
Japanese anime style, kawaii and heartwarming, 2D fantasy game illustration, event CG, cozy and whimsical, soft cel shading, clean dark-brown lineart, warm lighting, storybook quality. In a stone alchemy workshop, a small chubby orange fire salamander lying under a bubbling cauldron lets out a big sneeze, cute golden sparks flying everywhere, Lumia startled and holding a big wooden ladle. Lumia is a young woman apprentice witch with messy shoulder-length copper-orange hair, big amethyst-purple eyes, light freckles, a small crooked dark-teal witch hat with a red leafy sprig, cream puff-sleeve blouse, brown corset vest and a short dark-teal cape. Inside a cozy fantasy potion shop, wide 16:9 composition, detailed background, no text, no watermark.
```

### `cg_evt_bubble` — 彩虹大泡泡

```
Japanese anime style, kawaii and heartwarming, 2D fantasy game illustration, event CG, cozy and whimsical, soft cel shading, clean dark-brown lineart, warm lighting, storybook quality. A huge iridescent rainbow bubble rising from a bubbling cauldron in a stone alchemy workshop, the whole shop reflected on its surface, Lumia standing on tiptoes reaching up to pop it with one finger. Lumia is a young woman apprentice witch with messy shoulder-length copper-orange hair, big amethyst-purple eyes, light freckles, a small crooked dark-teal witch hat with a red leafy sprig, cream puff-sleeve blouse, brown corset vest and a short dark-teal cape. Inside a cozy fantasy potion shop, wide 16:9 composition, detailed background, no text, no watermark.
```

### `cg_evt_perfect_heat` — 完美火候

```
Japanese anime style, kawaii and heartwarming, 2D fantasy game illustration, event CG, cozy and whimsical, soft cel shading, clean dark-brown lineart, warm lighting, storybook quality. Close-up of a glowing brass temperature gauge floating above a cauldron, its needle resting in a golden zone, the potion inside shimmering, Lumia leaning in with a focused, determined face. Lumia is a young woman apprentice witch with messy shoulder-length copper-orange hair, big amethyst-purple eyes, light freckles, a small crooked dark-teal witch hat with a red leafy sprig, cream puff-sleeve blouse, brown corset vest and a short dark-teal cape. Inside a cozy fantasy potion shop, wide 16:9 composition, detailed background, no text, no watermark.
```

### `cg_evt_apprentice` — 精靈學徒來實習

```
Japanese anime style, kawaii and heartwarming, 2D fantasy game illustration, event CG, cozy and whimsical, soft cel shading, clean dark-brown lineart, warm lighting, storybook quality. A tiny nervous elf apprentice in a green apron and an oversized guild cap stirring a big cauldron with a paddle taller than himself, Lumia beside him cheering him on with both fists raised. Lumia is a young woman apprentice witch with messy shoulder-length copper-orange hair, big amethyst-purple eyes, light freckles, a small crooked dark-teal witch hat with a red leafy sprig, cream puff-sleeve blouse, brown corset vest and a short dark-teal cape. Inside a cozy fantasy potion shop, wide 16:9 composition, detailed background, no text, no watermark.
```

### `cg_evt_hero` — 土豪勇者的掃貨

```
Japanese anime style, kawaii and heartwarming, 2D fantasy game illustration, event CG, cozy and whimsical, soft cel shading, clean dark-brown lineart, warm lighting, storybook quality. A flashy blond hero in shiny golden armor and a red cape at the wooden shop counter, cheerfully tossing bags of gold coins, crates of potions stacked high around him, Lumia behind the counter wide-eyed and overwhelmed. Lumia is a young woman apprentice witch with messy shoulder-length copper-orange hair, big amethyst-purple eyes, light freckles, a small crooked dark-teal witch hat with a red leafy sprig, cream puff-sleeve blouse, brown corset vest and a short dark-teal cape. Inside a cozy fantasy potion shop, wide 16:9 composition, detailed background, no text, no watermark.
```

### `cg_evt_merchant` — 流浪行商

```
Japanese anime style, kawaii and heartwarming, 2D fantasy game illustration, event CG, cozy and whimsical, soft cel shading, clean dark-brown lineart, warm lighting, storybook quality. A friendly wandering merchant with a wide-brimmed hat and round glasses opening his huge backpack of curious goods on the shop counter, a tiny creature peeking out of the backpack, Lumia leaning in with great curiosity. Lumia is a young woman apprentice witch with messy shoulder-length copper-orange hair, big amethyst-purple eyes, light freckles, a small crooked dark-teal witch hat with a red leafy sprig, cream puff-sleeve blouse, brown corset vest and a short dark-teal cape. Inside a cozy fantasy potion shop, wide 16:9 composition, detailed background, no text, no watermark.
```

### `cg_evt_princess` — 微服出巡的公主

```
Japanese anime style, kawaii and heartwarming, 2D fantasy game illustration, event CG, cozy and whimsical, soft cel shading, clean dark-brown lineart, warm lighting, storybook quality. A young princess in a plain brown hooded cloak standing at the shop counter, her hood slipping back to reveal a golden tiara and long golden hair, one finger on her lips with a playful wink, Lumia behind the counter shocked and blushing. Lumia is a young woman apprentice witch with messy shoulder-length copper-orange hair, big amethyst-purple eyes, light freckles, a small crooked dark-teal witch hat with a red leafy sprig, cream puff-sleeve blouse, brown corset vest and a short dark-teal cape. Inside a cozy fantasy potion shop, wide 16:9 composition, detailed background, no text, no watermark.
```

### `cg_evt_guild_rush` — 商會緊急收購

```
Japanese anime style, kawaii and heartwarming, 2D fantasy game illustration, event CG, cozy and whimsical, soft cel shading, clean dark-brown lineart, warm lighting, storybook quality. A guild courier in a messenger uniform handing Lumia an urgent sealed notice at the shop door, wooden buyback crates glowing in the storage loft upstairs, Lumia hurriedly packing potion bottles into a crate. Lumia is a young woman apprentice witch with messy shoulder-length copper-orange hair, big amethyst-purple eyes, light freckles, a small crooked dark-teal witch hat with a red leafy sprig, cream puff-sleeve blouse, brown corset vest and a short dark-teal cape. Inside a cozy fantasy potion shop, wide 16:9 composition, detailed background, no text, no watermark.
```

### `cg_evt_dream` — 露米婭的夢話

```
Japanese anime style, kawaii and heartwarming, 2D fantasy game illustration, event CG, cozy and whimsical, soft cel shading, clean dark-brown lineart, warm lighting, storybook quality. In a cozy attic rest room with a round window, Lumia asleep curled up on a big purple floor cushion, her witch hat slipping off, floating dream bubbles above her showing a busy happy potion shop and a gentle hand patting her head. Lumia is a young woman apprentice witch with messy shoulder-length copper-orange hair, light freckles, a small dark-teal witch hat with a red leafy sprig, cream puff-sleeve blouse, brown corset vest and a short dark-teal cape. Inside a cozy fantasy potion shop, wide 16:9 composition, detailed background, no text, no watermark.
```

### `cg_evt_letter` — 遠方的來信

```
Japanese anime style, kawaii and heartwarming, 2D fantasy game illustration, event CG, cozy and whimsical, soft cel shading, clean dark-brown lineart, warm lighting, storybook quality. At night, a round brown owl delivering a sealed letter with a red wax seal through a round attic window, Lumia receiving it gently with both hands, warm lamp light inside and a starry sky outside. Lumia is a young woman apprentice witch with messy shoulder-length copper-orange hair, big amethyst-purple eyes, light freckles, a small crooked dark-teal witch hat with a red leafy sprig, cream puff-sleeve blouse, brown corset vest and a short dark-teal cape. Inside a cozy fantasy potion shop, wide 16:9 composition, detailed background, no text, no watermark.
```

### `cg_evt_fortune` — 占卜婆婆

```
Japanese anime style, kawaii and heartwarming, 2D fantasy game illustration, event CG, cozy and whimsical, soft cel shading, clean dark-brown lineart, warm lighting, storybook quality. A kindly old fortune-teller granny in a starry purple shawl laying three face-down tarot cards on the wooden shop counter, Lumia nervously reaching out to choose one, a soft mystical glow over the cards. Lumia is a young woman apprentice witch with messy shoulder-length copper-orange hair, big amethyst-purple eyes, light freckles, a small crooked dark-teal witch hat with a red leafy sprig, cream puff-sleeve blouse, brown corset vest and a short dark-teal cape. Inside a cozy fantasy potion shop, wide 16:9 composition, detailed background, no text, no watermark.
```

### `cg_evt_meteor` — 窗外的流星雨

```
Japanese anime style, kawaii and heartwarming, 2D fantasy game illustration, event CG, cozy and whimsical, soft cel shading, clean dark-brown lineart, warm lighting, storybook quality. Lumia at a big round attic window watching a meteor shower across a deep blue starry night sky, hands clasped together making a wish, eyes closed, a softly glowing ancient spellbook floating beside her. Lumia is a young woman apprentice witch with messy shoulder-length copper-orange hair, light freckles, a small crooked dark-teal witch hat with a red leafy sprig, cream puff-sleeve blouse, brown corset vest and a short dark-teal cape. Inside a cozy fantasy potion shop, wide 16:9 composition, detailed background, no text, no watermark.
```

### `cg_evt_slime` — 史萊姆搬家

```
Japanese anime style, kawaii and heartwarming, 2D fantasy game illustration, event CG, cozy and whimsical, soft cel shading, clean dark-brown lineart, warm lighting, storybook quality. In a cozy attic rest room, a bouncy green jelly slime greeting a round pink slime plush doll sitting on a wooden shelf, herbs scattered on the floor as its gift, Lumia crouching nearby giggling. Lumia is a young woman apprentice witch with messy shoulder-length copper-orange hair, big amethyst-purple eyes, light freckles, a small crooked dark-teal witch hat with a red leafy sprig, cream puff-sleeve blouse, brown corset vest and a short dark-teal cape. Inside a cozy fantasy potion shop, wide 16:9 composition, detailed background, no text, no watermark.
```

---

## 5. 交付檢查表

- [x] A. 事件的訪客（4）：`evt_apprentice`、`evt_merchant`、`evt_fortune`、`evt_princess`
- [x] B. 事件的小動物與道具（8）：`evt_raincloud`、`evt_butterfly`、`evt_slime`、`evt_letter`、`evt_dew`、`evt_bubble`、`evt_spark`、`evt_meteor`
- [x] C. 露米婭 Q 版・花園精靈圍裙裝（6）：`lumia_chibi_gardener_idle`、`_walk`、`_back`、`_drag`、`_sleep`、`_tired_walk`
- [x] D. 圖示（4）：`evt_heat`、`evt_guild`、`evt_dream`、`icon_event_book`
- [x] E. 露米婭立繪・花園精靈圍裙裝（6）：`portrait_lumia_gardener`、`_happy`、`_headpat`、`_poke`、`_panic`、`_shy`
- [x] F. 事件插圖 CG（17）：`cg_evt_goblin`、`cg_evt_dew`、`cg_evt_raincloud`、`cg_evt_butterfly`、`cg_evt_sneeze`、`cg_evt_bubble`、`cg_evt_perfect_heat`、`cg_evt_apprentice`、`cg_evt_hero`、`cg_evt_merchant`、`cg_evt_princess`、`cg_evt_guild_rush`、`cg_evt_dream`、`cg_evt_letter`、`cg_evt_fortune`、`cg_evt_meteor`、`cg_evt_slime`

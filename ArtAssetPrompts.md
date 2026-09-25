# 美術資源生成 Prompt 清單 (Art Asset Prompts for Grok Imagine)

對應企劃書：[`Idle Potion Shop & Mascot Girl(Game Design Document).md`](<Idle Potion Shop & Mascot Girl(Game Design Document).md>) v2

---

## 0. 使用說明（請先讀）

### 0.1 生成流程建議

1. **先生成角色設定圖**（`char_lumia_ref`），挑一張最滿意的當「標準參考圖」。
2. 之後所有露米婭相關的圖，都**上傳這張參考圖**，用 Grok Imagine 的圖片編輯/參考圖功能生成，外觀才會一致。
3. **再生成主背景**（`bg_dollhouse_main`）。其他物件的配色和光線都要跟它搭。
4. 物件類素材每個建議生成 4 張以上，挑風格最一致的。
5. Prompt 用**英文**效果最穩定。每個 Prompt 已經把共用區塊展開好，直接整段複製即可。

### 0.2 去背

Grok Imagine 不會輸出透明背景。所以物件素材一律指定**純白背景**（白色或很淺的物件改用**純綠色背景 #00FF00**），生成後再去背：

* 線上工具：remove.bg、Photoshop「移除背景」等。
* 批次處理：Python 的 `rembg` 套件（之後我可以幫你寫批次去背腳本）。

去背後存成 **PNG（透明背景）**，裁掉多餘空白，**檔名依照本文件的資源 ID**。

### 0.3 檔案放置與尺寸

* 路徑：`src/assets/art/<分類>/<資源ID>.png`（例如 `src/assets/art/plants/plant_redheart_mature.png`）。
* 遊戲邏輯解析度是 1920×1080。每個資源都標了「遊戲內顯示尺寸」，**原圖請保留至少 2 倍大小**，由程式縮小。
* 開發期間會用程式自動產生同名佔位圖（色塊 + 文字）。你把正式圖放進去就會自動取代，不需要一次全部生成。
* 程式只看**檔名**（資源 ID），子資料夾分類只是方便整理；支援 `.png`、`.webp`、`.jpg`（需要透明背景的請用 PNG 或 WebP）。
* 建議做法：原圖放在 `IdlePotionShop_ArtAssets/`，再執行 `python3 scripts/import_art.py` 自動縮圖並轉成 WebP（第一批 22.4 MB → 1.5 MB）。
* 開發伺服器執行中時放入新圖，頁面會自動重新整理。

### 0.4 共用區塊（已展開在各 Prompt 內，這裡供修改參考）

**[STYLE] 全域畫風**

整體走**日式動漫風格、可愛溫馨路線**：圓潤的造型、柔和的配色、大而有神的眼睛，氣氛像溫馨的日系奇幻動畫或手遊。避免寫實、美式卡通和陰暗厚重的畫風。所有 Prompt 開頭都已經加上 `Japanese anime style, kawaii and heartwarming`，露米婭的描述也加了 `cute Japanese anime-style face`。

如果生成結果偏寫實或偏美式，可以在 Prompt 最後補上這句：
```
not realistic, not western cartoon, not dark or gritty
```

```
Japanese anime style, kawaii and heartwarming, 2D fantasy game art, cozy and warm atmosphere, soft cel shading with gentle gradients, clean dark-brown lineart, warm amber candlelight palette with teal and violet magical accents, storybook quality
```

**[ISOLATE] 單一物件（去背用）**
```
single isolated subject, centered, entire subject fully in frame with generous margin, plain solid pure white background, no ground shadow, no text, no watermark, no border, no frame
```
（淺色物件把 `pure white background` 換成 `solid chroma green (#00FF00) background`）

**[LUMIA] 露米婭外觀**
```
Lumia, a 20-year-old adult woman apprentice witch alchemist, messy shoulder-length copper-orange hair with one springy ahoge strand, cute Japanese anime-style face with big sparkling amethyst-purple eyes, light freckles, cheerful confident expression, small slightly crooked dark-teal witch hat with a red leafy sprig tucked in the hatband, cream puff-sleeve blouse, brown leather corset vest with brass buttons, short dark-teal cape fastened with a gold star clasp, maroon knee-length skirt, belt with three small glass vials, brown lace-up boots
```

**[CHIBI] Q版比例**
```
chibi super-deformed style, 2.5 heads tall, rounded simple shapes, thick clean outline, readable as a small game sprite, full body visible
```

### 0.5 優先順序

| 優先 | 分類 | 說明 |
|---|---|---|
| ★★★ | 背景、盆栽/植物、大釜、藥水與原料圖示、露米婭 Q版 idle/walk、顧客 | M1/M2 就會用到 |
| ★★ | 升級道具、露米婭其他 Q版動作、立繪與表情、事件、家具 | M3/M4 |
| ★ | 服裝差分、CG、Logo、App 圖示 | M5 |

---

## 1. 背景 (Backgrounds) — `src/assets/art/bg/`

### bg_dollhouse_main ★★★
* **用途：** 主場景背景（盆栽、大釜、角色、顧客之後疊上去，所以背景裡**不要**畫這些物件）
* **比例：** 16:9｜**遊戲內尺寸：** 1920×1080
* **備註：** AI 很難精準控制版面，生成後我會依照實際圖片調整物件座標。請挑「區域劃分最清楚、地板線平直」的那張。

```
Japanese anime style, kawaii and heartwarming, 2D fantasy game art, cozy and warm atmosphere, soft cel shading with gentle gradients, clean dark-brown lineart, warm amber candlelight palette with teal and violet magical accents, storybook quality. A side-view cross-section of a two-story fantasy potion shop, like an open dollhouse, flat orthographic front view, all rooms visible at once. Ground floor, from left to right: a glass-roofed greenhouse room with wooden shelves and empty floor space for five flower pots; a stone-walled alchemy workshop with a wide empty brick hearth area for three cauldrons along the floor; a shop front with a wooden sales counter, cash box and shelves of empty bottles; and an open wooden front door on the far right edge with a cobblestone street step. Upper floor: a cozy attic rest room with slanted wooden beams, a round window, an empty floor area and a rug, and a small storage loft on the right with crates and hanging herbs. Warm lanterns, floating dust motes, magical glow. Floors are straight horizontal lines. No characters, no cauldrons, no flower pots, no text, no watermark.
```

### bg_dollhouse_night ★（選配）
* **用途：** 夜間版本（依玩家本地時間切換）｜**比例：** 16:9
* **做法：** 上傳 `bg_dollhouse_main` 用圖片編輯功能：

```
Same scene, same layout and composition, changed to nighttime: deep blue night sky through the windows with stars and a crescent moon, warm glowing lanterns and candles inside, cozy lamplight, magical violet glow in the greenhouse. Keep everything else identical. No characters, no text.
```

### bg_outside_sky ★（選配）
* **用途：** 放在場景後方、螢幕比例不是 16:9 時填補兩側｜**比例：** 16:9

```
Japanese anime style, kawaii and heartwarming, 2D fantasy game art, soft cel shading, warm amber and teal palette, storybook quality. A wide soft-focus fantasy town skyline at golden hour, distant rooftops, chimneys, fluffy clouds, gentle gradient sky, very low detail so it works as a blurred background. No characters, no text.
```

---

## 2. 露米婭 (Lumia) — `src/assets/art/lumia/`

### char_lumia_ref ★★★（第一個生成！）
* **用途：** 角色設定參考圖（不放進遊戲，用來維持角色一致性）｜**比例：** 3:2

```
Character reference sheet, Japanese anime style, kawaii and heartwarming, 2D fantasy game art, soft cel shading, clean dark-brown lineart, storybook quality. Lumia, a 20-year-old adult woman apprentice witch alchemist, messy shoulder-length copper-orange hair with one springy ahoge strand, cute Japanese anime-style face with big sparkling amethyst-purple eyes, light freckles, cheerful confident expression, small slightly crooked dark-teal witch hat with a red leafy sprig tucked in the hatband, cream puff-sleeve blouse, brown leather corset vest with brass buttons, short dark-teal cape fastened with a gold star clasp, maroon knee-length skirt, belt with three small glass vials, brown lace-up boots, holding an oversized wooden ladle. Show front view, side view and back view standing in a row, plus a small chibi version at the side and a few facial expression close-ups (happy, pouting, panicked). Plain white background, no text, no watermark.
```

### 2.1 Q版 Sprite（遊戲內顯示高度約 180px）

**共用 Prompt 模板**（把 `{POSE}` 換成下表的描述；請附上參考圖）：

```
Japanese anime style, kawaii and heartwarming, 2D fantasy game art, soft cel shading, clean dark-brown lineart, warm palette. chibi super-deformed style, 2.5 heads tall, rounded simple shapes, thick clean outline, readable as a small game sprite, full body visible. Lumia, a 20-year-old adult woman apprentice witch alchemist, messy shoulder-length copper-orange hair with one springy ahoge strand, cute Japanese anime-style face with big sparkling amethyst-purple eyes, light freckles, small slightly crooked dark-teal witch hat with a red leafy sprig in the hatband, cream puff-sleeve blouse, brown leather corset vest, short dark-teal cape with a gold star clasp, maroon knee-length skirt, belt with small glass vials, brown lace-up boots. {POSE}. Side three-quarter view facing left. single isolated subject, centered, entire subject fully in frame with generous margin, plain solid pure white background, no ground shadow, no text, no watermark.
```

| 資源 ID | 優先 | 比例 | {POSE} |
|---|---|---|---|
| lumia_chibi_idle | ★★★ | 1:1 | standing relaxed with a cheerful smile, holding an oversized wooden ladle over her shoulder |
| lumia_chibi_walk | ★★★ | 1:1 | walking mid-stride, arms swinging, happy expression |
| lumia_chibi_back | ★★★ | 1:1 | seen from behind (back view), standing and working at something in front of her, holding the oversized wooden ladle |
| lumia_chibi_guitar | ★★ | 1:1 | playing the oversized wooden ladle like an air guitar, eyes closed, rocking out, one leg raised, musical notes around her |
| lumia_chibi_talk_plant | ★★ | 1:1 | crouching down and talking encouragingly to something small on the ground, one finger raised, sweet smile |
| lumia_chibi_counter | ★★ | 1:1 | standing and waving hello to a customer, bright welcoming smile |
| lumia_chibi_tired_walk | ★★ | 1:1 | dragging her feet while walking, slouched shoulders, half-closed sleepy eyes, ladle dragging on the floor |
| lumia_chibi_sleep | ★★ | 1:1 | curled up into a small round ball sleeping peacefully, cape wrapped around her like a blanket, hat slipping off, lying on her side |
| lumia_chibi_grabbed | ★★ | 1:1 | being lifted by the back of her cape, dangling in the air, feet kicking, resigned deadpan "not again" expression |
| lumia_chibi_blackface | ★★ | 1:1 | standing with face smudged with black soot, hair frizzy and exploded upward, hat scorched, awkward embarrassed grin, small smoke puffs |
| lumia_chibi_tea | ★ | 1:1 | sitting and happily sipping from a small teacup with both hands, eyes closed, relaxed |
| lumia_chibi_slime | ★ | 1:1 | sitting and squishing a round pink slime plush toy, delighted expression |
| lumia_chibi_hide_doll | ★ | 1:1 | wrapping a small plush toy inside her cape and giggling secretly, mischievous happy face |

> **動畫做法（紙娃娃劇）：** 每個動作只要**一張圖**。移動、工作、待機全靠程式的上下彈跳、擠壓伸展、左右翻面表現，不需要逐格動畫。
> - `lumia_chibi_walk`：走路時使用；`lumia_chibi_back`：站在盆栽/大釜前工作時使用（背影）。
> - 目前露米婭的圖都**朝左**，之後新增的角色圖也建議朝左，保持一致（方向不同也可以，在 `manifest.ts` 標明 `facing` 即可）。

### 2.2 服裝差分 Q版（★，每套 3 張）

使用上面的模板，但把 [LUMIA] 的服裝描述**換成**下面的服裝描述，姿勢使用 idle / walk / back：

| 服裝 | 資源 ID 前綴 | 替換的服裝描述 |
|---|---|---|
| 典雅女僕裝 | `lumia_chibi_maid_` | wearing an elegant classic long black maid dress with a white frilled apron, white headdress instead of the witch hat, small teal ribbon at the collar |
| 星空絨毛睡衣 | `lumia_chibi_pajama_` | wearing a fluffy navy-blue onesie pajama covered in tiny yellow stars and moons, with a soft nightcap with a pompom instead of the witch hat |
| 鍊金大師法袍 | `lumia_chibi_robe_` | wearing a long flowing deep-purple alchemist master robe with gold embroidered runes and a high collar, a grand pointed purple witch hat with a gold band, a small monocle |

額外一張：
* `lumia_chibi_maid_bow`（★）：{POSE} = `bowing politely with hands folded in front, eyes closed, graceful`（女僕裝）

### 2.3 半身立繪（互動畫面，遊戲內顯示高度約 900px）

**基礎立繪 portrait_lumia_base ★★** — 比例 2:3

```
Japanese anime style, kawaii and heartwarming, 2D fantasy game art, high quality anime illustration, soft cel shading with gentle gradients, clean dark-brown lineart, warm lighting. Half-body portrait from the waist up, front-facing, symmetrical relaxed pose, arms relaxed at her sides not overlapping the body, looking at the viewer, gentle smile, mouth closed, eyes open, hair strands clearly separated. Lumia, a 20-year-old adult woman apprentice witch alchemist, messy shoulder-length copper-orange hair with one springy ahoge strand, cute Japanese anime-style face with big sparkling amethyst-purple eyes, light freckles, small slightly crooked dark-teal witch hat with a red leafy sprig tucked in the hatband, cream puff-sleeve blouse, brown leather corset vest with brass buttons, short dark-teal cape fastened with a gold star clasp, belt with three small glass vials. single isolated subject, centered, plain solid pure white background, no text, no watermark.
```

> 這個「正面、雙手不遮身體、頭髮分明」的姿勢，之後也方便拆件做 Live2D。

**表情差分**：上傳 `portrait_lumia_base`，用圖片編輯 Prompt：
`Same character, same pose, same outfit, same framing and background. Only change the facial expression and small details: {EXPRESSION}`

| 資源 ID | 優先 | 觸發 | {EXPRESSION} |
|---|---|---|---|
| portrait_lumia_happy | ★★ | 預設開啟、一般對話 | big bright open-mouth smile, sparkling eyes |
| portrait_lumia_headpat | ★★ | 摸頭 | eyes closed blissfully like a content cat, shoulders slightly raised and neck tucked in, soft blush, small happy smile |
| portrait_lumia_poke | ★★ | 戳臉頰 | puffed-up cheeks pretending to be angry, one eye peeking, holding back a smile, light blush |
| portrait_lumia_panic | ★★ | 狂戳 | panicked dot-shaped eyes, flailing hands raised in the air, sweat drops, mouth open in a flustered yell, leaning back |
| portrait_lumia_shy | ★★ | 互動能量用完 | shy embarrassed smile, blushing, waving one hand in front of her as if saying "that's enough" |
| portrait_lumia_blackface | ★★ | 爆炸後 | face smudged with black soot, hair frizzy and exploded, scorched hat, sheepish guilty grin, sweat drop |
| portrait_lumia_sleepy | ★ | 疲勞時 | drowsy half-closed eyes, rubbing one eye with a fist, small yawn |

**服裝立繪 ★**：上傳 `portrait_lumia_base`，Prompt：
`Same character, same pose, same framing and background. Change only the outfit to: {服裝描述（同 2.2）}`
* `portrait_lumia_maid`
* `portrait_lumia_pajama`（表情改為揉眼睛打哈欠）
* `portrait_lumia_robe`（表情改為自信的得意微笑）

---

## 3. 溫室：盆栽與植物 — `src/assets/art/plants/`

### 3.1 花盆（4 種里程碑外觀，共用給所有植物）★★★
* **遊戲內尺寸：** 約 140×110px｜**比例：** 1:1
* **模板：**

```
Japanese anime style, kawaii and heartwarming, 2D fantasy game art, cozy and warm, soft cel shading, clean dark-brown lineart, warm amber palette, storybook quality, game asset. An empty {POT}, filled with dark rich soil, side view slightly from above, nothing growing in it. single isolated subject, centered, entire subject fully in frame with generous margin, plain solid pure white background, no ground shadow, no text, no watermark.
```

| 資源 ID | 里程碑 | {POT} |
|---|---|---|
| pot_t1 | Lv 1 | simple round terracotta clay flower pot with a slightly chipped rim |
| pot_t2 | Lv 10 | glazed ceramic flower pot in deep teal with a shiny gold rim and small painted leaves |
| pot_t3 | Lv 25 | polished silver flower pot engraved with glowing blue magic runes |
| pot_t4 | Lv 50 | flower pot carved from translucent violet star crystal, softly glowing, with tiny sparkles inside |

另外：
* `pot_locked`（★★）：把 {POT} 換成 `cracked old clay flower pot covered in cobwebs with a small iron padlock hanging on it`
* `pot_hidden_slot`（★）：把 {POT} 換成 `faint ghostly translucent outline of a flower pot made of shimmering magical light, mysterious`（用綠色背景）

### 3.2 植物（放在花盆上方，底部對齊土面）★★★
* **遊戲內尺寸：** 約 140×160px｜**比例：** 1:1
* **模板：**

```
Japanese anime style, kawaii and heartwarming, 2D fantasy game art, cozy and warm, soft cel shading, clean dark-brown lineart, storybook quality, game asset. {PLANT}, shown by itself without a pot, the base of the stem cut flat at the bottom as if growing out of soil, front view. single isolated subject, centered, entire subject fully in frame with generous margin, plain solid pure white background, no ground shadow, no text, no watermark.
```

| 資源 ID | {PLANT} |
|---|---|
| plant_redheart_sprout | a tiny sprout with two small round bright-red heart-shaped leaves |
| plant_redheart_growing | a small leafy plant with several round bright-red heart-shaped leaves, the leaf veins look like tiny pulsing capillaries |
| plant_redheart_mature | a full healthy bush of round glossy bright-red heart-shaped leaves with pulsing vein patterns, a few tiny floating red heart particles, ready to harvest |
| plant_redheart_lush | an abundant overflowing bush of round glossy bright-red heart-shaped leaves spilling over, glowing veins, many tiny floating red heart particles, magical sparkle |
| plant_moonshroom_sprout | two tiny glowing pale-blue mushroom caps just poking up |
| plant_moonshroom_growing | a small cluster of glowing translucent blue mushrooms with jelly-like caps, soft bioluminescent glow |
| plant_moonshroom_mature | a cluster of plump glowing translucent blue mushrooms with jelly-like caps, soft breathing bioluminescent glow, floating blue spores, ready to harvest |
| plant_moonshroom_lush | a large dense colony of plump glowing translucent blue mushrooms of many sizes, strong bioluminescent glow, clouds of floating blue spores |
| plant_starvine_sprout | a tiny curling purple vine tendril with one small star-shaped sparkle |
| plant_starvine_growing | a curling purple vine with star-shaped leaves, tiny twinkling star fragments along the stem |
| plant_starvine_mature | a wild tangled purple vine with star-shaped leaves and small glowing star-shaped buds, shedding twinkling stardust, ready to harvest |
| plant_starvine_lush | an unruly overgrown mass of purple starlight vines reaching outward in all directions, many glowing star blossoms, streams of sparkling stardust |

> 月光菇、星光藤蔓如果和白底難去背，改用綠色背景。

---

## 4. 大釜 — `src/assets/art/cauldrons/`

### 4.1 大釜本體（4 種里程碑外觀，共用給所有配方）★★★
* **遊戲內尺寸：** 約 220×200px｜**比例：** 1:1
* **備註：** 鍋內**不要畫液體**，液體和泡泡由程式依配方著色。

```
Japanese anime style, kawaii and heartwarming, 2D fantasy game art, cozy and warm, soft cel shading, clean dark-brown lineart, storybook quality, game asset. {CAULDRON}, empty with no liquid inside, viewed from the front and slightly above so the open round rim is visible, sitting on a small stone fire pit with glowing embers. single isolated subject, centered, entire subject fully in frame with generous margin, plain solid pure white background, no text, no watermark.
```

| 資源 ID | 里程碑 | {CAULDRON} |
|---|---|---|
| cauldron_t1 | Lv 1 | an old rusty iron cauldron with dents and patches, three stubby legs |
| cauldron_t2 | Lv 10 | an ornate polished brass cauldron with engraved floral patterns and curved handles |
| cauldron_t3 | Lv 25 | a gleaming silver cauldron covered in glowing blue magic runes, runic circle floating beneath it |
| cauldron_t4 | Lv 50 | a majestic cauldron carved from translucent violet star crystal, glowing from within, tiny constellations shimmering on its surface |

### 4.2 大釜相關
| 資源 ID | 優先 | 比例 | Prompt 描述（用 [STYLE] + [ISOLATE] 包起來） |
|---|---|---|---|
| fx_liquid_surface | ★★★ | 1:1 | a flat top-down ellipse of bubbling white-grey potion liquid surface with bubbles, grayscale so it can be color tinted（綠色背景） |
| fx_bubble | ★★ | 1:1 | a single round glossy soap-bubble-like potion bubble, white and translucent（綠色背景） |

---

## 5. 圖示：原料、藥水、貨幣 — `src/assets/art/icons/`

* **遊戲內尺寸：** 48–96px｜**比例：** 1:1
* **模板：**

```
Japanese anime style, kawaii and heartwarming, 2D fantasy game item icon, soft cel shading, clean dark-brown outline, bold readable silhouette, vibrant colors, storybook quality. {ITEM}. single isolated subject, centered, entire subject fully in frame with generous margin, plain solid pure white background, no ground shadow, no text, no watermark.
```

| 資源 ID | 優先 | {ITEM} |
|---|---|---|
| item_redheart | ★★★ | a small bundle of freshly picked round bright-red heart-shaped leaves tied with twine |
| item_moonshroom | ★★★ | a single plump glowing translucent blue mushroom with a jelly-like cap |
| item_starvine | ★★★ | a coiled cutting of purple vine with star-shaped leaves and a glowing star bud |
| potion_glow | ★★★ | a small round glass potion bottle filled with glowing strawberry-red liquid, cork stopper, a tiny heart-shaped label, soft red glow |
| potion_focus | ★★★ | a square glass bottle of thick syrupy deep-blue liquid, wax-sealed stopper, a slow drip running down the side |
| potion_elixir | ★★★ | an elegant slender crystal vial of shimmering iridescent lilac liquid with tiny translucent fairy wings on the sides, floating slightly, tied down with a small brass weight on a string |
| icon_gold | ★★★ | a small stack of shiny gold coins stamped with a potion bottle emblem |
| icon_happiness | ★★★ | a plump glossy pink heart with a small sparkle and a tiny star |
| icon_charcrystal | ★★ | a jagged chunk of black charred crystal with glowing orange ember cracks and faint violet sheen |
| icon_combo | ★★ | a small swirling flame of rainbow-colored magical sparks |
| icon_bell_charge | ★★ | a small brass hand bell with a teal ribbon |

---

## 6. 升級道具與助手 — `src/assets/art/upgrades/`

這些物件同時當「升級選單的圖示」和「場景中的實體」。
* **遊戲內尺寸：** 場景中約 80–160px｜**比例：** 1:1
* **模板：**

```
Japanese anime style, kawaii and heartwarming, 2D fantasy game art, cozy and whimsical, soft cel shading, clean dark-brown lineart, storybook quality, game asset. {OBJECT}. single isolated subject, centered, entire subject fully in frame with generous margin, plain solid pure white background, no ground shadow, no text, no watermark.
```

| 資源 ID | 升級 | 優先 | {OBJECT} |
|---|---|---|---|
| upg_raincloud | 局部微型雨雲 | ★★ | a small grumpy cartoon rain cloud with an angry pouting face, raining a gentle drizzle below it（綠色背景） |
| upg_fairy | 貪吃花妖精 | ★★ | a chubby round little green plant fairy with leaf wings and a big hungry mouth, cheeks puffed full of food, tiny arms |
| upg_starsilver_can | 星銀澆水壺 | ★★ | a magical star-silver watering can with star engravings, water droplets bouncing out unnaturally in zigzags |
| upg_shears | 附魔園藝剪 | ★★ | a pair of enchanted garden shears with a wooden handle carved with glowing golden runes |
| upg_salamander | 鍋底火蜥蜴 | ★★ | a lazy chubby orange fire salamander lying flat and sleepy, with small flames on its back, puffing a tiny fire ring |
| upg_servant_ladle | 隱形僕役湯勺 | ★★ | an enchanted wooden ladle floating in mid-air by itself with faint white magic motion swirls, as if held by an invisible hand |
| upg_bellows | 龍息風箱 | ★★ | a pair of leather bellows shaped like a dragon head, puffing out colorful rainbow magic sparks from its mouth |
| upg_condenser | 雙口冷凝管 | ★★ | a messy homemade alchemy condenser made of two glass tubes crudely taped and twisted together, bubbling, with a small puff of odd-colored steam |
| upg_owl | 招財貓頭鷹 | ★★ | a carved wooden owl statue sitting on a small cash box, its eyes glowing red like scanners |
| upg_signboard | 魔法招牌 | ★★ | a hanging wooden shop signboard with a painted potion bottle, the sign has a cute face that winks playfully, sparkles around it |
| upg_diffuser | 迷幻擴香儀 | ★★ | an ornate brass aroma diffuser releasing soft swirls of mint-green and lavender-purple scented mist |
| upg_bell | 叫賣鈴鐺 | ★★ | a polished brass counter bell on a wooden base with a teal ribbon, glowing magic sound waves radiating out |
| upg_drunk | 慷慨的酒鬼體質 | ★★ | a foamy wooden beer mug with gold coins spilling out of it |
| upg_crate | 商會收購箱 | ★★ | a sturdy locked wooden crate with iron bands and a merchant guild emblem, a coin slot on top with gold coins popping out |
| upg_guild_contract | 過勞精靈工會合約 | ★ | a rolled parchment contract with a wax seal, signed by many tiny fairy footprints, a small tired fairy sleeping on it |

---

## 7. 顧客與特殊訪客 — `src/assets/art/npc/`

* **遊戲內顯示高度：** 約 170px｜**比例：** 1:1
* **模板：**

```
Japanese anime style, kawaii and heartwarming, 2D fantasy game art, soft cel shading, clean dark-brown lineart, warm palette. chibi super-deformed style, 2.5 heads tall, rounded simple shapes, thick clean outline, readable as a small game sprite, full body visible. {NPC}. Side three-quarter view facing left. single isolated subject, centered, entire subject fully in frame with generous margin, plain solid pure white background, no ground shadow, no text, no watermark.
```

| 資源 ID | 優先 | {NPC} |
|---|---|---|
| npc_novice_adventurer | ★★★ | a scruffy novice adventurer young man covered in dust and small bandages, cheap leather armor, wooden sword on his back, hopeful grin |
| npc_mage_apprentice | ★★★ | a sleep-deprived mage apprentice woman with dark eye bags, messy bun, oversized glasses, carrying a stack of books, holding a quill |
| npc_elf_noble | ★★★ | an elegant elf noblewoman with long silver hair, flowing pale-green gown, holding a folding fan, refined smile |
| npc_dwarf_merchant | ★★ | a stout cheerful dwarf merchant with a big braided red beard, a heavy backpack full of goods |
| npc_drunk_adventurer | ★★ | a tipsy red-faced bearded adventurer holding a beer mug, swaying happily, generous carefree smile |
| npc_rich_hero | ★★ | a flashy rich hero in shining gold armor with a flowing red cape, a huge overflowing bag of gold coins, confident sparkling smile, dramatic pose |
| npc_goblin | ★★ | a small cute green treasure goblin with big ears, a huge sack on its back overflowing with herbs and treasure, running with a mischievous panicked face |

**額外動作 ★（上傳對應圖片編輯）：**
* `npc_goblin_run_b`：same character, running pose with the other leg forward
* `npc_*_happy`：same character, happy satisfied expression holding a small potion bottle（每位顧客一張，成交時使用）

---

## 8. 家具（休息室）— `src/assets/art/furniture/`

* **比例：** 1:1｜使用第 6 章的物件模板

| 資源 ID | 優先 | {OBJECT} |
|---|---|---|
| furn_sofa | ★★ | a cozy plump old sofa with a patchwork quilt and mismatched cushions, warm colors |
| furn_slime_doll | ★★ | a round squishy pink slime plush toy with a cute sleepy smiling face |
| furn_gramophone | ★★ | a vintage gramophone with a large brass flower-shaped horn, a spinning record with floating musical notes |
| furn_tea_set | ★★ | an elegant magic tea set on a small round table: a teapot with gently glowing amber tea, two cups, steam curling into small star shapes |

---

## 9. 事件與特效 — `src/assets/art/fx/`

大部分粒子特效由程式產生，下面只列需要手繪的部分。

| 資源 ID | 優先 | 比例 | 描述（用 [STYLE] + [ISOLATE] 包起來） |
|---|---|---|---|
| fx_stardust_dew | ★★ | 1:1 | a cluster of rainbow iridescent dew drops sparkling like tiny prisms（綠色背景） |
| fx_spark | ★★ | 1:1 | a single bright rainbow magical fire spark star shape（綠色背景） |
| fx_explosion_smoke | ★★ | 1:1 | a comic cartoon puff of dark grey explosion smoke cloud with small orange sparks |
| fx_heart | ★★ | 1:1 | a single small glossy pink heart particle（綠色背景） |
| fx_sleep_bubble | ★ | 1:1 | a round speech bubble with a cute sleepy "zZ" symbol inside |

---

## 10. UI（魔導書主題）— `src/assets/art/ui/`

UI 的框架、按鈕、進度條主要用 CSS 做（可縮放、清晰）。以下只生成裝飾用材質：

| 資源 ID | 優先 | 比例 | Prompt |
|---|---|---|---|
| ui_paper_texture | ★★ | 1:1 | `Seamless tileable texture of old parchment paper, warm cream color, subtle fibers and faint stains, flat even lighting, no text, no border` |
| ui_leather_cover | ★★ | 1:1 | `Seamless tileable texture of dark teal leather book cover with subtle grain, flat even lighting, no text` |
| ui_corner_ornament | ★★ | 1:1 | `A single ornate gold filigree corner ornament for a magic book page, with a small violet gem, top-left corner orientation, plain solid pure white background, no text` |
| ui_grimoire_open | ★ | 16:9 | `Japanese anime style, kawaii and heartwarming, 2D fantasy game art. An ancient magical grimoire lying open, seen from directly above, blank empty parchment pages, gold filigree corners, a violet gem on the cover edge, faint glowing runes along the margins, plain solid pure white background, no text on pages` |
| ui_logo | ★ | 3:1 | `Game title logo design for a cozy fantasy potion shop game, playful hand-lettered style, a potion bottle and a small witch hat integrated into the letters, gold and teal colors with a soft glow. Text reads "Idle Potion Shop". plain solid pure white background` |
| app_icon | ★ | 1:1 | `App icon, Japanese anime style, kawaii and heartwarming, 2D fantasy art, a round glowing strawberry-red potion bottle in front of a small crooked dark-teal witch hat, warm soft background gradient, bold simple composition, readable at small size, no text` |

> 中文標題 Logo（「看板娘的放置藥水舖」）AI 很難正確生成中文字，建議用字型排版再加上 AI 生成的裝飾元素。

---

## 11. 劇情 CG — `src/assets/art/cg/`

* **比例：** 16:9｜**遊戲內尺寸：** 1920×1080｜請上傳 `char_lumia_ref` 作為參考

### cg_celebration（第一次的慶功宴）★

```
Japanese anime style, kawaii and heartwarming, 2D fantasy illustration, high quality key visual, soft cel shading with gentle gradients, warm golden lantern light, cozy celebratory atmosphere. Lumia, a 20-year-old adult woman apprentice witch alchemist, messy shoulder-length copper-orange hair with one springy ahoge strand, cute Japanese anime-style face with big sparkling amethyst-purple eyes, light freckles, small crooked dark-teal witch hat with a red leafy sprig, cream puff-sleeve blouse, brown leather corset vest, short dark-teal cape with a gold star clasp. Inside the cozy potion shop after closing, a small table crowded with homemade food, a slightly lopsided cake decorated with potion-bottle candles, colorful potions glowing like party lights, paper garlands. Lumia raises a glass of sparkling red potion in a toast toward the viewer, beaming with pride, cheeks slightly flushed, a floating ancient glowing grimoire beside the table as if it were a guest. No text, no watermark.
```

### cg_starry_vow（星空下的誓言）★

```
Japanese anime style, kawaii and heartwarming, 2D fantasy illustration, high quality key visual, soft cel shading, deep blue and violet night palette with warm accents, emotional and heartwarming atmosphere. Lumia, a 20-year-old adult woman apprentice witch alchemist, messy shoulder-length copper-orange hair with one springy ahoge strand, cute Japanese anime-style face with big sparkling amethyst-purple eyes, light freckles, small crooked dark-teal witch hat with a red leafy sprig, cream puff-sleeve blouse, brown leather corset vest, short dark-teal cape with a gold star clasp fluttering in the wind. On the rooftop of the potion shop at night under a vast starry sky with a shooting star, surrounded by glowing starlight vines and floating fireflies. She gently hugs an ancient glowing grimoire to her chest, eyes shining with grateful tears, a warm heartfelt smile, the town lights glowing softly below. No text, no watermark.
```

---

## 12. 生成進度檢查表

| 分類 | 數量 | 完成 |
|---|---|---|
| 背景 | 1（+2 選配） | ☐ |
| 露米婭設定圖 | 1 | ☐ |
| 露米婭 Q版 | 14 + 服裝 10 | ☐ |
| 露米婭立繪 | 1 + 表情 7 + 服裝 3 | ☐ |
| 花盆 | 6 | ☐ |
| 植物 | 12 | ☐ |
| 大釜 | 4 + 特效 2 | ☐ |
| 圖示 | 11 | ☐ |
| 升級道具 | 15 | ☐ |
| 顧客/訪客 | 7（+動作差分） | ☐ |
| 家具 | 4 | ☐ |
| 特效 | 5 | ☐ |
| UI | 6 | ☐ |
| CG | 2 | ☐ |

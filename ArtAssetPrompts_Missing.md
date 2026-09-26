# 尚未補齊的美術素材（整理版）

整理目前遊戲裡**還在用佔位圖**的所有素材，共 25 張，一次列在這裡。
舊文件裡寫過的（[`ArtAssetPrompts.md`](ArtAssetPrompts.md) 第 6 章、[`ArtAssetPrompts_Economy.md`](ArtAssetPrompts_Economy.md)、[`ArtAssetPrompts_ClickUpgrades.md`](ArtAssetPrompts_ClickUpgrades.md)）也收進來了，並依照**現在場景的實際擺放方式**調整描述；以這份為準即可。

* **放置位置：** 升級道具放 `IdlePotionShop_ArtAssets/public/assets/upgrades/`，禮物放 `IdlePotionShop_ArtAssets/public/assets/icons/`，檔名 = 資源 ID（例如 `upg_owl.png`）。放好後執行 `python3 scripts/import_art.py`（或跟我說一聲）。
* **去背：** 純白背景生成後去背；白色或很淺的物件改用純綠色背景 `#00FF00`（表格有標註）。
* **比例：** 全部 1:1。原圖邊長 1024 以上即可，匯入時會自動裁邊、縮圖。

**共用模板**（把 `{OBJECT}` 換成表格裡的描述）：
```
Japanese anime style, kawaii and heartwarming, 2D fantasy game art, cozy and whimsical, soft cel shading, clean dark-brown lineart, bold readable silhouette, storybook quality, game asset. {OBJECT}. single isolated subject, centered, entire subject fully in frame with generous margin, plain solid pure white background, no ground shadow, no text, no watermark.
```

---

## A. 場景裡看得到的道具（★★★ 最優先）

買了之後會出現在娃娃屋場景裡，同時也當魔導書的清單圖示。場景裡的顯示尺寸很小（寬約 50–100px），所以**輪廓要簡單清楚、顏色對比要夠**。

| 資源 ID | 道具 | 場景位置與顯示大小 | {OBJECT} |
|---|---|---|---|
| `upg_raincloud` | 局部微型雨雲 | 飄在每個盆栽上方，約 80×54 | a small fluffy grey-blue cartoon rain cloud with a grumpy pouting face, a gentle drizzle of short raindrops falling straight down below it, seen from the front（綠色背景） |
| `upg_fairy` | 貪吃花妖精 | 坐在盆栽左側，約 46×46 | a chubby round little green plant fairy with small leaf wings and a big hungry grin, cheeks puffed full of food, sitting and facing forward, tiny arms and legs |
| `upg_starsilver_can` | 星銀澆水壺 | 放在溫室地板右下角，約 56×50 | a magical star-silver watering can with star engravings and a long spout pointing to the right, a few water droplets bouncing out in playful zigzags, side view |
| `upg_salamander` | 鍋底火蜥蜴 | 趴在大釜左下方的爐台上，約 64×36（橫長） | a lazy chubby orange fire salamander lying flat on its belly, side view facing right, sleepy half-closed eyes, small flames flickering along its back, puffing a tiny smoke ring, wide and low composition |
| `upg_servant_ladle` | 隱形僕役湯勺 | 浮在大釜鍋口右側攪拌，約 54×70（直長） | an enchanted wooden ladle floating upright in mid-air by itself, bowl end pointing down, faint white magic swirls around the handle as if stirred by an invisible hand |
| `upg_owl` | 招財貓頭鷹 | 站在櫃台左側，約 56×66 | a chubby carved wooden owl statue sitting on a tiny gold coin cash box, facing forward, round glowing amber eyes, a small gold coin in its beak |
| `upg_abacus_squirrel` | 算盤松鼠 | 蹲在櫃台中間（貓頭鷹和鈴鐺之間），約 56×56 | a tiny fluffy chestnut-brown squirrel shopkeeper wearing a little green apron, sitting upright and facing forward, hugging a small wooden abacus with colorful beads, a gold coin tucked in its big fluffy tail, cheerful sparkling eyes |
| `upg_bell` | 叫賣鈴鐺 | 放在櫃台右側（可以點），約 46×46 | a polished brass shop counter bell on a round wooden base with a teal ribbon bow, small glowing magic sound-wave arcs on both sides, front view |
| `upg_diffuser` | 迷幻擴香儀 | 放在大釜旁邊的層架上（會輕輕上下飄），約 50×60 | an ornate small brass aroma diffuser with a round glass dome, releasing soft curling swirls of mint-green and lavender-purple mist from the top |
| `upg_signboard` | 魔法招牌 | 掛在店門口左上方的牆上（上緣對齊掛點），約 96×70 | a wooden shop signboard hanging from a short iron wall bracket by two chains, front view, painted with a cute round potion bottle, the board has a small cute face that winks playfully, a few sparkles around it, no letters |
| `upg_crate` | 商會收購箱 | 二樓倉庫擺一排（每種藥水一個＋原料一個），約 96×80 | a sturdy wooden merchant guild crate with iron bands, front view, closed flat lid with a **plain empty wooden panel on the front** (the game puts a potion icon on it), a small coin slot on top with a gold coin peeking out |

> 收購箱的正面請留一塊**空白木板**：遊戲會在上面貼藥水或原料的圖示，區分四個箱子。

---

## B. 只在魔導書清單出現的圖示（★★）

這些不會出現在場景裡，只當升級清單的圖示（約 48px），**越簡單越好**。

| 資源 ID | 升級 | {OBJECT} |
|---|---|---|
| `upg_shears` | 附魔園藝剪 | a pair of enchanted garden shears with a wooden handle carved with glowing golden runes, slightly open |
| `upg_fertilizer` | 魔法肥料 | a small burlap sack of glowing green magical fertilizer with sparkling leaf-shaped granules spilling out, a tiny sprout sticking out of the top |
| `upg_garden_gloves` | 魔力園藝手套 | a pair of cute soft green gardening gloves with little leaf patterns and a glowing four-leaf clover charm on the cuff, tiny green magic sparkles swirling from the fingertips |
| `upg_warm_circle` | 保溫魔法陣 | a round glowing orange-gold magic circle with flame runes, seen from a slight angle, gentle warm heat shimmer rising from it |
| `upg_bellows` | 龍息風箱 | a pair of leather bellows shaped like a cute dragon head, puffing out colorful rainbow magic sparks from its mouth |
| `upg_condenser` | 雙口冷凝管 | a messy homemade alchemy condenser made of two glass tubes crudely taped and twisted together, bubbling, a small puff of odd-colored steam |
| `upg_rune_stirrer` | 符文攪拌棒 | a long wooden alchemy stirring rod engraved with glowing purple runes along its length, a small crystal set in the handle, a few potion droplets and sparkles flying off the tip |
| `upg_refine` | 配方精煉 | an elegant glass alchemy distillation flask with a swirling glowing pink-and-gold liquid, a small golden star-shaped stopper, tiny five-pointed star sparkles floating around it |
| `upg_drunk` | 慷慨的酒鬼體質 | a foamy wooden beer mug with gold coins spilling out over the rim |
| `upg_poster` | 宣傳海報 | a cute hand-drawn parchment advertisement poster pinned with a red tack, showing a big smiling potion bottle and sparkles, corners slightly curled, no letters |
| `upg_guild_contract` | 過勞精靈工會合約 | a rolled parchment contract with a red wax seal, covered in many tiny fairy footprints as signatures, a small tired fairy sleeping on top of it |

---

## C. 送給露米婭的禮物圖示（★★）

魔導書「露米婭」分頁的禮物清單，約 48px。

| 資源 ID | 禮物 | {OBJECT} |
|---|---|---|
| `gift_snack` | 手工點心 | a small plate of homemade heart-shaped cookies and a strawberry macaron, wrapped with a little pink ribbon |
| `gift_bouquet` | 魔法花束 | a small bouquet of glowing pastel flowers with tiny floating light motes, tied with a teal ribbon |
| `gift_hairpin` | 星光髮飾 | a delicate golden hairpin shaped like a crescent moon and a star with a small amethyst gem, softly sparkling（綠色背景） |

---

## D. 之後可能會用到（目前不需要）

遊戲現在沒有用到，等對應的功能做出來再生成即可，prompt 已經寫在 [`ArtAssetPrompts.md`](ArtAssetPrompts.md)：

* **M4 隨機事件特效**（第 9 章）：`fx_stardust_dew`（星塵朝露）、`fx_explosion_smoke`（大釜爆炸）、`fx_spark`、`fx_heart`、`fx_sleep_bubble`。
* **魔導書 UI 質感**（第 10 章）：`ui_paper_texture`、`ui_leather_cover`、`ui_corner_ornament`、`ui_grimoire_open`。目前介面是 CSS 畫的，換成貼圖會更有質感，但不是必要。
* **其他**：`bg_dollhouse_night`（夜晚背景）、`ui_logo`、`app_icon`。

## 生成進度檢查表

- [ ] A. 場景道具（11）：雨雲、花妖精、澆水壺、火蜥蜴、湯勺、貓頭鷹、算盤松鼠、鈴鐺、擴香儀、招牌、收購箱
- [ ] B. 清單圖示（11）：園藝剪、肥料、手套、保溫魔法陣、風箱、冷凝管、攪拌棒、精煉、酒杯、海報、工會合約
- [ ] C. 禮物（3）：點心、花束、髮飾

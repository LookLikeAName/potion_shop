# 美術素材製作需求：標題畫面

> **狀態：已完成**（2026-09-28 匯入遊戲）。標誌 4 張都已匯入；`bg_title` **不需要**了，標題畫面的背景改用實際的遊戲畫面調暗。

這份文件列出網頁遊戲《露米婭的藥水工坊》標題畫面要用的素材，共 **2 張**（另有 3 張可選），每一張都附上可以直接使用的完整英文 Prompt。

---

## 1. 遊戲與畫風

**遊戲簡介：** 2D 網頁放置經營遊戲。見習魔女「露米婭」從學院畢業，回到從小長大的魔法藥水工坊，和一本會說話的**魔導書**（她的老師把意識留在書裡）一起經營藥水舖。遊戲畫面是一間「兩層樓娃娃屋剖面」的溫馨小店：溫室、熬藥水的大釜、櫃台、樓上的休息室。

**標題畫面的用途：** 玩家第一次打開遊戲時看到的畫面，之後也可以從設定回到這裡。畫面上方放遊戲標誌，下方中央放兩個按鈕（「開始遊戲」「設定」）。

**畫風：** 日式動漫風格、可愛溫馨路線，高品質的主視覺插畫。柔和的賽璐璐上色、燈籠般溫暖的光。主色是溫暖的金色、奶油色、木頭棕色，點綴粉紅、紫色與藍綠色的魔法光。**避免**寫實、美式卡通、陰暗厚重。

---

## 2. 角色與道具設定

**露米婭 (Lumia)：** 20 歲的成年女性見習魔女、鍊金術師。蓬鬆及肩的**銅橘色頭髮**，頭頂一根翹起的呆毛；大大閃亮的**紫水晶色眼睛**，臉上淡淡的雀斑。戴一頂**歪歪的深藍綠色小魔女帽**，帽子上插著一枝紅色葉片。奶油色泡泡袖襯衫、棕色皮革馬甲背心、深藍綠色短披風，披風用金色星星扣固定。

**魔導書（老師）：** 一本很厚的古老魔導書，**深紅棕色的皮革封面**，四個角有**金色的燙金花紋**，封面中央有一顆**小小的紫色寶石**，會發出柔和的金色光芒。

**藥水舖：** 兩層樓的木造魔法藥水舖，石頭與木頭的牆面，屋簷下掛著燈籠，窗戶透出暖黃色的光，門口旁邊有一個藥水瓶造型的招牌（**不要有文字**），屋頂和窗台有垂下的藤蔓與花草。

> 建議：如果你手邊有露米婭的角色參考圖，生成時一起附上，讓臉和服裝保持一致。

---

## 3. 素材清單

| 資源 ID | 內容 | 規格 |
|---|---|---|
| `bg_title` | 標題背景：藥水舖外觀與露米婭 | 16:9 滿版插畫，不去背 |
| `ui_title_logo` | 標誌的裝飾外框（**中間不放文字**） | 2:1，去背（綠幕） |
| `ui_logo_zh-TW` | 已經排好中文字的完整標誌 | 2:1，去背 |
| `ui_logo_ja` | 已經排好日文字的完整標誌 | 2:1，去背 |
| `ui_logo_en` | 已經排好英文字的完整標誌 | 2:1，去背 |

**為什麼標誌分成「外框」和「文字」：** 遊戲支援中文、日文、英文三種語言，而且繪圖 AI 很難正確畫出中文和日文字。所以 `ui_title_logo` 只畫裝飾外框，遊戲會把目前語言的遊戲名稱用字型疊在外框中央。

如果你想要字也是手繪、有設計感的標誌，可以自己在繪圖軟體裡把字排上去，存成 `ui_logo_<語言>`。有這張圖時，遊戲會直接用它，不再疊文字。三種語言的遊戲名稱：
* 繁體中文：**露米婭的藥水工坊**
* 日文：**ルミアのポーション工房**
* 英文：**Lumia's Potion Shop**

---

## 4. 各素材說明與 Prompt

### `bg_title` — 標題背景

* **構圖最重要：** 畫面**上方中央約三分之一**要留給標誌（天空、星星這類簡單的背景），**下方中央**要放兩個按鈕（地面、石板路這類簡單的背景）。主要的東西放在左右兩側。
* 黃昏轉夜晚的時刻，天空是紫色到深藍的漸層，剛出現幾顆星星。
* 藥水舖在畫面**左側到中央偏左**，窗戶和燈籠亮著溫暖的光，招牌是藥水瓶的形狀。
* 露米婭站在畫面**右側**的店門口石板路上，一手抱著魔導書，另一手朝觀眾揮手，開心地笑著，好像在說「歡迎光臨」。
* 空中飄著一些發光的魔法光點與小小的藥水泡泡。
* 生成 16:9（1792×1008 以上即可），遊戲內以 1920×1080 顯示。

```
Japanese anime style, kawaii and heartwarming, 2D fantasy illustration, high quality key visual for a game title screen, soft cel shading with gentle gradients, warm lantern light against a twilight sky. Wide 16:9 composition: a cozy two-story wooden and stone magic potion shop on the left side of the frame, glowing warm windows, lanterns hanging under the eaves, climbing vines and flowers, a hanging signboard shaped like a potion bottle with no text. On the right side of the frame, Lumia, a 20-year-old adult woman apprentice witch alchemist, messy shoulder-length copper-orange hair with one springy ahoge strand, cute Japanese anime-style face with big sparkling amethyst-purple eyes, light freckles, small crooked dark-teal witch hat with a red leafy sprig, cream puff-sleeve blouse, brown leather corset vest, short dark-teal cape with a gold star clasp, standing on the cobblestone street in front of the shop door, hugging a thick ancient grimoire with a deep red-brown leather cover, gold filigree corners and a small violet gem, waving at the viewer with a bright welcoming smile. Dusk sky fading from violet to deep blue with the first twinkling stars, floating glowing magic sparkles and tiny potion bubbles. Keep the upper center of the image calm and simple (open sky) for a title logo, and the lower center calm and simple (plain cobblestone ground) for menu buttons. No text, no letters, no watermark.
```

### `ui_title_logo` — 標誌的裝飾外框（中間不放文字）

* 橫長的華麗標誌外框，**比例 2:1**。
* 中央是一塊**橫長、平整的深紅棕色皮革面板**（像魔導書的封面），四周是**金色的燙金花紋外框**。**面板上完全不要有字或圖案**，遊戲會把奶油色、發光的遊戲名稱疊在這裡。
* 外框上的裝飾（只放在四周，不要蓋到中央面板）：
  * 上方中央：一頂小小的深藍綠色魔女帽，帽子上插著紅色葉片。
  * 左側：一瓶發光的粉紅色圓形藥水瓶。右側：一本打開的小魔導書，或一瓶發光的藍紫色藥水。
  * 點綴：綠色藤蔓與小花、金色星星、閃光、小泡泡。
* 外圍是深棕色描邊（`#5A3A1A` 左右），放在任何背景上都清楚。
* 背景：純綠色（`#00FF00`），之後會去背。**不要有陰影落在背景上**。

```
Japanese anime style, kawaii and cozy 2D fantasy game UI, a single ornate horizontal title logo frame for a magic potion shop game, 2:1 wide composition, centered. The center is a wide, flat, smooth deep red-brown leather plaque like a magic grimoire cover, completely blank with no text, no letters and no symbols, framed by an elegant polished gold filigree border. Decorations only around the edges and never covering the blank center plaque: a small crooked dark-teal witch hat with a red leafy sprig perched on the top center of the frame, a round glowing pink potion bottle on the left end, a small open glowing grimoire and a violet potion on the right end, green vines with tiny flowers, little gold stars, sparkles and small bubbles. Dark-brown outer outline, soft cel shading, warm and magical. Plain solid pure green background (#00FF00), no drop shadow on the background, no text, no watermark.
```

### `ui_logo_<語言>` — 完整標誌（可選）

* 用 `ui_title_logo` 當底，在中央面板上排好遊戲名稱（見第 3 節的三種語言名稱）。
* 文字建議用**奶油色到淡金色**、圓潤可愛的字體，加上**深棕色描邊**與柔和的金色光暈，在深色皮革面板上要清楚。
* 三種語言的外框、大小、位置要完全一樣，只換文字。
* 存成去背的 PNG，檔名 `ui_logo_zh-TW.png`、`ui_logo_ja.png`、`ui_logo_en.png`。

---

## 5. 驗收重點

- [ ] `bg_title`：上方中央與下方中央是簡單的背景，放上標誌和按鈕後不會蓋到露米婭的臉或店舖的重點。
- [ ] `bg_title`：露米婭的髮色、眼睛、帽子與服裝和設定一致，魔導書是深紅棕色皮革、金色角飾、紫色寶石。
- [ ] `ui_title_logo`：中央面板**完全空白**、夠寬（大約佔外框寬度的 60% 以上），放得下「ルミアのポーション工房」這樣 10 個字左右的名稱。
- [ ] `ui_title_logo`：去背乾淨，金色邊緣沒有綠色殘留。
- [ ] 所有圖都沒有任何文字（可選的 `ui_logo_<語言>` 除外）、沒有浮水印。

## 6. 生成進度檢查表

- [ ] ~~`bg_title`~~（不需要：改用實際的遊戲畫面）
- [x] `ui_title_logo`
- [x] `ui_logo_zh-TW`（可選）
- [x] `ui_logo_ja`（可選）
- [x] `ui_logo_en`（可選）

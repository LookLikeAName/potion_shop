# 美術素材製作需求：滑鼠游標

> **2026-09-28：6 張已經全部完成並匯入遊戲。**

這份文件列出《看板娘的放置藥水舖》電腦版要用的**滑鼠游標**，共 **6 張**。每一張都附上可以直接使用的完整英文 Prompt。

---

## 1. 遊戲與畫風

**遊戲簡介：** 2D 網頁放置經營遊戲。玩家經營一間奇幻世界的魔法藥水舖，畫面是「兩層樓娃娃屋剖面」：溫室的盆栽、熬藥水的大釜、櫃台與顧客、看板娘的休息室。玩家的身分是一本會說話的**魔導書**（被稱為「老師」），指導見習魔女「露米婭」經營這間店。玩家主要的操作是**用滑鼠點擊**盆栽、大釜、客人和突發事件，以及**拖曳**看板娘、大釜和禮物。

**畫風：** 日式動漫風格、可愛溫馨路線。圓潤的造型、柔和的配色，氣氛像溫馨的日系奇幻手遊。暖色的燭光色調（木頭的棕色、金色、奶油色），搭配藍綠色與紫色的魔法點綴。**避免**寫實、美式卡通、陰暗厚重的畫風。

**為什麼要做游標：** 遊戲畫面細節很多（木頭牆、瓶瓶罐罐、植物、燈光），系統內建的白色小箭頭常常看不見。游標要做到：

1. **在任何背景上都一眼看得到**：不管是深棕色的木頭，還是亮黃色的燭光。
2. **看得出現在可以做什麼**：普通、可以點、點下去、可以拖、拖曳中，各有不同的樣子。
3. **符合遊戲的魔法主題**：玩家是魔導書，用「魔法杖」來點東西。

---

## 2. 輸出規格（所有游標共通）

* **檔名：** 使用每張標示的「資源 ID」，例如 `cursor_default.png`。
* **格式：** PNG，**正方形**，原圖邊長至少 **512px**。遊戲裡會縮小到 **32×32**（高解析度螢幕用 64×64）。
* **背景：** 純綠色背景（`#00FF00`），之後會去背。游標有白色外緣，不能用白底。
* **縮小後要看得清楚：** 最終只有 32×32 像素，所以：
  * 造型要**非常簡單**，輪廓一眼就能認出來，不要細小的裝飾和花紋。
  * **雙層描邊（最重要）：** 內層是**粗的深棕色外框**（`#2B1D14`），外層再包一圈**細的白色或奶油色外緣**。這樣在深色背景靠白邊、在淺色背景靠深色框，都看得見。
  * 主體用**明亮、飽和的顏色**（奶油白、金黃、薄荷藍綠、粉紫），不要用棕色、灰色這些會和背景混在一起的顏色。
  * 不要文字、不要地面陰影、不要邊框。
* **尖端位置（很重要）：** 會「點」東西的游標（A、B、C、F），**尖端必須是整張圖最左上角的點**：
  * 游標朝左上方斜放，尖端離畫面左邊與上邊各約 **4%**。
  * 遊戲會把尖端當成實際點擊的位置，尖端的左上方不能有任何其他東西（光點、星星也不行）。
* **手的游標（D、E）：** 置中，點擊的位置是手掌中心。
* **一致性：** 6 張要像同一套。建議先生成 A，挑好之後把 A 當參考圖，再生成其他張（如果工具支援參考圖）。每張生成 3–4 張候選。

---

## 3. 素材清單（共 6 張）

| 資源 ID | 狀態 | 什麼時候出現 | 點擊位置 |
|---|---|---|---|
| `cursor_default` | 一般 | 滑鼠在畫面上、沒有指著可以互動的東西 | 箭頭尖端（左上角） |
| `cursor_pointer` | 可以點 | 指著盆栽、大釜、客人、按鈕等可以點的東西 | 杖頭星星的尖端（左上角） |
| `cursor_press` | 點下去 | 按住滑鼠左鍵的瞬間 | 同上（左上角） |
| `cursor_grab` | 可以拖 | 指著可以拖曳的東西（露米婭、大釜、禮物） | 手掌中心 |
| `cursor_grabbing` | 拖曳中 | 正在拖曳 | 手掌中心 |
| `cursor_disabled` | 不能用 | 指著目前不能按的按鈕（例如錢不夠） | 箭頭尖端（左上角） |

---

## 4. 各游標說明與 Prompt

**共用開頭**（每個 Prompt 都已經包含，這裡列出方便理解）：
```
Japanese anime style, kawaii and cozy, 2D fantasy game UI icon, mouse cursor design, very simple bold shape readable at 32x32 pixels, thick dark-brown outline (#2B1D14) with an extra thin white outer rim around the whole shape, bright saturated flat colors with minimal soft shading
```

### A. `cursor_default` — 一般箭頭

* 經典的滑鼠箭頭形狀（讓玩家一看就知道是游標），但做成魔法風：奶油白的箭頭本體、金色的邊，箭頭尾巴掛一顆小小的星星吊飾。
* 箭頭尖端朝**左上**，是整張圖最左上角的點。

```
Japanese anime style, kawaii and cozy, 2D fantasy game UI icon, mouse cursor design, very simple bold shape readable at 32x32 pixels, thick dark-brown outline (#2B1D14) with an extra thin white outer rim around the whole shape, bright saturated flat colors with minimal soft shading. A classic computer mouse arrow cursor shape pointing to the upper-left, cream-white arrow body with a golden trim, a tiny golden star charm hanging from the tail of the arrow. The arrow tip is the top-left-most point of the whole image, placed about 4% from the top and left edges; nothing else is above or left of the tip. Single isolated object, plain solid pure green background (#00FF00), no text, no watermark, no border, no ground shadow.
```

### B. `cursor_pointer` — 魔法杖（可以點）

* 一根短短的魔法杖，杖頭是一顆**金黃色的五角星**，星星周圍有淡淡的光暈；杖身是薄荷藍綠色，握把纏著粉紫色緞帶。
* 杖**斜放，星星朝左上**：星星的其中一個尖角是整張圖最左上角的點。
* 和 A 的差別要一眼就看得出來：箭頭變成魔法杖，玩家就知道「這個可以點」。

```
Japanese anime style, kawaii and cozy, 2D fantasy game UI icon, mouse cursor design, very simple bold shape readable at 32x32 pixels, thick dark-brown outline (#2B1D14) with an extra thin white outer rim around the whole shape, bright saturated flat colors with minimal soft shading. A short cute magic wand held diagonally, the wand head is a bright golden five-pointed star with a soft warm glow, a mint-teal wand shaft, a lavender-pink ribbon wrapped around the handle. The star points to the upper-left: one point of the star is the top-left-most point of the whole image, placed about 4% from the top and left edges; the handle goes toward the lower-right. Single isolated object, plain solid pure green background (#00FF00), no text, no watermark, no border, no ground shadow.
```

### C. `cursor_press` — 魔法杖（點下去）

* 和 B **同一根魔法杖、同一個角度與位置**（尖端位置完全一樣），但星星**更亮、稍微大一點**，周圍多了幾道短短的閃光線條，像「叮！」一下施了魔法。
* 閃光線條只能往星星的右邊、下方延伸，**不能超出星星尖端的左上方**。

```
Japanese anime style, kawaii and cozy, 2D fantasy game UI icon, mouse cursor design, very simple bold shape readable at 32x32 pixels, thick dark-brown outline (#2B1D14) with an extra thin white outer rim around the whole shape, bright saturated flat colors with minimal soft shading. The same short cute magic wand held diagonally, golden five-pointed star head now shining brighter and slightly bigger, with a few short sparkle lines bursting out to the right and below the star like a magic "ping", mint-teal wand shaft, lavender-pink ribbon on the handle. One point of the star is still the top-left-most point of the whole image, about 4% from the top and left edges; sparkles never extend above or left of that point. Single isolated object, plain solid pure green background (#00FF00), no text, no watermark, no border, no ground shadow.
```

### D. `cursor_grab` — 張開的手（可以拖）

* 一隻可愛的、戴著奶油白魔法手套的小手，**五指張開、手掌朝前**，手腕處有金色的袖口滾邊。
* 圓潤、手指短短胖胖的 Q 版造型。**置中**。

```
Japanese anime style, kawaii and cozy, 2D fantasy game UI icon, mouse cursor design, very simple bold shape readable at 32x32 pixels, thick dark-brown outline (#2B1D14) with an extra thin white outer rim around the whole shape, bright saturated flat colors with minimal soft shading. A cute chubby cartoon hand wearing a cream-white magic glove with a golden cuff trim, open hand with fingers spread, palm facing the viewer, short rounded fingers. Centered, single isolated object, plain solid pure green background (#00FF00), no text, no watermark, no border, no ground shadow.
```

### E. `cursor_grabbing` — 握住的手（拖曳中）

* 和 D **同一隻手套**，但**握起來**（像抓住東西），手指彎曲、看得到指節，旁邊可以有兩三條小小的動作線。**置中**，大小和 D 差不多。

```
Japanese anime style, kawaii and cozy, 2D fantasy game UI icon, mouse cursor design, very simple bold shape readable at 32x32 pixels, thick dark-brown outline (#2B1D14) with an extra thin white outer rim around the whole shape, bright saturated flat colors with minimal soft shading. The same cute chubby cartoon hand in a cream-white magic glove with a golden cuff trim, now closed in a grabbing fist as if holding something, curled rounded fingers, two or three tiny motion lines beside it. Centered, same size as an open hand, single isolated object, plain solid pure green background (#00FF00), no text, no watermark, no border, no ground shadow.
```

### F. `cursor_disabled` — 不能用

* 和 A **同一個箭頭、同一個角度與位置**，但顏色變得比較灰暗（淡灰紫色），箭頭的右下方多一個小小的**紅色圓形禁止標誌**（圓圈加斜線）。
* 禁止標誌不能超出箭頭尖端的左上方。

```
Japanese anime style, kawaii and cozy, 2D fantasy game UI icon, mouse cursor design, very simple bold shape readable at 32x32 pixels, thick dark-brown outline (#2B1D14) with an extra thin white outer rim around the whole shape, flat colors with minimal soft shading. The same classic mouse arrow cursor pointing to the upper-left but desaturated in a pale grayish lavender, with a small red "not allowed" badge (a circle with a diagonal slash) at the lower-right of the arrow. The arrow tip is the top-left-most point of the whole image, placed about 4% from the top and left edges. Single isolated object, plain solid pure green background (#00FF00), no text, no watermark, no border, no ground shadow.
```

---

## 5. 驗收重點

交件前請把每張圖縮小到 **32×32** 看一次，並分別放在「深棕色」和「亮黃色」的底色上確認：

- [ ] 縮小後還認得出是箭頭／魔法杖／手，輪廓沒有糊成一團。
- [ ] 深色和淺色背景上都看得清楚（雙層描邊有做出來）。
- [ ] A、B、C、F 的尖端都在最左上角，而且 B 和 C 的尖端位置完全一樣（點下去時游標不會跳動）。
- [ ] D 和 E 大小差不多、置中（拖曳時不會跳動）。
- [ ] 6 張的描邊粗細、配色、畫風一致。

## 6. 生成進度檢查表

- [x] A. `cursor_default`
- [x] B. `cursor_pointer`
- [x] C. `cursor_press`
- [x] D. `cursor_grab`
- [x] E. `cursor_grabbing`
- [x] F. `cursor_disabled`

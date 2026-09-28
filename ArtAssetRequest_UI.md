# 美術素材製作需求：介面圖示與魔導書外觀

> **2026-09-28：17 張已經全部完成並匯入遊戲。**

這份文件列出《看板娘的放置藥水舖》介面要用的素材，共 **17 張**：

- **介面小圖示 13 張**：取代目前介面裡的 emoji。
- **魔導書外觀 4 張**：讓遊戲的主選單「魔導書」看起來像一本真正的書。

每一張都附上可以直接使用的完整英文 Prompt。

---

## 1. 遊戲與畫風

**遊戲簡介：** 2D 網頁放置經營遊戲。玩家經營一間奇幻世界的魔法藥水舖，畫面是「兩層樓娃娃屋剖面」：溫室的盆栽、熬藥水的大釜、櫃台與顧客、看板娘「露米婭」（見習魔女）的休息室。玩家的身分是一本會說話的**魔導書**（被稱為「老師」）。遊戲的主選單就是這本魔導書：從畫面右側打開，左邊有一排彩色的緞帶書籤可以切換分頁，每一頁上是升級、統計、圖鑑等內容。

**畫風：** 日式動漫風格、可愛溫馨路線。圓潤的造型、柔和的配色，氣氛像溫馨的日系奇幻手遊。暖色的燭光色調（木頭的棕色、金色、奶油色、羊皮紙色），搭配藍綠色、粉紅色、紫色的魔法點綴。**避免**寫實、美式卡通、陰暗厚重的畫風。

---

## 2. 輸出規格

### 介面小圖示（A 區，13 張）

* **檔名：** 使用每張標示的「資源 ID」，例如 `icon_lock.png`。
* **格式：** PNG，**正方形**，原圖邊長至少 **512px**。遊戲裡顯示約 **24～48px**，會自動縮小、裁掉空白。
* **背景：** 純綠色背景（`#00FF00`），之後會去背。
* **縮小後要看得清楚：**
  * 單一物件、置中、造型簡單，一眼認得出是什麼，**不要細小的裝飾和花紋**。
  * **粗的深棕色外框**（`#2B1D14`）＋ 明亮飽和的主色，放在米黃色的紙張上、也放在深棕色的木頭上都要清楚。
  * 柔和的平塗上色，只有少量陰影與一點高光。
  * 不要文字、不要地面陰影、不要邊框、不要背景小物件。
* **一致性：** 13 張要像同一套圖示。建議先生成 `icon_lock`，挑好後當參考圖再生成其他張（如果工具支援參考圖）。

### 魔導書外觀（B 區，4 張）

規格各不相同，寫在每一張的說明裡。

**共用開頭（A 區每個 Prompt 都已經包含）：**
```
Japanese anime style, kawaii and cozy, 2D fantasy game UI icon, single object, simple bold readable shape that stays clear at 32x32 pixels, thick dark-brown outline (#2B1D14), bright saturated flat colors with soft minimal shading and a small highlight
```

---

## 3. 素材清單

| 區 | 資源 ID | 內容 | 用在哪裡 |
|---|---|---|---|
| A | `icon_grimoire` | 魔導書（闔起來的書） | 畫面右上角「魔導書」按鈕 |
| A | `icon_ledger` | 帳本與小長條圖 | 書籤：產銷統計 |
| A | `icon_settings` | 黃銅齒輪 | 書籤：設定 |
| A | `icon_close` | 關閉按鈕（X） | 關閉魔導書與各種視窗 |
| A | `icon_lock` | 掛鎖 | 還沒解鎖的盆栽格、配方、擺設位 |
| A | `icon_trophy` | 獎盃 | 成就 |
| A | `icon_gift` | 禮物盒 | 禮物圖鑑 |
| A | `icon_check` | 打勾 | 已達成的成就、事件簿收集里程碑 |
| A | `icon_star` | 小星星 | 配方精煉等級（一到五顆）、占卜牌的牌背 |
| A | `icon_hourglass` | 沙漏 | 事件與小心願的剩餘時間 |
| A | `icon_letter` | 封蠟信封 | 露米婭收到的來信 |
| A | `icon_wish` | 許願星 | 露米婭的小心願 |
| A | `icon_fire` | 魔法火焰 | 大釜「極速沸騰」 |
| B | `ui_page_texture` | 羊皮紙紋理（可無縫拼接） | 魔導書的書頁 |
| B | `ui_leather_texture` | 皮革紋理（可無縫拼接） | 魔導書的封面與書脊 |
| B | `ui_corner` | 金色角落花紋 | 書頁上每張資訊卡的四個角 |
| B | `ui_divider` | 花紋分隔線 | 每一頁的章節標題下方 |

---

## A. 介面小圖示（★★★，13 張）

### `icon_grimoire` — 魔導書
* 一本厚厚的、闔起來的魔法書，**深藍綠色皮革封面**、四個角包著金屬護角、書背有金色的橫紋；封面中央鑲著一顆發光的紫色寶石，周圍刻著一圈金色的星星圖樣。書稍微斜放、看得到書頁的厚度。
* 這是玩家自己（會說話的魔導書），要看起來可靠又溫柔。

```
Japanese anime style, kawaii and cozy, 2D fantasy game UI icon, single object, simple bold readable shape that stays clear at 32x32 pixels, thick dark-brown outline (#2B1D14), bright saturated flat colors with soft minimal shading and a small highlight. A thick closed magic grimoire book with a deep teal leather cover, golden metal corner guards and golden bands on the spine, a glowing purple gem set in the center of the cover surrounded by a small ring of golden stars, cream page edges visible, shown at a slight three-quarter angle. Centered, plain solid pure green background (#00FF00), no text, no watermark, no border, no ground shadow.
```

### `icon_ledger` — 帳本
* 一本攤開的小帳本，左頁有三根由低到高的彩色長條圖（綠、橙、藍），右頁有幾行格線，一支羽毛筆斜放在上面。

```
Japanese anime style, kawaii and cozy, 2D fantasy game UI icon, single object, simple bold readable shape that stays clear at 32x32 pixels, thick dark-brown outline (#2B1D14), bright saturated flat colors with soft minimal shading and a small highlight. A small open account ledger book with cream pages, the left page shows three simple rising bar chart bars in green, orange and blue, the right page has a few ruled lines, a white feather quill pen resting diagonally across it. Centered, plain solid pure green background (#00FF00), no text, no numbers, no watermark, no border, no ground shadow.
```

### `icon_settings` — 齒輪
* 一個亮金色的黃銅齒輪，齒數少、齒很粗（6～8 齒），中間的圓孔裡有一顆小小的藍綠色星星。

```
Japanese anime style, kawaii and cozy, 2D fantasy game UI icon, single object, simple bold readable shape that stays clear at 32x32 pixels, thick dark-brown outline (#2B1D14), bright saturated flat colors with soft minimal shading and a small highlight. A shiny golden brass cogwheel with only 6 to 8 chunky rounded teeth, a round hole in the middle holding a tiny mint-teal star. Centered, plain solid pure green background (#00FF00), no text, no watermark, no border, no ground shadow.
```

### `icon_close` — 關閉
* 一個圓形的小徽章按鈕：酒紅色底、金色的圓框，中間是粗粗的奶油白 **X**，X 的四個端點是圓的。

```
Japanese anime style, kawaii and cozy, 2D fantasy game UI icon, single object, simple bold readable shape that stays clear at 32x32 pixels, thick dark-brown outline (#2B1D14), bright saturated flat colors with soft minimal shading and a small highlight. A round badge button with a wine-red face and a golden rim, a thick cream-white X mark with rounded ends in the center. Centered, plain solid pure green background (#00FF00), no text, no watermark, no border, no ground shadow.
```

### `icon_lock` — 掛鎖
* 一個圓胖的黃銅掛鎖，鎖身比較大、鎖環比較粗，鑰匙孔是**愛心形狀**。

```
Japanese anime style, kawaii and cozy, 2D fantasy game UI icon, single object, simple bold readable shape that stays clear at 32x32 pixels, thick dark-brown outline (#2B1D14), bright saturated flat colors with soft minimal shading and a small highlight. A chubby rounded golden brass padlock with a big body and a thick shackle, the keyhole is shaped like a small heart. Centered, plain solid pure green background (#00FF00), no text, no watermark, no border, no ground shadow.
```

### `icon_trophy` — 獎盃
* 一個金色的獎盃，兩側有圓圓的把手，杯身正面有一顆星星浮雕，底座是深棕色的木頭。

```
Japanese anime style, kawaii and cozy, 2D fantasy game UI icon, single object, simple bold readable shape that stays clear at 32x32 pixels, thick dark-brown outline (#2B1D14), bright saturated flat colors with soft minimal shading and a small highlight. A shiny golden trophy cup with two rounded handles, a raised star emblem on the front of the cup, standing on a small dark-brown wooden base. Centered, plain solid pure green background (#00FF00), no text, no watermark, no border, no ground shadow.
```

### `icon_gift` — 禮物盒
* 一個粉紅色的方形禮物盒，綁著薄荷藍綠色的緞帶，頂端是一個大大的蝴蝶結。

```
Japanese anime style, kawaii and cozy, 2D fantasy game UI icon, single object, simple bold readable shape that stays clear at 32x32 pixels, thick dark-brown outline (#2B1D14), bright saturated flat colors with soft minimal shading and a small highlight. A cute square pink gift box tied with a mint-teal ribbon and a big fluffy bow on top. Centered, plain solid pure green background (#00FF00), no text, no watermark, no border, no ground shadow.
```

### `icon_check` — 打勾
* 一個粗粗的、筆刷感的葉綠色**勾勾**，勾的周圍有一圈白色外緣。只有勾勾本身，不要圓框。

```
Japanese anime style, kawaii and cozy, 2D fantasy game UI icon, single object, simple bold readable shape that stays clear at 32x32 pixels, thick dark-brown outline (#2B1D14), bright saturated flat colors with soft minimal shading and a small highlight. A single thick bold leaf-green check mark with a slightly brushed hand-drawn feel and a thin white outer rim, no circle or badge behind it. Centered, plain solid pure green background (#00FF00), no text, no watermark, no border, no ground shadow.
```

### `icon_star` — 小星星
* 一顆飽滿的金黃色五角星，角是圓的，中間有一道高光。會好幾顆排在一起（精煉等級），所以要單純、圓潤。

```
Japanese anime style, kawaii and cozy, 2D fantasy game UI icon, single object, simple bold readable shape that stays clear at 32x32 pixels, thick dark-brown outline (#2B1D14), bright saturated flat colors with soft minimal shading and a small highlight. A plump golden-yellow five-pointed star with softly rounded points and a small white highlight. Centered, plain solid pure green background (#00FF00), no text, no watermark, no border, no ground shadow.
```

### `icon_hourglass` — 沙漏
* 一個木框的小沙漏，上下是深棕色木頭，玻璃裡是**粉紅色的沙**，上半部剩一點、下半部堆比較多，中間有一道細細的沙流。

```
Japanese anime style, kawaii and cozy, 2D fantasy game UI icon, single object, simple bold readable shape that stays clear at 32x32 pixels, thick dark-brown outline (#2B1D14), bright saturated flat colors with soft minimal shading and a small highlight. A small cute hourglass with a dark-brown wooden frame, pink sand inside the glass, a little sand left in the top bulb and a pile in the bottom bulb, a thin stream of sand falling in the middle. Upright, centered, plain solid pure green background (#00FF00), no text, no watermark, no border, no ground shadow.
```

### `icon_letter` — 封蠟信封
* 一個奶油色的信封（正面、封口朝上），封口蓋上一顆**紅色的愛心形封蠟**。

```
Japanese anime style, kawaii and cozy, 2D fantasy game UI icon, single object, simple bold readable shape that stays clear at 32x32 pixels, thick dark-brown outline (#2B1D14), bright saturated flat colors with soft minimal shading and a small highlight. A cream-colored envelope seen from the front with the flap closed, sealed with a red heart-shaped wax seal in the middle. Centered, plain solid pure green background (#00FF00), no text, no watermark, no border, no ground shadow.
```

### `icon_wish` — 許願星
* 一顆淡金色的星星，中間是一顆粉紅色的小愛心，星星後面拖著一小段粉紫色的閃亮尾巴（往左下）。

```
Japanese anime style, kawaii and cozy, 2D fantasy game UI icon, single object, simple bold readable shape that stays clear at 32x32 pixels, thick dark-brown outline (#2B1D14), bright saturated flat colors with soft minimal shading and a small highlight. A pale golden wishing star with a small pink heart in its center, a short sparkly lavender-pink trail flowing behind it toward the lower-left. Centered, plain solid pure green background (#00FF00), no text, no watermark, no border, no ground shadow.
```

### `icon_fire` — 魔法火焰
* 一團圓潤可愛的火焰，外層橘色、內層黃色、中心一點點白色，火焰尖端有一兩顆小火花。

```
Japanese anime style, kawaii and cozy, 2D fantasy game UI icon, single object, simple bold readable shape that stays clear at 32x32 pixels, thick dark-brown outline (#2B1D14), bright saturated flat colors with soft minimal shading and a small highlight. A round cute teardrop-shaped flame, orange outer layer, yellow inner layer and a tiny white core, one or two small sparks near the tip. Centered, plain solid pure green background (#00FF00), no text, no watermark, no border, no ground shadow.
```

---

## B. 魔導書外觀（★★，4 張）

### `ui_page_texture` — 羊皮紙紋理
* **無縫拼接（seamless tileable）** 的正方形紋理，1024×1024，**不需要去背**（整張都是紙）。
* 溫暖的米黃色羊皮紙：非常淡的纖維紋理、若有若無的斑點，**對比要很低**，因為上面會放大量文字。
* 不要邊框、不要燒焦邊、不要明顯的污漬或暗角（四邊要能接起來）。

```
Seamless tileable texture, warm cream-beige parchment paper surface, very subtle paper fibers and faint mottling, very low contrast so text stays readable on top, soft and clean, even lighting, no vignette, no dark edges, no burnt edges, no stains, no border, no text, flat top-down view, fills the whole square image.
```

### `ui_leather_texture` — 皮革紋理
* **無縫拼接** 的正方形紋理，1024×1024，**不需要去背**。
* 魔導書封面的**深紅棕色皮革**：細緻的皮革顆粒、柔和的光澤，顏色均勻（大約 `#5A3322` 上下）。這會當作封面與書脊的底，上面會放彩色的緞帶書籤，所以不要太花。

```
Seamless tileable texture, rich dark reddish-brown leather like an old grimoire book cover, fine natural leather grain, soft subtle sheen, even color around #5A3322, no stitching, no seams, no emboss patterns, no vignette, no border, no text, flat top-down view, fills the whole square image.
```

### `ui_corner` — 角落花紋
* 一個**左上角**用的金色藤蔓花紋（遊戲會旋轉、翻轉後用在其他角）：從左上角沿著上邊與左邊延伸出去的細細金色捲草紋，角上有一顆小星星。
* 正方形，原圖至少 512px，**純綠色背景**（`#00FF00`）去背。
* 線條要細緻但不能太細（遊戲裡顯示約 30px），像書本內頁的燙金裝飾。

```
Ornate golden filigree corner ornament for the top-left corner of a book page, thin elegant golden vine scrolls extending along the top edge and the left edge from the corner, a tiny star at the corner point, delicate but clearly readable when small, gold foil look with a soft highlight, plain solid pure green background (#00FF00), no text, no watermark, no other objects.
```

### `ui_divider` — 花紋分隔線
* 一條**橫向**的裝飾分隔線，用在每一頁的章節標題下方：中間一顆小小的金色星星，往左右延伸出對稱的細細捲草線條，兩端漸漸變細。
* 很扁的長方形，比例約 **8:1**（例如 2048×256），**純綠色背景**（`#00FF00`）去背。顏色是深金棕色（在米黃色紙上要看得清楚）。

```
Horizontal ornamental divider line for a book page, a small golden star in the center with symmetrical thin elegant scroll flourishes extending left and right, tapering to fine points at both ends, deep golden-brown color readable on cream paper, very wide and thin 8:1 composition, plain solid pure green background (#00FF00), no text, no watermark, no other objects.
```

---

## 4. 驗收重點

- [x] A 區每張縮小到 **32×32**，放在米黃色和深棕色的底上都認得出來。
- [x] A 區 13 張的描邊粗細、配色、畫風一致。
- [x] `ui_page_texture`、`ui_leather_texture` 並排四張拼起來看不到接縫，而且顏色很均勻（沒有暗角）。
- [x] `ui_page_texture` 上放黑色小字仍然很好讀。
- [x] `ui_corner`、`ui_divider` 去背乾淨、線條在縮小後不會斷掉。

## 5. 生成進度檢查表

- [x] `icon_grimoire`
- [x] `icon_ledger`
- [x] `icon_settings`
- [x] `icon_close`
- [x] `icon_lock`
- [x] `icon_trophy`
- [x] `icon_gift`
- [x] `icon_check`
- [x] `icon_star`
- [x] `icon_hourglass`
- [x] `icon_letter`
- [x] `icon_wish`
- [x] `icon_fire`
- [x] `ui_page_texture`
- [x] `ui_leather_texture`
- [x] `ui_corner`
- [x] `ui_divider`

# 美術素材製作需求：網頁分頁圖示（favicon）

> **2026-09-29：兩張都已經完成並匯入遊戲**（16×16 分頁圖示用 `app_icon_small`，其他尺寸用 `app_icon`）。

這份文件列出網頁遊戲《露米婭的藥水工坊》的**網頁圖示**，共 **1 張**（另有 1 張可選）。每一張都附上可以直接使用的完整英文 Prompt。

---

## 1. 遊戲與畫風

**遊戲簡介：** 2D 網頁放置經營遊戲。見習魔女「露米婭」從學院畢業，回到從小長大的魔法藥水工坊，和一本會說話的**魔導書**（她的老師）一起經營藥水舖：在溫室種藥草、用大釜熬藥水、在櫃台賣給冒險者。

**畫風：** 日式動漫風格、可愛溫馨路線。圓潤的造型、柔和的配色。主色是溫暖的金色、奶油色、木頭棕色，點綴粉紅、紫色與藍綠色的魔法光。**避免**寫實、美式卡通、陰暗厚重的畫風。

**遊戲標誌的樣子（圖示要和它看起來是同一套）：** 標題標誌是一塊深紅棕色皮革面板，外圍金色燙金花紋。上方中央停著一頂**歪歪的深藍綠色小魔女帽**，帽子上插著一枝**紅色葉片**。左邊是一瓶**發光的粉紅色圓形藥水瓶**，右邊是一本打開的發光魔導書。

---

## 2. 圖示會出現在哪裡

| 用途 | 實際顯示大小 |
|---|---|
| 瀏覽器分頁、書籤 | **16×16**、32×32 像素 |
| 手機「加到主畫面」的圖示 | 180×180、192×192、512×512 |

最常被看到的是分頁上的 **16×16**，只有指甲大小。所以這張圖**最重要的是縮到很小還認得出來**，細節是其次。

分頁列可能是**淺色**（白、淺灰），也可能是**深色**（深灰、黑，深色模式）。兩種都要看得清楚。

---

## 3. 輸出規格

* **檔名：** `app_icon.png`（可選的簡化版：`app_icon_small.png`）。
* **格式：** PNG，**正方形**，原圖邊長至少 **1024px**。
* **背景：** 純綠色背景（`#00FF00`），之後會去背。
  * 所以**圖示本身不要用綠色**：不要綠色的藥水、綠色的葉子、綠色的光。
  * 要放到手機主畫面時，程式會自動替它加上圓角方形的底色。
* **塞滿畫面：** 主體佔畫面寬高的約 **90%**，置中，四周只留一點點空隙。分頁圖示很小，留白太多主體就更小。
* **縮小後要看得清楚：**
  * **只放一個主體**，輪廓簡單、一眼認得出來。不要場景、不要背景道具、不要細小的花紋。
  * **雙層描邊（最重要）：** 內層是**粗的深棕色外框**（`#2B1D14`），外層再包一圈**奶油白色的外緣**。淺色分頁列上靠深色框，深色分頁列上靠白色外緣。
  * 主體用**明亮、飽和的顏色**、大塊的色面，陰影簡單就好。
  * **不要任何文字或字母**，也不要浮水印、邊框、落在地面的影子。

---

## 4. 各素材說明與 Prompt

### A. `app_icon` — 戴魔女帽的藥水瓶（必要）

* 一瓶**圓圓胖胖的粉紅色藥水瓶**，瓶身是圓球形、短短的瓶頸、軟木塞。
* 藥水是亮粉紅到草莓紅，瓶子裡有兩三顆小氣泡和一個白色的高光，整瓶微微發光。
* 瓶口上方**歪歪地戴著一頂小小的深藍綠色魔女帽**（和標誌上的帽子一樣），帽子上插著一枝紅色葉片。這樣一看就知道是「魔女的藥水」，也和標誌呼應。
* 瓶子旁邊可以有**一兩顆**小小的金色星星閃光，但不能多，縮小後會變成雜點。
* 整體略微傾斜、帶一點動感，但瓶子和帽子要是一個緊湊的整體，不要分得太開。

```
Japanese anime style, kawaii and cozy, 2D fantasy game app icon and browser favicon, very simple bold shape readable at 16x16 pixels, thick dark-brown outline (#2B1D14) with an extra thin cream-white outer rim around the whole shape, bright saturated colors with large flat color areas and minimal soft shading. A single chubby round potion bottle with a short neck and a cork, filled with glowing bright pink to strawberry-red potion, two or three tiny bubbles inside and one white highlight on the glass, gently glowing. A small crooked dark-teal witch hat with a red leafy sprig sits tilted on top of the bottle's neck. One or two tiny golden star sparkles beside the bottle. The bottle and hat form one compact shape, centered, filling about 90% of the square canvas. No green anywhere on the object. Single isolated object, plain solid pure green background (#00FF00), no text, no letters, no watermark, no border, no ground shadow.
```

### B. `app_icon_small` — 16px 用的簡化版（可選）

A 縮到 16×16 時，如果帽子上的葉片、氣泡、星星糊成一團，就再做這張更簡化的版本。**只在分頁的 16×16 使用**，其他大小仍然用 A。

* 和 A **同一個藥水瓶、同一頂帽子、同樣的角度與配色**。
* 拿掉所有小東西：**不要星星、不要氣泡、不要葉片**，只保留一個大大的白色高光。
* 描邊再**更粗一點**，形狀再更圓、更單純。

```
Japanese anime style, kawaii, 2D game browser favicon, extremely simple bold shape designed to be read at 16x16 pixels, very thick dark-brown outline (#2B1D14) with a thin cream-white outer rim around the whole shape, flat bright saturated colors, almost no shading. The same chubby round potion bottle with a cork, filled with bright pink to strawberry-red potion, a single large white highlight on the glass, and the same small crooked dark-teal witch hat tilted on top of the bottle's neck. No stars, no bubbles, no leaves, no small details. Centered, filling about 90% of the square canvas. No green anywhere on the object. Single isolated object, plain solid pure green background (#00FF00), no text, no letters, no watermark, no border, no ground shadow.
```

---

## 5. 驗收重點

交件前請把圖縮小到 **16×16** 和 **32×32**，分別放在**白色**和**深灰色**（`#202124` 左右）的底色上看：

- [ ] 16×16 時還認得出是「一瓶粉紅色的藥水」，帽子看得出來（至少看得出是深色的尖帽形狀）。
- [ ] 白底和深灰底上輪廓都清楚（雙層描邊有做出來）。
- [ ] 主體塞滿畫面（約 90%），不是一小顆在中間。
- [ ] 圖示本身沒有綠色；去背後金色、粉紅色的邊緣沒有綠色殘留。
- [ ] 帽子的顏色和紅色葉片跟標題標誌上的一致。
- [ ] 沒有任何文字、字母、浮水印。

## 6. 生成進度檢查表

- [x] A. `app_icon`
- [x] B. `app_icon_small`（可選：A 在 16×16 看不清楚時才需要）

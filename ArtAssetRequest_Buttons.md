# 美術素材製作需求：按鈕

> **狀態：暫緩。** 生成的按鈕不符合期待，目前維持 CSS 繪製的按鈕。

這份文件列出《看板娘的放置藥水舖》介面按鈕要用的素材，共 **4 張**，每一張都附上可以直接使用的完整英文 Prompt。

---

## 1. 遊戲與畫風

**遊戲簡介：** 2D 網頁放置經營遊戲。玩家經營一間奇幻世界的魔法藥水舖，畫面是「兩層樓娃娃屋剖面」：溫室、熬藥水的大釜、櫃台、看板娘「露米婭」（見習魔女）的休息室。玩家的身分是一本會說話的**魔導書**，遊戲的主選單就是這本書：深紅棕色的皮革封面、米黃色的羊皮紙書頁、金色的燙金裝飾、彩色緞帶書籤。

**按鈕的角色：** 書頁上有大量的按鈕：
- **購買按鈕**：買升級、種子、禮物，上面是金幣圖示和價格數字。
- **確認按鈕**：「和她互動」「太好了！」這類。
- **兌換按鈕**：用「開心度」兌換，上面是愛心圖示和數字。

目前是 CSS 畫的黃色漸層圓角框，看起來很平。希望換成**像魔導書上的黃銅／金飾片**一樣有質感的按鈕，但仍然要可愛、明亮。

**畫風：** 日式動漫風格、可愛溫馨路線。圓潤的造型、柔和的配色，像溫馨的日系奇幻手遊的介面。燭光般的暖色調，金色、奶油色、木頭棕色，搭配粉紅與藍綠色的魔法點綴。**避免**寫實的金屬反光、美式卡通、陰暗厚重。

---

## 2. 最重要的規格：可以拉長的按鈕（九宮格）

遊戲裡按鈕的**寬度會跟著文字變**：短的只有「×1」，長的有「解鎖配方與大釜」。所以遊戲會把圖切成九塊來拉伸：

```
┌────┬──────────────┬────┐
│ 角 │  上邊（拉長）  │ 角 │
├────┼──────────────┼────┤
│左邊│   中間（拉長）  │右邊│
├────┼──────────────┼────┤
│ 角 │  下邊（拉長）  │ 角 │
└────┴──────────────┴────┘
```

* **四個角（各 25%）**：原樣顯示，**所有的裝飾都要畫在四個角裡**（例如角上的小寶石、捲草花紋、鉚釘）。
* **上邊、下邊**：會被**左右拉長**，所以從左到右必須**完全一樣**：只能是一條均勻的邊框，不能有花紋、寶石、漸層變化。
* **左邊、右邊**：會被**上下拉長**，所以從上到下必須完全一樣。
* **中間**：會被拉長而且上面要放**深棕色的文字與小圖示**，所以要**乾淨、均勻、偏亮**，只能有上下方向的柔和漸層（上亮下稍暗），不能有花紋、圖案、亮點。

**畫布與構圖：**
* PNG，**768×256**（3:1），**四周透明**（去背後）。
* 按鈕本體**幾乎填滿畫布**：四周只留 **8px** 左右的透明邊。遊戲會依這個比例切九宮格，所以**每張的按鈕外框位置要一樣**。
* 按鈕是**圓角長方形**，圓角大約是高度的 30%。
* 背景：純綠色（`#00FF00`），之後會去背。

**描邊：** 外面一圈**深棕色描邊**（`#5A3A1A` 左右），和書頁上其他圖示一致，在米黃色的紙上要清楚。

---

## 3. 素材清單

| 資源 ID | 內容 | 用在哪裡 |
|---|---|---|
| `ui_btn_gold` | 金色按鈕（一般） | 購買按鈕、確認按鈕、右上角的「魔導書」按鈕 |
| `ui_btn_gold_pressed` | 金色按鈕（按下去） | 同上，按住的時候 |
| `ui_btn_pink` | 粉紅按鈕（一般） | 用開心度兌換的按鈕 |
| `ui_btn_pink_pressed` | 粉紅按鈕（按下去） | 同上，按住的時候 |

「不能按」（錢不夠）的樣子由遊戲把圖變灰，不需要另外畫。

**一致性：** 4 張要是**同一個造型、同一個外框位置**，只換顏色與按下的狀態。建議先生成 `ui_btn_gold`，挑好之後當參考圖，用圖片編輯的方式改出其他三張（「同樣的構圖，只換顏色／只改成按下去的樣子」）。

---

## 4. 各按鈕說明與 Prompt

### `ui_btn_gold` — 金色按鈕（一般）
* 像魔導書封面上的**黃銅金飾片**：溫暖明亮的金黃色，上半部亮、下半部稍深（`#F7DF94` → `#D9A441` 的感覺），上緣有一條細細的高光。
* 外框是一圈稍深的古金色邊，最外面是深棕色描邊。
* **四個角**各有一小顆裝飾（例如小小的藍綠色圓寶石或金色捲草），角以外的邊與中間保持乾淨。

```
Japanese anime style, kawaii and cozy 2D fantasy game UI, a single wide rounded-rectangle button plate like a polished brass ornament from a magic grimoire cover, warm bright golden-yellow face with a soft vertical gradient from pale gold at the top to deeper gold at the bottom, a thin soft highlight along the top edge, an antique-gold inner rim and a dark-brown outer outline, a tiny mint-teal round gem ornament in each of the four corners only. The top, bottom, left and right edges are plain and perfectly uniform, the center area is clean and flat with no patterns so text can be placed on it. 3:1 wide composition, the button fills almost the whole canvas with a small even margin, front view, flat UI asset, plain solid pure green background (#00FF00), no text, no icons, no watermark, no drop shadow.
```

### `ui_btn_gold_pressed` — 金色按鈕（按下去）
* 和 `ui_btn_gold` **完全同一個造型與外框位置**，但像被按下去：金色整體**暗一階**、高光從上緣移到**下緣**，中間有一點點內凹的陰影。

```
The same wide golden brass button plate as the reference, identical shape, size, outline and corner gems, identical position on the canvas, but shown in its pressed-down state: the golden face is one step darker, the highlight moves from the top edge to the bottom edge, a subtle inner shadow along the top as if pushed in. Edges plain and uniform, center clean and flat. 3:1 wide composition, flat UI asset, plain solid pure green background (#00FF00), no text, no icons, no watermark, no drop shadow.
```

### `ui_btn_pink` — 粉紅按鈕（一般）
* 和 `ui_btn_gold` **同一個造型**，按鈕面改成**溫柔的粉紅色**（`#FFD0E0` → `#FF8FB8` 的感覺），內框是玫瑰金，四個角的寶石改成**小愛心**或粉紫色寶石。

```
The same wide button plate as the reference, identical shape, size, outline and position on the canvas, recolored: a soft sweet pink face with a vertical gradient from pale pink at the top to warm pink at the bottom, a thin soft highlight along the top edge, a rose-gold inner rim and a dark-brown outer outline, a tiny heart-shaped pink gem ornament in each of the four corners only. Edges plain and uniform, center clean and flat with no patterns. 3:1 wide composition, flat UI asset, plain solid pure green background (#00FF00), no text, no icons, no watermark, no drop shadow.
```

### `ui_btn_pink_pressed` — 粉紅按鈕（按下去）
* 和 `ui_btn_pink` 同一個造型，按下去的樣子（暗一階、高光移到下緣、上方一點內凹陰影）。

```
The same wide pink button plate as the reference, identical shape, size, outline and heart corner gems, identical position on the canvas, but shown in its pressed-down state: the pink face is one step darker, the highlight moves from the top edge to the bottom edge, a subtle inner shadow along the top as if pushed in. Edges plain and uniform, center clean and flat. 3:1 wide composition, flat UI asset, plain solid pure green background (#00FF00), no text, no icons, no watermark, no drop shadow.
```

---

## 5. 驗收重點

交件前請這樣檢查：

- [ ] 用圖片軟體把按鈕**左右拉長到 6:1、壓短到 1.5:1**（只拉中間，四個角不動）：邊框和中間都不會出現花紋被拉歪、斷掉的情況。
- [ ] 在按鈕中間打上深棕色的字「1.50K」「解鎖配方與大釜」，字很好讀。
- [ ] 4 張疊在一起時，按鈕的外框位置完全重合（按下去時按鈕不會跳動）。
- [ ] 縮小到高度 **36px** 時，四角的裝飾還看得出來、但不搶眼。
- [ ] 去背乾淨，圓角外面是透明的。

## 6. 生成進度檢查表

- [ ] `ui_btn_gold`
- [ ] `ui_btn_gold_pressed`
- [ ] `ui_btn_pink`
- [ ] `ui_btn_pink_pressed`

# 新服裝「花園精靈圍裙裝」的美術素材

補充 [`ArtAssetPrompts.md`](ArtAssetPrompts.md)。新的一套服裝：**花園精靈圍裙裝**（開心度兌換 25 點；指派在溫室時植物生長速度 +100%）。
沒有正式圖時，場景裡會用預設服裝的圖、兌換清單裡是佔位色塊。

生成後一樣放進 `IdlePotionShop_ArtAssets/`，再執行 `python3 scripts/import_art.py`。

---

## 服裝描述（共用）

```
a pastel sage-green gardener dress with puff sleeves and a cream linen apron with big pockets full of seed packets, a wreath crown of small pink and white flowers instead of the witch hat, a tiny sprout hairpin, brown lace-up boots, a small watering can charm hanging from her belt
```

## 1. Q 版（場景用，★★，共 6 張）

和其他服裝一樣，**上傳預設服裝的同一張圖**用圖片編輯，只換衣服，姿勢與方向（朝左）不變：

```
Same character, same pose, same framing, same art style and background. Change only the outfit to: {服裝描述}
```

| 資源 ID | 上傳的原圖 | 用在哪裡 |
|---|---|---|
| `lumia_chibi_gardener_idle` | `lumia_chibi_idle` | 待機、兌換清單與服裝按鈕的圖示 |
| `lumia_chibi_gardener_walk` | `lumia_chibi_walk` | 走路 |
| `lumia_chibi_gardener_back` | `lumia_chibi_back` | 站在盆栽／大釜前工作（背影） |
| `lumia_chibi_gardener_drag` | `lumia_chibi_drag` | 被拎起來 |
| `lumia_chibi_gardener_sleep` | `lumia_chibi_sleep` | 在坐墊上睡覺（花冠滑到一邊） |
| `lumia_chibi_gardener_tired_walk` | `lumia_chibi_tired_walk` | 疲勞時走路 |

## 2. 服裝立繪（互動視窗，★）

上傳 `portrait_lumia_base`：

```
Same character, same pose, same framing and background. Change only the outfit to: {服裝描述}. Expression: gentle happy smile.
```

* `portrait_lumia_gardener`（比例 2:3）

再上傳 `portrait_lumia_gardener`，做 5 張表情差分（和其他服裝一樣，Prompt 同 `ArtAssetPrompts.md` 2.3 的表情差分）：

```
Same character, same pose, same outfit, same framing and background. Only change the facial expression and small details: {EXPRESSION}
```

| 資源 ID | 觸發 | {EXPRESSION} |
|---|---|---|
| `portrait_lumia_gardener_happy` | 預設開啟、一般對話 | big bright open-mouth smile, sparkling eyes |
| `portrait_lumia_gardener_headpat` | 摸頭 | eyes closed blissfully like a content cat, shoulders slightly raised and neck tucked in, soft blush, small happy smile |
| `portrait_lumia_gardener_poke` | 戳臉頰 | puffed-up cheeks pretending to be angry, one eye peeking, holding back a smile, light blush |
| `portrait_lumia_gardener_panic` | 狂戳 | panicked dot-shaped eyes, flailing hands raised in the air, sweat drops, mouth open in a flustered yell, leaning back |
| `portrait_lumia_gardener_shy` | 互動能量用完 | shy embarrassed smile, blushing, waving one hand in front of her as if saying "that's enough" |

## 生成進度檢查表

- [x] Q 版 6 張：idle、walk、back、drag、sleep、tired_walk
- [x] 服裝立繪 1 張＋表情差分 5 張

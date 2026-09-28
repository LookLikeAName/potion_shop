# 美術素材製作需求：劇情 CG（序章、三封信的感想）

> **狀態：已完成**（2026-09-28 匯入遊戲）。

這份文件列出《看板娘的放置藥水舖》主線劇情要用的 CG，共 **4 張**，每一張都附上可以直接使用的完整英文 Prompt。

---

## 1. 遊戲與畫風

**遊戲簡介：** 2D 網頁放置經營遊戲。見習魔女「露米婭」從學院畢業，回到從小長大的魔法藥水工坊，發現撫養她長大的「老師」不見了，只留下一本會說話的**魔導書**（老師把自己的意識留在書裡）。她當起代理店長，和魔導書一起經營藥水舖。玩家的身分就是這本魔導書。

**劇情大綱（這 4 張 CG 的位置）：**
1. **序章**：露米婭回到工坊，找到會說話的魔導書，接下工坊。
2. **第一封信**：老師從「旅途中」寄來的信，回憶當年把流落街頭的露米婭撿回家。溫馨、懷念。
3. **第二封信**：老師聽說工坊變得很有名，替她高興。露米婭燃起幹勁，要讓工坊成為全世界最有名的藥水舖。
4. **第三封信**：真相揭曉——老師其實已經過世，那些旅行的信都是生前預先寫好的，魔導書是老師意識的仿造。露米婭哭了一整晚，最後擦乾眼淚，堅定地許下承諾。

**畫風：** 日式動漫風格、可愛溫馨路線，高品質的主視覺插畫。柔和的賽璐璐上色、溫暖的燈光。即使是悲傷的場面也要保持溫柔、不陰暗恐怖。**避免**寫實、美式卡通、血腥或過度陰沉。

**規格：**
* 比例 **16:9**，遊戲內以 1920×1080 顯示（生成 1792×1008 以上即可）。
* 滿版插畫，**不需要去背**。
* 畫面裡**不要有任何文字**（信紙上的字寫成看不清楚的筆跡線條即可）、不要浮水印。

---

## 2. 角色與道具設定（每張都一樣）

**露米婭 (Lumia)：** 20 歲的成年女性見習魔女、鍊金術師。蓬鬆及肩的**銅橘色頭髮**，頭頂一根翹起的呆毛；大大閃亮的**紫水晶色眼睛**，臉上淡淡的雀斑。戴一頂**歪歪的深藍綠色小魔女帽**，帽子上插著一枝紅色葉片。奶油色泡泡袖襯衫、棕色皮革馬甲背心、深藍綠色短披風，披風用金色星星扣固定。

**魔導書（老師）：** 一本很厚的古老魔導書，**深紅棕色的皮革封面**，四個角有**金色的燙金花紋**，封面中央有一顆**小小的紫色寶石**。會說話時，書頁和寶石會發出柔和的金色光芒。

**工坊：** 兩層樓的溫馨魔法藥水舖。木頭櫃台、牆上擺滿發光的彩色藥水瓶、冒著泡泡的大釜、乾燥花草從天花板垂下，燈籠暖黃色的光。

> 建議：如果你手邊有露米婭的角色參考圖，生成時一起附上，讓臉和服裝保持一致。

---

## 3. 素材清單

| 資源 ID | 場景 | 氣氛 |
|---|---|---|
| `cg_opening` | 序章：露米婭發現會說話的魔導書 | 驚訝、有點好笑、充滿希望 |
| `cg_letter1` | 第一封信的感想：摺好信，輕撫魔導書 | 溫柔、懷念 |
| `cg_letter2` | 第二封信的感想：握緊拳頭、充滿幹勁 | 明亮、熱血 |
| `cg_letter3` | 第三封信的感想：哭過之後，堅定地面對魔導書 | 悲傷但溫柔、堅定 |

---

## 4. 各張說明與 Prompt

### `cg_opening` — 序章：會說話的書

* 早晨，灰塵在陽光裡飄著，工坊有點凌亂、好像很久沒人整理。地上倒著幾個空的藥水瓶。
* 露米婭嚇到**跌坐在地上**，雙手撐地往後仰，眼睛睜大、嘴巴張開，魔女帽歪到一邊。旁邊放著她從學院帶回來的旅行皮箱。
* 櫃台上那本魔導書**自己打開、發出金色的光**，光芒中浮現發光的符文，好像正在對她說話。

```
Japanese anime style, kawaii and heartwarming, 2D fantasy illustration, high quality key visual, soft cel shading with gentle gradients, warm morning sunlight with floating dust motes. Lumia, a 20-year-old adult woman apprentice witch alchemist, messy shoulder-length copper-orange hair with one springy ahoge strand, cute Japanese anime-style face with big sparkling amethyst-purple eyes, light freckles, small crooked dark-teal witch hat with a red leafy sprig (knocked askew), cream puff-sleeve blouse, brown leather corset vest, short dark-teal cape with a gold star clasp. Inside a slightly dusty, messy cozy magic potion shop, a few empty potion bottles tipped over on the wooden floor, a travel suitcase beside her. Lumia has fallen onto her bottom in surprise, leaning back on her hands, eyes wide and mouth open in comic shock. On the wooden shop counter, a thick ancient grimoire with a deep red-brown leather cover, gold filigree corners and a small violet gem has flipped open by itself, glowing with warm golden light, glowing magic runes rising from its pages as if it is talking to her. Funny, magical and hopeful mood. No text, no watermark.
```

### `cg_letter1` — 第一封信：我回來了，老師

* 傍晚，工坊已經慢慢上了軌道：架上擺滿藥水，燈籠亮著溫暖的光。
* 露米婭站在櫃台邊，**一隻手把信小心地摺好**，另一隻手**輕輕撫摸著魔導書的封面**。
* 表情是溫柔的微笑，眼角帶著一點懷念的淚光，像在小聲說「我回來了」。旁邊放著拆開的信封和封蠟。

```
Japanese anime style, kawaii and heartwarming, 2D fantasy illustration, high quality key visual, soft cel shading, warm golden evening lantern light, gentle nostalgic atmosphere. Lumia, a 20-year-old adult woman apprentice witch alchemist, messy shoulder-length copper-orange hair with one springy ahoge strand, cute Japanese anime-style face with big sparkling amethyst-purple eyes, light freckles, small crooked dark-teal witch hat with a red leafy sprig, cream puff-sleeve blouse, brown leather corset vest, short dark-teal cape with a gold star clasp. Standing at the wooden counter of a cozy, well-run magic potion shop with shelves full of glowing colorful potions. With one hand she carefully folds a handwritten letter, with the other hand she softly strokes the cover of a thick ancient grimoire with a deep red-brown leather cover, gold filigree corners and a small violet gem that glows faintly in response. A tender smile, eyes slightly teary with fond memories. An opened envelope with a red wax seal lies on the counter. No readable text, no watermark.
```

### `cg_letter2` — 第二封信：要成為全世界最有名的工坊

* 白天，陽光灑進熱鬧的工坊，大釜冒著彩色的泡泡和蒸氣。
* 露米婭**雙手緊緊握拳**舉在胸前，眼睛閃閃發亮、充滿幹勁，轉頭看向大釜，披風揚起。
* 讀完的信放在櫃台上，魔導書在旁邊微微發光，像在替她加油。

```
Japanese anime style, kawaii and heartwarming, 2D fantasy illustration, high quality key visual, soft cel shading, bright cheerful daylight streaming in, energetic and uplifting mood. Lumia, a 20-year-old adult woman apprentice witch alchemist, messy shoulder-length copper-orange hair with one springy ahoge strand, cute Japanese anime-style face with big sparkling amethyst-purple eyes full of determination, light freckles, small crooked dark-teal witch hat with a red leafy sprig, cream puff-sleeve blouse, brown leather corset vest, short dark-teal cape with a gold star clasp swishing with her movement. In a busy cozy magic potion shop, a large cauldron bubbling with colorful sparkling steam. Lumia clenches both fists in front of her chest, fired up, turning toward the cauldron with a confident grin, sparkles of motivation around her. A read letter lies on the wooden counter next to a thick ancient grimoire with a deep red-brown leather cover, gold filigree corners and a small violet gem, glowing warmly as if cheering her on. No readable text, no watermark.
```

### `cg_letter3` — 第三封信：這是我的使命

* 深夜，工坊裡只剩一根蠟燭和窗外的月光，藍紫色的夜晚配上蠟燭暖黃的光。
* 露米婭哭了很久，**眼睛紅腫**，臉頰上還有淚痕，但已經擦乾眼淚、**抬起頭、眼神堅定**。
* 她站在櫃台前，**把有淚痕的信緊緊抱在胸前**，面對著魔導書。魔導書靜靜地發出溫柔的光，像在守護她。
* 氣氛是悲傷但溫柔，不要陰暗恐怖。

```
Japanese anime style, kawaii and heartwarming, 2D fantasy illustration, high quality key visual, soft cel shading, late night, cool blue-violet moonlight through the window mixed with the warm glow of a single candle, bittersweet, tender and quietly determined mood, not dark or scary. Lumia, a 20-year-old adult woman apprentice witch alchemist, messy shoulder-length copper-orange hair with one springy ahoge strand, cute Japanese anime-style face with big amethyst-purple eyes, red and slightly swollen from crying, faint tear streaks on her cheeks, light freckles, small crooked dark-teal witch hat with a red leafy sprig, cream puff-sleeve blouse, brown leather corset vest, short dark-teal cape with a gold star clasp. Standing in front of the wooden counter of a quiet cozy potion shop at night, she holds a tear-stained handwritten letter tightly against her chest, lifting her face with a firm, resolute gaze. On the counter, a thick ancient grimoire with a deep red-brown leather cover, gold filigree corners and a small violet gem glows with a soft gentle golden light, as if watching over her. No readable text, no watermark.
```

---

## 5. 驗收重點

- [ ] 露米婭的髮色（銅橘色）、眼睛（紫水晶色）、帽子與服裝和設定一致，4 張看起來是同一個人。
- [ ] 魔導書的樣子一致：深紅棕色皮革、金色角飾、紫色寶石。
- [ ] 畫面裡沒有看得懂的文字（信紙上只有筆跡線條）。
- [ ] `cg_letter3` 悲傷但溫柔，最後的表情是**堅定**，不是崩潰大哭。
- [ ] 16:9、滿版、沒有浮水印。

## 6. 生成進度檢查表

- [x] `cg_opening`
- [x] `cg_letter1`
- [x] `cg_letter2`
- [x] `cg_letter3`

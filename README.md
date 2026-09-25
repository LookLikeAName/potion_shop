# 看板娘的放置藥水舖 (Idle Potion Shop & Mascot Girl)

網頁放置點擊遊戲。設計文件：[企劃書](<Idle Potion Shop & Mascot Girl(Game Design Document).md>)｜[美術 Prompt](ArtAssetPrompts.md)

## 開發環境（WSL）

專案在 WSL (Ubuntu-20.04) 中開發，Node.js 22 由 nvm 管理。

```bash
cd /mnt/h/files/AI/vibe_coding/Idle_potion_shop
npm install        # 第一次
npm run dev        # 開發伺服器 → http://localhost:5173（Windows 瀏覽器可直接開）
npm test           # 單元測試
npm run typecheck  # 型別檢查
npm run balance    # 平衡模擬（機器人玩 180 分鐘），報告寫到 docs/balance-report.md
npm run build      # 產出 dist/（靜態檔，可放到任何網頁空間）
```

手機測試：開發伺服器啟動後會顯示 Network 位址，手機連同一個 Wi-Fi 開啟即可（可能需要設定 WSL 的連接埠轉發）。

## 專案結構

```
src/
  game/          純遊戲邏輯（不碰畫面，可測試）
    config/      平衡數值與設定表：植物、配方、升級
    sim.ts       核心模擬 tick
    commands.ts  玩家指令與購買
    stats.ts     加成疊加計算（企劃書第 5 章）
    offline.ts   離線結算
    save.ts      存檔、遷移、匯出匯入
    game.ts      執行期：真實時間推進、背景補算、點擊上限
  engine/        分頁鎖
  render/        PixiJS 場景（layout.ts 是所有座標）
  ui/            Preact 介面（魔導書面板、資源列、視窗）
  assets/
    manifest.ts  美術資源清單與佔位圖設定
    art/         ← 正式美術放這裡：art/<分類>/<資源ID>.png
tests/           Vitest 單元測試
```

## 換上正式美術

1. 把去背後的原圖依照 `ArtAssetPrompts.md` 的資源 ID 命名，放進 `IdlePotionShop_ArtAssets/`（任何子資料夾都可以）。
2. 在 WSL 執行匯入腳本，會縮到遊戲需要的大小並轉成 WebP，輸出到 `src/assets/art/`：
   ```bash
   python3 scripts/import_art.py
   ```
3. 頁面會自動重新整理並取代佔位圖。

- 新角色/顧客圖要在 `src/assets/manifest.ts` 標明原圖面向（`facing`：1 朝右、-1 朝左）。
- 換了大釜圖要重新量鍋口位置（`src/render/scene.ts` 的 `RIM`）。
- 換了背景要調整 `src/render/layout.ts` 的座標。

## 目前進度

**M1 核心迴圈** ✅
- [x] 盆栽（等級制、里程碑外觀、改種）、種植、雨雲、花妖精、浮空盆栽
- [x] 大釜（批量、左到右分配）、火蜥蜴、配方解鎖
- [x] 顧客排隊、結帳、急單
- [x] 存檔、自動存檔、匯出匯入、離線結算與報告、背景分頁補算
- [x] 單一分頁鎖、手機橫向版面、正式美術接入、紙娃娃劇角色動畫

**M2 升級系統** ✅
- [x] 溫室：星銀澆水壺、附魔園藝剪
- [x] 大釜：隱形僕役湯勺、龍息風箱（連擊 → 極速沸騰）、雙口冷凝管、長按拖曳排序
- [x] 櫃台：招財貓頭鷹、魔法招牌、迷幻擴香儀、叫賣鈴鐺、慷慨的酒鬼體質、商會收購箱（可設保留量）
- [x] 特殊：過勞精靈工會合約（離線自動點擊）
- [x] 買下的升級會以道具出現在場景裡
- [x] 平衡模擬腳本 `npm run balance`

**M3 看板娘** ✅
- [x] 露米婭指派（長按拖曳或按鈕）：溫室、大釜區、櫃台、休息室、自由活動
- [x] 體力與疲勞、自動休息、跨樓層魔法瞬移
- [x] 立繪互動：摸頭、戳臉頰、狂戳、每日獎勵、互動能量
- [x] 開心度兌換 Tier 1–4：家具、服裝、特權天賦、劇情事件（CG 待 M5）
- [x] 成就、狂熱時刻、睡衣離線加倍、心電感應 72 小時上限

**下一步 M4：** 數字彈跳與粒子強化、隨機事件（土豪勇者、尋寶地精、星塵朝露、大釜爆炸）、焦晶

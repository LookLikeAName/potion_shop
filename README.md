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

把 Grok Imagine 生成、去背後的圖片依照 `ArtAssetPrompts.md` 的資源 ID 命名，放進 `src/assets/art/` 任一子資料夾，頁面會自動重新整理並取代佔位圖。換上正式背景後，通常需要微調 `src/render/layout.ts` 裡的座標。

## 目前進度（M1 核心迴圈）

- [x] 盆栽（等級制、里程碑外觀）、種植、雨雲、花妖精
- [x] 大釜（批量、左到右分配）、火蜥蜴、配方解鎖
- [x] 顧客排隊、結帳、急單
- [x] 櫃台升級：招財貓頭鷹、魔法招牌、迷幻擴香儀
- [x] 存檔、自動存檔、匯出匯入、離線結算與報告、背景分頁補算
- [x] 單一分頁鎖、手機橫向版面
- [ ] M2：其餘升級（澆水壺、園藝剪、湯勺、風箱、冷凝管、鈴鐺、酒鬼、收購箱、工會合約）、拖曳大釜、平衡模擬腳本

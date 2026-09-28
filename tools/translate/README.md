# 翻譯工具

把遊戲文字從繁體中文翻成日文、英文。呼叫任何 **OpenAI 相容** 的 `/chat/completions` API（預設 Gemini），讀原文語言檔、寫出同樣格式的譯文。只用 Python 標準函式庫（3.8 以上），不用安裝套件。

## 文字放在哪裡

```
src/locales/zh-TW/ui.json        介面
src/locales/zh-TW/items.json     植物、藥水、升級、禮物、兌換、成就、服裝
src/locales/zh-TW/events.json    突發事件
src/locales/zh-TW/dialogue.json  露米婭的台詞、劇情、來信
src/locales/ja/…、src/locales/en/…  譯文（檔名、key 和原文一樣，由這個工具產生）
```

- 值是字串，或字串陣列（隨機台詞、多行劇情）。
- `{name}` 是變數，翻譯時要原樣保留。
- 英文可以用 `{n|單數|複數}` 選字，例如 `"{n} {n|potion|potions}"`。
- 遊戲裡缺少的譯文會自動顯示中文。有譯文檔的語言會出現在設定頁的「語言」選單。

## 準備

1. 申請 API 金鑰。Gemini 的金鑰在 Google AI Studio 申請。
2. 把金鑰放進環境變數，預設名稱是 `GEMINI_API_KEY`：
   - PowerShell：`$env:GEMINI_API_KEY = "…"`
   - bash：`export GEMINI_API_KEY=…`

   金鑰不會寫進任何檔案；也可以在網頁介面輸入，只存在記憶體裡。
3. 換服務或模型時，在網頁的「API 與翻譯設定」修改，或建立 `tools/translate/config.json`：

```json
{ "base_url": "https://generativelanguage.googleapis.com/v1beta/openai/", "model": "gemini-2.5-flash", "api_key_env": "GEMINI_API_KEY" }
```

| 服務 | base_url |
|---|---|
| Gemini | `https://generativelanguage.googleapis.com/v1beta/openai/` |
| OpenAI | `https://api.openai.com/v1` |
| OpenRouter | `https://openrouter.ai/api/v1` |
| DeepSeek | `https://api.deepseek.com/v1` |

其他設定：

- `batch_size` / `batch_chars`：每批送多少段、多少字。
- `concurrency`：同時送出幾個請求。免費額度常碰到速率限制時，改成 1。
- `json_mode`：服務不支援 `response_format` 時改成 false。

## 使用

網頁介面（推薦）：

```bash
python tools/translate/gui.py
```

會打開 `http://127.0.0.1:8765`：

- 選語言，按「翻譯待處理的」就會翻譯所有沒翻的、原文改過的、格式錯的段落。
- 表格並排顯示原文與譯文，可以直接修改。改完離開輸入框就存檔。
- 人工修改的段落會自動**鎖定**，之後自動翻譯不會覆蓋。
- 原文改過時，那一段會標成「原文已改」：
  - 沒鎖定的，下次自動重翻。
  - 鎖定的，要自己決定：按「重翻」，或按「保留」維持目前的譯文。
- 可以勾選幾段一起重翻，也可以用搜尋、檔案、狀態篩選。

命令列：

```bash
python tools/translate/translate.py ja en              # 翻譯待處理的
python tools/translate/translate.py ja --dry-run       # 只列出要翻哪些、分幾批
python tools/translate/translate.py ja --keys "event.*" --all   # 重翻符合的 key
python tools/translate/translate.py ja en --check      # 只檢查譯文（變數、陣列長度、有沒有漏翻）
```

## 翻得更好

| 檔案 | 內容 | 怎麼送給模型 |
|---|---|---|
| `glossary.json` | 術語表（人名、道具、介面用語的固定譯名） | 只送出這批原文裡出現的術語 |
| `style.json` | 各語言的語氣與風格（露米婭怎麼說話、介面要簡短…） | 每次都送 |
| `context.json` | 依 key 的樣式附加說明（這段文字出現在哪裡、長度限制） | 符合樣式的 key 才附加 |

改了術語表或風格之後，用網頁勾選相關段落重翻，或用 `--all` 全部重翻。鎖定的段落不會被動到。

模型的回覆會先驗證，不合格的段落自動再翻，最多兩次。驗證項目：

- key 齊全
- 變數一樣
- 陣列長度一樣
- 沒有空白
- 英文裡沒有中日文

還是不合格的，會在網頁上標成「格式錯」。

## 翻譯紀錄

`tools/translate/state/<語言>.json` 記錄每一段的原文雜湊、是 AI 還是人工翻的、有沒有鎖定。這個檔要跟著語言檔一起提交，才知道哪些原文改過。

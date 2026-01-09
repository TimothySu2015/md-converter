# Markdown 轉換器 (PDF / DOCX)

將 Markdown 檔案或 HackMD 網址轉換為專業格式的 **PDF** 或 **DOCX** 文件。

## 快速開始

```bash
# 安裝依賴
npm install

# 轉換為 PDF 和 DOCX
node convertAll.js input.md

# 僅轉換 PDF
node convertAll.js input.md --format pdf

# 僅轉換 DOCX
node convertAll.js input.md --format docx
```

---

## 功能特色

| 功能 | PDF | DOCX |
|------|:---:|:----:|
| 繁體中文支援 | ✓ | ✓ |
| Mermaid 圖表 | ✓ | ✓ |
| 程式碼語法高亮 + 行號 | ✓ | ✓ |
| 自動目錄 | ✓ | ✓ |
| 智慧分頁（圖片不跨頁） | ✓ | - |
| 封面頁 | - | ✓ |
| 頁首頁尾 | ✓ | ✓ |
| 表格樣式 | ✓ | ✓ |
| 網址圖片（自動下載嵌入） | ✓ | ✓ |
| HackMD 語法 (`:::info`, `==標記==`) | - | ✓ |
| 自訂樣式 | ✓ | ✓ |

---

## 使用指令

```bash
node convertAll.js <input.md> [選項]
```

### 選項

| 選項 | 說明 |
|------|------|
| `--format pdf` | 僅輸出 PDF |
| `--format docx` | 僅輸出 DOCX |
| `--format both` | 同時輸出 PDF 和 DOCX（預設） |
| `--skip-mermaid` | 跳過 Mermaid 預處理（無圖表時可加速） |
| `--skip-code` | 跳過程式碼區塊轉圖片（DOCX 將使用純文字程式碼） |
| `--keep-images` | 保留中間產生的圖檔目錄（預設會自動清理） |
| `--verbose` | 顯示詳細輸出 |

### 使用範例

```bash
# 轉換文件（自動處理 Mermaid 和程式碼區塊）
node convertAll.js README.md

# 僅轉換 PDF（速度較快）
node convertAll.js document.md --format pdf

# 僅轉換 DOCX
node convertAll.js guide.md --format docx

# 無 Mermaid 圖表時加速
node convertAll.js report.md --skip-mermaid

# 保留中間圖檔（用於除錯或重複使用）
node convertAll.js doc.md --keep-images

# 顯示完整處理過程
node convertAll.js doc.md --verbose
```

---

## 自動處理流程

```
┌─────────────┐    ┌─────────────────┐    ┌─────────────────┐    ┌────────────┐
│  原始 MD    │ -> │ Mermaid → SVG   │ -> │ Code → PNG      │ -> │ PDF/DOCX   │
│  input.md   │    │  (自動檢測)     │    │  (自動檢測)     │    │  最終輸出  │
└─────────────┘    └─────────────────┘    └─────────────────┘    └────────────┘
```

轉換後產生的檔案：

```
input.md              # 原始檔案
input.pdf             # PDF 輸出
input.docx            # DOCX 輸出
```

> **注意**：中間產生的圖檔目錄（`input_IMG/`、`input_IMG_CODE/`）會在轉換完成後**自動清理**。
> 如需保留這些圖檔，請使用 `--keep-images` 選項。

---

## 自訂樣式

樣式設定檔位於 `styles/default.js`，PDF 和 DOCX 共用相同樣式。

### 可調整項目

| 類別 | 說明 |
|------|------|
| `headings` | H1-H6 字體大小、顏色、間距 |
| `table` | 表頭顏色、邊框、交替列背景 |
| `codeBlock` | 程式碼區塊顏色、行號顏色 |
| `paragraph` | 文字顏色、行內程式碼背景 |
| `list` | 項目符號樣式 |

### 樣式範例

```javascript
// styles/default.js
module.exports = {
  headings: {
    h1: { fontSize: 64, color: '1f2328' },  // 32pt
    h2: { fontSize: 48, color: '1f2328' }   // 24pt
  },
  table: {
    header: { backgroundColor: 'f6f8fa', text: { bold: true } },
    alternateRow: { enabled: true, backgroundColor: 'f9f9f9' }
  }
};
```

### 單位說明

| 類型 | 換算 | 範例 |
|------|------|------|
| fontSize | 半點 | 24 = 12pt |
| spacing | twips | 240 = 12pt |
| color | HEX（不含 #） | `1f2328` |

---

## 系統需求

- Node.js 16+
- npm 套件（執行 `npm install` 自動安裝）
- 網路連線（載入字型和 CDN）

---

## 疑難排解

| 問題 | 解決方案 |
|------|----------|
| Mermaid 圖表渲染失敗 | 工具會自動預處理，若仍失敗請檢查 Mermaid 語法 |
| 程式碼行號不顯示 | 確認使用 `convertAll.js`（會自動預處理） |
| 圖片不顯示 | 確認圖片路徑正確（支援相對路徑） |
| DOCX 目錄頁碼錯誤 | 開啟 Word 後按 **F9** 更新 |
| 中文亂碼 | 確認系統有 Microsoft JhengHei 或 Noto Sans TC 字型 |

---

## 進階使用

如需個別執行各步驟（除錯或特殊需求）：

```bash
# 1. 僅預處理 Mermaid
node lib/mermaidToImage.js input.md
# 輸出：input_IMG.md

# 2. 僅預處理程式碼區塊
node lib/codeBlockToImage.js input_IMG.md
# 輸出：input_IMG_CODE.md

# 3. 僅轉換 PDF（從 HackMD 網址）
node lib/convert.js https://hackmd.io/@user/note-id

# 4. 僅轉換 DOCX
node lib/mdToDocxComplete.js input_IMG_CODE.md
```

### PDF 分頁參數（環境變數）

```bash
# 停用 H2 自動分頁
PAGE_BREAK_FORCE_H2=false node convertAll.js doc.md --format pdf

# 啟用除錯模式
PAGE_BREAK_DEBUG=true node convertAll.js doc.md --format pdf
```

| 變數 | 預設值 | 說明 |
|------|--------|------|
| `PAGE_BREAK_FORCE_H2` | true | H2 標題前強制分頁 |
| `PAGE_BREAK_LARGE_CONTENT` | 900 | 大型內容閾值（px） |
| `PAGE_BREAK_DEBUG` | false | 除錯模式 |

---

## 授權

MIT License

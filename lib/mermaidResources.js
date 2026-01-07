const fs = require('fs');
const path = require('path');

// 快取變數（undefined 表示尚未初始化，null 表示找不到本地檔案）
let _mermaidScriptCache = undefined;

/**
 * 取得本地 Mermaid.js 檔案內容（含快取）
 * @param {boolean} throwIfNotFound - 找不到時是否拋出錯誤（預設 false）
 * @returns {string|null} Mermaid.js 內容，找不到則回傳 null
 */
function getMermaidScript(throwIfNotFound = false) {
  // 已快取則直接回傳
  if (_mermaidScriptCache !== undefined) {
    if (throwIfNotFound && _mermaidScriptCache === null) {
      throw new Error('找不到 Mermaid.js，請確認已安裝 mermaid 套件');
    }
    return _mermaidScriptCache;
  }

  // 嘗試使用 require.resolve 定位 mermaid 套件（更穩健）
  try {
    const mermaidPkg = require.resolve('mermaid/package.json');
    const mermaidDir = path.dirname(mermaidPkg);
    const mermaidPath = path.join(mermaidDir, 'dist', 'mermaid.min.js');
    if (fs.existsSync(mermaidPath)) {
      _mermaidScriptCache = fs.readFileSync(mermaidPath, 'utf8');
      return _mermaidScriptCache;
    }
  } catch (e) {
    // 忽略錯誤，繼續嘗試 fallback 路徑
  }

  // Fallback: 嘗試硬編碼路徑
  const fallbackPath = path.join(__dirname, '..', 'node_modules', 'mermaid', 'dist', 'mermaid.min.js');
  if (fs.existsSync(fallbackPath)) {
    _mermaidScriptCache = fs.readFileSync(fallbackPath, 'utf8');
    return _mermaidScriptCache;
  }

  // 標記為已檢查但不存在
  _mermaidScriptCache = null;

  if (throwIfNotFound) {
    throw new Error('找不到 Mermaid.js，請確認已安裝 mermaid 套件');
  }

  return null;
}

/**
 * 取得 Mermaid script tag（用於 HTML 嵌入）
 * 優先使用本地，失敗則回傳 CDN 連結
 * @returns {string} script tag HTML
 */
function getMermaidScriptTag() {
  const localScript = getMermaidScript();
  if (localScript) {
    return `<script>${localScript}</script>`;
  }
  return `<script src="https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.min.js"></script>`;
}

module.exports = { getMermaidScript, getMermaidScriptTag };

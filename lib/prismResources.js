const fs = require('fs');
const path = require('path');

// 快取變數（undefined 表示尚未初始化）
let _prismCache = undefined;

/**
 * 取得 PrismJS 資源 (優先讀取本地，失敗回傳 CDN)
 * 結果會被快取，避免重複讀取檔案
 * @returns {object} { head: string, body: string }
 */
function getPrismHtmlTags() {
  // 已快取則直接回傳
  if (_prismCache !== undefined) {
    return _prismCache;
  }

  try {
    // 嘗試定位 prismjs（使用 package.json 確保取得套件根目錄）
    let prismBase;
    try {
      const prismPkg = require.resolve('prismjs/package.json');
      prismBase = path.dirname(prismPkg);
    } catch (e) {
      // 如果 require.resolve 失敗，嘗試手動組路徑
      prismBase = path.join(__dirname, '..', 'node_modules', 'prismjs');
      if (!fs.existsSync(prismBase)) throw new Error('PrismJS not found locally');
    }

    // 輔助函式：讀取檔案（優先讀取 .min 版本）
    const readAsset = (relPath) => {
      const ext = path.extname(relPath);
      // 防護：當 ext 為空時，不做切片
      const base = ext.length > 0 ? relPath.slice(0, -ext.length) : relPath;
      const minPath = path.join(prismBase, `${base}.min${ext}`);
      const normalPath = path.join(prismBase, relPath);

      if (fs.existsSync(minPath)) return fs.readFileSync(minPath, 'utf8');
      if (fs.existsSync(normalPath)) return fs.readFileSync(normalPath, 'utf8');
      return '';
    };

    let css = '';
    let js = '';

    // CSS
    css += readAsset('themes/prism-tomorrow.css');
    css += readAsset('plugins/line-numbers/prism-line-numbers.css');

    // JS - Core
    const rootPrism = readAsset('prism.js');
    js += (rootPrism || readAsset('components/prism-core.js')) + ';\n';

    // JS - Plugins
    js += readAsset('plugins/line-numbers/prism-line-numbers.js') + ';\n';

    // JS - Components（注意順序：部分語言依賴 clike/c）
    const components = [
      'clike', 'c',
      'javascript', 'typescript', 'python', 'java', 'csharp', 'cpp',
      'go', 'rust', 'sql', 'bash', 'json', 'yaml', 'markdown', 'http'
    ];

    for (const comp of components) {
      const content = readAsset(`components/prism-${comp}.js`);
      if (content) js += content + ';\n';
    }

    _prismCache = {
      head: `<style>${css}</style>`,
      body: `<script>${js}</script>`
    };
    return _prismCache;
  } catch (e) {
    // Fallback to CDN（包含所有 components，與本地版本一致）
    console.warn('  ⚠ 本地 PrismJS 載入失敗，使用 CDN fallback');
    _prismCache = {
      head: `<link href="https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/themes/prism-tomorrow.min.css" rel="stylesheet" />
<link href="https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/plugins/line-numbers/prism-line-numbers.min.css" rel="stylesheet" />`,
      body: `<script src="https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/prism.min.js"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/plugins/line-numbers/prism-line-numbers.min.js"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/components/prism-clike.min.js"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/components/prism-c.min.js"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/components/prism-javascript.min.js"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/components/prism-typescript.min.js"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/components/prism-python.min.js"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/components/prism-java.min.js"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/components/prism-csharp.min.js"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/components/prism-cpp.min.js"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/components/prism-go.min.js"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/components/prism-rust.min.js"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/components/prism-sql.min.js"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/components/prism-bash.min.js"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/components/prism-json.min.js"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/components/prism-yaml.min.js"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/components/prism-markdown.min.js"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/components/prism-http.min.js"></script>`
    };
    return _prismCache;
  }
}

module.exports = { getPrismHtmlTags };

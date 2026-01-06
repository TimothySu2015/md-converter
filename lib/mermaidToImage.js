const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');

/**
 * 從 Markdown 文件中提取所有 Mermaid 圖表
 * @param {string} mdContent - Markdown 文件內容
 * @returns {Array} Mermaid 圖表陣列，包含代碼和位置信息
 */
function extractMermaidBlocks(mdContent) {
  const mermaidRegex = /```mermaid\s*\n([\s\S]*?)```/g;
  const blocks = [];
  let match;

  while ((match = mermaidRegex.exec(mdContent)) !== null) {
    blocks.push({
      fullMatch: match[0],
      code: match[1].trim(),
      index: match.index
    });
  }

  return blocks;
}

/**
 * 讀取本地 Mermaid.js 檔案內容
 * @returns {string} Mermaid.js 內容
 */
function getMermaidScript() {
  const mermaidPath = path.join(__dirname, '..', 'node_modules', 'mermaid', 'dist', 'mermaid.min.js');
  if (!fs.existsSync(mermaidPath)) {
    throw new Error(`找不到 Mermaid.js: ${mermaidPath}`);
  }
  return fs.readFileSync(mermaidPath, 'utf8');
}

/**
 * 建立 Mermaid 渲染用的基礎 HTML 模板（不含圖表代碼）
 * @param {string} mermaidScript - Mermaid.js 內容
 * @returns {string} HTML 模板
 */
function createBaseHtmlTemplate(mermaidScript) {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <script>${mermaidScript}</script>
      <style>body { margin: 0; padding: 0; background: white; }</style>
    </head>
    <body>
      <script>
        mermaid.initialize({
          startOnLoad: false,
          theme: 'default',
          securityLevel: 'loose',
          fontFamily: 'Noto Sans TC, Microsoft JhengHei, sans-serif'
        });
      </script>
    </body>
    </html>
  `;
}

/**
 * 將 Mermaid 代碼轉換為 SVG 圖片（使用共用的瀏覽器實例）
 * @param {object} page - Puppeteer 頁面實例
 * @param {string} mermaidCode - Mermaid 圖表代碼
 * @param {string} outputPath - 輸出 SVG 文件路徑
 * @param {number} index - 圖表索引（用於生成唯一 ID）
 * @returns {Promise<void>}
 */
async function mermaidToSVG(page, mermaidCode, outputPath, index) {
  try {
    console.log(`正在轉換: ${path.basename(outputPath)}`);

    // 使用 mermaid.render() 渲染圖表
    const svgContent = await page.evaluate(async (code, idx) => {
      try {
        // 清理之前渲染產生的 SVG 元素，避免 DOM 累積
        const oldSvg = document.getElementById(`mermaid-diagram-${idx}`);
        if (oldSvg) oldSvg.remove();

        const { svg } = await mermaid.render(`mermaid-diagram-${idx}`, code);
        return { success: true, svg };
      } catch (err) {
        return { success: false, error: err.message };
      }
    }, mermaidCode, index);

    if (!svgContent.success) {
      throw new Error(svgContent.error);
    }

    // 寫入檔案
    fs.writeFileSync(outputPath, svgContent.svg, 'utf8');

    console.log(`✓ 成功生成: ${path.basename(outputPath)}`);

  } catch (error) {
    console.error(`✗ 轉換失敗: ${path.basename(outputPath)}`);
    console.error(`錯誤信息: ${error.message}`);
    throw error;
  }
}

/**
 * 處理 Markdown 文件，將所有 Mermaid 圖表轉換為 SVG 並更新引用
 * @param {string} inputMdPath - 輸入的 Markdown 文件路徑
 * @param {string} [customOutputPath] - 自訂輸出路徑 (可選)
 * @returns {Promise<string>} 新生成的 Markdown 文件路徑
 */
async function processMermaidInMarkdown(inputMdPath, customOutputPath = null) {
  console.log(`\n開始處理: ${inputMdPath}`);

  // 讀取原始 Markdown 文件
  const mdContent = fs.readFileSync(inputMdPath, 'utf8');

  // 提取所有 Mermaid 圖表
  const mermaidBlocks = extractMermaidBlocks(mdContent);

  if (mermaidBlocks.length === 0) {
    console.log('未找到 Mermaid 圖表');
    return inputMdPath;
  }

  console.log(`找到 ${mermaidBlocks.length} 個 Mermaid 圖表\n`);

  // 創建圖片目錄
  const inputDir = path.dirname(inputMdPath);
  const inputBasename = path.basename(inputMdPath, '.md');
  const imagesDir = path.join(inputDir, `${inputBasename}_IMG`);

  if (!fs.existsSync(imagesDir)) {
    fs.mkdirSync(imagesDir, { recursive: true });
    console.log(`創建圖片目錄: ${imagesDir}\n`);
  }

  // 載入本地 Mermaid.js 並建立基礎 HTML
  const mermaidScript = getMermaidScript();
  const baseHtml = createBaseHtmlTemplate(mermaidScript);

  // 啟動瀏覽器（只啟動一次，重複使用）
  let browser = null;
  let updatedContent = mdContent;
  const replacements = [];

  try {
    console.log('啟動瀏覽器...');
    browser = await puppeteer.launch({
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    const page = await browser.newPage();

    // 載入基礎頁面（只載入一次）
    await page.setContent(baseHtml, { waitUntil: 'domcontentloaded', timeout: 30000 });

    // 轉換所有 Mermaid 圖表為 SVG（重用同一個頁面）
    for (let i = 0; i < mermaidBlocks.length; i++) {
      const block = mermaidBlocks[i];
      const svgFilename = `mermaid-${i + 1}.svg`;
      const svgPath = path.join(imagesDir, svgFilename);

      try {
        // 轉換為 SVG（重用瀏覽器和頁面，使用 mermaid.render()）
        await mermaidToSVG(page, block.code, svgPath, i + 1);

        // 準備替換：使用相對路徑引用圖片
        const relativeImagePath = `${inputBasename}_IMG/${svgFilename}`;
        const imageMarkdown = `![Mermaid Diagram ${i + 1}](${relativeImagePath})`;

        replacements.push({
          original: block.fullMatch,
          replacement: imageMarkdown,
          index: block.index
        });
      } catch (error) {
        console.error(`跳過圖表 ${i + 1}，保留原始 Mermaid 代碼`);
      }
    }

  } finally {
    if (browser) {
      await browser.close();
      console.log('瀏覽器已關閉');
    }
  }

  // 執行替換（從後往前替換，避免索引位移問題）
  for (const { original, replacement, index } of replacements.reverse()) {
    updatedContent = updatedContent.substring(0, index) +
                     replacement +
                     updatedContent.substring(index + original.length);
  }

  // 生成新的 Markdown 文件
  const outputMdPath = customOutputPath || path.join(inputDir, `${inputBasename}_IMG.md`);
  fs.writeFileSync(outputMdPath, updatedContent, 'utf8');

  console.log(`\n✓ 完成！`);
  console.log(`  - 轉換了 ${replacements.length}/${mermaidBlocks.length} 個圖表`);
  console.log(`  - 圖片目錄: ${imagesDir}`);
  console.log(`  - 新 MD 檔案: ${outputMdPath}\n`);

  return outputMdPath;
}

// 如果直接執行此腳本
if (require.main === module) {
  const inputPath = process.argv[2];
  const outputPath = process.argv[3];

  if (!inputPath) {
    console.error('用法: node mermaidToImage.js <markdown-file-path> [output-path]');
    process.exit(1);
  }

  if (!fs.existsSync(inputPath)) {
    console.error(`錯誤: 文件不存在: ${inputPath}`);
    process.exit(1);
  }

  processMermaidInMarkdown(inputPath, outputPath)
    .then(resultPath => {
      console.log(`成功！新文件: ${resultPath}`);
    })
    .catch(error => {
      console.error('處理失敗:', error.message);
      process.exit(1);
    });
}

module.exports = {
  extractMermaidBlocks,
  mermaidToSVG,
  processMermaidInMarkdown
};

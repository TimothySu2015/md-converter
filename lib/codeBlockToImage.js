const fs = require('fs');
const path = require('path');
const { marked } = require('marked');
const puppeteer = require('puppeteer');

// 載入樣式設定與共用模組
const defaultStyles = require('../styles/default');
const { getPrismHtmlTags } = require('./prismResources');

/**
 * 從 Markdown 文件中提取所有程式碼區塊
 * @param {string} mdContent - Markdown 文件內容
 * @returns {Array} 程式碼區塊陣列
 */
function extractCodeBlocks(mdContent) {
  const tokens = marked.lexer(mdContent);
  const codeBlocks = [];

  function processTokens(tokens) {
    for (const token of tokens) {
      if (token.type === 'code') {
        codeBlocks.push({
          code: token.text,
          language: token.lang || 'plaintext',
          raw: token.raw
        });
      }

      // 遞迴處理巢狀 tokens
      if (token.tokens) {
        processTokens(token.tokens);
      }
    }
  }

  processTokens(tokens);
  return codeBlocks;
}

/**
 * 使用 Puppeteer 將程式碼區塊轉換為圖片
 */
async function convertCodeBlockToImage(code, language, outputPath, page, styles = null) {
  try {
    // 使用傳入的樣式或預設樣式
    const codeStyles = styles?.codeBlock || defaultStyles.codeBlock;
    const lineNumberColor = codeStyles.lineNumbers?.color || '858585';
    const lineNumberBorder = codeStyles.lineNumbers?.borderRight || '1px solid #555';
    const headerBg = codeStyles.header?.backgroundColor || '1e1e1e';
    const headerTextColor = codeStyles.header?.text?.color || '858585';
    const contentBg = codeStyles.content?.backgroundColor || '2d2d2d';
    const codeFontSize = codeStyles.code?.fontSize || 14;
    const codeLineHeight = codeStyles.code?.lineHeight || 1.6;

    // 轉義 HTML 特殊字元
    const escapeHtml = (text) => {
      return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
    };

    const escapedCode = escapeHtml(code);

    // 準備 Prism 資源（使用共用模組，本地或 CDN）
    const { head: prismHead, body: prismBody } = getPrismHtmlTags();

    // 使用 Prism.js 進行語法高亮（含行號）
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        ${prismHead}
        <style>
          body {
            margin: 0;
            padding: 0;
            background: white;
          }
          .code-header {
            background: #${headerBg};
            color: #${headerTextColor};
            padding: 8px 20px;
            border-radius: 0;
            font-size: 12px;
            font-family: 'Consolas', 'Monaco', 'Courier New', monospace;
          }
          .code-container {
            background: #${contentBg};
            padding: 20px;
            padding-left: 0;
            border-radius: 0;
            margin: 0;
            font-family: 'Consolas', 'Monaco', 'Courier New', monospace;
            font-size: ${codeFontSize}px;
            line-height: ${codeLineHeight};
            overflow: auto;
          }
          pre[class*="language-"] {
            margin: 0;
            padding: 0 20px 0 0;
            background: transparent !important;
            border-radius: 0;
          }
          pre[class*="language-"].line-numbers {
            padding-left: 3.8em;
          }
          code[class*="language-"] {
            font-family: 'Consolas', 'Monaco', 'Courier New', monospace;
            font-size: ${codeFontSize}px;
            line-height: ${codeLineHeight};
          }
          /* 行號樣式 */
          .line-numbers .line-numbers-rows {
            border-right: ${lineNumberBorder};
            padding-right: 10px;
          }
          .line-numbers-rows > span:before {
            color: #${lineNumberColor};
          }
        </style>
      </head>
      <body>
        <div class="code-header">${language || 'code'}</div>
        <div class="code-container">
          <pre class="line-numbers"><code class="language-${language || 'plaintext'}">${escapedCode}</code></pre>
        </div>
      ${prismBody}
      </body>
      </html>
    `;

    page.setDefaultTimeout(30000);

    // 使用 load 確保資源載入，避免 networkidle0 因網路波動超時
    try {
      await page.setContent(html, { waitUntil: 'load', timeout: 30000 });
    } catch (e) {
      console.warn('  ⚠ 頁面載入超時或失敗，嘗試繼續渲染...');
      // 即使超時，內容可能已經存在，嘗試繼續
    }

    // 等待 Prism.js 渲染完成
    await new Promise(resolve => setTimeout(resolve, 500));

    // 獲取程式碼區塊的實際尺寸
    const dimensions = await page.evaluate(() => {
      const container = document.querySelector('body');
      if (container) {
        const bbox = container.getBoundingClientRect();
        return {
          width: Math.ceil(bbox.width),
          height: Math.ceil(bbox.height)
        };
      }
      return { width: 800, height: 400 };
    });

    await page.setViewport({
      width: Math.max(dimensions.width, 800),
      height: dimensions.height,
      deviceScaleFactor: 2
    });

    await page.screenshot({
      path: outputPath,
      type: 'png',
      omitBackground: false,
      fullPage: true
    });

    return true;
  } catch (error) {
    console.error(`✗ 轉換失敗: ${path.basename(outputPath)} - ${error.message}`);
    return false;
  }
}

/**
 * 處理 Markdown 文件，將所有程式碼區塊轉換為圖片並更新引用
 * @param {string} inputMdPath - 輸入檔案路徑
 * @param {string} [customOutputPath] - 自訂輸出路徑 (可選)
 */
async function processCodeBlocksInMarkdown(inputMdPath, customOutputPath = null) {
  console.log(`\n開始處理: ${inputMdPath}`);

  if (!fs.existsSync(inputMdPath)) {
    throw new Error(`檔案不存在: ${inputMdPath}`);
  }

  // 讀取原始 Markdown 文件
  let mdContent = fs.readFileSync(inputMdPath, 'utf8');

  // 使用正則表達式提取所有程式碼區塊（支援 \r\n 和 \n）
  // 注意：排除 mermaid 區塊，因為它們應該由 mermaidToImage.js 處理
  const codeBlockRegex = /```(\w*)\r?\n([\s\S]*?)```/g;
  const codeBlocks = [];
  let match;

  while ((match = codeBlockRegex.exec(mdContent)) !== null) {
    const language = match[1] || 'plaintext';
    // 排除 mermaid 區塊
    if (language.toLowerCase() === 'mermaid') {
      continue;
    }
    codeBlocks.push({
      fullMatch: match[0],
      language: language,
      code: match[2],
      index: match.index
    });
  }

  if (codeBlocks.length === 0) {
    console.log('未找到程式碼區塊');
    return inputMdPath;
  }

  console.log(`找到 ${codeBlocks.length} 個程式碼區塊\n`);

  // 創建圖片目錄
  const inputDir = path.dirname(inputMdPath);
  const inputBasename = path.basename(inputMdPath, '.md');
  const imagesDir = path.join(inputDir, `${inputBasename}_CODE`);

  if (!fs.existsSync(imagesDir)) {
    fs.mkdirSync(imagesDir, { recursive: true });
    console.log(`創建圖片目錄: ${imagesDir}\n`);
  }

  // 啟動瀏覽器
  console.log('啟動瀏覽器...');
  let browser = await puppeteer.launch({
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-accelerated-2d-canvas',
      '--no-first-run',
      '--no-zygote',
      '--disable-gpu'
    ]
  });
  let page = await browser.newPage();

  // 轉換所有程式碼區塊為圖片
  const replacements = [];
  let successCount = 0;
  let restartCount = 0;

  // 瀏覽器重啟間隔（每 N 個區塊重啟一次，防止記憶體洩漏）
  const RESTART_INTERVAL = 10;

  for (let i = 0; i < codeBlocks.length; i++) {
    const block = codeBlocks[i];
    const imageFilename = `code-${i + 1}.png`;
    const imagePath = path.join(imagesDir, imageFilename);

    console.log(`轉換 [${i + 1}/${codeBlocks.length}]: ${block.language}`);

    try {
      // 每 RESTART_INTERVAL 個程式碼區塊重啟瀏覽器，釋放記憶體
      if (i > 0 && i % RESTART_INTERVAL === 0) {
        console.log('  重啟瀏覽器以釋放記憶體...');
        try {
          await page.close();
          await browser.close();
        } catch (e) {
          console.warn('  關閉瀏覽器時發生錯誤 (可忽略):', e.message);
        }
        await new Promise(resolve => setTimeout(resolve, 500));
        browser = await puppeteer.launch({
          headless: true,
          args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-accelerated-2d-canvas',
            '--no-first-run',
            '--no-zygote',
            '--disable-gpu'
          ]
        });
        page = await browser.newPage();
        restartCount++;
      }

      const success = await convertCodeBlockToImage(
        block.code,
        block.language,
        imagePath,
        page
      );

      if (success) {
        console.log(`✓ 成功: ${imageFilename}`);
        successCount++;

        // 準備替換：使用相對路徑引用圖片
        const relativeImagePath = `${inputBasename}_CODE/${imageFilename}`;
        const imageMarkdown = `![Code Block ${i + 1}](${relativeImagePath})`;

        replacements.push({
          original: block.fullMatch,
          replacement: imageMarkdown,
          index: block.index
        });
      }
    } catch (error) {
      console.error(`✗ 跳過區塊 ${i + 1}: ${error.message}`);
    }
  }

  // 關閉瀏覽器
  await browser.close();

  // 執行替換 - 從後往前替換，避免索引問題
  let updatedContent = mdContent;
  // replacements 順序是 0, 1, 2... 我們需要反向操作
  for (let i = replacements.length - 1; i >= 0; i--) {
    const { original, replacement, index } = replacements[i];
    updatedContent = updatedContent.substring(0, index) +
                    replacement +
                    updatedContent.substring(index + original.length);
    console.log(`  ✓ 替換程式碼區塊 ${i + 1}`);
  }

  // 生成新的 Markdown 文件
  const outputMdPath = customOutputPath || path.join(inputDir, `${inputBasename}_CODE.md`);
  fs.writeFileSync(outputMdPath, updatedContent, 'utf8');

  console.log(`\n✓ 完成！`);
  console.log(`  - 成功轉換: ${successCount}/${codeBlocks.length} 個程式碼區塊`);
  if (restartCount > 0) {
    console.log(`  - 瀏覽器重啟: ${restartCount} 次`);
  }
  console.log(`  - 圖片目錄: ${imagesDir}`);
  console.log(`  - 新 MD 檔案: ${outputMdPath}\n`);

  return outputMdPath;
}

// 命令列介面
if (require.main === module) {
  const inputPath = process.argv[2];
  const outputPath = process.argv[3];

  if (!inputPath) {
    console.error('用法: node codeBlockToImage.js <markdown-file-path> [output-path]');
    console.error('');
    console.error('範例:');
    console.error('  node codeBlockToImage.js example.md');
    process.exit(1);
  }

  if (!fs.existsSync(inputPath)) {
    console.error(`錯誤: 檔案不存在: ${inputPath}`);
    process.exit(1);
  }

  processCodeBlocksInMarkdown(inputPath, outputPath)
    .then(resultPath => {
      console.log(`成功！新文件: ${resultPath}`);
    })
    .catch(error => {
      console.error('處理失敗:', error.message);
      process.exit(1);
    });
}

module.exports = {
  extractCodeBlocks,
  convertCodeBlockToImage,
  processCodeBlocksInMarkdown
};

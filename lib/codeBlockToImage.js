const fs = require('fs');
const path = require('path');
const { marked } = require('marked');
const puppeteer = require('puppeteer');

// 載入樣式設定
const defaultStyles = require('../styles/default');

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
async function convertCodeBlockToImage(code, language, outputPath, browser, styles = null) {
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

    // 使用 Prism.js 進行語法高亮（含行號）
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <link href="https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/themes/prism-tomorrow.min.css" rel="stylesheet" />
        <link href="https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/plugins/line-numbers/prism-line-numbers.min.css" rel="stylesheet" />
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
        <script src="https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/prism.min.js"></script>
        <script src="https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/plugins/line-numbers/prism-line-numbers.min.js"></script>
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
        <script src="https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/components/prism-http.min.js"></script>
      </body>
      </html>
    `;

    const page = await browser.newPage();
    page.setDefaultTimeout(30000);

    // 使用 networkidle0 確保所有 CDN 腳本載入完成
    await page.setContent(html, { waitUntil: 'networkidle0', timeout: 30000 });

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

    await page.close();
    return true;
  } catch (error) {
    console.error(`✗ 轉換失敗: ${path.basename(outputPath)} - ${error.message}`);
    return false;
  }
}

/**
 * 處理 Markdown 文件，將所有程式碼區塊轉換為圖片並更新引用
 */
async function processCodeBlocksInMarkdown(inputMdPath) {
  console.log(`\n開始處理: ${inputMdPath}`);

  if (!fs.existsSync(inputMdPath)) {
    throw new Error(`檔案不存在: ${inputMdPath}`);
  }

  // 讀取原始 Markdown 文件
  let mdContent = fs.readFileSync(inputMdPath, 'utf8');

  // 使用正則表達式提取所有程式碼區塊（支援 \r\n 和 \n）
  const codeBlockRegex = /```(\w*)\r?\n([\s\S]*?)```/g;
  const codeBlocks = [];
  let match;

  while ((match = codeBlockRegex.exec(mdContent)) !== null) {
    codeBlocks.push({
      fullMatch: match[0],
      language: match[1] || 'plaintext',
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

  // 轉換所有程式碼區塊為圖片
  const replacements = [];
  let successCount = 0;
  let restartCount = 0;

  for (let i = 0; i < codeBlocks.length; i++) {
    const block = codeBlocks[i];
    const imageFilename = `code-${i + 1}.png`;
    const imagePath = path.join(imagesDir, imageFilename);

    console.log(`轉換 [${i + 1}/${codeBlocks.length}]: ${block.language}`);

    try {
      // 每 10 個程式碼區塊重啟瀏覽器
      if (i > 0 && i % 10 === 0) {
        console.log('  重啟瀏覽器以釋放資源...');
        await browser.close();
        await new Promise(resolve => setTimeout(resolve, 1000));
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
        restartCount++;
      }

      const success = await convertCodeBlockToImage(
        block.code,
        block.language,
        imagePath,
        browser
      );

      if (success) {
        console.log(`✓ 成功: ${imageFilename}`);
        successCount++;

        // 準備替換：使用相對路徑引用圖片
        const relativeImagePath = `${inputBasename}_CODE/${imageFilename}`;
        const imageMarkdown = `![Code Block ${i + 1}](${relativeImagePath})`;

        replacements.push({
          original: block.fullMatch,
          replacement: imageMarkdown
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
  for (let i = replacements.length - 1; i >= 0; i--) {
    const { original, replacement } = replacements[i];
    // 找到第一個匹配並替換
    const index = updatedContent.indexOf(original);
    if (index !== -1) {
      updatedContent = updatedContent.substring(0, index) +
                      replacement +
                      updatedContent.substring(index + original.length);
      console.log(`  ✓ 替換程式碼區塊 ${i + 1}`);
    } else {
      console.warn(`  ⚠ 警告: 找不到程式碼區塊 ${i + 1}`);
    }
  }

  // 生成新的 Markdown 文件
  const outputMdPath = path.join(inputDir, `${inputBasename}_CODE.md`);
  fs.writeFileSync(outputMdPath, updatedContent, 'utf8');

  console.log(`\n✓ 完成！`);
  console.log(`  - 成功轉換: ${successCount}/${codeBlocks.length} 個程式碼區塊`);
  console.log(`  - 瀏覽器重啟: ${restartCount} 次`);
  console.log(`  - 圖片目錄: ${imagesDir}`);
  console.log(`  - 新 MD 檔案: ${outputMdPath}\n`);

  return outputMdPath;
}

// 命令列介面
if (require.main === module) {
  const inputPath = process.argv[2];

  if (!inputPath) {
    console.error('用法: node codeBlockToImage.js <markdown-file-path>');
    console.error('');
    console.error('範例:');
    console.error('  node codeBlockToImage.js example.md');
    process.exit(1);
  }

  if (!fs.existsSync(inputPath)) {
    console.error(`錯誤: 檔案不存在: ${inputPath}`);
    process.exit(1);
  }

  processCodeBlocksInMarkdown(inputPath)
    .then(outputPath => {
      console.log(`成功！新文件: ${outputPath}`);
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

const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const { promisify } = require('util');

const execAsync = promisify(exec);

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
 * 將 Mermaid 代碼轉換為 SVG 圖片
 * @param {string} mermaidCode - Mermaid 圖表代碼
 * @param {string} outputPath - 輸出 SVG 文件路徑
 * @returns {Promise<void>}
 */
async function mermaidToSVG(mermaidCode, outputPath) {
  // 創建臨時 .mmd 文件
  const tempMmdPath = outputPath.replace('.svg', '.mmd');
  fs.writeFileSync(tempMmdPath, mermaidCode, 'utf8');

  try {
    // 使用本地安裝的 mmdc (mermaid-cli)
    const mmdcExecutable = process.platform === 'win32' ? 'mmdc.cmd' : 'mmdc';
    const mmdcPath = path.join(__dirname, '..', 'node_modules', '.bin', mmdcExecutable);
    const command = `"${mmdcPath}" -i "${tempMmdPath}" -o "${outputPath}" -b transparent`;

    console.log(`正在轉換: ${path.basename(outputPath)}`);
    await execAsync(command);
    console.log(`✓ 成功生成: ${path.basename(outputPath)}`);
  } catch (error) {
    console.error(`✗ 轉換失敗: ${path.basename(outputPath)}`);
    console.error(`錯誤信息: ${error.message}`);
    throw error;
  } finally {
    // 清理臨時文件
    if (fs.existsSync(tempMmdPath)) {
      fs.unlinkSync(tempMmdPath);
    }
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

  // 轉換所有 Mermaid 圖表為 SVG
  let updatedContent = mdContent;
  const replacements = [];

  for (let i = 0; i < mermaidBlocks.length; i++) {
    const block = mermaidBlocks[i];
    const svgFilename = `mermaid-${i + 1}.svg`;
    const svgPath = path.join(imagesDir, svgFilename);

    try {
      // 轉換為 SVG
      await mermaidToSVG(block.code, svgPath);

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

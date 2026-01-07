#!/usr/bin/env node

/**
 * 統一轉換腳本 - 自動執行完整預處理流程
 *
 * 流程：
 *   原始 MD → Mermaid 轉圖片 → 程式碼轉圖片 → 最終轉換 (PDF/DOCX)
 *
 * 使用方式：
 *   node convertAll.js input.md --format pdf
 *   node convertAll.js input.md --format docx
 *   node convertAll.js input.md --format both
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// 解析命令列參數
const args = process.argv.slice(2);
const inputFile = args.find(arg => !arg.startsWith('--'));
const format = args.includes('--format')
  ? args[args.indexOf('--format') + 1]
  : 'both';
const skipMermaid = args.includes('--skip-mermaid');
const skipCode = args.includes('--skip-code');
const verbose = args.includes('--verbose');
const keepImages = args.includes('--keep-images');

if (!inputFile) {
  console.log(`
╔════════════════════════════════════════════════════════════╗
║         MD 統一轉換工具 (含完整預處理)                      ║
╚════════════════════════════════════════════════════════════╝

使用方式:
  node convertAll.js <input.md> [選項]

選項:
  --format <pdf|docx|both>  輸出格式 (預設: both)
  --skip-mermaid            跳過 Mermaid 預處理
  --skip-code               跳過程式碼區塊預處理
  --keep-images             保留中間產生的圖檔目錄
  --verbose                 顯示詳細輸出

範例:
  node convertAll.js README.md --format pdf
  node convertAll.js doc.md --format docx
  node convertAll.js guide.md --format both

流程說明:
  ┌─────────────┐    ┌─────────────────┐    ┌─────────────────┐    ┌────────────┐
  │  原始 MD    │ -> │ Mermaid → SVG   │ -> │ Code → PNG      │ -> │ PDF/DOCX   │
  │  input.md   │    │ (自動處理)      │    │ (自動處理)      │    │ 最終輸出   │
  └─────────────┘    └─────────────────┘    └─────────────────┘    └────────────┘

  * 中間檔案會在轉換完成後自動清理
`);
  process.exit(1);
}

// 檢查輸入檔案
if (!fs.existsSync(inputFile)) {
  console.error(`✗ 找不到檔案: ${inputFile}`);
  process.exit(1);
}

const baseName = path.basename(inputFile, '.md');
const baseDir = path.dirname(path.resolve(inputFile));
const scriptDir = __dirname;

console.log(`
╔════════════════════════════════════════════════════════════╗
║         MD 統一轉換工具                                     ║
╚════════════════════════════════════════════════════════════╝
`);
console.log(`輸入檔案: ${inputFile}`);
console.log(`輸出格式: ${format}`);
console.log(`基底目錄: ${baseDir}`);
console.log('');

/**
 * 執行命令並等待完成
 */
function runCommand(command, description) {
  console.log(`\n${'─'.repeat(60)}`);
  console.log(`▶ ${description}`);
  console.log(`${'─'.repeat(60)}`);

  try {
    const output = execSync(command, {
      encoding: 'utf8',
      stdio: verbose ? 'inherit' : 'pipe',
      cwd: scriptDir,
      timeout: 300000, // 5 分鐘超時
      maxBuffer: 1024 * 1024 * 10 // 增加 Buffer 到 10MB，避免 log 過多導致崩潰
    });
    if (!verbose && output) {
      // 只顯示關鍵訊息
      const lines = output.split('\n').filter(line =>
        line.includes('✓') ||
        line.includes('成功') ||
        line.includes('完成') ||
        line.includes('找到') ||
        line.includes('轉換了')
      );
      if (lines.length > 0) {
        console.log(lines.join('\n'));
      }
    }
    console.log(`✓ ${description} 完成`);
    return true;
  } catch (error) {
    console.error(`✗ ${description} 失敗`);
    if (verbose) {
      console.error(error.message);
    }
    return false;
  }
}

/**
 * 檢查檔案是否包含特定內容
 */
function fileContains(filePath, pattern) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    return pattern.test(content);
  } catch {
    return false;
  }
}

/**
 * 刪除目錄 (使用 Node.js 內建功能)
 */
function removeDirectory(dirPath) {
  if (fs.existsSync(dirPath)) {
    fs.rmSync(dirPath, { recursive: true, force: true });
  }
}

// 主流程
async function main() {
  let currentFile = path.resolve(inputFile);
  const steps = [];
  const intermediateFiles = []; // 用來追蹤產生的中間檔案
  const imageDirectories = [];  // 用來追蹤產生的圖檔目錄

  // 步驟 1: 檢查是否需要 Mermaid 預處理
  const hasMermaid = fileContains(currentFile, /```mermaid/i);

  if (hasMermaid && !skipMermaid) {
    const mermaidOutput = path.join(path.dirname(currentFile), path.basename(currentFile, '.md') + '_IMG.md');
    const mermaidImgDir = path.join(path.dirname(currentFile), path.basename(currentFile, '.md') + '_IMG');
    intermediateFiles.push(mermaidOutput);
    imageDirectories.push(mermaidImgDir);
    steps.push({
      name: 'Mermaid 預處理',
      command: `node "${path.join(scriptDir, 'lib', 'mermaidToImage.js')}" "${currentFile}" "${mermaidOutput}"`,
      outputFile: mermaidOutput
    });
  } else if (hasMermaid && skipMermaid) {
    console.log('⏭ 跳過 Mermaid 預處理 (--skip-mermaid)');
  } else {
    console.log('ℹ 未發現 Mermaid 圖表，跳過預處理');
  }

  // 步驟 2: 檢查是否需要程式碼區塊預處理 (僅 DOCX 需要)
  const hasCodeBlocks = fileContains(currentFile, /```(?!mermaid)[a-z]+\n/i);
  const needsCodePreprocess = (format === 'docx' || format === 'both') && hasCodeBlocks && !skipCode;

  if (needsCodePreprocess) {
    const inputForCode = steps.length > 0 ? steps[steps.length - 1].outputFile : currentFile;
    const codeOutput = path.join(path.dirname(inputForCode), path.basename(inputForCode, '.md') + '_CODE.md');
    const codeImgDir = path.join(path.dirname(inputForCode), path.basename(inputForCode, '.md') + '_CODE');
    intermediateFiles.push(codeOutput);
    imageDirectories.push(codeImgDir);
    steps.push({
      name: '程式碼區塊預處理',
      command: `node "${path.join(scriptDir, 'lib', 'codeBlockToImage.js')}" "${inputForCode}" "${codeOutput}"`,
      outputFile: codeOutput
    });
  } else if (hasCodeBlocks && skipCode) {
    console.log('⏭ 跳過程式碼區塊預處理 (--skip-code)');
  }

  // 執行預處理步驟
  for (const step of steps) {
    const success = runCommand(step.command, step.name);
    if (success && fs.existsSync(step.outputFile)) {
      currentFile = step.outputFile;
    }
  }

  // 步驟 3: 最終轉換
  const results = [];

  if (format === 'pdf' || format === 'both') {
    // PDF 使用 _IMG.md (有 Mermaid 轉圖片的版本)
    const mermaidStep = steps.find(s => s.name === 'Mermaid 預處理');
    const pdfInput = mermaidStep ? mermaidStep.outputFile : path.resolve(inputFile);
    const pdfOutput = path.join(baseDir, `${baseName}.pdf`);

    const success = runCommand(
      `node "${path.join(scriptDir, 'lib', 'convert.js')}" "${pdfInput}" "${pdfOutput}"`,
      'PDF 轉換'
    );
    results.push({ format: 'PDF', success, output: pdfOutput });
  }

  if (format === 'docx' || format === 'both') {
    // DOCX 使用最終預處理的版本
    const docxOutput = path.join(baseDir, `${baseName}.docx`);

    const success = runCommand(
      `node "${path.join(scriptDir, 'lib', 'mdToDocxComplete.js')}" "${currentFile}" "${docxOutput}"`,
      'DOCX 轉換'
    );
    results.push({ format: 'DOCX', success, output: docxOutput });
  }

  // 輸出結果摘要
  console.log(`\n${'═'.repeat(60)}`);
  console.log('轉換結果摘要');
  console.log(`${'═'.repeat(60)}`);

  results.forEach(r => {
    const status = r.success ? '✓' : '✗';
    const exists = fs.existsSync(r.output) ? '' : ' (檔案不存在)';
    console.log(`${status} ${r.format}: ${r.output}${exists}`);
  });

  // 列出產生的最終檔案
  console.log(`\n產生的檔案:`);
  const finalFiles = [
    path.join(baseDir, `${baseName}.pdf`),
    path.join(baseDir, `${baseName}.docx`)
  ].filter(f => fs.existsSync(f));

  finalFiles.forEach(f => {
    const size = (fs.statSync(f).size / 1024).toFixed(1);
    console.log(`  📄 ${path.basename(f)} (${size} KB)`);
  });

  // 清理中間檔案
  let cleanedFiles = 0;
  for (const f of intermediateFiles) {
    if (fs.existsSync(f)) {
      try {
        fs.unlinkSync(f);
        cleanedFiles++;
      } catch (err) {
        console.warn(`  ⚠ 無法刪除中間檔案: ${path.basename(f)}`);
      }
    }
  }

  // 清理圖檔目錄（除非指定 --keep-images）
  let cleanedDirs = 0;
  if (!keepImages) {
    for (const dir of imageDirectories) {
      if (fs.existsSync(dir)) {
        try {
          removeDirectory(dir);
          cleanedDirs++;
        } catch (err) {
          console.warn(`  ⚠ 無法刪除圖檔目錄: ${path.basename(dir)}`);
        }
      }
    }
  }

  if (cleanedFiles > 0 || cleanedDirs > 0) {
    const parts = [];
    if (cleanedFiles > 0) parts.push(`${cleanedFiles} 個中間檔案`);
    if (cleanedDirs > 0) parts.push(`${cleanedDirs} 個圖檔目錄`);
    console.log(`\n🧹 已清理 ${parts.join('、')}`);
  }

  if (keepImages && imageDirectories.length > 0) {
    console.log(`\n📁 保留的圖檔目錄:`);
    imageDirectories.filter(d => fs.existsSync(d)).forEach(d => {
      console.log(`  ${path.basename(d)}/`);
    });
  }

  console.log(`\n${'═'.repeat(60)}`);
  console.log('✓ 全部完成！');
  console.log(`${'═'.repeat(60)}\n`);
}

main().catch(err => {
  console.error('轉換過程發生錯誤:', err.message);
  process.exit(1);
});

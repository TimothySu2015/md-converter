#!/usr/bin/env node

/**
 * 統一轉換腳本 - Markdown 轉 PDF/DOCX
 *
 * 此腳本作為高階控制器，直接調用轉換模組進行處理。
 *
 * 架構說明：
 *   1. 解析命令列參數
 *   2. 呼叫 `convertMarkdownToPdf` (lib/convert.js) 產生 PDF
 *   3. 呼叫 `convertMdToDocxComplete` (lib/mdToDocxComplete.js) 產生 DOCX
 *
 * 子模組會自行處理 Mermaid 圖表和程式碼區塊的渲染。
 *
 * ============================================================================
 * 重要：以下命令列選項是必要功能，請勿移除！
 * IMPORTANT: The following CLI options are essential features. DO NOT REMOVE!
 * ============================================================================
 *
 * --skip-mermaid  : 跳過 Mermaid 圖表處理（用於調試或已預處理的檔案）
 *                   Skip Mermaid diagram processing (for debugging or pre-processed files)
 *
 * --skip-code     : 跳過程式碼區塊轉圖片（DOCX 會使用純文字程式碼區塊）
 *                   Skip code block to image conversion (DOCX will use plain text code blocks)
 *
 * --keep-images   : 保留中間產生的圖檔目錄（用於調試或重複使用）
 *                   Keep intermediate image directories (for debugging or reuse)
 *
 * 這些選項在以下情境非常重要：
 * - 調試轉換問題時，可單獨測試各階段
 * - 已有預處理檔案時，避免重複處理
 * - 需要保留圖檔供其他用途時
 * ============================================================================
 */

const fs = require('fs');
const path = require('path');

// 匯入核心轉換函數
const { convertMarkdownToPdf } = require('./lib/convert.js');
const { convertMdToDocxComplete } = require('./lib/mdToDocxComplete.js');

// 從 package.json 讀取版本號
const { version } = require('./package.json');

// 有效的格式選項
const VALID_FORMATS = ['pdf', 'docx', 'both'];

// ============================================================================
// 命令列參數解析
// 注意：這些選項是必要功能，請勿移除！
// ============================================================================
const args = process.argv.slice(2);
const inputFile = args.find(arg => !arg.startsWith('--'));
const format = args.includes('--format')
  ? args[args.indexOf('--format') + 1]
  : 'both';

// 功能開關選項（重要：這些選項用於調試和特殊用途，請勿移除）
const skipMermaid = args.includes('--skip-mermaid');   // 跳過 Mermaid 處理
const skipCode = args.includes('--skip-code');         // 跳過程式碼區塊轉圖片
const keepImages = args.includes('--keep-images');     // 保留中間圖檔
const verbose = args.includes('--verbose');            // 詳細輸出

// 顯示使用說明（無輸入檔案時）
if (!inputFile) {
  console.log(`
╔════════════════════════════════════════════════════════════╗
║         MD 統一轉換工具 v${version.padEnd(36)}║
╚════════════════════════════════════════════════════════════╝

使用方式:
  node convertAll.js <input.md> [選項]

選項:
  --format <pdf|docx|both>  輸出格式 (預設: both)
  --skip-mermaid            跳過 Mermaid 圖表預處理
  --skip-code               跳過程式碼區塊轉圖片 (DOCX)
  --keep-images             保留中間產生的圖檔目錄
  --verbose                 顯示詳細輸出

範例:
  node convertAll.js README.md --format pdf
  node convertAll.js doc.md --format docx
  node convertAll.js guide.md --format both --keep-images
  node convertAll.js debug.md --skip-mermaid --skip-code

流程說明:
  ┌─────────────┐    ┌─────────────────┐    ┌─────────────────┐    ┌────────────┐
  │  原始 MD    │ -> │ Mermaid → SVG   │ -> │ Code → PNG      │ -> │ PDF/DOCX   │
  │  input.md   │    │ (可跳過)        │    │ (可跳過)        │    │ 最終輸出   │
  └─────────────┘    └─────────────────┘    └─────────────────┘    └────────────┘
`);
  process.exit(1);
}

// 驗證格式參數
if (!VALID_FORMATS.includes(format)) {
  console.error(`✗ 無效的格式: ${format}`);
  console.error(`  有效選項: ${VALID_FORMATS.join(', ')}`);
  process.exit(1);
}

// ============================================================================
// 主要執行邏輯
// ============================================================================
async function main() {
  // 檢查輸入檔案
  if (!fs.existsSync(inputFile)) {
    console.error(`✗ 找不到檔案: ${inputFile}`);
    process.exit(1);
  }

  const absoluteInputPath = path.resolve(inputFile);
  const baseName = path.basename(absoluteInputPath, '.md');
  const baseDir = path.dirname(absoluteInputPath);

  // 追蹤產生的中間檔案和目錄（用於清理）
  const generatedImageDirs = [];
  const generatedIntermediateFiles = [];

  console.log(`
╔════════════════════════════════════════════════════════════╗
║         MD 統一轉換工具                                     ║
╚════════════════════════════════════════════════════════════╝
`);
  console.log(`輸入檔案: ${inputFile}`);
  console.log(`輸出格式: ${format}`);
  console.log(`輸出目錄: ${baseDir}`);

  // 顯示啟用的選項
  const enabledOptions = [];
  if (skipMermaid) enabledOptions.push('跳過Mermaid');
  if (skipCode) enabledOptions.push('跳過程式碼轉圖');
  if (keepImages) enabledOptions.push('保留圖檔');
  if (verbose) enabledOptions.push('詳細模式');
  if (enabledOptions.length > 0) {
    console.log(`啟用選項: ${enabledOptions.join(', ')}`);
  }
  console.log('────────────────────────────────────────────────────────────');

  const results = [];

  // ─────────────────────────────────────────────────────────────────────────
  // PDF 轉換
  // ─────────────────────────────────────────────────────────────────────────
  if (format === 'pdf' || format === 'both') {
    console.log('\n▶ 開始 PDF 轉換...');
    const pdfOutput = path.join(baseDir, `${baseName}.pdf`);

    try {
      // PDF 選項：
      // - convertMermaid: 是否在 PDF 轉換時處理 Mermaid（預設啟用，除非 --skip-mermaid）
      const pdfOptions = {
        convertMermaid: !skipMermaid
      };

      if (verbose) {
        console.log(`  PDF 選項: convertMermaid=${pdfOptions.convertMermaid}`);
      }

      await convertMarkdownToPdf(absoluteInputPath, pdfOutput, pdfOptions);
      results.push({ format: 'PDF', success: true, output: pdfOutput });

      // 追蹤可能產生的中間檔案和目錄
      const mermaidDir = path.join(baseDir, `${baseName}_IMG`);
      const mermaidMd = path.join(baseDir, `${baseName}_IMG.md`);
      if (fs.existsSync(mermaidDir)) {
        generatedImageDirs.push(mermaidDir);
      }
      if (fs.existsSync(mermaidMd)) {
        generatedIntermediateFiles.push(mermaidMd);
      }
    } catch (error) {
      console.error(`✗ PDF 轉換失敗: ${error.message}`);
      if (verbose && error.stack) {
        console.error(error.stack);
      }
      results.push({ format: 'PDF', success: false, output: pdfOutput });
    }
    console.log('────────────────────────────────────────────────────────────');
  }

  // ─────────────────────────────────────────────────────────────────────────
  // DOCX 轉換
  // ─────────────────────────────────────────────────────────────────────────
  if (format === 'docx' || format === 'both') {
    console.log('\n▶ 開始 DOCX 轉換...');
    const docxOutput = path.join(baseDir, `${baseName}.docx`);

    try {
      // DOCX 選項：
      // - processMermaid: 是否預處理 Mermaid（預設啟用，除非 --skip-mermaid）
      // - codeBlockAsImage: 是否將程式碼區塊轉為圖片（預設啟用，除非 --skip-code）
      const docxOptions = {
        processMermaid: !skipMermaid,
        codeBlockAsImage: !skipCode
      };

      if (verbose) {
        console.log(`  DOCX 選項: processMermaid=${docxOptions.processMermaid}, codeBlockAsImage=${docxOptions.codeBlockAsImage}`);
      }

      await convertMdToDocxComplete(absoluteInputPath, docxOutput, docxOptions);
      results.push({ format: 'DOCX', success: true, output: docxOutput });

      // 追蹤可能產生的中間檔案和目錄
      const mermaidDir = path.join(baseDir, `${baseName}_IMG`);
      const mermaidMd = path.join(baseDir, `${baseName}_IMG.md`);
      const codeDir = path.join(baseDir, `${baseName}_IMG_CODE`);
      const codeMd = path.join(baseDir, `${baseName}_IMG_CODE.md`);
      if (fs.existsSync(mermaidDir) && !generatedImageDirs.includes(mermaidDir)) {
        generatedImageDirs.push(mermaidDir);
      }
      if (fs.existsSync(mermaidMd) && !generatedIntermediateFiles.includes(mermaidMd)) {
        generatedIntermediateFiles.push(mermaidMd);
      }
      if (fs.existsSync(codeDir)) {
        generatedImageDirs.push(codeDir);
      }
      if (fs.existsSync(codeMd)) {
        generatedIntermediateFiles.push(codeMd);
      }
    } catch (error) {
      console.error(`✗ DOCX 轉換失敗: ${error.message}`);
      if (verbose && error.stack) {
        console.error(error.stack);
      }
      results.push({ format: 'DOCX', success: false, output: docxOutput });
    }
    console.log('────────────────────────────────────────────────────────────');
  }

  // ─────────────────────────────────────────────────────────────────────────
  // 清理中間檔案（除非指定 --keep-images）
  // ─────────────────────────────────────────────────────────────────────────
  const hasIntermediateFiles = generatedImageDirs.length > 0 || generatedIntermediateFiles.length > 0;

  if (!keepImages && hasIntermediateFiles) {
    console.log('\n🧹 清理中間檔案...');
    let cleanedDirs = 0;
    let cleanedFiles = 0;

    // 清理圖檔目錄
    for (const dir of generatedImageDirs) {
      if (fs.existsSync(dir)) {
        try {
          fs.rmSync(dir, { recursive: true, force: true });
          cleanedDirs++;
          if (verbose) {
            console.log(`  已刪除目錄: ${path.basename(dir)}/`);
          }
        } catch (err) {
          console.warn(`  ⚠ 無法刪除: ${path.basename(dir)}/ - ${err.message}`);
        }
      }
    }

    // 清理中間 Markdown 檔案
    for (const file of generatedIntermediateFiles) {
      if (fs.existsSync(file)) {
        try {
          fs.unlinkSync(file);
          cleanedFiles++;
          if (verbose) {
            console.log(`  已刪除檔案: ${path.basename(file)}`);
          }
        } catch (err) {
          console.warn(`  ⚠ 無法刪除: ${path.basename(file)} - ${err.message}`);
        }
      }
    }

    const parts = [];
    if (cleanedDirs > 0) parts.push(`${cleanedDirs} 個目錄`);
    if (cleanedFiles > 0) parts.push(`${cleanedFiles} 個檔案`);
    if (parts.length > 0) {
      console.log(`  已清理 ${parts.join('、')}`);
    }
  } else if (keepImages && hasIntermediateFiles) {
    console.log('\n📁 保留的中間檔案:');
    generatedImageDirs.forEach(dir => {
      if (fs.existsSync(dir)) {
        console.log(`  ${path.basename(dir)}/`);
      }
    });
    generatedIntermediateFiles.forEach(file => {
      if (fs.existsSync(file)) {
        console.log(`  ${path.basename(file)}`);
      }
    });
  }

  // ─────────────────────────────────────────────────────────────────────────
  // 輸出結果摘要
  // ─────────────────────────────────────────────────────────────────────────
  console.log(`
╔════════════════════════════════════════════════════════════╗
║                    轉換結果摘要                             ║
╚════════════════════════════════════════════════════════════╝`);

  results.forEach(r => {
    const status = r.success ? '✓' : '✗';
    if (r.success && fs.existsSync(r.output)) {
      const size = (fs.statSync(r.output).size / 1024).toFixed(1);
      console.log(`${status} ${r.format}: ${path.basename(r.output)} (${size} KB)`);
    } else {
      console.log(`${status} ${r.format}: ${path.basename(r.output)} (失敗)`);
    }
  });

  const allSuccess = results.every(r => r.success);
  if (allSuccess) {
    console.log('\n✓ 全部完成！\n');
  } else {
    console.log('\n⚠ 部分轉換失敗，請檢查上方錯誤訊息\n');
    process.exit(1);
  }
}

// 執行主程式
main().catch(err => {
  console.error('\n✗ 轉換過程發生錯誤:', err.message);
  if (err.stack) {
    console.error(err.stack);
  }
  process.exit(1);
});

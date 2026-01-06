/**
 * stylesToCss.js - 將 default.js 樣式轉換為 PDF 用的 CSS
 *
 * 使用方式：
 *   const { generatePdfCss } = require('./stylesToCss');
 *   const css = generatePdfCss(); // 使用預設樣式
 *   const css = generatePdfCss('./styles/custom.js'); // 使用自訂樣式
 */

const path = require('path');

/**
 * 單位轉換函數
 */
const units = {
  // 半點 → pt (fontSize)
  halfPointToPt: (value) => value / 2,

  // twips → pt (spacing)
  twipsToPt: (value) => value / 20,

  // 8分之1點 → pt (border size)
  eighthPointToPt: (value) => value / 8,

  // HEX 顏色加 # 前綴
  color: (value) => value ? `#${value}` : 'inherit'
};

/**
 * 從 default.js 生成 PDF CSS
 * @param {string} stylesPath - 樣式檔案路徑（可選）
 * @returns {string} CSS 字串
 */
function generatePdfCss(stylesPath = null) {
  // 載入樣式設定
  const stylePath = stylesPath || path.join(__dirname, '..', 'styles', 'default.js');

  // 清除 require cache 以確保讀取最新的樣式
  delete require.cache[require.resolve(stylePath)];
  const styles = require(stylePath);

  const h = styles.headings;
  const p = styles.paragraph;
  const t = styles.table;
  const bq = styles.blockquote;
  const link = styles.link;
  const hr = styles.horizontalRule;
  const toc = styles.toc;
  const hackmd = styles.hackmd;
  const list = styles.list;
  const doc = styles.document;

  return `
<style>
  @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+TC:wght@300;400;500;700&family=Noto+Serif+TC:wght@400;700&display=swap');

  /* ============================================================
   * 基本設定 (from document)
   * ============================================================ */
  body {
    font-family: 'Noto Sans TC', '${doc.defaultFont?.ascii || 'Microsoft JhengHei'}', sans-serif;
    font-size: ${units.halfPointToPt(doc.defaultFontSize || 24)}pt;
    line-height: 1.6;
    color: ${units.color(p.text?.color || '333333')};
    max-width: 100%;
    margin: 0;
    padding: 0;
  }

  /* ============================================================
   * 標題樣式 (from headings)
   * ============================================================ */
  h1, h2, h3, h4, h5, h6 {
    font-family: 'Noto Serif TC', '${h.common?.font?.ascii || 'Microsoft JhengHei'}', serif;
    font-weight: ${h.common?.bold ? '700' : '400'};
    page-break-after: avoid;
    page-break-inside: avoid;
  }

  h1 {
    font-size: ${units.halfPointToPt(h.h1?.fontSize || 64)}pt;
    color: ${units.color(h.h1?.color)};
    margin-top: ${units.twipsToPt(h.h1?.spacing?.before || 480)}pt;
    margin-bottom: ${units.twipsToPt(h.h1?.spacing?.after || 240)}pt;
    ${h.h1?.border?.bottom ? `
    border-bottom: ${units.eighthPointToPt(h.h1.border.bottom.size || 6)}pt solid ${units.color(h.h1.border.bottom.color)};
    padding-bottom: ${h.h1.border.bottom.space || 6}px;
    ` : ''}
  }

  h2 {
    font-size: ${units.halfPointToPt(h.h2?.fontSize || 48)}pt;
    color: ${units.color(h.h2?.color)};
    margin-top: ${units.twipsToPt(h.h2?.spacing?.before || 400)}pt;
    margin-bottom: ${units.twipsToPt(h.h2?.spacing?.after || 200)}pt;
    ${h.h2?.border?.bottom ? `
    border-bottom: ${units.eighthPointToPt(h.h2.border.bottom.size || 6)}pt solid ${units.color(h.h2.border.bottom.color)};
    padding-bottom: ${h.h2.border.bottom.space || 4}px;
    ` : ''}
  }

  h3 {
    font-size: ${units.halfPointToPt(h.h3?.fontSize || 40)}pt;
    color: ${units.color(h.h3?.color)};
    margin-top: ${units.twipsToPt(h.h3?.spacing?.before || 320)}pt;
    margin-bottom: ${units.twipsToPt(h.h3?.spacing?.after || 160)}pt;
  }

  h4 {
    font-size: ${units.halfPointToPt(h.h4?.fontSize || 36)}pt;
    color: ${units.color(h.h4?.color)};
    margin-top: ${units.twipsToPt(h.h4?.spacing?.before || 240)}pt;
    margin-bottom: ${units.twipsToPt(h.h4?.spacing?.after || 120)}pt;
  }

  h5 {
    font-size: ${units.halfPointToPt(h.h5?.fontSize || 32)}pt;
    color: ${units.color(h.h5?.color)};
    margin-top: ${units.twipsToPt(h.h5?.spacing?.before || 200)}pt;
    margin-bottom: ${units.twipsToPt(h.h5?.spacing?.after || 100)}pt;
  }

  h6 {
    font-size: ${units.halfPointToPt(h.h6?.fontSize || 30)}pt;
    color: ${units.color(h.h6?.color)};
    margin-top: ${units.twipsToPt(h.h6?.spacing?.before || 160)}pt;
    margin-bottom: ${units.twipsToPt(h.h6?.spacing?.after || 80)}pt;
  }

  /* Keep heading with following content */
  h1 + p, h1 + .mermaid, h1 + pre, h1 + img, h1 + table,
  h2 + p, h2 + .mermaid, h2 + pre, h2 + img, h2 + table,
  h3 + p, h3 + .mermaid, h3 + pre, h3 + img, h3 + table {
    page-break-before: avoid;
  }

  /* ============================================================
   * 段落樣式 (from paragraph)
   * ============================================================ */
  p {
    margin: 0.8em 0;
    text-align: justify;
    orphans: 3;
    widows: 3;
  }

  /* ============================================================
   * 行內程式碼 (from paragraph.inlineCode)
   * ============================================================ */
  code {
    font-family: '${p.inlineCode?.font?.ascii || 'Consolas'}', 'Monaco', 'Courier New', monospace;
    background-color: ${units.color(p.inlineCode?.backgroundColor || 'f4f4f4')};
    color: ${units.color(p.inlineCode?.color)};
    padding: 2px 6px;
    border-radius: 3px;
    font-size: ${units.halfPointToPt(p.inlineCode?.fontSize || 22)}pt;
  }

  /* ============================================================
   * 程式碼區塊 (預處理為圖片，這裡是 fallback)
   * ============================================================ */
  pre {
    background-color: #f8f8f8;
    border: 1px solid #ddd;
    border-radius: 5px;
    padding: 15px;
    overflow-x: auto;
    page-break-inside: avoid;
    margin: 1em 0;
  }

  pre code {
    background-color: transparent;
    padding: 0;
    font-size: 0.85em;
    line-height: 1.4;
  }

  /* ============================================================
   * 連結樣式 (from link)
   * ============================================================ */
  a {
    color: ${units.color(link?.color || '0563C1')};
    text-decoration: ${link?.underline !== false ? 'underline' : 'none'};
  }

  a:hover {
    text-decoration: underline;
  }

  /* ============================================================
   * 引用區塊 (from blockquote)
   * ============================================================ */
  blockquote {
    border-left: ${units.eighthPointToPt(bq.border?.left?.size || 24)}pt solid ${units.color(bq.border?.left?.color || 'd1d9e0')};
    padding-left: ${units.twipsToPt(bq.indent?.left || 480)}pt;
    margin-left: 0;
    color: ${units.color(bq.text?.color || '656d76')};
    font-style: ${bq.text?.italic !== false ? 'italic' : 'normal'};
    ${bq.backgroundColor ? `background-color: ${units.color(bq.backgroundColor)};` : ''}
    padding: 10px 20px;
    page-break-inside: avoid;
  }

  /* ============================================================
   * 表格樣式 (from table)
   * ============================================================ */
  table {
    border-collapse: collapse;
    width: 100%;
    margin: 1em 0;
    page-break-inside: avoid;
    font-size: ${units.halfPointToPt(t.cell?.text?.fontSize || 24)}pt;
  }

  th, td {
    ${t.border?.enabled !== false ? `
    border: ${units.eighthPointToPt(t.border?.size || 6)}pt solid ${units.color(t.border?.color || 'd1d9e0')};
    ` : 'border: none;'}
    padding: ${units.twipsToPt(t.cell?.padding?.top || 80)}pt ${units.twipsToPt(t.cell?.padding?.right || 120)}pt;
    text-align: left;
    color: ${units.color(t.cell?.text?.color)};
  }

  th {
    background-color: ${units.color(t.header?.backgroundColor || 'f6f8fa')};
    color: ${units.color(t.header?.text?.color)};
    font-weight: ${t.header?.text?.bold !== false ? '700' : '400'};
  }

  ${t.alternateRow?.enabled !== false ? `
  tr:nth-child(even) {
    background-color: ${units.color(t.alternateRow?.backgroundColor || 'f9f9f9')};
  }
  ` : ''}

  /* ============================================================
   * 列表樣式 (from list)
   * ============================================================ */
  ul, ol {
    margin: 0.8em 0;
    padding-left: 2em;
  }

  li {
    margin: 0.3em 0;
  }

  /* 自訂項目符號 */
  ul li::marker {
    content: '${list.bullet?.level0 || '●'} ';
  }

  ul ul li::marker {
    content: '${list.bullet?.level1 || '○'} ';
  }

  ul ul ul li::marker {
    content: '${list.bullet?.level2 || '■'} ';
  }

  /* ============================================================
   * 分隔線 (from horizontalRule)
   * ============================================================ */
  hr {
    border: none;
    border-top: ${units.eighthPointToPt(hr?.size || 6)}pt solid ${units.color(hr?.color || 'd1d9e0')};
    margin: 2em 0;
  }

  /* ============================================================
   * 目錄樣式 (from toc)
   * ============================================================ */
  .table-of-contents {
    padding: 0;
    page-break-after: always !important;
    break-after: page !important;
    min-height: 100vh;
  }

  .table-of-contents h1 {
    font-size: ${units.halfPointToPt(toc.title?.fontSize || 48)}pt;
    color: ${units.color(toc.title?.color)};
    font-weight: ${toc.title?.bold ? '700' : '400'};
    margin-top: 0;
    margin-bottom: ${units.twipsToPt(toc.title?.spacing?.after || 480)}pt;
    border-bottom: 3px solid #3498db;
    padding-bottom: 0.3em;
    page-break-before: avoid;
  }

  .table-of-contents nav {
    line-height: 2;
  }

  .table-of-contents a {
    text-decoration: none;
    color: #2c3e50;
    display: block;
    padding: 8px 0;
    border-bottom: 1px ${toc.leader === 'dot' ? 'dotted' : toc.leader === 'hyphen' ? 'dashed' : 'solid'} #ddd;
  }

  .toc-h1 {
    font-size: ${units.halfPointToPt(toc.levels?.level1?.fontSize || 28)}pt;
    font-weight: ${toc.levels?.level1?.bold ? '700' : '400'};
    margin-left: ${units.twipsToPt(toc.levels?.level1?.indent || 0)}pt;
  }

  .toc-h2 {
    font-size: ${units.halfPointToPt(toc.levels?.level2?.fontSize || 26)}pt;
    font-weight: ${toc.levels?.level2?.bold ? '700' : '400'};
    margin-left: ${units.twipsToPt(toc.levels?.level2?.indent || 480)}pt;
  }

  /* ============================================================
   * HackMD 特殊區塊 (from hackmd)
   * ============================================================ */
  .info-block {
    background-color: ${units.color(hackmd?.info?.backgroundColor || 'e7f3ff')};
    border-left: ${units.eighthPointToPt(hackmd?.info?.borderLeft?.size || 24)}pt solid ${units.color(hackmd?.info?.borderLeft?.color || '0969da')};
    padding: 10px 20px;
    margin: 1em 0;
    color: ${units.color(hackmd?.info?.text?.color)};
  }

  .warning-block {
    background-color: ${units.color(hackmd?.warning?.backgroundColor || 'fff8e6')};
    border-left: ${units.eighthPointToPt(hackmd?.warning?.borderLeft?.size || 24)}pt solid ${units.color(hackmd?.warning?.borderLeft?.color || 'd4a72c')};
    padding: 10px 20px;
    margin: 1em 0;
    color: ${units.color(hackmd?.warning?.text?.color)};
  }

  .danger-block {
    background-color: ${units.color(hackmd?.danger?.backgroundColor || 'ffe7e7')};
    border-left: ${units.eighthPointToPt(hackmd?.danger?.borderLeft?.size || 24)}pt solid ${units.color(hackmd?.danger?.borderLeft?.color || 'd73a49')};
    padding: 10px 20px;
    margin: 1em 0;
    color: ${units.color(hackmd?.danger?.text?.color)};
  }

  .success-block {
    background-color: ${units.color(hackmd?.success?.backgroundColor || 'e6ffe6')};
    border-left: ${units.eighthPointToPt(hackmd?.success?.borderLeft?.size || 24)}pt solid ${units.color(hackmd?.success?.borderLeft?.color || '28a745')};
    padding: 10px 20px;
    margin: 1em 0;
    color: ${units.color(hackmd?.success?.text?.color)};
  }

  /* ============================================================
   * 圖片樣式 (from image)
   * ============================================================ */
  img {
    max-width: 100%;
    max-height: 85vh;
    height: auto;
    display: block;
    margin: 1em auto;
    page-break-inside: avoid;
    break-inside: avoid;
    object-fit: contain;
  }

  /* 圖片容器 - 確保不跨頁 */
  .image-container {
    display: block;
    page-break-inside: avoid;
    break-inside: avoid;
    page-break-before: auto;
    page-break-after: auto;
    margin: 1em 0;
    text-align: center;
  }

  .image-container img {
    margin: 0 auto;
  }

  /* 大圖片自動縮小以適應頁面 */
  .image-container.large-image img {
    max-height: 80vh;
    width: auto;
  }

  /* ============================================================
   * Mermaid 圖表
   * ============================================================ */
  .mermaid {
    display: flex;
    justify-content: center;
    align-items: center;
    margin: 2em 0;
    page-break-inside: avoid;
    page-break-before: auto;
    page-break-after: auto;
    max-height: 90vh;
    overflow: hidden;
  }

  .mermaid svg {
    max-width: 100% !important;
    max-height: 90vh !important;
    height: auto !important;
    width: auto !important;
    object-fit: contain;
  }

  /* ============================================================
   * 分頁控制
   * ============================================================ */
  .heading-group {
    display: table;
    width: 100%;
    page-break-inside: avoid;
    margin: 0;
    padding: 0;
  }

  .force-page-break-before {
    page-break-before: always !important;
  }

  .h2-page-break {
    page-break-before: always;
    height: 0;
    margin: 0;
    padding: 0;
  }

  /* Scaling classes */
  .scale-60 { transform: scale(0.6); transform-origin: top center; margin-bottom: -40%; }
  .scale-70 { transform: scale(0.7); transform-origin: top center; margin-bottom: -30%; }
  .scale-80 { transform: scale(0.8); transform-origin: top center; margin-bottom: -20%; }
  .scale-90 { transform: scale(0.9); transform-origin: top center; margin-bottom: -10%; }

  /* ============================================================
   * 列印設定
   * ============================================================ */
  @page {
    margin: 20mm;
    size: A4;
  }

  @media print {
    body { padding: 0; }
    h1, h2, h3, h4, h5, h6 { page-break-after: avoid; page-break-inside: avoid; }
    h1 + *, h2 + *, h3 + * { page-break-before: avoid; }
    img, table, pre, blockquote, .mermaid, .heading-group, .image-container {
      page-break-inside: avoid;
      break-inside: avoid;
    }
    a { color: ${units.color(link?.color || '0563C1')}; text-decoration: none; }

    .mermaid {
      max-height: calc(297mm - 80mm);
      max-width: calc(210mm - 80mm);
    }

    img {
      max-height: calc(297mm - 60mm);
      width: auto;
    }

    .image-container {
      page-break-inside: avoid !important;
      break-inside: avoid !important;
    }
  }
</style>
`;
}

/**
 * 生成頁尾 HTML（用於 Puppeteer）
 */
function generateFooterTemplate(styles) {
  const footer = styles?.footer;
  if (!footer?.enabled) return '';

  const pn = footer.pageNumber;
  if (!pn?.enabled) return '';

  const alignMap = { left: 'flex-start', center: 'center', right: 'flex-end' };

  return `
    <div style="font-size: ${units.halfPointToPt(pn.fontSize || 20)}pt;
                width: 100%;
                display: flex;
                justify-content: ${alignMap[pn.alignment] || 'center'};
                padding: 0 20mm;
                color: ${units.color(pn.color || '888888')};
                font-family: 'Noto Sans TC', sans-serif;">
      <span class="pageNumber"></span> / <span class="totalPages"></span>
    </div>
  `;
}

module.exports = {
  generatePdfCss,
  generateFooterTemplate,
  units
};

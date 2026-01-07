const fs = require('fs');
const path = require('path');
const { marked } = require('marked');
const {
  Document,
  Paragraph,
  TextRun,
  HeadingLevel,
  AlignmentType,
  ImageRun,
  Table,
  TableCell,
  TableRow,
  WidthType,
  PageBreak,
  TableOfContents,
  Header,
  Footer,
  PageNumber,
  NumberFormat,
  convertInchesToTwip,
  BorderStyle,
  UnderlineType,
  ShadingType,
  LevelFormat
} = require('docx');
const { Packer } = require('docx');
const sharp = require('sharp');
const puppeteer = require('puppeteer');

// 預設樣式設定與共用模組
const defaultStyles = require('../styles/default');
const { getPrismHtmlTags } = require('./prismResources');

/**
 * ============================================================================
 * MD to DOCX Complete - 功能最完整的 Markdown 轉 DOCX 轉換器
 * ============================================================================
 *
 * 整合自：
 * - mdToDocx.js (基本版)
 * - mdToDocxAdvanced.js (進階版)
 * - mdToDocxPipeline.js (管線版)
 *
 * 完整功能：
 * - HackMD 語法預處理 (:::info, :::warning 等)
 * - 特殊格式 (==螢光==, ++底線++, ^上標^, ~下標~)
 * - HTML 實體解碼
 * - 標題 H1-H6 (GitHub 風格)
 * - 智慧分頁 (H1 前分頁、標題與內容保持連續)
 * - 段落格式 (粗體、斜體、刪除線、行內程式碼、連結)
 * - 列表 (有序/無序/巢狀/核取方塊)
 * - 表格 (自適應字體、對齊、跨頁表頭重複)
 * - 引用區塊 (完整格式解析)
 * - 程式碼區塊 (圖片模式 + Prism.js 語法高亮)
 * - 圖片處理 (本地圖片、SVG 轉 PNG)
 * - 封面頁
 * - 目錄 (Word 內建)
 * - 頁首/頁尾/頁碼
 * - Mermaid 圖表預處理 (可選)
 *
 * 作者：Claude Code
 * 版本：1.0.0
 * ============================================================================
 */

/**
 * 預處理 HackMD 特殊語法
 * 將 HackMD 專用語法轉換為標準 Markdown 或內部標記
 */
function preprocessHackMD(content) {
  let result = content;

  // 處理 HackMD 區塊語法 :::info, :::warning, :::danger, :::success, :::spoiler
  result = result.replace(/^:::(info|warning|danger|success|spoiler)(?:\s+(.+))?\n([\s\S]*?)^:::/gm, (match, type, title, content) => {
    const typeMap = {
      info: { emoji: 'ℹ️', label: '資訊' },
      warning: { emoji: '⚠️', label: '警告' },
      danger: { emoji: '🚫', label: '危險' },
      success: { emoji: '✅', label: '成功' },
      spoiler: { emoji: '👁️', label: title || '點擊展開' }
    };
    const config = typeMap[type] || { emoji: '📌', label: type };
    const header = title ? `**${config.emoji} ${title}**` : `**${config.emoji} ${config.label}**`;
    return `> ${header}\n> \n${content.split('\n').map(line => `> ${line}`).join('\n')}\n`;
  });

  // 處理 ==螢光標記== (HackMD 語法)
  result = result.replace(/==([^=]+)==/g, '{{highlight}}$1{{/highlight}}');

  // 處理 ++底線++ (HackMD 語法)
  result = result.replace(/\+\+([^+]+)\+\+/g, '{{underline}}$1{{/underline}}');

  // 處理 ^上標^ (HackMD 語法)
  result = result.replace(/\^([^^]+)\^/g, '{{superscript}}$1{{/superscript}}');

  // 處理 ~下標~ (HackMD 語法，注意要避免與 ~~刪除線~~ 衝突)
  // 只匹配不含空格的短內容（如 H~2~O），避免誤判 ~40 個 Entities~ 這類用法
  result = result.replace(/(?<!~)~([^~\s]+)~(?!~)/g, '{{subscript}}$1{{/subscript}}');

  return result;
}

/**
 * 解碼 HTML 實體字元
 */
function decodeHtmlEntities(text) {
  if (!text) return text;

  // HTML 實體對照表
  const entities = {
    '&emsp;': '',      // 全形空格 - 移除
    '&ensp;': '',      // 半形空格 - 移除
    '&nbsp;': ' ',     // 不換行空格 - 轉為普通空格
    '&lt;': '<',
    '&gt;': '>',
    '&amp;': '&',
    '&quot;': '"',
    '&apos;': "'",
    '&#39;': "'",
    '&copy;': '©',
    '&reg;': '®',
    '&trade;': '™',
    '&mdash;': '—',
    '&ndash;': '–',
    '&hellip;': '…',
    '&bull;': '•',
    '&middot;': '·',
    '&laquo;': '«',
    '&raquo;': '»',
    '&times;': '×',
    '&divide;': '÷',
    '&plusmn;': '±'
  };

  let result = text;
  for (const [entity, char] of Object.entries(entities)) {
    result = result.split(entity).join(char);
  }

  // 處理數字型 HTML 實體（如 &#160;）
  result = result.replace(/&#(\d+);/g, (match, dec) => {
    const code = parseInt(dec, 10);
    // 對於空格類字元，轉為普通空格或移除
    if (code === 160 || code === 8194 || code === 8195) {
      return ' ';
    }
    return String.fromCharCode(code);
  });

  // 處理十六進位 HTML 實體（如 &#x00A0;）
  result = result.replace(/&#x([0-9A-Fa-f]+);/g, (match, hex) => {
    const code = parseInt(hex, 16);
    if (code === 160 || code === 8194 || code === 8195) {
      return ' ';
    }
    return String.fromCharCode(code);
  });

  return result;
}

/**
 * 完整版 Markdown 轉 DOCX 轉換器
 * 整合所有功能的最終版本
 */
class CompleteMarkdownToDocxConverter {
  constructor(mdContent, mdFilePath, options = {}) {
    this.mdContent = mdContent;
    this.mdFilePath = mdFilePath;
    this.mdDir = path.dirname(mdFilePath);
    this.browser = null;

    // 載入樣式設定（支援自訂樣式檔案或使用預設樣式）
    this.styles = this.loadStyles(options.stylesPath);

    // 完整選項設定
    this.options = {
      // 文件結構選項
      addCover: options.addCover !== false,           // 預設添加封面
      addTOC: options.addTOC !== false,               // 預設添加目錄
      addPageNumbers: options.addPageNumbers !== false, // 預設添加頁碼
      h1PageBreak: options.h1PageBreak !== false,     // H1 前分頁

      // 文件資訊
      title: options.title || '文件標題',
      subtitle: options.subtitle || '',
      author: options.author || '',
      date: options.date || new Date().toLocaleDateString('zh-TW'),

      // 程式碼區塊選項
      codeBlockAsImage: options.codeBlockAsImage !== false,  // 程式碼區塊轉圖片

      // Mermaid 預處理（需要外部模組）
      processMermaid: options.processMermaid || false,

      // 樣式選項（從樣式設定取得預設值）
      fontFamily: options.fontFamily || this.styles.document.defaultFont.ascii,
      codeFontFamily: options.codeFontFamily || this.styles.codeBlock.code.fontFamily.split(',')[0].replace(/'/g, '').trim()
    };

    // 收集標題用於目錄
    this.headings = [];

    // 計數器
    this.h1Count = 0;
    this.diagramCount = 0;
    this.codeCount = 0;
    this.codeBlockCount = 0;
    this.maxCodeBlocksBeforeRestart = 10;
  }

  /**
   * 載入樣式設定
   * @param {string} stylesPath - 自訂樣式檔案路徑（可選）
   * @returns {object} 合併後的樣式設定
   */
  loadStyles(stylesPath) {
    let customStyles = {};

    if (stylesPath) {
      try {
        const absolutePath = path.isAbsolute(stylesPath)
          ? stylesPath
          : path.resolve(process.cwd(), stylesPath);

        if (fs.existsSync(absolutePath)) {
          customStyles = require(absolutePath);
          console.log(`已載入自訂樣式: ${absolutePath}`);
        } else {
          console.warn(`樣式檔案不存在: ${absolutePath}，使用預設樣式`);
        }
      } catch (error) {
        console.warn(`載入樣式檔案失敗: ${error.message}，使用預設樣式`);
      }
    }

    // 深度合併樣式（自訂樣式覆蓋預設樣式）
    return this.deepMerge(defaultStyles, customStyles);
  }

  /**
   * 深度合併物件
   */
  deepMerge(target, source) {
    const result = { ...target };

    for (const key of Object.keys(source)) {
      if (source[key] !== null &&
          typeof source[key] === 'object' &&
          !Array.isArray(source[key]) &&
          target[key] !== null &&
          typeof target[key] === 'object' &&
          !Array.isArray(target[key])) {
        result[key] = this.deepMerge(target[key], source[key]);
      } else {
        result[key] = source[key];
      }
    }

    return result;
  }

  /**
   * 使用 Puppeteer 將 SVG 轉換為 PNG
   */
  async convertSvgToPng(svgPath) {
    let page = null;
    try {
      if (!this.browser) {
        this.browser = await puppeteer.launch({
          headless: true,
          args: ['--no-sandbox', '--disable-setuid-sandbox']
        });
      }

      const svgContent = fs.readFileSync(svgPath, 'utf8');

      const html = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <style>
            body {
              margin: 0;
              padding: 20px;
              display: flex;
              justify-content: center;
              align-items: center;
              background: white;
            }
            svg {
              max-width: 100%;
              height: auto;
            }
          </style>
        </head>
        <body>
          ${svgContent}
        </body>
        </html>
      `;

      page = await this.browser.newPage();
      await page.setContent(html, { waitUntil: 'load' });

      const dimensions = await page.evaluate(() => {
        const svg = document.querySelector('svg');
        if (svg) {
          const bbox = svg.getBoundingClientRect();
          return {
            width: Math.ceil(bbox.width),
            height: Math.ceil(bbox.height)
          };
        }
        return { width: 800, height: 600 };
      });

      await page.setViewport({
        width: dimensions.width + 40,
        height: dimensions.height + 40,
        deviceScaleFactor: 2
      });

      const screenshot = await page.screenshot({
        type: 'png',
        omitBackground: false
      });

      return screenshot;
    } catch (error) {
      console.error(`  Puppeteer SVG 轉換失敗: ${error.message}`);
      throw error;
    } finally {
      if (page) {
        try { await page.close(); } catch (e) { /* ignore */ }
      }
    }
  }

  /**
   * 使用 Puppeteer 將程式碼區塊轉換為圖片
   */
  async convertCodeBlockToImage(code, language) {
    let page = null;
    try {
      if (!this.browser || !this.browser.isConnected()) {
        console.log('  啟動新的瀏覽器實例...');
        this.browser = await puppeteer.launch({
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
      }

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

      // 從樣式設定取得程式碼區塊樣式
      const codeStyles = this.styles.codeBlock;
      const lineNumberColor = codeStyles.lineNumbers?.color || '858585';
      const lineNumberBorder = codeStyles.lineNumbers?.borderRight || '1px solid #555';
      const headerBg = codeStyles.header?.backgroundColor || '1e1e1e';
      const headerTextColor = codeStyles.header?.text?.color || '858585';
      const contentBg = codeStyles.content?.backgroundColor || '2d2d2d';
      const codeFontSize = codeStyles.code?.fontSize || 14;
      const codeLineHeight = codeStyles.code?.lineHeight || 1.6;

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
            .code-header {
              background: #${headerBg};
              color: #${headerTextColor};
              padding: 8px 20px;
              border-radius: 0;
              font-size: 12px;
              font-family: 'Consolas', 'Monaco', 'Courier New', monospace;
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

      page = await this.browser.newPage();
      page.setDefaultTimeout(30000); // 增加超時時間

      try {
        await page.setContent(html, { waitUntil: 'load', timeout: 30000 });
      } catch (e) {
        console.warn('  ⚠ 頁面載入超時或失敗，嘗試繼續渲染...');
      }
      await new Promise(resolve => setTimeout(resolve, 300));

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

      const screenshot = await page.screenshot({
        type: 'png',
        omitBackground: false,
        fullPage: true
      });

      return screenshot;
    } catch (error) {
      console.error(`  程式碼區塊轉換失敗: ${error.message}`);
      throw error;
    } finally {
      if (page) {
        try { await page.close(); } catch (e) { /* ignore */ }
      }
    }
  }

  /**
   * 重啟瀏覽器（釋放資源）
   */
  async restartBrowser() {
    console.log('  重啟瀏覽器以釋放資源...');
    if (this.browser) {
      try { await this.browser.close(); } catch (e) { /* ignore */ }
      this.browser = null;
    }
    this.codeBlockCount = 0;
  }

  /**
   * 關閉 browser
   */
  async cleanup() {
    if (this.browser) {
      try { await this.browser.close(); } catch (e) { /* ignore */ }
      this.browser = null;
    }
  }

  /**
   * 創建封面頁
   */
  createCoverPage() {
    console.log('  生成封面頁...');
    const coverStyle = this.styles.cover;

    const children = [
      // 標題
      new Paragraph({
        children: [
          new TextRun({
            text: this.options.title,
            size: coverStyle.title?.fontSize || 72,
            bold: coverStyle.title?.bold !== false,
            font: this.options.fontFamily,
            color: coverStyle.title?.color || '1f2328'
          })
        ],
        alignment: AlignmentType.CENTER,
        spacing: coverStyle.title?.spacing || { before: 2400, after: 480 }
      })
    ];

    // 副標題（如果有）
    if (this.options.subtitle) {
      children.push(
        new Paragraph({
          children: [
            new TextRun({
              text: this.options.subtitle,
              size: coverStyle.subtitle?.fontSize || 36,
              font: this.options.fontFamily,
              color: coverStyle.subtitle?.color || '656d76'
            })
          ],
          alignment: AlignmentType.CENTER,
          spacing: coverStyle.subtitle?.spacing || { before: 240, after: 240 }
        })
      );
    }

    // 作者（如果有）
    if (this.options.author) {
      children.push(
        new Paragraph({
          children: [
            new TextRun({
              text: `作者：${this.options.author}`,
              size: coverStyle.author?.fontSize || 28,
              font: this.options.fontFamily,
              color: coverStyle.author?.color || '656d76'
            })
          ],
          alignment: AlignmentType.CENTER,
          spacing: coverStyle.author?.spacing || { before: 960, after: 120 }
        })
      );
    }

    // 日期
    children.push(
      new Paragraph({
        children: [
          new TextRun({
            text: `日期：${this.options.date}`,
            size: coverStyle.date?.fontSize || 24,
            font: this.options.fontFamily,
            color: coverStyle.date?.color || '656d76'
          })
        ],
        alignment: AlignmentType.CENTER,
        spacing: coverStyle.date?.spacing || { before: 120, after: 120 }
      })
    );

    // 分頁
    children.push(
      new Paragraph({
        children: [new PageBreak()],
        spacing: { before: 0, after: 0 }
      })
    );

    return children;
  }

  /**
   * 創建目錄頁
   */
  createTOCPage() {
    console.log('  生成目錄...');
    const tocStyle = this.styles.toc;
    const tocTitle = tocStyle.title?.text || '目錄';

    return [
      new Paragraph({
        children: [
          new TextRun({
            text: tocTitle,
            size: tocStyle.title?.fontSize || 48,
            bold: tocStyle.title?.bold !== false,
            font: this.options.fontFamily,
            color: tocStyle.title?.color || '1f2328'
          })
        ],
        heading: HeadingLevel.HEADING_1,
        spacing: tocStyle.title?.spacing || { before: 0, after: 480 }
      }),
      new TableOfContents(tocTitle, {
        hyperlink: true,
        headingStyleRange: '1-3'
      }),
      new Paragraph({
        children: [new PageBreak()],
        spacing: { before: 0, after: 0 }
      })
    ];
  }

  /**
   * 轉換 Markdown 為 DOCX Document
   */
  async convert() {
    // 預處理 HackMD 特殊語法
    const processedContent = preprocessHackMD(this.mdContent);
    const tokens = marked.lexer(processedContent);

    // 提取文件標題（第一個 H1）
    const firstH1 = tokens.find(t => t.type === 'heading' && t.depth === 1);
    if (firstH1 && this.options.title === '文件標題') {
      this.options.title = firstH1.text;
    }

    const sections = [];

    // 1. 封面頁
    if (this.options.addCover) {
      sections.push({
        properties: {
          page: {
            margin: {
              top: convertInchesToTwip(1),
              right: convertInchesToTwip(1),
              bottom: convertInchesToTwip(1),
              left: convertInchesToTwip(1)
            }
          }
        },
        children: this.createCoverPage()
      });
    }

    // 2. 目錄頁
    if (this.options.addTOC) {
      sections.push({
        properties: {
          page: {
            margin: {
              top: convertInchesToTwip(1),
              right: convertInchesToTwip(1),
              bottom: convertInchesToTwip(1),
              left: convertInchesToTwip(1)
            },
            pageNumbers: {
              start: 1,
              formatType: NumberFormat.DECIMAL
            }
          }
        },
        children: this.createTOCPage()
      });
    }

    // 3. 內容頁
    const contentChildren = [];

    for (let i = 0; i < tokens.length; i++) {
      const token = tokens[i];

      // H1 前分頁（除了第一個）
      if (token.type === 'heading' && token.depth === 1 && this.h1Count > 0 && this.options.h1PageBreak) {
        contentChildren.push(
          new Paragraph({
            children: [new PageBreak()],
            spacing: { before: 0, after: 0 }
          })
        );
      }

      await this.processToken(token, contentChildren);
    }

    // 創建頁首
    const headerStyle = this.styles.header;
    const headerEnabled = this.options.addPageNumbers && headerStyle.enabled !== false;
    const headerContent = headerEnabled ? {
      default: new Header({
        children: [
          new Paragraph({
            children: [
              new TextRun({
                text: this.options.title,
                size: headerStyle.text?.fontSize || 20,
                font: this.options.fontFamily,
                color: headerStyle.text?.color || '888888'
              })
            ],
            alignment: headerStyle.text?.alignment === 'center' ? AlignmentType.CENTER :
                       headerStyle.text?.alignment === 'right' ? AlignmentType.RIGHT : AlignmentType.LEFT,
            border: headerStyle.border?.bottom?.enabled !== false ? {
              bottom: {
                color: headerStyle.border?.bottom?.color || 'cccccc',
                space: 1,
                style: BorderStyle.SINGLE,
                size: headerStyle.border?.bottom?.size || 4
              }
            } : undefined
          })
        ]
      })
    } : undefined;

    // 創建頁尾
    const footerStyle = this.styles.footer;
    const footerEnabled = this.options.addPageNumbers && footerStyle.enabled !== false;
    const footerContent = footerEnabled ? {
      default: new Footer({
        children: [
          new Paragraph({
            children: [
              new TextRun({
                text: '第 ',
                size: footerStyle.pageNumber?.fontSize || 20,
                font: this.options.fontFamily,
                color: footerStyle.pageNumber?.color || '888888'
              }),
              new TextRun({
                children: [PageNumber.CURRENT],
                size: footerStyle.pageNumber?.fontSize || 20,
                font: this.options.fontFamily,
                color: footerStyle.pageNumber?.color || '888888'
              }),
              new TextRun({
                text: ' 頁',
                size: footerStyle.pageNumber?.fontSize || 20,
                font: this.options.fontFamily,
                color: footerStyle.pageNumber?.color || '888888'
              })
            ],
            alignment: footerStyle.pageNumber?.alignment === 'left' ? AlignmentType.LEFT :
                       footerStyle.pageNumber?.alignment === 'right' ? AlignmentType.RIGHT : AlignmentType.CENTER
          })
        ]
      })
    } : undefined;

    sections.push({
      properties: {
        page: {
          margin: {
            top: convertInchesToTwip(1),
            right: convertInchesToTwip(1),
            bottom: convertInchesToTwip(1),
            left: convertInchesToTwip(1)
          },
          pageNumbers: {
            start: this.options.addCover || this.options.addTOC ? undefined : 1,
            formatType: NumberFormat.DECIMAL
          }
        }
      },
      headers: headerContent,
      footers: footerContent,
      children: contentChildren
    });

    // 從樣式設定建立 Document styles
    const h = this.styles.headings;
    const listStyle = this.styles.list;
    const baseIndent = listStyle.indent?.left || 720;
    const hangingIndent = listStyle.indent?.hanging || 360;

    // 建立項目符號和編號列表的 numbering 配置
    const numberingConfig = {
      config: [
        // 無序列表（項目符號）
        {
          reference: "bullet-list",
          levels: [
            {
              level: 0,
              format: LevelFormat.BULLET,
              text: listStyle.bullet?.level0 || "●",
              alignment: AlignmentType.LEFT,
              style: {
                paragraph: {
                  indent: { left: baseIndent, hanging: hangingIndent }
                }
              }
            },
            {
              level: 1,
              format: LevelFormat.BULLET,
              text: listStyle.bullet?.level1 || "○",
              alignment: AlignmentType.LEFT,
              style: {
                paragraph: {
                  indent: { left: baseIndent * 2, hanging: hangingIndent }
                }
              }
            },
            {
              level: 2,
              format: LevelFormat.BULLET,
              text: listStyle.bullet?.level2 || "■",
              alignment: AlignmentType.LEFT,
              style: {
                paragraph: {
                  indent: { left: baseIndent * 3, hanging: hangingIndent }
                }
              }
            },
            {
              level: 3,
              format: LevelFormat.BULLET,
              text: listStyle.bullet?.level3 || "●",
              alignment: AlignmentType.LEFT,
              style: {
                paragraph: {
                  indent: { left: baseIndent * 4, hanging: hangingIndent }
                }
              }
            },
            {
              level: 4,
              format: LevelFormat.BULLET,
              text: listStyle.bullet?.level4 || "○",
              alignment: AlignmentType.LEFT,
              style: {
                paragraph: {
                  indent: { left: baseIndent * 5, hanging: hangingIndent }
                }
              }
            },
            {
              level: 5,
              format: LevelFormat.BULLET,
              text: listStyle.bullet?.level5 || "■",
              alignment: AlignmentType.LEFT,
              style: {
                paragraph: {
                  indent: { left: baseIndent * 6, hanging: hangingIndent }
                }
              }
            }
          ]
        },
        // 有序列表（編號）
        {
          reference: "numbered-list",
          levels: [
            {
              level: 0,
              format: LevelFormat.DECIMAL,
              text: "%1.",
              alignment: AlignmentType.LEFT,
              style: {
                paragraph: {
                  indent: { left: baseIndent, hanging: hangingIndent }
                }
              }
            },
            {
              level: 1,
              format: LevelFormat.LOWER_LETTER,
              text: "%2.",
              alignment: AlignmentType.LEFT,
              style: {
                paragraph: {
                  indent: { left: baseIndent * 2, hanging: hangingIndent }
                }
              }
            },
            {
              level: 2,
              format: LevelFormat.LOWER_ROMAN,
              text: "%3.",
              alignment: AlignmentType.LEFT,
              style: {
                paragraph: {
                  indent: { left: baseIndent * 3, hanging: hangingIndent }
                }
              }
            },
            {
              level: 3,
              format: LevelFormat.DECIMAL,
              text: "%4.",
              alignment: AlignmentType.LEFT,
              style: {
                paragraph: {
                  indent: { left: baseIndent * 4, hanging: hangingIndent }
                }
              }
            },
            {
              level: 4,
              format: LevelFormat.LOWER_LETTER,
              text: "%5.",
              alignment: AlignmentType.LEFT,
              style: {
                paragraph: {
                  indent: { left: baseIndent * 5, hanging: hangingIndent }
                }
              }
            },
            {
              level: 5,
              format: LevelFormat.LOWER_ROMAN,
              text: "%6.",
              alignment: AlignmentType.LEFT,
              style: {
                paragraph: {
                  indent: { left: baseIndent * 6, hanging: hangingIndent }
                }
              }
            }
          ]
        }
      ]
    };

    const doc = new Document({
      numbering: numberingConfig,
      styles: {
        default: {
          heading1: {
            run: {
              size: h.h1.fontSize,
              bold: h.common.bold,
              color: h.h1.color,
              font: this.options.fontFamily
            },
            paragraph: {
              spacing: h.h1.spacing
            }
          },
          heading2: {
            run: {
              size: h.h2.fontSize,
              bold: h.common.bold,
              color: h.h2.color,
              font: this.options.fontFamily
            },
            paragraph: {
              spacing: h.h2.spacing
            }
          },
          heading3: {
            run: {
              size: h.h3.fontSize,
              bold: h.common.bold,
              color: h.h3.color,
              font: this.options.fontFamily
            },
            paragraph: {
              spacing: h.h3.spacing
            }
          },
          heading4: {
            run: {
              size: h.h4.fontSize,
              bold: h.common.bold,
              color: h.h4.color,
              font: this.options.fontFamily
            },
            paragraph: {
              spacing: h.h4.spacing
            }
          },
          heading5: {
            run: {
              size: h.h5.fontSize,
              bold: h.common.bold,
              color: h.h5.color,
              font: this.options.fontFamily
            },
            paragraph: {
              spacing: h.h5.spacing
            }
          },
          heading6: {
            run: {
              size: h.h6.fontSize,
              bold: h.common.bold,
              color: h.h6.color,
              font: this.options.fontFamily
            },
            paragraph: {
              spacing: h.h6.spacing
            }
          }
        }
      },
      features: {
        updateFields: true  // 讓 Word 開啟時自動更新目錄頁碼
      },
      sections: sections
    });

    return doc;
  }

  /**
   * 處理 Token
   */
  async processToken(token, children) {
    switch (token.type) {
      case 'heading':
        this.addHeading(token, children);
        break;
      case 'paragraph':
        await this.addParagraph(token, children);
        break;
      case 'list':
        this.addList(token, children);
        break;
      case 'blockquote':
        this.addBlockquote(token, children);
        break;
      case 'code':
        await this.addCodeBlock(token, children);
        break;
      case 'table':
        this.addTable(token, children);
        break;
      case 'hr':
        this.addHorizontalRule(children);
        break;
      case 'space':
        break;
      default:
        console.log(`未處理的 token 類型: ${token.type}`);
    }
  }

  /**
   * 添加標題
   */
  addHeading(token, children) {
    const levelMap = {
      1: HeadingLevel.HEADING_1,
      2: HeadingLevel.HEADING_2,
      3: HeadingLevel.HEADING_3,
      4: HeadingLevel.HEADING_4,
      5: HeadingLevel.HEADING_5,
      6: HeadingLevel.HEADING_6
    };

    // 從樣式設定取得標題樣式
    const h = this.styles.headings;
    const headingStyleMap = {
      1: h.h1,
      2: h.h2,
      3: h.h3,
      4: h.h4,
      5: h.h5,
      6: h.h6
    };

    const headingStyle = headingStyleMap[token.depth] || h.h1;

    // H1 計數
    if (token.depth === 1) {
      this.h1Count++;
    }

    // 收集標題用於目錄
    this.headings.push({
      level: token.depth,
      text: token.text
    });

    // 建立邊框設定（如果有）
    let borderConfig = undefined;
    if (headingStyle.border && headingStyle.border.bottom) {
      borderConfig = {
        bottom: {
          color: headingStyle.border.bottom.color,
          space: headingStyle.border.bottom.space || 1,
          style: BorderStyle.SINGLE,
          size: headingStyle.border.bottom.size
        }
      };
    }

    children.push(
      new Paragraph({
        children: [
          new TextRun({
            text: decodeHtmlEntities(token.text),
            size: headingStyle.fontSize,
            color: headingStyle.color,
            bold: h.common.bold,
            font: this.options.fontFamily
          })
        ],
        heading: levelMap[token.depth] || HeadingLevel.HEADING_1,
        spacing: headingStyle.spacing,
        keepNext: true,
        keepLines: true,
        border: borderConfig
      })
    );
  }

  /**
   * 添加段落
   */
  async addParagraph(token, children) {
    const textRuns = await this.parseInlineTokens(token.tokens || []);
    const hasImage = token.tokens && token.tokens.some(t => t.type === 'image');

    if (hasImage) {
      for (const t of token.tokens) {
        if (t.type === 'image') {
          await this.addImage(t, children);
        }
      }
    } else if (textRuns.length > 0) {
      children.push(
        new Paragraph({
          children: textRuns,
          spacing: {
            after: 160,
            line: 360,
            lineRule: 'auto'
          }
        })
      );
    }
  }

  /**
   * 解析特殊格式標記（螢光、底線、上標、下標）
   * 來自 mdToDocx.js
   */
  parseSpecialFormats(text) {
    const runs = [];
    const regex = /\{\{(highlight|underline|superscript|subscript)\}\}(.*?)\{\{\/\1\}\}/g;
    let lastIndex = 0;
    let match;

    // 從樣式設定取得段落樣式
    const pStyle = this.styles.paragraph;
    const textSize = pStyle.text?.fontSize || 24;
    const textColor = pStyle.text?.color || '1f2328';
    const superSize = pStyle.superscript?.fontSize || 20;
    const subSize = pStyle.subscript?.fontSize || 20;

    while ((match = regex.exec(text)) !== null) {
      // 添加前面的普通文字
      if (match.index > lastIndex) {
        runs.push(new TextRun({
          text: text.substring(lastIndex, match.index),
          size: textSize,
          font: this.options.fontFamily,
          color: textColor
        }));
      }

      const formatType = match[1];
      const content = match[2];

      switch (formatType) {
        case 'highlight':
          runs.push(new TextRun({
            text: content,
            size: textSize,
            font: this.options.fontFamily,
            color: textColor,
            highlight: 'yellow'
          }));
          break;
        case 'underline':
          runs.push(new TextRun({
            text: content,
            size: textSize,
            font: this.options.fontFamily,
            color: textColor,
            underline: { type: UnderlineType.SINGLE }
          }));
          break;
        case 'superscript':
          runs.push(new TextRun({
            text: content,
            size: superSize,
            font: this.options.fontFamily,
            color: textColor,
            superScript: true
          }));
          break;
        case 'subscript':
          runs.push(new TextRun({
            text: content,
            size: subSize,
            font: this.options.fontFamily,
            color: textColor,
            subScript: true
          }));
          break;
      }

      lastIndex = regex.lastIndex;
    }

    // 添加剩餘的普通文字
    if (lastIndex < text.length) {
      runs.push(new TextRun({
        text: text.substring(lastIndex),
        size: textSize,
        font: this.options.fontFamily,
        color: textColor
      }));
    }

    // 如果沒有任何特殊格式，返回原始文字
    if (runs.length === 0) {
      runs.push(new TextRun({
        text: text,
        size: textSize,
        font: this.options.fontFamily,
        color: textColor
      }));
    }

    return runs;
  }

  /**
   * 解析行內元素
   */
  async parseInlineTokens(tokens) {
    const runs = [];

    // 從樣式設定取得段落和連結樣式
    const pStyle = this.styles.paragraph;
    const linkStyle = this.styles.link;
    const textSize = pStyle.text?.fontSize || 24;
    const textColor = pStyle.text?.color || '1f2328';
    const codeSize = pStyle.inlineCode?.fontSize || 22;
    const codeColor = pStyle.inlineCode?.color || '1f2328';
    const linkColor = linkStyle.color || '0563C1';

    for (const token of tokens) {
      switch (token.type) {
        case 'text':
          // 處理 HackMD 特殊格式標記，先解碼 HTML 實體
          const textRuns = this.parseSpecialFormats(decodeHtmlEntities(token.text));
          runs.push(...textRuns);
          break;
        case 'strong':
          if (token.tokens && token.tokens.length > 0) {
            for (const innerToken of token.tokens) {
              runs.push(new TextRun({
                text: decodeHtmlEntities(innerToken.text || innerToken.raw || ''),
                bold: true,
                size: textSize,
                font: this.options.fontFamily,
                color: textColor
              }));
            }
          } else {
            runs.push(new TextRun({
              text: decodeHtmlEntities(token.text),
              bold: true,
              size: textSize,
              font: this.options.fontFamily,
              color: textColor
            }));
          }
          break;
        case 'em':
          if (token.tokens && token.tokens.length > 0) {
            for (const innerToken of token.tokens) {
              runs.push(new TextRun({
                text: decodeHtmlEntities(innerToken.text || innerToken.raw || ''),
                italics: true,
                size: textSize,
                font: this.options.fontFamily,
                color: textColor
              }));
            }
          } else {
            runs.push(new TextRun({
              text: decodeHtmlEntities(token.text),
              italics: true,
              size: textSize,
              font: this.options.fontFamily,
              color: textColor
            }));
          }
          break;
        case 'del':
          if (token.tokens && token.tokens.length > 0) {
            for (const innerToken of token.tokens) {
              runs.push(new TextRun({
                text: decodeHtmlEntities(innerToken.text || innerToken.raw || ''),
                strike: true,
                size: textSize,
                font: this.options.fontFamily,
                color: textColor
              }));
            }
          } else {
            runs.push(new TextRun({
              text: decodeHtmlEntities(token.text),
              strike: true,
              size: textSize,
              font: this.options.fontFamily,
              color: textColor
            }));
          }
          break;
        case 'codespan':
          const inlineCodeBg = pStyle.inlineCode?.backgroundColor;
          runs.push(new TextRun({
            text: decodeHtmlEntities(token.text),
            font: pStyle.inlineCode?.font?.ascii || this.options.codeFontFamily,
            size: codeSize,
            color: codeColor,
            shading: inlineCodeBg ? {
              type: ShadingType.CLEAR,
              fill: inlineCodeBg
            } : undefined
          }));
          break;
        case 'link':
          runs.push(new TextRun({
            text: decodeHtmlEntities(token.text),
            color: linkColor,
            underline: linkStyle.underline !== false ? {
              type: UnderlineType.SINGLE,
              color: linkColor
            } : undefined,
            size: textSize,
            font: this.options.fontFamily
          }));
          break;
        case 'space':
          runs.push(new TextRun({
            text: ' ',
            size: textSize
          }));
          break;
      }
    }

    return runs;
  }

  /**
   * 添加圖片
   */
  async addImage(token, children) {
    try {
      let imagePath = decodeURIComponent(token.href);
      console.log(`  處理圖片: ${imagePath}`);

      if (!path.isAbsolute(imagePath) && !imagePath.startsWith('http')) {
        imagePath = path.join(this.mdDir, imagePath);
      }

      if (fs.existsSync(imagePath)) {
        let imageBuffer = fs.readFileSync(imagePath);
        const ext = path.extname(imagePath).toLowerCase();

        if (ext === '.svg') {
          console.log(`  轉換 SVG 為 PNG: ${path.basename(imagePath)}`);
          try {
            imageBuffer = await this.convertSvgToPng(imagePath);
          } catch (svgError) {
            console.error(`  SVG 轉換失敗: ${svgError.message}`);
            children.push(
              new Paragraph({
                children: [
                  new TextRun({
                    text: `[SVG 圖片: ${token.text || path.basename(imagePath)}]`,
                    italics: true,
                    size: 22,
                    font: this.options.fontFamily
                  })
                ]
              })
            );
            return;
          }
        }

        if (['.png', '.jpg', '.jpeg', '.gif', '.bmp', '.svg'].includes(ext)) {
          let metadata;
          try {
            metadata = await sharp(imageBuffer).metadata();
          } catch (error) {
            console.error(`  無法讀取圖片資訊: ${error.message}`);
            metadata = { width: 600, height: 400 };
          }

          const maxWidth = 580;
          const maxHeight = 750;

          let displayWidth = metadata.width;
          let displayHeight = metadata.height;

          if (displayWidth > maxWidth) {
            const ratio = maxWidth / displayWidth;
            displayWidth = maxWidth;
            displayHeight = Math.round(displayHeight * ratio);
          }

          if (displayHeight > maxHeight) {
            const ratio = maxHeight / displayHeight;
            displayHeight = maxHeight;
            displayWidth = Math.round(displayWidth * ratio);
          }

          children.push(
            new Paragraph({
              children: [
                new ImageRun({
                  data: imageBuffer,
                  transformation: {
                    width: displayWidth,
                    height: displayHeight
                  }
                })
              ],
              alignment: AlignmentType.CENTER,
              spacing: {
                before: 240,
                after: 120
              },
              keepNext: token.text ? true : false
            })
          );

          // 判斷圖片類型並添加標題
          const filename = path.basename(imagePath);
          let caption = '';

          if (filename.startsWith('mermaid-')) {
            this.diagramCount++;
            caption = `流程圖(${this.diagramCount})`;
          } else if (filename.startsWith('code-')) {
            this.codeCount++;
            caption = `程式碼(${this.codeCount})`;
          } else if (token.text) {
            caption = token.text;
          }

          if (caption) {
            // 從樣式設定取得圖片說明樣式
            const imgStyle = this.styles.image;
            const captionStyle = imgStyle.caption;

            children.push(
              new Paragraph({
                children: [
                  new TextRun({
                    text: caption,
                    size: captionStyle?.fontSize || 20,
                    color: captionStyle?.color || '656d76',
                    font: this.options.fontFamily,
                    italics: captionStyle?.italic !== false
                  })
                ],
                alignment: AlignmentType.CENTER,
                spacing: {
                  before: 120,
                  after: 240
                }
              })
            );
          }
        }
      } else {
        const pStyle = this.styles.paragraph;
        children.push(
          new Paragraph({
            children: [
              new TextRun({
                text: `[圖片: ${token.text || token.href}]`,
                italics: true,
                size: pStyle.text?.fontSize || 24,
                font: this.options.fontFamily
              })
            ]
          })
        );
      }
    } catch (error) {
      console.error(`圖片載入失敗: ${token.href}`, error.message);
      const pStyle = this.styles.paragraph;
      children.push(
        new Paragraph({
          children: [
            new TextRun({
              text: `[圖片載入失敗: ${token.text || token.href}]`,
              italics: true,
              size: pStyle.text?.fontSize || 24,
              font: this.options.fontFamily
            })
          ]
        })
      );
    }
  }

  /**
   * 添加列表（使用 Word 原生項目符號）
   */
  addList(token, children, depth = 0) {
    // 從樣式設定取得列表樣式
    const listStyle = this.styles.list;

    for (let i = 0; i < token.items.length; i++) {
      const item = token.items[i];

      // 判斷是否為任務列表（核取方塊）
      if (item.task) {
        // 任務列表使用文字前綴（Word 不支援原生核取方塊項目符號）
        const prefix = item.checked
          ? (listStyle.checkbox?.checked?.symbol || '☑') + ' '
          : (listStyle.checkbox?.unchecked?.symbol || '☐') + ' ';

        const textRuns = this.parseListItemTokens(item.tokens || [], prefix, true, item.checked);

        children.push(
          new Paragraph({
            children: textRuns,
            indent: {
              left: (listStyle.indent?.left || 720) * (depth + 1)
            },
            spacing: {
              before: 60,
              after: 60
            }
          })
        );
      } else {
        // 一般列表使用 Word 原生項目符號
        const textRuns = this.parseListItemTokensNative(item.tokens || []);

        children.push(
          new Paragraph({
            children: textRuns,
            numbering: {
              reference: token.ordered ? "numbered-list" : "bullet-list",
              level: depth
            },
            spacing: {
              before: 60,
              after: 60
            }
          })
        );
      }

      // 處理巢狀列表
      if (item.tokens) {
        for (const subToken of item.tokens) {
          if (subToken.type === 'list') {
            this.addList(subToken, children, depth + 1);
          }
        }
      }
    }
  }

  /**
   * 解析列表項目的 tokens（原生項目符號版本，不含前綴）
   */
  parseListItemTokensNative(tokens) {
    const runs = [];

    // 從樣式設定取得樣式
    const pStyle = this.styles.paragraph;
    const textSize = pStyle.text?.fontSize || 24;
    const textColor = pStyle.text?.color || '1f2328';

    for (const token of tokens) {
      if (token.type === 'text') {
        if (token.tokens && token.tokens.length > 0) {
          for (const inlineToken of token.tokens) {
            const textRun = this.parseInlineToken(inlineToken, false);
            if (textRun) runs.push(textRun);
          }
        } else {
          runs.push(new TextRun({
            text: decodeHtmlEntities(token.text),
            size: textSize,
            font: this.options.fontFamily,
            color: textColor
          }));
        }
      } else if (token.type === 'paragraph') {
        if (token.tokens && token.tokens.length > 0) {
          for (const inlineToken of token.tokens) {
            const textRun = this.parseInlineToken(inlineToken, false);
            if (textRun) runs.push(textRun);
          }
        }
      } else if (token.type !== 'list') {
        const textRun = this.parseInlineToken(token, false);
        if (textRun) runs.push(textRun);
      }
    }

    return runs;
  }

  /**
   * 解析列表項目的 tokens
   */
  parseListItemTokens(tokens, prefix, isTask = false, isChecked = false) {
    const runs = [];

    // 從樣式設定取得樣式
    const listStyle = this.styles.list;
    const pStyle = this.styles.paragraph;
    const textSize = pStyle.text?.fontSize || 24;
    const textColor = pStyle.text?.color || '1f2328';
    const checkedColor = listStyle.checkbox?.checked?.color || '28a745';
    const uncheckedColor = listStyle.checkbox?.unchecked?.color || '6c757d';

    if (isTask) {
      runs.push(new TextRun({
        text: prefix,
        size: textSize,
        font: 'Segoe UI Symbol',
        color: isChecked ? checkedColor : uncheckedColor
      }));
    } else {
      runs.push(new TextRun({
        text: prefix,
        size: textSize,
        font: this.options.fontFamily,
        color: textColor
      }));
    }

    for (const token of tokens) {
      if (token.type === 'text') {
        if (token.tokens && token.tokens.length > 0) {
          for (const inlineToken of token.tokens) {
            const textRun = this.parseInlineToken(inlineToken, isTask && isChecked);
            if (textRun) runs.push(textRun);
          }
        } else {
          runs.push(new TextRun({
            text: decodeHtmlEntities(token.text),
            size: textSize,
            font: this.options.fontFamily,
            color: isTask && isChecked ? uncheckedColor : textColor,
            strike: isTask && isChecked
          }));
        }
      } else if (token.type === 'link') {
        runs.push(new TextRun({
          text: decodeHtmlEntities(token.text),
          size: textSize,
          font: this.options.fontFamily,
          color: textColor
        }));
      } else if (token.type === 'list') {
        continue;
      } else {
        const textRun = this.parseInlineToken(token, isTask && isChecked);
        if (textRun) runs.push(textRun);
      }
    }

    return runs;
  }

  /**
   * 解析單個行內 token
   */
  parseInlineToken(token, strikethrough = false) {
    // 從樣式設定取得樣式
    const pStyle = this.styles.paragraph;
    const linkStyle = this.styles.link;
    const textSize = pStyle.text?.fontSize || 24;
    const textColor = pStyle.text?.color || '1f2328';
    const codeSize = pStyle.inlineCode?.fontSize || 22;
    const codeColor = pStyle.inlineCode?.color || '1f2328';
    const strikeColor = '6a737d';

    switch (token.type) {
      case 'text':
        return new TextRun({
          text: decodeHtmlEntities(token.text),
          size: textSize,
          font: this.options.fontFamily,
          color: strikethrough ? strikeColor : textColor,
          strike: strikethrough
        });
      case 'strong':
        return new TextRun({
          text: decodeHtmlEntities(token.text),
          bold: true,
          size: textSize,
          font: this.options.fontFamily,
          color: strikethrough ? strikeColor : textColor,
          strike: strikethrough
        });
      case 'em':
        return new TextRun({
          text: decodeHtmlEntities(token.text),
          italics: true,
          size: textSize,
          font: this.options.fontFamily,
          color: strikethrough ? strikeColor : textColor,
          strike: strikethrough
        });
      case 'del':
        return new TextRun({
          text: decodeHtmlEntities(token.text),
          strike: true,
          size: textSize,
          font: this.options.fontFamily,
          color: strikeColor
        });
      case 'codespan':
        const codeBg = pStyle.inlineCode?.backgroundColor;
        return new TextRun({
          text: decodeHtmlEntities(token.text),
          font: pStyle.inlineCode?.font?.ascii || this.options.codeFontFamily,
          size: codeSize,
          color: codeColor,
          strike: strikethrough,
          shading: codeBg ? {
            type: ShadingType.CLEAR,
            fill: codeBg
          } : undefined
        });
      case 'link':
        return new TextRun({
          text: decodeHtmlEntities(token.text),
          size: textSize,
          font: this.options.fontFamily,
          color: textColor,
          strike: strikethrough
        });
      default:
        return null;
    }
  }

  /**
   * 添加引用區塊（完整版，來自 mdToDocx.js）
   */
  addBlockquote(token, children) {
    const bqStyle = this.styles.blockquote;
    const borderConfig = {
      left: {
        color: bqStyle.border.left.color,
        space: bqStyle.border.left.space,
        style: BorderStyle.SINGLE,
        size: bqStyle.border.left.size
      }
    };

    if (token.tokens && token.tokens.length > 0) {
      for (const innerToken of token.tokens) {
        if (innerToken.type === 'paragraph' && innerToken.tokens) {
          const runs = this.parseBlockquoteTokens(innerToken.tokens);
          children.push(
            new Paragraph({
              children: runs,
              indent: { left: bqStyle.indent.left },
              border: borderConfig,
              spacing: {
                before: 120,
                after: 120
              }
            })
          );
        }
      }
    } else {
      const text = decodeHtmlEntities(token.text || '');
      children.push(
        new Paragraph({
          children: [
            new TextRun({
              text: text,
              size: bqStyle.text.fontSize,
              font: this.options.fontFamily,
              color: bqStyle.text.color,
              italics: bqStyle.text.italic
            })
          ],
          indent: { left: bqStyle.indent.left },
          border: borderConfig,
          spacing: {
            before: 120,
            after: 120
          }
        })
      );
    }
  }

  /**
   * 解析引用區塊中的 tokens（完整版）
   */
  parseBlockquoteTokens(tokens) {
    const runs = [];

    // 從樣式設定取得引用區塊樣式
    const bqStyle = this.styles.blockquote;
    const pStyle = this.styles.paragraph;
    const textSize = bqStyle.text?.fontSize || 24;
    const textColor = bqStyle.text?.color || '656d76';
    const codeSize = pStyle.inlineCode?.fontSize || 22;
    const codeColor = pStyle.inlineCode?.color || '1f2328';

    for (const token of tokens) {
      switch (token.type) {
        case 'text':
          runs.push(new TextRun({
            text: decodeHtmlEntities(token.text),
            size: textSize,
            font: this.options.fontFamily,
            color: textColor
          }));
          break;
        case 'strong':
          if (token.tokens && token.tokens.length > 0) {
            for (const innerToken of token.tokens) {
              runs.push(new TextRun({
                text: decodeHtmlEntities(innerToken.text || innerToken.raw || ''),
                bold: true,
                size: textSize,
                font: this.options.fontFamily,
                color: textColor
              }));
            }
          } else {
            runs.push(new TextRun({
              text: decodeHtmlEntities(token.text),
              bold: true,
              size: textSize,
              font: this.options.fontFamily,
              color: textColor
            }));
          }
          break;
        case 'em':
          if (token.tokens && token.tokens.length > 0) {
            for (const innerToken of token.tokens) {
              runs.push(new TextRun({
                text: decodeHtmlEntities(innerToken.text || innerToken.raw || ''),
                italics: true,
                size: textSize,
                font: this.options.fontFamily,
                color: textColor
              }));
            }
          } else {
            runs.push(new TextRun({
              text: decodeHtmlEntities(token.text),
              italics: true,
              size: textSize,
              font: this.options.fontFamily,
              color: textColor
            }));
          }
          break;
        case 'codespan':
          const bqCodeBg = pStyle.inlineCode?.backgroundColor;
          runs.push(new TextRun({
            text: decodeHtmlEntities(token.text),
            font: pStyle.inlineCode?.font?.ascii || this.options.codeFontFamily,
            size: codeSize,
            color: codeColor,
            shading: bqCodeBg ? {
              type: ShadingType.CLEAR,
              fill: bqCodeBg
            } : undefined
          }));
          break;
        default:
          if (token.raw) {
            runs.push(new TextRun({
              text: decodeHtmlEntities(token.raw),
              size: textSize,
              font: this.options.fontFamily,
              color: textColor
            }));
          }
      }
    }

    return runs;
  }

  /**
   * 添加程式碼區塊
   */
  async addCodeBlock(token, children) {
    const code = token.text;
    const language = token.lang || 'plaintext';

    if (this.options.codeBlockAsImage) {
      console.log(`  轉換程式碼區塊為圖片 (${this.codeBlockCount + 1}): ${language}`);

      if (this.codeBlockCount >= this.maxCodeBlocksBeforeRestart) {
        await this.restartBrowser();
      }

      try {
        const imageBuffer = await this.convertCodeBlockToImage(code, language);
        this.codeBlockCount++;

        let metadata;
        try {
          metadata = await sharp(imageBuffer).metadata();
        } catch (error) {
          metadata = { width: 800, height: 400 };
        }

        const maxWidth = 580;
        const maxHeight = 750;

        let displayWidth = metadata.width;
        let displayHeight = metadata.height;

        if (displayWidth > maxWidth) {
          const ratio = maxWidth / displayWidth;
          displayWidth = maxWidth;
          displayHeight = Math.round(displayHeight * ratio);
        }

        if (displayHeight > maxHeight) {
          const ratio = maxHeight / displayHeight;
          displayHeight = maxHeight;
          displayWidth = Math.round(displayWidth * ratio);
        }

        children.push(
          new Paragraph({
            children: [
              new ImageRun({
                data: imageBuffer,
                transformation: {
                  width: displayWidth,
                  height: displayHeight
                }
              })
            ],
            alignment: AlignmentType.LEFT,
            spacing: {
              before: 240,
              after: 240
            }
          })
        );

        return;
      } catch (error) {
        console.error(`  程式碼區塊轉圖片失敗，使用文字模式: ${error.message}`);
      }
    }

    // 文字模式（fallback 或設定為文字模式）
    const lines = code.split('\n');

    if (language) {
      children.push(
        new Paragraph({
          children: [
            new TextRun({
              text: `[${language}]`,
              size: 18,
              font: this.options.codeFontFamily,
              color: '6a737d',
              italics: true
            })
          ],
          spacing: { before: 120 }
        })
      );
    }

    for (const line of lines) {
      children.push(
        new Paragraph({
          children: [
            new TextRun({
              text: line || ' ',
              font: this.options.codeFontFamily,
              size: 20,
              color: '24292e'
            })
          ],
          spacing: { line: 240 }
        })
      );
    }

    children.push(
      new Paragraph({
        text: '',
        spacing: { after: 120 }
      })
    );
  }

  /**
   * 解析表頭儲存格中的 tokens（強制粗體）
   */
  parseTableCellTokensForHeader(tokens, fontSize = 22) {
    const runs = [];

    // 從樣式設定取得表格樣式
    const tableStyle = this.styles.table;
    const headerColor = tableStyle.header?.text?.color || '1f2328';
    const headerBold = tableStyle.header?.text?.bold !== false;
    const pStyle = this.styles.paragraph;
    const codeColor = pStyle.inlineCode?.color || '1f2328';

    for (const token of tokens) {
      switch (token.type) {
        case 'text':
          runs.push(new TextRun({
            text: decodeHtmlEntities(token.text),
            bold: headerBold,
            size: fontSize,
            font: this.options.fontFamily,
            color: headerColor
          }));
          break;
        case 'strong':
          if (token.tokens && token.tokens.length > 0) {
            for (const innerToken of token.tokens) {
              runs.push(new TextRun({
                text: decodeHtmlEntities(innerToken.text || innerToken.raw || ''),
                bold: true,
                size: fontSize,
                font: this.options.fontFamily,
                color: headerColor
              }));
            }
          } else {
            runs.push(new TextRun({
              text: decodeHtmlEntities(token.text),
              bold: true,
              size: fontSize,
              font: this.options.fontFamily,
              color: headerColor
            }));
          }
          break;
        case 'codespan':
          const headerInlineCodeStyle = pStyle.inlineCode || {};
          runs.push(new TextRun({
            text: decodeHtmlEntities(token.text),
            bold: headerBold,
            font: headerInlineCodeStyle.font?.ascii || this.options.codeFontFamily,
            size: headerInlineCodeStyle.fontSize || (fontSize - 2),
            color: codeColor,
            shading: headerInlineCodeStyle.backgroundColor ? {
              type: ShadingType.CLEAR,
              fill: headerInlineCodeStyle.backgroundColor
            } : undefined
          }));
          break;
        default:
          runs.push(new TextRun({
            text: decodeHtmlEntities(token.text || token.raw || ''),
            bold: headerBold,
            size: fontSize,
            font: this.options.fontFamily,
            color: headerColor
          }));
      }
    }

    return runs;
  }

  /**
   * 解析表格儲存格中的 tokens
   */
  parseTableCellTokens(tokens, fontSize = 22) {
    const runs = [];

    // 從樣式設定取得表格樣式
    const tableStyle = this.styles.table;
    const cellColor = tableStyle.cell?.text?.color || '1f2328';
    const pStyle = this.styles.paragraph;
    const codeColor = pStyle.inlineCode?.color || '1f2328';
    const linkColor = this.styles.link?.color || '0563C1';

    for (const token of tokens) {
      switch (token.type) {
        case 'text':
          runs.push(new TextRun({
            text: decodeHtmlEntities(token.text),
            size: fontSize,
            font: this.options.fontFamily,
            color: cellColor
          }));
          break;
        case 'strong':
          if (token.tokens && token.tokens.length > 0) {
            for (const innerToken of token.tokens) {
              runs.push(new TextRun({
                text: decodeHtmlEntities(innerToken.text || innerToken.raw || ''),
                bold: true,
                size: fontSize,
                font: this.options.fontFamily,
                color: cellColor
              }));
            }
          } else {
            runs.push(new TextRun({
              text: decodeHtmlEntities(token.text),
              bold: true,
              size: fontSize,
              font: this.options.fontFamily,
              color: cellColor
            }));
          }
          break;
        case 'em':
          if (token.tokens && token.tokens.length > 0) {
            for (const innerToken of token.tokens) {
              runs.push(new TextRun({
                text: decodeHtmlEntities(innerToken.text || innerToken.raw || ''),
                italics: true,
                size: fontSize,
                font: this.options.fontFamily,
                color: cellColor
              }));
            }
          } else {
            runs.push(new TextRun({
              text: decodeHtmlEntities(token.text),
              italics: true,
              size: fontSize,
              font: this.options.fontFamily,
              color: cellColor
            }));
          }
          break;
        case 'codespan':
          const inlineCodeStyle = pStyle.inlineCode || {};
          runs.push(new TextRun({
            text: decodeHtmlEntities(token.text),
            font: inlineCodeStyle.font?.ascii || this.options.codeFontFamily,
            size: inlineCodeStyle.fontSize || (fontSize - 2),
            color: codeColor,
            shading: inlineCodeStyle.backgroundColor ? {
              type: ShadingType.CLEAR,
              fill: inlineCodeStyle.backgroundColor
            } : undefined
          }));
          break;
        case 'link':
          runs.push(new TextRun({
            text: decodeHtmlEntities(token.text),
            size: fontSize,
            font: this.options.fontFamily,
            color: linkColor
          }));
          break;
      }
    }

    return runs;
  }

  /**
   * 添加表格
   */
  addTable(token, children) {
    const rows = [];
    const tableStyle = this.styles.table;

    const columnCount = token.header ? token.header.length : (token.rows && token.rows[0] ? token.rows[0].length : 3);

    // 根據欄位數量決定字體大小（自適應表格）
    let fontSize = tableStyle.cell.text.fontSize;
    if (tableStyle.adaptive && tableStyle.adaptive.enabled) {
      for (const threshold of tableStyle.adaptive.columnThresholds) {
        if (columnCount <= threshold.maxColumns) {
          fontSize = threshold.fontSize;
          break;
        }
      }
    }

    // 儲存格邊距
    const cellMargins = {
      top: tableStyle.cell.padding.top,
      bottom: tableStyle.cell.padding.bottom,
      left: tableStyle.cell.padding.left,
      right: tableStyle.cell.padding.right
    };

    const alignments = (token.align || []).map(align => {
      switch (align) {
        case 'left': return AlignmentType.LEFT;
        case 'right': return AlignmentType.RIGHT;
        case 'center': return AlignmentType.CENTER;
        default: return AlignmentType.LEFT;
      }
    });

    // 表頭
    if (token.header && token.header.length > 0) {
      const headerCells = token.header.map((cell, colIndex) => {
        const cellRuns = this.parseTableCellTokensForHeader(cell.tokens || [], fontSize);

        return new TableCell({
          children: [
            new Paragraph({
              children: cellRuns.length > 0 ? cellRuns : [
                new TextRun({
                  text: decodeHtmlEntities(cell.text),
                  bold: tableStyle.header.text.bold,
                  size: fontSize,
                  font: this.options.fontFamily,
                  color: tableStyle.header.text.color
                })
              ],
              alignment: AlignmentType.CENTER,
              spacing: { line: 240 }
            })
          ],
          shading: { fill: tableStyle.header.backgroundColor },
          margins: cellMargins,
          verticalAlign: 'center'
        });
      });
      rows.push(new TableRow({
        children: headerCells,
        tableHeader: true
      }));
    }

    // 表格內容
    if (token.rows) {
      for (let i = 0; i < token.rows.length; i++) {
        const row = token.rows[i];
        const cells = row.map((cell, colIndex) => {
          const cellRuns = this.parseTableCellTokens(cell.tokens || [], fontSize);
          const cellAlignment = alignments[colIndex] || AlignmentType.LEFT;

          // 決定背景色（支援斑馬紋）
          let bgColor = tableStyle.cell.backgroundColor;
          if (tableStyle.alternateRow && tableStyle.alternateRow.enabled && i % 2 === 1) {
            bgColor = tableStyle.alternateRow.backgroundColor;
          }

          return new TableCell({
            children: [
              new Paragraph({
                children: cellRuns.length > 0 ? cellRuns : [
                  new TextRun({
                    text: decodeHtmlEntities(cell.text || ''),
                    size: fontSize,
                    font: this.options.fontFamily,
                    color: tableStyle.cell.text.color
                  })
                ],
                alignment: cellAlignment,
                spacing: { line: 240 }
              })
            ],
            shading: { fill: bgColor },
            margins: cellMargins,
            verticalAlign: 'center'
          });
        });
        rows.push(new TableRow({
          children: cells,
          cantSplit: false
        }));
      }
    }

    const borderEnabled = tableStyle.border.enabled !== false;
    const borderColor = tableStyle.border.color;
    const borderSize = tableStyle.border.size;

    // 根據設定決定邊框樣式
    const borderStyle = borderEnabled ? BorderStyle.SINGLE : BorderStyle.NONE;

    children.push(
      new Table({
        rows: rows,
        width: { size: 100, type: WidthType.PERCENTAGE },
        layout: 'fixed',
        borders: {
          top: { style: borderStyle, size: borderSize, color: borderColor },
          bottom: { style: borderStyle, size: borderSize, color: borderColor },
          left: { style: borderStyle, size: borderSize, color: borderColor },
          right: { style: borderStyle, size: borderSize, color: borderColor },
          insideHorizontal: { style: borderStyle, size: borderSize, color: borderColor },
          insideVertical: { style: borderStyle, size: borderSize, color: borderColor }
        }
      })
    );

    children.push(
      new Paragraph({
        text: '',
        spacing: { after: 240 }
      })
    );
  }

  /**
   * 添加分隔線
   */
  addHorizontalRule(children) {
    const hrStyle = this.styles.horizontalRule;
    children.push(
      new Paragraph({
        border: {
          bottom: {
            color: hrStyle.color,
            space: hrStyle.space,
            style: BorderStyle.SINGLE,
            size: hrStyle.size
          }
        },
        spacing: {
          before: 240,
          after: 240
        }
      })
    );
  }
}

/**
 * 將 Markdown 文件轉換為完整版 DOCX
 */
async function convertMdToDocxComplete(mdFilePath, outputPath = null, options = {}) {
  console.log('\n========================================');
  console.log('  MD → DOCX Complete 轉換');
  console.log('========================================\n');

  if (!fs.existsSync(mdFilePath)) {
    throw new Error(`檔案不存在: ${mdFilePath}`);
  }

  let mdContent = fs.readFileSync(mdFilePath, 'utf8');
  let processedMdPath = mdFilePath;

  // Mermaid 預處理（如果啟用且模組存在）
  if (options.processMermaid) {
    try {
      const { processMermaidInMarkdown } = require('./mermaidToImage');
      console.log('步驟 1: 處理 Mermaid 圖表...');
      processedMdPath = await processMermaidInMarkdown(mdFilePath);
      mdContent = fs.readFileSync(processedMdPath, 'utf8');
      console.log(`✓ Mermaid 處理完成\n`);
    } catch (error) {
      console.log(`⚠ Mermaid 處理跳過: ${error.message}\n`);
    }
  }

  // 程式碼區塊預處理（如果使用外部模組）
  if (options.preprocessCodeBlocks) {
    try {
      const { processCodeBlocksInMarkdown } = require('./codeBlockToImage');
      console.log('步驟 2: 處理程式碼區塊...');
      processedMdPath = await processCodeBlocksInMarkdown(processedMdPath);
      mdContent = fs.readFileSync(processedMdPath, 'utf8');
      console.log(`✓ 程式碼區塊處理完成\n`);
    } catch (error) {
      console.log(`⚠ 程式碼區塊預處理跳過: ${error.message}\n`);
    }
  }

  if (!outputPath) {
    outputPath = mdFilePath.replace(/\.md$/i, '.docx');
  }

  if (!outputPath.endsWith('.docx')) {
    outputPath += '.docx';
  }

  console.log(`生成 DOCX: ${path.basename(outputPath)}`);

  const converter = new CompleteMarkdownToDocxConverter(mdContent, processedMdPath, options);

  try {
    const doc = await converter.convert();

    const buffer = await Packer.toBuffer(doc);
    fs.writeFileSync(outputPath, buffer);

    console.log(`\n========================================`);
    console.log(`✓ 轉換完成: ${outputPath}`);
    console.log(`========================================`);
    if (options.addTOC !== false) {
      console.log(`\n提示：開啟 Word 後請按 F9 更新目錄頁碼\n`);
    }

    return outputPath;
  } finally {
    await converter.cleanup();
  }
}

// 命令列介面
if (require.main === module) {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.log('');
    console.log('MD to DOCX Complete - 功能最完整的 Markdown 轉 DOCX 轉換器');
    console.log('');
    console.log('用法: node mdToDocxComplete.js <markdown-file> [output.docx] [options]');
    console.log('');
    console.log('選項:');
    console.log('  --no-cover            不生成封面');
    console.log('  --no-toc              不生成目錄');
    console.log('  --no-page-numbers     不添加頁碼');
    console.log('  --no-h1-page-break    H1 前不分頁');
    console.log('  --text-code           程式碼使用文字模式（非圖片）');
    console.log('  --process-mermaid     預處理 Mermaid 圖表');
    console.log('  --title "標題"        指定文件標題');
    console.log('  --subtitle "副標題"   指定副標題');
    console.log('  --author "作者"       指定作者');
    console.log('');
    console.log('範例:');
    console.log('  node mdToDocxComplete.js example.md');
    console.log('  node mdToDocxComplete.js example.md output.docx');
    console.log('  node mdToDocxComplete.js example.md --title "系統設計文件" --author "張三"');
    console.log('  node mdToDocxComplete.js example.md --no-cover --no-toc');
    console.log('  node mdToDocxComplete.js example.md --process-mermaid');
    console.log('');
    process.exit(1);
  }

  const inputPath = args.find(arg => !arg.startsWith('--') && arg.endsWith('.md'));
  const outputPath = args.find(arg => !arg.startsWith('--') && arg.endsWith('.docx'));

  const options = {
    addCover: !args.includes('--no-cover'),
    addTOC: !args.includes('--no-toc'),
    addPageNumbers: !args.includes('--no-page-numbers'),
    h1PageBreak: !args.includes('--no-h1-page-break'),
    codeBlockAsImage: !args.includes('--text-code'),
    processMermaid: args.includes('--process-mermaid')
  };

  // 解析 title
  const titleIndex = args.indexOf('--title');
  if (titleIndex !== -1 && args[titleIndex + 1]) {
    options.title = args[titleIndex + 1];
  }

  // 解析 subtitle
  const subtitleIndex = args.indexOf('--subtitle');
  if (subtitleIndex !== -1 && args[subtitleIndex + 1]) {
    options.subtitle = args[subtitleIndex + 1];
  }

  // 解析 author
  const authorIndex = args.indexOf('--author');
  if (authorIndex !== -1 && args[authorIndex + 1]) {
    options.author = args[authorIndex + 1];
  }

  convertMdToDocxComplete(inputPath, outputPath, options)
    .then(output => {
      console.log(`成功！檔案已儲存至: ${output}`);
    })
    .catch(error => {
      console.error('轉換失敗:', error.message);
      process.exit(1);
    });
}

module.exports = {
  convertMdToDocxComplete,
  CompleteMarkdownToDocxConverter,
  preprocessHackMD,
  decodeHtmlEntities
};

#!/usr/bin/env node

/**
 * Markdown to PDF Converter with Chinese Support and Mermaid Diagrams
 * Supports images, automatic page breaks, Traditional Chinese, and Mermaid charts
 */

const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const util = require('util');
const https = require('https');
const http = require('http');
const puppeteer = require('puppeteer');

const execPromise = util.promisify(exec);

const { processMermaidInMarkdown } = require('./mermaidToImage');
const { generatePdfCss } = require('./stylesToCss');

/**
 * Fetch content from URL
 */
async function fetchFromUrl(url) {
  return new Promise((resolve, reject) => {
    const client = url.startsWith('https') ? https : http;

    client.get(url, (res) => {
      // Handle redirects
      if (res.statusCode === 301 || res.statusCode === 302) {
        const redirectUrl = res.headers.location;
        console.log(`Following redirect to: ${redirectUrl}`);
        return fetchFromUrl(redirectUrl).then(resolve).catch(reject);
      }

      // Check for errors
      if (res.statusCode === 403) {
        reject(new Error('Access denied (403). This HackMD document might be private or require authentication.'));
        return;
      }

      if (res.statusCode === 404) {
        reject(new Error('Document not found (404). Please check the URL is correct.'));
        return;
      }

      if (res.statusCode !== 200) {
        reject(new Error(`HTTP Error ${res.statusCode}: ${res.statusMessage}`));
        return;
      }

      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        // Check if response is HTML error page instead of Markdown
        if (data.includes('You don\'t have permission to access this resource')) {
          reject(new Error('Access denied. This HackMD document is private. Please:\n1. Make the document public, or\n2. Use the "Download" option from HackMD menu and save the .md file locally'));
          return;
        }
        resolve(data);
      });
    }).on('error', (err) => {
      reject(err);
    });
  });
}

/**
 * Convert HackMD URL to download URL
 */
function hackmdUrlToDownloadUrl(url) {
  // HackMD URL formats:
  // https://hackmd.io/@user/note-id
  // https://hackmd.io/note-id
  // Convert to download URL: https://hackmd.io/note-id/download

  const match = url.match(/hackmd\.io\/(@[\w-]+\/)?([\w-]+)/);
  if (match) {
    const noteId = match[2];
    return `https://hackmd.io/${noteId}/download`;
  }

  throw new Error('Invalid HackMD URL format');
}

/**
 * Check if input is a URL
 */
function isUrl(input) {
  try {
    const url = new URL(input);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

// CSS styling for PDF with Chinese font support
const pdfStyles = `
<style>
  @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+TC:wght@300;400;500;700&family=Noto+Serif+TC:wght@400;700&display=swap');

  body {
    font-family: 'Noto Sans TC', 'Microsoft JhengHei', 'PMingLiU', sans-serif;
    font-size: 12pt;
    line-height: 1.6;
    color: #333;
    max-width: 100%;
    margin: 0;
    padding: 0;
  }

  h1, h2, h3, h4, h5, h6 {
    font-family: 'Noto Serif TC', 'Microsoft JhengHei', serif;
    font-weight: 700;
    page-break-after: avoid;
    page-break-inside: avoid;
    margin-top: 1em;
    margin-bottom: 0.5em;
    color: #2c3e50;
  }

  /* Keep heading with following content */
  h1 + p, h1 + .mermaid, h1 + pre, h1 + img, h1 + table,
  h2 + p, h2 + .mermaid, h2 + pre, h2 + img, h2 + table,
  h3 + p, h3 + .mermaid, h3 + pre, h3 + img, h3 + table {
    page-break-before: avoid;
  }

  /* Wrapper for heading + content to keep together */
  .heading-group {
    display: table;
    width: 100%;
    page-break-inside: avoid;
    margin: 0;
    padding: 0;
  }

  /* Force page break before heading if needed */
  .force-page-break-before {
    page-break-before: always !important;
  }

  /* Table of Contents styles */
  .table-of-contents {
    padding: 0;
    page-break-after: always !important;
    break-after: page !important;
    min-height: 100vh;
  }

  .table-of-contents h1 {
    font-size: 28pt;
    margin-top: 0;
    margin-bottom: 1.5em;
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
    border-bottom: 1px dotted #ddd;
  }

  .table-of-contents a:hover {
    color: #3498db;
    background-color: #f8f9fa;
  }

  .toc-h1 {
    font-size: 14pt;
    font-weight: 700;
    margin-left: 0;
  }

  .toc-h2 {
    font-size: 12pt;
    margin-left: 2em;
  }

  h1 {
    font-size: 28pt;
    border-bottom: 3px solid #3498db;
    padding-bottom: 0.3em;
  }

  h2 {
    font-size: 22pt;
    border-bottom: 2px solid #95a5a6;
    padding-bottom: 0.3em;
  }

  /* H2 分頁標記 */
  .h2-page-break {
    page-break-before: always;
    height: 0;
    margin: 0;
    padding: 0;
  }

  h3 { font-size: 18pt; }
  h4 { font-size: 16pt; }
  h5 { font-size: 14pt; }
  h6 { font-size: 12pt; }

  p {
    margin: 0.8em 0;
    text-align: justify;
    orphans: 3;
    widows: 3;
  }

  img {
    max-width: 100%;
    height: auto;
    display: block;
    margin: 1em auto;
    page-break-inside: avoid;
  }

  code {
    font-family: 'Consolas', 'Monaco', 'Courier New', monospace;
    background-color: #f4f4f4;
    padding: 2px 6px;
    border-radius: 3px;
    font-size: 0.9em;
  }

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

  blockquote {
    border-left: 4px solid #3498db;
    padding-left: 20px;
    margin-left: 0;
    color: #555;
    font-style: italic;
    background-color: #f9f9f9;
    padding: 10px 20px;
    page-break-inside: avoid;
  }

  table {
    border-collapse: collapse;
    width: 100%;
    margin: 1em 0;
    page-break-inside: avoid;
    font-size: 11pt;
  }

  th, td {
    border: 1px solid #ddd;
    padding: 10px;
    text-align: left;
  }

  th {
    background-color: #3498db;
    color: white;
    font-weight: 700;
  }

  tr:nth-child(even) {
    background-color: #f9f9f9;
  }

  ul, ol {
    margin: 0.8em 0;
    padding-left: 2em;
  }

  li {
    margin: 0.3em 0;
  }

  a {
    color: #3498db;
    text-decoration: none;
  }

  a:hover {
    text-decoration: underline;
  }

  hr {
    border: none;
    border-top: 2px solid #ddd;
    margin: 2em 0;
  }

  /* Mermaid diagram styling */
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

  /* Scaling classes for content optimization */
  .scale-60 {
    transform: scale(0.6);
    transform-origin: top center;
    margin-bottom: -40%; /* Reduce space: (1-0.6)*100% */
  }

  .scale-70 {
    transform: scale(0.7);
    transform-origin: top center;
    margin-bottom: -30%; /* Reduce space: (1-0.7)*100% */
  }

  .scale-80 {
    transform: scale(0.8);
    transform-origin: top center;
    margin-bottom: -20%; /* Reduce space: (1-0.8)*100% */
  }

  .scale-90 {
    transform: scale(0.9);
    transform-origin: top center;
    margin-bottom: -10%; /* Reduce space: (1-0.9)*100% */
  }

  /* Pre/code block scaling */
  pre.scale-60,
  pre.scale-70,
  pre.scale-80,
  pre.scale-90 {
    font-size: inherit;
  }

  .mermaid svg {
    max-width: 100% !important;
    max-height: 90vh !important;
    height: auto !important;
    width: auto !important;
    object-fit: contain;
  }

  /* Ensure mermaid diagrams scale to fit page in print */
  @media print {
    .mermaid {
      max-height: calc(297mm - 80mm); /* A4 height minus margins and some spacing */
      max-width: calc(210mm - 80mm); /* A4 width minus margins */
    }

    .mermaid svg {
      max-height: calc(297mm - 80mm) !important;
      max-width: calc(210mm - 80mm) !important;
    }
  }

  @page {
    margin: 20mm;
    size: A4;
  }

  @media print {
    body {
      padding: 0;
    }

    h1, h2, h3, h4, h5, h6 {
      page-break-after: avoid;
      page-break-inside: avoid;
    }

    /* Keep heading with next element */
    h1 + *, h2 + *, h3 + * {
      page-break-before: avoid;
    }

    /* Prevent breaking inside these elements */
    img, table, pre, blockquote, .mermaid, .heading-group {
      page-break-inside: avoid;
      page-break-before: auto;
    }

    /* Force page break before main headings if needed for better layout */
    h1 {
      page-break-before: auto;
    }

    a {
      color: #3498db;
      text-decoration: none;
    }
  }
</style>
`;

/**
 * Generate table of contents from headings
 * @param {string} htmlContent - HTML content
 * @returns {string} - TOC HTML
 */
function generateTableOfContents(htmlContent) {
  const headingRegex = /<h([12])[^>]*id="([^"]*)"[^>]*>(.*?)<\/h\1>/gi;
  const headings = [];
  let match;

  while ((match = headingRegex.exec(htmlContent)) !== null) {
    const level = parseInt(match[1]);
    const id = match[2];
    const text = match[3].replace(/<[^>]*>/g, ''); // Remove any HTML tags from heading text

    headings.push({ level, id, text });
  }

  if (headings.length === 0) {
    return '';
  }

  let tocHtml = '<div class="table-of-contents">\n<h1 style="page-break-before: avoid;">目錄</h1>\n<nav>\n';

  headings.forEach(heading => {
    const indent = heading.level === 1 ? 'toc-h1' : 'toc-h2';
    tocHtml += `  <div class="${indent}"><a href="#${heading.id}">${heading.text}</a></div>\n`;
  });

  tocHtml += '</nav>\n</div>\n\n';

  return tocHtml;
}

/**
 * Convert Markdown to HTML with enhanced styling and Mermaid support
 * @param {string} markdownPathOrContent - File path or markdown content string
 * @param {string} title - Optional title for the PDF
 */
async function convertMarkdownToHtml(markdownPathOrContent, title = 'Document') {
  const marked = require('marked');

  // Determine if input is a file path or content
  let markdownContent;
  if (fs.existsSync(markdownPathOrContent)) {
    markdownContent = fs.readFileSync(markdownPathOrContent, 'utf-8');
    title = path.basename(markdownPathOrContent, '.md');
  } else {
    markdownContent = markdownPathOrContent;
  }

  // Configure marked with custom renderer to add IDs to headings
  const renderer = new marked.Renderer();
  const headingIds = new Map();

  // Override heading renderer to add IDs
  // In marked v17, heading renderer receives (text, level, raw) parameters
  renderer.heading = function(text, level, raw) {
    // Extract plain text for ID generation
    const plainText = (String(text) || '')
      .replace(/<[^>]*>/g, '') // Remove HTML tags
      .toLowerCase()
      .replace(/[^\w\u4e00-\u9fa5]+/g, '-') // Replace non-word chars with dash
      .replace(/^-+|-+$/g, ''); // Remove leading/trailing dashes

    // Make sure ID is unique
    let id = plainText || `heading-${level}`;
    let counter = 1;
    while (headingIds.has(id)) {
      id = `${plainText || 'heading'}-${counter}`;
      counter++;
    }
    headingIds.set(id, true);

    // Return HTML with ID
    return `<h${level} id="${id}">${text}</h${level}>\n`;
  };

  marked.setOptions({
    breaks: true,
    gfm: true,
    renderer: renderer
  });

  // Parse markdown to HTML
  let htmlContent = marked.parse(markdownContent);

  // Replace mermaid code blocks with mermaid divs
  // Marked converts ```mermaid blocks to <pre><code class="language-mermaid">
  htmlContent = htmlContent.replace(
    /<pre><code class="language-mermaid">([\s\S]*?)<\/code><\/pre>/g,
    (match, code) => {
      // Decode HTML entities
      const decodedCode = code
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&amp;/g, '&')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'");

      return `<div class="mermaid">\n${decodedCode.trim()}\n</div>`;
    }
  );

  // Generate table of contents
  const tocHtml = generateTableOfContents(htmlContent);

  return `
<!DOCTYPE html>
<html lang="zh-TW">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  ${generatePdfCss()}
  <script src="https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.min.js"></script>
  <script>
    mermaid.initialize({
      startOnLoad: true,
      theme: 'default',
      securityLevel: 'loose',
      flowchart: {
        useMaxWidth: true,
        htmlLabels: true,
        curve: 'basis'
      },
      er: {
        useMaxWidth: true,
        fontSize: 12,
        minEntityWidth: 100,
        minEntityHeight: 75
      },
      sequence: {
        useMaxWidth: true
      },
      fontFamily: 'Noto Sans TC, Microsoft JhengHei, sans-serif',
      logLevel: 'fatal',
      suppressErrorRendering: true
    });

    // Override console.error to suppress Mermaid syntax error rendering
    const originalConsoleError = console.error;
    console.error = function(...args) {
      const message = args.join(' ');
      if (!message.includes('Syntax error') && !message.includes('mermaid version')) {
        originalConsoleError.apply(console, args);
      }
    };
  </script>
</head>
<body>
  ${tocHtml}
  ${htmlContent}
</body>
</html>
  `;
}

/**
 * Convert HTML to PDF using Puppeteer
 * @param {Object} options - Conversion options
 * @param {boolean} options.analyze - Whether to analyze and return data for optimization
 * @param {string} options.baseDir - Base directory for resolving relative image paths
 */
async function convertHtmlToPdf(htmlContent, outputPath, options = {}) {
  const { analyze = false, baseDir = process.cwd() } = options;

  // Convert relative image paths to base64 data URLs for reliable embedding
  let imageCount = 0;
  const imgRegex = /(<img\s+[^>]*?)src=["']([^"']+)["']/gi;
  const matches = [...htmlContent.matchAll(imgRegex)];

  for (const match of matches) {
    const [fullMatch, prefix, src] = match;

    // Skip if already absolute URL or data URL
    if (src.startsWith('http://') || src.startsWith('https://') ||
        src.startsWith('file://') || src.startsWith('data:')) {
      continue;
    }

    // Convert relative path to absolute path
    const absolutePath = path.resolve(baseDir, src);

    // Check if file exists
    if (fs.existsSync(absolutePath)) {
      try {
        const fileContent = fs.readFileSync(absolutePath);
        const ext = path.extname(absolutePath).toLowerCase();
        let mimeType = 'image/png';

        if (ext === '.svg') mimeType = 'image/svg+xml';
        else if (ext === '.jpg' || ext === '.jpeg') mimeType = 'image/jpeg';
        else if (ext === '.gif') mimeType = 'image/gif';
        else if (ext === '.webp') mimeType = 'image/webp';

        const base64 = fileContent.toString('base64');
        const dataUrl = `data:${mimeType};base64,${base64}`;

        htmlContent = htmlContent.replace(fullMatch, `${prefix}src="${dataUrl}"`);
        imageCount++;
        console.log(`[Image ${imageCount}] Embedded: ${src} (${(fileContent.length / 1024).toFixed(1)} KB)`);
      } catch (err) {
        console.warn(`[Image] Failed to embed ${src}: ${err.message}`);
      }
    } else {
      console.warn(`[Image] File not found: ${absolutePath}`);
    }
  }
  console.log(`Embedded ${imageCount} image(s) as base64 (baseDir: ${baseDir})`);

  // Wrap images in paragraphs with .image-container to prevent page breaks
  htmlContent = htmlContent.replace(
    /<p>\s*(<img[^>]+>)\s*<\/p>/gi,
    '<div class="image-container">$1</div>'
  );
  const browser = await puppeteer.launch({
    headless: 'new',
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--allow-file-access-from-files',
      '--disable-web-security'
    ]
  });

  const page = await browser.newPage();

  // Set viewport to ensure consistent rendering
  await page.setViewport({
    width: 1200,
    height: 800
  });

  await page.setContent(htmlContent, {
    waitUntil: 'networkidle0'
  });

  // Log any console messages from the page
  page.on('console', msg => {
    const type = msg.type();
    const text = msg.text();

    if (type === 'error') {
      console.log('❌ Browser error:', text);
    } else if (type === 'warning') {
      console.log('⚠️  Browser warning:', text);
    } else if (text.includes('Rendered') || text.includes('Mermaid') ||
               text.includes('Grouped') || text.includes('Keep') ||
               text.includes('Force') || text.includes('Scaled')) {
      console.log('Browser:', text);
    }
  });

  // Log page errors
  page.on('pageerror', error => {
    console.log('❌ Page error:', error.message);
  });

  // Wait for Mermaid to be loaded
  await page.waitForFunction(
    () => typeof window.mermaid !== 'undefined',
    { timeout: 10000 }
  ).catch(() => {
    console.log('⚠ Warning: Mermaid library not loaded within 10 seconds');
  });

  // Count mermaid diagrams
  const mermaidCount = await page.evaluate(() => {
    return document.querySelectorAll('.mermaid').length;
  });

  console.log(`Found ${mermaidCount} Mermaid diagram(s) to render...`);

  if (mermaidCount > 0) {
    // Wait for initial render (longer for complex diagrams)
    await new Promise(resolve => setTimeout(resolve, 5000));

    // Try to manually trigger mermaid rendering if needed
    await page.evaluate(() => {
      if (window.mermaid) {
        // Check if diagrams are already rendered
        const rendered = document.querySelectorAll('.mermaid svg').length;
        const total = document.querySelectorAll('.mermaid').length;

        console.log(`Rendered: ${rendered}/${total}`);

        if (rendered < total) {
          // Force re-render
          window.mermaid.init(undefined, document.querySelectorAll('.mermaid'));
        }
      }
    });

    // Wait for all diagrams to render (increased timeout to 60 seconds)
    await page.waitForFunction(
      () => {
        const mermaidDivs = document.querySelectorAll('.mermaid');
        if (mermaidDivs.length === 0) return true;

        const renderedCount = Array.from(mermaidDivs).filter(div => {
          return div.querySelector('svg') !== null;
        }).length;

        return renderedCount === mermaidDivs.length;
      },
      { timeout: 60000 }
    ).catch(() => {
      console.log('⚠ Warning: Not all Mermaid diagrams rendered within 60 seconds');
    });

    // Final wait to ensure complete rendering
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Log render status with details
    const renderStatus = await page.evaluate(() => {
      const mermaidDivs = document.querySelectorAll('.mermaid');
      const results = [];

      Array.from(mermaidDivs).forEach((div, index) => {
        const hasSvg = div.querySelector('svg') !== null;
        const content = div.textContent.substring(0, 50).trim();
        results.push({
          index: index + 1,
          rendered: hasSvg,
          preview: content
        });
      });

      const rendered = results.filter(r => r.rendered).length;
      return {
        total: mermaidDivs.length,
        rendered: rendered,
        details: results
      };
    });

    console.log(`✓ Rendered ${renderStatus.rendered}/${renderStatus.total} Mermaid diagrams`);

    // Log failed diagrams and replace with error placeholder
    const failed = renderStatus.details.filter(d => !d.rendered);
    if (failed.length > 0) {
      console.log('⚠ Failed to render:');
      failed.forEach(f => {
        console.log(`  - Diagram #${f.index}: ${f.preview}...`);
      });

      // Replace failed diagrams with error placeholder SVG
      await page.evaluate(() => {
        const errorSvg = `
          <svg width="600" height="300" xmlns="http://www.w3.org/2000/svg">
            <rect width="600" height="300" fill="#fff5f5" stroke="#e53e3e" stroke-width="2" rx="8"/>
            <g transform="translate(300, 100)">
              <!-- Warning icon -->
              <circle cx="0" cy="0" r="40" fill="#fed7d7" stroke="#e53e3e" stroke-width="3"/>
              <text x="0" y="15" font-size="48" font-weight="bold" fill="#e53e3e" text-anchor="middle">!</text>
            </g>
            <text x="300" y="180" font-size="20" font-weight="bold" fill="#742a2a" text-anchor="middle" font-family="'Noto Sans TC', Arial, sans-serif">
              Mermaid 圖表渲染失敗
            </text>
            <text x="300" y="210" font-size="14" fill="#742a2a" text-anchor="middle" font-family="'Noto Sans TC', Arial, sans-serif">
              此圖表因過於複雜或語法錯誤而無法顯示
            </text>
            <text x="300" y="240" font-size="14" fill="#742a2a" text-anchor="middle" font-family="'Noto Sans TC', Arial, sans-serif">
              請參考原始 Markdown 文件查看圖表定義
            </text>
          </svg>
        `;

        const mermaidDivs = document.querySelectorAll('.mermaid');
        Array.from(mermaidDivs).forEach((div) => {
          const hasSvg = div.querySelector('svg') !== null;
          if (!hasSvg) {
            // Clear the div and insert error SVG
            div.innerHTML = errorSvg;
            div.style.border = '2px solid #e53e3e';
            div.style.borderRadius = '8px';
            div.style.padding = '20px';
            div.style.margin = '20px 0';
            div.style.backgroundColor = '#fff5f5';
          }
        });
      });

      console.log(`✓ Replaced ${failed.length} failed diagram(s) with error placeholder`);
    }

    // Apply scale classes based on HTML comments (<!-- scale:80 -->)
    await page.evaluate(() => {
      const allElements = document.body.querySelectorAll('*');

      allElements.forEach(element => {
        // Check if previous sibling is a comment with scale directive
        let node = element.previousSibling;
        while (node) {
          if (node.nodeType === Node.COMMENT_NODE) {
            const match = node.textContent.trim().match(/scale:(\d+)/);
            if (match) {
              const scaleValue = match[1];
              const scaleClass = `scale-${scaleValue}`;

              // For mermaid diagrams, wrap the rendered SVG
              if (element.classList.contains('mermaid')) {
                element.classList.add(scaleClass);
                console.log(`Applied ${scaleClass} to Mermaid diagram`);
              }
              // For code blocks
              else if (element.tagName === 'PRE') {
                element.classList.add(scaleClass);
                console.log(`Applied ${scaleClass} to code block`);
              }
              break;
            }
          }
          // Only check text nodes and comments before the element
          if (node.nodeType === Node.ELEMENT_NODE) break;
          node = node.previousSibling;
        }
      });
    });

    // Get page break configuration from environment or use defaults
    const pageBreakConfig = {
      minRemainingSpace: parseInt(process.env.PAGE_BREAK_MIN_REMAINING || '100'),
      largeContentThreshold: parseInt(process.env.PAGE_BREAK_LARGE_CONTENT || '900'),
      headingMinSpace: parseInt(process.env.PAGE_BREAK_HEADING_MIN || '80'),
      forceBreakOffset: parseInt(process.env.PAGE_BREAK_FORCE_OFFSET || '150'),
      overflowTolerance: parseInt(process.env.PAGE_BREAK_OVERFLOW_TOLERANCE || '50'),
      debug: process.env.PAGE_BREAK_DEBUG === 'true'
    };

    console.log('Page break configuration:', pageBreakConfig);

    // Group headings with following content and apply smart page breaks
    await page.evaluate((config) => {
      // Page configuration (A4 at 96 DPI)
      const PAGE_HEIGHT = 297 * 3.7795275591; // mm to px
      const MARGIN_TOP = 0;
      const MARGIN_BOTTOM = 0;
      const USABLE_PAGE_HEIGHT = PAGE_HEIGHT - MARGIN_TOP - MARGIN_BOTTOM;

      // Thresholds - 從配置參數讀取
      const MIN_REMAINING_SPACE = config.minRemainingSpace;
      const LARGE_CONTENT_THRESHOLD = config.largeContentThreshold;
      const HEADING_MIN_SPACE = config.headingMinSpace;
      const FORCE_BREAK_OFFSET = config.forceBreakOffset;
      const OVERFLOW_TOLERANCE = config.overflowTolerance;
      const DEBUG = config.debug;

      const headings = Array.from(document.querySelectorAll('h1, h2, h3, h4, h5, h6'));
      let groupCount = 0;
      let forceBreakCount = 0;

      headings.forEach(heading => {
        // 檢查標題是否已經被包裹過(避免重複處理)
        if (heading.parentElement && heading.parentElement.classList.contains('heading-group')) {
          return;
        }

        const nextElement = heading.nextElementSibling;

        // Check if next element is content that should stay with heading
        if (nextElement && (
          nextElement.classList.contains('mermaid') ||
          nextElement.tagName === 'PRE' ||
          nextElement.tagName === 'IMG' ||
          nextElement.tagName === 'TABLE' ||
          nextElement.tagName === 'BLOCKQUOTE'
        )) {
          // Create wrapper
          const wrapper = document.createElement('div');
          wrapper.className = 'heading-group';

          // Insert wrapper before heading
          const parent = heading.parentNode;
          parent.insertBefore(wrapper, heading);

          // Move heading and next element into wrapper
          wrapper.appendChild(heading);
          wrapper.appendChild(nextElement);

          groupCount++;

          // Measure the group
          const groupRect = wrapper.getBoundingClientRect();
          const groupHeight = groupRect.height;
          const groupTop = groupRect.top;

          // Calculate position within current page
          const pageOffset = groupTop % USABLE_PAGE_HEIGHT;
          const remainingSpace = USABLE_PAGE_HEIGHT - pageOffset;

          // Decide if we need to force a page break
          let needsPageBreak = false;
          let reason = '';

          // 策略 1: 非常大的內容需要獨立一頁
          if (groupHeight > LARGE_CONTENT_THRESHOLD) {
            // 只有在不是頁面頂部時才分頁
            needsPageBreak = pageOffset > FORCE_BREAK_OFFSET;
            reason = 'large content';
          }
          // 策略 2: 內容完全放不下(超過剩餘空間)
          else if (groupHeight > remainingSpace) {
            // 但如果只是稍微超過一點點(在容許範圍內),就允許自然分頁
            if (groupHeight - remainingSpace > OVERFLOW_TOLERANCE) {
              needsPageBreak = true;
              reason = 'content too large';
            }
          }
          // 策略 3: 標題在頁面最底部
          else if (remainingSpace < HEADING_MIN_SPACE) {
            needsPageBreak = true;
            reason = 'heading at bottom';
          }
          // 策略 4: 內容會被嚴重切割
          else if (groupHeight > 400 && groupHeight > remainingSpace * 0.85) {
            needsPageBreak = true;
            reason = 'severe split';
          }

          if (needsPageBreak) {
            wrapper.classList.add('force-page-break-before');
            forceBreakCount++;
            const msg = `Force page break: ${heading.tagName} (${reason}, height: ${Math.round(groupHeight)}px, remaining: ${Math.round(remainingSpace)}px, offset: ${Math.round(pageOffset)}px)`;
            console.log(msg);
            if (DEBUG) {
              wrapper.setAttribute('data-page-break', reason);
              wrapper.setAttribute('data-height', Math.round(groupHeight));
              wrapper.setAttribute('data-remaining', Math.round(remainingSpace));
            }
          } else {
            if (DEBUG) {
              const msg = `Keep together: ${heading.tagName} (height: ${Math.round(groupHeight)}px, remaining: ${Math.round(remainingSpace)}px, offset: ${Math.round(pageOffset)}px)`;
              console.log(msg);
            }
          }
        }
      });

      console.log(`Grouped ${groupCount} heading(s), forced ${forceBreakCount} page break(s)`);

      if (DEBUG) {
        console.log(`[DEBUG MODE] Added data attributes to page break elements`);
      }
    }, pageBreakConfig);

    // Add page break before the first H1 (after TOC)
    await page.evaluate(() => {
      const allH1 = document.querySelectorAll('h1');
      if (allH1.length > 1) {
        // Find the first H1 that's NOT in the table-of-contents
        for (let i = 0; i < allH1.length; i++) {
          const h1 = allH1[i];
          const isInToc = h1.closest('.table-of-contents');
          if (!isInToc) {
            // This is the first content H1, add page break before it
            const pageBreak = document.createElement('div');
            pageBreak.className = 'h2-page-break';
            h1.parentNode.insertBefore(pageBreak, h1);
            console.log('Added page break before first content H1');
            break;
          }
        }
      }
    });

    // Add page breaks before H2 headings (configurable)
    const forceH2PageBreak = process.env.PAGE_BREAK_FORCE_H2 !== 'false'; // 預設 true

    if (forceH2PageBreak) {
      await page.evaluate(() => {
        const h2Elements = document.querySelectorAll('h2');
        let breakCount = 0;

        h2Elements.forEach((h2, index) => {
          // Skip first H2 or H2 right after H1
          const prevElement = h2.previousElementSibling;
          if (index === 0 || (prevElement && prevElement.tagName === 'H1')) {
            return;
          }

          // Insert a page break div before the H2
          const pageBreak = document.createElement('div');
          pageBreak.className = 'h2-page-break';
          h2.parentNode.insertBefore(pageBreak, h2);
          breakCount++;
        });

        console.log(`Added ${breakCount} page break(s) before H2 headings`);
      });
    } else {
      console.log('Skipped H2 page breaks (PAGE_BREAK_FORCE_H2=false)');
    }

    // Scale diagrams to fit page
    await page.evaluate(() => {
      const mermaidDivs = document.querySelectorAll('.mermaid');
      mermaidDivs.forEach(div => {
        const svg = div.querySelector('svg');
        if (svg) {
          // Get current dimensions
          const bbox = svg.getBBox();
          const currentWidth = bbox.width;
          const currentHeight = bbox.height;

          // Calculate max dimensions (A4 - margins)
          const maxWidth = 210 - 40; // mm (A4 width - 40mm margins)
          const maxHeight = 297 - 80; // mm (A4 height - 80mm for margins and text)

          // Convert to pixels (assuming 96 DPI)
          const maxWidthPx = maxWidth * 3.7795275591; // mm to px
          const maxHeightPx = maxHeight * 3.7795275591;

          // Calculate scale factor
          const scaleX = maxWidthPx / currentWidth;
          const scaleY = maxHeightPx / currentHeight;
          const scale = Math.min(scaleX, scaleY, 1); // Never scale up, only down

          if (scale < 1) {
            // Apply scaling
            const newWidth = currentWidth * scale;
            const newHeight = currentHeight * scale;

            svg.setAttribute('width', newWidth + 'px');
            svg.setAttribute('height', newHeight + 'px');
            svg.style.maxWidth = '100%';
            svg.style.height = 'auto';

            console.log(`Scaled diagram from ${currentWidth}x${currentHeight} to ${newWidth}x${newHeight}`);
          }
        }
      });
    });
  }

  // Handle images: wrap in containers and add page breaks for large images
  await page.evaluate(() => {
    const PAGE_HEIGHT = 297 * 3.7795275591; // A4 height in px
    const MARGIN = 40 * 3.7795275591; // margins in px
    const MAX_IMAGE_HEIGHT = PAGE_HEIGHT - MARGIN;

    const images = document.querySelectorAll('img');
    let wrappedCount = 0;
    let pageBreakCount = 0;

    images.forEach(img => {
      // Skip if already in a container
      if (img.parentElement?.classList.contains('image-container')) {
        return;
      }

      // Wrap image in container
      const container = document.createElement('div');
      container.className = 'image-container';
      img.parentNode.insertBefore(container, img);
      container.appendChild(img);
      wrappedCount++;

      // Check if image is large and needs page break
      const rect = container.getBoundingClientRect();
      const pageOffset = rect.top % (PAGE_HEIGHT - MARGIN);
      const remainingSpace = (PAGE_HEIGHT - MARGIN) - pageOffset;

      // If image won't fit in remaining space, add page break before it
      if (rect.height > remainingSpace && rect.height < MAX_IMAGE_HEIGHT) {
        container.classList.add('force-page-break-before');
        pageBreakCount++;
      }

      // If image is too large, scale it down
      if (rect.height > MAX_IMAGE_HEIGHT) {
        img.style.maxHeight = `${MAX_IMAGE_HEIGHT}px`;
        img.style.width = 'auto';
        container.classList.add('large-image');
      }
    });

    if (wrappedCount > 0 || pageBreakCount > 0) {
      console.log(`Images: wrapped ${wrappedCount}, added ${pageBreakCount} page break(s)`);
    }
  });

  // Note: Page numbers in TOC are not included due to complexity of accurate calculation
  // with dynamic page breaks. TOC links are still clickable for navigation.

  await page.pdf({
    path: outputPath,
    format: 'A4',
    printBackground: true,
    margin: {
      top: '20mm',
      right: '20mm',
      bottom: '25mm',
      left: '20mm'
    },
    displayHeaderFooter: true,
    footerTemplate: `
      <div style="font-size: 10pt; text-align: right; width: 100%; padding-right: 20mm; color: #666; font-family: 'Noto Sans TC', sans-serif;">
        <span class="pageNumber"></span> / <span class="totalPages"></span>
      </div>
    `,
    headerTemplate: '<div></div>' // 空的 header
  });

  await browser.close();

  // Capture screenshots from PDF for debugging if DEBUG_SCREENSHOTS environment variable is set
  if (process.env.DEBUG_SCREENSHOTS === 'true') {
    const screenshotDir = outputPath.replace('.pdf', '_screenshots');
    await capturePageScreenshotsFromPDF(outputPath, screenshotDir);
  }

}

/**
 * Capture screenshots from generated PDF file (for debugging)
 * Uses pdf-poppler to convert PDF pages to images
 *
 * @param {string} pdfPath - Path to the generated PDF
 * @param {string} outputDir - Directory to save images
 */
async function capturePageScreenshotsFromPDF(pdfPath, outputDir) {
  try {
    const poppler = require('pdf-poppler');

    // Create output directory if it doesn't exist
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    console.log(`Capturing screenshots from PDF: ${path.basename(pdfPath)}`);

    // Try to find local poppler installation
    const localPopplerPath = path.join(__dirname, '..', '..', '..', 'poppler', 'poppler-24.08.0', 'Library', 'bin');
    const systemPopplerPath = process.env.POPPLER_PATH;

    // Configure pdf-poppler options
    const opts = {
      format: 'png',
      out_dir: outputDir,
      out_prefix: 'page',
      page: null  // Convert all pages
    };

    // Add poppler path if local installation exists
    if (fs.existsSync(localPopplerPath)) {
      opts.poppler_path = localPopplerPath;
      console.log(`Using local poppler at: ${localPopplerPath}`);
    } else if (systemPopplerPath) {
      opts.poppler_path = systemPopplerPath;
      console.log(`Using system poppler at: ${systemPopplerPath}`);
    }

    // Convert PDF to images
    await poppler.convert(pdfPath, opts);

    // Count generated images
    const files = fs.readdirSync(outputDir);
    const pageImages = files.filter(f => f.startsWith('page-') && f.endsWith('.png'));

    // Rename files to match expected format (page-1.png, page-2.png, etc.)
    pageImages.forEach((file, index) => {
      const oldPath = path.join(outputDir, file);
      const newPath = path.join(outputDir, `page-${index + 1}.png`);
      if (oldPath !== newPath) {
        fs.renameSync(oldPath, newPath);
      }
      console.log(`  ✓ Captured page ${index + 1}`);
    });

    console.log(`Screenshots saved to: ${outputDir}`);
    console.log(`✓ Successfully converted ${pageImages.length} page(s) to images`);
  } catch (error) {
    console.error('⚠ Error capturing screenshots:', error.message);
    console.log('Note: pdf-poppler requires poppler-utils to be installed on your system');
    console.log('Windows: Download from https://github.com/oschwartz10612/poppler-windows/releases');
    console.log('macOS: brew install poppler');
    console.log('Linux: sudo apt-get install poppler-utils');
  }
}

/**
 * Main conversion function
 * @param {string} input - File path or URL
 * @param {string} outputPath - Optional output PDF path
 * @param {Object} options - Conversion options
 * @param {boolean} options.convertMermaid - Convert Mermaid diagrams to SVG before PDF generation
 */
async function convertMarkdownToPdf(input, outputPath = null, options = {}) {
  const { convertMermaid = false } = options;
  try {
    let markdownContent;
    let title = 'Document';
    let isFromUrl = false;

    // Pre-process: Convert Mermaid diagrams to SVG images if requested
    // Only process local files, not URLs
    const inputIsUrl = isUrl(input);
    if (convertMermaid && !inputIsUrl && fs.existsSync(input)) {
      console.log('\n正在預處理 Mermaid 圖表...');
      try {
        const processedMdPath = await processMermaidInMarkdown(input);
        input = processedMdPath; // Use the processed file instead
        console.log('✓ Mermaid 圖表預處理完成\n');
      } catch (error) {
        console.warn('⚠ Mermaid 預處理失敗，將使用原始檔案:', error.message);
      }
    }

    // Check if input is a URL
    if (isUrl(input)) {
      isFromUrl = true;
      console.log(`Fetching from URL: ${input}`);

      // Handle HackMD URLs
      if (input.includes('hackmd.io')) {
        const downloadUrl = hackmdUrlToDownloadUrl(input);
        console.log(`Downloading from: ${downloadUrl}`);
        markdownContent = await fetchFromUrl(downloadUrl);
        title = 'HackMD-Document';
      } else {
        // Generic URL
        markdownContent = await fetchFromUrl(input);
        title = 'Web-Document';
      }

      // Determine output path for URL
      if (!outputPath) {
        outputPath = `./${title}.pdf`;
      }
    } else {
      // Input is a file path
      if (!fs.existsSync(input)) {
        throw new Error(`File not found: ${input}`);
      }

      if (path.extname(input).toLowerCase() !== '.md') {
        throw new Error('Input file must be a Markdown (.md) file');
      }

      markdownContent = input; // Will be read by convertMarkdownToHtml
      title = path.basename(input, '.md');

      // Determine output path for file
      if (!outputPath) {
        outputPath = input.replace(/\.md$/i, '.pdf');
      }
    }

    // Ensure output has .pdf extension
    if (path.extname(outputPath).toLowerCase() !== '.pdf') {
      outputPath += '.pdf';
    }

    console.log(`Converting to PDF...`);

    // Determine base directory for resolving relative image paths
    const baseDir = isFromUrl ? process.cwd() : path.dirname(path.resolve(input));

    // Generate PDF
    const htmlContent = await convertMarkdownToHtml(markdownContent, title);
    await convertHtmlToPdf(htmlContent, outputPath, { baseDir });

    console.log(`✓ PDF created successfully: ${outputPath}`);

    return outputPath;

  } catch (error) {
    console.error(`✗ Error converting Markdown to PDF: ${error.message}`);
    throw error;
  }
}

// CLI interface
if (require.main === module) {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.log('Usage:');
    console.log('  node convert.js <input.md> [output.pdf] [options]');
    console.log('  node convert.js <url> [output.pdf] [options]');
    console.log('');
    console.log('Options:');
    console.log('  --debug-screenshots    Generate page screenshots for debugging');
    console.log('  --convert-mermaid     Convert Mermaid diagrams to SVG images before PDF generation');
    console.log('');
    console.log('Examples:');
    console.log('  node convert.js example.md');
    console.log('  node convert.js example.md output.pdf');
    console.log('  node convert.js example.md --convert-mermaid');
    console.log('  node convert.js https://hackmd.io/@user/note-id');
    console.log('  node convert.js https://hackmd.io/@user/note-id custom.pdf');
    console.log('  node convert.js example.md output.pdf --debug-screenshots');
    process.exit(1);
  }

  // Parse flags
  const enableScreenshots = args.includes('--debug-screenshots');
  const convertMermaidMode = args.includes('--convert-mermaid');

  if (enableScreenshots) {
    process.env.DEBUG_SCREENSHOTS = 'true';
  }

  // Filter out flags to get file arguments
  const filteredArgs = args.filter(arg =>
    !arg.startsWith('--')
  );

  const input = filteredArgs[0];
  const outputPath = filteredArgs[1];

  // Prepare options
  const options = {
    convertMermaid: convertMermaidMode
  };

  convertMarkdownToPdf(input, outputPath, options)
    .then(() => process.exit(0))
    .catch((error) => {
      console.error('Error:', error.message);
      process.exit(1);
    });
}

module.exports = { convertMarkdownToPdf };

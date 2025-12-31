/**
 * DOCX 樣式設定檔 - 預設樣式
 *
 * 此檔案定義 Markdown 轉 DOCX 時的所有視覺樣式
 * 使用者可複製此檔案並修改，然後在轉換時指定使用自訂樣式
 *
 * 顏色格式: 6位 HEX 碼（不含 #）
 * 尺寸單位:
 *   - fontSize: 半點 (half-points)，例如 28 = 14pt
 *   - spacing: twips，1pt = 20 twips
 *   - indent: twips
 */

module.exports = {
  // ============================================================
  // 文件基本設定
  // ============================================================
  document: {
    // 預設字型
    defaultFont: {
      ascii: 'Microsoft JhengHei',      // 英文字型
      eastAsia: 'Microsoft JhengHei',   // 中文字型
      hAnsi: 'Microsoft JhengHei',
      cs: 'Microsoft JhengHei'
    },
    // 預設字體大小 (半點)
    defaultFontSize: 24,  // 12pt
  },

  // ============================================================
  // 標題樣式 (Headings)
  // ============================================================
  headings: {
    // 共用設定
    common: {
      font: {
        ascii: 'Microsoft JhengHei',
        eastAsia: 'Microsoft JhengHei',
        hAnsi: 'Microsoft JhengHei',
        cs: 'Microsoft JhengHei'
      },
      bold: true,
    },

    // H1 樣式
    h1: {
      fontSize: 64,           // 32pt
      color: '1f2328',        // 深灰色
      spacing: {
        before: 480,          // 24pt
        after: 240            // 12pt
      },
      border: {
        bottom: {
          color: 'd1d9e0',    // 淺灰色底線
          size: 6,            // 0.75pt
          space: 6
        }
      }
    },

    // H2 樣式
    h2: {
      fontSize: 48,           // 24pt
      color: '1f2328',
      spacing: {
        before: 400,          // 20pt
        after: 200            // 10pt
      },
      border: {
        bottom: {
          color: 'd1d9e0',
          size: 6,
          space: 4
        }
      }
    },

    // H3 樣式
    h3: {
      fontSize: 40,           // 20pt
      color: '1f2328',
      spacing: {
        before: 320,          // 16pt
        after: 160            // 8pt
      },
      border: null            // 無底線
    },

    // H4 樣式
    h4: {
      fontSize: 36,           // 18pt
      color: '1f2328',
      spacing: {
        before: 240,          // 12pt
        after: 120            // 6pt
      },
      border: null
    },

    // H5 樣式
    h5: {
      fontSize: 32,           // 16pt
      color: '656d76',        // 較淺灰色
      spacing: {
        before: 200,          // 10pt
        after: 100            // 5pt
      },
      border: null
    },

    // H6 樣式
    h6: {
      fontSize: 30,           // 15pt
      color: '656d76',
      spacing: {
        before: 160,          // 8pt
        after: 80             // 4pt
      },
      border: null
    }
  },

  // ============================================================
  // 段落樣式 (Paragraph)
  // ============================================================
  paragraph: {
    // 一般文字
    text: {
      fontSize: 24,           // 12pt
      color: '1f2328',
      lineSpacing: 360        // 1.5倍行高 (240 * 1.5)
    },

    // 粗體
    bold: {
      // 繼承一般文字樣式，額外加粗
    },

    // 斜體
    italic: {
      // 繼承一般文字樣式，額外斜體
    },

    // 刪除線
    strikethrough: {
      // 繼承一般文字樣式，額外刪除線
    },

    // 行內程式碼
    inlineCode: {
      font: {
        ascii: 'Consolas',
        eastAsia: 'Microsoft JhengHei',
        hAnsi: 'Consolas',
        cs: 'Consolas'
      },
      fontSize: 22,           // 11pt (略小)
      color: '1f2328',
      backgroundColor: 'e8e8e8',  // 淺灰背景
      border: {
        color: 'cccccc'
      }
    },

    // HackMD 高亮 (==text==)
    highlight: {
      backgroundColor: 'fff3cd'  // 淺黃色
    },

    // HackMD 底線 (++text++)
    underline: {
      // 使用預設底線樣式
    },

    // 上標 (^text^)
    superscript: {
      fontSize: 20            // 10pt
    },

    // 下標 (~text~)
    subscript: {
      fontSize: 20            // 10pt
    }
  },

  // ============================================================
  // 連結樣式 (Links)
  // ============================================================
  link: {
    color: '0563C1',          // 藍色
    underline: true
  },

  // ============================================================
  // 列表樣式 (Lists)
  // ============================================================
  list: {
    // 縮排設定 (每層級)
    indent: {
      left: 720,              // 0.5 inch per level
      hanging: 360            // 懸掛縮排
    },

    // 無序列表符號
    bullet: {
      level0: '●',            // 實心圓
      level1: '○',            // 空心圓
      level2: '■',            // 實心方塊
      level3: '●',
      level4: '○',
      level5: '■'
    },

    // 有序列表格式
    ordered: {
      format: 'decimal',      // 數字格式: decimal, lowerLetter, upperLetter, lowerRoman, upperRoman
      suffix: '.'             // 後綴符號
    },

    // 核取方塊
    checkbox: {
      checked: {
        symbol: '☑',
        color: '28a745'       // 綠色
      },
      unchecked: {
        symbol: '☐',
        color: '6c757d'       // 灰色
      }
    }
  },

  // ============================================================
  // 引用區塊樣式 (Blockquote)
  // ============================================================
  blockquote: {
    text: {
      color: '656d76',        // 灰色文字
      fontSize: 24,           // 12pt
      italic: true
    },
    border: {
      left: {
        color: 'd1d9e0',      // 淺灰色左邊框
        size: 24,             // 3pt
        space: 8
      }
    },
    indent: {
      left: 480               // 左縮排
    },
    backgroundColor: null     // 無背景色
  },

  // ============================================================
  // 表格樣式 (Tables)
  // ============================================================
  table: {
    // 表頭
    header: {
      backgroundColor: 'f6f8fa',  // 淺灰背景
      text: {
        bold: true,              // 表頭文字不加粗
        color: '1f2328',
        fontSize: 24              // 12pt
      }
    },

    // 一般儲存格
    cell: {
      backgroundColor: 'ffffff',  // 白色背景
      text: {
        color: '1f2328',
        fontSize: 24              // 12pt
      },
      padding: {
        top: 80,
        bottom: 80,
        left: 120,
        right: 120
      }
    },

    // 交替列顏色（斑馬紋）
    alternateRow: {
      enabled: true,
      backgroundColor: 'f9f9f9'
    },

    // 邊框
    border: {
      enabled: false,              // 是否顯示邊框
      color: 'd1d9e0',
      size: 6                     // 0.75pt
    },

    // 自適應字體（大表格）
    adaptive: {
      enabled: true,
      // 欄位數對應字體大小
      columnThresholds: [
        { maxColumns: 4, fontSize: 24 },   // ≤4 欄: 12pt
        { maxColumns: 6, fontSize: 22 },   // ≤6 欄: 11pt
        { maxColumns: 8, fontSize: 20 },   // ≤8 欄: 10pt
        { maxColumns: 10, fontSize: 18 },  // ≤10 欄: 9pt
        { maxColumns: Infinity, fontSize: 16 }  // >10 欄: 8pt
      ]
    }
  },

  // ============================================================
  // 程式碼區塊樣式 (Code Blocks)
  // ============================================================
  codeBlock: {
    // 程式碼標頭（顯示語言名稱）
    header: {
      backgroundColor: '1e1e1e',  // 深色背景
      text: {
        color: '858585',          // 灰色文字
        fontSize: 14              // px (用於 HTML)
      },
      padding: '8px 20px',
      borderRadius: 0             // 方角 (0 = 無圓角)
    },

    // 程式碼內容區
    content: {
      backgroundColor: '2d2d2d',  // 深灰背景
      padding: '20px',
      paddingLeft: '0',           // 行號區域需要
      borderRadius: 0,            // 方角
      maxHeight: 600              // px，最大高度
    },

    // 程式碼文字
    code: {
      fontFamily: "'Consolas', 'Monaco', 'Courier New', monospace",
      fontSize: 14,               // px
      lineHeight: 1.5,
      color: 'cccccc'             // 淺灰文字
    },

    // 行號
    lineNumbers: {
      enabled: true,
      color: '73ff70',            // 灰色
      backgroundColor: '2d2d2d',
      borderRight: '1px solid #555',
      paddingRight: '12px',
      marginRight: '12px',
      minWidth: '40px'
    },

    // 語法高亮主題
    syntaxTheme: 'prism-tomorrow',  // Prism.js 主題名稱

    // 圖片輸出設定
    image: {
      maxWidth: 1200,             // px
      scale: 2,                   // 高解析度縮放
      format: 'png'
    }
  },

  // ============================================================
  // 水平分隔線樣式 (Horizontal Rule)
  // ============================================================
  horizontalRule: {
    color: 'd1d9e0',
    size: 6,                      // 0.75pt
    space: 1
  },

  // ============================================================
  // 封面頁樣式 (Cover Page)
  // ============================================================
  cover: {
    // 主標題
    title: {
      fontSize: 72,               // 36pt
      color: '1f2328',
      bold: true,
      alignment: 'center',
      spacing: {
        before: 2400,             // 上方大間距
        after: 480
      }
    },

    // 副標題
    subtitle: {
      fontSize: 36,               // 18pt
      color: '656d76',
      alignment: 'center',
      spacing: {
        before: 240,
        after: 240
      }
    },

    // 作者
    author: {
      fontSize: 28,               // 14pt
      color: '656d76',
      alignment: 'center',
      spacing: {
        before: 960,
        after: 120
      }
    },

    // 日期
    date: {
      fontSize: 24,               // 12pt
      color: '656d76',
      alignment: 'center',
      spacing: {
        before: 120,
        after: 120
      }
    }
  },

  // ============================================================
  // 頁首樣式 (Header)
  // ============================================================
  header: {
    enabled: true,
    text: {
      fontSize: 20,               // 10pt
      color: '888888',
      alignment: 'center'         // left, center, right
    },
    border: {
      bottom: {
        enabled: false,
        color: 'cccccc',
        size: 4
      }
    }
  },

  // ============================================================
  // 頁尾樣式 (Footer)
  // ============================================================
  footer: {
    enabled: true,
    // 頁碼設定
    pageNumber: {
      enabled: true,
      format: 'Page {current} of {total}',  // 頁碼格式
      fontSize: 20,               // 10pt
      color: '888888',
      alignment: 'center'
    }
  },

  // ============================================================
  // 目錄樣式 (Table of Contents)
  // ============================================================
  toc: {
    title: {
      text: '目錄',
      fontSize: 48,               // 24pt
      bold: true,
      color: '1f2328',
      spacing: {
        before: 0,
        after: 480
      }
    },
    // 各層級樣式
    levels: {
      level1: {
        fontSize: 28,             // 14pt
        bold: true,
        indent: 0
      },
      level2: {
        fontSize: 26,             // 13pt
        bold: false,
        indent: 480
      },
      level3: {
        fontSize: 24,             // 12pt
        bold: false,
        indent: 960
      }
    },
    // 引導線
    leader: 'dot'                 // dot, hyphen, underscore, none
  },

  // ============================================================
  // HackMD 特殊區塊樣式 (:::info, :::warning, etc.)
  // ============================================================
  hackmd: {
    // 資訊區塊 (:::info)
    info: {
      backgroundColor: 'e7f3ff',
      borderLeft: {
        color: '0969da',
        size: 24
      },
      text: {
        color: '1f2328'
      },
      icon: 'ℹ️'
    },

    // 警告區塊 (:::warning)
    warning: {
      backgroundColor: 'fff8e6',
      borderLeft: {
        color: 'd4a72c',
        size: 24
      },
      text: {
        color: '1f2328'
      },
      icon: '⚠️'
    },

    // 危險區塊 (:::danger)
    danger: {
      backgroundColor: 'ffe7e7',
      borderLeft: {
        color: 'd73a49',
        size: 24
      },
      text: {
        color: '1f2328'
      },
      icon: '🚨'
    },

    // 成功區塊 (:::success)
    success: {
      backgroundColor: 'e6ffe6',
      borderLeft: {
        color: '28a745',
        size: 24
      },
      text: {
        color: '1f2328'
      },
      icon: '✅'
    }
  },

  // ============================================================
  // 圖片樣式 (Images)
  // ============================================================
  image: {
    alignment: 'center',          // left, center, right
    maxWidth: 600,                // 最大寬度 (像素，將轉換為 EMU)
    spacing: {
      before: 240,
      after: 240
    },
    // 圖片說明文字
    caption: {
      enabled: true,
      fontSize: 20,               // 10pt
      color: '656d76',
      italic: true,
      alignment: 'center'
    }
  },

  // ============================================================
  // 腳註樣式 (Footnotes)
  // ============================================================
  footnote: {
    reference: {
      fontSize: 18,               // 9pt
      superscript: true,
      color: '0563C1'
    },
    text: {
      fontSize: 20,               // 10pt
      color: '656d76'
    }
  }
};

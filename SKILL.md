---
name: md-converter
description: Convert Markdown files or HackMD URLs to PDF or DOCX with full support for Traditional Chinese characters, embedded images, Mermaid diagrams, code blocks, and intelligent page breaks. Use this skill when users need to export Markdown documents to PDF or Word format, especially for Chinese content, technical documentation with diagrams, or online HackMD documents.
---

# Markdown Converter (PDF / DOCX)

This skill converts Markdown files or HackMD URLs to professionally formatted **PDF** or **DOCX** documents.

## Quick Start

```bash
# Convert to both PDF and DOCX
node convertAll.js input.md

# Convert to PDF only
node convertAll.js input.md --format pdf

# Convert to DOCX only
node convertAll.js input.md --format docx
```

---

## Features

| Feature | PDF | DOCX |
|---------|:---:|:----:|
| Traditional Chinese | ✓ | ✓ |
| Mermaid Diagrams | ✓ | ✓ |
| Code Syntax Highlighting + Line Numbers | ✓ | ✓ |
| Table of Contents | ✓ | ✓ |
| Smart Page Breaks (no image splitting) | ✓ | - |
| Cover Page | - | ✓ |
| Headers/Footers | ✓ | ✓ |
| Table Styling | ✓ | ✓ |
| HackMD Syntax (`:::info`, `==highlight==`) | - | ✓ |
| Custom Styles | ✓ | ✓ |

---

## Command

```bash
node convertAll.js <input.md> [options]
```

### Options

| Option | Description |
|--------|-------------|
| `--format pdf` | Output PDF only |
| `--format docx` | Output DOCX only |
| `--format both` | Output both PDF and DOCX (default) |
| `--skip-mermaid` | Skip Mermaid pre-processing |
| `--skip-code` | Skip code block pre-processing |
| `--verbose` | Show detailed output |

### Examples

```bash
# Convert with full pre-processing
node convertAll.js README.md

# PDF only (faster)
node convertAll.js document.md --format pdf

# DOCX only
node convertAll.js guide.md --format docx

# Skip Mermaid processing (if no diagrams)
node convertAll.js report.md --skip-mermaid

# Show detailed output
node convertAll.js doc.md --verbose
```

---

## Automatic Workflow

```
┌─────────────┐    ┌─────────────────┐    ┌─────────────────┐    ┌────────────┐
│  Original   │ -> │ Mermaid → SVG   │ -> │ Code → PNG      │ -> │ PDF/DOCX   │
│  input.md   │    │  (auto-detect)  │    │  (auto-detect)  │    │  Output    │
└─────────────┘    └─────────────────┘    └─────────────────┘    └────────────┘
```

Generated files:

```
input.md              # Original file
input_IMG/            # Mermaid images (auto-generated)
input_IMG_CODE/       # Code block images (auto-generated)
input.pdf             # PDF output
input.docx            # DOCX output
```

---

## Custom Styles

Styles are defined in `styles/default.js`, shared between PDF and DOCX.

### Style Categories

| Category | Description |
|----------|-------------|
| `headings` | H1-H6 font sizes, colors, spacing |
| `table` | Header colors, borders, alternating rows |
| `codeBlock` | Code block colors, line number colors |
| `paragraph` | Text color, inline code background |
| `list` | Bullet point styles |

### Unit Reference

| Type | Conversion | Example |
|------|------------|---------|
| fontSize | half-points | 24 = 12pt |
| spacing | twips | 240 = 12pt |
| color | HEX (no #) | `1f2328` |

---

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Mermaid rendering fails | Tool auto-preprocesses; check Mermaid syntax if still fails |
| Code line numbers missing | Use `convertAll.js` (auto-preprocesses) |
| Images not showing | Verify image paths (relative paths supported) |
| DOCX TOC page numbers wrong | Press **F9** in Word to update |
| Chinese characters garbled | Ensure Microsoft JhengHei or Noto Sans TC fonts installed |

---

## Advanced Usage

For individual step execution (debugging or special needs):

```bash
# HackMD URL to PDF
node convert.js https://hackmd.io/@user/note-id

# PDF page break settings
PAGE_BREAK_FORCE_H2=false node convertAll.js doc.md --format pdf
```

### Environment Variables (PDF)

| Variable | Default | Description |
|----------|---------|-------------|
| `PAGE_BREAK_FORCE_H2` | true | Force page break before H2 |
| `PAGE_BREAK_LARGE_CONTENT` | 900 | Large content threshold (px) |
| `PAGE_BREAK_DEBUG` | false | Debug mode |

---

## Requirements

- Node.js 16+
- npm packages (run `npm install`)
- Internet connection (for fonts and CDN)

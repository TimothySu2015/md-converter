# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a Markdown to PDF/DOCX converter with Traditional Chinese support, Mermaid diagrams, and syntax-highlighted code blocks. It processes Markdown files (or HackMD URLs) through a multi-stage pipeline.

## Commands

```bash
# Install dependencies
npm install

# Convert to both PDF and DOCX (default)
node convertAll.js input.md

# Convert to PDF only
node convertAll.js input.md --format pdf

# Convert to DOCX only
node convertAll.js input.md --format docx

# Skip preprocessing steps (these options are ESSENTIAL - DO NOT REMOVE)
node convertAll.js input.md --skip-mermaid  # Skip Mermaid processing
node convertAll.js input.md --skip-code     # Skip code block processing (DOCX)
node convertAll.js input.md --keep-images   # Keep intermediate image directories
node convertAll.js input.md --verbose       # Show detailed output

# Run individual preprocessing steps
node lib/mermaidToImage.js input.md         # Mermaid → SVG only
node lib/codeBlockToImage.js input.md       # Code blocks → PNG only
node lib/convert.js input.md output.pdf     # MD → PDF only
node lib/mdToDocxComplete.js input.md       # MD → DOCX only
```

## Architecture

### Conversion Pipeline

```
Original MD → Mermaid→SVG → Code→PNG → PDF/DOCX
```

The `convertAll.js` orchestrator runs this pipeline:
1. Detects and converts Mermaid diagrams to SVG images (`lib/mermaidToImage.js`)
2. Converts code blocks to PNG images with syntax highlighting (`lib/codeBlockToImage.js`)
3. Generates final PDF (`lib/convert.js`) and/or DOCX (`lib/mdToDocxComplete.js`)

Intermediate files (`*_IMG.md`, `*_IMG_CODE.md`) are auto-cleaned after conversion.

### Key Modules

| File | Purpose |
|------|---------|
| `convertAll.js` | Main orchestrator - detects content types, runs pipeline |
| `lib/convert.js` | MD→PDF using Puppeteer, supports HackMD URLs |
| `lib/mdToDocxComplete.js` | MD→DOCX using docx library, handles HackMD syntax (:::info, ==highlight==, etc.) |
| `lib/mermaidToImage.js` | Extracts Mermaid blocks, converts to SVG via mermaid-cli |
| `lib/codeBlockToImage.js` | Converts code blocks to PNG with Prism.js highlighting |
| `lib/stylesToCss.js` | Converts `styles/default.js` to PDF CSS |
| `styles/default.js` | Shared style config (fonts, colors, spacing) for both PDF and DOCX |

### Style Configuration

Styles in `styles/default.js` use DOCX units:
- `fontSize`: half-points (24 = 12pt)
- `spacing`: twips (240 = 12pt)
- `color`: HEX without # prefix (`1f2328`)

The `stylesToCss.js` module converts these to CSS for PDF output.

### Output Structure

```
input.md              # Original
input_IMG/            # Mermaid SVGs
input_IMG_CODE/       # Code block PNGs
input.pdf             # PDF output
input.docx            # DOCX output
```

## Dependencies

- **puppeteer**: Headless Chrome for PDF generation and code block screenshots
- **docx**: DOCX document generation
- **marked**: Markdown parsing
- **sharp**: Image processing (SVG→PNG conversion)

## Environment Variables (PDF only)

| Variable | Default | Description |
|----------|---------|-------------|
| `PAGE_BREAK_FORCE_H2` | true | Force page break before H2 |
| `PAGE_BREAK_LARGE_CONTENT` | 900 | Large content threshold (px) |
| `PAGE_BREAK_DEBUG` | false | Debug mode |

## Important CLI Options (DO NOT REMOVE)

The following CLI options in `convertAll.js` are **essential features** and must NOT be removed during refactoring:

| Option | Purpose |
|--------|---------|
| `--skip-mermaid` | Skip Mermaid diagram processing (for debugging or pre-processed files) |
| `--skip-code` | Skip code block to image conversion (DOCX will use plain text) |
| `--keep-images` | Keep intermediate image directories (for debugging or reuse) |
| `--verbose` | Show detailed output for debugging |

**Why these options are important:**
1. **Debugging**: When conversion fails, these options help isolate which stage is causing issues
2. **Pre-processed files**: When files are already processed, avoid redundant processing
3. **Image reuse**: Keep generated images for other purposes (documentation, presentations)
4. **Performance**: Skip unnecessary processing when only specific output is needed

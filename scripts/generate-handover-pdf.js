/**
 * Convert HANDOVER.md to HANDOVER.pdf using pdfkit (already in project deps).
 * Run: node scripts/generate-handover-pdf.js
 */
const fs = require('fs')
const path = require('path')
const PDFDocument = require('pdfkit')

const root = path.join(__dirname, '..')
const inputPath = path.join(root, 'HANDOVER.md')
const outputPath = path.join(root, 'HANDOVER.pdf')

const PAGE_WIDTH = 595.28
const PAGE_HEIGHT = 841.89
const MARGIN = 50
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2
const BOTTOM_LIMIT = PAGE_HEIGHT - MARGIN

function ensureSpace(doc, needed = 20) {
  if (doc.y + needed > BOTTOM_LIMIT) {
    doc.addPage()
  }
}

function writeLine(doc, text, options = {}) {
  const {
    fontSize = 10,
    font = 'Helvetica',
    bold = false,
    indent = 0,
    gap = 0.35,
  } = options

  const face = bold ? `${font}-Bold` : font
  doc.font(face).fontSize(fontSize)

  const height = doc.heightOfString(text, { width: CONTENT_WIDTH - indent })
  ensureSpace(doc, height + 8)

  doc.text(text, MARGIN + indent, doc.y, {
    width: CONTENT_WIDTH - indent,
    lineGap: 2,
  })
  doc.moveDown(gap)
}

function processMarkdown(doc, markdown) {
  const lines = markdown.split(/\r?\n/)
  let inCode = false
  let codeBuffer = []
  let isFirstHeading = true

  const flushCode = () => {
    if (!codeBuffer.length) return
    const block = codeBuffer.join('\n')
    writeLine(doc, block, { fontSize: 8, font: 'Courier', gap: 0.5 })
    codeBuffer = []
  }

  for (const raw of lines) {
    const line = raw.replace(/\t/g, '  ')

    if (line.trim().startsWith('```')) {
      if (inCode) {
        inCode = false
        flushCode()
      } else {
        inCode = true
      }
      continue
    }

    if (inCode) {
      codeBuffer.push(line)
      continue
    }

    if (line.startsWith('# ')) {
      if (!isFirstHeading) doc.addPage()
      isFirstHeading = false
      writeLine(doc, line.slice(2).trim(), { fontSize: 20, bold: true, gap: 0.6 })
      continue
    }

    if (line.startsWith('## ')) {
      ensureSpace(doc, 30)
      writeLine(doc, line.slice(3).trim(), { fontSize: 15, bold: true, gap: 0.45 })
      continue
    }

    if (line.startsWith('### ')) {
      ensureSpace(doc, 24)
      writeLine(doc, line.slice(4).trim(), { fontSize: 12, bold: true, gap: 0.35 })
      continue
    }

    if (line.startsWith('#### ')) {
      writeLine(doc, line.slice(5).trim(), { fontSize: 11, bold: true, gap: 0.3 })
      continue
    }

    if (line.trim() === '---') {
      doc.moveDown(0.4)
      continue
    }

    if (line.startsWith('- ')) {
      writeLine(doc, `• ${line.slice(2).trim()}`, { indent: 12, fontSize: 10 })
      continue
    }

    if (/^\d+\.\s/.test(line)) {
      writeLine(doc, line.trim(), { indent: 12, fontSize: 10 })
      continue
    }

    if (line.startsWith('|')) {
      writeLine(doc, line.trim(), { fontSize: 8, font: 'Courier', gap: 0.15 })
      continue
    }

    if (!line.trim()) {
      doc.moveDown(0.25)
      continue
    }

    // Strip simple markdown bold/inline code for plain PDF text
    const plain = line
      .replace(/\*\*(.*?)\*\*/g, '$1')
      .replace(/`([^`]+)`/g, '$1')
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')

    writeLine(doc, plain, { fontSize: 10 })
  }

  flushCode()
}

function main() {
  if (!fs.existsSync(inputPath)) {
    console.error('HANDOVER.md not found at', inputPath)
    process.exit(1)
  }

  const markdown = fs.readFileSync(inputPath, 'utf8')
  const doc = new PDFDocument({
    size: 'A4',
    margins: { top: MARGIN, bottom: MARGIN, left: MARGIN, right: MARGIN },
    info: {
      Title: 'SP Interior Solutions — Quote Generator Handover',
      Author: 'SP Interior Solutions',
    },
  })

  const stream = fs.createWriteStream(outputPath)
  doc.pipe(stream)

  processMarkdown(doc, markdown)
  doc.end()

  stream.on('finish', () => {
    console.log('Created:', outputPath)
  })

  stream.on('error', (err) => {
    console.error('Failed to write PDF:', err.message)
    process.exit(1)
  })
}

main()

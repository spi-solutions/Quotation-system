/**
 * Shared quotation PDF generation (used by API route and email attachment).
 * Layout reproduced from SP Interior Solutions reference quotation (A4 portrait).
 */
import fs from 'node:fs'
import path from 'node:path'
import {
  PDFDocument,
  StandardFonts,
  rgb,
  type PDFFont,
  type PDFPage,
} from 'pdf-lib'
import fontkit from '@pdf-lib/fontkit'
import * as quoteRepository from '@/lib/repositories/quoteRepository'
import * as customerRepository from '@/lib/repositories/customerRepository'
import * as productRepository from '@/lib/repositories/productRepository'
import * as fabricGroupRepository from '@/lib/repositories/fabricGroupRepository'
import * as quoteItemRepository from '@/lib/repositories/quoteItemRepository'

export const COMPANY = {
  legalName: 'SP Interior Solutions Pty Ltd',
  displayName: 'INTERIOR SOLUTIONS',
  tagline: 'Inspired Interiors',
  phone: '0449 736 429',
  email: 'info@spisolutions.com.au',
  facebook: 'fb.com/spinteriorsolutions',
  website: 'www.spisolutions.com.au',
  abn: 'ABN 86 658 409 548',
  accountName: 'SP INTERIOR SOLUTIONS PTY LTD',
  bsb: '063-619',
  accountNumber: '11198787',
  bankName: 'Commonwealth Bank',
}

/** A4 portrait (pt). */
const A4_W = 595
const A4_H = 842

/**
 * Layout measured proportionally from reference quotation (A4 @ 595×842 pt).
 * Outer border inset ≈ 5.7% of page width → 34 pt.
 */
const BORDER_INSET = 34
const CONTENT_LEFT = BORDER_INSET
const CONTENT_RIGHT = A4_W - BORDER_INSET
const CONTENT_WIDTH = CONTENT_RIGHT - CONTENT_LEFT
const CONTENT_TOP = A4_H - BORDER_INSET
const CONTENT_BOTTOM = BORDER_INSET
const BOTTOM_SAFE = CONTENT_BOTTOM + 28

const OUTER_BORDER_STROKE = 1
const GRID_STROKE = 0.75

const BLACK = rgb(0, 0, 0)
/** Reference purple (#5C2D82). */
const PURPLE = rgb(0.361, 0.176, 0.51)
const GRAY_HEADER = rgb(0.902, 0.902, 0.918)
const GROUP_BG = rgb(0.878, 0.859, 0.918)
const RED = rgb(0.82, 0.1, 0.1)

const LOGO_TARGET_HEIGHT = 64
const LOGO_URL = 'https://spisolutions.com.au/wp-content/uploads/2025/04/spis_logo_v4.png'
const LOGO_CONTACT_GAP = 14
const HEADER_TOP_PAD = 14
const HEADER_BOTTOM_GAP = 10
const CONTACT_FONT_SIZE = 8
const CONTACT_LINE_GAP = 11
/** Uniform inset for right-aligned contact block (matches reference). */
const CONTACT_RIGHT_PAD = 10
/** Gap between header block and customer box top border */
const AFTER_HEADER_GAP = 8

const CUSTOMER_ROW_H = 20
const CUSTOMER_GRID_H = CUSTOMER_ROW_H * 3
const CUSTOMER_LABEL_X = CONTENT_LEFT + 4
const CUSTOMER_VALUE_X = CONTENT_LEFT + 44
const CUSTOMER_DATE_LABEL_X = CONTENT_LEFT + CONTENT_WIDTH / 2 + 38
const CUSTOMER_DATE_VALUE_X = CONTENT_LEFT + CONTENT_WIDTH / 2 + 67

const TITLE_SIZE = 12
const TITLE_GAP_BELOW = 12

/** Column widths scaled to CONTENT_WIDTH (reference proportions). */
const COL_WIDTHS = [33, 124, 80, 34, 54, 124, 78]
const TABLE_LEFT = CONTENT_LEFT
const TABLE_WIDTH = CONTENT_WIDTH

const TABLE_HEADER_H = 24
const BODY_ROW_H = 15
const GROUP_ROW_H = 15
const BODY_FONT_SIZE = 9
const TABLE_HEADER_FONT_SIZE = 8
const CELL_PAD = 4
const TOTALS_LINE_H = 14

type StdFonts = {
  font: PDFFont
  fontBold: PDFFont
  fontOblique: PDFFont
}

type QuoteRow = {
  index: number
  location: string
  type: string
  inOut: string
  boSheer: string
  fabric: string
  price: string
  kind: 'blockout' | 'screen'
}

type PdfLayoutContext = {
  fonts: StdFonts
  logoImage: Awaited<ReturnType<PDFDocument['embedPng']>>
  logoDims: { width: number; height: number }
  colW: number[]
  quote: NonNullable<Awaited<ReturnType<typeof quoteRepository.findById>>>
  customer: Awaited<ReturnType<typeof customerRepository.findById>>
}

function cellBaselineY(topY: number, rowH: number, fontSize: number): number {
  return topY - rowH / 2 - fontSize * 0.31
}

function fmtMoney(v: number): string {
  return v.toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function formatMoneyDisplay(amount: number): string {
  return `$ ${fmtMoney(amount)}`
}

function readFontFile(p: string | undefined): Uint8Array | null {
  if (!p?.trim()) return null
  try {
    if (fs.existsSync(p)) return new Uint8Array(fs.readFileSync(p))
  } catch {
    /* ignore */
  }
  return null
}

async function embedQuoteFonts(pdfDoc: PDFDocument): Promise<StdFonts> {
  const winFonts = process.env.SYSTEMROOT || 'C:\\Windows'
  const regular =
    readFontFile(process.env.PDF_BODY_FONT_TTF) ||
    (process.platform === 'win32' ? readFontFile(path.join(winFonts, 'Fonts', 'arial.ttf')) : null)
  const bold =
    readFontFile(process.env.PDF_BOLD_FONT_TTF) ||
    (process.platform === 'win32' ? readFontFile(path.join(winFonts, 'Fonts', 'arialbd.ttf')) : null)
  const oblique =
    readFontFile(process.env.PDF_OBLIQUE_FONT_TTF) ||
    (process.platform === 'win32' ? readFontFile(path.join(winFonts, 'Fonts', 'ariali.ttf')) : null)

  if (regular && bold) {
    return {
      font: await pdfDoc.embedFont(regular, { subset: true }),
      fontBold: await pdfDoc.embedFont(bold, { subset: true }),
      fontOblique: oblique
        ? await pdfDoc.embedFont(oblique, { subset: true })
        : await pdfDoc.embedFont(regular, { subset: true }),
    }
  }

  return {
    font: await pdfDoc.embedFont(StandardFonts.Helvetica),
    fontBold: await pdfDoc.embedFont(StandardFonts.HelveticaBold),
    fontOblique: await pdfDoc.embedFont(StandardFonts.HelveticaOblique),
  }
}

function lineKind(productName: string): 'blockout' | 'screen' {
  const n = productName.toLowerCase()
  if (
    n.includes('screen') ||
    n.includes('sheer') ||
    n.includes('light filter') ||
    n.includes('sunscreen')
  ) {
    return 'screen'
  }
  return 'blockout'
}

function fabricGroupLabel(fabric: { group_number: number } | null): string {
  if (fabric) return `Group ${fabric.group_number}`
  return '—'
}

function blindTypeFromItem(
  blindType: string | null | undefined,
  productName: string
): 'blockout' | 'screen' {
  if (blindType === 'screen' || blindType === 'blockout') return blindType
  return lineKind(productName)
}

function boSheerDisplay(kind: 'blockout' | 'screen'): string {
  return kind === 'screen' ? 'Screen' : 'BO'
}

function clipToWidth(text: string, maxWidth: number, size: number, font: PDFFont): string {
  const value = String(text || '').trim()
  if (!value) return '—'
  if (font.widthOfTextAtSize(value, size) <= maxWidth) return value
  let out = value
  while (out.length > 1 && font.widthOfTextAtSize(out + '…', size) > maxWidth) {
    out = out.slice(0, -1)
  }
  return out + '…'
}

function drawOuterBorder(page: PDFPage): void {
  page.drawRectangle({
    x: BORDER_INSET,
    y: BORDER_INSET,
    width: A4_W - 2 * BORDER_INSET,
    height: A4_H - 2 * BORDER_INSET,
    borderColor: BLACK,
    borderWidth: OUTER_BORDER_STROKE,
  })
}

function drawCenteredInCell(
  page: PDFPage,
  text: string,
  cellX: number,
  cellW: number,
  topY: number,
  rowHeight: number,
  size: number,
  f: PDFFont
): void {
  const tw = f.widthOfTextAtSize(text, size)
  const x = cellX + Math.max(CELL_PAD, (cellW - tw) / 2)
  const y = cellBaselineY(topY, rowHeight, size)
  page.drawText(text, { x, y, size, font: f, color: BLACK })
}

function drawPriceInCell(
  page: PDFPage,
  amount: string,
  cellX: number,
  cellW: number,
  topY: number,
  rowHeight: number,
  size: number,
  f: PDFFont
): void {
  const sym = '$'
  const y = cellBaselineY(topY, rowHeight, size)
  const symW = f.widthOfTextAtSize(sym, size)
  const amtW = f.widthOfTextAtSize(amount, size)
  const rightEdge = cellX + cellW - CELL_PAD
  page.drawText(sym, { x: cellX + CELL_PAD, y, size, font: f, color: BLACK })
  page.drawText(amount, { x: rightEdge - amtW, y, size, font: f, color: BLACK })
}

function drawHeader(ctx: PdfLayoutContext, page: PDFPage, yStart: number): number {
  const { fonts, logoImage, logoDims } = ctx
  const { font, fontBold } = fonts
  const blockTop = yStart - HEADER_TOP_PAD

  const contactLines = [
    COMPANY.legalName,
    COMPANY.phone,
    COMPANY.email,
    COMPANY.facebook,
    COMPANY.website,
    COMPANY.abn,
  ]
  const contactBlockH =
    (contactLines.length - 1) * CONTACT_LINE_GAP + CONTACT_FONT_SIZE + 2
  const headerBlockH = Math.max(logoDims.height, contactBlockH)

  const logoBottom = blockTop - (headerBlockH - logoDims.height) / 2 - logoDims.height
  page.drawImage(logoImage, {
    x: CONTENT_LEFT,
    y: logoBottom,
    width: logoDims.width,
    height: logoDims.height,
  })

  const contactRegionLeft = CONTENT_LEFT + logoDims.width + LOGO_CONTACT_GAP
  const contactCenterX =
    contactRegionLeft + (CONTENT_RIGHT - CONTACT_RIGHT_PAD - contactRegionLeft) / 2
  let cy = blockTop - (headerBlockH - contactBlockH) / 2
  for (const line of contactLines) {
    const isLegalName = line === COMPANY.legalName
    const lineFont = isLegalName ? fontBold : font
    const tw = lineFont.widthOfTextAtSize(line, CONTACT_FONT_SIZE)
    page.drawText(line, {
      x: contactCenterX - tw / 2,
      y: cy,
      size: CONTACT_FONT_SIZE,
      font: lineFont,
      color: BLACK,
    })
    cy -= CONTACT_LINE_GAP
  }

  const headerBottom = blockTop - headerBlockH
  return headerBottom - HEADER_BOTTOM_GAP
}

function drawCustomerBox(ctx: PdfLayoutContext, page: PDFPage, y: number): number {
  const { fonts, quote, customer } = ctx
  const { font, fontBold } = fonts
  const customerName = customer?.name ?? '—'
  const customerAddress = customer?.address ?? '—'
  const customerEmail = customer?.email ?? '—'
  const quoteDate = new Date(quote.created_at).toLocaleDateString('en-AU', {
    day: 'numeric',
    month: 'numeric',
    year: 'numeric',
  })

  const midX = TABLE_LEFT + TABLE_WIDTH / 2
  const nameMaxW = midX - CUSTOMER_VALUE_X - 6
  const addrMaxW = midX - CUSTOMER_VALUE_X - 6
  const emailMaxW = TABLE_WIDTH - (CUSTOMER_VALUE_X - TABLE_LEFT) - 6
  const labelSize = 10
  const valueSize = 10

  page.drawRectangle({
    x: TABLE_LEFT,
    y: y - CUSTOMER_GRID_H,
    width: TABLE_WIDTH,
    height: CUSTOMER_GRID_H,
    borderColor: BLACK,
    borderWidth: GRID_STROKE,
  })
  page.drawLine({
    start: { x: midX, y },
    end: { x: midX, y: y - CUSTOMER_GRID_H },
    thickness: GRID_STROKE,
    color: BLACK,
  })
  page.drawLine({
    start: { x: TABLE_LEFT, y: y - CUSTOMER_ROW_H },
    end: { x: TABLE_LEFT + TABLE_WIDTH, y: y - CUSTOMER_ROW_H },
    thickness: GRID_STROKE,
    color: BLACK,
  })
  page.drawLine({
    start: { x: TABLE_LEFT, y: y - CUSTOMER_ROW_H * 2 },
    end: { x: TABLE_LEFT + TABLE_WIDTH, y: y - CUSTOMER_ROW_H * 2 },
    thickness: GRID_STROKE,
    color: BLACK,
  })

  const row1Y = y - 14
  page.drawText('Name', { x: CUSTOMER_LABEL_X, y: row1Y, size: labelSize, font: fontBold, color: BLACK })
  page.drawText(clipToWidth(customerName, nameMaxW, valueSize, font), {
    x: CUSTOMER_VALUE_X,
    y: row1Y,
    size: valueSize,
    font,
    color: BLACK,
  })
  page.drawText('Date:', { x: CUSTOMER_DATE_LABEL_X, y: row1Y, size: labelSize, font: fontBold, color: BLACK })
  page.drawText(quoteDate, { x: CUSTOMER_DATE_VALUE_X, y: row1Y, size: valueSize, font, color: BLACK })

  const row2Y = y - CUSTOMER_ROW_H - 14
  page.drawText('Add', { x: CUSTOMER_LABEL_X, y: row2Y, size: labelSize, font: fontBold, color: BLACK })
  page.drawText(clipToWidth(customerAddress, addrMaxW, valueSize, font), {
    x: CUSTOMER_VALUE_X,
    y: row2Y,
    size: valueSize,
    font,
    color: BLACK,
  })
  page.drawText('Quote No:', { x: CONTENT_LEFT + TABLE_WIDTH / 2 + 15, y: row2Y, size: labelSize, font: fontBold, color: BLACK })
  page.drawText(quote.quote_number, {
    x: CUSTOMER_DATE_VALUE_X,
    y: row2Y,
    size: 11,
    font: fontBold,
    color: PURPLE,
  })

  const row3Y = y - CUSTOMER_ROW_H * 2 - 14
  page.drawText('Email', { x: CUSTOMER_LABEL_X, y: row3Y, size: labelSize, font: fontBold, color: BLACK })
  page.drawText(clipToWidth(customerEmail, emailMaxW, valueSize, font), {
    x: CUSTOMER_VALUE_X,
    y: row3Y,
    size: valueSize,
    font,
    color: BLACK,
  })

  return y - CUSTOMER_GRID_H - 8
}

function drawQuotationTitle(ctx: PdfLayoutContext, page: PDFPage, y: number): number {
  const title = 'QUOTATION FOR ROLLER BLINDS'
  const tw = ctx.fonts.fontBold.widthOfTextAtSize(title, TITLE_SIZE)
  const x = (A4_W - tw) / 2
  const textY = y - 4
  page.drawText(title, {
    x,
    y: textY,
    size: TITLE_SIZE,
    font: ctx.fonts.fontBold,
    color: PURPLE,
  })
  page.drawLine({
    start: { x, y: textY - 2 },
    end: { x: x + tw, y: textY - 2 },
    thickness: 0.75,
    color: PURPLE,
  })
  return y - TITLE_GAP_BELOW - TITLE_SIZE
}

function drawProductTableHeader(ctx: PdfLayoutContext, page: PDFPage, topY: number): number {
  const { fonts, colW } = ctx
  const { fontBold } = fonts
  const fs = TABLE_HEADER_FONT_SIZE
  let cellX = TABLE_LEFT

  colW.forEach((w, i) => {
    page.drawRectangle({
      x: cellX,
      y: topY - TABLE_HEADER_H,
      width: w,
      height: TABLE_HEADER_H,
      color: GRAY_HEADER,
      borderColor: BLACK,
      borderWidth: GRID_STROKE,
    })
    if (i === 3) {
      const s1 = 'IN/'
      const s2 = 'OUT'
      page.drawText(s1, {
        x: cellX + (w - fontBold.widthOfTextAtSize(s1, fs)) / 2,
        y: topY - 8,
        size: fs,
        font: fontBold,
        color: BLACK,
      })
      page.drawText(s2, {
        x: cellX + (w - fontBold.widthOfTextAtSize(s2, fs)) / 2,
        y: topY - 19,
        size: fs,
        font: fontBold,
        color: BLACK,
      })
    } else if (i === 4) {
      const s1 = 'BO/'
      const s2 = 'SHEER'
      page.drawText(s1, {
        x: cellX + (w - fontBold.widthOfTextAtSize(s1, fs)) / 2,
        y: topY - 8,
        size: fs,
        font: fontBold,
        color: BLACK,
      })
      page.drawText(s2, {
        x: cellX + (w - fontBold.widthOfTextAtSize(s2, fs)) / 2,
        y: topY - 19,
        size: fs,
        font: fontBold,
        color: BLACK,
      })
    } else {
      const label = ['#', 'LOCATION', 'TYPE', '', '', 'FABRIC', 'PRICE'][i] ?? ''
      if (label) drawCenteredInCell(page, label, cellX, w, topY, TABLE_HEADER_H, fs, fontBold)
    }
    cellX += w
  })
  return topY - TABLE_HEADER_H
}

function drawGroupSection(ctx: PdfLayoutContext, page: PDFPage, topY: number, title: string): number {
  page.drawRectangle({
    x: TABLE_LEFT,
    y: topY - GROUP_ROW_H,
    width: TABLE_WIDTH,
    height: GROUP_ROW_H,
    color: GROUP_BG,
    borderColor: BLACK,
    borderWidth: GRID_STROKE,
  })
  const tw = ctx.fonts.fontBold.widthOfTextAtSize(title, 9)
  page.drawText(title, {
    x: TABLE_LEFT + (TABLE_WIDTH - tw) / 2,
    y: cellBaselineY(topY, GROUP_ROW_H, 9),
    size: 9,
    font: ctx.fonts.fontBold,
    color: BLACK,
  })
  return topY - GROUP_ROW_H
}

function drawProductDataRow(ctx: PdfLayoutContext, page: PDFPage, topY: number, row: QuoteRow): number {
  const { fonts, colW } = ctx
  const { font } = fonts
  const fs = BODY_FONT_SIZE
  let cellX = TABLE_LEFT

  colW.forEach((w) => {
    page.drawRectangle({
      x: cellX,
      y: topY - BODY_ROW_H,
      width: w,
      height: BODY_ROW_H,
      borderColor: BLACK,
      borderWidth: GRID_STROKE,
    })
    cellX += w
  })

  const locMax = 22
  const typeMax = 12
  const fabMax = 20
  const texts = [
    String(row.index),
    row.location.length > locMax ? row.location.slice(0, locMax - 1) + '…' : row.location,
    row.type.length > typeMax ? row.type.slice(0, typeMax - 1) + '…' : row.type,
    row.inOut,
    row.boSheer,
    row.fabric.length > fabMax ? row.fabric.slice(0, fabMax - 1) + '…' : row.fabric,
  ]

  cellX = TABLE_LEFT
  for (let i = 0; i < 6; i += 1) {
    drawCenteredInCell(page, texts[i], cellX, colW[i], topY, BODY_ROW_H, fs, font)
    cellX += colW[i]
  }
  drawPriceInCell(page, row.price, cellX, colW[6], topY, BODY_ROW_H, fs, font)
  return topY - BODY_ROW_H
}

function drawTotals(ctx: PdfLayoutContext, page: PDFPage, y: number): number {
  const { fonts, colW, quote } = ctx
  const { font, fontBold } = fonts
  const fs = 9
  const priceColLeft = TABLE_LEFT + colW.slice(0, 6).reduce((a, b) => a + b, 0)
  const priceColRight = TABLE_LEFT + TABLE_WIDTH
  const labelRight = priceColLeft - 8
  let ty = y - 8

  const subLabel = 'Sub Total'
  const subAmt = formatMoneyDisplay(Number(quote.subtotal))
  page.drawText(subLabel, {
    x: labelRight - font.widthOfTextAtSize(subLabel, fs),
    y: ty,
    size: fs,
    font,
    color: BLACK,
  })
  page.drawText(subAmt, {
    x: priceColRight - font.widthOfTextAtSize(subAmt, fs) - CELL_PAD,
    y: ty,
    size: fs,
    font,
    color: BLACK,
  })
  ty -= TOTALS_LINE_H

  const gstLabel = '10% GST'
  const gstAmt = formatMoneyDisplay(Number(quote.gst))
  page.drawText(gstLabel, {
    x: labelRight - font.widthOfTextAtSize(gstLabel, fs),
    y: ty,
    size: fs,
    font,
    color: BLACK,
  })
  page.drawText(gstAmt, {
    x: priceColRight - font.widthOfTextAtSize(gstAmt, fs) - CELL_PAD,
    y: ty,
    size: fs,
    font,
    color: BLACK,
  })
  ty -= TOTALS_LINE_H

  const totalLabel = 'Total Payable'
  const totalAmt = formatMoneyDisplay(Number(quote.final_total))
  page.drawText(totalLabel, {
    x: labelRight - fontBold.widthOfTextAtSize(totalLabel, fs),
    y: ty,
    size: fs,
    font: fontBold,
    color: BLACK,
  })
  page.drawText(totalAmt, {
    x: priceColRight - fontBold.widthOfTextAtSize(totalAmt, fs) - CELL_PAD,
    y: ty,
    size: fs,
    font: fontBold,
    color: BLACK,
  })
  return ty - 12
}

function drawPaymentSection(
  ctx: PdfLayoutContext,
  page: PDFPage,
  y: number,
  advance: number,
  balance: number
): number {
  const { fonts } = ctx
  const { font, fontBold } = fonts
  const payRowH = 22
  const amountColW = 108
  const amountX = TABLE_LEFT + TABLE_WIDTH - amountColW
  const labelPad = 8

  const paymentRows = [
    {
      label: 'Advance Payment',
      amount: formatMoneyDisplay(advance),
      labelSize: 9,
      amtSize: 9,
      amtBold: false,
      amtRed: false,
    },
    {
      label: 'Balance to be paid upon completion of the job',
      amount: formatMoneyDisplay(balance),
      labelSize: 8,
      amtSize: 10,
      amtBold: true,
      amtRed: true,
    },
  ] as const

  let rowTop = y
  for (const row of paymentRows) {
    page.drawRectangle({
      x: TABLE_LEFT,
      y: rowTop - payRowH,
      width: TABLE_WIDTH,
      height: payRowH,
      borderColor: BLACK,
      borderWidth: GRID_STROKE,
    })
    page.drawLine({
      start: { x: amountX, y: rowTop },
      end: { x: amountX, y: rowTop - payRowH },
      thickness: GRID_STROKE,
      color: BLACK,
    })
    const textY = rowTop - 15
    page.drawText(row.label, {
      x: TABLE_LEFT + labelPad,
      y: textY,
      size: row.labelSize,
      font: fontBold,
      color: BLACK,
    })
    const amtFont = row.amtBold ? fontBold : font
    const amtW = amtFont.widthOfTextAtSize(row.amount, row.amtSize)
    page.drawText(row.amount, {
      x: TABLE_LEFT + TABLE_WIDTH - CELL_PAD - amtW,
      y: textY - (row.amtBold ? 1 : 0),
      size: row.amtSize,
      font: amtFont,
      color: row.amtRed ? RED : BLACK,
    })
    rowTop -= payRowH
  }

  let cy = rowTop - 14
  const payTerms = 'Payment Terms : Bank Transfer / Cash'
  const ptw = font.widthOfTextAtSize(payTerms, 9)
  page.drawText(payTerms, { x: (A4_W - ptw) / 2, y: cy, size: 9, font, color: BLACK })
  cy -= 16

  const acctLine = `Account Name : ${COMPANY.accountName}`
  const acctW = fontBold.widthOfTextAtSize(acctLine, 9)
  page.drawText(acctLine, { x: (A4_W - acctW) / 2, y: cy, size: 9, font: fontBold, color: BLACK })
  cy -= 14

  const bsbLine = `BSB : ${COMPANY.bsb} / Account number : ${COMPANY.accountNumber} / ${COMPANY.bankName}`
  const bsbW = font.widthOfTextAtSize(bsbLine, 9)
  page.drawText(bsbLine, { x: (A4_W - bsbW) / 2, y: cy, size: 9, font, color: BLACK })
  return cy - 18
}

function estimateTermsHeight(ctx: PdfLayoutContext, rows: [string, string][]): number {
  const { font } = ctx.fonts
  const termLabelW = 120
  const termPad = 6
  const termFont = 8
  const lineGap = 10
  let h = 14
  for (const [, desc] of rows) {
    const descMaxW = CONTENT_WIDTH - termLabelW - termPad * 2
    const descLines = wrapTextLines(desc, descMaxW, termFont, font, 6)
    h += Math.max(22, 8 + descLines.length * lineGap)
  }
  h += 8 + 20
  return h
}

const PAYMENT_SECTION_HEIGHT = 120

function wrapTextLines(text: string, maxWidth: number, size: number, font: PDFFont, maxLines = 6): string[] {
  const words = text.split(/\s+/).filter(Boolean)
  if (!words.length) return ['—']
  const lines: string[] = []
  let line = ''
  for (const w of words) {
    const tryLine = line ? `${line} ${w}` : w
    if (font.widthOfTextAtSize(tryLine, size) <= maxWidth) {
      line = tryLine
    } else {
      if (line) lines.push(line)
      line = w
    }
  }
  if (line) lines.push(line)
  return lines.slice(0, maxLines)
}

function drawTermsTable(
  ctx: PdfLayoutContext,
  page: PDFPage,
  y: number,
  rows: [string, string][],
  pdfDoc: PDFDocument
): { page: PDFPage; y: number } {
  const { fonts } = ctx
  const { font, fontBold, fontOblique } = fonts
  const termLabelW = 120
  const termPad = 6
  const termFont = 8
  const lineGap = 10
  let currentPage = page
  let cy = y

  currentPage.drawText('Terms and conditions', {
    x: CONTENT_LEFT,
    y: cy,
    size: 10,
    font: fontBold,
    color: BLACK,
  })
  cy -= 14

  for (const [label, desc] of rows) {
    const descMaxW = CONTENT_WIDTH - termLabelW - termPad * 2
    const descLines = wrapTextLines(desc, descMaxW, termFont, font, 6)
    const rowH = Math.max(22, 8 + descLines.length * lineGap)

    if (cy - rowH < BOTTOM_SAFE + 36) {
      currentPage = pdfDoc.addPage([A4_W, A4_H])
      drawOuterBorder(currentPage)
      cy = CONTENT_TOP - 8
      currentPage.drawText('Terms and conditions (continued)', {
        x: CONTENT_LEFT,
        y: cy,
        size: 10,
        font: fontBold,
        color: BLACK,
      })
      cy -= 16
    }

    currentPage.drawRectangle({
      x: CONTENT_LEFT,
      y: cy - rowH,
      width: CONTENT_WIDTH,
      height: rowH,
      borderColor: BLACK,
      borderWidth: GRID_STROKE,
    })
    currentPage.drawLine({
      start: { x: CONTENT_LEFT + termLabelW, y: cy },
      end: { x: CONTENT_LEFT + termLabelW, y: cy - rowH },
      thickness: GRID_STROKE,
      color: BLACK,
    })
    currentPage.drawText(label, {
      x: CONTENT_LEFT + termPad,
      y: cy - 12,
      size: termFont,
      font: fontBold,
      color: BLACK,
    })
    let dy = cy - 12
    for (const ln of descLines) {
      currentPage.drawText(ln, {
        x: CONTENT_LEFT + termLabelW + termPad,
        y: dy,
        size: termFont,
        font,
        color: BLACK,
      })
      dy -= lineGap
    }
    cy -= rowH
  }

  cy -= 8
  const disclaimer =
    'All items & materials used remain the property of SP Interior Solutions Pty Ltd until full payment is received.'
  currentPage.drawText(disclaimer, {
    x: CONTENT_LEFT,
    y: Math.max(CONTENT_BOTTOM + 12, cy),
    size: 8,
    font: fontOblique,
    color: BLACK,
  })

  return { page: currentPage, y: cy }
}

async function loadQuoteLogoBytes(): Promise<ArrayBuffer> {
  const url = process.env.PDF_LOGO_URL?.trim() || LOGO_URL
  try {
    const response = await fetch(url)
    if (response.ok) return await response.arrayBuffer()
  } catch {
    /* try local fallback */
  }

  const localPath = process.env.PDF_LOGO_PATH?.trim()
  if (localPath && fs.existsSync(localPath)) {
    const buf = fs.readFileSync(localPath)
    return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength)
  }

  throw new Error(`Failed to load quote PDF logo from ${url}`)
}

export async function generateQuotePdfBytes(quoteId: number): Promise<Uint8Array> {
  const quote = await quoteRepository.findById(quoteId)
  if (!quote) {
    throw new Error('Quote not found')
  }

  const [customer, headerProduct, headerFabricGroup, items] = await Promise.all([
    customerRepository.findById(quote.customer_id),
    productRepository.findById(quote.product_id),
    fabricGroupRepository.findById(quote.fabric_group_id),
    quoteItemRepository.listByQuoteId(quote.id),
  ])

  let rows: QuoteRow[] = []
  if (items && items.length > 0) {
    const productMap = new Map<number, Awaited<ReturnType<typeof productRepository.findById>>>()
    const fabricMap = new Map<number, Awaited<ReturnType<typeof fabricGroupRepository.findById>>>()
    for (const item of items) {
      if (!productMap.has(item.product_id)) {
        productMap.set(item.product_id, await productRepository.findById(item.product_id))
      }
      if (!fabricMap.has(item.fabric_group_id)) {
        fabricMap.set(item.fabric_group_id, await fabricGroupRepository.findById(item.fabric_group_id))
      }
    }

    rows = items.map((item, idx) => {
      const product = productMap.get(item.product_id)
      const fabric = fabricMap.get(item.fabric_group_id)
      const baseLoc =
        item.location_label === 'Other' && item.location_other
          ? item.location_other
          : item.location_label
      const qty = Math.max(1, Math.floor(Number(item.quantity)) || 1)
      const locationText = qty > 1 ? `${baseLoc} (×${qty})` : baseLoc
      const typeText = product?.name?.includes('Roller') ? 'Roller Blind' : product?.name ?? 'Roller Blind'
      const kind = blindTypeFromItem(item.blind_type, product?.name ?? '')
      return {
        index: idx + 1,
        location: locationText,
        type: typeText.slice(0, 40),
        inOut: 'IN',
        boSheer: boSheerDisplay(kind),
        fabric: fabricGroupLabel(fabric ?? null),
        price: fmtMoney(Number(item.subtotal)),
        kind,
      }
    })
  } else {
    const kind = lineKind(headerProduct?.name ?? '')
    rows = [
      {
        index: 1,
        location: 'As specified',
        type: 'Roller Blind',
        inOut: 'IN',
        boSheer: boSheerDisplay(kind),
        fabric: fabricGroupLabel(headerFabricGroup ?? null),
        price: fmtMoney(Number(quote.subtotal)),
        kind,
      },
    ]
  }

  const blockoutRows = rows.filter((r) => r.kind === 'blockout')
  const screenRows = rows.filter((r) => r.kind === 'screen')
  let lineNo = 1
  for (const r of blockoutRows) r.index = lineNo++
  for (const r of screenRows) r.index = lineNo++

  const pdfDoc = await PDFDocument.create()
  pdfDoc.registerFontkit(fontkit)
  const fonts = await embedQuoteFonts(pdfDoc)

  const logoArrayBuffer = await loadQuoteLogoBytes()
  const logoImage = await pdfDoc.embedPng(logoArrayBuffer)
  const logoScale = LOGO_TARGET_HEIGHT / logoImage.height
  const logoDims = logoImage.scale(logoScale)

  const colW = [...COL_WIDTHS]
  const colSum = colW.reduce((a, b) => a + b, 0)
  if (colSum !== TABLE_WIDTH) colW[6] += TABLE_WIDTH - colSum

  const ctx: PdfLayoutContext = {
    fonts,
    logoImage,
    logoDims,
    colW,
    quote,
    customer,
  }

  // ——— Page 1 ———
  let page = pdfDoc.addPage([A4_W, A4_H])
  drawOuterBorder(page)
  let y = CONTENT_TOP

  y = drawHeader(ctx, page, y)
  y -= AFTER_HEADER_GAP
  y = drawCustomerBox(ctx, page, y)
  y = drawQuotationTitle(ctx, page, y)

  const ensureSpace = (need: number, mode: 'table' | 'footer' = 'table'): void => {
    if (y - need >= BOTTOM_SAFE) return
    page = pdfDoc.addPage([A4_W, A4_H])
    drawOuterBorder(page)
    if (mode === 'table') {
      y = CONTENT_TOP
      y = drawHeader(ctx, page, y)
      y -= 6
      page.drawText('(continued)', {
        x: CONTENT_LEFT,
        y,
        size: 8,
        font: fonts.fontOblique,
        color: BLACK,
      })
      y -= 16
      y = drawProductTableHeader(ctx, page, y)
    } else {
      y = CONTENT_TOP - HEADER_TOP_PAD
    }
  }

  y = drawProductTableHeader(ctx, page, y)

  const drawSection = (sectionTitle: string, sectionRows: QuoteRow[]) => {
    if (sectionRows.length === 0) return
    ensureSpace(GROUP_ROW_H + BODY_ROW_H)
    y = drawGroupSection(ctx, page, y, sectionTitle)
    for (const row of sectionRows) {
      ensureSpace(BODY_ROW_H + 2)
      y = drawProductDataRow(ctx, page, y, row)
    }
  }

  drawSection('BLOCKOUT BLINDS', blockoutRows)
  drawSection('SCREEN BLINDS', screenRows)

  ensureSpace(56)
  y = drawTotals(ctx, page, y)

  const additionalInfoText =
    quote.additional_info && String(quote.additional_info).trim().length
      ? String(quote.additional_info).trim()
      : 'As discussed with SP Interior Solutions.'
  const etaText =
    quote.eta_text && String(quote.eta_text).trim().length
      ? String(quote.eta_text).trim()
      : 'As advised at time of order'

  const blockFabrics = Array.from(new Set(blockoutRows.map((r) => r.fabric)))
  const screenFabrics = Array.from(new Set(screenRows.map((r) => r.fabric)))
  let fabricSummary = ''
  if (blockFabrics.length) fabricSummary += `Blockout: ${blockFabrics[0]}`
  if (screenFabrics.length) fabricSummary += (fabricSummary ? ' / ' : '') + screenFabrics[0]
  if (!fabricSummary) fabricSummary = additionalInfoText.slice(0, 120)

  const termsRows: [string, string][] = [
    ['Roller Blind Fabric', fabricSummary],
    ['Roller Blind Mounted', 'Recess Fit (IN)'],
    ['Fabric colours', 'May differ slightly from batch to batch from sample shown'],
    ['Confirmation of order', '50% Deposit'],
    ['ETA', etaText],
    [
      'Quote',
      'Price is for the above quantities and valid for 30 days only. Price includes supply and installation',
    ],
    ['Warranty', 'Roller blinds - 5 yrs(fabric) / Accessories 1 yr'],
    ['Additional information', additionalInfoText],
  ]

  const footerHeight = PAYMENT_SECTION_HEIGHT + estimateTermsHeight(ctx, termsRows)
  ensureSpace(footerHeight + 12, 'footer')

  const totalPayable = Number(quote.final_total)
  const advance = totalPayable * 0.5
  const balance = totalPayable - advance
  y = drawPaymentSection(ctx, page, y, advance, balance)

  const termsResult = drawTermsTable(ctx, page, y, termsRows, pdfDoc)
  page = termsResult.page

  const pdfBytes = await pdfDoc.save()
  return new Uint8Array(pdfBytes)
}

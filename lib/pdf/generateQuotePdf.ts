/**
 * Shared quotation PDF generation (used by API route and email attachment).
 * Layout aligned with SP Interior Solutions quotation: p.1 header + lines + totals, p.2 payment + terms.
 */
import fs from 'node:fs'
import path from 'node:path'
import { PDFDocument, StandardFonts, rgb, type PDFPage } from 'pdf-lib'
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

const BLACK = rgb(0, 0, 0)
/** Brand purple close to SP Interior reference PDF / site tone. */
const PURPLE = rgb(0.361, 0.176, 0.51)
const GRAY_BG = rgb(0.92, 0.92, 0.94)
const RED = rgb(0.75, 0.12, 0.12)

const A4_W = 595
const A4_H = 842
/** Side inset for header / customer / terms (matches reference quotation PDF ≈ 55 pt). */
const SIDE_MARGIN = 38
/** Top inset for first header line (reference PDF ≈ 65 pt from top). */
const TOP_MARGIN = 38
/** Ruled table aligns with reference column starts (row # ≈ 52.7 pt). */
const TABLE_LEFT = 28
const TABLE_RIGHT_INSET = 28
const BOTTOM_SAFE = 56
const CELL_PAD = 6
const CONTACT_LINE_GAP = 14
const LOGO_TARGET_HEIGHT = 74
const FRAME_STROKE = 1.1
const GRID_STROKE = 0.9

/** Line-item row height measured from reference PDF (15.75 pt). */
const BODY_ROW_H = 15.75
/** Body / line-item font size (reference glyph height ≈ 10.7 pt → 9 pt). */
const BODY_FONT_SIZE = 9
const TABLE_HEADER_FONT_SIZE = 8
/** Left edge of # column text (reference ≈ 52.7 pt; TABLE_LEFT + this). */
const IDX_TEXT_INSET = 5
/** Left inset for LOCATION / TYPE / FABRIC header labels. */
const HDR_LABEL_INSET = 2

/** Baseline Y to visually centre single-line text in a row of height `rowH` (PDF y increases upward). */
function cellBaselineY(topY: number, rowH: number, fontSize: number): number {
  return topY - rowH / 2 - fontSize * 0.31
}

type StdFonts = {
  font: Awaited<ReturnType<PDFDocument['embedFont']>>
  fontBold: Awaited<ReturnType<PDFDocument['embedFont']>>
  fontOblique: Awaited<ReturnType<PDFDocument['embedFont']>>
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

/**
 * Prefer Arial (or paths in env) so metrics match the reference Word/PDF quotation; fall back to Helvetica on Linux CI.
 */
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

function fmtMoney(v: number): string {
  return v.toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
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

function fabricLabel(
  fabric: { group_number: number } | null,
  product: { name: string } | null
): string {
  const pn = product?.name?.trim() ?? ''
  if (pn.length > 0) return pn.slice(0, 56)
  if (fabric) return `Group ${fabric.group_number}`
  return '—'
}

function wrapLines(
  text: string,
  maxWidth: number,
  size: number,
  font: StdFonts['font'],
  maxLines = 10
): string[] {
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
  return lines.slice(0, maxLines).map((ln) => (ln.length > 140 ? ln.slice(0, 137) + '…' : ln))
}

function drawWrappedText(
  page: PDFPage,
  text: string,
  x: number,
  yTop: number,
  maxWidth: number,
  size: number,
  font: StdFonts['font'],
  lineGap: number,
  maxLines = 8
): number {
  const lines = wrapLines(text, maxWidth, size, font, maxLines)
  let y = yTop
  for (const ln of lines) {
    page.drawText(ln, { x, y, size, font, color: BLACK })
    y -= lineGap
  }
  return y
}

function clipToWidth(text: string, maxWidth: number, size: number, font: StdFonts['font']): string {
  const value = String(text || '').trim()
  if (!value) return '—'
  if (font.widthOfTextAtSize(value, size) <= maxWidth) return value
  let out = value
  while (out.length > 1 && font.widthOfTextAtSize(out + '…', size) > maxWidth) {
    out = out.slice(0, -1)
  }
  return out + '…'
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

  type Row = {
    index: number
    location: string
    type: string
    inOut: string
    boSheer: string
    fabric: string
    price: string
    kind: 'blockout' | 'screen'
  }

  let rows: Row[] = []
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
      const kind = lineKind(product?.name ?? '')
      const boSheer = kind === 'screen' ? 'Screen' : 'BO'
      const priceStr = fmtMoney(Number(item.subtotal))
      return {
        index: idx + 1,
        location: locationText,
        type: typeText.slice(0, 40),
        inOut: 'IN',
        boSheer,
        fabric: fabricLabel(fabric ?? null, product ?? null),
        price: priceStr,
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
        boSheer: kind === 'screen' ? 'Screen' : 'BO',
        fabric: fabricLabel(headerFabricGroup ?? null, headerProduct ?? null),
        price: fmtMoney(Number(quote.subtotal)),
        kind,
      },
    ]
  }

  const blockoutRows = rows.filter((r) => r.kind === 'blockout')
  const screenRows = rows.filter((r) => r.kind === 'screen')
  let lineNo = 1
  for (const r of blockoutRows) {
    r.index = lineNo++
  }
  for (const r of screenRows) {
    r.index = lineNo++
  }

  const pdfDoc = await PDFDocument.create()
  // Required by pdf-lib before embedding custom TTF/OTF fonts.
  pdfDoc.registerFontkit(fontkit)
  const { font, fontBold, fontOblique } = await embedQuoteFonts(pdfDoc)

  const logoResponse = await fetch(
    'https://spisolutions.com.au/wp-content/uploads/2025/04/spis_logo_v4.png'
  )
  const logoArrayBuffer = await logoResponse.arrayBuffer()
  const logoImage = await pdfDoc.embedPng(logoArrayBuffer)
  const logoScale = LOGO_TARGET_HEIGHT / logoImage.height
  const logoDims = logoImage.scale(logoScale)

  /** Column widths tuned to reference PDF (text x positions from TABLE_LEFT). */
  const colW = [40, 116, 75, 32, 49, 120, 67]
  const tableLeft = TABLE_LEFT
  const tableWidth = A4_W - TABLE_LEFT - TABLE_RIGHT_INSET
  const sumColW = colW.reduce((a, b) => a + b, 0)
  if (Math.abs(sumColW - tableWidth) > 1) {
    colW[6] += tableWidth - sumColW
  }

  const rowH = BODY_ROW_H
  const headerRowH = 26
  const groupRowH = 16

  const drawPageHeader = (page: PDFPage, yStart: number) => {
    let y = yStart
    const leftX = TABLE_LEFT
    const rightBlockW = 200
    const rightX = A4_W - SIDE_MARGIN - rightBlockW
    const frameTopY = y + 8

    page.drawImage(logoImage, {
      x: leftX,
      y: y - logoDims.height,
      width: logoDims.width,
      height: logoDims.height,
    })

    const contactLines = [
      COMPANY.legalName,
      COMPANY.phone,
      COMPANY.email,
      COMPANY.facebook,
      COMPANY.website,
      COMPANY.abn,
    ]
    let cy = y
    contactLines.forEach((line) => {
      const tw = font.widthOfTextAtSize(line, 8)
      page.drawText(line, {
        x: rightX + (rightBlockW - tw),
        y: cy,
        size: 8,
        font: line === COMPANY.legalName ? fontBold : font,
        color: BLACK,
      })
      cy -= CONTACT_LINE_GAP
    })

    // Separator must sit clearly *below* both columns (avoid line through ABN / logo block)
    const leftColumnBottom = y - logoDims.height - 34
    const rightColumnBottom = cy - 6
    const separatorY = Math.min(leftColumnBottom, rightColumnBottom) - 8
    page.drawLine({
      start: { x: TABLE_LEFT, y: frameTopY },
      end: { x: A4_W - TABLE_RIGHT_INSET, y: frameTopY },
      thickness: FRAME_STROKE,
      color: BLACK,
    })
    page.drawLine({
      start: { x: TABLE_LEFT, y: frameTopY },
      end: { x: TABLE_LEFT, y: separatorY },
      thickness: FRAME_STROKE,
      color: BLACK,
    })
    page.drawLine({
      start: { x: A4_W - TABLE_RIGHT_INSET, y: frameTopY },
      end: { x: A4_W - TABLE_RIGHT_INSET, y: separatorY },
      thickness: FRAME_STROKE,
      color: BLACK,
    })
    page.drawLine({
      start: { x: TABLE_LEFT, y: separatorY },
      end: { x: A4_W - TABLE_RIGHT_INSET, y: separatorY },
      thickness: FRAME_STROKE,
      color: BLACK,
    })
    y = separatorY
    return y
  }

  const drawCustomerGrid = (page: PDFPage, y: number) => {
    const customerName = customer?.name ?? '—'
    const customerAddress = customer?.address ?? '—'
    const customerEmail = customer?.email ?? '—'
    const quoteDate = new Date(quote.created_at).toLocaleDateString('en-AU', {
      day: 'numeric',
      month: 'numeric',
      year: 'numeric',
    })

    const gridW = tableWidth
    const midX = tableLeft + gridW / 2
    const labelX = SIDE_MARGIN
    const valueLeftX = tableLeft + 42
    const pad = 0
    const nameMaxW = midX - valueLeftX - 8
    const addrMaxW = midX - valueLeftX - 8
    const emailMaxW = gridW - (valueLeftX - tableLeft) - 8

    const row1H = 24
    const row2H = 24
    const row3H = 24
    const gridH = row1H + row2H + row3H

    page.drawRectangle({
      x: tableLeft,
      y: y - gridH,
      width: gridW,
      height: gridH,
      borderColor: BLACK,
      borderWidth: FRAME_STROKE,
    })
    page.drawLine({
      start: { x: midX, y: y },
      end: { x: midX, y: y - gridH },
      thickness: GRID_STROKE,
      color: BLACK,
    })
    page.drawLine({
      start: { x: tableLeft, y: y - row1H },
      end: { x: tableLeft + gridW, y: y - row1H },
      thickness: GRID_STROKE,
      color: BLACK,
    })
    page.drawLine({
      start: { x: tableLeft, y: y - row1H - row2H },
      end: { x: tableLeft + gridW, y: y - row1H - row2H },
      thickness: GRID_STROKE,
      color: BLACK,
    })

    const row1TextY = y - 16
    page.drawText('Name', { x: labelX, y: row1TextY, size: 10, font: fontBold, color: BLACK })
    page.drawText(clipToWidth(customerName, nameMaxW, 10, font), {
      x: valueLeftX,
      y: row1TextY,
      size: 10,
      font,
      color: BLACK,
    })
    page.drawText('Date:', { x: midX + 40, y: row1TextY, size: 10, font: fontBold, color: BLACK })
    page.drawText(quoteDate, { x: midX + 69, y: row1TextY, size: 10, font, color: BLACK })

    const addrLabelY = y - row1H - 16
    page.drawText('Add', { x: labelX, y: addrLabelY, size: 10, font: fontBold, color: BLACK })
    page.drawText(clipToWidth(customerAddress, addrMaxW, 10, font), {
      x: valueLeftX,
      y: addrLabelY,
      size: 10,
      font,
      color: BLACK,
    })
    page.drawText('Quote No:', { x: midX + 17, y: addrLabelY, size: 10, font: fontBold, color: BLACK })
    page.drawText(quote.quote_number, {
      x: midX + 69,
      y: addrLabelY,
      size: 11,
      font: fontBold,
      color: PURPLE,
    })

    const emailRowTop = y - row1H - row2H - 16
    page.drawText('Email', { x: labelX, y: emailRowTop, size: 10, font: fontBold, color: BLACK })
    page.drawText(clipToWidth(customerEmail, emailMaxW, 10, font), {
      x: valueLeftX,
      y: emailRowTop,
      size: 10,
      font,
      color: BLACK,
    })

    return y - gridH - 10
  }

  const drawTableHeader = (page: PDFPage, topY: number) => {
    let cellX = tableLeft
    const fs = TABLE_HEADER_FONT_SIZE
    colW.forEach((w, i) => {
      page.drawRectangle({
        x: cellX,
        y: topY - headerRowH,
        width: w,
        height: headerRowH,
        color: GRAY_BG,
        borderColor: BLACK,
        borderWidth: GRID_STROKE,
      })
      if (i === 3) {
        const s1 = 'IN/'
        const s2 = 'OUT'
        const w1 = fontBold.widthOfTextAtSize(s1, fs)
        const w2 = fontBold.widthOfTextAtSize(s2, fs)
        page.drawText(s1, {
          x: cellX + (w - w1) / 2,
          y: topY - 7,
          size: fs,
          font: fontBold,
          color: BLACK,
        })
        page.drawText(s2, {
          x: cellX + (w - w2) / 2,
          y: topY - 20,
          size: fs,
          font: fontBold,
          color: BLACK,
        })
      } else if (i === 4) {
        const s1 = 'BO/'
        const s2 = 'SHEER'
        const w1 = fontBold.widthOfTextAtSize(s1, fs)
        const w2 = fontBold.widthOfTextAtSize(s2, fs)
        page.drawText(s1, {
          x: cellX + (w - w1) / 2,
          y: topY - 7,
          size: fs,
          font: fontBold,
          color: BLACK,
        })
        page.drawText(s2, {
          x: cellX + (w - w2) / 2,
          y: topY - 20,
          size: fs,
          font: fontBold,
          color: BLACK,
        })
      } else {
        const label = ['#', 'LOCATION', 'TYPE', '', '', 'FABRIC', 'PRICE'][i] ?? ''
        const by = cellBaselineY(topY, headerRowH, fs)
        const tw = fontBold.widthOfTextAtSize(label, fs)
        let lx = cellX + HDR_LABEL_INSET
        if (i === 0) lx = cellX + IDX_TEXT_INSET
        else if (i === 6) lx = cellX + w - tw - CELL_PAD
        page.drawText(label, {
          x: lx,
          y: by,
          size: fs,
          font: fontBold,
          color: BLACK,
        })
      }
      cellX += w
    })
    return topY - headerRowH
  }

  const drawGroupBar = (page: PDFPage, topY: number, title: string) => {
    page.drawRectangle({
      x: tableLeft,
      y: topY - groupRowH,
      width: tableWidth,
      height: groupRowH,
      color: rgb(0.88, 0.86, 0.92),
      borderColor: BLACK,
      borderWidth: GRID_STROKE,
    })
    const tw = fontBold.widthOfTextAtSize(title, 9)
    page.drawText(title, {
      x: tableLeft + (tableWidth - tw) / 2,
      y: cellBaselineY(topY, groupRowH, 9),
      size: 9,
      font: fontBold,
      color: BLACK,
    })
    return topY - groupRowH
  }

  const drawDataRow = (page: PDFPage, topY: number, row: Row) => {
    let cellX = tableLeft
    const cells = [
      String(row.index),
      row.location,
      row.type,
      row.inOut,
      row.boSheer,
      row.fabric,
      row.price,
    ]
    colW.forEach((w, i) => {
      page.drawRectangle({
        x: cellX,
        y: topY - rowH,
        width: w,
        height: rowH,
        borderColor: BLACK,
        borderWidth: GRID_STROKE,
      })
      cellX += w
    })
    cellX = tableLeft
    const fs = BODY_FONT_SIZE
    const by = cellBaselineY(topY, rowH, fs)
    const locMax = 24
    const typeMax = 13
    const fabMax = 22
    page.drawText(cells[0], {
      x: cellX + IDX_TEXT_INSET,
      y: by,
      size: fs,
      font,
      color: BLACK,
    })
    cellX += colW[0]
    const loc =
      cells[1].length > locMax ? cells[1].slice(0, locMax - 1) + '…' : cells[1]
    page.drawText(loc, { x: cellX + 2, y: by, size: fs, font, color: BLACK })
    cellX += colW[1]
    const typ =
      cells[2].length > typeMax ? cells[2].slice(0, typeMax - 1) + '…' : cells[2]
    page.drawText(typ, { x: cellX + 2, y: by, size: fs, font, color: BLACK })
    cellX += colW[2]
    const inOutW = font.widthOfTextAtSize(cells[3], fs)
    page.drawText(cells[3], {
      x: cellX + (colW[3] - inOutW) / 2,
      y: by,
      size: fs,
      font,
      color: BLACK,
    })
    cellX += colW[3]
    const boW = font.widthOfTextAtSize(cells[4], fs)
    page.drawText(cells[4], {
      x: cellX + (colW[4] - boW) / 2,
      y: by,
      size: fs,
      font,
      color: BLACK,
    })
    cellX += colW[4]
    const fab =
      cells[5].length > fabMax ? cells[5].slice(0, fabMax - 1) + '…' : cells[5]
    page.drawText(fab, { x: cellX + 2, y: by, size: fs, font, color: BLACK })
    cellX += colW[5]
    const amt = cells[6]
    const sym = '-$ '
    const rightEdge = cellX + colW[6] - CELL_PAD
    const amtW = font.widthOfTextAtSize(amt, fs)
    const symW = font.widthOfTextAtSize(sym, fs)
    page.drawText(amt, { x: rightEdge - amtW, y: by, size: fs, font, color: BLACK })
    page.drawText(sym, { x: rightEdge - amtW - symW, y: by, size: fs, font, color: BLACK })
    return topY - rowH
  }

  const drawTotalsBlock = (page: PDFPage, y: number) => {
    const totalPreGst = Number(quote.subtotal)
    const gstVal = Number(quote.gst)
    const totalPayable = Number(quote.final_total)
    const lineH = 14
    const rightX = tableLeft + tableWidth
    let ty = y - 10
    const fs = 9

    const line1 = `Sub Total -$ ${fmtMoney(totalPreGst)}`
    page.drawText(line1, {
      x: rightX - font.widthOfTextAtSize(line1, fs),
      y: ty,
      size: fs,
      font,
      color: BLACK,
    })
    ty -= lineH

    const gstLabel = '10% GST'
    const gstAmt = fmtMoney(gstVal)
    const gstAmtW = font.widthOfTextAtSize(gstAmt, fs)
    const gstLabW = font.widthOfTextAtSize(gstLabel, fs)
    page.drawText(gstAmt, {
      x: rightX - gstAmtW,
      y: ty,
      size: fs,
      font,
      color: BLACK,
    })
    page.drawText(gstLabel, {
      x: rightX - gstAmtW - 6 - gstLabW,
      y: ty,
      size: fs,
      font,
      color: BLACK,
    })
    ty -= lineH

    const line3 = `Total Payable -$ ${fmtMoney(totalPayable)}`
    page.drawText(line3, {
      x: rightX - fontBold.widthOfTextAtSize(line3, fs),
      y: ty,
      size: fs,
      font: fontBold,
      color: BLACK,
    })
    return ty - 16
  }

  // ——— Page 1 ———
  let page = pdfDoc.addPage([A4_W, A4_H])
  let y = A4_H - TOP_MARGIN

  y = drawPageHeader(page, y)
  y = drawCustomerGrid(page, y)

  const title = 'QUOTATION FOR ROLLER BLINDS'
  const titleSize = 12
  const tw = fontBold.widthOfTextAtSize(title, titleSize)
  page.drawText(title, {
    x: (A4_W - tw) / 2,
    y: y - 6,
    size: titleSize,
    font: fontBold,
    color: PURPLE,
  })
  y -= 24

  const ensureSpace = (need: number): void => {
    if (y - need < BOTTOM_SAFE) {
      page = pdfDoc.addPage([A4_W, A4_H])
      y = A4_H - TOP_MARGIN
      y = drawPageHeader(page, y)
      y -= 8
      page.drawText('(continued)', {
        x: SIDE_MARGIN,
        y,
        size: 8,
        font: fontOblique,
        color: BLACK,
      })
      y -= 18
      y = drawTableHeader(page, y)
    }
  }

  y = drawTableHeader(page, y)

  const drawSection = (sectionTitle: string, sectionRows: Row[]) => {
    if (sectionRows.length === 0) return
    ensureSpace(groupRowH + headerRowH)
    y = drawGroupBar(page, y, sectionTitle)
    for (const row of sectionRows) {
      ensureSpace(rowH + 2)
      y = drawDataRow(page, y, row)
    }
  }

  drawSection('BLOCKOUT BLINDS', blockoutRows)
  drawSection('SCREEN BLINDS', screenRows)

  ensureSpace(120)
  y = drawTotalsBlock(page, y)

  // ——— Page 2 ———
  page = pdfDoc.addPage([A4_W, A4_H])
  y = A4_H - TOP_MARGIN

  const totalPayable = Number(quote.final_total)
  const advance = totalPayable * 0.5
  const balance = totalPayable - advance
  const payBoxW = tableWidth
  const payRight = TABLE_LEFT + payBoxW - 8
  const payRowH = 22

  page.drawRectangle({
    x: TABLE_LEFT,
    y: y - payRowH,
    width: payBoxW,
    height: payRowH,
    borderColor: BLACK,
    borderWidth: GRID_STROKE,
  })
  const advLabel = 'Advance Payment'
  const advVal = `$ ${fmtMoney(advance)}`
  const advValW = font.widthOfTextAtSize(advVal, 9)
  const advLabW = fontBold.widthOfTextAtSize(advLabel, 9)
  page.drawText(advVal, {
    x: payRight - advValW,
    y: y - 15,
    size: 9,
    font,
    color: BLACK,
  })
  page.drawText(advLabel, {
    x: payRight - advValW - 12 - advLabW,
    y: y - 15,
    size: 9,
    font: fontBold,
    color: BLACK,
  })
  y -= payRowH

  page.drawRectangle({
    x: TABLE_LEFT,
    y: y - payRowH,
    width: payBoxW,
    height: payRowH,
    borderColor: BLACK,
    borderWidth: GRID_STROKE,
  })
  const balPrefix = 'Balance to be paid upon completion of the job -$ '
  const balAmt = fmtMoney(balance)
  const balAmtW = fontBold.widthOfTextAtSize(balAmt, 10)
  const balPrefixW = fontBold.widthOfTextAtSize(balPrefix, 8)
  const balStart = payRight - balPrefixW - balAmtW
  page.drawText(balPrefix, {
    x: balStart,
    y: y - 15,
    size: 8,
    font: fontBold,
    color: BLACK,
  })
  page.drawText(balAmt, {
    x: balStart + balPrefixW,
    y: y - 16,
    size: 10,
    font: fontBold,
    color: RED,
  })
  y -= payRowH + 14

  const payTerms = 'Payment Terms : Bank Transfer / Cash'
  const ptw = font.widthOfTextAtSize(payTerms, 9)
  page.drawText(payTerms, { x: (A4_W - ptw) / 2, y, size: 9, font, color: BLACK })
  y -= 16

  const acctLine = `Account Name : ${COMPANY.accountName}`
  const acctW = fontBold.widthOfTextAtSize(acctLine, 9)
  page.drawText(acctLine, { x: (A4_W - acctW) / 2, y, size: 9, font: fontBold, color: BLACK })
  y -= 14

  const bsbLine = `BSB : ${COMPANY.bsb} / Account number : ${COMPANY.accountNumber} / ${COMPANY.bankName}`
  const bsbW = font.widthOfTextAtSize(bsbLine, 9)
  page.drawText(bsbLine, { x: (A4_W - bsbW) / 2, y, size: 9, font, color: BLACK })
  y -= 22

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
  if (screenFabrics.length) {
    fabricSummary += (fabricSummary ? ' / ' : '') + screenFabrics[0]
  }
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

  page.drawText('Terms and conditions', {
    x: SIDE_MARGIN,
    y,
    size: 10,
    font: fontBold,
    color: BLACK,
  })
  y -= 14

  const termLabelW = 118
  const termPad = 6
  const termFont = 8
  const lineGap = 10

  for (const [label, desc] of termsRows) {
    const rowMinH = 22
    const descMaxW = A4_W - 2 * SIDE_MARGIN - termLabelW - termPad * 2
    const words = desc.split(/\s+/)
    const descLines: string[] = []
    let cur = ''
    for (const w of words) {
      const t = cur ? `${cur} ${w}` : w
      if (font.widthOfTextAtSize(t, termFont) <= descMaxW) cur = t
      else {
        if (cur) descLines.push(cur)
        cur = w
      }
    }
    if (cur) descLines.push(cur)
    const clipped = descLines.slice(0, 5)
    const rowH2 = Math.max(rowMinH, 8 + clipped.length * lineGap)

    if (y - rowH2 < BOTTOM_SAFE + 40) {
      page = pdfDoc.addPage([A4_W, A4_H])
      y = A4_H - TOP_MARGIN
      page.drawText('Terms and conditions (continued)', {
        x: SIDE_MARGIN,
        y,
        size: 10,
        font: fontBold,
        color: BLACK,
      })
      y -= 16
    }

    page.drawRectangle({
      x: SIDE_MARGIN,
      y: y - rowH2,
      width: A4_W - 2 * SIDE_MARGIN,
      height: rowH2,
      borderColor: BLACK,
      borderWidth: GRID_STROKE,
    })
    page.drawLine({
      start: { x: SIDE_MARGIN + termLabelW, y },
      end: { x: SIDE_MARGIN + termLabelW, y: y - rowH2 },
      thickness: GRID_STROKE,
      color: BLACK,
    })

    page.drawText(label, {
      x: SIDE_MARGIN + termPad,
      y: y - 12,
      size: termFont,
      font: fontBold,
      color: BLACK,
    })
    let dy = y - 12
    for (const ln of clipped) {
      page.drawText(ln, {
        x: SIDE_MARGIN + termLabelW + termPad,
        y: dy,
        size: termFont,
        font,
        color: BLACK,
      })
      dy -= lineGap
    }
    y -= rowH2
  }

  y -= 10
  const disclaimer =
    'All items & materials used remain the property of SP Interior Solutions Pty Ltd until full payment is received.'
  page.drawText(disclaimer, {
    x: SIDE_MARGIN,
    y,
    size: 8,
    font: fontOblique,
    color: BLACK,
  })

  const pdfBytes = await pdfDoc.save()
  return new Uint8Array(pdfBytes)
}

/**
 * Shared quotation PDF generation (used by API route and email attachment).
 * Layout aligned with SP Interior Solutions quotation: p.1 header + lines + totals, p.2 payment + terms.
 */
import { PDFDocument, StandardFonts, rgb, type PDFPage } from 'pdf-lib'
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
const PURPLE = rgb(0.45, 0.2, 0.55)
const GRAY_BG = rgb(0.92, 0.92, 0.94)
const RED = rgb(0.75, 0.12, 0.12)

const A4_W = 595
const A4_H = 842
const MARGIN = 40
const BOTTOM_SAFE = 56
const CELL_PAD = 6
const CONTACT_LINE_GAP = 12

/** Baseline Y to visually centre single-line text in a row of height `rowH` (PDF y increases upward). */
function cellBaselineY(topY: number, rowH: number, fontSize: number): number {
  return topY - rowH / 2 - fontSize * 0.31
}

type StdFonts = {
  font: Awaited<ReturnType<PDFDocument['embedFont']>>
  fontBold: Awaited<ReturnType<PDFDocument['embedFont']>>
  fontOblique: Awaited<ReturnType<PDFDocument['embedFont']>>
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
  if (fabric && product) {
    return `Group ${fabric.group_number} — ${product.name}`.slice(0, 52)
  }
  if (fabric) return `Fabric group ${fabric.group_number}`
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
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica)
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold)
  const fontOblique = await pdfDoc.embedFont(StandardFonts.HelveticaOblique)

  const logoResponse = await fetch(
    'https://spisolutions.com.au/wp-content/uploads/2025/04/spis_logo_v4.png'
  )
  const logoArrayBuffer = await logoResponse.arrayBuffer()
  const logoImage = await pdfDoc.embedPng(logoArrayBuffer)
  const logoScale = 56 / logoImage.width
  const logoDims = logoImage.scale(logoScale)

  const colW = [22, 128, 72, 36, 44, 158, 72]
  const tableLeft = MARGIN
  const tableWidth = A4_W - 2 * MARGIN
  const sumColW = colW.reduce((a, b) => a + b, 0)
  if (Math.abs(sumColW - tableWidth) > 1) {
    colW[6] += tableWidth - sumColW
  }

  const rowH = 18
  const headerRowH = 20
  const groupRowH = 17

  const drawPageHeader = (page: PDFPage, yStart: number) => {
    let y = yStart
    const leftX = MARGIN
    const rightBlockW = 200
    const rightX = A4_W - MARGIN - rightBlockW

    page.drawImage(logoImage, {
      x: leftX,
      y: y - logoDims.height,
      width: logoDims.width,
      height: logoDims.height,
    })

    page.drawText(COMPANY.displayName, {
      x: leftX + logoDims.width + 10,
      y: y - 14,
      size: 11,
      font: fontBold,
      color: PURPLE,
    })
    page.drawText(COMPANY.tagline, {
      x: leftX + logoDims.width + 10,
      y: y - 28,
      size: 9,
      font: fontOblique,
      color: PURPLE,
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
      start: { x: MARGIN, y: separatorY },
      end: { x: A4_W - MARGIN, y: separatorY },
      thickness: 0.5,
      color: BLACK,
    })
    y = separatorY - 18
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
    const pad = CELL_PAD + 1
    const nameMaxW = midX - tableLeft - 68
    const addrMaxW = gridW - 2 * pad - 4
    const emailMaxW = tableLeft + gridW - midX - 56

    const row1H = 24
    const addressLines = wrapLines(customerAddress, addrMaxW, 8, font, 10)
    const addressBlockH = Math.max(20, addressLines.length * 10 + 12)
    const row2H = addressBlockH
    const emailLines = wrapLines(customerEmail, emailMaxW, 8, font, 5)
    const quoteLeftSpan = 12 + 11 + 8
    const row3H = Math.max(quoteLeftSpan + 6, 12 + emailLines.length * 10 + 10)
    const gridH = row1H + row2H + row3H

    page.drawRectangle({
      x: tableLeft,
      y: y - gridH,
      width: gridW,
      height: gridH,
      borderColor: BLACK,
      borderWidth: 0.5,
    })
    page.drawLine({
      start: { x: midX, y: y },
      end: { x: midX, y: y - gridH },
      thickness: 0.5,
      color: BLACK,
    })
    page.drawLine({
      start: { x: tableLeft, y: y - row1H },
      end: { x: tableLeft + gridW, y: y - row1H },
      thickness: 0.5,
      color: BLACK,
    })
    page.drawLine({
      start: { x: tableLeft, y: y - row1H - row2H },
      end: { x: tableLeft + gridW, y: y - row1H - row2H },
      thickness: 0.5,
      color: BLACK,
    })

    const row1TextY = y - 14
    page.drawText('Name:', { x: tableLeft + pad, y: row1TextY, size: 9, font: fontBold, color: BLACK })
    drawWrappedText(page, customerName, tableLeft + 50, row1TextY, nameMaxW, 9, font, 11, 2)
    page.drawText('Date:', { x: midX + pad, y: row1TextY, size: 9, font: fontBold, color: BLACK })
    page.drawText(quoteDate, { x: midX + 42, y: row1TextY, size: 9, font, color: BLACK })

    const addrLabelY = y - row1H - 12
    page.drawText('Address:', { x: tableLeft + pad, y: addrLabelY, size: 9, font: fontBold, color: BLACK })
    drawWrappedText(page, customerAddress, tableLeft + pad, addrLabelY - 11, addrMaxW, 8, font, 10, 10)

    const row3Top = y - row1H - row2H - 12
    page.drawText('Quote No:', { x: tableLeft + pad, y: row3Top, size: 9, font: fontBold, color: BLACK })
    page.drawText(quote.quote_number, {
      x: tableLeft + 62,
      y: row3Top - 11,
      size: 10,
      font: fontBold,
      color: PURPLE,
    })
    page.drawText('Email:', { x: midX + pad, y: row3Top, size: 9, font: fontBold, color: BLACK })
    drawWrappedText(page, customerEmail, midX + 42, row3Top - 11, emailMaxW, 8, font, 10, 5)

    return y - gridH - 18
  }

  const drawTableHeader = (page: PDFPage, topY: number) => {
    let cellX = tableLeft
    const headers = ['#', 'LOCATION', 'TYPE', 'IN/OUT', 'BO/SHEER', 'FABRIC', 'PRICE']
    colW.forEach((w, i) => {
      page.drawRectangle({
        x: cellX,
        y: topY - headerRowH,
        width: w,
        height: headerRowH,
        color: GRAY_BG,
        borderColor: BLACK,
        borderWidth: 0.5,
      })
      const label = headers[i] ?? ''
      const fs = i === 5 ? 7 : 8
      const by = cellBaselineY(topY, headerRowH, fs)
      const tw = fontBold.widthOfTextAtSize(label, fs)
      let lx = cellX + CELL_PAD
      if (i === 0) lx = cellX + (w - tw) / 2
      else if (i === 6) lx = cellX + w - tw - CELL_PAD
      page.drawText(label, {
        x: lx,
        y: by,
        size: fs,
        font: fontBold,
        color: BLACK,
      })
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
      borderWidth: 0.5,
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
      '$ ' + row.price,
    ]
    colW.forEach((w, i) => {
      page.drawRectangle({
        x: cellX,
        y: topY - rowH,
        width: w,
        height: rowH,
        borderColor: BLACK,
        borderWidth: 0.5,
      })
      cellX += w
    })
    cellX = tableLeft
    const by8 = cellBaselineY(topY, rowH, 8)
    const by7 = cellBaselineY(topY, rowH, 7)
    const idx = cells[0]
    const idxW = font.widthOfTextAtSize(idx, 8)
    page.drawText(idx, {
      x: cellX + (colW[0] - idxW) / 2,
      y: by8,
      size: 8,
      font,
      color: BLACK,
    })
    cellX += colW[0]
    page.drawText(
      cells[1].length > 22 ? cells[1].slice(0, 21) + '…' : cells[1],
      { x: cellX + CELL_PAD, y: by7, size: 7, font, color: BLACK }
    )
    cellX += colW[1]
    page.drawText(
      cells[2].length > 14 ? cells[2].slice(0, 13) + '…' : cells[2],
      { x: cellX + CELL_PAD, y: by7, size: 7, font, color: BLACK }
    )
    cellX += colW[2]
    const inOutW = font.widthOfTextAtSize(cells[3], 8)
    page.drawText(cells[3], {
      x: cellX + (colW[3] - inOutW) / 2,
      y: by8,
      size: 8,
      font,
      color: BLACK,
    })
    cellX += colW[3]
    const boW = font.widthOfTextAtSize(cells[4], 8)
    page.drawText(cells[4], {
      x: cellX + (colW[4] - boW) / 2,
      y: by8,
      size: 8,
      font,
      color: BLACK,
    })
    cellX += colW[4]
    page.drawText(
      cells[5].length > 28 ? cells[5].slice(0, 27) + '…' : cells[5],
      { x: cellX + CELL_PAD, y: by7, size: 7, font, color: BLACK }
    )
    cellX += colW[5]
    const p = cells[6]
    page.drawText(p, {
      x: cellX + colW[6] - font.widthOfTextAtSize(p, 8) - CELL_PAD,
      y: by8,
      size: 8,
      font,
      color: BLACK,
    })
    return topY - rowH
  }

  const drawTotalsBlock = (page: PDFPage, y: number) => {
    const totalPreGst = Number(quote.subtotal)
    const gstVal = Number(quote.gst)
    const totalPayable = Number(quote.final_total)
    const boxW = 220
    const boxLeft = A4_W - MARGIN - boxW
    const innerPad = 10
    const lineH = 14
    const boxH = innerPad * 2 + lineH * 3 + 6

    page.drawRectangle({
      x: boxLeft,
      y: y - boxH,
      width: boxW,
      height: boxH,
      borderColor: BLACK,
      borderWidth: 0.5,
    })

    let ty = y - innerPad - 12
    const drawLine = (label: string, value: string, bold = false) => {
      const f = bold ? fontBold : font
      page.drawText(label, { x: boxLeft + innerPad, y: ty, size: 9, font: f, color: BLACK })
      const vs = '$ ' + value
      page.drawText(vs, {
        x: boxLeft + boxW - innerPad - f.widthOfTextAtSize(vs, 9),
        y: ty,
        size: 9,
        font: f,
        color: BLACK,
      })
      ty -= lineH
    }

    drawLine('Sub Total', fmtMoney(totalPreGst))
    drawLine('10% GST', fmtMoney(gstVal))
    ty -= 2
    drawLine('Total Payable', fmtMoney(totalPayable), true)
    return y - boxH - 12
  }

  // ——— Page 1 ———
  let page = pdfDoc.addPage([A4_W, A4_H])
  let y = A4_H - MARGIN

  y = drawPageHeader(page, y)
  y = drawCustomerGrid(page, y)

  const title = 'QUOTATION FOR ROLLER BLINDS'
  const titleSize = 13
  const tw = fontBold.widthOfTextAtSize(title, titleSize)
  page.drawText(title, {
    x: (A4_W - tw) / 2,
    y: y - 6,
    size: titleSize,
    font: fontBold,
    color: PURPLE,
  })
  y -= 28

  const ensureSpace = (need: number): void => {
    if (y - need < BOTTOM_SAFE) {
      page = pdfDoc.addPage([A4_W, A4_H])
      y = A4_H - MARGIN
      y = drawPageHeader(page, y)
      y -= 8
      page.drawText('(continued)', {
        x: MARGIN,
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
      ensureSpace(rowH + 4)
      y = drawDataRow(page, y, row)
    }
  }

  drawSection('BLOCKOUT BLINDS', blockoutRows)
  drawSection('SCREEN BLINDS', screenRows)

  ensureSpace(120)
  y = drawTotalsBlock(page, y)

  // ——— Page 2 ———
  page = pdfDoc.addPage([A4_W, A4_H])
  y = A4_H - MARGIN

  page.drawText('Payment summary', {
    x: MARGIN,
    y,
    size: 11,
    font: fontBold,
    color: BLACK,
  })
  y -= 20

  const totalPayable = Number(quote.final_total)
  const advance = totalPayable * 0.5
  const balance = totalPayable - advance
  const payBoxW = tableWidth
  const payRowH = 22

  page.drawRectangle({
    x: MARGIN,
    y: y - payRowH,
    width: payBoxW,
    height: payRowH,
    borderColor: BLACK,
    borderWidth: 0.5,
  })
  page.drawText('Advance Payment', { x: MARGIN + 8, y: y - 15, size: 9, font: fontBold, color: BLACK })
  const advStr = '$ ' + fmtMoney(advance)
  page.drawText(advStr, {
    x: MARGIN + payBoxW - font.widthOfTextAtSize(advStr, 9) - 8,
    y: y - 15,
    size: 9,
    font,
    color: BLACK,
  })
  y -= payRowH

  page.drawRectangle({
    x: MARGIN,
    y: y - payRowH,
    width: payBoxW,
    height: payRowH,
    borderColor: BLACK,
    borderWidth: 0.5,
  })
  const balLabel = 'Balance to be paid upon completion of the job'
  page.drawText(balLabel, { x: MARGIN + 8, y: y - 15, size: 8, font: fontBold, color: BLACK })
  const balStr = '$ ' + fmtMoney(balance)
  page.drawText(balStr, {
    x: MARGIN + payBoxW - fontBold.widthOfTextAtSize(balStr, 10) - 8,
    y: y - 16,
    size: 10,
    font: fontBold,
    color: RED,
  })
  y -= payRowH + 18

  page.drawText('Payment details', { x: MARGIN, y, size: 10, font: fontBold, color: BLACK })
  y -= 14
  page.drawText('Payment terms: Bank Transfer / Cash', { x: MARGIN, y, size: 9, font, color: BLACK })
  y -= 12
  page.drawText(`Account Name: ${COMPANY.accountName}`, { x: MARGIN, y, size: 9, font, color: BLACK })
  y -= 11
  page.drawText(`BSB: ${COMPANY.bsb}    Account number: ${COMPANY.accountNumber}`, {
    x: MARGIN,
    y,
    size: 9,
    font,
    color: BLACK,
  })
  y -= 11
  page.drawText(`Bank: ${COMPANY.bankName}`, { x: MARGIN, y, size: 9, font, color: BLACK })
  y -= 22

  const additionalInfoText =
    quote.additional_info && String(quote.additional_info).trim().length
      ? String(quote.additional_info).trim()
      : 'As discussed with SP Interior Solutions.'
  const etaText =
    quote.eta_text && String(quote.eta_text).trim().length
      ? String(quote.eta_text).trim()
      : 'As advised at time of order'

  const termsRows: [string, string][] = [
    [
      'Roller blind fabric',
      'Fabric groups and colours as per this quotation and selections confirmed on site.',
    ],
    ['Roller blind mounted', 'Recess fit (IN) unless otherwise noted.'],
    ['Fabric colours', 'May differ slightly batch to batch from samples shown.'],
    ['Confirmation of order', '50% deposit required to confirm materials and schedule.'],
    ['ETA', etaText],
    [
      'Quote',
      'Valid 30 days from date above. Price includes supply and installation for quantities listed.',
    ],
    [
      'Warranty',
      'Fabric warranty up to 5 years (per supplier). Accessories / components 1 year. Installation workmanship per Australian Consumer Law.',
    ],
    ['Additional information', additionalInfoText],
  ]

  page.drawText('Terms and conditions', {
    x: MARGIN,
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
    const descMaxW = A4_W - 2 * MARGIN - termLabelW - termPad * 2
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
      y = A4_H - MARGIN
      page.drawText('Terms and conditions (continued)', {
        x: MARGIN,
        y,
        size: 10,
        font: fontBold,
        color: BLACK,
      })
      y -= 16
    }

    page.drawRectangle({
      x: MARGIN,
      y: y - rowH2,
      width: A4_W - 2 * MARGIN,
      height: rowH2,
      borderColor: BLACK,
      borderWidth: 0.5,
    })
    page.drawLine({
      start: { x: MARGIN + termLabelW, y },
      end: { x: MARGIN + termLabelW, y: y - rowH2 },
      thickness: 0.5,
      color: BLACK,
    })

    page.drawText(label, {
      x: MARGIN + termPad,
      y: y - 12,
      size: termFont,
      font: fontBold,
      color: BLACK,
    })
    let dy = y - 12
    for (const ln of clipped) {
      page.drawText(ln, {
        x: MARGIN + termLabelW + termPad,
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
    'All materials remain the property of SP Interior Solutions Pty Ltd until payment is received in full.'
  page.drawText(disclaimer, {
    x: MARGIN,
    y,
    size: 8,
    font: fontOblique,
    color: BLACK,
  })

  const pdfBytes = await pdfDoc.save()
  return new Uint8Array(pdfBytes)
}

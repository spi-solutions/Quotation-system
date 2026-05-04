/**
 * Shared quotation PDF generation (used by API route and Mailgun email attachment).
 */
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'
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
  bsb: 'xxx-xxx',
  accountNumber: 'xxxxxxx',
}

const BLACK = rgb(0, 0, 0)
const PURPLE = rgb(0.45, 0.2, 0.55)
const GRAY_BG = rgb(0.95, 0.95, 0.95)

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

  const pdfDoc = await PDFDocument.create()
  const page = pdfDoc.addPage([595, 842])
  const { width, height } = page.getSize()
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica)
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold)
  const fontOblique = await pdfDoc.embedFont(StandardFonts.HelveticaOblique)

  const margin = 40
  let y = height - margin

  const leftX = margin
  const rightX = width - margin - 180

  const logoResponse = await fetch(
    'https://spisolutions.com.au/wp-content/uploads/2025/04/spis_logo_v4.png'
  )
  const logoArrayBuffer = await logoResponse.arrayBuffer()
  const logoImage = await pdfDoc.embedPng(logoArrayBuffer)
  const logoScale = 140 / logoImage.width
  const logoDims = logoImage.scale(logoScale)

  page.drawImage(logoImage, {
    x: leftX,
    y: y - logoDims.height,
    width: logoDims.width,
    height: logoDims.height,
  })

  page.drawText(COMPANY.tagline, {
    x: leftX,
    y: y - logoDims.height - 16,
    size: 11,
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
    const tw = font.widthOfTextAtSize(line, 9)
    page.drawText(line, {
      x: rightX + (180 - tw),
      y: cy,
      size: 9,
      font: line === COMPANY.legalName ? fontBold : font,
      color: BLACK,
    })
    cy -= 12
  })

  y -= 58

  page.drawLine({
    start: { x: margin, y },
    end: { x: width - margin, y },
    thickness: 0.5,
    color: BLACK,
  })
  y -= 20

  const customerName = customer?.name ?? '—'
  const customerAddress = customer?.address ?? '—'
  const customerPhone = customer?.phone ?? '—'
  const customerEmail = customer?.email ?? '—'

  page.drawText('Name:', { x: leftX, y, size: 10, font, color: BLACK })
  page.drawText(customerName, { x: leftX + 45, y, size: 10, font, color: BLACK })
  y -= 14
  page.drawText('Add:', { x: leftX, y, size: 10, font, color: BLACK })
  page.drawText(customerAddress, { x: leftX + 45, y, size: 10, font, color: BLACK })
  y -= 14
  page.drawText('Phone:', { x: leftX, y, size: 10, font, color: BLACK })
  page.drawText(customerPhone, { x: leftX + 45, y, size: 10, font, color: BLACK })
  y -= 14
  page.drawText('Email:', { x: leftX, y, size: 10, font, color: BLACK })
  page.drawText(customerEmail, { x: leftX + 45, y, size: 10, font, color: BLACK })

  const quoteDate = new Date(quote.created_at).toLocaleDateString('en-AU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
  const dateStr = `Date: ${quoteDate}`
  const quoteNoStr = `Quote No: ${quote.quote_number}`
  page.drawText(dateStr, {
    x: rightX + (180 - font.widthOfTextAtSize(dateStr, 10)),
    y: height - margin - 78,
    size: 10,
    font,
    color: BLACK,
  })
  page.drawText(quoteNoStr, {
    x: rightX + (180 - font.widthOfTextAtSize(quoteNoStr, 10)),
    y: height - margin - 92,
    size: 10,
    font,
    color: BLACK,
  })

  y -= 24

  page.drawLine({
    start: { x: margin, y },
    end: { x: width - margin, y },
    thickness: 0.5,
    color: BLACK,
  })
  y -= 14

  const titleBarH = 28
  y -= titleBarH
  const titleText = 'QUOTATION FOR ROLLER BLINDS'
  const titleW = fontBold.widthOfTextAtSize(titleText, 14)
  page.drawText(titleText, {
    x: margin + (width - 2 * margin - titleW) / 2,
    y: y + 9,
    size: 14,
    font: fontBold,
    color: PURPLE,
  })
  y -= 4

  const tableLeft = margin
  const tableWidth = width - 2 * margin
  const rowH = 22
  const colW = [
    18,
    24,
    66,
    62,
    58,
    48,
    54,
    tableWidth - 18 - 24 - 66 - 62 - 58 - 48 - 54,
  ]
  const headerY = y

  let headerCellX = tableLeft
  colW.forEach((w) => {
    page.drawRectangle({
      x: headerCellX,
      y: headerY - rowH,
      width: w,
      height: rowH,
      borderColor: BLACK,
      borderWidth: 0.5,
    })
    headerCellX += w
  })

  let cx = tableLeft + 4
  page.drawText('#', { x: cx, y: headerY - 16, size: 9, font: fontBold, color: BLACK })
  cx += colW[0]
  page.drawText('QTY', { x: cx + 2, y: headerY - 16, size: 9, font: fontBold, color: BLACK })
  cx += colW[1]
  page.drawText('LOCATION', { x: cx + 2, y: headerY - 16, size: 8, font: fontBold, color: BLACK })
  cx += colW[2]
  page.drawText('TYPE', { x: cx + 2, y: headerY - 16, size: 8, font: fontBold, color: BLACK })
  cx += colW[3]
  page.drawText('Recess /', { x: cx + 2, y: headerY - 12, size: 7, font: fontBold, color: BLACK })
  page.drawText('Face fit', { x: cx + 2, y: headerY - 20, size: 7, font: fontBold, color: BLACK })
  cx += colW[4]
  page.drawText('FABRIC', { x: cx + 4, y: headerY - 16, size: 8, font: fontBold, color: BLACK })
  cx += colW[5]
  page.drawText('BLOCKOUT /', { x: cx + 2, y: headerY - 12, size: 7, font: fontBold, color: BLACK })
  page.drawText('SCREEN', { x: cx + 2, y: headerY - 20, size: 7, font: fontBold, color: BLACK })
  cx += colW[6]
  const subtotalHdr = 'SUBTOTAL ex GST'
  page.drawText(subtotalHdr, {
    x: cx + colW[7] - fontBold.widthOfTextAtSize(subtotalHdr, 7) - 4,
    y: headerY - 16,
    size: 8,
    font: fontBold,
    color: BLACK,
  })

  y = headerY - rowH

  type Row = {
    index: number
    qty: number
    location: string
    type: string
    fit: string
    fabric: string
    blockout: string
    price: string
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
        fabricMap.set(
          item.fabric_group_id,
          await fabricGroupRepository.findById(item.fabric_group_id)
        )
      }
    }

    rows = items.map((item, idx) => {
      const product = productMap.get(item.product_id)
      const fabric = fabricMap.get(item.fabric_group_id)
      const locationText =
        item.location_label === 'Other' && item.location_other
          ? item.location_other
          : item.location_label
      const typeText = product?.name ?? 'Roller Blinds'
      const fitText = 'Recess fit'
      const fabricText = fabric ? `Group ${fabric.group_number}` : '—'
      const blockoutText = 'BO'
      const priceVal = Number(item.subtotal)
      const priceStr = priceVal.toFixed(2)
      const qty = Math.max(1, Math.floor(Number(item.quantity)) || 1)

      return {
        index: idx + 1,
        qty,
        location: locationText,
        type: typeText,
        fit: fitText,
        fabric: fabricText,
        blockout: blockoutText,
        price: priceStr,
      }
    })
  } else {
    const locationText = headerProduct?.name ?? 'As specified'
    const typeText = 'Roller Blinds'
    const fitText = 'Recess fit'
    const fabricText = headerFabricGroup ? `Group ${headerFabricGroup.group_number}` : '—'
    const blockoutText = 'BO'
    const priceVal = Number(quote.subtotal)
    const priceStr = priceVal.toFixed(2)

    rows = [
      {
        index: 1,
        qty: 1,
        location: locationText,
        type: typeText,
        fit: fitText,
        fabric: fabricText,
        blockout: blockoutText,
        price: priceStr,
      },
    ]
  }

  const bodyRowCount = rows.length
  let currentRowBottom = y - rowH

  for (let rowIndex = 0; rowIndex < bodyRowCount; rowIndex++) {
    let cellX = tableLeft
    colW.forEach((w) => {
      page.drawRectangle({
        x: cellX,
        y: currentRowBottom,
        width: w,
        height: rowH,
        borderColor: BLACK,
        borderWidth: 0.5,
      })
      cellX += w
    })

    const row = rows[rowIndex]
    if (row) {
      cellX = tableLeft + 4
      page.drawText(String(row.index), { x: cellX, y: currentRowBottom + 6, size: 10, font, color: BLACK })
      cellX += colW[0]
      page.drawText(String(row.qty), {
        x: cellX + colW[1] / 2 - font.widthOfTextAtSize(String(row.qty), 9) / 2,
        y: currentRowBottom + 6,
        size: 9,
        font,
        color: BLACK,
      })
      cellX += colW[1]
      page.drawText(
        row.location.length > 14 ? row.location.slice(0, 13) + '…' : row.location,
        { x: cellX + 2, y: currentRowBottom + 6, size: 8, font, color: BLACK }
      )
      cellX += colW[2]
      page.drawText(row.type.length > 12 ? row.type.slice(0, 11) + '…' : row.type, {
        x: cellX + 2,
        y: currentRowBottom + 6,
        size: 8,
        font,
        color: BLACK,
      })
      cellX += colW[3]
      page.drawText(row.fit, { x: cellX + 2, y: currentRowBottom + 6, size: 8, font, color: BLACK })
      cellX += colW[4]
      page.drawText(row.fabric, { x: cellX + 4, y: currentRowBottom + 6, size: 8, font, color: BLACK })
      cellX += colW[5]
      page.drawText(row.blockout, { x: cellX + 6, y: currentRowBottom + 6, size: 8, font, color: BLACK })
      cellX += colW[6]
      const withDollar = '$ ' + row.price
      page.drawText(withDollar, {
        x: cellX + colW[7] - font.widthOfTextAtSize(withDollar, 9) - 4,
        y: currentRowBottom + 6,
        size: 9,
        font,
        color: BLACK,
      })
    }

    currentRowBottom -= rowH
  }

  y = currentRowBottom - 16

  const totalPreGst = Number(quote.subtotal)
  const gstVal = Number(quote.gst)
  const totalPayable = Number(quote.final_total)
  const deposit = totalPayable / 2
  const balance = totalPayable - deposit

  const sumLeft = width - margin - 200
  const sumValRight = width - margin - 20

  const fmt = (v: number) => v.toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  const drawSumRow = (label: string, value: number, yPos: number, bold = false) => {
    const f = bold ? fontBold : font
    const vStr = fmt(value)
    page.drawText(label, { x: sumLeft, y: yPos, size: 10, font: f, color: BLACK })
    page.drawText('$' + vStr, {
      x: sumValRight - f.widthOfTextAtSize('$' + vStr, 10),
      y: yPos,
      size: 10,
      font: f,
      color: BLACK,
    })
  }

  drawSumRow('Subtotal (ex GST) $', totalPreGst, y)
  y -= 16
  drawSumRow('GST 10% $', gstVal, y)
  y -= 16
  page.drawRectangle({
    x: sumLeft - 4,
    y: y - 4,
    width: sumValRight - sumLeft + 8,
    height: 20,
    color: GRAY_BG,
  })
  drawSumRow('Total Payable $', totalPayable, y + 2, true)
  y -= 24
  drawSumRow('50% Deposit', deposit, y)
  y -= 16
  drawSumRow('Balance Payable', balance, y)

  y -= 32

  const centerX = width / 2
  const accNameStr = `Account Name : ${COMPANY.accountName}`
  const accDetailStr = `BSB : ${COMPANY.bsb} / Account number : ${COMPANY.accountNumber}`
  page.drawText(accNameStr, {
    x: centerX - fontBold.widthOfTextAtSize(accNameStr, 10) / 2,
    y,
    size: 10,
    font: fontBold,
    color: BLACK,
  })
  y -= 16
  page.drawText(accDetailStr, {
    x: centerX - font.widthOfTextAtSize(accDetailStr, 9) / 2,
    y,
    size: 9,
    font,
    color: BLACK,
  })

  y -= 24

  const boxPad = 12
  const termsTitle = 'Additional information / terms and conditions'
  const additionalInfoText =
    quote.additional_info && String(quote.additional_info).trim().length
      ? String(quote.additional_info).trim()
      : 'As discussed with SP Interior Solutions.'
  const etaText =
    quote.eta_text && String(quote.eta_text).trim().length
      ? String(quote.eta_text).trim()
      : 'Blinds 2-3 wks'

  const termsLines = [
    ['Additional info', additionalInfoText],
    ['Fabric colours', 'May differ slightly from batch to batch from sample shown'],
    ['Confirmation', '50% deposit'],
    ['ETA', etaText],
    [
      'Quote',
      'Price is for the above quantities and valid for 14 days only. Price includes supply and installation',
    ],
  ]
  const termFontSize = 9
  const boxH = 24 + termsLines.length * 14
  const boxY = y - boxH
  const boxW = width - 2 * margin

  page.drawRectangle({
    x: margin,
    y: boxY,
    width: boxW,
    height: boxH,
    borderColor: BLACK,
    borderWidth: 1.5,
  })
  page.drawText(termsTitle, {
    x: centerX - fontBold.widthOfTextAtSize(termsTitle, 10) / 2,
    y: y - 16,
    size: 10,
    font: fontBold,
    color: BLACK,
  })
  let ty = y - 34
  termsLines.forEach(([term, desc]) => {
    page.drawText(term, { x: margin + boxPad, y: ty, size: termFontSize, font, color: BLACK })
    const descW = font.widthOfTextAtSize(desc, termFontSize)
    if (descW > boxW - 2 * boxPad - 120) {
      page.drawText(desc.slice(0, 55) + '…', { x: margin + 130, y: ty, size: termFontSize, font, color: BLACK })
    } else {
      page.drawText(desc, { x: margin + 130, y: ty, size: termFontSize, font, color: BLACK })
    }
    ty -= 14
  })

  const pdfBytes = await pdfDoc.save()
  return new Uint8Array(pdfBytes)
}

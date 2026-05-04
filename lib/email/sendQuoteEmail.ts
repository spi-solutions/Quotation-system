import { generateQuotePdfBytes } from '@/lib/pdf/generateQuotePdf'
import { createQuoteAcceptToken } from '@/lib/email/quoteAcceptToken'

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

export type SendQuoteEmailParams = {
  to: string
  customerName: string
  quoteNumber: string
  quoteId: number
  totalAmount: number
}

export type SendQuoteEmailResult = { sent: true } | { sent: false; reason: string }

async function getGraphAccessToken(
  tenantId: string,
  clientId: string,
  clientSecret: string
): Promise<string> {
  const tokenUrl = `https://login.microsoftonline.com/${encodeURIComponent(tenantId)}/oauth2/v2.0/token`
  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    grant_type: 'client_credentials',
    scope: 'https://graph.microsoft.com/.default',
  })

  const res = await fetch(tokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  })

  const raw = await res.text()
  let parsed: { access_token?: string; error_description?: string } = {}
  try {
    parsed = raw ? JSON.parse(raw) : {}
  } catch {
    parsed = {}
  }

  if (!res.ok || !parsed.access_token) {
    const reason = parsed.error_description || `Token request failed (${res.status})`
    throw new Error(reason)
  }

  return parsed.access_token
}

/**
 * Sends the quotation PDF to the customer via Microsoft Graph.
 * Required env: MS_CLIENT_ID, MS_TENANT_ID, MS_CLIENT_SECRET, MS_SENDER_EMAIL.
 */
export async function sendQuoteEmail(params: SendQuoteEmailParams): Promise<SendQuoteEmailResult> {
  const clientId = process.env.MS_CLIENT_ID?.trim()
  const tenantId = process.env.MS_TENANT_ID?.trim()
  const clientSecret = process.env.MS_CLIENT_SECRET?.trim()
  const senderEmail = process.env.MS_SENDER_EMAIL?.trim()
  const appUrl = (process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3001').replace(/\/$/, '')

  if (!clientId || !tenantId || !clientSecret || !senderEmail) {
    console.warn(
      '[email] Skipping send: set MS_CLIENT_ID, MS_TENANT_ID, MS_CLIENT_SECRET, and MS_SENDER_EMAIL.'
    )
    return {
      sent: false,
      reason: 'Email not configured (MS_CLIENT_ID / MS_TENANT_ID / MS_CLIENT_SECRET / MS_SENDER_EMAIL)',
    }
  }

  const to = params.to.trim()
  if (!to) {
    return { sent: false, reason: 'No recipient email' }
  }

  let pdfBuffer: Buffer
  try {
    const pdfBytes = await generateQuotePdfBytes(params.quoteId)
    pdfBuffer = Buffer.from(pdfBytes)
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'PDF generation failed'
    console.error('[email] PDF error:', msg)
    return { sent: false, reason: msg }
  }

  const safeName = escapeHtml(params.customerName || 'Customer')
  const safeQuote = escapeHtml(params.quoteNumber)
  const total = params.totalAmount.toFixed(2)
  const fileName = `quote-${params.quoteNumber.replace(/[^a-zA-Z0-9-_]/g, '_')}.pdf`
  const acceptToken = await createQuoteAcceptToken({
    quoteId: params.quoteId,
    customerEmail: to,
  })
  const acceptUrl = `${appUrl}/api/quotes/accept?token=${encodeURIComponent(acceptToken)}`

  const html = `
<!DOCTYPE html>
<html>
<body style="font-family: system-ui, sans-serif; line-height: 1.5; color: #1e293b;">
  <p>Hi ${safeName},</p>
  <p>Thank you for your interest. Your quotation <strong>${safeQuote}</strong> is attached as a PDF.</p>
  <p><strong>Total payable:</strong> $${total} (inc. GST)</p>
  <p>If you are happy to proceed, you can <a href="${acceptUrl}">accept this quote now</a> without logging in.</p>
  <p>You can also <a href="${appUrl}/login">log in</a> with this email address and open <strong>My quotations</strong> to view or download your quote.</p>
  <p>Regards,<br/>SP Interior Solutions</p>
</body>
</html>`

  try {
    const token = await getGraphAccessToken(tenantId, clientId, clientSecret)
    const endpoint = `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(senderEmail)}/sendMail`
    const sendRes = await fetch(endpoint, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message: {
          subject: `Your quotation ${params.quoteNumber}`,
          body: {
            contentType: 'HTML',
            content: html,
          },
          toRecipients: [
            {
              emailAddress: { address: to },
            },
          ],
          attachments: [
            {
              '@odata.type': '#microsoft.graph.fileAttachment',
              name: fileName,
              contentType: 'application/pdf',
              contentBytes: pdfBuffer.toString('base64'),
            },
          ],
        },
        saveToSentItems: true,
      }),
    })

    if (!sendRes.ok) {
      const raw = await sendRes.text()
      let reason = `Graph send failed (${sendRes.status})`
      try {
        const parsed = raw ? JSON.parse(raw) : {}
        reason =
          parsed?.error?.message ||
          parsed?.error_description ||
          reason
      } catch {
        if (raw) reason = raw
      }
      throw new Error(reason)
    }
    return { sent: true }
  } catch (e: unknown) {
    console.error('[email] Microsoft Graph error:', e)
    const reason =
      e && typeof e === 'object' && 'details' in e
        ? String((e as { details: string }).details)
        : e instanceof Error
          ? e.message
          : 'Send failed'
    return { sent: false, reason }
  }
}

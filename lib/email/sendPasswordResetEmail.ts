function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

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

export async function sendPasswordResetEmail(params: {
  to: string
  resetUrl: string
}): Promise<void> {
  const clientId = process.env.MS_CLIENT_ID?.trim()
  const tenantId = process.env.MS_TENANT_ID?.trim()
  const clientSecret = process.env.MS_CLIENT_SECRET?.trim()
  const senderEmail = process.env.MS_SENDER_EMAIL?.trim()

  if (!clientId || !tenantId || !clientSecret || !senderEmail) {
    throw new Error('Email not configured (MS_CLIENT_ID / MS_TENANT_ID / MS_CLIENT_SECRET / MS_SENDER_EMAIL)')
  }

  const safeUrl = escapeHtml(params.resetUrl)
  const html = `
<!DOCTYPE html>
<html>
<body style="font-family: system-ui, sans-serif; line-height: 1.5; color: #1e293b;">
  <p>We received a request to reset your password.</p>
  <p><a href="${safeUrl}">Reset your password</a></p>
  <p>This link expires in 30 minutes and can be used only once.</p>
  <p>If you did not request this, you can ignore this email.</p>
</body>
</html>`

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
        subject: 'Reset your password',
        body: {
          contentType: 'HTML',
          content: html,
        },
        toRecipients: [
          {
            emailAddress: { address: params.to },
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
      reason = parsed?.error?.message || parsed?.error_description || reason
    } catch {
      if (raw) reason = raw
    }
    throw new Error(reason)
  }
}

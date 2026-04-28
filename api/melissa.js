// Tess Buddy — Melissa Global Email proxy
//
// Keeps the Melissa license key server-side. Front-end POSTs { email } and
// receives Melissa's full JSON response back verbatim so the UI can both
// display it and forward it to kognative_CONTACT_SCREEN (EMAIL_WRITE) as
// the @melissa_code audit payload.
//
// Required env var: MELISSA_LICENSE_KEY
//
// Melissa endpoint:
//   https://globalemail.melissadata.net/V4/WEB/GlobalEmail/doGlobalEmail
//   docs: https://docs.melissa.com/cloud-api/global-email/global-email-reference-guide.html

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed. Use POST.' })
    return
  }

  const { email } = req.body || {}
  if (!email || typeof email !== 'string') {
    res.status(400).json({ error: 'Request body must include { email: string }' })
    return
  }

  const licenseKey = process.env.MELISSA_LICENSE_KEY
  if (!licenseKey) {
    res.status(500).json({ error: 'MELISSA_LICENSE_KEY is not configured on the server.' })
    return
  }

  try {
    const url = new URL('https://globalemail.melissadata.net/V4/WEB/GlobalEmail/doGlobalEmail')
    url.searchParams.set('id', licenseKey)
    url.searchParams.set('format', 'json')
    url.searchParams.set('email', email)
    // Express mailbox verify + typo correction. Tune later if needed.
    url.searchParams.set('opt', 'VerifyMailBox:Express,DomainCorrection:On')
    url.searchParams.set('t', `tess-buddy-${Date.now()}`)

    const response = await fetch(url.toString(), { method: 'GET' })
    const text = await response.text()

    res.setHeader('Content-Type', 'application/json')
    res.status(response.status).send(text || '{}')
  } catch (err) {
    console.error('melissa proxy error:', err)
    res.status(500).json({ error: err.message })
  }
}

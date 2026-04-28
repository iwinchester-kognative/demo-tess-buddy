// Tess Buddy — Melissa Global Phone proxy
//
// Keeps the Melissa license key server-side. Front-end POSTs { phone, country }
// and receives Melissa's full JSON response back verbatim so the UI can both
// display it and forward it to kognative_CONTACT_SCREEN (PHONE_WRITE) as the
// @melissa_code audit payload.
//
// Required env var: MELISSA_LICENSE_KEY
//
// Melissa endpoint:
//   https://globalphone.melissadata.net/v4/WEB/GlobalPhone/doGlobalPhone
//   docs: https://docs.melissa.com/cloud-api/global-phone/global-phone-reference-guide.html

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed. Use POST.' })
    return
  }

  const { phone, country } = req.body || {}
  if (!phone || typeof phone !== 'string') {
    res.status(400).json({ error: 'Request body must include { phone: string }' })
    return
  }

  const licenseKey = process.env.MELISSA_LICENSE_KEY
  if (!licenseKey) {
    res.status(500).json({ error: 'MELISSA_LICENSE_KEY is not configured on the server.' })
    return
  }

  try {
    // Param names per Melissa Global Phone v4 OpenAPI spec (global-phone.json):
    //   id    — license key (required)
    //   phone — the phone number (required)   <-- NOT "phonenumber"
    //   ctry  — ISO2 country code (optional)  <-- NOT "country"
    //   t     — transmission reference, echoed back in the response
    //   format=json — return JSON instead of XML
    const url = new URL('https://globalphone.melissadata.net/v4/WEB/GlobalPhone/doGlobalPhone')
    url.searchParams.set('id', licenseKey)
    url.searchParams.set('format', 'json')
    url.searchParams.set('phone', phone)
    url.searchParams.set('ctry', country || 'US')
    url.searchParams.set('t', `tess-buddy-${Date.now()}`)

    const response = await fetch(url.toString(), { method: 'GET' })
    const text = await response.text()

    res.setHeader('Content-Type', 'application/json')
    res.status(response.status).send(text || '{}')
  } catch (err) {
    console.error('melissa-phone proxy error:', err)
    res.status(500).json({ error: err.message })
  }
}

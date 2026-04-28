// Tess Buddy — Melissa Global Address proxy
//
// Keeps the Melissa license key server-side. Front-end POSTs the address
// fields and receives Melissa's full JSON response back verbatim so the UI
// can both display it and forward it to kognative_CONTACT_SCREEN
// (ADDRESS_WRITE) as the @melissa_code audit payload.
//
// Required env var: MELISSA_LICENSE_KEY
//
// Melissa endpoint:
//   https://address.melissadata.net/v3/WEB/GlobalAddress/doGlobalAddress
//   docs: https://docs.melissa.com/cloud-api/global-address/global-address-reference-guide.html

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed. Use POST.' })
    return
  }

  const { street1, street2, city, state, postal, country } = req.body || {}
  if (!street1 || typeof street1 !== 'string') {
    res.status(400).json({ error: 'Request body must include { street1: string } at minimum' })
    return
  }

  const licenseKey = process.env.MELISSA_LICENSE_KEY
  if (!licenseKey) {
    res.status(500).json({ error: 'MELISSA_LICENSE_KEY is not configured on the server.' })
    return
  }

  try {
    const url = new URL('https://address.melissadata.net/v3/WEB/GlobalAddress/doGlobalAddress')
    url.searchParams.set('id', licenseKey)
    url.searchParams.set('format', 'json')
    url.searchParams.set('a1', street1)
    if (street2) url.searchParams.set('a2', street2)
    if (city)    url.searchParams.set('loc', city)
    if (state)   url.searchParams.set('admarea', state)
    if (postal)  url.searchParams.set('postal', postal)
    url.searchParams.set('ctry', country || 'US')
    url.searchParams.set('t', `tess-buddy-${Date.now()}`)

    const response = await fetch(url.toString(), { method: 'GET' })
    const text = await response.text()

    res.setHeader('Content-Type', 'application/json')
    res.status(response.status).send(text || '{}')
  } catch (err) {
    console.error('melissa-address proxy error:', err)
    res.status(500).json({ error: err.message })
  }
}

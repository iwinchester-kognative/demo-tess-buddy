// Dedicated proxy for creating Tessitura lists.
// Sends the request as XML to avoid WAF (Incapsula) blocking SQL keywords
// in JSON bodies. Tessitura's REST API accepts application/xml natively.

function escapeXml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function buildListXml(body) {
  // Build XML matching Tessitura's List schema
  return `<?xml version="1.0" encoding="utf-8"?>
<List xmlns:i="http://www.w3.org/2001/XMLSchema-instance">
  <Description>${escapeXml(body.Description || '')}</Description>
  <Category><Id>${Number(body.Category?.Id) || 0}</Id></Category>
  <ControlGroup><Id>${Number(body.ControlGroup?.Id) || -1}</Id></ControlGroup>
  <EditMode>${escapeXml(body.EditMode || 'Y')}</EditMode>
  <ListSql>${escapeXml(body.ListSql || '')}</ListSql>
  <IsDynamic>${body.IsDynamic ? 'true' : 'false'}</IsDynamic>
  <TMSIndicator>${body.TMSIndicator ? 'true' : 'false'}</TMSIndicator>
  <AnalyticsIndicator>${body.AnalyticsIndicator ? 'true' : 'false'}</AnalyticsIndicator>
  <Inactive>${body.Inactive ? 'true' : 'false'}</Inactive>
  <Generate>${body.Generate ? 'true' : 'false'}</Generate>
</List>`
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const authString = req.headers['x-tessitura-auth']
  const baseUrl = req.headers['x-tessitura-url']

  if (!authString || !baseUrl) {
    return res.status(400).json({ error: 'Missing auth or URL headers' })
  }

  try {
    const encoded = Buffer.from(authString).toString('base64')
    const xmlBody = buildListXml(req.body)

    console.log('Creating list via XML, endpoint:', `${baseUrl}Reporting/Lists`)

    const response = await fetch(`${baseUrl}Reporting/Lists`, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${encoded}`,
        'Content-Type': 'application/xml',
        'Accept': 'application/json',
        'User-Agent': 'TessBuddy/1.0'
      },
      body: xmlBody
    })

    const text = await response.text()

    if (!response.ok) {
      console.error('Tessitura create-list error:', response.status, text.slice(0, 500))
    }

    res.setHeader('Content-Type', 'application/json')
    res.status(response.status).send(text || '{}')
  } catch (err) {
    console.error('create-list proxy error:', err)
    res.status(500).json({ error: err.message })
  }
}

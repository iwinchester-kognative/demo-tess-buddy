export default async function handler(req, res) {
  const endpoint = req.query.endpoint
  const authString = req.headers['x-tessitura-auth']
  const baseUrl = req.headers['x-tessitura-url']

  try {
    const encoded = Buffer.from(authString).toString('base64')

    const response = await fetch(`${baseUrl}${endpoint}`, {
      method: req.method,
      headers: {
        'Authorization': `Basic ${encoded}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'User-Agent': 'TessBuddy/1.0'
      },
      body: req.method !== 'GET' ? JSON.stringify(req.body) : undefined
    })

    const text = await response.text()

    res.setHeader('Content-Type', 'application/json')
    res.status(response.status).send(text || '{}')
  } catch (err) {
    console.error('proxy error:', err)
    res.status(500).json({ error: err.message })
  }
}
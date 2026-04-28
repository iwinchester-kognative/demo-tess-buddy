import fs from 'fs'
import path from 'path'

// Map of contextId → file path (relative to project root)
const CONTEXT_FILES = {
  segments: 'contexts/segments.md'
  // Future context files:
  // donations: 'contexts/donations.md',
  // events:    'contexts/events.md',
}

// Cache loaded file contents in memory so we don't re-read on every request
const fileCache = {}

function loadContextFile(contextId) {
  if (fileCache[contextId]) return fileCache[contextId]

  const relativePath = CONTEXT_FILES[contextId]
  if (!relativePath) return null

  // Vercel compiles ESM → CJS, so import.meta.url breaks at runtime.
  // Use __dirname (available in CJS) and process.cwd() as fallbacks.
  // With vercel.json includeFiles the context file lands next to the
  // compiled function, so __dirname/../contexts/... should resolve.
  const candidates = [
    path.join(process.cwd(), relativePath),
    path.resolve(relativePath)
  ]

  // __dirname is available when Vercel compiles ESM to CJS
  try {
    if (typeof __dirname !== 'undefined') {
      candidates.unshift(path.resolve(__dirname, '..', relativePath))
      candidates.push(path.resolve(__dirname, relativePath))
    }
  } catch {}

  for (const fullPath of candidates) {
    try {
      const content = fs.readFileSync(fullPath, 'utf-8')
      fileCache[contextId] = content
      console.log(`Loaded context "${contextId}" from: ${fullPath}`)
      return content
    } catch {
      // Try next candidate
    }
  }

  console.error(`Failed to load context file for "${contextId}". Tried:`, candidates)
  return null
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const apiKey = process.env.ANTHROPIC_API_KEY || process.env.REACT_APP_ANTHROPIC_KEY

  if (!apiKey) {
    return res.status(500).json({ error: 'Anthropic API key not configured' })
  }

  try {
    const {
      contextId,           // e.g. "segments" — loads from /contexts/segments.md
      systemPrompt,        // fallback: raw system prompt string (used by API test)
      userMessage,
      conversationHistory = []
    } = req.body

    // Resolve the system prompt: contextId takes priority, then raw systemPrompt
    let resolvedPrompt = systemPrompt || ''
    if (contextId) {
      const loaded = loadContextFile(contextId)
      if (loaded) {
        resolvedPrompt = loaded
      } else {
        return res.status(400).json({ error: `Could not load context file for "${contextId}". Check Vercel function logs.` })
      }
    }

    if (!resolvedPrompt) {
      return res.status(400).json({ error: 'No system prompt or contextId provided' })
    }

    const messages = [
      ...conversationHistory,
      { role: 'user', content: userMessage }
    ]

    // Build the system prompt with prompt caching.
    // When using contextId, we mark the context file content as cacheable.
    // Claude caches it for ~5 minutes — subsequent calls reuse the cache at
    // ~10% of the input token cost and ~80% faster latency.
    const systemPayload = contextId
      ? [
          {
            type: 'text',
            text: resolvedPrompt,
            cache_control: { type: 'ephemeral' }
          }
        ]
      : resolvedPrompt  // plain string for simple prompts (API test, etc.)

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 4096,
        system: systemPayload,
        messages
      })
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('Claude API error:', errorText)
      return res.status(response.status).json({ error: errorText })
    }

    const data = await response.json()
    res.status(200).json(data)
  } catch (err) {
    console.error('Claude proxy error:', err)
    res.status(500).json({ error: err.message })
  }
}

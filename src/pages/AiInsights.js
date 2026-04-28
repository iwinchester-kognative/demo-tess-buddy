import React, { useState, useRef, useEffect } from 'react'

// ─── Fake AI responses ────────────────────────────────────────────────────────
// Each template is returned in sequence. First message is always the disclaimer.

const DISCLAIMER = `Heads up: I'm running in demo mode, which means I have no idea what your actual numbers are. I'm essentially a Magic 8-Ball with a finance degree. That said, I will absolutely make up something that looks deeply plausible. What would you like to know?`

const INSIGHT_TEMPLATES = [
  {
    question: 'How are ticket sales trending vs last year?',
    answer: `📈 **Ticket sales are up 6.2% vs this point in FY24.**

Through Week 14, cumulative revenue sits at $2,742,100 — compared to $2,581,300 at the same point last year.

**Key drivers:**
• Subscription revenue: +7.9% ($1,184,300 vs $1,097,600)
• Avg ticket value: $94.20 vs $88.50 prior year (+6.4%)
• Week 14 alone: $160,700 vs $107,100 — a standout week

**Watch:** Transaction volume is essentially flat (-0.2%), meaning growth is coming from higher per-ticket prices, not more buyers. That's a risk if your subscriber base ages out.`,
  },
  {
    question: 'Who are my biggest donors this season?',
    answer: `🏆 **Top 10 donors, FY25 YTD:**

| # | Constituent | Cumulative Gift |
|---|---|---|
| 1 | Harrison, Nathaniel | $42,100 |
| 2 | Abbott, Claire L. | $14,200 |
| 3 | Wentworth, James | $12,500 |
| 4 | Chen, Wei | $8,400 |
| 5 | Kim, Susan Y. | $7,800 |
| 6 | Martinez, Carlos E. | $6,200 |
| 7 | Langford, Patricia | $5,900 |
| 8 | Ivanova, Katya | $5,100 |
| 9 | Davidson, Elaine M. | $4,700 |
| 10 | Fletcher, James R. | $4,200 |

**Note:** Nathaniel Harrison's $42,100 represents a $12,000 increase over his FY24 total. Would you like me to flag him for a major gift conversation?`,
  },
  {
    question: 'What\'s my subscription renewal rate?',
    answer: `🔄 **Subscription renewal rate: 84.2%** (up from 82.1% in FY24)

**By tier:**
• Premium subscribers: 91.4% renewal
• Standard subscribers: 83.7% renewal
• Single-series packages: 76.2% renewal

**4,218 active subscribers** as of Week 14.

**At risk:** 312 subscribers in their 2nd year who haven't renewed for FY26 yet. This cohort historically churns at 31% — I'd recommend a targeted re-engagement push before the early renewal window closes.

**First-year renewals** are your biggest challenge at 68.4%. Patrons who renew once are much stickier (87%+ thereafter).`,
  },
  {
    question: 'Show me week-over-week pacing',
    answer: `📊 **Last 5 weeks — FY25 vs FY24:**

| Week | FY25 Revenue | FY24 Revenue | Change |
|---|---|---|---|
| W14 (current) | $160,700 | $107,100 | **+50.0%** |
| W13 | $142,700 | $132,400 | +7.8% |
| W12 | $157,500 | $159,600 | -1.3% |
| W11 | $141,800 | $168,400 | **-15.8%** |
| W10 | $212,300 | $190,500 | +11.4% |

The W11 dip (-15.8%) aligns with a mid-week scheduling gap in the calendar — nothing alarming. The W14 spike is partly attributed to a late subscription renewal push and an email campaign that went out on Tuesday.

Overall pacing model projects **$3.18M** for the full season (+7.2% vs FY24 final).`,
  },
  {
    question: 'Which performances are selling best?',
    answer: `🎭 **Top 5 performances by ticket revenue, FY25:**

| # | Performance | Revenue | % Capacity |
|---|---|---|---|
| 1 | Opening Night Gala | $284,100 | 98% |
| 2 | Chamber Music Finale | $198,400 | 94% |
| 3 | The Tempest (Fri) | $174,200 | 91% |
| 4 | Jazz at the Cistern | $162,800 | 89% |
| 5 | World Music Evening | $148,300 | 87% |

**Underperforming:** Tuesday matinees are averaging 61% capacity — compared to 78% for evening performances. Consider bundling Tuesday tickets with a post-show reception to drive uptake.

**Waitlisted:** Opening Night has 47 people on a waitlist. You may want to add a second performance date.`,
  },
  {
    question: 'What\'s driving new donor acquisition?',
    answer: `🌱 **New donor acquisition — FY25 YTD: 847 donors** (+12.3% vs FY24)

**By source:**
• Online giving page (organic): 287 donors (34%)
• Opening Gala ask: 88 donors (10%)
• Email appeals: 94 donors (11%)
• Ticket buyer conversion: 341 donors (40%)
• Other / unknown: 37 donors (4%)

The biggest story is **ticket-buyer-to-donor conversion** — 341 first-time ticket buyers made their first gift in FY25. That's up from 241 in FY24 (+41.5%).

**Avg first gift: $84.** Your best first gifts are coming from Opening Night attendees ($340 avg), suggesting event-based cultivation is working. Would you like me to build a segment of ticket buyers who haven't donated yet?`,
  },
]

let _insightIdx = 0

async function fakeInsightResponse(userMessage) {
  await new Promise(r => setTimeout(r, 1600 + Math.random() * 800))

  if (_insightIdx === 0) {
    _insightIdx++
    return DISCLAIMER
  }

  const template = INSIGHT_TEMPLATES[(_insightIdx - 1) % INSIGHT_TEMPLATES.length]
  _insightIdx++
  return template.answer
}

// ─── Simple markdown-ish renderer ────────────────────────────────────────────

function renderAnswer(text) {
  const lines = text.split('\n')
  return lines.map((line, i) => {
    // Table rows
    if (line.startsWith('|')) {
      const cells = line.split('|').filter(c => c.trim() !== '')
      const isHeader = lines[i + 1] && lines[i + 1].startsWith('|---')
      const isSeparator = /^\|[-| ]+\|$/.test(line)
      if (isSeparator) return null
      return (
        <tr key={i} style={{ borderBottom: '1px solid #f0f4f8' }}>
          {cells.map((cell, j) => {
            const Tag = isHeader ? 'th' : 'td'
            return (
              <Tag key={j} style={{
                padding: '6px 10px', textAlign: 'left',
                fontSize: '12px', fontFamily: "'Inter', sans-serif",
                fontWeight: isHeader ? '700' : '400',
                color: isHeader ? '#6b7280' : '#374151',
                background: isHeader ? '#f8fafd' : 'transparent',
              }} dangerouslySetInnerHTML={{ __html: cell.trim().replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>') }} />
            )
          })}
        </tr>
      )
    }
    return null
  }).some(x => x !== null) ? (
    // Has table rows — wrap them
    <div key="table" style={{ overflowX: 'auto', margin: '8px 0' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid rgba(29,111,219,0.12)', borderRadius: '8px', overflow: 'hidden' }}>
        <tbody>
          {lines.map((line, i) => {
            if (!line.startsWith('|')) return null
            const isSeparator = /^\|[-| ]+\|$/.test(line)
            if (isSeparator) return null
            const cells = line.split('|').filter(c => c.trim() !== '')
            const isHeader = lines[i + 1] && lines[i + 1].startsWith('|---')
            return (
              <tr key={i} style={{ borderBottom: '1px solid #f0f4f8' }}>
                {cells.map((cell, j) => {
                  const Tag = isHeader ? 'th' : 'td'
                  return (
                    <Tag key={j} style={{
                      padding: '6px 10px', textAlign: 'left',
                      fontSize: '12px', fontFamily: "'Inter', sans-serif",
                      fontWeight: isHeader ? '700' : '400',
                      color: isHeader ? '#6b7280' : '#374151',
                      background: isHeader ? '#f8fafd' : 'transparent',
                    }} dangerouslySetInnerHTML={{ __html: cell.trim().replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>') }} />
                  )
                })}
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  ) : (
    // Plain lines
    <div>
      {lines.map((line, i) => {
        if (!line.trim()) return <br key={i} />
        const html = line
          .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
          .replace(/^• /, '&bull; ')
        return (
          <p key={i} style={{ margin: '0 0 4px', fontSize: '13px', lineHeight: '1.65', fontFamily: "'Inter', sans-serif", color: '#374151' }}
            dangerouslySetInnerHTML={{ __html: html }} />
        )
      })}
    </div>
  )
}

// ─── Suggested questions ───────────────────────────────────────────────────────

const SUGGESTIONS = [
  'How are ticket sales trending vs last year?',
  'Who are my biggest donors this season?',
  'What\'s my subscription renewal rate?',
  'Which performances are selling best?',
]

// ─── Main component ───────────────────────────────────────────────────────────

function AiInsights() {
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const bottomRef = useRef(null)
  const textareaRef = useRef(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  const sendMessage = async (text) => {
    const userText = (text || input).trim()
    if (!userText || loading) return

    setInput('')
    setMessages(prev => [...prev, { role: 'user', text: userText }])
    setLoading(true)

    try {
      const response = await fakeInsightResponse(userText)
      setMessages(prev => [...prev, { role: 'assistant', text: response }])
    } catch {
      setMessages(prev => [...prev, { role: 'assistant', text: 'Something went wrong. Try again.' }])
    }
    setLoading(false)
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  const isEmpty = messages.length === 0

  return (
    <div>
      <div style={s.header}>
        <h1 style={s.title}>AI Insights</h1>
        <p style={s.subtitle}>Ask anything about your season performance, donor trends, or sales figures — in plain English.</p>
      </div>

      <div style={s.panel}>
        <div style={s.chatWrapper}>
          <div style={s.chatMessages}>
            {isEmpty && (
              <div style={s.emptyState}>
                <div style={s.emptyIcon}>💬</div>
                <p style={s.emptyTitle}>Ask a question about your data</p>
                <p style={s.emptyHint}>Sales pacing, donor trends, subscription rates, top performances — just ask.</p>
                <div style={s.suggestions}>
                  {SUGGESTIONS.map((q, i) => (
                    <button
                      key={i}
                      onClick={() => sendMessage(q)}
                      style={s.suggestionBtn}
                    >
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((msg, i) => (
              <div key={i} style={msg.role === 'user' ? s.userRow : s.assistantRow}>
                {msg.role === 'user' ? (
                  <div style={{ ...s.bubble, ...s.userBubble }}>
                    <p style={s.bubbleText}>{msg.text}</p>
                  </div>
                ) : (
                  <div style={{ ...s.bubble, ...s.assistantBubble }}>
                    {renderAnswer(msg.text)}
                  </div>
                )}
              </div>
            ))}

            {loading && (
              <div style={s.assistantRow}>
                <div style={{ ...s.bubble, ...s.assistantBubble }}>
                  <div style={s.typing}>
                    <span style={s.dot}>●</span>
                    <span style={{ ...s.dot, animationDelay: '0.2s' }}>●</span>
                    <span style={{ ...s.dot, animationDelay: '0.4s' }}>●</span>
                  </div>
                </div>
              </div>
            )}

            <div ref={bottomRef} />
          </div>

          <div style={s.inputArea}>
            <textarea
              ref={textareaRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask about your sales, donors, or performance trends…"
              style={s.chatInput}
              rows={1}
              disabled={loading}
            />
            <button
              onClick={() => sendMessage()}
              disabled={!input.trim() || loading}
              style={{
                ...s.sendBtn,
                ...((!input.trim() || loading) ? s.sendBtnDisabled : {}),
              }}
            >
              ↑
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = {
  header: { marginBottom: '24px' },
  title: { fontSize: '24px', fontWeight: '700', color: '#0c1a33', marginBottom: '4px', fontFamily: "'Space Grotesk', sans-serif", letterSpacing: '-0.02em' },
  subtitle: { fontSize: '13px', color: '#4b5563', fontFamily: "'Inter', sans-serif", maxWidth: '560px', lineHeight: '1.6' },

  panel: {
    backgroundColor: 'white', borderRadius: '12px', padding: '20px',
    boxShadow: '0 2px 16px rgba(29,111,219,0.08)', border: '1px solid rgba(29,111,219,0.1)',
    maxWidth: '760px',
  },

  chatWrapper: { display: 'flex', flexDirection: 'column', height: '520px' },

  chatMessages: {
    flex: 1, overflowY: 'auto', padding: '14px 16px',
    display: 'flex', flexDirection: 'column', gap: '10px',
    backgroundColor: '#fafbfd', borderRadius: '10px',
    border: '1px solid rgba(29,111,219,0.1)', marginBottom: '10px',
  },

  emptyState: {
    flex: 1, display: 'flex', flexDirection: 'column',
    alignItems: 'center', justifyContent: 'center',
    color: '#9ca3af', textAlign: 'center', padding: '20px',
  },
  emptyIcon: { fontSize: '24px', color: '#c7d9f5', marginBottom: '8px' },
  emptyTitle: { fontSize: '13px', fontWeight: '600', color: '#9ca3af', marginBottom: '4px', fontFamily: "'Inter', sans-serif" },
  emptyHint: { fontSize: '12px', color: '#b0bac7', lineHeight: '1.5', maxWidth: '320px', fontFamily: "'Inter', sans-serif", marginBottom: '16px' },

  suggestions: { display: 'flex', flexDirection: 'column', gap: '6px', width: '100%', maxWidth: '460px' },
  suggestionBtn: {
    padding: '8px 14px', background: 'rgba(29,111,219,0.06)', border: '1px solid rgba(29,111,219,0.15)',
    borderRadius: '8px', fontSize: '12px', color: '#1d6fdb', fontFamily: "'Inter', sans-serif",
    cursor: 'pointer', textAlign: 'left', fontWeight: '500',
  },

  userRow: { display: 'flex', justifyContent: 'flex-end' },
  assistantRow: { display: 'flex', justifyContent: 'flex-start' },

  bubble: { maxWidth: '85%', padding: '10px 14px', borderRadius: '10px', fontSize: '13px', lineHeight: '1.6', border: '1px solid #edf0f5' },
  userBubble: { backgroundColor: '#1d6fdb', color: 'white', border: 'none', boxShadow: '0 1px 4px rgba(29,111,219,0.25)' },
  assistantBubble: { backgroundColor: 'white', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' },
  bubbleText: { margin: 0, whiteSpace: 'pre-wrap', fontFamily: "'Inter', sans-serif" },

  typing: { display: 'flex', gap: '4px', padding: '2px 0' },
  dot: { fontSize: '8px', color: '#9ca3af', animation: 'blink 1.4s infinite both', fontFamily: 'monospace' },

  inputArea: {
    display: 'flex', alignItems: 'flex-end', gap: '8px',
    padding: '8px 0 0',
  },
  chatInput: {
    flex: 1, padding: '9px 13px', border: '1px solid rgba(29,111,219,0.18)',
    borderRadius: '8px', fontSize: '13px', fontFamily: "'Inter', sans-serif",
    resize: 'none', outline: 'none', lineHeight: '1.5', maxHeight: '100px',
    backgroundColor: '#fafbfd',
  },
  sendBtn: {
    width: '34px', height: '34px', borderRadius: '8px',
    backgroundColor: '#1d6fdb', color: 'white', border: 'none',
    fontSize: '16px', fontWeight: '700', cursor: 'pointer',
    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  sendBtnDisabled: { backgroundColor: '#d1d9e6', cursor: 'not-allowed' },
}

// Inject blink keyframe once
const _styleTag = document.createElement('style')
_styleTag.textContent = `@keyframes blink { 0%, 80%, 100% { opacity: 0.3; } 40% { opacity: 1; } }`
document.head.appendChild(_styleTag)

export default AiInsights

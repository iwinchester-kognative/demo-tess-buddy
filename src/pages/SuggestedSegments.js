import React, { useState, useCallback } from 'react'

// ─── Full pool of possible suggestions ───────────────────────────────────────
// Refresh picks 6 at random from this pool each time.

const SEGMENT_POOL = [
  {
    id: 1, icon: '📉', tag: 'Lapsed Donors',
    name: 'The "We Miss You" List',
    description: 'Donors who gave between $100–$999 in FY22 or FY23 but have made no gift since. High recapture potential based on giving history.',
    est: '1,284', confidence: 'High',
    sql: `SELECT c.customer_no, c.sort_name, MAX(g.gift_dt) AS last_gift_dt\nFROM t_customer c\nJOIN t_gift g ON g.customer_no = c.customer_no\nWHERE g.gift_dt < DATEADD(year,-1,GETDATE())\n  AND g.gift_amount BETWEEN 100 AND 999\n  AND NOT EXISTS (\n    SELECT 1 FROM t_gift g2\n    WHERE g2.customer_no = c.customer_no\n      AND g2.gift_dt >= DATEADD(year,-1,GETDATE())\n  )\nGROUP BY c.customer_no, c.sort_name`,
  },
  {
    id: 2, icon: '🎟️', tag: 'Upgrade Prospects',
    name: 'Season Ticket Holders, No Gift on File',
    description: 'Subscribers who have renewed at least twice but have never made an outright donation. Your lowest-hanging major gift fruit.',
    est: '412', confidence: 'High',
    sql: `SELECT DISTINCT c.customer_no, c.sort_name\nFROM t_customer c\nJOIN t_sub s ON s.customer_no = c.customer_no\nWHERE s.sub_count >= 2\n  AND NOT EXISTS (\n    SELECT 1 FROM t_gift g WHERE g.customer_no = c.customer_no\n  )`,
  },
  {
    id: 3, icon: '🌱', tag: 'First-Time Buyers',
    name: 'New Faces — No Follow-Up Yet',
    description: 'Patrons who purchased tickets for the first time in the current or prior season and have received no cultivation contact since.',
    est: '2,108', confidence: 'Medium',
    sql: `SELECT c.customer_no, c.sort_name, MIN(o.order_dt) AS first_purchase\nFROM t_customer c\nJOIN t_order o ON o.customer_no = c.customer_no\nWHERE o.order_dt >= DATEADD(year,-2,GETDATE())\nGROUP BY c.customer_no, c.sort_name\nHAVING MAX(o.order_dt) < DATEADD(month,-3,GETDATE())`,
  },
  {
    id: 4, icon: '🏆', tag: 'Major Gift',
    name: 'Cumulative $5K+ — No Current Ask',
    description: 'Constituents whose cumulative lifetime giving exceeds $5,000 but who are not currently in an active major gift solicitation.',
    est: '88', confidence: 'High',
    sql: `SELECT c.customer_no, c.sort_name, SUM(g.gift_amount) AS lifetime_giving\nFROM t_customer c\nJOIN t_gift g ON g.customer_no = c.customer_no\nGROUP BY c.customer_no, c.sort_name\nHAVING SUM(g.gift_amount) >= 5000`,
  },
  {
    id: 5, icon: '🔁', tag: 'Reactivation',
    name: 'Ticket Buyers Gone Dark (3+ Years)',
    description: "Patrons with 5 or more past transactions who haven't purchased in 3 or more years. Strong attendance history makes them worthwhile to re-engage.",
    est: '3,741', confidence: 'Medium',
    sql: `SELECT c.customer_no, c.sort_name, COUNT(o.id) AS order_count\nFROM t_customer c\nJOIN t_order o ON o.customer_no = c.customer_no\nGROUP BY c.customer_no, c.sort_name\nHAVING COUNT(o.id) >= 5\n  AND MAX(o.order_dt) < DATEADD(year,-3,GETDATE())`,
  },
  {
    id: 6, icon: '📬', tag: 'Email Reachout',
    name: 'Valid Email, No Open in 18 Months',
    description: "Constituents with a verified email address who haven't opened a campaign email in the past 18 months. Good list for a re-permission campaign.",
    est: '5,902', confidence: 'Medium',
    sql: `SELECT c.customer_no, c.sort_name, c.email_address\nFROM t_customer c\nWHERE c.email_address IS NOT NULL\n  AND c.email_status = 'A'\n  AND (c.last_email_open_dt IS NULL\n    OR c.last_email_open_dt < DATEADD(month,-18,GETDATE()))`,
  },
  {
    id: 7, icon: '💍', tag: 'Major Gift',
    name: 'Mid-Level to Major Pipeline',
    description: 'Donors who gave $1,000–$4,999 last year and have at least 3 prior years of giving. Likely ready for a personal solicitation at the major level.',
    est: '147', confidence: 'High',
    sql: `SELECT c.customer_no, c.sort_name, SUM(g.gift_amount) AS last_yr_giving\nFROM t_customer c\nJOIN t_gift g ON g.customer_no = c.customer_no\nWHERE g.gift_dt >= DATEADD(year,-1,GETDATE())\nGROUP BY c.customer_no, c.sort_name\nHAVING SUM(g.gift_amount) BETWEEN 1000 AND 4999\n  AND (SELECT COUNT(DISTINCT YEAR(g2.gift_dt)) FROM t_gift g2 WHERE g2.customer_no = c.customer_no) >= 3`,
  },
  {
    id: 8, icon: '🎓', tag: 'First-Time Buyers',
    name: 'Student Rush Alumni — Now Adults',
    description: 'Patrons who first purchased as students (discounted tickets) 3–8 years ago and have since upgraded to full-price tickets.',
    est: '634', confidence: 'Medium',
    sql: `SELECT c.customer_no, c.sort_name\nFROM t_customer c\nWHERE EXISTS (\n  SELECT 1 FROM t_order o JOIN t_order_item oi ON oi.order_id = o.id\n  WHERE o.customer_no = c.customer_no\n    AND oi.price_type = 'STU'\n    AND o.order_dt < DATEADD(year,-3,GETDATE())\n)\nAND EXISTS (\n  SELECT 1 FROM t_order o2\n  WHERE o2.customer_no = c.customer_no\n    AND o2.order_dt >= DATEADD(year,-1,GETDATE())\n)`,
  },
  {
    id: 9, icon: '🌍', tag: 'Reactivation',
    name: 'Out-of-Town Loyalists',
    description: 'Patrons with a non-local zip code who attended 3+ events before 2020 but have not purchased since. Worth a targeted travel-friendly offer.',
    est: '892', confidence: 'Low',
    sql: `SELECT c.customer_no, c.sort_name, c.zip\nFROM t_customer c\nWHERE c.state <> 'SC'\n  AND (SELECT COUNT(*) FROM t_order o WHERE o.customer_no = c.customer_no AND o.order_dt < '2020-01-01') >= 3\n  AND NOT EXISTS (\n    SELECT 1 FROM t_order o2 WHERE o2.customer_no = c.customer_no AND o2.order_dt >= '2020-01-01'\n  )`,
  },
  {
    id: 10, icon: '🤝', tag: 'Upgrade Prospects',
    name: 'Single-Event Loyalists — Never Subscribed',
    description: 'Patrons who have attended the same event type (e.g. chamber music) 4+ times across seasons but have never bought a subscription.',
    est: '527', confidence: 'High',
    sql: `SELECT c.customer_no, c.sort_name, COUNT(*) AS event_count\nFROM t_customer c\nJOIN t_order o ON o.customer_no = c.customer_no\nJOIN t_order_item oi ON oi.order_id = o.id\nWHERE oi.event_type = 'CHAMBER'\n  AND NOT EXISTS (SELECT 1 FROM t_sub s WHERE s.customer_no = c.customer_no)\nGROUP BY c.customer_no, c.sort_name\nHAVING COUNT(*) >= 4`,
  },
  {
    id: 11, icon: '📞', tag: 'Lapsed Donors',
    name: 'Phonathon Donors Who Went Quiet',
    description: 'Donors whose only gifts on record came via phonathon source codes, with no gift in 2+ years. Phone outreach may be the right channel again.',
    est: '318', confidence: 'Medium',
    sql: `SELECT c.customer_no, c.sort_name, MAX(g.gift_dt) AS last_gift\nFROM t_customer c\nJOIN t_gift g ON g.customer_no = c.customer_no\nWHERE g.source_code LIKE 'PHONE%'\nGROUP BY c.customer_no, c.sort_name\nHAVING MAX(g.gift_dt) < DATEADD(year,-2,GETDATE())`,
  },
  {
    id: 12, icon: '🎁', tag: 'Email Reachout',
    name: 'Opted In, Never Donated',
    description: 'Constituents who opted into marketing emails but have zero gift history. A nurture sequence could convert a portion to first-time donors.',
    est: '4,211', confidence: 'Medium',
    sql: `SELECT c.customer_no, c.sort_name, c.email_address\nFROM t_customer c\nWHERE c.email_status = 'A'\n  AND c.email_address IS NOT NULL\n  AND NOT EXISTS (SELECT 1 FROM t_gift g WHERE g.customer_no = c.customer_no)`,
  },
]

const TAG_COLORS = {
  'Lapsed Donors':    '#9333ea',
  'Upgrade Prospects':'#0369a1',
  'First-Time Buyers':'#16a34a',
  'Major Gift':       '#b45309',
  'Reactivation':     '#1d6fdb',
  'Email Reachout':   '#0891b2',
}

function shuffle(arr) {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

function pick6() {
  return shuffle(SEGMENT_POOL).slice(0, 6)
}

// ─── Tag chip ─────────────────────────────────────────────────────────────────

function TagChip({ label }) {
  const color = TAG_COLORS[label] || '#1d6fdb'
  return (
    <span style={{
      display: 'inline-block', padding: '2px 8px', borderRadius: '100px',
      fontSize: '10px', fontWeight: '700', letterSpacing: '0.04em', textTransform: 'uppercase',
      background: color + '18', color, fontFamily: "'Inter', sans-serif",
    }}>{label}</span>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

function SuggestedSegments() {
  const [segments, setSegments] = useState(() => pick6())
  const [expanded, setExpanded] = useState(null)
  const [building, setBuilding] = useState(null)
  const [built, setBuilt] = useState({})
  const [refreshing, setRefreshing] = useState(false)

  const handleRefresh = useCallback(async () => {
    setRefreshing(true)
    setExpanded(null)
    await new Promise(r => setTimeout(r, 700))
    setSegments(pick6())
    setRefreshing(false)
  }, [])

  const handleBuild = async (seg) => {
    setBuilding(seg.id)
    await new Promise(r => setTimeout(r, 1400))
    setBuilding(null)
    setBuilt(prev => ({ ...prev, [seg.id]: true }))
  }

  return (
    <div>
      {/* Header */}
      <div style={s.header}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '16px', flexWrap: 'wrap' }}>
          <div>
            <h1 style={s.title}>Suggested Segments</h1>
            <p style={s.subtitle}>
              Auto-surfaced audiences based on your patron database patterns. Each one is ready to build in one click.
            </p>
          </div>
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            style={{
              display: 'flex', alignItems: 'center', gap: '6px',
              padding: '8px 16px', border: '1px solid rgba(29,111,219,0.25)',
              borderRadius: '8px', background: 'white', color: '#1d6fdb',
              fontSize: '13px', fontWeight: '600', fontFamily: "'Inter', sans-serif",
              cursor: refreshing ? 'not-allowed' : 'pointer',
              opacity: refreshing ? 0.6 : 1,
              boxShadow: '0 1px 4px rgba(29,111,219,0.08)',
            }}
          >
            <span style={{ display: 'inline-block', transform: refreshing ? 'rotate(360deg)' : 'none', transition: refreshing ? 'transform 0.7s linear' : 'none' }}>↻</span>
            {refreshing ? 'Refreshing…' : 'Refresh Suggestions'}
          </button>
        </div>
      </div>

      {/* Cards grid */}
      <div style={s.grid}>
        {segments.map(seg => {
          const isExp  = expanded === seg.id
          const isDone = built[seg.id]
          const isBldg = building === seg.id
          const tagColor = TAG_COLORS[seg.tag] || '#1d6fdb'

          return (
            <div
              key={seg.id}
              style={{
                background: 'white', borderRadius: '12px',
                border: `1px solid ${isExp ? 'rgba(29,111,219,0.28)' : 'rgba(29,111,219,0.1)'}`,
                boxShadow: isExp ? '0 4px 20px rgba(29,111,219,0.12)' : '0 2px 8px rgba(29,111,219,0.06)',
                overflow: 'hidden', transition: 'box-shadow 0.15s, border-color 0.15s',
              }}
            >
              {/* Card header */}
              <div style={{ padding: '16px 18px', cursor: 'pointer' }} onClick={() => setExpanded(isExp ? null : seg.id)}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '8px', marginBottom: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '18px' }}>{seg.icon}</span>
                    <TagChip label={seg.tag} />
                  </div>
                  <span style={{ fontSize: '11px', color: '#9ca3af', fontFamily: "'Inter', sans-serif", marginTop: '2px', flexShrink: 0 }}>
                    {isExp ? '▲ Less' : '▼ Preview'}
                  </span>
                </div>
                <p style={{ fontSize: '13px', fontWeight: '700', color: '#0c1a33', margin: '0 0 6px', fontFamily: "'Space Grotesk', sans-serif" }}>{seg.name}</p>
                <p style={{ fontSize: '12px', color: '#6b7280', margin: 0, lineHeight: '1.55', fontFamily: "'Inter', sans-serif" }}>{seg.description}</p>
              </div>

              {/* SQL preview */}
              {isExp && (
                <div style={{ borderTop: '1px solid rgba(29,111,219,0.1)', padding: '12px 18px', background: '#f8fafd' }}>
                  <p style={{ fontSize: '10px', fontWeight: '700', letterSpacing: '0.06em', textTransform: 'uppercase', color: '#9ca3af', marginBottom: '6px', fontFamily: "'Inter', sans-serif" }}>
                    Generated SQL
                  </p>
                  <pre style={{ fontSize: '11px', color: '#374151', background: '#f0f4fa', borderRadius: '6px', padding: '10px 12px', margin: 0, overflowX: 'auto', fontFamily: "ui-monospace, 'Cascadia Code', monospace", lineHeight: '1.6', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                    {seg.sql}
                  </pre>
                </div>
              )}

              {/* Footer */}
              <div style={{ padding: '10px 18px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', gap: '12px' }}>
                  <span style={{ fontSize: '11px', color: '#9ca3af', fontFamily: "'Inter', sans-serif" }}>
                    ~<strong style={{ color: '#374151' }}>{seg.est}</strong> records
                  </span>
                  <span style={{ fontSize: '11px', fontFamily: "'Inter', sans-serif", color: seg.confidence === 'High' ? '#16a34a' : '#d97706' }}>
                    ● {seg.confidence} confidence
                  </span>
                </div>
                {isDone ? (
                  <span style={{ fontSize: '12px', fontWeight: '600', color: '#16a34a', fontFamily: "'Inter', sans-serif" }}>✓ Segment created</span>
                ) : (
                  <button
                    onClick={() => handleBuild(seg)}
                    disabled={!!isBldg}
                    style={{
                      padding: '6px 14px', border: 'none', borderRadius: '7px',
                      background: isBldg ? '#d1d9e6' : 'linear-gradient(135deg, #1d6fdb, #38bdf8)',
                      color: 'white', fontSize: '12px', fontWeight: '600',
                      fontFamily: "'Inter', sans-serif", cursor: isBldg ? 'not-allowed' : 'pointer',
                    }}
                  >
                    {isBldg ? 'Building…' : 'Build Segment'}
                  </button>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

const s = {
  header: { marginBottom: '24px' },
  title: { fontSize: '24px', fontWeight: '700', color: '#0c1a33', marginBottom: '4px', fontFamily: "'Space Grotesk', sans-serif", letterSpacing: '-0.02em' },
  subtitle: { fontSize: '13px', color: '#6b7280', fontFamily: "'Inter', sans-serif", lineHeight: '1.6', maxWidth: '560px' },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '14px', maxWidth: '960px' },
}

export default SuggestedSegments

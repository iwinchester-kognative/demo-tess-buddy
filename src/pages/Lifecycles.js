import React, { useState } from 'react'

// ─── Donor Lifecycle stages ───────────────────────────────────────────────────

const DONOR_STAGES = [
  {
    key: 'prospect',
    icon: '🔍',
    label: 'Prospect',
    color: '#64748b',
    count: '18,422',
    description: 'Patrons or constituents with no gift on record — ticket buyers, email subscribers, and event attendees who have never donated.',
    signal: 'Identified through ticket purchase history, event attendance, or email opt-in.',
    action: 'Introduce the mission. Cultivation ask under $100. Include in annual fund broad outreach.',
    metrics: ['18,422 total prospects', '62% have email on file', 'Avg. 1.8 ticket purchases'],
  },
  {
    key: 'firstgift',
    icon: '🌱',
    label: 'First Gift',
    color: '#16a34a',
    count: '3,104',
    description: 'Donors who have made exactly one gift, regardless of amount. The critical conversion moment — retention from here drops sharply.',
    signal: 'Single gift event. Watch for lapse risk within 90 days of first gift.',
    action: 'Send a personalized thank-you within 48 hrs. Invite to an insider event. Ask for a second gift within 6 months.',
    metrics: ['3,104 first-time donors', 'Avg. first gift: $87', '44% lapse after 1 year'],
  },
  {
    key: 'repeat',
    icon: '🔄',
    label: 'Repeat Donor',
    color: '#0369a1',
    count: '1,847',
    description: 'Donors with 2–4 gifts on record, cumulative giving under $500. Building a habit — the most important retention tier.',
    signal: 'Sequential giving pattern. Track year-over-year consistency.',
    action: 'Acknowledge giving streak. Offer a modest upgrade ask (+25%). Include in phonathon if lapse risk detected.',
    metrics: ['1,847 repeat donors', 'Avg. cumulative giving: $214', '71% multi-year retention'],
  },
  {
    key: 'midlevel',
    icon: '⭐',
    label: 'Mid-Level',
    color: '#b45309',
    count: '612',
    description: 'Donors with $500–$4,999 in cumulative lifetime giving. Often overlooked — the bridge between annual fund and major gifts.',
    signal: 'Consistent annual gifts. Attendance at premium events. Multiple years on file.',
    action: 'Assign a relationship manager. Invite to backstage or artist events. Solicit for named or endowed fund.',
    metrics: ['612 mid-level donors', 'Avg. annual gift: $620', '3.2 avg. years of giving'],
  },
  {
    key: 'major',
    icon: '🏆',
    label: 'Major Donor',
    color: '#7c3aed',
    count: '88',
    description: 'Donors with $5,000+ in cumulative giving or an individual gift of $2,500+. Personal relationship is the primary retention vehicle.',
    signal: 'Wealth screening confirms capacity. Active in gala/special events. Multi-year history.',
    action: 'Personal face-to-face solicitation. Naming opportunity conversations. Board or advisory committee invitation.',
    metrics: ['88 major donors', 'Avg. gift: $12,400', 'Avg. tenure: 7.1 years'],
  },
  {
    key: 'legacy',
    icon: '🌟',
    label: 'Planned / Legacy',
    color: '#0891b2',
    count: '24',
    description: 'Donors who have indicated or are suspected of including the organization in their estate plans. Highest lifetime value segment.',
    signal: 'Age 65+, long giving history, expressed interest in legacy, engaged with planned giving collateral.',
    action: 'Introduce to planned giving staff. Recognize in legacy society. Keep engaged through intimate cultivation events.',
    metrics: ['24 confirmed', 'Est. 80+ planned', 'Avg. age: 71'],
  },
]

// ─── Ticket Buyer Lifecycle stages ───────────────────────────────────────────

const TICKET_STAGES = [
  {
    key: 'newpatron',
    icon: '👋',
    label: 'New Patron',
    color: '#16a34a',
    count: '4,218',
    description: 'First-time ticket buyers this season. Highest churn risk — 60%+ will not return without intervention.',
    signal: 'Single-event purchase in current or prior season.',
    action: 'Welcome series email. Offer a season sampler discount. Invite to a free pre-show talk or reception.',
    metrics: ['4,218 this season', '1.1 avg. tickets purchased', '38% have donated'],
  },
  {
    key: 'casual',
    icon: '🎭',
    label: 'Casual Buyer',
    color: '#0369a1',
    count: '6,041',
    description: 'Patrons with 2–3 events across 1–2 seasons. Browsing phase — some will convert to regulars, most will not without a nudge.',
    signal: 'Non-sequential purchases, varies by genre or price point.',
    action: 'Curated recommendations based on past purchases. Introduce subscription concept. Offer a two-show bundle.',
    metrics: ['6,041 casual buyers', '2.2 avg. events/season', 'Avg. spend: $164/yr'],
  },
  {
    key: 'regular',
    icon: '🎵',
    label: 'Regular Attendee',
    color: '#b45309',
    count: '2,714',
    description: 'Patrons attending 4–6 events per season across multiple years. Loyal but not yet subscribed — an important conversion target.',
    signal: '3+ consecutive seasons with purchases. Strong genre preference.',
    action: 'Personalized subscription pitch with exact savings vs. single ticket cost. Highlight subscriber-only perks.',
    metrics: ['2,714 regulars', '4.7 avg. events/season', '61% multi-year'],
  },
  {
    key: 'subcandidate',
    icon: '💡',
    label: 'Sub Candidate',
    color: '#7c3aed',
    count: '892',
    description: 'High-frequency buyers who have never purchased a subscription. They are functionally subscribers — just paying more for the privilege.',
    signal: '5+ events in a season, 2+ consecutive seasons, no subscription record.',
    action: 'Direct outreach showing exact $ savings if they had subscribed. Limited-time upgrade offer.',
    metrics: ['892 candidates', 'Avg. 5.9 events/season', 'Pay ~28% more than subscribers'],
  },
  {
    key: 'subscriber',
    icon: '📋',
    label: 'Subscriber',
    color: '#1d6fdb',
    count: '1,384',
    description: 'Active subscription holders. The backbone of earned revenue. Renewal outreach timing is critical — most lapses happen in weeks 10–14 of renewal cycle.',
    signal: 'Active sub on file. Watch early-renewal vs. late-renewal behavior.',
    action: 'Early-bird renewal incentive at week 8. Personal call for 5+ year subscribers at risk of lapse.',
    metrics: ['1,384 active subs', 'Avg. sub value: $412', '74% annual renewal rate'],
  },
  {
    key: 'loyalsub',
    icon: '❤️',
    label: 'Loyal Subscriber',
    color: '#0891b2',
    count: '487',
    description: 'Subscribers with 3 or more consecutive renewals. Ultra-loyal — they identify as "regulars." The most cost-effective segment to retain.',
    signal: '3+ consecutive renewal years. Often first to renew. Likely to upgrade seating.',
    action: 'Premium appreciation event (dress rehearsal, artist dinner). Priority seating access. Ask for a gift alongside renewal.',
    metrics: ['487 loyal subs', 'Avg. tenure: 6.2 years', '91% renewal rate'],
  },
]

// ─── Stage card ───────────────────────────────────────────────────────────────

function StageCard({ stage, index, total, isActive, onClick }) {
  return (
    <div
      onClick={onClick}
      style={{
        cursor: 'pointer',
        background: 'white',
        borderRadius: '12px',
        border: `1px solid ${isActive ? stage.color + '60' : 'rgba(29,111,219,0.1)'}`,
        boxShadow: isActive ? `0 4px 20px ${stage.color}22` : '0 2px 8px rgba(29,111,219,0.06)',
        overflow: 'hidden',
        transition: 'box-shadow 0.15s, border-color 0.15s',
      }}
    >
      {/* Stage header */}
      <div style={{ padding: '16px 18px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '20px' }}>{stage.icon}</span>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ fontSize: '10px', fontWeight: '700', color: '#9ca3af', fontFamily: "'Inter', sans-serif", letterSpacing: '0.04em', textTransform: 'uppercase' }}>
                  Stage {index + 1} of {total}
                </span>
              </div>
              <p style={{ fontSize: '14px', fontWeight: '700', color: stage.color, margin: 0, fontFamily: "'Space Grotesk', sans-serif" }}>{stage.label}</p>
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <p style={{ fontSize: '20px', fontWeight: '800', color: '#0c1a33', margin: 0, fontFamily: "'Space Grotesk', sans-serif", lineHeight: 1 }}>{stage.count}</p>
            <p style={{ fontSize: '10px', color: '#9ca3af', margin: '2px 0 0', fontFamily: "'Inter', sans-serif" }}>constituents</p>
          </div>
        </div>

        <p style={{ fontSize: '12px', color: '#4b5563', lineHeight: '1.55', margin: 0, fontFamily: "'Inter', sans-serif" }}>
          {stage.description}
        </p>
      </div>

      {/* Expand indicator */}
      <div style={{ padding: '6px 18px 10px', display: 'flex', justifyContent: 'flex-end' }}>
        <span style={{ fontSize: '11px', color: '#9ca3af', fontFamily: "'Inter', sans-serif" }}>{isActive ? '▲ Less' : '▼ Details'}</span>
      </div>

      {/* Expanded detail */}
      {isActive && (
        <div style={{ borderTop: `1px solid ${stage.color}22`, background: '#f8fafd', padding: '16px 18px' }}>
          <div style={{ marginBottom: '14px' }}>
            <p style={detailLabel}>Signal</p>
            <p style={detailText}>{stage.signal}</p>
          </div>
          <div style={{ marginBottom: '14px' }}>
            <p style={detailLabel}>Recommended Action</p>
            <p style={detailText}>{stage.action}</p>
          </div>
          <div>
            <p style={detailLabel}>Key Metrics</p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
              {stage.metrics.map((m, i) => (
                <span key={i} style={{
                  background: stage.color + '12', color: stage.color,
                  border: `1px solid ${stage.color}30`, borderRadius: '100px',
                  padding: '3px 10px', fontSize: '11px', fontWeight: '600',
                  fontFamily: "'Inter', sans-serif",
                }}>
                  {m}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

const detailLabel = { fontSize: '10px', fontWeight: '700', letterSpacing: '0.06em', textTransform: 'uppercase', color: '#9ca3af', marginBottom: '4px', fontFamily: "'Inter', sans-serif" }
const detailText  = { fontSize: '12px', color: '#374151', lineHeight: '1.6', margin: 0, fontFamily: "'Inter', sans-serif" }

// ─── Flow arrow ───────────────────────────────────────────────────────────────

function FlowBar({ stages }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0', marginBottom: '24px', overflowX: 'auto', paddingBottom: '4px' }}>
      {stages.map((stage, i) => (
        <React.Fragment key={stage.key}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0 }}>
            <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: stage.color, marginBottom: '4px' }} />
            <span style={{ fontSize: '10px', fontWeight: '700', color: stage.color, fontFamily: "'Inter', sans-serif", whiteSpace: 'nowrap', textTransform: 'uppercase', letterSpacing: '0.03em' }}>
              {stage.label}
            </span>
          </div>
          {i < stages.length - 1 && (
            <div style={{ flex: 1, height: '2px', background: 'linear-gradient(to right, ' + stage.color + '60, ' + stages[i+1].color + '60)', minWidth: '20px', marginBottom: '18px' }} />
          )}
        </React.Fragment>
      ))}
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

function Lifecycles() {
  const [activeTab, setActiveTab] = useState('donor')
  const [activeStage, setActiveStage] = useState(null)

  const stages = activeTab === 'donor' ? DONOR_STAGES : TICKET_STAGES

  const handleTabChange = (tab) => {
    setActiveTab(tab)
    setActiveStage(null)
  }

  return (
    <div>
      <div style={s.header}>
        <h1 style={s.title}>Lifecycles</h1>
        <p style={s.subtitle}>
          Understand where your constituents sit in their journey — and what actions to take at each stage.
        </p>
      </div>

      {/* Tab bar */}
      <div style={s.tabBar}>
        {[
          { key: 'donor',  label: '🎁 Donor Lifecycle' },
          { key: 'ticket', label: '🎟️ Ticket Buyer Lifecycle' },
        ].map(t => (
          <button
            key={t.key}
            style={activeTab === t.key ? s.tabActive : s.tab}
            onClick={() => handleTabChange(t.key)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Flow bar */}
      <div style={s.card}>
        <p style={s.flowTitle}>{activeTab === 'donor' ? 'Donor Journey' : 'Patron Journey'}</p>
        <FlowBar stages={stages} />
        <p style={{ fontSize: '11px', color: '#9ca3af', fontFamily: "'Inter', sans-serif", margin: 0 }}>
          Click any stage card below to see signals, recommended actions, and key metrics.
        </p>
      </div>

      {/* Stage cards */}
      <div style={s.grid}>
        {stages.map((stage, i) => (
          <StageCard
            key={stage.key}
            stage={stage}
            index={i}
            total={stages.length}
            isActive={activeStage === stage.key}
            onClick={() => setActiveStage(activeStage === stage.key ? null : stage.key)}
          />
        ))}
      </div>
    </div>
  )
}

const s = {
  header:   { marginBottom: '24px' },
  title:    { fontSize: '24px', fontWeight: '700', color: '#0c1a33', marginBottom: '4px', fontFamily: "'Space Grotesk', sans-serif", letterSpacing: '-0.02em' },
  subtitle: { fontSize: '13px', color: '#6b7280', fontFamily: "'Inter', sans-serif", lineHeight: '1.6', maxWidth: '580px' },

  tabBar:   { display: 'flex', gap: '4px', borderBottom: '1px solid rgba(29,111,219,0.15)', marginBottom: '24px' },
  tab:      { padding: '10px 18px', backgroundColor: 'transparent', color: '#4b5563', border: 'none', borderBottom: '2px solid transparent', fontSize: '14px', fontWeight: '500', cursor: 'pointer', fontFamily: "'Inter', sans-serif" },
  tabActive:{ padding: '10px 18px', backgroundColor: 'transparent', color: '#0c1a33', border: 'none', borderBottom: '2px solid #1d6fdb', fontSize: '14px', fontWeight: '700', cursor: 'pointer', fontFamily: "'Inter', sans-serif" },

  card: { background: 'white', borderRadius: '12px', padding: '20px 24px', boxShadow: '0 2px 16px rgba(29,111,219,0.08)', border: '1px solid rgba(29,111,219,0.1)', marginBottom: '20px', maxWidth: '900px' },
  flowTitle: { fontSize: '11px', fontWeight: '700', letterSpacing: '0.06em', textTransform: 'uppercase', color: '#9ca3af', marginBottom: '14px', fontFamily: "'Inter', sans-serif" },

  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '14px', maxWidth: '960px' },
}

export default Lifecycles

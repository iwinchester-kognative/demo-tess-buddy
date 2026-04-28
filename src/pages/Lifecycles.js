import React, { useState } from 'react'

// ─── Donor Lifecycle stages ───────────────────────────────────────────────────

const DONOR_STAGES = [
  {
    key: 'prospect', icon: '🔍', label: 'Prospect', color: '#64748b', count: '18,422',
    description: 'Patrons or constituents with no gift on record — ticket buyers, email subscribers, and event attendees who have never donated.',
    signal: 'Identified through ticket purchase history, event attendance, or email opt-in.',
    action: 'Introduce the mission. Cultivation ask under $100. Include in annual fund broad outreach.',
    metrics: ['18,422 total prospects', '62% have email on file', 'Avg. 1.8 ticket purchases'],
  },
  {
    key: 'firstgift', icon: '🌱', label: 'First Gift', color: '#16a34a', count: '3,104',
    description: 'Donors who have made exactly one gift, regardless of amount. The critical conversion moment — retention from here drops sharply.',
    signal: 'Single gift event. Watch for lapse risk within 90 days of first gift.',
    action: 'Send a personalized thank-you within 48 hrs. Invite to an insider event. Ask for a second gift within 6 months.',
    metrics: ['3,104 first-time donors', 'Avg. first gift: $87', '44% lapse after 1 year'],
  },
  {
    key: 'repeat', icon: '🔄', label: 'Repeat Donor', color: '#0369a1', count: '1,847',
    description: 'Donors with 2–4 gifts on record, cumulative giving under $500. Building a habit — the most important retention tier.',
    signal: 'Sequential giving pattern. Track year-over-year consistency.',
    action: 'Acknowledge giving streak. Offer a modest upgrade ask (+25%). Include in phonathon if lapse risk detected.',
    metrics: ['1,847 repeat donors', 'Avg. cumulative giving: $214', '71% multi-year retention'],
  },
  {
    key: 'midlevel', icon: '⭐', label: 'Mid-Level', color: '#b45309', count: '612',
    description: 'Donors with $500–$4,999 in cumulative lifetime giving. Often overlooked — the bridge between annual fund and major gifts.',
    signal: 'Consistent annual gifts. Attendance at premium events. Multiple years on file.',
    action: 'Assign a relationship manager. Invite to backstage or artist events. Solicit for named or endowed fund.',
    metrics: ['612 mid-level donors', 'Avg. annual gift: $620', '3.2 avg. years of giving'],
  },
  {
    key: 'major', icon: '🏆', label: 'Major Donor', color: '#7c3aed', count: '88',
    description: 'Donors with $5,000+ in cumulative giving or an individual gift of $2,500+. Personal relationship is the primary retention vehicle.',
    signal: 'Wealth screening confirms capacity. Active in gala/special events. Multi-year history.',
    action: 'Personal face-to-face solicitation. Naming opportunity conversations. Board or advisory committee invitation.',
    metrics: ['88 major donors', 'Avg. gift: $12,400', 'Avg. tenure: 7.1 years'],
  },
  {
    key: 'legacy', icon: '🌟', label: 'Planned / Legacy', color: '#0891b2', count: '24',
    description: 'Donors who have indicated or are suspected of including the organization in their estate plans. Highest lifetime value segment.',
    signal: 'Age 65+, long giving history, expressed interest in legacy, engaged with planned giving collateral.',
    action: 'Introduce to planned giving staff. Recognize in legacy society. Keep engaged through intimate cultivation events.',
    metrics: ['24 confirmed', 'Est. 80+ planned', 'Avg. age: 71'],
  },
]

// ─── Ticket Buyer Lifecycle stages (from marketing site) ──────────────────────

const TICKET_STAGES = [
  {
    key: 'single', icon: '🎟️', label: 'Single Ticket', color: '#16a34a', count: '8,214',
    status: 'Entry',
    description: 'Bought once. Still exploring. Prime target for a second visit offer.',
    signal: 'One transaction on record. Likely attended based on a recommendation or external promotion.',
    action: 'Second visit incentive (e.g. 2-for-1 offer). Welcome email series introducing the full season. Re-engage within 60 days before interest fades.',
    metrics: ['8,214 single-ticket buyers', 'Avg. 1.0 events/season', '+12% vs last year'],
  },
  {
    key: 'multi', icon: '🎭', label: 'Multi Ticket', color: '#0369a1', count: '5,041',
    status: 'Engaged',
    description: 'Coming back. Showing preference. Ready to be introduced to a package.',
    signal: 'Two or more separate purchases. May show genre preference. Seasonal repeat likely.',
    action: 'Curated package offer based on past purchases. Highlight savings vs. single ticket pricing. Introduce subscription concept.',
    metrics: ['5,041 multi-ticket buyers', 'Avg. 2.4 events/season', '+8% vs last year'],
  },
  {
    key: 'package', icon: '📦', label: 'Package', color: '#b45309', count: '1,388',
    status: 'Committed',
    description: 'Committed to a run of shows. High conversion candidate for a full subscription.',
    signal: 'Bought a flex pack or mini-series. Selecting into a curated experience. Season thinking is forming.',
    action: 'Full-subscription pitch with exact $ savings. Highlight subscriber-only benefits. Personalized outreach from a patron services rep.',
    metrics: ['1,388 package buyers', 'Avg. spend: $310/season', '-3% vs last year'],
  },
  {
    key: 'subscription', icon: '❤️', label: 'Subscription', color: '#7c3aed', count: '1,384',
    status: 'Loyal',
    description: 'Your most loyal patrons. Highest lifetime value. The goal of the entire journey.',
    signal: 'Active subscription. Watch for early vs. late renewal behavior. Gift ask alongside renewal is highest-yield moment.',
    action: 'Early-bird renewal at week 8. Personal call for 5+ year subs at lapse risk. Upgrade seating offer. Ask for a gift alongside renewal.',
    metrics: ['1,384 active subscribers', 'Avg. sub value: $412', '+5% vs last year'],
  },
  {
    key: 'lapsed_ticket', icon: '🔁', label: 'Lapsed', color: '#dc2626', count: '4,892',
    status: 'Win-Back',
    description: 'Former ticket buyers with no purchase in 18+ months. High-history patrons are the most cost-effective to reactivate.',
    signal: 'Last order 18+ months ago. Drama, Opera genres common among high-value lapsed. Weeknight evening preference.',
    action: 'Win-back campaign with a strong first offer. Highlight new season programming. Personal call for former subscribers.',
    metrics: ['4,892 lapsed buyers', 'Avg. 3.1 prior seasons', '18+ months since last order'],
  },
]

// ─── Membership Status segments ───────────────────────────────────────────────

const MEMBERSHIP_SEGMENTS = [
  {
    key: 'current', icon: '✅', label: 'Current', color: '#16a34a', count: '2,847',
    description: 'Active members in good standing. Membership has not expired and they are receiving full benefits.',
    signal: 'Active membership record. Renewal date in the future. Full access to member benefits.',
    action: 'Stewardship touchpoints. Early renewal ask at 60 days before expiry. Upgrade or gift alongside renewal.',
    metrics: ['2,847 current members', 'Avg. membership value: $185', '74% renew on time'],
    sql: `SELECT c.customer_no, c.sort_name, m.expiration_dt\nFROM t_customer c\nJOIN t_membership m ON m.customer_no = c.customer_no\nWHERE m.status = 'A'\n  AND m.expiration_dt >= GETDATE()\nORDER BY m.expiration_dt ASC`,
  },
  {
    key: 'grace', icon: '⏳', label: 'Grace Period', color: '#d97706', count: '312',
    description: 'Members whose membership has technically expired but are still within the grace period — still receiving benefits but overdue for renewal.',
    signal: 'Expiration date has passed. Grace period active. Still receiving member communications.',
    action: 'Urgent renewal reminder. Emphasize upcoming loss of benefits. Personal outreach for multi-year members.',
    metrics: ['312 in grace period', 'Avg. days past expiry: 18', '58% renew within grace'],
    sql: `SELECT c.customer_no, c.sort_name, m.expiration_dt,\n  DATEDIFF(day, m.expiration_dt, GETDATE()) AS days_past\nFROM t_customer c\nJOIN t_membership m ON m.customer_no = c.customer_no\nWHERE m.status = 'G'\nORDER BY m.expiration_dt ASC`,
  },
  {
    key: 'lapsed', icon: '❌', label: 'Lapsed', color: '#dc2626', count: '1,214',
    description: 'Former members who did not renew and are outside the grace window. Benefits have been revoked.',
    signal: 'No active membership. Grace period has expired. Last membership may be 1–5+ years ago.',
    action: 'Win-back campaign. Highlight membership changes and new benefits. First-year re-join offer at reduced rate.',
    metrics: ['1,214 lapsed members', 'Avg. lapse: 14 months', '22% re-join within 2 years'],
    sql: `SELECT c.customer_no, c.sort_name, MAX(m.expiration_dt) AS last_expiry\nFROM t_customer c\nJOIN t_membership m ON m.customer_no = c.customer_no\nWHERE m.status = 'L'\nGROUP BY c.customer_no, c.sort_name\nORDER BY last_expiry DESC`,
  },
]

// ─── Flow bar ─────────────────────────────────────────────────────────────────

function FlowBar({ stages }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', overflowX: 'auto', paddingBottom: '4px', marginBottom: '24px' }}>
      {stages.map((stage, i) => (
        <React.Fragment key={stage.key}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0 }}>
            <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: stage.color, marginBottom: '4px' }} />
            <span style={{ fontSize: '10px', fontWeight: '700', color: stage.color, fontFamily: "'Inter', sans-serif", whiteSpace: 'nowrap', textTransform: 'uppercase', letterSpacing: '0.03em' }}>
              {stage.label}
            </span>
          </div>
          {i < stages.length - 1 && (
            <div style={{ flex: 1, height: '2px', background: `linear-gradient(to right, ${stage.color}60, ${stages[i + 1].color}60)`, minWidth: '20px', marginBottom: '18px' }} />
          )}
        </React.Fragment>
      ))}
    </div>
  )
}

// ─── Stage card (used for donor + ticket lifecycle) ───────────────────────────

function StageCard({ stage, index, total, isActive, onClick, onMakeList, listBuilding, listBuilt }) {
  return (
    <div
      style={{
        cursor: 'pointer', background: 'white', borderRadius: '12px',
        border: `1px solid ${isActive ? stage.color + '60' : 'rgba(29,111,219,0.1)'}`,
        boxShadow: isActive ? `0 4px 20px ${stage.color}22` : '0 2px 8px rgba(29,111,219,0.06)',
        overflow: 'hidden', transition: 'box-shadow 0.15s, border-color 0.15s',
      }}
      onClick={onClick}
    >
      <div style={{ padding: '16px 18px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '20px' }}>{stage.icon}</span>
            <div>
              <span style={{ fontSize: '10px', fontWeight: '700', color: '#9ca3af', fontFamily: "'Inter', sans-serif", letterSpacing: '0.04em', textTransform: 'uppercase' }}>
                Stage {index + 1} of {total}{stage.status ? ` · ${stage.status}` : ''}
              </span>
              <p style={{ fontSize: '14px', fontWeight: '700', color: stage.color, margin: 0, fontFamily: "'Space Grotesk', sans-serif" }}>{stage.label}</p>
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <p style={{ fontSize: '20px', fontWeight: '800', color: '#0c1a33', margin: 0, fontFamily: "'Space Grotesk', sans-serif", lineHeight: 1 }}>{stage.count}</p>
            <p style={{ fontSize: '10px', color: '#9ca3af', margin: '2px 0 0', fontFamily: "'Inter', sans-serif" }}>constituents</p>
          </div>
        </div>
        <p style={{ fontSize: '12px', color: '#4b5563', lineHeight: '1.55', margin: 0, fontFamily: "'Inter', sans-serif" }}>{stage.description}</p>
      </div>

      <div style={{ padding: '6px 18px 10px', display: 'flex', justifyContent: 'flex-end' }}>
        <span style={{ fontSize: '11px', color: '#9ca3af', fontFamily: "'Inter', sans-serif" }}>{isActive ? '▲ Less' : '▼ Details'}</span>
      </div>

      {isActive && (
        <div style={{ borderTop: `1px solid ${stage.color}22`, background: '#f8fafd', padding: '16px 18px' }}>
          <div style={{ marginBottom: '12px' }}>
            <p style={detailLabel}>Signal</p>
            <p style={detailText}>{stage.signal}</p>
          </div>
          <div style={{ marginBottom: '12px' }}>
            <p style={detailLabel}>Recommended Action</p>
            <p style={detailText}>{stage.action}</p>
          </div>
          <div style={{ marginBottom: '16px' }}>
            <p style={detailLabel}>Key Metrics</p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
              {stage.metrics.map((m, i) => (
                <span key={i} style={{ background: stage.color + '12', color: stage.color, border: `1px solid ${stage.color}30`, borderRadius: '100px', padding: '3px 10px', fontSize: '11px', fontWeight: '600', fontFamily: "'Inter', sans-serif" }}>
                  {m}
                </span>
              ))}
            </div>
          </div>
          <button
            onClick={e => { e.stopPropagation(); onMakeList() }}
            disabled={listBuilding || listBuilt}
            style={{
              padding: '7px 16px', border: 'none', borderRadius: '7px',
              background: listBuilt ? '#f0fff4' : listBuilding ? '#d1d9e6' : 'linear-gradient(135deg, #1d6fdb, #38bdf8)',
              color: listBuilt ? '#16a34a' : 'white',
              fontSize: '12px', fontWeight: '600', fontFamily: "'Inter', sans-serif",
              cursor: listBuilding || listBuilt ? 'default' : 'pointer',
              border: listBuilt ? '1px solid #c6f6d5' : 'none',
            }}
          >
            {listBuilt ? '✓ Segment created' : listBuilding ? 'Building…' : '+ Make a List'}
          </button>
        </div>
      )}
    </div>
  )
}

const detailLabel = { fontSize: '10px', fontWeight: '700', letterSpacing: '0.06em', textTransform: 'uppercase', color: '#9ca3af', marginBottom: '4px', fontFamily: "'Inter', sans-serif" }
const detailText  = { fontSize: '12px', color: '#374151', lineHeight: '1.6', margin: 0, fontFamily: "'Inter', sans-serif" }

// ─── Lifecycle tab (donor or ticket) ─────────────────────────────────────────

function LifecycleTab({ stages, flowTitle }) {
  const [activeStage, setActiveStage]   = useState(null)
  const [buildingList, setBuildingList] = useState(null)
  const [builtLists, setBuiltLists]     = useState({})

  const handleMakeList = async (key) => {
    setBuildingList(key)
    await new Promise(r => setTimeout(r, 1400))
    setBuildingList(null)
    setBuiltLists(prev => ({ ...prev, [key]: true }))
  }

  return (
    <div>
      <div style={s.flowCard}>
        <p style={s.flowTitle}>{flowTitle}</p>
        <FlowBar stages={stages} />
        <p style={{ fontSize: '11px', color: '#9ca3af', fontFamily: "'Inter', sans-serif", margin: 0 }}>
          Click any stage card below to see signals, recommended actions, and metrics. Use "Make a List" to build a segment for that stage.
        </p>
      </div>
      <div style={s.grid}>
        {stages.map((stage, i) => (
          <StageCard
            key={stage.key}
            stage={stage}
            index={i}
            total={stages.length}
            isActive={activeStage === stage.key}
            onClick={() => setActiveStage(activeStage === stage.key ? null : stage.key)}
            onMakeList={() => handleMakeList(stage.key)}
            listBuilding={buildingList === stage.key}
            listBuilt={!!builtLists[stage.key]}
          />
        ))}
      </div>
    </div>
  )
}

// ─── Membership tab ───────────────────────────────────────────────────────────

function MembershipTab() {
  const [expanded, setExpanded]         = useState(null)
  const [buildingList, setBuildingList] = useState(null)
  const [builtLists, setBuiltLists]     = useState({})

  const handleMakeList = async (key) => {
    setBuildingList(key)
    await new Promise(r => setTimeout(r, 1400))
    setBuildingList(null)
    setBuiltLists(prev => ({ ...prev, [key]: true }))
  }

  const totalMembers = MEMBERSHIP_SEGMENTS.reduce((a, s) => a + Number(s.count.replace(/,/g, '')), 0)

  return (
    <div>
      {/* Summary bar */}
      <div style={s.flowCard}>
        <p style={s.flowTitle}>Membership Status Overview</p>
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginBottom: '14px' }}>
          {MEMBERSHIP_SEGMENTS.map(seg => {
            const pct = Math.round((Number(seg.count.replace(/,/g, '')) / totalMembers) * 100)
            return (
              <div key={seg.key} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: seg.color, flexShrink: 0 }} />
                <span style={{ fontSize: '12px', fontWeight: '700', color: seg.color, fontFamily: "'Inter', sans-serif" }}>{seg.label}</span>
                <span style={{ fontSize: '12px', color: '#9ca3af', fontFamily: "'Inter', sans-serif" }}>{seg.count} ({pct}%)</span>
              </div>
            )
          })}
        </div>
        {/* Bar chart */}
        <div style={{ display: 'flex', height: '8px', borderRadius: '6px', overflow: 'hidden', gap: '2px' }}>
          {MEMBERSHIP_SEGMENTS.map(seg => {
            const pct = Math.round((Number(seg.count.replace(/,/g, '')) / totalMembers) * 100)
            return <div key={seg.key} style={{ width: `${pct}%`, background: seg.color, transition: 'width 0.3s' }} />
          })}
        </div>
        <p style={{ fontSize: '11px', color: '#9ca3af', fontFamily: "'Inter', sans-serif", margin: '10px 0 0' }}>
          Click a status card to see signals, recommended actions, and SQL. Use "Add to Segment" to build a list.
        </p>
      </div>

      {/* Status cards */}
      <div style={s.grid}>
        {MEMBERSHIP_SEGMENTS.map(seg => {
          const isExp = expanded === seg.key
          const isBuilding = buildingList === seg.key
          const isBuilt = !!builtLists[seg.key]

          return (
            <div
              key={seg.key}
              onClick={() => setExpanded(isExp ? null : seg.key)}
              style={{
                cursor: 'pointer', background: 'white', borderRadius: '12px',
                border: `1px solid ${isExp ? seg.color + '60' : 'rgba(29,111,219,0.1)'}`,
                boxShadow: isExp ? `0 4px 20px ${seg.color}22` : '0 2px 8px rgba(29,111,219,0.06)',
                overflow: 'hidden', transition: 'box-shadow 0.15s, border-color 0.15s',
              }}
            >
              <div style={{ padding: '16px 18px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '22px' }}>{seg.icon}</span>
                    <p style={{ fontSize: '15px', fontWeight: '700', color: seg.color, margin: 0, fontFamily: "'Space Grotesk', sans-serif" }}>{seg.label}</p>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <p style={{ fontSize: '22px', fontWeight: '800', color: '#0c1a33', margin: 0, fontFamily: "'Space Grotesk', sans-serif", lineHeight: 1 }}>{seg.count}</p>
                    <p style={{ fontSize: '10px', color: '#9ca3af', margin: '2px 0 0', fontFamily: "'Inter', sans-serif" }}>members</p>
                  </div>
                </div>
                <p style={{ fontSize: '12px', color: '#4b5563', lineHeight: '1.55', margin: 0, fontFamily: "'Inter', sans-serif" }}>{seg.description}</p>
              </div>

              <div style={{ padding: '6px 18px 10px', display: 'flex', justifyContent: 'flex-end' }}>
                <span style={{ fontSize: '11px', color: '#9ca3af', fontFamily: "'Inter', sans-serif" }}>{isExp ? '▲ Less' : '▼ Details'}</span>
              </div>

              {isExp && (
                <div style={{ borderTop: `1px solid ${seg.color}22`, background: '#f8fafd', padding: '16px 18px' }}>
                  <div style={{ marginBottom: '12px' }}>
                    <p style={detailLabel}>Signal</p>
                    <p style={detailText}>{seg.signal}</p>
                  </div>
                  <div style={{ marginBottom: '12px' }}>
                    <p style={detailLabel}>Recommended Action</p>
                    <p style={detailText}>{seg.action}</p>
                  </div>
                  <div style={{ marginBottom: '12px' }}>
                    <p style={detailLabel}>Key Metrics</p>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '12px' }}>
                      {seg.metrics.map((m, i) => (
                        <span key={i} style={{ background: seg.color + '12', color: seg.color, border: `1px solid ${seg.color}30`, borderRadius: '100px', padding: '3px 10px', fontSize: '11px', fontWeight: '600', fontFamily: "'Inter', sans-serif" }}>
                          {m}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div style={{ marginBottom: '16px' }}>
                    <p style={detailLabel}>Generated SQL</p>
                    <pre style={{ fontSize: '11px', color: '#374151', background: '#f0f4fa', borderRadius: '6px', padding: '10px 12px', margin: 0, overflowX: 'auto', fontFamily: "ui-monospace, 'Cascadia Code', monospace", lineHeight: '1.6', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                      {seg.sql}
                    </pre>
                  </div>
                  <button
                    onClick={e => { e.stopPropagation(); handleMakeList(seg.key) }}
                    disabled={isBuilding || isBuilt}
                    style={{
                      padding: '7px 16px', border: 'none', borderRadius: '7px',
                      background: isBuilt ? '#f0fff4' : isBuilding ? '#d1d9e6' : 'linear-gradient(135deg, #1d6fdb, #38bdf8)',
                      color: isBuilt ? '#16a34a' : 'white',
                      fontSize: '12px', fontWeight: '600', fontFamily: "'Inter', sans-serif",
                      cursor: isBuilding || isBuilt ? 'default' : 'pointer',
                      border: isBuilt ? '1px solid #c6f6d5' : 'none',
                    }}
                  >
                    {isBuilt ? '✓ Segment created' : isBuilding ? 'Building…' : '+ Add to Segment'}
                  </button>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

function Lifecycles() {
  const [activeTab, setActiveTab] = useState('donor')

  return (
    <div>
      <div style={s.header}>
        <h1 style={s.title}>Lifecycles</h1>
        <p style={s.subtitle}>
          Understand where your constituents sit in their journey — and what actions to take at each stage.
        </p>
      </div>

      <div style={s.tabBar}>
        {[
          { key: 'donor',      label: '🎁 Donor Lifecycle' },
          { key: 'ticket',     label: '🎟️ Ticket Buyer Lifecycle' },
          { key: 'membership', label: '🪪 Membership Status' },
        ].map(t => (
          <button
            key={t.key}
            style={activeTab === t.key ? s.tabActive : s.tab}
            onClick={() => setActiveTab(t.key)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {activeTab === 'donor'      && <LifecycleTab stages={DONOR_STAGES}  flowTitle="Donor Journey" />}
      {activeTab === 'ticket'     && <LifecycleTab stages={TICKET_STAGES} flowTitle="Patron Journey" />}
      {activeTab === 'membership' && <MembershipTab />}
    </div>
  )
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = {
  header:   { marginBottom: '24px' },
  title:    { fontSize: '24px', fontWeight: '700', color: '#0c1a33', marginBottom: '4px', fontFamily: "'Space Grotesk', sans-serif", letterSpacing: '-0.02em' },
  subtitle: { fontSize: '13px', color: '#6b7280', fontFamily: "'Inter', sans-serif", lineHeight: '1.6', maxWidth: '580px' },

  tabBar:   { display: 'flex', gap: '4px', borderBottom: '1px solid rgba(29,111,219,0.15)', marginBottom: '24px' },
  tab:      { padding: '10px 18px', backgroundColor: 'transparent', color: '#4b5563', border: 'none', borderBottom: '2px solid transparent', fontSize: '14px', fontWeight: '500', cursor: 'pointer', fontFamily: "'Inter', sans-serif" },
  tabActive:{ padding: '10px 18px', backgroundColor: 'transparent', color: '#0c1a33', border: 'none', borderBottom: '2px solid #1d6fdb', fontSize: '14px', fontWeight: '700', cursor: 'pointer', fontFamily: "'Inter', sans-serif" },

  flowCard:  { background: 'white', borderRadius: '12px', padding: '20px 24px', boxShadow: '0 2px 16px rgba(29,111,219,0.08)', border: '1px solid rgba(29,111,219,0.1)', marginBottom: '20px', maxWidth: '960px' },
  flowTitle: { fontSize: '11px', fontWeight: '700', letterSpacing: '0.06em', textTransform: 'uppercase', color: '#9ca3af', marginBottom: '14px', fontFamily: "'Inter', sans-serif" },

  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '14px', maxWidth: '960px' },
}

export default Lifecycles

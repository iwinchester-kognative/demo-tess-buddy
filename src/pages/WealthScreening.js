import React, { useState } from 'react'

// ─── Known constituent profiles ───────────────────────────────────────────────

const WEALTH_PROFILES = {
  88001: {
    name: 'Abbott, Claire L.', rating: 'A', ratingColor: '#16a34a',
    netWorth: '$2.4M–$3.1M', capacity: '$24,000/yr', confidence: 'High',
    realEstate: '2 properties (est. $1.1M)',
    stockHoldings: 'Publicly held: $340K (AAPL, MSFT)',
    pastGiving: '$14,200 cumulative to your org',
    publicGifts: [
      { org: 'Charleston Symphony', amount: '$2,500' },
      { org: 'MUSC Foundation', amount: '$1,000' },
      { org: 'College of Charleston', amount: '$5,000' },
    ],
  },
  88003: {
    name: 'Chen, Wei', rating: 'B+', ratingColor: '#0369a1',
    netWorth: '$620K–$840K', capacity: '$6,200/yr', confidence: 'Medium',
    realEstate: '1 property (est. $520K)',
    stockHoldings: 'No public holdings identified',
    pastGiving: '$3,400 cumulative to your org',
    publicGifts: [{ org: 'Arts Center of Charleston', amount: '$500' }],
  },
  88007: {
    name: 'Harrison, Nathaniel', rating: 'A+', ratingColor: '#7c3aed',
    netWorth: '$8.2M–$11.4M', capacity: '$82,000/yr', confidence: 'High',
    realEstate: '4 properties (est. $4.3M)',
    stockHoldings: 'Publicly held: $2.1M (BRK, JPM, T)',
    pastGiving: '$42,100 cumulative to your org',
    publicGifts: [
      { org: 'Gibbes Museum of Art', amount: '$25,000' },
      { org: 'Spoleto Festival USA', amount: '$10,000' },
      { org: 'Historic Charleston Foundation', amount: '$15,000' },
    ],
  },
  88005: {
    name: 'Fletcher, James R.', rating: 'C', ratingColor: '#d97706',
    netWorth: '$180K–$290K', capacity: '$1,800/yr', confidence: 'Low',
    realEstate: 'No properties identified',
    stockHoldings: 'No public holdings identified',
    pastGiving: '$890 cumulative to your org',
    publicGifts: [],
  },
}

function fakeWealthProfile(custNo) {
  const NAMES = ['Williams, Arthur J.', 'Patel, Priya S.', "O'Brien, Kathleen", 'Nguyen, Bao T.', 'Okonkwo, Emeka', 'Ramirez, Diana', 'Goldstein, Robert M.', 'Thornton, Patricia', 'Lawson, Marcus D.', 'Vega, Sofia', 'Kimura, Takashi', 'Brennan, Helen M.']
  const n = Number(custNo)
  const name = NAMES[n % NAMES.length]
  const ratings = [
    { r: 'B',  c: '#0369a1' },
    { r: 'B+', c: '#0369a1' },
    { r: 'C+', c: '#d97706' },
    { r: 'B-', c: '#0369a1' },
    { r: 'A',  c: '#16a34a' },
    { r: 'C',  c: '#d97706' },
  ]
  const rt = ratings[n % ratings.length]
  return {
    name,
    rating: rt.r, ratingColor: rt.c,
    netWorth: `$${350 + (n % 800)}K–$${600 + (n % 900)}K`,
    capacity: `$${3 + (n % 9)},${String(n % 100).padStart(2, '0')}0/yr`,
    confidence: n % 3 === 0 ? 'High' : n % 3 === 1 ? 'Medium' : 'Low',
    realEstate: n % 2 === 0 ? '1 property (est. $310K)' : 'No properties identified',
    stockHoldings: 'No public holdings identified',
    pastGiving: `$${(n % 5000) + 200} cumulative to your org`,
    publicGifts: n % 2 === 0 ? [{ org: 'Local Arts Council', amount: '$250' }] : [],
  }
}

const RATING_DESC = {
  'A+': 'Exceptional capacity',
  'A':  'Strong capacity',
  'B+': 'Good capacity',
  'B':  'Moderate capacity',
  'B-': 'Below average',
  'C+': 'Limited capacity',
  'C':  'Low capacity',
}

// ─── Fake lists for the list-screening tab ────────────────────────────────────

const FAKE_LISTS = [
  { id: 4201, name: 'Donors >$500 last 12 months — no 2024 subscription',       category: 'Annual Fund' },
  { id: 4202, name: 'Lapsed subscribers — attended 3+ shows in prior 3 seasons', category: 'Subscriptions' },
  { id: 4203, name: 'First-time buyers 2024 season — no follow-up gift',          category: 'Acquisition' },
  { id: 2201, name: 'Annual Fund Appeal 2024 — Lapsed Donors',                    category: 'Annual Fund' },
  { id: 2204, name: 'Spring Appeal — Under-40 Donors',                            category: 'Annual Fund' },
  { id: 2206, name: '5+ Year Ticket Buyers No Recent Gift',                        category: 'Reactivation' },
  { id: 3101, name: 'Board Prospect Pipeline FY25',                                category: 'Major Gifts' },
  { id: 3102, name: 'Mid-Level Donors $500–$4999 Lifetime',                        category: 'Major Gifts' },
  { id: 3103, name: 'Planned Giving Inquiry List',                                  category: 'Major Gifts' },
  { id: 5001, name: 'Opening Night Gala Invitees',                                  category: 'Events' },
  { id: 5002, name: 'Dress Rehearsal Invite List',                                  category: 'Events' },
  { id: 6001, name: 'Email Opt-In — No Gift History',                               category: 'Prospect' },
]

// Generate a fake set of screened results for a list
function fakeListResults(listId) {
  const counts = { 4201: 12, 4202: 8, 4203: 18, 2201: 15, 2204: 9, 2206: 22, 3101: 6, 3102: 11, 3103: 5, 5001: 14, 5002: 10, 6001: 25 }
  const count = counts[listId] || 10
  return Array.from({ length: count }, (_, i) => {
    const custNo = (listId * 100 + i + 1)
    const known = WEALTH_PROFILES[custNo]
    return { custNo, ...(known || fakeWealthProfile(custNo)) }
  })
}

// ─── Tab button ───────────────────────────────────────────────────────────────

function TabButton({ label, active, onClick }) {
  return (
    <button style={active ? s.tabActive : s.tab} onClick={onClick}>{label}</button>
  )
}

// ─── Rating badge ─────────────────────────────────────────────────────────────

function RatingBadge({ rating, color }) {
  return (
    <div style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', background: color + '12', border: `1px solid ${color}30`, borderRadius: '10px', padding: '10px 18px' }}>
      <span style={{ fontSize: '28px', fontWeight: '900', color, fontFamily: "'Space Grotesk', sans-serif", lineHeight: 1 }}>{rating}</span>
      <span style={{ fontSize: '10px', color, fontWeight: '700', letterSpacing: '0.04em', marginTop: '2px', fontFamily: "'Inter', sans-serif" }}>
        {RATING_DESC[rating] || 'Capacity rating'}
      </span>
    </div>
  )
}

// ─── Single constituent tab ───────────────────────────────────────────────────

function SingleConstituentTab() {
  const [custNo, setCustNo] = useState('')
  const [loading, setLoading] = useState(false)
  const [profile, setProfile] = useState(null)
  const [searched, setSearched] = useState(false)
  const [lastCustNo, setLastCustNo] = useState('')

  const handleScreen = async () => {
    if (!custNo.trim()) return
    setLoading(true)
    setProfile(null)
    setSearched(false)
    await new Promise(r => setTimeout(r, 1200))
    setLoading(false)
    setSearched(true)
    setLastCustNo(custNo)
    const known = WEALTH_PROFILES[Number(custNo)]
    setProfile(known || fakeWealthProfile(custNo))
  }

  return (
    <div>
      {/* Search */}
      <div style={s.card}>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-end' }}>
          <div>
            <label style={s.fieldLabel}>Constituent #</label>
            <input
              value={custNo}
              onChange={e => setCustNo(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleScreen()}
              placeholder="e.g. 88001"
              style={s.input}
            />
          </div>
          <button
            onClick={handleScreen}
            disabled={!custNo.trim() || loading}
            style={{ ...s.btn, opacity: !custNo.trim() || loading ? 0.5 : 1, cursor: !custNo.trim() || loading ? 'not-allowed' : 'pointer' }}
          >
            {loading ? 'Screening…' : 'Screen Constituent'}
          </button>
        </div>
        {loading && <p style={s.loadingHint}>Querying wealth databases… checking public records…</p>}
      </div>

      {/* Result */}
      {searched && profile && (
        <div style={s.card}>
          <div style={s.resultHeader}>
            <div>
              <p style={s.constituentName}>{profile.name}</p>
              <p style={s.constituentSub}>Constituent #{lastCustNo}</p>
            </div>
            <RatingBadge rating={profile.rating} color={profile.ratingColor} />
          </div>

          <div style={s.metricsGrid}>
            {[
              { label: 'Est. Net Worth',  value: profile.netWorth },
              { label: 'Giving Capacity', value: profile.capacity },
              { label: 'Confidence',      value: profile.confidence },
              { label: 'Real Estate',     value: profile.realEstate },
              { label: 'Stock Holdings',  value: profile.stockHoldings },
              { label: 'Giving to You',   value: profile.pastGiving },
            ].map(({ label, value }) => (
              <div key={label} style={s.metricCard}>
                <p style={s.metricLabel}>{label}</p>
                <p style={s.metricValue}>{value}</p>
              </div>
            ))}
          </div>

          {profile.publicGifts && profile.publicGifts.length > 0 && (
            <div style={{ marginBottom: '16px' }}>
              <p style={s.sectionLabel}>Publicly Recorded Gifts to Other Orgs</p>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                {profile.publicGifts.map((g, i) => (
                  <span key={i} style={s.giftPill}>{g.org} — {g.amount}</span>
                ))}
              </div>
            </div>
          )}
          {profile.publicGifts && profile.publicGifts.length === 0 && (
            <p style={{ fontSize: '12px', color: '#9ca3af', fontStyle: 'italic', fontFamily: "'Inter', sans-serif", marginBottom: '16px' }}>
              No publicly recorded gifts to other organizations found.
            </p>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Screen a list tab ────────────────────────────────────────────────────────

const CATEGORIES = ['All categories', ...Array.from(new Set(FAKE_LISTS.map(l => l.category))).sort()]

function ScreenListTab() {
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('All categories')
  const [selectedList, setSelectedList] = useState('')
  const [loading, setLoading] = useState(false)
  const [results, setResults] = useState(null)
  const [expandedRow, setExpandedRow] = useState(null)

  const filteredLists = FAKE_LISTS.filter(l => {
    const matchCat = category === 'All categories' || l.category === category
    const matchSearch = !search.trim() || l.name.toLowerCase().includes(search.trim().toLowerCase())
    return matchCat && matchSearch
  })

  const handleScreen = async () => {
    if (!selectedList) return
    setLoading(true)
    setResults(null)
    setExpandedRow(null)
    await new Promise(r => setTimeout(r, 1800))
    setLoading(false)
    setResults(fakeListResults(Number(selectedList)))
  }

  const selectedListName = FAKE_LISTS.find(l => String(l.id) === String(selectedList))?.name || ''

  const ratingOrder = { 'A+': 0, 'A': 1, 'B+': 2, 'B': 3, 'B-': 4, 'C+': 5, 'C': 6 }
  const sortedResults = results ? [...results].sort((a, b) => (ratingOrder[a.rating] ?? 9) - (ratingOrder[b.rating] ?? 9)) : []

  return (
    <div>
      {/* Picker card */}
      <div style={s.card}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>

          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <div style={{ flex: '1', minWidth: '200px' }}>
              <label style={s.fieldLabel}>Search by list name</label>
              <input
                value={search}
                onChange={e => { setSearch(e.target.value); setSelectedList('') }}
                placeholder="Start typing to filter lists…"
                style={{ ...s.input, width: '100%', boxSizing: 'border-box' }}
              />
            </div>
            <div>
              <label style={s.fieldLabel}>Category</label>
              <select
                value={category}
                onChange={e => { setCategory(e.target.value); setSelectedList('') }}
                style={{ ...s.input, background: 'white', width: '180px' }}
              >
                {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-end', flexWrap: 'wrap' }}>
            <div style={{ flex: '1', minWidth: '260px' }}>
              <label style={s.fieldLabel}>Tessitura list</label>
              <select
                value={selectedList}
                onChange={e => setSelectedList(e.target.value)}
                style={{ ...s.input, background: 'white', width: '100%', boxSizing: 'border-box' }}
                disabled={filteredLists.length === 0}
              >
                <option value="">{filteredLists.length === 0 ? 'No lists match' : 'Choose a list…'}</option>
                {filteredLists.map(l => (
                  <option key={l.id} value={l.id}>#{l.id} — {l.name}</option>
                ))}
              </select>
            </div>
            <button
              onClick={handleScreen}
              disabled={!selectedList || loading}
              style={{ ...s.btn, opacity: !selectedList || loading ? 0.5 : 1, cursor: !selectedList || loading ? 'not-allowed' : 'pointer', whiteSpace: 'nowrap' }}
            >
              {loading ? 'Screening…' : 'Screen List'}
            </button>
          </div>

        </div>
        {loading && <p style={s.loadingHint}>Querying wealth databases for all constituents on this list…</p>}
      </div>

      {/* Results table */}
      {sortedResults.length > 0 && (
        <div style={{ ...s.card, padding: '0', overflow: 'hidden' }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid rgba(29,111,219,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <p style={{ fontSize: '13px', fontWeight: '700', color: '#0c1a33', margin: 0, fontFamily: "'Space Grotesk', sans-serif" }}>
                Wealth Screening Results
              </p>
              <p style={{ fontSize: '12px', color: '#9ca3af', margin: '2px 0 0', fontFamily: "'Inter', sans-serif" }}>
                {selectedListName} · {sortedResults.length} constituents screened
              </p>
            </div>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {['A+','A','B+','B','B-','C+','C'].map(r => {
                const count = sortedResults.filter(x => x.rating === r).length
                if (!count) return null
                const colors = { 'A+':'#7c3aed','A':'#16a34a','B+':'#0369a1','B':'#0369a1','B-':'#0369a1','C+':'#d97706','C':'#d97706' }
                const col = colors[r] || '#6b7280'
                return (
                  <span key={r} style={{ fontSize: '11px', fontWeight: '700', color: col, background: col+'12', border: `1px solid ${col}30`, borderRadius: '100px', padding: '2px 8px', fontFamily: "'Inter', sans-serif" }}>
                    {r}: {count}
                  </span>
                )
              })}
            </div>
          </div>

          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
            <thead>
              <tr>
                {['Rating','Name','#','Net Worth','Capacity','Confidence'].map(h => (
                  <th key={h} style={s.th}>{h}</th>
                ))}
                <th style={{ ...s.th, width: '32px' }} />
              </tr>
            </thead>
            <tbody>
              {sortedResults.map((row) => {
                const isExp = expandedRow === row.custNo
                return (
                  <React.Fragment key={row.custNo}>
                    <tr
                      style={{ borderBottom: '1px solid #f2f4f7', cursor: 'pointer', background: isExp ? '#f8fafd' : 'white' }}
                      onClick={() => setExpandedRow(isExp ? null : row.custNo)}
                    >
                      <td style={s.td}>
                        <span style={{ fontSize: '14px', fontWeight: '900', color: row.ratingColor, fontFamily: "'Space Grotesk', sans-serif" }}>{row.rating}</span>
                      </td>
                      <td style={s.td}><span style={{ fontWeight: '600', color: '#0c1a33' }}>{row.name}</span></td>
                      <td style={{ ...s.td, fontFamily: 'ui-monospace, monospace', fontSize: '12px', color: '#6b7280' }}>#{row.custNo}</td>
                      <td style={s.td}>{row.netWorth}</td>
                      <td style={s.td}>{row.capacity}</td>
                      <td style={s.td}>
                        <span style={{ color: row.confidence === 'High' ? '#16a34a' : row.confidence === 'Medium' ? '#d97706' : '#9ca3af', fontWeight: '600', fontSize: '12px' }}>
                          ● {row.confidence}
                        </span>
                      </td>
                      <td style={s.td}><span style={{ fontSize: '10px', color: '#9ca3af' }}>{isExp ? '▲' : '▼'}</span></td>
                    </tr>

                    {isExp && (
                      <tr style={{ background: '#f8fafd' }}>
                        <td colSpan={7} style={{ padding: '14px 20px', borderBottom: '1px solid #f2f4f7' }}>
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '10px', marginBottom: '12px' }}>
                            {[
                              { label: 'Real Estate',     value: row.realEstate },
                              { label: 'Stock Holdings',  value: row.stockHoldings },
                              { label: 'Giving to You',   value: row.pastGiving },
                            ].map(({ label, value }) => (
                              <div key={label} style={{ background: 'white', borderRadius: '8px', padding: '10px 12px', border: '1px solid rgba(29,111,219,0.08)' }}>
                                <p style={s.metricLabel}>{label}</p>
                                <p style={s.metricValue}>{value}</p>
                              </div>
                            ))}
                          </div>
                          {row.publicGifts && row.publicGifts.length > 0 && (
                            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                              {row.publicGifts.map((g, i) => (
                                <span key={i} style={s.giftPill}>{g.org} — {g.amount}</span>
                              ))}
                            </div>
                          )}
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

function WealthScreening() {
  const [activeTab, setActiveTab] = useState('single')

  return (
    <div>
      <div style={s.header}>
        <h1 style={s.title}>Wealth Screening</h1>
        <p style={s.subtitle}>
          Look up estimated wealth profiles — net worth range, giving capacity, real estate, and publicly
          recorded gifts — for individual constituents or an entire list.
        </p>
      </div>

      <div style={s.tabBar}>
        <TabButton label="Single Constituent" active={activeTab === 'single'} onClick={() => setActiveTab('single')} />
        <TabButton label="Screen a List"      active={activeTab === 'list'}   onClick={() => setActiveTab('list')} />
      </div>

      <div>
        {activeTab === 'single' && <SingleConstituentTab />}
        {activeTab === 'list'   && <ScreenListTab />}
      </div>
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

  card: { background: 'white', borderRadius: '12px', padding: '24px 28px', boxShadow: '0 2px 16px rgba(29,111,219,0.08)', border: '1px solid rgba(29,111,219,0.1)', marginBottom: '20px', maxWidth: '900px' },

  fieldLabel:  { display: 'block', fontSize: '11px', fontWeight: '700', color: '#374151', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '5px', fontFamily: "'Inter', sans-serif" },
  input:       { padding: '9px 14px', border: '1px solid rgba(29,111,219,0.2)', borderRadius: '8px', fontSize: '13px', fontFamily: "'Inter', sans-serif", outline: 'none' },
  btn:         { padding: '9px 22px', background: 'linear-gradient(135deg, #1d6fdb, #38bdf8)', color: 'white', border: 'none', borderRadius: '8px', fontSize: '13px', fontWeight: '600', fontFamily: "'Inter', sans-serif", cursor: 'pointer' },
  loadingHint: { fontSize: '12px', color: '#9ca3af', marginTop: '10px', fontFamily: "'Inter', sans-serif", fontStyle: 'italic' },

  resultHeader:    { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' },
  constituentName: { fontSize: '18px', fontWeight: '700', color: '#0c1a33', margin: 0, fontFamily: "'Space Grotesk', sans-serif" },
  constituentSub:  { fontSize: '12px', color: '#9ca3af', margin: '2px 0 0', fontFamily: "'Inter', sans-serif" },

  metricsGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '12px', marginBottom: '20px' },
  metricCard:  { background: '#f8fafd', borderRadius: '8px', padding: '12px 14px', border: '1px solid rgba(29,111,219,0.08)' },
  metricLabel: { fontSize: '10px', fontWeight: '700', letterSpacing: '0.06em', textTransform: 'uppercase', color: '#9ca3af', marginBottom: '4px', fontFamily: "'Inter', sans-serif" },
  metricValue: { fontSize: '13px', fontWeight: '600', color: '#0c1a33', margin: 0, fontFamily: "'Inter', sans-serif" },

  sectionLabel: { fontSize: '11px', fontWeight: '700', letterSpacing: '0.06em', textTransform: 'uppercase', color: '#9ca3af', marginBottom: '8px', fontFamily: "'Inter', sans-serif" },
  giftPill:     { background: 'rgba(29,111,219,0.07)', border: '1px solid rgba(29,111,219,0.15)', borderRadius: '100px', padding: '4px 12px', fontSize: '12px', color: '#1d6fdb', fontFamily: "'Inter', sans-serif", fontWeight: '500' },

  th: { textAlign: 'left', padding: '9px 14px', background: '#f8fafd', fontSize: '11px', fontWeight: '700', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.04em', fontFamily: "'Inter', sans-serif", borderBottom: '1px solid rgba(29,111,219,0.1)' },
  td: { padding: '10px 14px', verticalAlign: 'middle', fontSize: '13px', color: '#374151', fontFamily: "'Inter', sans-serif" },
}

export default WealthScreening

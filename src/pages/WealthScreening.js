import React, { useState, useRef } from 'react'

// ─── Known constituent profiles ───────────────────────────────────────────────

const WEALTH_PROFILES = {
  88001: {
    name: 'Abbott, Claire L.', rating: 'A', ratingColor: '#16a34a',
    netWorth: '$2.4M–$3.1M', capacity: '$24,000/yr', confidence: 'High',
    philanthropicGiver: 'Yes',
    causeSupported: 'Arts & Culture, Education',
    donorAdvisedFund: 'Yes',
    boardMember: 'Yes',
    moneyInMotion: 'No',
    smallBizOwner: 'No',
    realEstate: '2 properties (est. $1.1M)',
    publicGifts: [
      { org: 'Charleston Symphony', amount: '$2,500' },
      { org: 'MUSC Foundation', amount: '$1,000' },
      { org: 'College of Charleston', amount: '$5,000' },
    ],
  },
  88003: {
    name: 'Chen, Wei', rating: 'B+', ratingColor: '#0369a1',
    netWorth: '$620K–$840K', capacity: '$6,200/yr', confidence: 'Medium',
    philanthropicGiver: 'Yes',
    causeSupported: 'Arts & Culture',
    donorAdvisedFund: 'No',
    boardMember: 'No',
    moneyInMotion: 'Yes',
    smallBizOwner: 'No',
    realEstate: '1 property (est. $520K)',
    publicGifts: [{ org: 'Arts Center of Charleston', amount: '$500' }],
  },
  88007: {
    name: 'Harrison, Nathaniel', rating: 'A+', ratingColor: '#7c3aed',
    netWorth: '$8.2M–$11.4M', capacity: '$82,000/yr', confidence: 'High',
    philanthropicGiver: 'Yes',
    causeSupported: 'Arts & Culture, Historic Preservation, Healthcare',
    donorAdvisedFund: 'Yes',
    boardMember: 'Yes',
    moneyInMotion: 'Yes',
    smallBizOwner: 'Yes',
    realEstate: '4 properties (est. $4.3M)',
    publicGifts: [
      { org: 'Gibbes Museum of Art', amount: '$25,000' },
      { org: 'Spoleto Festival USA', amount: '$10,000' },
      { org: 'Historic Charleston Foundation', amount: '$15,000' },
    ],
  },
  88005: {
    name: 'Fletcher, James R.', rating: 'C', ratingColor: '#d97706',
    netWorth: '$180K–$290K', capacity: '$1,800/yr', confidence: 'Low',
    philanthropicGiver: 'Yes',
    causeSupported: 'Arts & Culture',
    donorAdvisedFund: 'No',
    boardMember: 'No',
    moneyInMotion: 'No',
    smallBizOwner: 'No',
    realEstate: 'No properties identified',
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
  const causes = ['Arts & Culture', 'Education', 'Healthcare', 'Environment', 'Arts & Culture, Education', 'Arts & Culture, Historic Preservation']
  return {
    name, rating: rt.r, ratingColor: rt.c,
    netWorth:          `$${350 + (n % 800)}K–$${600 + (n % 900)}K`,
    capacity:          `$${3 + (n % 9)},${String(n % 100).padStart(2, '0')}0/yr`,
    confidence:        n % 3 === 0 ? 'High' : n % 3 === 1 ? 'Medium' : 'Low',
    philanthropicGiver: n % 4 !== 3 ? 'Yes' : 'No',
    causeSupported:    causes[n % causes.length],
    donorAdvisedFund:  n % 3 === 0 ? 'Yes' : 'No',
    boardMember:       n % 5 === 0 ? 'Yes' : 'No',
    moneyInMotion:     n % 4 === 1 ? 'Yes' : 'No',
    smallBizOwner:     n % 6 === 0 ? 'Yes' : 'No',
    realEstate:        n % 2 === 0 ? '1 property (est. $310K)' : 'No properties identified',
    publicGifts:       n % 2 === 0 ? [{ org: 'Local Arts Council', amount: '$250' }] : [],
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

const RATING_COLOR = { 'A+': '#7c3aed', 'A': '#16a34a', 'B+': '#0369a1', 'B': '#0369a1', 'B-': '#0369a1', 'C+': '#d97706', 'C': '#d97706' }
const RATING_ORDER = { 'A+': 0, 'A': 1, 'B+': 2, 'B': 3, 'B-': 4, 'C+': 5, 'C': 6 }

// ─── Fake lists ───────────────────────────────────────────────────────────────

const FAKE_LISTS = [
  { id: 4201, name: 'Donors >$500 last 12 months — no 2024 subscription',        category: 'Annual Fund',   size: 12 },
  { id: 4202, name: 'Lapsed subscribers — attended 3+ shows in prior 3 seasons',  category: 'Subscriptions', size: 8  },
  { id: 4203, name: 'First-time buyers 2024 season — no follow-up gift',           category: 'Acquisition',   size: 18 },
  { id: 2201, name: 'Annual Fund Appeal 2024 — Lapsed Donors',                     category: 'Annual Fund',   size: 15 },
  { id: 2204, name: 'Spring Appeal — Under-40 Donors',                             category: 'Annual Fund',   size: 9  },
  { id: 2206, name: '5+ Year Ticket Buyers No Recent Gift',                         category: 'Reactivation',  size: 22 },
  { id: 3101, name: 'Board Prospect Pipeline FY25',                                 category: 'Major Gifts',   size: 6  },
  { id: 3102, name: 'Mid-Level Donors $500–$4999 Lifetime',                         category: 'Major Gifts',   size: 11 },
  { id: 3103, name: 'Planned Giving Inquiry List',                                   category: 'Major Gifts',   size: 5  },
  { id: 5001, name: 'Opening Night Gala Invitees',                                   category: 'Events',        size: 14 },
  { id: 5002, name: 'Dress Rehearsal Invite List',                                    category: 'Events',        size: 10 },
  { id: 6001, name: 'Email Opt-In — No Gift History',                                category: 'Prospect',      size: 25 },
]

const CATEGORIES = ['All categories', ...Array.from(new Set(FAKE_LISTS.map(l => l.category))).sort()]

function buildListRows(listId) {
  const list = FAKE_LISTS.find(l => l.id === Number(listId))
  const count = list?.size || 10
  return Array.from({ length: count }, (_, i) => {
    const custNo = (Number(listId) * 100 + i + 1)
    const known  = WEALTH_PROFILES[custNo]
    return { custNo, ...(known || fakeWealthProfile(custNo)) }
  })
}

// ─── Shared sub-components ────────────────────────────────────────────────────

function TabButton({ label, active, onClick }) {
  return <button style={active ? s.tabActive : s.tab} onClick={onClick}>{label}</button>
}

function RatingBadge({ rating, color, size = 'lg' }) {
  const big = size === 'lg'
  return (
    <div style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', background: color + '12', border: `1px solid ${color}30`, borderRadius: '10px', padding: big ? '10px 18px' : '6px 12px' }}>
      <span style={{ fontSize: big ? '28px' : '16px', fontWeight: '900', color, fontFamily: "'Space Grotesk', sans-serif", lineHeight: 1 }}>{rating}</span>
      {big && (
        <span style={{ fontSize: '10px', color, fontWeight: '700', letterSpacing: '0.04em', marginTop: '2px', fontFamily: "'Inter', sans-serif" }}>
          {RATING_DESC[rating] || 'Capacity rating'}
        </span>
      )}
    </div>
  )
}

function YesNoPill({ value }) {
  const yes = value === 'Yes'
  return (
    <span style={{ fontSize: '12px', fontWeight: '600', color: yes ? '#16a34a' : '#9ca3af', fontFamily: "'Inter', sans-serif" }}>
      {yes ? '✓ Yes' : '✕ No'}
    </span>
  )
}

// ─── Single Constituent tab ───────────────────────────────────────────────────

function SingleConstituentTab({ onUse }) {
  const [custNo, setCustNo] = useState('')
  const [loading, setLoading] = useState(false)
  const [profile, setProfile] = useState(null)
  const [searched, setSearched] = useState(false)
  const [lastCustNo, setLastCustNo] = useState('')

  const handleScreen = async () => {
    if (!custNo.trim()) return
    setLoading(true); setProfile(null); setSearched(false)
    await new Promise(r => setTimeout(r, 1200))
    setLoading(false); setSearched(true); setLastCustNo(custNo)
    setProfile(WEALTH_PROFILES[Number(custNo)] || fakeWealthProfile(custNo))
    if (onUse) onUse(2)
  }

  return (
    <div>
      <div style={s.card}>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <div>
            <label style={s.fieldLabel}>Constituent #</label>
            <input value={custNo} onChange={e => setCustNo(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleScreen()} placeholder="e.g. 88001" style={{ ...s.input, width: '180px' }} />
          </div>
          <button onClick={handleScreen} disabled={!custNo.trim() || loading} style={{ ...s.btn, opacity: !custNo.trim() || loading ? 0.5 : 1, cursor: !custNo.trim() || loading ? 'not-allowed' : 'pointer' }}>
            {loading ? 'Screening…' : 'Screen Constituent'}
          </button>
        </div>
        {loading && <p style={s.loadingHint}>Querying wealth databases… checking public records…</p>}
      </div>

      {searched && profile && (
        <div style={s.card}>
          {/* Header */}
          <div style={s.resultHeader}>
            <div>
              <p style={s.constituentName}>{profile.name}</p>
              <p style={s.constituentSub}>Constituent #{lastCustNo}</p>
            </div>
            <RatingBadge rating={profile.rating} color={profile.ratingColor} />
          </div>

          {/* Net worth + capacity row */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '10px', marginBottom: '20px' }}>
            {[
              { label: 'Est. Net Worth',    value: profile.netWorth },
              { label: 'Giving Capacity',   value: profile.capacity },
              { label: 'Confidence',        value: profile.confidence },
              { label: 'Real Estate',       value: profile.realEstate },
            ].map(({ label, value }) => (
              <div key={label} style={s.metricCard}>
                <p style={s.metricLabel}>{label}</p>
                <p style={s.metricValue}>{value}</p>
              </div>
            ))}
          </div>

          {/* Philanthropic profile */}
          <p style={s.sectionLabel}>Philanthropic Profile</p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '10px', marginBottom: '20px' }}>
            {[
              { label: 'Philanthropic Giver',  value: <YesNoPill value={profile.philanthropicGiver} /> },
              { label: 'Donor-Advised Fund',   value: <YesNoPill value={profile.donorAdvisedFund} /> },
              { label: 'Nonprofit Board Seat', value: <YesNoPill value={profile.boardMember} /> },
              { label: 'Causes Supported',     value: <span style={{ fontSize: '12px', color: '#374151', fontFamily: "'Inter', sans-serif" }}>{profile.causeSupported}</span> },
            ].map(({ label, value }) => (
              <div key={label} style={s.metricCard}>
                <p style={s.metricLabel}>{label}</p>
                <div style={{ marginTop: '2px' }}>{value}</div>
              </div>
            ))}
          </div>

          {/* Financial signals */}
          <p style={s.sectionLabel}>Financial Signals</p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '10px', marginBottom: '20px' }}>
            {[
              { label: 'Money in Motion',   value: <YesNoPill value={profile.moneyInMotion} /> },
              { label: 'Small Business Owner', value: <YesNoPill value={profile.smallBizOwner} /> },
              { label: 'Multiple Properties',  value: <YesNoPill value={Number((profile.realEstate.match(/^(\d+)/) || ['','1'])[1]) > 1 ? 'Yes' : 'No'} /> },
            ].map(({ label, value }) => (
              <div key={label} style={s.metricCard}>
                <p style={s.metricLabel}>{label}</p>
                <div style={{ marginTop: '2px' }}>{value}</div>
              </div>
            ))}
          </div>

          {/* Public gifts */}
          {profile.publicGifts?.length > 0 && (
            <div>
              <p style={s.sectionLabel}>Publicly Recorded Gifts to Other Orgs</p>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                {profile.publicGifts.map((g, i) => <span key={i} style={s.giftPill}>{g.org} — {g.amount}</span>)}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Screen a List tab ────────────────────────────────────────────────────────

function ScreenListTab({ onUse }) {
  const [search, setSearch]           = useState('')
  const [category, setCategory]       = useState('All categories')
  const [selectedList, setSelectedList] = useState('')

  // Flow stages: idle → previewing → running → done
  const [stage, setStage]             = useState('idle')
  const [previewRows, setPreviewRows] = useState([])
  const [processed, setProcessed]     = useState(0)
  const [results, setResults]         = useState([])
  const [expandedRow, setExpandedRow] = useState(null)
  const cancelRef                     = useRef(false)

  const filteredLists = FAKE_LISTS.filter(l => {
    const matchCat = category === 'All categories' || l.category === category
    const matchSearch = !search.trim() || l.name.toLowerCase().includes(search.trim().toLowerCase())
    return matchCat && matchSearch
  })

  const selectedListObj = FAKE_LISTS.find(l => String(l.id) === String(selectedList))

  // Step 1: preview
  const handlePreview = async () => {
    if (!selectedList) return
    const rows = buildListRows(selectedList)
    setPreviewRows(rows)
    setProcessed(0)
    setResults([])
    setExpandedRow(null)
    cancelRef.current = false
    setStage('previewing')
  }

  // Step 2: run
  const handleConfirmRun = async () => {
    setStage('running')
    setProcessed(0)
    setResults([])
    cancelRef.current = false
    const done = []
    for (let i = 0; i < previewRows.length; i++) {
      if (cancelRef.current) break
      await new Promise(r => setTimeout(r, 120))
      done.push(previewRows[i])
      setProcessed(i + 1)
      setResults([...done])
    }
    setStage('done')
    if (!cancelRef.current && onUse) onUse(Math.max(1, Math.floor(previewRows.length / 5)))
  }

  const handleCancel = () => { cancelRef.current = true }

  const handleReset = () => {
    setStage('idle')
    setPreviewRows([])
    setProcessed(0)
    setResults([])
    setExpandedRow(null)
    cancelRef.current = false
  }

  // Stats from results
  const ratingCounts = results.reduce((acc, r) => {
    acc[r.rating] = (acc[r.rating] || 0) + 1
    return acc
  }, {})
  const highCapacity  = results.filter(r => ['A+','A'].includes(r.rating)).length
  const midCapacity   = results.filter(r => ['B+','B','B-'].includes(r.rating)).length
  const lowCapacity   = results.filter(r => ['C+','C'].includes(r.rating)).length
  const withDAF       = results.filter(r => r.donorAdvisedFund === 'Yes').length
  const boardMembers  = results.filter(r => r.boardMember === 'Yes').length

  const sortedResults = [...results].sort((a, b) => (RATING_ORDER[a.rating] ?? 9) - (RATING_ORDER[b.rating] ?? 9))

  return (
    <div>
      {/* List picker — only show when idle */}
      {stage === 'idle' && (
        <div style={s.card}>
          <h3 style={s.sectionHeading}>Screen a list</h3>
          <p style={s.sectionBody}>
            Select a list from Tessitura and Tess Buddy will run a wealth screen on every constituent —
            enriching their profile with net worth estimates, philanthropic indicators, and financial signals.
            Results are written back to the Attributes tab automatically.
          </p>
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'flex-end', marginBottom: '12px' }}>
            <div style={{ flex: '1', minWidth: '200px' }}>
              <label style={s.fieldLabel}>Search by list name</label>
              <input value={search} onChange={e => { setSearch(e.target.value); setSelectedList('') }} placeholder="Start typing to filter…" style={{ ...s.input, width: '100%', boxSizing: 'border-box' }} />
            </div>
            <div>
              <label style={s.fieldLabel}>Category</label>
              <select value={category} onChange={e => { setCategory(e.target.value); setSelectedList('') }} style={{ ...s.input, background: 'white', width: '180px' }}>
                {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-end', flexWrap: 'wrap' }}>
            <div style={{ flex: '1', minWidth: '260px' }}>
              <label style={s.fieldLabel}>Tessitura list</label>
              <select value={selectedList} onChange={e => setSelectedList(e.target.value)} style={{ ...s.input, background: 'white', width: '100%', boxSizing: 'border-box' }} disabled={filteredLists.length === 0}>
                <option value="">{filteredLists.length === 0 ? 'No lists match' : 'Choose a list…'}</option>
                {filteredLists.map(l => <option key={l.id} value={l.id}>#{l.id} — {l.name}</option>)}
              </select>
            </div>
            <button onClick={handlePreview} disabled={!selectedList} style={{ ...s.btn, opacity: !selectedList ? 0.5 : 1, cursor: !selectedList ? 'not-allowed' : 'pointer', whiteSpace: 'nowrap' }}>
              Start Screening
            </button>
          </div>
        </div>
      )}

      {/* Preview: confirm before running */}
      {stage === 'previewing' && (
        <div style={s.card}>
          <h3 style={s.sectionHeading}>Ready to screen {previewRows.length} constituents</h3>
          <p style={s.sectionBody}>
            Tess Buddy will run a full wealth screen on every constituent in <strong>{selectedListObj?.name}</strong>.
            Net worth, philanthropic profile, and financial signals will be written to each patron's Attributes tab.
          </p>
          <div style={{ display: 'flex', gap: '10px' }}>
            <button onClick={handleConfirmRun} style={s.btn}>Run Wealth Screening</button>
            <button onClick={handleReset} style={s.secondaryBtn}>Back</button>
          </div>
        </div>
      )}

      {/* Running: live progress */}
      {stage === 'running' && (
        <div style={s.card}>
          <h3 style={s.sectionHeading}>Screening {processed} of {previewRows.length}…</h3>
          <p style={{ ...s.sectionBody, margin: '0 0 12px' }}>
            {processed < previewRows.length
              ? `Querying wealth databases for ${sortedResults[sortedResults.length - 1]?.name || '…'}`
              : 'Wrapping up…'}
          </p>
          <div style={s.progressBar}>
            <div style={{ ...s.progressFill, width: `${previewRows.length === 0 ? 0 : Math.round((processed / previewRows.length) * 100)}%` }} />
          </div>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '16px' }}>
            <StatPill label="Screened" value={processed} color="#1d6fdb" />
            <StatPill label="High capacity" value={results.filter(r => ['A+','A'].includes(r.rating)).length} color="#16a34a" />
            <StatPill label="Mid capacity"  value={results.filter(r => ['B+','B','B-'].includes(r.rating)).length} color="#0369a1" />
            <StatPill label="Low capacity"  value={results.filter(r => ['C+','C'].includes(r.rating)).length} color="#d97706" />
          </div>
          <button onClick={handleCancel} style={{ ...s.secondaryBtn, marginTop: '16px' }}>Stop</button>
        </div>
      )}

      {/* Done: summary + results table */}
      {stage === 'done' && results.length > 0 && (
        <>
          {/* Summary card */}
          <div style={s.card}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px', flexWrap: 'wrap', gap: '8px' }}>
              <div>
                <h3 style={{ ...s.sectionHeading, margin: 0 }}>Screening complete</h3>
                <p style={{ fontSize: '12px', color: '#9ca3af', margin: '2px 0 0', fontFamily: "'Inter', sans-serif" }}>
                  {selectedListObj?.name} · {results.length} constituents screened
                </p>
              </div>
              <button onClick={handleReset} style={s.secondaryBtn}>Screen Another List</button>
            </div>

            {/* Capacity summary */}
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginBottom: '16px' }}>
              <StatPill label="High capacity (A/A+)" value={highCapacity}  color="#16a34a" />
              <StatPill label="Mid capacity (B)"      value={midCapacity}   color="#0369a1" />
              <StatPill label="Low capacity (C)"       value={lowCapacity}   color="#d97706" />
              <StatPill label="Donor-Advised Fund"     value={withDAF}       color="#7c3aed" />
              <StatPill label="Board members"          value={boardMembers}   color="#0891b2" />
            </div>

            {/* Rating distribution */}
            <p style={s.sectionLabel}>Rating breakdown</p>
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
              {Object.entries(RATING_ORDER).map(([r]) => {
                const count = ratingCounts[r] || 0
                if (!count) return null
                const col = RATING_COLOR[r] || '#6b7280'
                return (
                  <span key={r} style={{ fontSize: '12px', fontWeight: '700', color: col, background: col + '12', border: `1px solid ${col}30`, borderRadius: '100px', padding: '3px 10px', fontFamily: "'Inter', sans-serif" }}>
                    {r}: {count}
                  </span>
                )
              })}
            </div>
          </div>

          {/* Results table */}
          <div style={{ ...s.card, padding: 0, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
              <thead>
                <tr>
                  {['Rating', 'Name', '#', 'Net Worth', 'Capacity', 'DAF', 'Board', 'Confidence'].map(h => (
                    <th key={h} style={s.th}>{h}</th>
                  ))}
                  <th style={{ ...s.th, width: '28px' }} />
                </tr>
              </thead>
              <tbody>
                {sortedResults.map(row => {
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
                        <td style={{ ...s.td, fontFamily: 'ui-monospace,monospace', fontSize: '12px', color: '#6b7280' }}>#{row.custNo}</td>
                        <td style={s.td}>{row.netWorth}</td>
                        <td style={s.td}>{row.capacity}</td>
                        <td style={s.td}><YesNoPill value={row.donorAdvisedFund} /></td>
                        <td style={s.td}><YesNoPill value={row.boardMember} /></td>
                        <td style={s.td}>
                          <span style={{ color: row.confidence === 'High' ? '#16a34a' : row.confidence === 'Medium' ? '#d97706' : '#9ca3af', fontWeight: '600', fontSize: '12px' }}>● {row.confidence}</span>
                        </td>
                        <td style={s.td}><span style={{ fontSize: '10px', color: '#9ca3af' }}>{isExp ? '▲' : '▼'}</span></td>
                      </tr>

                      {isExp && (
                        <tr style={{ background: '#f8fafd' }}>
                          <td colSpan={9} style={{ padding: '14px 20px', borderBottom: '1px solid #f2f4f7' }}>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '8px', marginBottom: '10px' }}>
                              {[
                                { label: 'Real Estate',        value: row.realEstate },
                                { label: 'Money in Motion',    value: row.moneyInMotion },
                                { label: 'Small Biz Owner',    value: row.smallBizOwner },
                                { label: 'Causes Supported',   value: row.causeSupported },
                              ].map(({ label, value }) => (
                                <div key={label} style={{ background: 'white', borderRadius: '7px', padding: '9px 12px', border: '1px solid rgba(29,111,219,0.08)' }}>
                                  <p style={s.metricLabel}>{label}</p>
                                  <p style={{ ...s.metricValue, fontSize: '12px' }}>{value}</p>
                                </div>
                              ))}
                            </div>
                            {row.publicGifts?.length > 0 && (
                              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                                {row.publicGifts.map((g, i) => <span key={i} style={s.giftPill}>{g.org} — {g.amount}</span>)}
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
        </>
      )}
    </div>
  )
}

function StatPill({ label, value, color }) {
  return (
    <div style={{ padding: '10px 16px', borderRadius: '8px', border: `1.5px solid ${color}`, backgroundColor: 'white', minWidth: '90px', textAlign: 'center' }}>
      <div style={{ fontSize: '22px', fontWeight: '700', color, lineHeight: 1, fontFamily: "'Space Grotesk', sans-serif" }}>{value}</div>
      <div style={{ fontSize: '11px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.4px', marginTop: '4px', color, fontFamily: "'Inter', sans-serif" }}>{label}</div>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

function WealthScreening({ onUse }) {
  const [activeTab, setActiveTab] = useState('single')

  return (
    <div>
      <div style={s.header}>
        <h1 style={s.title}>Wealth Screening</h1>
        <p style={s.subtitle}>
          Know who your major donors are before you ask. Screen a single patron in seconds or run an
          entire list — net worth, philanthropic profile, and financial signals written straight to Tessitura.
        </p>
      </div>

      <div style={s.tabBar}>
        <TabButton label="Single Patron" active={activeTab === 'single'} onClick={() => setActiveTab('single')} />
        <TabButton label="Screen a List" active={activeTab === 'list'}   onClick={() => setActiveTab('list')} />
      </div>

      {activeTab === 'single' && <SingleConstituentTab onUse={onUse} />}
      {activeTab === 'list'   && <ScreenListTab onUse={onUse} />}
    </div>
  )
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = {
  header:   { marginBottom: '24px' },
  title:    { fontSize: '24px', fontWeight: '700', color: '#0c1a33', marginBottom: '4px', fontFamily: "'Space Grotesk', sans-serif", letterSpacing: '-0.02em' },
  subtitle: { fontSize: '13px', color: '#6b7280', fontFamily: "'Inter', sans-serif", lineHeight: '1.6', maxWidth: '600px' },

  tabBar:      { display: 'flex', gap: '4px', borderBottom: '1px solid rgba(29,111,219,0.15)', marginBottom: '24px' },
  tab:         { padding: '10px 18px', backgroundColor: 'transparent', color: '#4b5563', border: 'none', borderBottom: '2px solid transparent', fontSize: '14px', fontWeight: '500', cursor: 'pointer', fontFamily: "'Inter', sans-serif" },
  tabActive:   { padding: '10px 18px', backgroundColor: 'transparent', color: '#0c1a33', border: 'none', borderBottom: '2px solid #1d6fdb', fontSize: '14px', fontWeight: '700', cursor: 'pointer', fontFamily: "'Inter', sans-serif" },

  card:        { background: 'white', borderRadius: '12px', padding: '24px 28px', boxShadow: '0 2px 16px rgba(29,111,219,0.08)', border: '1px solid rgba(29,111,219,0.1)', marginBottom: '20px', maxWidth: '920px' },
  sectionHeading: { fontSize: '15px', fontWeight: '700', color: '#0c1a33', marginBottom: '6px', fontFamily: "'Space Grotesk', sans-serif" },
  sectionBody: { fontSize: '13px', color: '#4b5563', lineHeight: '1.6', marginBottom: '16px', maxWidth: '640px', fontFamily: "'Inter', sans-serif" },

  fieldLabel:  { display: 'block', fontSize: '11px', fontWeight: '700', color: '#374151', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '5px', fontFamily: "'Inter', sans-serif" },
  input:       { padding: '9px 14px', border: '1px solid rgba(29,111,219,0.2)', borderRadius: '8px', fontSize: '13px', fontFamily: "'Inter', sans-serif", outline: 'none' },
  btn:         { padding: '9px 22px', background: 'linear-gradient(135deg, #1d6fdb, #38bdf8)', color: 'white', border: 'none', borderRadius: '8px', fontSize: '13px', fontWeight: '600', fontFamily: "'Inter', sans-serif", cursor: 'pointer' },
  secondaryBtn:{ padding: '9px 18px', background: 'white', color: '#0c1a33', border: '1px solid rgba(29,111,219,0.2)', borderRadius: '8px', fontSize: '13px', fontWeight: '600', fontFamily: "'Inter', sans-serif", cursor: 'pointer' },
  loadingHint: { fontSize: '12px', color: '#9ca3af', marginTop: '10px', fontFamily: "'Inter', sans-serif", fontStyle: 'italic' },

  progressBar:  { height: '10px', width: '100%', backgroundColor: '#edf0f5', borderRadius: '6px', overflow: 'hidden', marginTop: '12px' },
  progressFill: { height: '100%', background: 'linear-gradient(90deg, #1d6fdb, #38bdf8)', transition: 'width 120ms linear' },

  resultHeader:    { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' },
  constituentName: { fontSize: '18px', fontWeight: '700', color: '#0c1a33', margin: 0, fontFamily: "'Space Grotesk', sans-serif" },
  constituentSub:  { fontSize: '12px', color: '#9ca3af', margin: '2px 0 0', fontFamily: "'Inter', sans-serif" },

  metricCard:  { background: '#f8fafd', borderRadius: '8px', padding: '12px 14px', border: '1px solid rgba(29,111,219,0.08)' },
  metricLabel: { fontSize: '10px', fontWeight: '700', letterSpacing: '0.06em', textTransform: 'uppercase', color: '#9ca3af', marginBottom: '4px', fontFamily: "'Inter', sans-serif" },
  metricValue: { fontSize: '13px', fontWeight: '600', color: '#0c1a33', margin: 0, fontFamily: "'Inter', sans-serif" },

  sectionLabel: { fontSize: '11px', fontWeight: '700', letterSpacing: '0.06em', textTransform: 'uppercase', color: '#9ca3af', marginBottom: '8px', fontFamily: "'Inter', sans-serif" },
  giftPill:     { background: 'rgba(29,111,219,0.07)', border: '1px solid rgba(29,111,219,0.15)', borderRadius: '100px', padding: '4px 12px', fontSize: '12px', color: '#1d6fdb', fontFamily: "'Inter', sans-serif", fontWeight: '500' },

  th: { textAlign: 'left', padding: '9px 14px', background: '#f8fafd', fontSize: '11px', fontWeight: '700', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.04em', fontFamily: "'Inter', sans-serif", borderBottom: '1px solid rgba(29,111,219,0.1)' },
  td: { padding: '10px 14px', verticalAlign: 'middle', fontSize: '13px', color: '#374151', fontFamily: "'Inter', sans-serif" },
}

export default WealthScreening

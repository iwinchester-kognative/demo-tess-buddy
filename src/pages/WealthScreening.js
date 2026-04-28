import React, { useState } from 'react'

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
    notes: 'Consistently active donor. Real estate appreciated 18% since last screen. Strong upgrade candidate.',
  },
  88003: {
    name: 'Chen, Wei', rating: 'B+', ratingColor: '#0369a1',
    netWorth: '$620K–$840K', capacity: '$6,200/yr', confidence: 'Medium',
    realEstate: '1 property (est. $520K)',
    stockHoldings: 'No public holdings identified',
    pastGiving: '$3,400 cumulative to your org',
    publicGifts: [
      { org: 'Arts Center of Charleston', amount: '$500' },
    ],
    notes: 'Mid-range capacity. First gift was $200; has increased consistently. May respond to a personal ask.',
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
    notes: 'Major gift prospect. Last solicitation was FY22 for $5K. Capacity suggests potential for a 6-figure ask.',
  },
  88005: {
    name: 'Fletcher, James R.', rating: 'C', ratingColor: '#d97706',
    netWorth: '$180K–$290K', capacity: '$1,800/yr', confidence: 'Low',
    realEstate: 'No properties identified',
    stockHoldings: 'No public holdings identified',
    pastGiving: '$890 cumulative to your org',
    publicGifts: [],
    notes: 'Limited capacity indicators. Primary driver of giving appears to be personal connection to programming.',
  },
}

function fakeWealthProfile(custNo) {
  const NAMES = ['Williams, Arthur J.', 'Patel, Priya S.', "O'Brien, Kathleen", 'Nguyen, Bao T.', 'Okonkwo, Emeka', 'Ramirez, Diana', 'Goldstein, Robert M.']
  const n = Number(custNo)
  const name = NAMES[n % NAMES.length]
  const ratings = [{ r: 'B', c: '#0369a1' }, { r: 'B+', c: '#0369a1' }, { r: 'C+', c: '#d97706' }, { r: 'B-', c: '#0369a1' }]
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
    notes: 'Screening data sourced from public records and philanthropic databases. Verify before soliciting.',
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

function WealthScreening() {
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
      <div style={s.header}>
        <h1 style={s.title}>Wealth Screening</h1>
        <p style={s.subtitle}>
          Look up a constituent's estimated wealth profile — net worth range, charitable giving
          capacity, real estate, and publicly recorded gifts — before you make an ask.
        </p>
      </div>

      {/* Search card */}
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
            style={{
              ...s.btn,
              opacity: !custNo.trim() || loading ? 0.5 : 1,
              cursor: !custNo.trim() || loading ? 'not-allowed' : 'pointer',
            }}
          >
            {loading ? 'Screening…' : 'Screen Constituent'}
          </button>
        </div>
        {loading && (
          <p style={s.loadingHint}>Querying wealth databases… checking public records…</p>
        )}
      </div>

      {/* Results */}
      {searched && profile && (
        <div style={s.card}>
          {/* Name + rating */}
          <div style={s.resultHeader}>
            <div>
              <p style={s.constituentName}>{profile.name}</p>
              <p style={s.constituentSub}>Constituent #{lastCustNo}</p>
            </div>
            <div style={{
              display: 'inline-flex', flexDirection: 'column', alignItems: 'center',
              background: profile.ratingColor + '12', border: `1px solid ${profile.ratingColor}30`,
              borderRadius: '10px', padding: '10px 18px',
            }}>
              <span style={{ fontSize: '28px', fontWeight: '900', color: profile.ratingColor, fontFamily: "'Space Grotesk', sans-serif", lineHeight: 1 }}>
                {profile.rating}
              </span>
              <span style={{ fontSize: '10px', color: profile.ratingColor, fontWeight: '700', letterSpacing: '0.04em', marginTop: '2px', fontFamily: "'Inter', sans-serif" }}>
                {RATING_DESC[profile.rating] || 'Capacity rating'}
              </span>
            </div>
          </div>

          {/* Metrics grid */}
          <div style={s.metricsGrid}>
            {[
              { label: 'Est. Net Worth',   value: profile.netWorth },
              { label: 'Giving Capacity',  value: profile.capacity },
              { label: 'Confidence',       value: profile.confidence },
              { label: 'Real Estate',      value: profile.realEstate },
              { label: 'Stock Holdings',   value: profile.stockHoldings },
              { label: 'Giving to You',    value: profile.pastGiving },
            ].map(({ label, value }) => (
              <div key={label} style={s.metricCard}>
                <p style={s.metricLabel}>{label}</p>
                <p style={s.metricValue}>{value}</p>
              </div>
            ))}
          </div>

          {/* Public gifts */}
          {profile.publicGifts && profile.publicGifts.length > 0 && (
            <div style={{ marginBottom: '16px' }}>
              <p style={s.sectionLabel}>Publicly Recorded Gifts to Other Orgs</p>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                {profile.publicGifts.map((g, i) => (
                  <span key={i} style={s.giftPill}>
                    {g.org} — {g.amount}
                  </span>
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

const s = {
  header: { marginBottom: '24px' },
  title: { fontSize: '24px', fontWeight: '700', color: '#0c1a33', marginBottom: '4px', fontFamily: "'Space Grotesk', sans-serif", letterSpacing: '-0.02em' },
  subtitle: { fontSize: '13px', color: '#6b7280', fontFamily: "'Inter', sans-serif", lineHeight: '1.6', maxWidth: '580px' },

  card: { background: 'white', borderRadius: '12px', padding: '24px 28px', boxShadow: '0 2px 16px rgba(29,111,219,0.08)', border: '1px solid rgba(29,111,219,0.1)', marginBottom: '20px', maxWidth: '860px' },

  fieldLabel: { display: 'block', fontSize: '11px', fontWeight: '700', color: '#374151', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '5px', fontFamily: "'Inter', sans-serif" },
  input: { padding: '9px 14px', border: '1px solid rgba(29,111,219,0.2)', borderRadius: '8px', fontSize: '14px', fontFamily: "'Inter', sans-serif", outline: 'none', width: '180px' },
  btn: { padding: '9px 22px', background: 'linear-gradient(135deg, #1d6fdb, #38bdf8)', color: 'white', border: 'none', borderRadius: '8px', fontSize: '13px', fontWeight: '600', fontFamily: "'Inter', sans-serif" },
  loadingHint: { fontSize: '12px', color: '#9ca3af', marginTop: '10px', fontFamily: "'Inter', sans-serif", fontStyle: 'italic' },

  resultHeader: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' },
  constituentName: { fontSize: '18px', fontWeight: '700', color: '#0c1a33', margin: 0, fontFamily: "'Space Grotesk', sans-serif" },
  constituentSub: { fontSize: '12px', color: '#9ca3af', margin: '2px 0 0', fontFamily: "'Inter', sans-serif" },

  metricsGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '12px', marginBottom: '20px' },
  metricCard: { background: '#f8fafd', borderRadius: '8px', padding: '12px 14px', border: '1px solid rgba(29,111,219,0.08)' },
  metricLabel: { fontSize: '10px', fontWeight: '700', letterSpacing: '0.06em', textTransform: 'uppercase', color: '#9ca3af', marginBottom: '4px', fontFamily: "'Inter', sans-serif" },
  metricValue: { fontSize: '13px', fontWeight: '600', color: '#0c1a33', margin: 0, fontFamily: "'Inter', sans-serif" },

  sectionLabel: { fontSize: '11px', fontWeight: '700', letterSpacing: '0.06em', textTransform: 'uppercase', color: '#9ca3af', marginBottom: '8px', fontFamily: "'Inter', sans-serif" },
  giftPill: { background: 'rgba(29,111,219,0.07)', border: '1px solid rgba(29,111,219,0.15)', borderRadius: '100px', padding: '4px 12px', fontSize: '12px', color: '#1d6fdb', fontFamily: "'Inter', sans-serif", fontWeight: '500' },

}

export default WealthScreening

import React, { useState } from 'react'

// ─── Fake weekly cumulative pacing data ──────────────────────────────────────
// Represents cumulative ticket + subscription revenue through each week of season

const WEEKLY_PACING = [
  { week: 1,  label: 'W1',  fy24: 84200,    fy25: 93100    },
  { week: 2,  label: 'W2',  fy24: 198400,   fy25: 218600   },
  { week: 3,  label: 'W3',  fy24: 387100,   fy25: 421300   },
  { week: 4,  label: 'W4',  fy24: 612300,   fy25: 658700   },
  { week: 5,  label: 'W5',  fy24: 891200,   fy25: 924400   },
  { week: 6,  label: 'W6',  fy24: 1124800,  fy25: 1189600  },
  { week: 7,  label: 'W7',  fy24: 1382500,  fy25: 1441200  },
  { week: 8,  label: 'W8',  fy24: 1614900,  fy25: 1671800  },
  { week: 9,  label: 'W9',  fy24: 1823700,  fy25: 1912400  },
  { week: 10, label: 'W10', fy24: 2014200,  fy25: 2124700  },
  { week: 11, label: 'W11', fy24: 2182600,  fy25: 2314100  },
  { week: 12, label: 'W12', fy24: 2341800,  fy25: 2472300  },
  { week: 13, label: 'W13', fy24: 2474200,  fy25: 2614800  },
  { week: 14, label: 'W14', fy24: 2581300,  fy25: 2742100  }, // ← current week
]

const CURRENT_WEEK = 14

// ─── KPI data ─────────────────────────────────────────────────────────────────
const KPIS = [
  { label: 'Cumulative Revenue',    fy25: '$2,742,100', fy24: '$2,581,300', delta: '+6.2%',  up: true  },
  { label: 'Subscription Revenue',  fy25: '$1,184,300', fy24: '$1,097,600', delta: '+7.9%',  up: true  },
  { label: 'Avg Ticket Value',      fy25: '$94.20',     fy24: '$88.50',     delta: '+6.4%',  up: true  },
  { label: 'Active Subscribers',    fy25: '4,218',      fy24: '4,089',      delta: '+3.2%',  up: true  },
  { label: 'New Donors (YTD)',       fy25: '847',        fy24: '754',        delta: '+12.3%', up: true  },
  { label: 'Avg Gift Amount',       fy25: '$1,247',     fy24: '$1,186',     delta: '+5.1%',  up: true  },
  { label: 'Transactions',          fy25: '29,108',     fy24: '29,166',     delta: '-0.2%',  up: false },
  { label: 'Unique Buyers',         fy25: '8,841',      fy24: '8,614',      delta: '+2.6%',  up: true  },
]

// ─── Week-over-week table ──────────────────────────────────────────────────────
const WOW_ROWS = [
  { week: 'W14 (current)', fy25_rev: '$160,700', fy24_rev: '$107,100', delta: '+50.0%', fy25_trx: 1708, fy24_trx: 1421 },
  { week: 'W13',           fy25_rev: '$142,700', fy24_rev: '$132,400', delta: '+7.8%',  fy25_trx: 1516, fy24_trx: 1402 },
  { week: 'W12',           fy25_rev: '$157,500', fy24_rev: '$159,600', delta: '-1.3%',  fy25_trx: 1672, fy24_trx: 1582 },
  { week: 'W11',           fy25_rev: '$141,800', fy24_rev: '$168,400', delta: '-15.8%', fy25_trx: 1507, fy24_trx: 1687 },
  { week: 'W10',           fy25_rev: '$212,300', fy24_rev: '$190,500', delta: '+11.4%', fy25_trx: 2255, fy24_trx: 1904 },
]

// ─── SVG Pacing Chart ─────────────────────────────────────────────────────────

function PacingChart({ data, currentWeek }) {
  const [tooltip, setTooltip] = useState(null)

  const W = 680
  const H = 260
  const PAD = { top: 20, right: 24, bottom: 36, left: 62 }
  const chartW = W - PAD.left - PAD.right
  const chartH = H - PAD.top - PAD.bottom

  const maxVal = Math.max(...data.map(d => Math.max(d.fy24, d.fy25)))
  const yMax = Math.ceil(maxVal / 500000) * 500000
  const xStep = chartW / (data.length - 1)

  const toX = (i) => PAD.left + i * xStep
  const toY = (v) => PAD.top + chartH - (v / yMax) * chartH

  const formatM = (v) => v >= 1000000 ? `$${(v / 1000000).toFixed(1)}M` : `$${(v / 1000).toFixed(0)}K`

  // Build SVG path strings
  const fy24Path = data.map((d, i) => `${i === 0 ? 'M' : 'L'}${toX(i)},${toY(d.fy24)}`).join(' ')
  const fy25Path = data.map((d, i) => `${i === 0 ? 'M' : 'L'}${toX(i)},${toY(d.fy25)}`).join(' ')

  // Fill area under FY25 line
  const fy25Area = `${fy25Path} L${toX(data.length - 1)},${PAD.top + chartH} L${toX(0)},${PAD.top + chartH} Z`

  // Y-axis ticks
  const yTicks = [0, 0.25, 0.5, 0.75, 1].map(p => p * yMax)

  const currentX = toX(currentWeek - 1)

  return (
    <div style={{ position: 'relative' }}>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto', display: 'block' }}>
        {/* Gridlines */}
        {yTicks.map((v, i) => (
          <line
            key={i}
            x1={PAD.left} y1={toY(v)}
            x2={W - PAD.right} y2={toY(v)}
            stroke="rgba(29,111,219,0.08)" strokeWidth="1"
          />
        ))}

        {/* Y-axis labels */}
        {yTicks.map((v, i) => (
          <text
            key={i}
            x={PAD.left - 8} y={toY(v) + 4}
            textAnchor="end"
            fontSize="10" fill="#9ca3af"
            fontFamily="Inter, sans-serif"
          >
            {formatM(v)}
          </text>
        ))}

        {/* X-axis labels */}
        {data.map((d, i) => (
          <text
            key={i}
            x={toX(i)} y={H - PAD.bottom + 16}
            textAnchor="middle"
            fontSize="10" fill={i === currentWeek - 1 ? '#1d6fdb' : '#9ca3af'}
            fontFamily="Inter, sans-serif"
            fontWeight={i === currentWeek - 1 ? '700' : '400'}
          >
            {d.label}
          </text>
        ))}

        {/* "Today" vertical line */}
        <line
          x1={currentX} y1={PAD.top}
          x2={currentX} y2={PAD.top + chartH}
          stroke="rgba(29,111,219,0.25)" strokeWidth="1.5" strokeDasharray="4,3"
        />
        <text x={currentX + 5} y={PAD.top + 10} fontSize="9" fill="#1d6fdb" fontFamily="Inter, sans-serif" fontWeight="600">
          Today
        </text>

        {/* FY25 fill */}
        <path d={fy25Area} fill="rgba(29,111,219,0.07)" />

        {/* FY24 line (dashed gray) */}
        <path d={fy24Path} fill="none" stroke="#cbd5e1" strokeWidth="2" strokeDasharray="5,3" />

        {/* FY25 line (solid blue) */}
        <path d={fy25Path} fill="none" stroke="#1d6fdb" strokeWidth="2.5" />

        {/* Interactive hover zones + dots */}
        {data.map((d, i) => (
          <g key={i}>
            <circle cx={toX(i)} cy={toY(d.fy24)} r="3" fill="white" stroke="#cbd5e1" strokeWidth="1.5" />
            <circle cx={toX(i)} cy={toY(d.fy25)} r="3.5" fill="white" stroke="#1d6fdb" strokeWidth="2" />
            {/* invisible wide hit area */}
            <rect
              x={toX(i) - 18} y={PAD.top}
              width="36" height={chartH}
              fill="transparent"
              onMouseEnter={() => setTooltip({ i, d, x: toX(i), y: Math.min(toY(d.fy24), toY(d.fy25)) - 12 })}
              onMouseLeave={() => setTooltip(null)}
              style={{ cursor: 'crosshair' }}
            />
          </g>
        ))}

        {/* Tooltip */}
        {tooltip && (
          <g>
            <rect
              x={Math.min(tooltip.x - 56, W - PAD.right - 120)}
              y={tooltip.y - 52}
              width="116" height="52"
              rx="6" fill="white"
              stroke="rgba(29,111,219,0.18)"
              strokeWidth="1"
              filter="url(#shadow)"
            />
            <text x={Math.min(tooltip.x - 56, W - PAD.right - 120) + 10} y={tooltip.y - 35} fontSize="11" fontWeight="700" fill="#0c1a33" fontFamily="Inter, sans-serif">
              {tooltip.d.label}
            </text>
            <text x={Math.min(tooltip.x - 56, W - PAD.right - 120) + 10} y={tooltip.y - 20} fontSize="10" fill="#1d6fdb" fontFamily="Inter, sans-serif">
              FY25: {formatM(tooltip.d.fy25)}
            </text>
            <text x={Math.min(tooltip.x - 56, W - PAD.right - 120) + 10} y={tooltip.y - 7} fontSize="10" fill="#94a3b8" fontFamily="Inter, sans-serif">
              FY24: {formatM(tooltip.d.fy24)}
            </text>
          </g>
        )}

        <defs>
          <filter id="shadow">
            <feDropShadow dx="0" dy="2" stdDeviation="4" floodOpacity="0.08" />
          </filter>
        </defs>
      </svg>

      {/* Legend */}
      <div style={{ display: 'flex', gap: '20px', marginTop: '8px', paddingLeft: '62px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <svg width="24" height="2" style={{ overflow: 'visible' }}>
            <line x1="0" y1="1" x2="24" y2="1" stroke="#1d6fdb" strokeWidth="2.5" />
          </svg>
          <span style={{ fontSize: '11px', color: '#4b5563', fontFamily: 'Inter, sans-serif' }}>FY25 (Current)</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <svg width="24" height="2" style={{ overflow: 'visible' }}>
            <line x1="0" y1="1" x2="24" y2="1" stroke="#cbd5e1" strokeWidth="2" strokeDasharray="5,3" />
          </svg>
          <span style={{ fontSize: '11px', color: '#4b5563', fontFamily: 'Inter, sans-serif' }}>FY24 (Prior Year)</span>
        </div>
      </div>
    </div>
  )
}

// ─── Tabs ─────────────────────────────────────────────────────────────────────

function TabBtn({ label, active, onClick }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: '7px 18px',
        border: 'none',
        borderBottom: active ? '2px solid #1d6fdb' : '2px solid transparent',
        background: 'none',
        fontSize: '13px',
        fontWeight: active ? '600' : '400',
        color: active ? '#1d6fdb' : '#6b7280',
        cursor: 'pointer',
        fontFamily: 'Inter, sans-serif',
        whiteSpace: 'nowrap',
      }}
    >
      {label}
    </button>
  )
}

// ─── Main component ────────────────────────────────────────────────────────────

function Dashboards() {
  const [activeTab, setActiveTab] = useState('pacing')

  return (
    <div>
      <div style={s.header}>
        <h1 style={s.title}>Dashboards</h1>
        <p style={s.subtitle}>Live views into your season performance — sales pacing, KPI trends, and week-over-week analysis.</p>
      </div>

      <div style={s.tabBar}>
        <TabBtn label="Sales Pacing"    active={activeTab === 'pacing'}  onClick={() => setActiveTab('pacing')}  />
        <TabBtn label="KPI Overview"    active={activeTab === 'kpi'}     onClick={() => setActiveTab('kpi')}     />
        <TabBtn label="Week-over-Week"  active={activeTab === 'wow'}     onClick={() => setActiveTab('wow')}     />
      </div>

      {activeTab === 'pacing' && <PacingTab />}
      {activeTab === 'kpi'    && <KpiTab />}
      {activeTab === 'wow'    && <WowTab />}
    </div>
  )
}

// ─── Pacing Tab ───────────────────────────────────────────────────────────────

function PacingTab() {
  const current = WEEKLY_PACING[CURRENT_WEEK - 1]
  const prior   = WEEKLY_PACING[CURRENT_WEEK - 2]
  const deltaVsPrior = (((current.fy25 - prior.fy25) / prior.fy25) * 100).toFixed(1)
  const deltaVsLY    = (((current.fy25 - current.fy24) / current.fy24) * 100).toFixed(1)

  return (
    <div style={s.panel}>
      {/* Summary chips */}
      <div style={s.chipRow}>
        <div style={s.summaryChip}>
          <span style={s.chipLabel}>Through Week {CURRENT_WEEK}</span>
          <span style={s.chipValue}>$2,742,100</span>
          <span style={{ ...s.chipDelta, color: '#16a34a' }}>+{deltaVsLY}% vs FY24</span>
        </div>
        <div style={s.summaryChip}>
          <span style={s.chipLabel}>vs Prior Week</span>
          <span style={s.chipValue}>+{deltaVsPrior}%</span>
          <span style={{ ...s.chipDelta, color: '#16a34a' }}>Week {CURRENT_WEEK} momentum</span>
        </div>
        <div style={s.summaryChip}>
          <span style={s.chipLabel}>Pacing to End of Season</span>
          <span style={s.chipValue}>$3.18M</span>
          <span style={{ ...s.chipDelta, color: '#16a34a' }}>+7.2% vs FY24 final</span>
        </div>
      </div>

      {/* Chart card */}
      <div style={s.card}>
        <p style={s.cardTitle}>Cumulative Season Revenue — FY25 vs FY24</p>
        <p style={s.cardHint}>Ticket sales + subscriptions only. Donations excluded.</p>
        <div style={{ marginTop: '16px' }}>
          <PacingChart data={WEEKLY_PACING} currentWeek={CURRENT_WEEK} />
        </div>
      </div>
    </div>
  )
}

// ─── KPI Tab ──────────────────────────────────────────────────────────────────

function KpiTab() {
  return (
    <div style={s.panel}>
      <p style={{ fontSize: '13px', color: '#6b7280', fontFamily: 'Inter, sans-serif', marginBottom: '20px' }}>
        All figures through Week {CURRENT_WEEK}. Compared to same point in FY24.
      </p>
      <div style={s.kpiGrid}>
        {KPIS.map((kpi, i) => (
          <div key={i} style={s.kpiCard}>
            <p style={s.kpiLabel}>{kpi.label}</p>
            <p style={s.kpiValue}>{kpi.fy25}</p>
            <div style={s.kpiFooter}>
              <span style={{ ...s.kpiDelta, color: kpi.up ? '#16a34a' : '#ef4444' }}>{kpi.delta}</span>
              <span style={s.kpiPrior}>vs {kpi.fy24} FY24</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Week-over-Week Tab ───────────────────────────────────────────────────────

function WowTab() {
  return (
    <div style={s.panel}>
      <div style={s.card}>
        <p style={s.cardTitle}>Weekly Revenue Comparison</p>
        <p style={s.cardHint}>FY25 vs FY24 for same week of season. Most recent first.</p>
        <table style={s.table}>
          <thead>
            <tr>
              {['Week', 'FY25 Revenue', 'FY24 Revenue', 'Change', 'FY25 Trx', 'FY24 Trx'].map(h => (
                <th key={h} style={s.th}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {WOW_ROWS.map((row, i) => {
              const isPositive = row.delta.startsWith('+')
              return (
                <tr key={i} style={{ background: i % 2 === 0 ? 'white' : '#f8fafd' }}>
                  <td style={s.td}>
                    <span style={{ fontWeight: i === 0 ? '600' : '400', color: i === 0 ? '#0c1a33' : '#374151' }}>
                      {row.week}
                    </span>
                  </td>
                  <td style={{ ...s.td, fontWeight: '600', color: '#0c1a33' }}>{row.fy25_rev}</td>
                  <td style={{ ...s.td, color: '#6b7280' }}>{row.fy24_rev}</td>
                  <td style={s.td}>
                    <span style={{
                      display: 'inline-block',
                      padding: '2px 8px',
                      borderRadius: '100px',
                      fontSize: '11px',
                      fontWeight: '600',
                      background: isPositive ? 'rgba(22,163,74,0.1)' : 'rgba(239,68,68,0.1)',
                      color: isPositive ? '#16a34a' : '#ef4444',
                    }}>
                      {row.delta}
                    </span>
                  </td>
                  <td style={{ ...s.td, color: '#374151' }}>{row.fy25_trx.toLocaleString()}</td>
                  <td style={{ ...s.td, color: '#9ca3af' }}>{row.fy24_trx.toLocaleString()}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = {
  header: { marginBottom: '24px' },
  title: { fontSize: '24px', fontWeight: '700', color: '#0c1a33', marginBottom: '4px', fontFamily: "'Space Grotesk', sans-serif", letterSpacing: '-0.02em' },
  subtitle: { fontSize: '13px', color: '#6b7280', fontFamily: "'Inter', sans-serif" },
  tabBar: { display: 'flex', borderBottom: '1px solid rgba(29,111,219,0.12)', marginBottom: '24px', gap: '4px' },
  panel: {},
  card: { background: 'white', borderRadius: '12px', padding: '24px', boxShadow: '0 2px 16px rgba(29,111,219,0.08)', border: '1px solid rgba(29,111,219,0.1)', marginBottom: '20px' },
  cardTitle: { fontSize: '14px', fontWeight: '700', color: '#0c1a33', marginBottom: '2px', fontFamily: "'Space Grotesk', sans-serif" },
  cardHint: { fontSize: '12px', color: '#9ca3af', fontFamily: "'Inter', sans-serif" },
  chipRow: { display: 'flex', gap: '14px', marginBottom: '20px', flexWrap: 'wrap' },
  summaryChip: { background: 'white', border: '1px solid rgba(29,111,219,0.12)', borderRadius: '10px', padding: '14px 18px', flex: '1', minWidth: '160px', display: 'flex', flexDirection: 'column', gap: '4px', boxShadow: '0 2px 8px rgba(29,111,219,0.06)' },
  chipLabel: { fontSize: '11px', fontWeight: '700', letterSpacing: '0.05em', textTransform: 'uppercase', color: '#9ca3af', fontFamily: "'Inter', sans-serif" },
  chipValue: { fontSize: '22px', fontWeight: '700', color: '#0c1a33', fontFamily: "'Space Grotesk', sans-serif" },
  chipDelta: { fontSize: '12px', fontWeight: '500', fontFamily: "'Inter', sans-serif" },
  kpiGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '14px' },
  kpiCard: { background: 'white', borderRadius: '10px', padding: '18px 20px', boxShadow: '0 2px 10px rgba(29,111,219,0.07)', border: '1px solid rgba(29,111,219,0.1)' },
  kpiLabel: { fontSize: '11px', fontWeight: '700', letterSpacing: '0.05em', textTransform: 'uppercase', color: '#9ca3af', marginBottom: '8px', fontFamily: "'Inter', sans-serif" },
  kpiValue: { fontSize: '26px', fontWeight: '700', color: '#0c1a33', marginBottom: '8px', fontFamily: "'Space Grotesk', sans-serif" },
  kpiFooter: { display: 'flex', alignItems: 'center', gap: '8px' },
  kpiDelta: { fontSize: '12px', fontWeight: '700', fontFamily: "'Inter', sans-serif" },
  kpiPrior: { fontSize: '11px', color: '#9ca3af', fontFamily: "'Inter', sans-serif" },
  table: { width: '100%', borderCollapse: 'collapse', marginTop: '16px', fontFamily: "'Inter', sans-serif" },
  th: { textAlign: 'left', fontSize: '11px', fontWeight: '700', letterSpacing: '0.05em', textTransform: 'uppercase', color: '#9ca3af', padding: '8px 12px', borderBottom: '1px solid rgba(29,111,219,0.1)' },
  td: { padding: '10px 12px', fontSize: '13px', borderBottom: '1px solid #f0f4f8', fontFamily: "'Inter', sans-serif" },
}

export default Dashboards

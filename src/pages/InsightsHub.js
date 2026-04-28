import React, { useState } from 'react'
import Dashboards from './Dashboards'
import Lifecycles from './Lifecycles'
import AiInsights from './AiInsights'

function InsightsHub({ onUse }) {
  const [activeTab, setActiveTab] = useState('dashboards')

  return (
    <div>
      <div style={s.header}>
        <h1 style={s.title}>Insights</h1>
        <p style={s.subtitle}>
          Sales pacing, patron lifecycles, and AI-powered analysis — all in one place.
        </p>
      </div>

      <div style={s.tabBar}>
        <button style={activeTab === 'dashboards' ? s.tabActive : s.tab} onClick={() => setActiveTab('dashboards')}>Dashboards</button>
        <button style={activeTab === 'lifecycles' ? s.tabActive : s.tab} onClick={() => setActiveTab('lifecycles')}>Lifecycles</button>
        <button style={activeTab === 'ai'         ? s.tabActive : s.tab} onClick={() => setActiveTab('ai')}>AI Chat</button>
      </div>

      {activeTab === 'dashboards' && <Dashboards embedded />}
      {activeTab === 'lifecycles' && <Lifecycles embedded />}
      {activeTab === 'ai'         && <AiInsights embedded onUse={onUse} />}
    </div>
  )
}

const s = {
  header:   { marginBottom: '24px' },
  title:    { fontSize: '24px', fontWeight: '700', color: '#0c1a33', marginBottom: '4px', fontFamily: "'Space Grotesk', sans-serif", letterSpacing: '-0.02em' },
  subtitle: { fontSize: '13px', color: '#6b7280', fontFamily: "'Inter', sans-serif", lineHeight: '1.6', maxWidth: '580px' },
  tabBar:   { display: 'flex', gap: '4px', borderBottom: '1px solid rgba(29,111,219,0.15)', marginBottom: '28px' },
  tab:      { padding: '10px 18px', backgroundColor: 'transparent', color: '#4b5563', border: 'none', borderBottom: '2px solid transparent', fontSize: '14px', fontWeight: '500', cursor: 'pointer', fontFamily: "'Inter', sans-serif" },
  tabActive:{ padding: '10px 18px', backgroundColor: 'transparent', color: '#0c1a33', border: 'none', borderBottom: '2px solid #1d6fdb', fontSize: '14px', fontWeight: '700', cursor: 'pointer', fontFamily: "'Inter', sans-serif" },
}

export default InsightsHub

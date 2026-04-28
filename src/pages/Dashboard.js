import React, { useState, useEffect } from 'react'
import { supabase } from '../supabaseClient'
import ConstituentMerge, { ScheduleAutoMergeTool, OneOffMergeTool, SeparateHHTool, UnmergeTool } from './ConstituentMerge'
import AgedRecordRemoval from './AgedRecordRemoval'
import Screening from './Screening'
import BuildSegment, { PromoCodeTool, SourceCodeTool, PromoteToSourceTool } from './BuildSegment'
import WealthScreening from './WealthScreening'
import InsightsHub from './InsightsHub'

function NavItem({ icon, label, active, onClick }) {
  return (
    <button onClick={onClick} style={{
      display: 'flex', alignItems: 'center', gap: '9px',
      width: '100%', textAlign: 'left', border: 'none', cursor: 'pointer',
      padding: '10px 10px', borderRadius: '8px', marginBottom: '1px',
      minHeight: '44px',
      background: active ? 'rgba(29,111,219,0.09)' : 'transparent',
      color: active ? '#1d6fdb' : '#4b5563',
      fontSize: '13px', fontWeight: active ? '600' : '400',
      fontFamily: "'Inter', sans-serif",
    }}>
      <span style={{ fontSize: '16px', width: '22px', textAlign: 'center', flexShrink: 0, lineHeight: 1, opacity: active ? 1 : 0.7 }}>{icon}</span>
      {label}
    </button>
  )
}

function HomeQuickTools() {
  const [lastSourceCode, setLastSourceCode] = useState(null)
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '14px', gridAutoRows: 'minmax(220px, auto)' }}>
      <PromoCodeTool       flat active={false} />
      <SourceCodeTool      flat active={false} onCreated={code => setLastSourceCode(code)} />
      <PromoteToSourceTool flat active={false} defaultSourceCode={lastSourceCode} />
      <ScheduleAutoMergeTool />
      <OneOffMergeTool />
      <SeparateHHTool />
      <UnmergeTool />
    </div>
  )
}

const CREDIT_LIMIT = 500

function Dashboard({ session, orgData }) {
  const [apiStatus, setApiStatus] = useState('checking')
  const [activePage, setActivePage] = useState('dashboard')
  const [optimizing, setOptimizing] = useState(false)
  const [optimizeResult, setOptimizeResult] = useState(null)
  const [credits, setCredits] = useState(47)
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768)
  const [sidebarOpen, setSidebarOpen] = useState(false)

  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth <= 768)
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  const addCredits = (n = 1) => setCredits(prev => Math.min(prev + n, CREDIT_LIMIT))

  const handleOptimizeIntegrations = async () => {
    setOptimizing(true)
    setOptimizeResult(null)
    await new Promise(r => setTimeout(r, 1800))
    setOptimizeResult({ total: 14382, created: 3247, alreadyHad: 11135, ranAt: new Date().toLocaleTimeString() })
    setOptimizing(false)
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
  }

  const navigateTo = (page) => {
    setActivePage(page)
    if (isMobile) setSidebarOpen(false)
  }

  useEffect(() => {
    const checkConnection = async () => {
      try {
        const authString = orgData.organizations.tessitura_auth_string
        const baseUrl = orgData.organizations.tessitura_base_url

        const response = await fetch(`/api/tessitura?endpoint=Diagnostics/Status`, {
          method: 'GET',
          headers: {
            'x-tessitura-auth': authString,
            'x-tessitura-url': baseUrl
          }
        })

        if (response.ok) {
          setApiStatus('connected')
        } else {
          setApiStatus('error')
        }
      } catch (err) {
        console.error('API check failed:', err)
        setApiStatus('error')
      }
    }

    checkConnection()
  }, [orgData])

  const statusConfig = {
    checking: { color: '#9ca3af', dot: '#9ca3af', label: 'Checking connection...' },
    connected: { color: '#22c55e', dot: '#22c55e', label: 'Tessitura Connected' },
    error: { color: '#f87171', dot: '#f87171', label: 'Connection Failed' }
  }

  const status = statusConfig[apiStatus]

  const pageLabels = {
    dashboard: 'Home',
    constituentMerge: 'Constituent Merge',
    agedRecordRemoval: 'Aged Record Removal',
    screening: 'Contact Screening',
    wealthScreening: 'Wealth Screening',
    buildSegment: 'Segments',
    insights: 'Insights',
  }

  const sidebarStyle = isMobile ? {
    ...styles.sidebar,
    position: 'fixed',
    top: 0,
    left: sidebarOpen ? 0 : '-240px',
    height: '100%',
    zIndex: 1000,
    transition: 'left 0.25s ease',
    boxShadow: sidebarOpen ? '4px 0 24px rgba(0,0,0,0.15)' : 'none',
    width: '240px',
  } : styles.sidebar

  return (
    <div style={styles.container}>

      {/* Mobile overlay backdrop */}
      {isMobile && sidebarOpen && (
        <div
          onClick={() => setSidebarOpen(false)}
          style={styles.overlay}
        />
      )}

      {/* Sidebar */}
      <div style={sidebarStyle}>
        <p style={styles.orgName}>{orgData.organizations.org_name}</p>

        <nav style={{ flex: 1 }}>
          <NavItem icon="⊞" label="Home"                 active={activePage === 'dashboard'}        onClick={() => navigateTo('dashboard')} />
          <div style={styles.navSep} />
          <NavItem icon="🔀" label="Constituent Merge"   active={activePage === 'constituentMerge'} onClick={() => navigateTo('constituentMerge')} />
          <NavItem icon="🗂️" label="Aged Record Removal" active={activePage === 'agedRecordRemoval'} onClick={() => navigateTo('agedRecordRemoval')} />
          <div style={styles.navSep} />
          <NavItem icon="✉️" label="Contact Screening"   active={activePage === 'screening'}        onClick={() => navigateTo('screening')} />
          <NavItem icon="💎" label="Wealth Screening"    active={activePage === 'wealthScreening'}  onClick={() => navigateTo('wealthScreening')} />
          <div style={styles.navSep} />
          <NavItem icon="🎯" label="Segments"            active={activePage === 'buildSegment'}     onClick={() => navigateTo('buildSegment')} />
          <NavItem icon="💡" label="Insights"            active={activePage === 'insights'}         onClick={() => navigateTo('insights')} />
        </nav>

        <div style={styles.sidebarFooter}>
          <div style={styles.usageBlock}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '6px' }}>
              <span style={styles.usageLabel}>Credits Used</span>
              <span style={styles.usageCount}>{credits} <span style={{ fontWeight: '400', color: '#9ca3af' }}>/ {CREDIT_LIMIT}</span></span>
            </div>
            <div style={styles.usageTrack}>
              <div style={{
                ...styles.usageFill,
                width: `${Math.min((credits / CREDIT_LIMIT) * 100, 100)}%`,
                background: credits / CREDIT_LIMIT > 0.85 ? 'linear-gradient(90deg, #f59e0b, #ef4444)' :
                            credits / CREDIT_LIMIT > 0.6  ? 'linear-gradient(90deg, #1d6fdb, #f59e0b)' :
                            'linear-gradient(90deg, #1d6fdb, #38bdf8)',
              }} />
            </div>
            <p style={styles.usageHint}>
              {credits / CREDIT_LIMIT > 0.85 ? '⚠️ Approaching limit' :
               credits / CREDIT_LIMIT > 0.6  ? 'Moderate usage' :
               'Usage within normal range'}
            </p>
          </div>
          <div style={styles.statusRow}>
            <div style={{ ...styles.statusDot, backgroundColor: status.dot }} />
            <span style={{ ...styles.statusLabel, color: status.color, flex: 1 }}>{status.label}</span>
            <button style={styles.logoutInline} onClick={handleLogout}>Sign out</button>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div style={{ ...styles.main, padding: isMobile ? '16px' : '48px' }}>

        {/* Mobile top bar */}
        {isMobile && (
          <div style={styles.mobileTopBar}>
            <button style={styles.hamburger} onClick={() => setSidebarOpen(o => !o)} aria-label="Open menu">
              <span style={styles.hamburgerLine} />
              <span style={styles.hamburgerLine} />
              <span style={styles.hamburgerLine} />
            </button>
            <span style={styles.mobilePageTitle}>{pageLabels[activePage] || 'Tess Buddy'}</span>
          </div>
        )}

        <div style={{ ...styles.demoBanner, marginTop: isMobile ? '12px' : '0' }}>
          🎭 Have you ever wanted to click random buttons in Tessitura without the fear of breaking something? Well, go crazy! This is a testing environment.
        </div>

        {activePage === 'dashboard' && (
          <>
            <div style={styles.header}>
              <h1 style={{ ...styles.welcome, fontSize: isMobile ? '22px' : '26px' }}>Welcome back, {orgData.display_name}</h1>
              <p style={styles.role}>{orgData.role}</p>
            </div>

            {/* ── Record Cleaning ── */}
            <div style={styles.section}>
              <p style={styles.sectionChip}>Record Cleaning</p>
              <div style={{ ...styles.cardRow, flexDirection: isMobile ? 'column' : 'row' }}>

                <div style={styles.statCard}>
                  <p style={styles.statLabel}>Merges Completed</p>
                  <p style={styles.statValue}>1,247</p>
                  <p style={styles.statHint}>Total constituent merges executed to date</p>
                </div>

                <div style={styles.statCard}>
                  <p style={styles.statLabel}>Top Duplicate Sources</p>
                  <div style={styles.sourceList}>
                    <div style={styles.sourceRow}>
                      <span style={styles.sourceDot} />
                      <span style={styles.sourceLabel}>TrueTix import</span>
                      <span style={styles.sourceValue}>54%</span>
                    </div>
                    <div style={styles.sourceRow}>
                      <span style={{ ...styles.sourceDot, backgroundColor: '#2b6cb0' }} />
                      <span style={styles.sourceLabel}>DON2 import</span>
                      <span style={styles.sourceValue}>29%</span>
                    </div>
                    <div style={styles.sourceRow}>
                      <span style={{ ...styles.sourceDot, backgroundColor: '#805ad5' }} />
                      <span style={styles.sourceLabel}>Manual entry</span>
                      <span style={styles.sourceValue}>17%</span>
                    </div>
                  </div>
                  <p style={styles.statHint}>created_by breakdown from t_customer</p>
                </div>

                <div style={styles.statCard}>
                  <p style={styles.statLabel}>Aged Records Removed</p>
                  <p style={styles.statValue}>4,218</p>
                  <p style={styles.statHint}>Inactive constituents removed to date</p>
                </div>

                <div style={{ ...styles.statCard, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                  <div>
                    <p style={styles.statLabel}>Optimize Integrations</p>
                    <p style={styles.optimizeDesc}>
                      Ensure every constituent record has a login so your integrations can match them correctly.
                    </p>
                  </div>
                  {optimizeResult && (
                    <div style={styles.optimizeResult}>
                      <div style={styles.optimizeRow}><span style={styles.optimizeKey}>Records scanned</span><span style={styles.optimizeVal}>{optimizeResult.total.toLocaleString()}</span></div>
                      <div style={styles.optimizeRow}><span style={styles.optimizeKey}>Logins created</span><span style={{ ...styles.optimizeVal, color: '#16a34a', fontWeight: 700 }}>{optimizeResult.created.toLocaleString()}</span></div>
                      <div style={styles.optimizeRow}><span style={styles.optimizeKey}>Already had login</span><span style={styles.optimizeVal}>{optimizeResult.alreadyHad.toLocaleString()}</span></div>
                      <div style={styles.optimizeRow}><span style={styles.optimizeKey}>Completed at</span><span style={styles.optimizeVal}>{optimizeResult.ranAt}</span></div>
                    </div>
                  )}
                  <button
                    style={{ ...styles.actionButton, marginTop: '12px', opacity: optimizing ? 0.6 : 1, cursor: optimizing ? 'not-allowed' : 'pointer' }}
                    onClick={handleOptimizeIntegrations}
                    disabled={optimizing}
                  >
                    {optimizing ? 'Optimizing...' : optimizeResult ? 'Run Again' : 'Run Optimization'}
                  </button>
                </div>

              </div>
            </div>

            {/* ── Quick Tools ── */}
            <div style={styles.section}>
              <p style={styles.sectionChip}>Quick Tools</p>
              <div style={{ maxWidth: '960px' }}>
                <HomeQuickTools />
              </div>
            </div>
          </>
        )}
        {activePage === 'constituentMerge' && (
          <ConstituentMerge orgData={orgData} onUse={addCredits} />
        )}
        {activePage === 'agedRecordRemoval' && (
          <AgedRecordRemoval orgData={orgData} />
        )}
        {activePage === 'screening' && (
          <Screening orgData={orgData} onUse={addCredits} />
        )}
        {activePage === 'wealthScreening' && (
          <WealthScreening onUse={addCredits} />
        )}
        {activePage === 'buildSegment' && (
          <BuildSegment orgData={orgData} />
        )}
        {activePage === 'insights' && (
          <InsightsHub onUse={addCredits} />
        )}
      </div>
    </div>
  )
}

const styles = {
  container: { display: 'flex', height: '100vh', background: '#f0f7ff' },
  overlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 999 },
  sidebar: { width: '220px', backgroundColor: 'white', borderRight: '1px solid rgba(29,111,219,0.1)', padding: '20px 12px', display: 'flex', flexDirection: 'column', flexShrink: 0, boxShadow: '2px 0 16px rgba(29,111,219,0.05)' },
  logo: { color: '#0c1a33', fontSize: '20px', fontWeight: '700', margin: 0 },
  orgName: { color: '#b0bac5', fontSize: '11px', fontWeight: '500', letterSpacing: '0.3px', paddingLeft: '10px', marginBottom: '16px', fontFamily: "'Inter', sans-serif", whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
  navSep: { height: '1px', background: 'rgba(29,111,219,0.07)', margin: '6px 4px' },
  sidebarFooter: { borderTop: '1px solid rgba(29,111,219,0.07)', paddingTop: '12px' },
  statusRow: { display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 2px' },
  statusDot: { width: '7px', height: '7px', borderRadius: '50%', flexShrink: 0 },
  statusLabel: { fontSize: '11px', fontWeight: '500', fontFamily: "'Inter', sans-serif" },
  logoutInline: { background: 'none', border: 'none', color: '#9ca3af', fontSize: '11px', fontFamily: "'Inter', sans-serif", cursor: 'pointer', padding: '2px 4px', borderRadius: '4px', flexShrink: 0 },
  mobileTopBar: { display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '4px' },
  hamburger: { background: 'none', border: 'none', cursor: 'pointer', padding: '8px', display: 'flex', flexDirection: 'column', gap: '5px', borderRadius: '8px', flexShrink: 0 },
  hamburgerLine: { display: 'block', width: '22px', height: '2px', background: '#0c1a33', borderRadius: '2px' },
  mobilePageTitle: { fontFamily: "'Space Grotesk', sans-serif", fontSize: '17px', fontWeight: '600', color: '#0c1a33', letterSpacing: '-0.3px' },
  demoBanner: { background: 'linear-gradient(135deg, rgba(29,111,219,0.08), rgba(56,189,248,0.08))', border: '1px solid rgba(29,111,219,0.2)', borderRadius: '10px', padding: '10px 16px', marginBottom: '20px', fontSize: '13px', color: '#1d6fdb', fontFamily: "'Inter', sans-serif" },
  main: { flex: 1, padding: '48px', overflowY: 'auto', background: '#f0f7ff', minWidth: 0 },
  header: { marginBottom: '32px' },
  welcome: { fontSize: '26px', fontWeight: '700', color: '#0c1a33', marginBottom: '4px', fontFamily: "'Space Grotesk', sans-serif", letterSpacing: '-0.02em' },
  role: { fontSize: '13px', color: '#4b5563', textTransform: 'capitalize', fontFamily: "'Inter', sans-serif" },
  infoCard: { backgroundColor: 'white', borderRadius: '12px', padding: '24px', marginBottom: '24px', maxWidth: '500px', boxShadow: '0 2px 16px rgba(29,111,219,0.08)', border: '1px solid rgba(29,111,219,0.1)' },
  infoLabel: { fontSize: '11px', fontWeight: '700', letterSpacing: '1px', textTransform: 'uppercase', color: '#9ca3af', marginBottom: '4px', marginTop: '16px', fontFamily: "'Inter', sans-serif" },
  infoValue: { fontSize: '14px', color: '#0c1a33', fontWeight: '500', fontFamily: "'Inter', sans-serif" },
  section: { marginBottom: '36px' },
  sectionChip: { display: 'inline-block', fontSize: '10px', fontWeight: '700', color: '#1d6fdb', background: 'rgba(29,111,219,0.07)', border: '1px solid rgba(29,111,219,0.15)', borderRadius: '100px', padding: '3px 10px', letterSpacing: '0.04em', textTransform: 'uppercase', fontFamily: "'Inter', sans-serif", marginBottom: '14px' },
  cardRow: { display: 'flex', gap: '16px', flexWrap: 'wrap' },
  statCard: { backgroundColor: 'white', borderRadius: '12px', padding: '20px', flex: '1', minWidth: '180px', boxShadow: '0 2px 16px rgba(29,111,219,0.08)', border: '1px solid rgba(29,111,219,0.1)' },
  statLabel: { fontSize: '11px', fontWeight: '700', letterSpacing: '1px', textTransform: 'uppercase', color: '#9ca3af', marginBottom: '8px', fontFamily: "'Inter', sans-serif" },
  statValue: { fontSize: '32px', fontWeight: '700', color: '#0c1a33', marginBottom: '4px', fontFamily: "'Space Grotesk', sans-serif" },
  statHint: { fontSize: '12px', color: '#9ca3af', marginTop: '8px', fontFamily: "'Inter', sans-serif" },
  sourceList: { display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '4px' },
  sourceRow: { display: 'flex', alignItems: 'center', gap: '8px' },
  sourceDot: { width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#16a34a', flexShrink: 0 },
  sourceLabel: { fontSize: '13px', color: '#4b5563', flex: 1, fontFamily: "'Inter', sans-serif" },
  sourceValue: { fontSize: '14px', fontWeight: '600', color: '#0c1a33', fontFamily: "'Inter', sans-serif" },
  optimizeDesc: { fontSize: '13px', color: '#4b5563', lineHeight: '1.5', marginBottom: '10px', fontFamily: "'Inter', sans-serif" },
  optimizeResult: { backgroundColor: '#f8fafd', borderRadius: '8px', border: '1px solid rgba(29,111,219,0.12)', padding: '10px 14px', marginBottom: '4px' },
  optimizeRow: { display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: '1px solid #f0f3f8' },
  optimizeKey: { fontSize: '12px', color: '#6b7280', fontFamily: "'Inter', sans-serif" },
  optimizeVal: { fontSize: '12px', fontWeight: '600', color: '#0c1a33', fontFamily: "'Inter', sans-serif" },
  actionButton: { width: '100%', padding: '10px', background: 'linear-gradient(135deg, #1d6fdb, #38bdf8)', color: 'white', border: 'none', borderRadius: '8px', fontSize: '13px', fontWeight: '600', fontFamily: "'Inter', sans-serif", cursor: 'pointer' },
  grid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', maxWidth: '700px' },
  card: { backgroundColor: 'white', borderRadius: '12px', padding: '24px', boxShadow: '0 2px 16px rgba(29,111,219,0.08)', border: '1px solid rgba(29,111,219,0.1)' },
  cardTitle: { fontSize: '16px', fontWeight: '700', color: '#0c1a33', marginBottom: '8px', fontFamily: "'Space Grotesk', sans-serif" },
  cardDesc: { fontSize: '13px', color: '#4b5563', lineHeight: '1.6', fontFamily: "'Inter', sans-serif" },
  usageBlock: { margin: '16px 0 12px', padding: '12px 10px', background: 'rgba(29,111,219,0.04)', borderRadius: '10px', border: '1px solid rgba(29,111,219,0.1)' },
  usageLabel: { fontSize: '10px', fontWeight: '700', letterSpacing: '0.05em', textTransform: 'uppercase', color: '#9ca3af', fontFamily: "'Inter', sans-serif" },
  usageCount: { fontSize: '13px', fontWeight: '700', color: '#0c1a33', fontFamily: "'Inter', sans-serif" },
  usageTrack: { height: '6px', background: 'rgba(29,111,219,0.1)', borderRadius: '100px', overflow: 'hidden' },
  usageFill: { height: '100%', borderRadius: '100px', transition: 'width 0.4s ease' },
  usageHint: { fontSize: '10px', color: '#9ca3af', marginTop: '6px', fontFamily: "'Inter', sans-serif" }
}

export default Dashboard

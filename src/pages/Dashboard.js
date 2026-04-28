import React, { useState, useEffect } from 'react'
import { supabase } from '../supabaseClient'
import ConstituentMerge from './ConstituentMerge'
import AgedRecordRemoval from './AgedRecordRemoval'
import Screening from './Screening'
import BuildSegment from './BuildSegment'
import Dashboards from './Dashboards'
import AiInsights from './AiInsights'
import WealthScreening from './WealthScreening'
import Lifecycles from './Lifecycles'

function Dashboard({ session, orgData }) {
  const [apiStatus, setApiStatus] = useState('checking')
  const [activePage, setActivePage] = useState('dashboard')
  const [optimizing, setOptimizing] = useState(false)
  const [optimizeResult, setOptimizeResult] = useState(null)

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

  return (
    <div style={styles.container}>
      <div style={styles.sidebar}>
        <div style={styles.logoBlock} onClick={() => setActivePage('dashboard')}>
          <div style={styles.logoMark}>TB</div>
          <span style={styles.logoBrandName}>Tess Buddy</span>
        </div>
        <p style={styles.orgName}>{orgData.organizations.org_name}</p>
        <nav>
          <div style={styles.navGroup}>
            <span style={styles.navChip}>Record Cleaning</span>
            <button style={activePage === 'constituentMerge' ? styles.navLinkActive : styles.navLink} onClick={() => setActivePage('constituentMerge')}>Constituent Merge</button>
            <button style={activePage === 'agedRecordRemoval' ? styles.navLinkActive : styles.navLink} onClick={() => setActivePage('agedRecordRemoval')}>Aged Record Removal</button>
          </div>
          <div style={styles.navGroup}>
            <span style={styles.navChip}>Contact Point Screening</span>
            <button style={activePage === 'screening' ? styles.navLinkActive : styles.navLink} onClick={() => setActivePage('screening')}>Contact Point Screening</button>
            <button style={activePage === 'wealthScreening' ? styles.navLinkActive : styles.navLink} onClick={() => setActivePage('wealthScreening')}>Wealth Screening</button>
          </div>
          <div style={styles.navGroup}>
            <span style={styles.navChip}>AI Segmentation & Analysis</span>
            <button style={activePage === 'buildSegment' ? styles.navLinkActive : styles.navLink} onClick={() => setActivePage('buildSegment')}>Segments</button>
            <button style={activePage === 'lifecycles' ? styles.navLinkActive : styles.navLink} onClick={() => setActivePage('lifecycles')}>Lifecycles</button>
            <button style={activePage === 'dashboards' ? styles.navLinkActive : styles.navLink} onClick={() => setActivePage('dashboards')}>Dashboards</button>
            <button style={activePage === 'aiInsights' ? styles.navLinkActive : styles.navLink} onClick={() => setActivePage('aiInsights')}>AI Insights</button>
          </div>
        </nav>
        <div style={styles.statusRow}>
          <div style={{ ...styles.statusDot, backgroundColor: status.dot }} />
          <span style={{ ...styles.statusLabel, color: status.color }}>
            {status.label}
          </span>
        </div>
        <button style={styles.logout} onClick={handleLogout}>
          Sign Out
        </button>
      </div>
      <div style={styles.main}>
        <div style={styles.demoBanner}>
          🎭 Have you ever wanted to click random buttons in Tessitura without the fear of breaking something? Well, go crazy! This is a testing environment.
        </div>
        {activePage === 'dashboard' && (
          <>
            <div style={styles.header}>
              <h1 style={styles.welcome}>Welcome back, {orgData.display_name}</h1>
              <p style={styles.role}>{orgData.role}</p>
            </div>

            {/* ── Record Cleaning ── */}
            <div style={styles.section}>
              <p style={styles.sectionChip}>Record Cleaning</p>
              <div style={styles.cardRow}>

                {/* Merges Completed */}
                <div style={styles.statCard}>
                  <p style={styles.statLabel}>Merges Completed</p>
                  <p style={styles.statValue}>1,247</p>
                  <p style={styles.statHint}>Total constituent merges executed to date</p>
                </div>

                {/* Top Duplicate Sources */}
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

                {/* Aged Records Removed */}
                <div style={styles.statCard}>
                  <p style={styles.statLabel}>Aged Records Removed</p>
                  <p style={styles.statValue}>4,218</p>
                  <p style={styles.statHint}>Inactive constituents removed to date</p>
                </div>

                {/* Optimize Integrations */}
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
          </>
        )}
        {activePage === 'constituentMerge' && (
          <ConstituentMerge orgData={orgData} />
        )}
        {activePage === 'agedRecordRemoval' && (
          <AgedRecordRemoval orgData={orgData} />
        )}
        {activePage === 'screening' && (
          <Screening orgData={orgData} />
        )}
        {activePage === 'wealthScreening' && (
          <WealthScreening />
        )}
        {activePage === 'lifecycles' && (
          <Lifecycles />
        )}
        {activePage === 'buildSegment' && (
          <BuildSegment orgData={orgData} />
        )}
        {activePage === 'dashboards' && (
          <Dashboards />
        )}
        {activePage === 'aiInsights' && (
          <AiInsights />
        )}
      </div>
    </div>
  )
}

const styles = {
  container: { display: 'flex', height: '100vh', background: '#f0f7ff' },
  sidebar: { width: '240px', backgroundColor: 'white', borderRight: '1px solid rgba(29,111,219,0.1)', padding: '24px 16px', display: 'flex', flexDirection: 'column', flexShrink: 0, boxShadow: '2px 0 16px rgba(29,111,219,0.05)' },
  logoBlock: { cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '24px', textDecoration: 'none' },
  logoMark: { width: '32px', height: '32px', background: 'linear-gradient(135deg, #1d6fdb, #38bdf8)', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'Space Grotesk', sans-serif", fontWeight: '700', fontSize: '14px', color: '#fff', flexShrink: 0 },
  logoBrandName: { fontFamily: "'Space Grotesk', sans-serif", fontSize: '17px', fontWeight: '600', color: '#0c1a33', letterSpacing: '-0.3px' },
  logo: { color: '#0c1a33', fontSize: '20px', fontWeight: '700', margin: 0 },
  orgName: { color: '#9ca3af', fontSize: '11px', fontWeight: '600', letterSpacing: '0.5px', textTransform: 'uppercase', paddingLeft: '4px', marginBottom: '8px', fontFamily: "'Inter', sans-serif" },
  navGroup: { marginBottom: '18px' },
  navChip: { display: 'inline-block', fontSize: '10px', fontWeight: '700', color: '#1d6fdb', background: 'rgba(29,111,219,0.07)', border: '1px solid rgba(29,111,219,0.15)', borderRadius: '100px', padding: '3px 10px', letterSpacing: '0.04em', textTransform: 'uppercase', fontFamily: "'Inter', sans-serif", marginBottom: '8px' },
  navLink: { display: 'block', width: '100%', textAlign: 'left', background: 'none', border: 'none', padding: '5px 4px', fontSize: '13px', fontWeight: '400', color: '#4b5563', fontFamily: "'Inter', sans-serif", cursor: 'pointer', borderRadius: '6px' },
  navLinkActive: { display: 'block', width: '100%', textAlign: 'left', background: 'none', border: 'none', padding: '5px 4px', fontSize: '13px', fontWeight: '600', color: '#1d6fdb', fontFamily: "'Inter', sans-serif", cursor: 'pointer', borderRadius: '6px' },
  demoBanner: { background: 'linear-gradient(135deg, rgba(29,111,219,0.08), rgba(56,189,248,0.08))', border: '1px solid rgba(29,111,219,0.2)', borderRadius: '10px', padding: '10px 16px', marginBottom: '20px', fontSize: '13px', color: '#1d6fdb', fontFamily: "'Inter', sans-serif" },
  statusRow: { display: 'flex', alignItems: 'center', gap: '8px', padding: '12px 4px', marginTop: 'auto', marginBottom: '8px' },
  statusDot: { width: '8px', height: '8px', borderRadius: '50%', flexShrink: 0 },
  statusLabel: { fontSize: '12px', fontWeight: '500', fontFamily: "'Inter', sans-serif" },
  logout: { padding: '9px 12px', backgroundColor: 'transparent', color: '#6b7280', border: '1px solid rgba(29,111,219,0.15)', borderRadius: '8px', fontSize: '14px', fontFamily: "'Inter', sans-serif", cursor: 'pointer' },
  main: { flex: 1, padding: '48px', overflowY: 'auto', background: '#f0f7ff' },
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
  cardDesc: { fontSize: '13px', color: '#4b5563', lineHeight: '1.6', fontFamily: "'Inter', sans-serif" }
}

export default Dashboard

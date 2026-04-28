import React, { useState, useEffect } from 'react'
import { supabase } from '../supabaseClient'
import ConstituentMerge from './ConstituentMerge'
import AgedRecordRemoval from './AgedRecordRemoval'
import Screening from './Screening'
import BuildSegment from './BuildSegment'

function Dashboard({ session, orgData }) {
  const [apiStatus, setApiStatus] = useState('checking')
  const [activePage, setActivePage] = useState('dashboard')

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
          <p style={styles.navSection}>Record Cleaning</p>
          <div style={styles.chipGroup}>
            <button
              style={activePage === 'constituentMerge' ? styles.chipActive : styles.chip}
              onClick={() => setActivePage('constituentMerge')}
            >
              Constituent Merge
            </button>
            <button
              style={activePage === 'agedRecordRemoval' ? styles.chipActive : styles.chip}
              onClick={() => setActivePage('agedRecordRemoval')}
            >
              Aged Record Removal
            </button>
          </div>
          <p style={styles.navSection}>Contact Point Screening</p>
          <div style={styles.chipGroup}>
            <button
              style={activePage === 'screening' ? styles.chipActive : styles.chip}
              onClick={() => setActivePage('screening')}
            >
              Contact Point Screening
            </button>
          </div>
          <p style={styles.navSection}>AI Segmentation & Analysis</p>
          <div style={styles.chipGroup}>
            <button
              style={activePage === 'buildSegment' ? styles.chipActive : styles.chip}
              onClick={() => setActivePage('buildSegment')}
            >
              Build a Segment
            </button>
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
          🎭 <strong>Demo Mode</strong> — All data is simulated. No real Tessitura connection.
        </div>
        {activePage === 'dashboard' && (
          <>
            <div style={styles.header}>
              <h1 style={styles.welcome}>
                Welcome back, {orgData.display_name}
              </h1>
              <p style={styles.role}>{orgData.role}</p>
            </div>
            <div style={styles.infoCard}>
              <p style={styles.infoLabel}>Connected Tessitura Instance</p>
              <p style={styles.infoValue}>{orgData.organizations.tessitura_base_url}</p>
              <p style={styles.infoLabel}>Organization</p>
              <p style={styles.infoValue}>{orgData.organizations.org_name}</p>
              <p style={styles.infoLabel}>Role</p>
              <p style={styles.infoValue}>{orgData.role}</p>
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
        {activePage === 'buildSegment' && (
          <BuildSegment orgData={orgData} />
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
  navSection: { color: '#9ca3af', fontSize: '10px', fontWeight: '700', letterSpacing: '1px', textTransform: 'uppercase', padding: '16px 4px 6px', fontFamily: "'Inter', sans-serif" },
  chipGroup: { display: 'flex', flexWrap: 'wrap', gap: '6px', paddingBottom: '4px' },
  chip: { fontSize: '11px', fontWeight: '500', color: '#1d6fdb', background: 'rgba(29,111,219,0.07)', border: '1px solid rgba(29,111,219,0.15)', borderRadius: '100px', padding: '4px 12px', letterSpacing: '0.03em', fontFamily: "'Inter', sans-serif", cursor: 'pointer', whiteSpace: 'nowrap' },
  chipActive: { fontSize: '11px', fontWeight: '700', color: '#fff', background: 'linear-gradient(135deg, #1d6fdb, #38bdf8)', border: '1px solid transparent', borderRadius: '100px', padding: '4px 12px', letterSpacing: '0.03em', fontFamily: "'Inter', sans-serif", cursor: 'pointer', whiteSpace: 'nowrap', boxShadow: '0 2px 8px rgba(29,111,219,0.3)' },
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
  grid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', maxWidth: '700px' },
  card: { backgroundColor: 'white', borderRadius: '12px', padding: '24px', boxShadow: '0 2px 16px rgba(29,111,219,0.08)', border: '1px solid rgba(29,111,219,0.1)' },
  cardTitle: { fontSize: '16px', fontWeight: '700', color: '#0c1a33', marginBottom: '8px', fontFamily: "'Space Grotesk', sans-serif" },
  cardDesc: { fontSize: '13px', color: '#4b5563', lineHeight: '1.6', fontFamily: "'Inter', sans-serif" }
}

export default Dashboard

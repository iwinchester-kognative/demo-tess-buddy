import React, { useState } from 'react'

const PROCS = {
  agedRemoval: { id: 103, name: 'kognative_AGED_RECORD_REMOVAL' }
}

const TESSITURA_BASE = 'https://spoletussc0webtest.tnhs.cloud/Tessitura/#/crm/constituents'

function AgedRecordRemoval({ orgData }) {
  const [activeTab, setActiveTab] = useState('run')
  const [years, setYears] = useState('5')
  const [pool, setPool] = useState([])
  const [report, setReport] = useState([])
  const [loading, setLoading] = useState(false)
  const [committing, setCommitting] = useState(false)
  const [undoing, setUndoing] = useState(false)
  const [finding, setFinding] = useState(false)
  const [step, setStep] = useState(null) // null | 'review' | 'committed'
  const [message, setMessage] = useState(null)
  const [confirmCommit, setConfirmCommit] = useState(false)
  const [hasReviewed, setHasReviewed] = useState(false)
  const [removing, setRemoving] = useState(null)
  const [reactivating, setReactivating] = useState(null)

  const headers = {
    'x-tessitura-auth': orgData.organizations.tessitura_auth_string,
    'x-tessitura-url': orgData.organizations.tessitura_base_url,
    'Content-Type': 'application/json'
  }

  const callProc = async (proc, parameterValues = []) => {
    const body = {
      ProcedureId: proc.id,
      ProcedureName: proc.name
    }
    if (parameterValues.length > 0) {
      body.ParameterValues = parameterValues
    }

    const response = await fetch(`/api/tessitura?endpoint=Custom/Execute`, {
      method: 'POST',
      headers,
      body: JSON.stringify(body)
    })
    const text = await response.text()
    return { ok: response.ok, status: response.status, text }
  }

  const parseRows = (text) => {
    try {
      const data = JSON.parse(text)
      return Array.isArray(data) ? data : []
    } catch {
      return []
    }
  }

  const handleFind = async () => {
    const n = parseInt(years, 10)
    if (isNaN(n) || n < 1) {
      setMessage({ type: 'error', text: 'Please enter a valid number of years (1 or greater).' })
      return
    }

    setLoading(true)
    setFinding(true)
    setMessage(null)
    setPool([])
    setHasReviewed(false)
    setStep(null)

    try {
      const { ok, text } = await callProc(PROCS.agedRemoval, [
        { Name: '@mode', Value: 'FIND' },
        { Name: '@years', Value: String(n) }
      ])

      if (!ok) {
        setMessage({ type: 'error', text: 'Failed to find aged records.' })
        setLoading(false)
        setFinding(false)
        return
      }

      const rows = parseRows(text)
      setPool(rows)
      setStep('review')
      if (rows.length === 0) {
        setMessage({ type: 'success', text: 'No aged records found matching the criteria.' })
      } else {
        setMessage({ type: 'success', text: `Found ${rows.length} aged record${rows.length === 1 ? '' : 's'}. Review below, then commit to inactivate.` })
      }
    } catch (err) {
      setMessage({ type: 'error', text: 'Error: ' + err.message })
    }

    setLoading(false)
    setFinding(false)
  }

  const handleRemove = async (customer_no) => {
    setRemoving(customer_no)
    try {
      const { ok, text } = await callProc(PROCS.agedRemoval, [
        { Name: '@mode', Value: 'MODIFY' },
        { Name: '@customer_no', Value: String(customer_no) },
        { Name: '@action', Value: 'REMOVE' }
      ])

      if (ok) {
        setPool(parseRows(text))
      } else {
        setMessage({ type: 'error', text: `Failed to remove customer ${customer_no}.` })
      }
    } catch (err) {
      setMessage({ type: 'error', text: 'Error: ' + err.message })
    }
    setRemoving(null)
  }

  const handleCommit = async () => {
    setLoading(true)
    setCommitting(true)
    setConfirmCommit(false)
    setMessage(null)

    try {
      const { ok, text } = await callProc(PROCS.agedRemoval, [
        { Name: '@mode', Value: 'INACTIVATE' }
      ])

      if (!ok) {
        setMessage({ type: 'error', text: 'Failed to inactivate records.' })
        setLoading(false)
        setCommitting(false)
        return
      }

      let count = 0
      try {
        const data = JSON.parse(text)
        const row = Array.isArray(data) ? data[0] : data
        count = row?.records_inactivated ?? 0
      } catch {}

      setPool([])
      setStep('committed')
      setHasReviewed(false)
      setMessage({ type: 'success', text: `Successfully inactivated ${count} record${count === 1 ? '' : 's'}. See "Recent Inactivations" tab to undo or reactivate individuals.` })
    } catch (err) {
      setMessage({ type: 'error', text: 'Error: ' + err.message })
    }

    setLoading(false)
    setCommitting(false)
  }

  const loadReport = async () => {
    setLoading(true)
    setMessage(null)
    try {
      const { ok, text } = await callProc(PROCS.agedRemoval, [
        { Name: '@mode', Value: 'REPORT' }
      ])
      if (ok) {
        setReport(parseRows(text).filter(r => r.inactivated_dt))
      } else {
        // REPORT raises an error when empty - that's fine
        setReport([])
      }
    } catch (err) {
      setReport([])
    }
    setLoading(false)
  }

  const handleReactivate = async (customer_no) => {
    setReactivating(customer_no)
    try {
      const { ok } = await callProc(PROCS.agedRemoval, [
        { Name: '@mode', Value: 'REACTIVATE' },
        { Name: '@customer_no', Value: String(customer_no) }
      ])
      if (ok) {
        setReport(prev => prev.filter(r => r.customer_no !== customer_no))
      } else {
        setMessage({ type: 'error', text: `Failed to reactivate customer ${customer_no}.` })
      }
    } catch (err) {
      setMessage({ type: 'error', text: 'Error: ' + err.message })
    }
    setReactivating(null)
  }

  const handleUndoAll = async () => {
    setLoading(true)
    setUndoing(true)
    setMessage(null)
    try {
      const { ok, text } = await callProc(PROCS.agedRemoval, [
        { Name: '@mode', Value: 'UNDO' }
      ])
      if (!ok) {
        setMessage({ type: 'error', text: 'Failed to undo. Nothing on record, or an error occurred.' })
        setLoading(false)
        setUndoing(false)
        return
      }
      let count = 0
      try {
        const data = JSON.parse(text)
        const row = Array.isArray(data) ? data[0] : data
        count = row?.records_reverted ?? 0
      } catch {}
      setReport([])
      setMessage({ type: 'success', text: `Reverted ${count} record${count === 1 ? '' : 's'}.` })
    } catch (err) {
      setMessage({ type: 'error', text: 'Error: ' + err.message })
    }
    setLoading(false)
    setUndoing(false)
  }

  const switchTab = (tab) => {
    setActiveTab(tab)
    setMessage(null)
    if (tab === 'recent') {
      loadReport()
    }
  }

  const messageStyle = (type) => {
    if (type === 'error') return { ...styles.message, backgroundColor: '#fff5f5', borderColor: '#feb2b2', color: '#c53030' }
    return { ...styles.message, backgroundColor: '#f0fff4', borderColor: '#9ae6b4', color: '#2f855a' }
  }

  const formatDate = (d) => {
    if (!d) return '—'
    try {
      return new Date(d).toLocaleDateString()
    } catch {
      return d
    }
  }

  return (
    <div style={styles.container}>
      <style>{`@keyframes crmbuddy-spin { to { transform: rotate(360deg); } }`}</style>
      <h1 style={styles.title}>Aged Record Removal</h1>
      <p style={styles.subtitle}>
        Find and inactivate constituents who have had no activity in the last N years.
      </p>

      <div style={styles.tabs}>
        <button
          style={activeTab === 'run' ? styles.tabActive : styles.tab}
          onClick={() => switchTab('run')}
        >
          Run Removal
        </button>
        <button
          style={activeTab === 'recent' ? styles.tabActive : styles.tab}
          onClick={() => switchTab('recent')}
        >
          Recent Inactivations
        </button>
      </div>

      {message && (
        <div style={messageStyle(message.type)}>{message.text}</div>
      )}

      {activeTab === 'run' && (
        <>
          <div style={styles.actionRow}>
            <div style={styles.actionCard}>
              <div>
                <div style={styles.actionTitle}>Step 1 — Find Aged Records</div>
                <div style={styles.actionDesc}>
                  Enter the inactivity threshold in years. Active customers whose last activity is older than this (or never) will be listed below for review.
                </div>
                <div style={styles.inputRow}>
                  <label style={styles.inputLabel}>Years of inactivity:</label>
                  <input
                    type="number"
                    min="1"
                    value={years}
                    onChange={e => setYears(e.target.value)}
                    style={styles.input}
                    disabled={loading}
                  />
                </div>
              </div>
              <button
                style={{ ...styles.button, opacity: loading ? 0.5 : 1, cursor: loading ? 'not-allowed' : 'pointer' }}
                onClick={handleFind}
                disabled={loading}
              >
                {loading && step !== 'review' ? 'Searching...' : 'Find Aged Records'}
              </button>
            </div>

            <div style={styles.stepArrow}>→</div>

            <div style={styles.actionCard}>
              <div>
                <div style={styles.actionTitle}>Step 2 — Commit Inactivation</div>
                <div style={styles.actionDesc}>
                  Review the list below. Remove any records you want to keep, then confirm you've reviewed and commit to inactivate the rest.
                </div>
              </div>
              <button
                style={{
                  ...styles.commitButton,
                  opacity: pool.length === 0 || !hasReviewed || loading ? 0.5 : 1,
                  cursor: pool.length === 0 || !hasReviewed || loading ? 'not-allowed' : 'pointer'
                }}
                onClick={() => setConfirmCommit(true)}
                disabled={pool.length === 0 || !hasReviewed || loading}
              >
                Inactivate {pool.length > 0 ? `${pool.length} Record${pool.length === 1 ? '' : 's'}` : 'Records'}
              </button>
              {pool.length > 0 && !hasReviewed && (
                <div style={styles.reviewNote}>Click "I've Reviewed These Records" below to enable.</div>
              )}
            </div>
          </div>

          {pool.length > 0 && (
            <div style={styles.tableSection}>
              <div style={styles.tableHeader}>
                <h3 style={styles.tableTitle}>
                  Aged Records — {pool.length} pending inactivation
                </h3>
                {hasReviewed ? (
                  <span style={styles.reviewedBadge}>✓ Reviewed</span>
                ) : (
                  <button style={styles.reviewedButton} onClick={() => setHasReviewed(true)}>
                    I've Reviewed These Records
                  </button>
                )}
              </div>
              <div style={styles.tableWrapper}>
                <table style={styles.table}>
                  <thead>
                    <tr>
                      <th style={styles.th}>Customer #</th>
                      <th style={styles.th}>Name</th>
                      <th style={styles.th}>Created</th>
                      <th style={styles.th}>Last Activity</th>
                      <th style={styles.th}>Last Contribution</th>
                      <th style={styles.th}>Last Ticket</th>
                      <th style={styles.th}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {pool.map((row, index) => {
                      const url = `${TESSITURA_BASE}/${row.customer_no}/dashboard`
                      const isRemoving = removing === row.customer_no
                      return (
                        <tr key={row.customer_no} style={index % 2 === 0 ? styles.rowEven : styles.rowOdd}>
                          <td style={styles.td}>
                            <a href={url} target="_blank" rel="noopener noreferrer" style={styles.customerLink}>
                              {row.customer_no}
                            </a>
                          </td>
                          <td style={styles.td}>
                            {[row.fname, row.mname, row.lname].filter(Boolean).join(' ')}
                          </td>
                          <td style={styles.td}>{formatDate(row.create_dt)}</td>
                          <td style={styles.td}>{formatDate(row.last_activity_dt)}</td>
                          <td style={styles.td}>{formatDate(row.last_gift_dt)}</td>
                          <td style={styles.td}>{formatDate(row.last_ticket_dt)}</td>
                          <td style={styles.td}>
                            <button
                              style={{
                                ...styles.cancelPairButton,
                                opacity: isRemoving ? 0.5 : 1,
                                cursor: isRemoving ? 'not-allowed' : 'pointer'
                              }}
                              onClick={() => handleRemove(row.customer_no)}
                              disabled={isRemoving}
                              title="Remove from inactivation queue"
                            >
                              {isRemoving ? '...' : '✕ Unschedule'}
                            </button>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      {activeTab === 'recent' && (
        <>
          <div style={styles.tableHeader}>
            <h3 style={styles.tableTitle}>
              Recent Inactivations {report.length > 0 && `— ${report.length} record${report.length === 1 ? '' : 's'}`}
            </h3>
            {report.some(r => r.inactivated_dt) && (
              <button
                style={{ ...styles.cancelPairButton, padding: '8px 16px', fontSize: '13px' }}
                onClick={handleUndoAll}
                disabled={loading}
                title="Revert every record from the most recent inactivation run"
              >
                ↻ Undo Entire Batch
              </button>
            )}
          </div>

          {report.length === 0 && !loading && (
            <div style={styles.emptyState}>
              No recent inactivations on record.
            </div>
          )}

          {report.length > 0 && (
            <div style={styles.tableWrapper}>
              <table style={styles.table}>
                <thead>
                  <tr>
                    <th style={styles.th}>Customer #</th>
                    <th style={styles.th}>Name</th>
                    <th style={styles.th}>Last Activity</th>
                    <th style={styles.th}>Last Contribution</th>
                    <th style={styles.th}>Last Ticket</th>
                    <th style={styles.th}>Inactivated</th>
                    <th style={styles.th}>By</th>
                    <th style={styles.th}></th>
                  </tr>
                </thead>
                <tbody>
                  {report.map((row, index) => {
                    const url = `${TESSITURA_BASE}/${row.customer_no}/dashboard`
                    const isReactivating = reactivating === row.customer_no
                    const isPending = !row.inactivated_dt
                    return (
                      <tr key={row.customer_no} style={index % 2 === 0 ? styles.rowEven : styles.rowOdd}>
                        <td style={styles.td}>
                          <a href={url} target="_blank" rel="noopener noreferrer" style={styles.customerLink}>
                            {row.customer_no}
                          </a>
                        </td>
                        <td style={styles.td}>
                          {[row.fname, row.mname, row.lname].filter(Boolean).join(' ')}
                        </td>
                        <td style={styles.td}>{formatDate(row.last_activity_dt)}</td>
                        <td style={styles.td}>{formatDate(row.last_gift_dt)}</td>
                        <td style={styles.td}>{formatDate(row.last_ticket_dt)}</td>
                        <td style={styles.td}>
                          {isPending ? (
                            <span style={{ ...styles.badge, backgroundColor: '#718096' }}>Pending</span>
                          ) : (
                            formatDate(row.inactivated_dt)
                          )}
                        </td>
                        <td style={styles.td}>{row.inactivated_by || '—'}</td>
                        <td style={styles.td}>
                          {!isPending && (
                            <button
                              style={{
                                ...styles.mergeButton,
                                opacity: isReactivating ? 0.5 : 1,
                                cursor: isReactivating ? 'not-allowed' : 'pointer'
                              }}
                              onClick={() => handleReactivate(row.customer_no)}
                              disabled={isReactivating}
                              title="Reactivate this customer"
                            >
                              {isReactivating ? '...' : '↻ Reactivate'}
                            </button>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {(committing || undoing || finding) && (
        <div style={styles.overlay}>
          <div style={styles.loadingDialog}>
            <div style={styles.spinner} />
            <div style={styles.loadingTitle}>
              {committing
                ? 'Inactivating records...'
                : undoing
                  ? 'Reverting records...'
                  : 'Finding aged records...'}
            </div>
            <div style={styles.loadingText}>This may take a moment. Please don't close the page.</div>
          </div>
        </div>
      )}

      {confirmCommit && (
        <div style={styles.overlay} onClick={() => setConfirmCommit(false)}>
          <div style={styles.dialog} onClick={e => e.stopPropagation()}>
            <div style={styles.dialogTitle}>Confirm Inactivation</div>
            <div style={styles.dialogText}>
              This will set <strong>{pool.length}</strong> customer record{pool.length === 1 ? '' : 's'} to inactive in Tessitura. You can undo this from the "Recent Inactivations" tab until the next run.
            </div>
            <div style={styles.dialogButtons}>
              <button style={styles.cancelButton} onClick={() => setConfirmCommit(false)}>Cancel</button>
              <button style={styles.commitButton} onClick={handleCommit}>Inactivate</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

const styles = {
  container: { padding: '40px' },
  title: { fontSize: '22px', fontWeight: '700', color: '#0c1a33', marginBottom: '8px', fontFamily: "'Space Grotesk', sans-serif", letterSpacing: '-0.02em' },
  subtitle: { fontSize: '14px', color: '#4b5563', marginBottom: '24px', fontFamily: "'Inter', sans-serif" },
  tabs: { display: 'flex', gap: '4px', marginBottom: '24px', borderBottom: '1px solid rgba(29,111,219,0.15)' },
  tab: { padding: '10px 20px', backgroundColor: 'transparent', color: '#6b7280', border: 'none', borderBottom: '2px solid transparent', fontSize: '14px', fontWeight: '500', fontFamily: "'Inter', sans-serif", cursor: 'pointer' },
  tabActive: { padding: '10px 20px', backgroundColor: 'transparent', color: '#1d6fdb', border: 'none', borderBottom: '2px solid #1d6fdb', fontSize: '14px', fontWeight: '700', fontFamily: "'Inter', sans-serif", cursor: 'pointer' },
  actionRow: { display: 'flex', alignItems: 'stretch', gap: '16px', marginBottom: '24px', flexWrap: 'wrap' },
  actionCard: { backgroundColor: 'white', borderRadius: '12px', padding: '24px', flex: 1, minWidth: '260px', boxShadow: '0 2px 16px rgba(29,111,219,0.08)', border: '1px solid rgba(29,111,219,0.1)', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' },
  actionTitle: { fontSize: '15px', fontWeight: '700', color: '#0c1a33', marginBottom: '8px', fontFamily: "'Space Grotesk', sans-serif" },
  actionDesc: { fontSize: '13px', color: '#4b5563', marginBottom: '16px', lineHeight: '1.5', fontFamily: "'Inter', sans-serif" },
  inputRow: { display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' },
  inputLabel: { fontSize: '13px', color: '#4b5563', fontWeight: '500', fontFamily: "'Inter', sans-serif" },
  input: { width: '70px', padding: '8px 10px', border: '1px solid rgba(29,111,219,0.22)', borderRadius: '6px', fontSize: '14px', fontFamily: "'Inter', sans-serif", color: '#0c1a33', outline: 'none' },
  stepArrow: { fontSize: '24px', color: '#9ca3af', paddingTop: '60px' },
  button: { width: '100%', padding: '12px', background: 'linear-gradient(135deg, #1d6fdb, #38bdf8)', color: 'white', border: 'none', borderRadius: '8px', fontSize: '14px', fontWeight: '600', fontFamily: "'Inter', sans-serif", cursor: 'pointer', boxShadow: '0 2px 12px rgba(29,111,219,0.25)' },
  commitButton: { width: '100%', padding: '12px', backgroundColor: '#fee2e2', color: '#dc2626', border: '1px solid #fecaca', borderRadius: '8px', fontSize: '14px', fontWeight: '600', fontFamily: "'Inter', sans-serif", cursor: 'pointer' },
  reviewNote: { fontSize: '12px', color: '#dc2626', marginTop: '8px', textAlign: 'center', fontFamily: "'Inter', sans-serif" },
  message: { padding: '12px 16px', borderRadius: '8px', border: '1px solid', fontSize: '14px', marginBottom: '24px', fontFamily: "'Inter', sans-serif" },
  overlay: { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(12,26,51,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, backdropFilter: 'blur(4px)' },
  dialog: { backgroundColor: 'white', borderRadius: '16px', padding: '32px', maxWidth: '420px', width: '90%', boxShadow: '0 8px 40px rgba(29,111,219,0.15)', border: '1px solid rgba(29,111,219,0.1)' },
  loadingDialog: { backgroundColor: 'white', borderRadius: '16px', padding: '40px', maxWidth: '360px', width: '90%', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px', boxShadow: '0 8px 40px rgba(29,111,219,0.15)', border: '1px solid rgba(29,111,219,0.1)' },
  spinner: { width: '40px', height: '40px', border: '4px solid rgba(29,111,219,0.15)', borderTopColor: '#1d6fdb', borderRadius: '50%', animation: 'crmbuddy-spin 0.8s linear infinite' },
  loadingTitle: { fontSize: '16px', fontWeight: '700', color: '#0c1a33', fontFamily: "'Space Grotesk', sans-serif" },
  loadingText: { fontSize: '13px', color: '#4b5563', lineHeight: '1.5', fontFamily: "'Inter', sans-serif" },
  dialogTitle: { fontSize: '18px', fontWeight: '700', color: '#0c1a33', marginBottom: '12px', fontFamily: "'Space Grotesk', sans-serif" },
  dialogText: { fontSize: '14px', color: '#4b5563', marginBottom: '24px', lineHeight: '1.6', fontFamily: "'Inter', sans-serif" },
  dialogButtons: { display: 'flex', gap: '12px', justifyContent: 'flex-end' },
  cancelButton: { padding: '10px 20px', backgroundColor: 'transparent', color: '#6b7280', border: '1px solid rgba(29,111,219,0.2)', borderRadius: '8px', fontSize: '14px', fontFamily: "'Inter', sans-serif", cursor: 'pointer' },
  tableSection: { marginTop: '32px' },
  tableHeader: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' },
  tableTitle: { fontSize: '16px', fontWeight: '700', color: '#0c1a33', fontFamily: "'Space Grotesk', sans-serif" },
  reviewedButton: { padding: '8px 16px', background: 'linear-gradient(135deg, #1d6fdb, #38bdf8)', color: 'white', border: 'none', borderRadius: '8px', fontSize: '13px', fontWeight: '600', fontFamily: "'Inter', sans-serif", cursor: 'pointer' },
  reviewedBadge: { fontSize: '13px', color: '#16a34a', fontWeight: '700', fontFamily: "'Inter', sans-serif" },
  tableWrapper: { overflowX: 'auto', borderRadius: '12px', boxShadow: '0 2px 16px rgba(29,111,219,0.08)', border: '1px solid rgba(29,111,219,0.1)' },
  table: { width: '100%', borderCollapse: 'collapse', backgroundColor: 'white' },
  th: { padding: '12px 16px', textAlign: 'left', fontSize: '11px', fontWeight: '700', color: '#9ca3af', letterSpacing: '1px', textTransform: 'uppercase', borderBottom: '1px solid rgba(29,111,219,0.08)', fontFamily: "'Inter', sans-serif" },
  td: { padding: '12px 16px', fontSize: '14px', color: '#374151', borderBottom: '1px solid rgba(29,111,219,0.06)', fontFamily: "'Inter', sans-serif" },
  rowEven: { backgroundColor: 'white' },
  rowOdd: { backgroundColor: '#f8fafd' },
  badge: { padding: '3px 8px', borderRadius: '20px', color: 'white', fontSize: '11px', fontWeight: '700' },
  customerLink: { color: '#1d6fdb', textDecoration: 'none', fontWeight: '600' },
  cancelPairButton: { padding: '4px 10px', backgroundColor: '#fee2e2', color: '#dc2626', border: '1px solid #fecaca', borderRadius: '6px', fontSize: '12px', fontWeight: '600', fontFamily: "'Inter', sans-serif", cursor: 'pointer' },
  mergeButton: { padding: '4px 10px', backgroundColor: '#dcfce7', color: '#16a34a', border: '1px solid #bbf7d0', borderRadius: '6px', fontSize: '12px', fontWeight: '600', fontFamily: "'Inter', sans-serif", cursor: 'pointer' },
  emptyState: { padding: '40px', textAlign: 'center', color: '#9ca3af', fontSize: '14px', backgroundColor: 'white', borderRadius: '12px', boxShadow: '0 2px 16px rgba(29,111,219,0.08)', border: '1px solid rgba(29,111,219,0.1)', fontFamily: "'Inter', sans-serif" }
}

export default AgedRecordRemoval

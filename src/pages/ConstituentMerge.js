import React, { useState } from 'react'
 
const PROCS = {
  identifyDups: { id: 99, name: 'AP_IDENTIFY_DUPLICATES' },
  updateMerges: { id: 100, name: 'kognative_LP_UPDATE_POSSIBLE_MERGES' },
  mergeCustomer: { id: 101, name: 'kognative_MERGE_CUSTOMER' },
  managePair: { id: 104, name: 'kognative_MANAGE_MERGE_PAIR' }
}
 
const TESSITURA_BASE = 'https://spoletussc0webtest.tnhs.cloud/Tessitura/#/crm/constituents'
 
function ConstituentMerge({ orgData }) {
  const [activeTab, setActiveTab] = useState('bulk')
  const [pool, setPool] = useState([])
  const [unscheduledCriteria, setUnscheduledCriteria] = useState(new Set())
  const [mergedToday, setMergedToday] = useState([])
  const [loading, setLoading] = useState(false)
  const [swappingCriterion, setSwappingCriterion] = useState(null)
  const [cancellingCriterion, setCancellingCriterion] = useState(null)
  const [step, setStep] = useState(null)
  const [message, setMessage] = useState(null)
  const [confirmCommit, setConfirmCommit] = useState(false)
  const [hasReviewed, setHasReviewed] = useState(false)
  const [showAll, setShowAll] = useState(false)
  const [householdResult, setHouseholdResult] = useState(null)
  const [convertingCriterion, setConvertingCriterion] = useState(null)
  const [mergeKeepNo, setMergeKeepNo] = useState('')
  const [mergeDeleteNo, setMergeDeleteNo] = useState('')
  const [separateHhNo, setSeparateHhNo] = useState('')
  const [recentMerges, setRecentMerges] = useState([])
  const [recentLoading, setRecentLoading] = useState(false)
  const [toolsLoading, setToolsLoading] = useState(null)   // 'merge' | 'separate' | 'unmerge' | null
  const [mergeToolResult, setMergeToolResult] = useState(null)
  const [hhToolResult, setHhToolResult] = useState(null)
  const [unmergeNo, setUnmergeNo] = useState('')
  const [unmergeToolResult, setUnmergeToolResult] = useState(null)
  const [unmergeConfirm, setUnmergeConfirm] = useState(null)   // row being confirmed
  const [unmergingRow, setUnmergingRow] = useState(null)        // customer_no being processed
  const [unmergedRows, setUnmergedRows] = useState(new Set())   // customer_nos already unmerged
 
  const headers = {
    'x-tessitura-auth': orgData.organizations.tessitura_auth_string,
    'x-tessitura-url': orgData.organizations.tessitura_base_url,
    'Content-Type': 'application/json'
  }
 
  const callProc = async (proc, parameterValues = []) => {
    const body = {
      ProcedureId: proc.id,
      ProcedureName: proc.name,
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
 
  const fetchPool = async () => {
    const { ok, text } = await callProc(PROCS.managePair, [
      { Name: '@mode', Value: 'get_pool' }
    ])
    if (ok) {
      try {
        const data = JSON.parse(text)
        setPool(Array.isArray(data) ? data : [])
      } catch {
        setPool([])
      }
    }
  }

  const fetchRecentMerges = async () => {
    setRecentLoading(true)
    const { ok, text } = await callProc(PROCS.managePair, [
      { Name: '@mode', Value: 'merged_today' }
    ])
    if (ok) {
      try {
        const data = JSON.parse(text)
        setRecentMerges(Array.isArray(data) ? data : [])
      } catch {
        setRecentMerges([])
      }
    }
    setRecentLoading(false)
  }
 
  const handleFindAndPromote = async () => {
    setLoading(true)
    setStep('finding')
    setMessage(null)
    setPool([])
    setUnscheduledCriteria(new Set())
    setMergedToday([])
    setHasReviewed(false)
 
    try {
      const { ok: ok1 } = await callProc(PROCS.identifyDups, [
        { Name: '@changed_since_days', Value: '1095' },
        { Name: '@identify_method1', Value: '1' },
        { Name: '@identify_method2', Value: '2' },
        { Name: '@identify_method3', Value: '3' },
        { Name: '@include_inactive', Value: 'N' },
        { Name: '@list_no', Value: null }
      ])
 
      if (!ok1) {
        setMessage({ type: 'error', text: 'Failed to identify duplicates.' })
        setLoading(false)
        return
      }
 
      const { ok: ok2 } = await callProc(PROCS.updateMerges)
 
      if (!ok2) {
        setMessage({ type: 'error', text: 'Failed to promote candidates.' })
        setLoading(false)
        return
      }
 
      await fetchPool()
      setStep('review')
      setMessage({ type: 'success', text: 'Duplicates identified and promoted. Please review below before committing.' })
    } catch (err) {
      setMessage({ type: 'error', text: 'Error: ' + err.message })
    }
 
    setLoading(false)
  }
 
  const handleCommit = async () => {
    setLoading(true)
    setConfirmCommit(false)
    setStep('committing')
    setMessage(null)
 
    try {
      const { ok, status: mergeStatus, text: mergeText } = await callProc(PROCS.mergeCustomer)
      console.log('merge response:', { ok, status: mergeStatus, text: mergeText })
      if (ok) {
        const { ok: ok2, text } = await callProc(PROCS.managePair, [
          { Name: '@mode', Value: 'merged_today' }
        ])
        if (ok2) {
          try {
            const data = JSON.parse(text)
            setMergedToday(Array.isArray(data) ? data : [])
          } catch {
            setMergedToday([])
          }
        }
        setPool([])
        setHasReviewed(false)
        setStep('done')
        setMessage({ type: 'success', text: 'Merges committed successfully.' })
      } else {
        setMessage({ type: 'error', text: 'Failed to commit merges.' })
      }
    } catch (err) {
      setMessage({ type: 'error', text: 'Error: ' + err.message })
    }
 
    setLoading(false)
  }
 
  const handleSwap = async (criterion, keepRow, deleteRow) => {
    setSwappingCriterion(criterion)
 
    setPool(prev => prev.map(r => {
      if (r.customer_no === keepRow.customer_no) return { ...r, status: 'D' }
      if (r.customer_no === deleteRow.customer_no) return { ...r, status: 'K' }
      return r
    }))
 
    try {
      const { ok } = await callProc(PROCS.managePair, [
        { Name: '@customer_no_1', Value: String(deleteRow.customer_no) },
        { Name: '@customer_no_2', Value: String(keepRow.customer_no) },
        { Name: '@mode', Value: 'swap' }
      ])
      if (!ok) {
        setPool(prev => prev.map(r => {
          if (r.customer_no === keepRow.customer_no) return { ...r, status: 'K' }
          if (r.customer_no === deleteRow.customer_no) return { ...r, status: 'D' }
          return r
        }))
        setMessage({ type: 'error', text: 'Failed to swap pair. Please try again.' })
      }
    } catch (err) {
      setPool(prev => prev.map(r => {
        if (r.customer_no === keepRow.customer_no) return { ...r, status: 'K' }
        if (r.customer_no === deleteRow.customer_no) return { ...r, status: 'D' }
        return r
      }))
      setMessage({ type: 'error', text: 'Error swapping pair: ' + err.message })
    }
 
    setSwappingCriterion(null)
  }
 
  const handleCancel = async (criterion, keepRow, deleteRow) => {
    setCancellingCriterion(criterion)
 
    try {
      const { ok } = await callProc(PROCS.managePair, [
        { Name: '@customer_no_1', Value: String(keepRow.customer_no) },
        { Name: '@customer_no_2', Value: String(deleteRow.customer_no) },
        { Name: '@mode', Value: 'unschedule' }
      ])
      if (ok) {
        setPool(prev => prev.map(r =>
          r.criterion === criterion ? { ...r, status: 'P', keep_cust: null } : r
        ))
        setUnscheduledCriteria(prev => new Set([...prev, criterion]))
      } else {
        setMessage({ type: 'error', text: 'Failed to cancel pair. Please try again.' })
      }
    } catch (err) {
      setMessage({ type: 'error', text: 'Error cancelling pair: ' + err.message })
    }
 
    setCancellingCriterion(null)
  }
 
  const handleSchedule = async (criterion, row1, row2) => {
    setCancellingCriterion(criterion)
 
    try {
      const { ok } = await callProc(PROCS.managePair, [
        { Name: '@customer_no_1', Value: String(row1.customer_no) },
        { Name: '@customer_no_2', Value: String(row2.customer_no) },
        { Name: '@mode', Value: 'schedule' }
      ])
      if (ok) {
        setPool(prev => prev.map(r => {
          if (r.customer_no === row1.customer_no) return { ...r, status: 'K', keep_cust: row1.customer_no }
          if (r.customer_no === row2.customer_no) return { ...r, status: 'D', keep_cust: row1.customer_no }
          return r
        }))
        setUnscheduledCriteria(prev => {
          const next = new Set(prev)
          next.delete(criterion)
          return next
        })
      } else {
        setMessage({ type: 'error', text: 'Failed to schedule pair. Please try again.' })
      }
    } catch (err) {
      setMessage({ type: 'error', text: 'Error scheduling pair: ' + err.message })
    }
 
    setCancellingCriterion(null)
  }

  const handleConvertToHousehold = async (criterion, keepRow, deleteRow) => {
    setConvertingCriterion(criterion)
    try {
      const { ok, text } = await callProc(PROCS.managePair, [
        { Name: '@customer_no_1', Value: String(keepRow.customer_no) },
        { Name: '@customer_no_2', Value: String(deleteRow.customer_no) },
        { Name: '@mode', Value: 'convert_to_household' }
      ])
      if (ok) {
        let hhNo = null
        try {
          const data = JSON.parse(text)
          hhNo = Array.isArray(data) ? data[0]?.household_customer_no : data?.household_customer_no
        } catch { /* */ }
        setPool(prev => prev.filter(r => r.criterion !== criterion))
        setHouseholdResult({
          householdNo: hhNo,
          name: `${keepRow.lname} Household`,
          a1: keepRow,
          a2: deleteRow
        })
      } else {
        setMessage({ type: 'error', text: 'Failed to convert to household.' })
      }
    } catch (err) {
      setMessage({ type: 'error', text: 'Error converting: ' + err.message })
    }
    setConvertingCriterion(null)
  }

  const FAKE_NAMES = [
    ['Arthur', 'Williams'], ['Priya', 'Patel'], ['Kathleen', "O'Brien"],
    ['Hideo', 'Nakamura'], ['David', 'Rosenberg'], ['Carmen', 'Torres'],
    ['George', 'Blackwell'], ['Abena', 'Osei'], ['Lucas', 'Ferreira'], ['Lena', 'Gustafsson']
  ]
  const fakeName = (n) => FAKE_NAMES[Number(n) % FAKE_NAMES.length]

  const handleOneOffMerge = async () => {
    if (!mergeKeepNo || !mergeDeleteNo) return
    setToolsLoading('merge')
    setMergeToolResult(null)
    await callProc(PROCS.managePair, [
      { Name: '@customer_no_1', Value: String(mergeKeepNo) },
      { Name: '@customer_no_2', Value: String(mergeDeleteNo) },
      { Name: '@mode', Value: 'schedule' }
    ])
    await callProc(PROCS.mergeCustomer)
    const [kf, kl] = fakeName(mergeKeepNo)
    const [df, dl] = fakeName(mergeDeleteNo)
    setMergeToolResult({
      keepNo: mergeKeepNo, keepName: `${kf} ${kl}`,
      deleteNo: mergeDeleteNo, deleteName: `${df} ${dl}`,
      mergedAt: new Date().toLocaleTimeString()
    })
    setMergeKeepNo('')
    setMergeDeleteNo('')
    setToolsLoading(null)
  }

  const handleSeparateHH = async () => {
    if (!separateHhNo) return
    setToolsLoading('separate')
    setHhToolResult(null)
    await callProc(PROCS.managePair, [
      { Name: '@customer_no_1', Value: String(separateHhNo) },
      { Name: '@mode', Value: 'convert_to_household' }
    ])
    const [f, l] = fakeName(separateHhNo)
    const newNo = Number(separateHhNo) + 10000
    setHhToolResult({
      hhNo: separateHhNo, hhName: `${f} ${l} Household`,
      newNo, newName: `${f} ${l}`,
      separatedAt: new Date().toLocaleTimeString()
    })
    setSeparateHhNo('')
    setToolsLoading(null)
  }

  const handleUnmergeRow = async (row) => {
    setUnmergeConfirm(null)
    setUnmergingRow(row.customer_no)
    await callProc(PROCS.managePair, [
      { Name: '@customer_no_1', Value: String(row.customer_no) },
      { Name: '@mode',          Value: 'unmerge' }
    ])
    setUnmergedRows(prev => new Set([...prev, row.customer_no]))
    setUnmergingRow(null)
  }

  const handleUnmergeTool = async () => {
    if (!unmergeNo) return
    setToolsLoading('unmerge')
    setUnmergeToolResult(null)
    await callProc(PROCS.managePair, [
      { Name: '@customer_no_1', Value: String(unmergeNo) },
      { Name: '@mode',          Value: 'unmerge' }
    ])
    const [f, l] = fakeName(unmergeNo)
    const restoredNo = Number(unmergeNo) + 5000
    setUnmergeToolResult({ originalNo: unmergeNo, originalName: `${f} ${l}`, restoredNo, ranAt: new Date().toLocaleTimeString() })
    setUnmergeNo('')
    setToolsLoading(null)
  }

  const statusLabel = (s) => {
    if (s === 'K') return { label: 'Keep', color: '#38a169' }
    if (s === 'D') return { label: 'Delete', color: '#e53e3e' }
    if (s === 'P') return { label: 'Pending', color: '#a0aec0' }
    return { label: s, color: '#888' }
  }
 
  const promoted = pool.filter(r => r.status === 'K' || r.status === 'D')
  const allPairs = Object.values(
    pool.reduce((acc, row) => {
      if (!acc[row.criterion]) acc[row.criterion] = []
      acc[row.criterion].push(row)
      return acc
    }, {})
  ).filter(group => group.length === 2)
 
  const activePairs = allPairs
    .filter(group => group.some(r => r.status === 'K' || r.status === 'D'))
    .map(group => group.sort((a, b) => (a.status === 'K' ? -1 : 1)))
 
  const pendingPairs = allPairs
    .filter(group => group.every(r => r.status === 'P') && (showAll || unscheduledCriteria.has(group[0].criterion)))
 
  const pairs = [...activePairs, ...pendingPairs]
 
  return (
    <div style={styles.container}>
      <h2 style={styles.title}>Constituent Merge</h2>
      <p style={styles.subtitle}>
        Identify duplicate constituent records, review them, and commit merges.
      </p>

      <div style={styles.tabs}>
        <button
          style={activeTab === 'bulk' ? styles.tabActive : styles.tab}
          onClick={() => setActiveTab('bulk')}
        >
          Bulk Merge
        </button>
        <button
          style={activeTab === 'tools' ? styles.tabActive : styles.tab}
          onClick={() => setActiveTab('tools')}
        >
          Merge Tools
        </button>
        <button
          style={activeTab === 'recent' ? styles.tabActive : styles.tab}
          onClick={() => { setActiveTab('recent'); fetchRecentMerges() }}
        >
          Recent Merges
        </button>
      </div>

      {activeTab === 'bulk' && (<>

      <div style={styles.actionRow}>
        <div style={styles.actionCard}>
          <h3 style={styles.actionTitle}>Step 1 — Find & Recommend</h3>
          <p style={styles.actionDesc}>
            Scans for duplicate constituents and recommends merge candidates for your review.
          </p>
          <button
            style={styles.button}
            onClick={handleFindAndPromote}
            disabled={loading}
          >
            {loading && step === 'finding' ? 'Processing...' : 'Load Duplicates'}
          </button>
          {pool.length > 0 && (
            <div style={styles.toggleRow}>
              <span style={{ ...styles.toggleLabel, fontWeight: !showAll ? '700' : '400' }}>Confident</span>
              <div
                style={{ ...styles.toggle, backgroundColor: showAll ? '#1a1a2e' : '#cbd5e0' }}
                onClick={() => setShowAll(prev => !prev)}
              >
                <div style={{ ...styles.toggleKnob, transform: showAll ? 'translateX(18px)' : 'translateX(2px)' }} />
              </div>
              <span style={{ ...styles.toggleLabel, fontWeight: showAll ? '700' : '400' }}>All Suggestions</span>
            </div>
          )}
        </div>
 
        <div style={styles.stepArrow}>→</div>
 
        <div style={styles.actionCard}>
          <h3 style={styles.actionTitle}>Step 2 — Review & Commit</h3>
          <p style={styles.actionDesc}>
            Review the promoted merge pairs below, then commit when ready.
          </p>
          <button
            style={{
              ...styles.button,
              backgroundColor: promoted.length > 0 && hasReviewed ? '#c53030' : '#ccc',
              cursor: promoted.length > 0 && hasReviewed ? 'pointer' : 'not-allowed'
            }}
            onClick={() => setConfirmCommit(true)}
            disabled={loading || promoted.length === 0 || !hasReviewed}
          >
            {loading && step === 'committing' ? 'Committing...' : 'Commit Merges'}
          </button>
          {promoted.length > 0 && !hasReviewed && (
            <p style={styles.reviewNote}>Please review the records below first.</p>
          )}
        </div>
      </div>

      {message && (
        <div style={{
          ...styles.message,
          backgroundColor: message.type === 'success' ? '#f0fff4' : '#fff5f5',
          borderColor: message.type === 'success' ? '#9ae6b4' : '#feb2b2'
        }}>
          {message.text}
        </div>
      )}
 
      {confirmCommit && (
        <div style={styles.overlay}>
          <div style={styles.dialog}>
            <h3 style={styles.dialogTitle}>Confirm Merge</h3>
            <p style={styles.dialogText}>
              You are about to commit <strong>{activePairs.length} merges</strong>.
              This cannot be undone. Are you sure?
            </p>
            <div style={styles.dialogButtons}>
              <button style={styles.cancelButton} onClick={() => setConfirmCommit(false)}>
                Cancel
              </button>
              <button style={styles.commitButton} onClick={handleCommit}>
                Yes, Commit Merges
              </button>
            </div>
          </div>
        </div>
      )}
 
      {pairs.length > 0 && (
        <div style={styles.tableSection}>
          <div style={styles.tableHeader}>
            <h3 style={styles.tableTitle}>
              Merge Candidates — {activePairs.length} active{pendingPairs.length > 0 ? `, ${pendingPairs.length} unscheduled` : ''}
            </h3>
            {!hasReviewed && (
              <button
                style={styles.reviewedButton}
                onClick={() => setHasReviewed(true)}
              >
                ✓ I've Reviewed These Records
              </button>
            )}
            {hasReviewed && (
              <span style={styles.reviewedBadge}>✓ Reviewed</span>
            )}
          </div>
          <div style={styles.tableWrapper}>
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}>Status</th>
                  <th style={styles.th}>Customer #</th>
                  <th style={styles.th}>Name</th>
                  <th style={styles.th}>Criterion</th>
                  <th style={styles.th}></th>
                </tr>
              </thead>
              <tbody>
                {pairs.map((pair, pairIndex) => {
                  const isPending = pair.every(r => r.status === 'P')
                  const keepRow = pair.find(r => r.status === 'K')
                  const deleteRow = pair.find(r => r.status === 'D')
                  const isSwapping = swappingCriterion === pair[0]?.criterion
                  const isCancelling = cancellingCriterion === pair[0]?.criterion
 
                  return pair.map((row, rowIndex) => {
                    const s = statusLabel(row.status)
                    const isKeepRow = row.status === 'K'
                    const isFirstRow = rowIndex === 0
                    const globalIndex = pairIndex * 2 + rowIndex
                    const constituentUrl = `${TESSITURA_BASE}/${row.customer_no}/dashboard`
 
                    return (
                      <tr
                        key={`${row.customer_no}-${rowIndex}`}
                        style={{
                          ...(globalIndex % 2 === 0 ? styles.rowEven : styles.rowOdd),
                          borderTop: rowIndex === 0 && pairIndex > 0 ? '2px solid #e2e8f0' : undefined,
                          opacity: isPending ? 0.4 : 1
                        }}
                      >
                        <td style={styles.td}>
                          <span style={{ ...styles.badge, backgroundColor: s.color }}>
                            {s.label}
                          </span>
                        </td>
                        <td style={styles.td}>
                          <a
                            href={constituentUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={styles.customerLink}
                          >
                            {row.customer_no}
                          </a>
                        </td>
                        <td style={styles.td}>{row.fname} {row.lname}</td>
                        <td style={styles.td}>{row.criterion}</td>
                        <td style={styles.td}>
                          {isPending && isFirstRow && (
                            <div style={styles.actionButtons}>
                              <button
                                style={{
                                  ...styles.mergeButton,
                                  opacity: isCancelling ? 0.5 : 1,
                                  cursor: isCancelling ? 'not-allowed' : 'pointer'
                                }}
                                onClick={() => handleSchedule(row.criterion, pair[0], pair[1])}
                                disabled={isCancelling}
                                title="Re-add to merge queue"
                              >
                                {isCancelling ? '...' : '↻ Merge'}
                              </button>
                            </div>
                          )}
                          {!isPending && isKeepRow && keepRow && deleteRow && (
                            <div style={styles.actionButtons}>
                              <button
                                style={{
                                  ...styles.swapButton,
                                  opacity: isSwapping || isCancelling ? 0.5 : 1,
                                  cursor: isSwapping || isCancelling ? 'not-allowed' : 'pointer'
                                }}
                                onClick={() => handleSwap(row.criterion, keepRow, deleteRow)}
                                disabled={isSwapping || isCancelling}
                                title="Swap Keep / Delete"
                              >
                                {isSwapping ? '...' : '⇄ Swap'}
                              </button>
                              <button
                                style={{
                                  ...styles.cancelPairButton,
                                  opacity: isSwapping || isCancelling ? 0.5 : 1,
                                  cursor: isSwapping || isCancelling ? 'not-allowed' : 'pointer'
                                }}
                                onClick={() => handleCancel(row.criterion, keepRow, deleteRow)}
                                disabled={isSwapping || isCancelling}
                                title="Remove from merge queue"
                              >
                                {isCancelling ? '...' : '✕ Remove'}
                              </button>
                              <button
                                style={{
                                  ...styles.mergeButton,
                                  fontSize: '0.7rem',
                                  opacity: isSwapping || isCancelling || convertingCriterion === row.criterion ? 0.5 : 1,
                                  cursor: isSwapping || isCancelling || convertingCriterion === row.criterion ? 'not-allowed' : 'pointer'
                                }}
                                onClick={() => handleConvertToHousehold(row.criterion, keepRow, deleteRow)}
                                disabled={isSwapping || isCancelling || convertingCriterion === row.criterion}
                                title="Convert this pair into a household"
                              >
                                {convertingCriterion === row.criterion ? '...' : '🏠 Create HH'}
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    )
                  })
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
 
      {mergedToday.length > 0 && (
        <div style={styles.tableSection}>
          <div style={styles.tableHeader}>
            <h3 style={styles.tableTitle}>
              Merged Today — {mergedToday.length} records
            </h3>
          </div>
          <div style={styles.tableWrapper}>
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}>Status</th>
                  <th style={styles.th}>Deleted #</th>
                  <th style={styles.th}>Name</th>
                  <th style={styles.th}>Kept As</th>
                  <th style={styles.th}>Criterion</th>
                </tr>
              </thead>
              <tbody>
                {mergedToday.map((row, index) => {
                  const deletedUrl = `${TESSITURA_BASE}/${row.customer_no}/dashboard`
                  const keptUrl = `${TESSITURA_BASE}/${row.keep_cust}/dashboard`
                  return (
                    <tr
                      key={`${row.customer_no}-${index}`}
                      style={index % 2 === 0 ? styles.rowEven : styles.rowOdd}
                    >
                      <td style={styles.td}>
                        <span style={{ ...styles.badge, backgroundColor: '#718096' }}>
                          Merged
                        </span>
                      </td>
                      <td style={styles.td}>
                        <a href={deletedUrl} target="_blank" rel="noopener noreferrer" style={styles.customerLink}>
                          {row.customer_no}
                        </a>
                      </td>
                      <td style={styles.td}>{row.fname} {row.lname}</td>
                      <td style={styles.td}>
                        <a href={keptUrl} target="_blank" rel="noopener noreferrer" style={styles.customerLink}>
                          {row.keep_cust}
                        </a>
                      </td>
                      <td style={styles.td}>{row.criterion}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {unmergeConfirm && (
        <div style={styles.overlay}>
          <div style={styles.dialog}>
            <h3 style={styles.dialogTitle}>Confirm Unmerge</h3>
            <p style={styles.dialogText}>
              This will restore <strong>#{unmergeConfirm.customer_no} ({unmergeConfirm.fname} {unmergeConfirm.lname})</strong> as a separate constituent record, detaching it from <strong>#{unmergeConfirm.keep_cust}</strong>. Continue?
            </p>
            <div style={styles.dialogButtons}>
              <button style={styles.cancelButton} onClick={() => setUnmergeConfirm(null)}>Cancel</button>
              <button style={{ ...styles.commitButton, backgroundColor: '#fef3c7', color: '#d97706', borderColor: '#fde68a' }} onClick={() => handleUnmergeRow(unmergeConfirm)}>
                Yes, Unmerge
              </button>
            </div>
          </div>
        </div>
      )}

      {householdResult && (
        <div style={styles.overlay} onClick={() => setHouseholdResult(null)}>
          <div style={styles.dialog} onClick={e => e.stopPropagation()}>
            <div style={styles.dialogTitle}>Household Created</div>
            <div style={{ fontSize: '14px', color: '#666', lineHeight: '1.8', marginBottom: '20px' }}>
              <strong>{householdResult.name}</strong> (#{householdResult.householdNo})<br />
              A1: {householdResult.a1.fname} {householdResult.a1.lname} (#{householdResult.a1.customer_no})<br />
              A2: {householdResult.a2.fname} {householdResult.a2.lname} (#{householdResult.a2.customer_no})
            </div>
            <div style={{ fontSize: '13px', color: '#555', marginBottom: '20px', lineHeight: '1.6', backgroundColor: '#f7fafc', padding: '12px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
              Please review the new household record and make any quick updates needed (e.g. salutation, address, phone preferences).
            </div>
            <div style={styles.dialogButtons}>
              <button style={styles.cancelButton} onClick={() => setHouseholdResult(null)}>Close</button>
              <a
                href={`${TESSITURA_BASE}/${householdResult.householdNo}/dashboard`}
                target="_blank"
                rel="noopener noreferrer"
                style={{ ...styles.commitButton, textDecoration: 'none', backgroundColor: '#2b6cb0', textAlign: 'center' }}
              >
                View in Tessitura
              </a>
            </div>
          </div>
        </div>
      )}
      </>)}

      {activeTab === 'tools' && (
        <>
          {/* ── One-off Merge ── */}
          <div style={styles.toolCard}>
            <h3 style={styles.actionTitle}>One-off Merge</h3>
            <p style={styles.actionDesc}>
              Merge a single constituent pair immediately. The delete record's history
              will be rolled into the keep record, then the duplicate is cleared.
            </p>
            <div style={styles.toolInputRow}>
              <input
                type="text"
                placeholder="Keep Customer #"
                value={mergeKeepNo}
                onChange={e => { setMergeKeepNo(e.target.value); setMergeToolResult(null) }}
                style={styles.toolInput}
                disabled={toolsLoading === 'merge'}
              />
              <input
                type="text"
                placeholder="Delete Customer #"
                value={mergeDeleteNo}
                onChange={e => { setMergeDeleteNo(e.target.value); setMergeToolResult(null) }}
                style={styles.toolInput}
                disabled={toolsLoading === 'merge'}
              />
              <button
                style={{ ...styles.button, opacity: (!mergeKeepNo || !mergeDeleteNo || toolsLoading === 'merge') ? 0.5 : 1, cursor: (!mergeKeepNo || !mergeDeleteNo || toolsLoading === 'merge') ? 'not-allowed' : 'pointer' }}
                onClick={handleOneOffMerge}
                disabled={!mergeKeepNo || !mergeDeleteNo || toolsLoading === 'merge'}
              >
                {toolsLoading === 'merge' ? 'Merging...' : 'Merge'}
              </button>
            </div>
            {mergeToolResult && (
              <div style={styles.toolResult}>
                <span style={{ ...styles.badge, backgroundColor: '#718096', marginRight: '10px' }}>Merged</span>
                <span style={styles.toolResultText}>
                  #{mergeToolResult.deleteNo} ({mergeToolResult.deleteName}) merged into #{mergeToolResult.keepNo} ({mergeToolResult.keepName}) at {mergeToolResult.mergedAt}
                </span>
              </div>
            )}
          </div>

          {/* ── Separate Household ── */}
          <div style={{ ...styles.toolCard, marginTop: '24px' }}>
            <h3 style={styles.actionTitle}>Separate Household</h3>
            <p style={styles.actionDesc}>
              Split a household member into their own individual record. Use this when
              a member is deceased, after a divorce, or any time someone needs to be
              removed from a shared household.
            </p>
            <div style={styles.toolInputRow}>
              <input
                type="text"
                placeholder="Household Customer #"
                value={separateHhNo}
                onChange={e => { setSeparateHhNo(e.target.value); setHhToolResult(null) }}
                style={styles.toolInput}
                disabled={toolsLoading === 'separate'}
              />
              <button
                style={{ ...styles.button, opacity: (!separateHhNo || toolsLoading === 'separate') ? 0.5 : 1, cursor: (!separateHhNo || toolsLoading === 'separate') ? 'not-allowed' : 'pointer' }}
                onClick={handleSeparateHH}
                disabled={!separateHhNo || toolsLoading === 'separate'}
              >
                {toolsLoading === 'separate' ? 'Separating...' : 'Separate'}
              </button>
            </div>
            {hhToolResult && (
              <div style={styles.toolResult}>
                <span style={{ ...styles.badge, backgroundColor: '#2b6cb0', marginRight: '10px' }}>Separated</span>
                <span style={styles.toolResultText}>
                  {hhToolResult.newName} (#{hhToolResult.newNo}) created as individual record from {hhToolResult.hhName} at {hhToolResult.separatedAt}
                </span>
              </div>
            )}
          </div>

          {/* ── Unmerge ── */}
          <div style={{ ...styles.toolCard, marginTop: '24px' }}>
            <h3 style={styles.actionTitle}>Unmerge</h3>
            <p style={styles.actionDesc}>
              Reverse a previous merge by restoring a deleted constituent record as its own independent entry. Enter the customer number of the record that was merged away.
            </p>
            <div style={styles.toolInputRow}>
              <input
                type="text"
                placeholder="Deleted Customer #"
                value={unmergeNo}
                onChange={e => { setUnmergeNo(e.target.value); setUnmergeToolResult(null) }}
                style={styles.toolInput}
                disabled={toolsLoading === 'unmerge'}
              />
              <button
                style={{ ...styles.button, background: 'linear-gradient(135deg, #d97706, #f59e0b)', opacity: (!unmergeNo || toolsLoading === 'unmerge') ? 0.5 : 1, cursor: (!unmergeNo || toolsLoading === 'unmerge') ? 'not-allowed' : 'pointer' }}
                onClick={handleUnmergeTool}
                disabled={!unmergeNo || toolsLoading === 'unmerge'}
              >
                {toolsLoading === 'unmerge' ? 'Restoring...' : 'Unmerge'}
              </button>
            </div>
            {unmergeToolResult && (
              <div style={styles.toolResult}>
                <span style={{ ...styles.badge, backgroundColor: '#d97706', marginRight: '10px' }}>Restored</span>
                <span style={styles.toolResultText}>
                  #{unmergeToolResult.originalNo} ({unmergeToolResult.originalName}) restored as independent record #{unmergeToolResult.restoredNo} at {unmergeToolResult.ranAt}
                </span>
              </div>
            )}
          </div>

        </>
      )}

      {activeTab === 'recent' && (
        <>
          <div style={styles.tableHeader}>
            <h3 style={styles.tableTitle}>
              Recent Merges {recentMerges.length > 0 && `— ${recentMerges.length} record${recentMerges.length === 1 ? '' : 's'}`}
            </h3>
          </div>

          {recentLoading && (
            <div style={styles.emptyState}>Loading...</div>
          )}

          {!recentLoading && recentMerges.length === 0 && (
            <div style={styles.emptyState}>No recent merges on record.</div>
          )}

          {recentMerges.length > 0 && (
            <div style={styles.tableWrapper}>
              <table style={styles.table}>
                <thead>
                  <tr>
                    <th style={styles.th}>Status</th>
                    <th style={styles.th}>Deleted #</th>
                    <th style={styles.th}>Name</th>
                    <th style={styles.th}>Kept As</th>
                    <th style={styles.th}>Criterion</th>
                    <th style={styles.th}></th>
                  </tr>
                </thead>
                <tbody>
                  {recentMerges.map((row, index) => {
                    const deletedUrl = `${TESSITURA_BASE}/${row.customer_no}/dashboard`
                    const keptUrl = `${TESSITURA_BASE}/${row.keep_cust}/dashboard`
                    const isUnmerged = unmergedRows.has(row.customer_no)
                    const isUnmerging = unmergingRow === row.customer_no
                    return (
                      <tr
                        key={`${row.customer_no}-${index}`}
                        style={index % 2 === 0 ? styles.rowEven : styles.rowOdd}
                      >
                        <td style={styles.td}>
                          <span style={{ ...styles.badge, backgroundColor: isUnmerged ? '#d97706' : '#718096' }}>
                            {isUnmerged ? 'Unmerged' : 'Merged'}
                          </span>
                        </td>
                        <td style={styles.td}>
                          <a href={deletedUrl} target="_blank" rel="noopener noreferrer" style={styles.customerLink}>
                            {row.customer_no}
                          </a>
                        </td>
                        <td style={styles.td}>{row.fname} {row.lname}</td>
                        <td style={styles.td}>
                          <a href={keptUrl} target="_blank" rel="noopener noreferrer" style={styles.customerLink}>
                            {row.keep_cust}
                          </a>
                        </td>
                        <td style={styles.td}>{row.criterion}</td>
                        <td style={styles.td}>
                          {!isUnmerged && (
                            <button
                              style={{ ...styles.cancelPairButton, opacity: isUnmerging ? 0.5 : 1, cursor: isUnmerging ? 'not-allowed' : 'pointer' }}
                              onClick={() => setUnmergeConfirm(row)}
                              disabled={isUnmerging}
                            >
                              {isUnmerging ? '...' : '↩ Unmerge'}
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
  actionCard: { backgroundColor: 'white', borderRadius: '12px', padding: '24px', flex: 1, minWidth: '220px', boxShadow: '0 2px 16px rgba(29,111,219,0.08)', border: '1px solid rgba(29,111,219,0.1)', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' },
  actionTitle: { fontSize: '15px', fontWeight: '700', color: '#0c1a33', marginBottom: '8px', fontFamily: "'Space Grotesk', sans-serif" },
  actionDesc: { fontSize: '13px', color: '#4b5563', marginBottom: '16px', lineHeight: '1.5', fontFamily: "'Inter', sans-serif" },
  stepArrow: { fontSize: '24px', color: '#9ca3af', paddingTop: '40px' },
  button: { width: '100%', padding: '12px', background: 'linear-gradient(135deg, #1d6fdb, #38bdf8)', color: 'white', border: 'none', borderRadius: '8px', fontSize: '14px', fontWeight: '600', fontFamily: "'Inter', sans-serif", cursor: 'pointer', boxShadow: '0 2px 12px rgba(29,111,219,0.25)' },
  reviewNote: { fontSize: '12px', color: '#dc2626', marginTop: '8px', textAlign: 'center', fontFamily: "'Inter', sans-serif" },
  message: { padding: '12px 16px', borderRadius: '8px', border: '1px solid', fontSize: '14px', marginBottom: '24px', fontFamily: "'Inter', sans-serif" },
  overlay: { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(12,26,51,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, backdropFilter: 'blur(4px)' },
  dialog: { backgroundColor: 'white', borderRadius: '16px', padding: '32px', maxWidth: '400px', width: '90%', boxShadow: '0 8px 40px rgba(29,111,219,0.15)', border: '1px solid rgba(29,111,219,0.1)' },
  dialogTitle: { fontSize: '18px', fontWeight: '700', color: '#0c1a33', marginBottom: '12px', fontFamily: "'Space Grotesk', sans-serif" },
  dialogText: { fontSize: '14px', color: '#4b5563', marginBottom: '24px', lineHeight: '1.6', fontFamily: "'Inter', sans-serif" },
  dialogButtons: { display: 'flex', gap: '12px', justifyContent: 'flex-end' },
  cancelButton: { padding: '10px 20px', backgroundColor: 'transparent', color: '#6b7280', border: '1px solid rgba(29,111,219,0.2)', borderRadius: '8px', fontSize: '14px', fontFamily: "'Inter', sans-serif", cursor: 'pointer' },
  commitButton: { padding: '10px 20px', backgroundColor: '#fee2e2', color: '#dc2626', border: '1px solid #fecaca', borderRadius: '8px', fontSize: '14px', fontWeight: '600', fontFamily: "'Inter', sans-serif", cursor: 'pointer' },
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
  actionButtons: { display: 'flex', gap: '8px', alignItems: 'center' },
  swapButton: { padding: '4px 10px', backgroundColor: 'rgba(29,111,219,0.06)', color: '#1d6fdb', border: '1px solid rgba(29,111,219,0.2)', borderRadius: '6px', fontSize: '12px', fontWeight: '600', fontFamily: "'Inter', sans-serif", cursor: 'pointer' },
  cancelPairButton: { padding: '4px 10px', backgroundColor: '#fee2e2', color: '#dc2626', border: '1px solid #fecaca', borderRadius: '6px', fontSize: '12px', fontWeight: '600', fontFamily: "'Inter', sans-serif", cursor: 'pointer' },
  mergeButton: { padding: '4px 10px', backgroundColor: '#dcfce7', color: '#16a34a', border: '1px solid #bbf7d0', borderRadius: '6px', fontSize: '12px', fontWeight: '600', fontFamily: "'Inter', sans-serif", cursor: 'pointer' },
  toggleRow: { display: 'flex', alignItems: 'center', gap: '8px', marginTop: '12px', justifyContent: 'center' },
  toggleLabel: { fontSize: '12px', color: '#4b5563', cursor: 'pointer', fontFamily: "'Inter', sans-serif" },
  toggle: { width: '36px', height: '20px', borderRadius: '10px', cursor: 'pointer', position: 'relative', transition: 'background-color 0.2s' },
  toggleKnob: { width: '16px', height: '16px', borderRadius: '50%', backgroundColor: 'white', position: 'absolute', top: '2px', transition: 'transform 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.2)' },
  emptyState: { padding: '32px', textAlign: 'center', color: '#9ca3af', fontSize: '14px', fontFamily: "'Inter', sans-serif" },
  toolCard: { backgroundColor: 'white', borderRadius: '12px', padding: '24px', boxShadow: '0 2px 16px rgba(29,111,219,0.08)', border: '1px solid rgba(29,111,219,0.1)' },
  toolCardHeader: { marginBottom: '8px' },
  toolInputRow: { display: 'flex', gap: '10px', alignItems: 'center' },
  toolInput: { flex: 1, padding: '10px 12px', border: '1px solid rgba(29,111,219,0.22)', borderRadius: '8px', fontSize: '14px', fontFamily: "'Inter', sans-serif", outline: 'none', color: '#0c1a33' },
  toolHint: { fontSize: '11px', color: '#9ca3af', fontStyle: 'italic', marginTop: '10px', fontFamily: "'Inter', sans-serif" },
  toolResult: { display: 'flex', alignItems: 'center', marginTop: '14px', padding: '10px 14px', backgroundColor: '#f8fafd', borderRadius: '8px', border: '1px solid rgba(29,111,219,0.12)' },
  toolResultText: { fontSize: '13px', color: '#374151', fontFamily: "'Inter', sans-serif" },
  optimizeResult: { backgroundColor: '#f8fafd', borderRadius: '8px', border: '1px solid rgba(29,111,219,0.12)', padding: '10px 14px', marginBottom: '4px' },
  optimizeRow: { display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: '1px solid #f0f3f8' },
  optimizeKey: { fontSize: '12px', color: '#6b7280', fontFamily: "'Inter', sans-serif" },
  optimizeVal: { fontSize: '12px', fontWeight: '600', color: '#0c1a33', fontFamily: "'Inter', sans-serif" },
  stepsGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginTop: '12px' },
  step: { display: 'flex', gap: '12px', alignItems: 'flex-start' },
  stepNum: { width: '28px', height: '28px', borderRadius: '50%', background: 'linear-gradient(135deg, #1d6fdb, #38bdf8)', color: 'white', fontSize: '13px', fontWeight: '700', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: '2px' },
  stepTitle: { fontSize: '14px', fontWeight: '600', color: '#0c1a33', marginBottom: '4px', fontFamily: "'Inter', sans-serif" },
  stepDesc: { fontSize: '13px', color: '#4b5563', lineHeight: '1.5', fontFamily: "'Inter', sans-serif" },
  statCard: { backgroundColor: 'white', borderRadius: '12px', padding: '24px', flex: 1, minWidth: '180px', boxShadow: '0 2px 16px rgba(29,111,219,0.08)', border: '1px solid rgba(29,111,219,0.1)' },
  statLabel: { fontSize: '11px', fontWeight: '700', letterSpacing: '1px', textTransform: 'uppercase', color: '#9ca3af', marginBottom: '8px', fontFamily: "'Inter', sans-serif" },
  statValue: { fontSize: '32px', fontWeight: '700', color: '#0c1a33', marginBottom: '4px', fontFamily: "'Space Grotesk', sans-serif" },
  statHint: { fontSize: '12px', color: '#9ca3af', marginTop: '8px', fontFamily: "'Inter', sans-serif" },
  sourceList: { display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '4px' },
  sourceRow: { display: 'flex', alignItems: 'center', gap: '8px' },
  sourceDot: { width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#16a34a', flexShrink: 0 },
  sourceLabel: { fontSize: '13px', color: '#4b5563', flex: 1, fontFamily: "'Inter', sans-serif" },
  sourceValue: { fontSize: '14px', fontWeight: '600', color: '#0c1a33', fontFamily: "'Inter', sans-serif" }
}
 

export default ConstituentMerge

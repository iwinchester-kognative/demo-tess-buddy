import React, { useState, useRef, useEffect, Component } from 'react'

// -----------------------------------------------------------------
// Build a Segment — AI-powered segment builder
//
// Two tabs:
//   1. Build   — Chat with Claude to describe & create a segment
//   2. My Segments — View lists in the "Tess Buddy" category
//
// Flow (Build tab):
//   1. User describes a segment in plain language
//   2. Claude generates SQL + a human-readable summary
//   3. User reviews the summary and approves or refines
//   4. On approval → insert into T_LIST via stored proc
// -----------------------------------------------------------------

// Error boundary to prevent white-screen crashes
class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null }
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }
  componentDidCatch(error, info) {
    console.error('ErrorBoundary caught:', error, info?.componentStack)
  }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: '16px 20px', backgroundColor: '#fff5f5', border: '1px solid #feb2b2', borderRadius: '8px', margin: '8px 0' }}>
          <p style={{ color: '#c53030', fontSize: '13px', margin: 0 }}>
            Something went wrong displaying this content.{' '}
            <button
              onClick={() => this.setState({ hasError: false, error: null })}
              style={{ background: 'none', border: 'none', color: '#1d6fdb', cursor: 'pointer', textDecoration: 'underline', fontSize: '13px', padding: 0 }}
            >
              Try again
            </button>
          </p>
        </div>
      )
    }
    return this.props.children
  }
}

// Context is now loaded server-side from /contexts/segments.md
// The proxy handles prompt caching automatically.
const SEGMENT_CONTEXT_ID = 'segments'

// --------------- Tab button (matches Screening pattern) ---------------

function TabButton({ label, active, onClick }) {
  return (
    <button
      style={active ? styles.tabActive : styles.tab}
      onClick={onClick}
    >
      {label}
    </button>
  )
}

// --------------- Main component ---------------

function BuildSegment({ orgData }) {
  const [activeTab, setActiveTab] = useState('build')

  return (
    <div>
      <div style={styles.header}>
        <h1 style={styles.title}>Build a Segment</h1>
        <p style={styles.subtitle}>
          Describe the audience you want to build and AI will create the segment for you,
          or view your existing Tess Buddy segments.
        </p>
      </div>

      <div style={styles.tabBar}>
        <TabButton label="Build"       active={activeTab === 'build'}      onClick={() => setActiveTab('build')} />
        <TabButton label="My Segments" active={activeTab === 'mySegments'} onClick={() => setActiveTab('mySegments')} />
      </div>

      <div style={styles.panel}>
        {activeTab === 'build'      && <BuildTab orgData={orgData} />}
        {activeTab === 'mySegments' && <ErrorBoundary><MySegmentsTab orgData={orgData} /></ErrorBoundary>}
      </div>
    </div>
  )
}

// =====================================================================
// BUILD TAB — AI chat interface
// =====================================================================

function BuildTab({ orgData }) {
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [pendingSegment, setPendingSegment] = useState(null)
  const [isCreating, setIsCreating] = useState(false)
  const chatEndRef = useRef(null)
  const inputRef = useRef(null)

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isLoading])

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  // ---------- Send message to Claude ----------
  const sendMessage = async () => {
    const trimmed = input.trim()
    if (!trimmed || isLoading) return

    const userMessage = { role: 'user', content: trimmed }
    setMessages(prev => [...prev, userMessage])
    setInput('')
    setIsLoading(true)
    setPendingSegment(null)

    try {
      const conversationHistory = messages
        .filter(m => m.role === 'user' || m.role === 'assistant')
        .map(m => ({ role: m.role, content: m.content }))

      const response = await fetch('/api/claude', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contextId: SEGMENT_CONTEXT_ID,
          userMessage: trimmed,
          conversationHistory
        })
      })

      if (!response.ok) {
        throw new Error(`API error: ${response.status}`)
      }

      const data = await response.json()
      const assistantText = data.content?.[0]?.text || ''

      // Claude sometimes wraps JSON in markdown code fences — strip them
      const cleanedText = assistantText
        .replace(/^```(?:json)?\s*/i, '')
        .replace(/\s*```\s*$/, '')
        .trim()

      let parsed = null
      try {
        parsed = JSON.parse(cleanedText)
      } catch {
        // Not valid JSON — show as plain assistant message
        setMessages(prev => [...prev, { role: 'assistant', content: assistantText }])
        setIsLoading(false)
        return
      }

      if (parsed.refinement_question) {
        setMessages(prev => [
          ...prev,
          { role: 'assistant', content: parsed.refinement_question, type: 'question' }
        ])
      } else if (parsed.sql && parsed.summary) {
        setMessages(prev => [
          ...prev,
          { role: 'assistant', content: parsed.summary, type: 'segment' }
        ])
        setPendingSegment({ summary: parsed.summary, sql: parsed.sql })
      } else {
        // Valid JSON but unexpected shape — show a friendly fallback
        const fallback = parsed.summary || parsed.refinement_question || cleanedText
        setMessages(prev => [...prev, { role: 'assistant', content: fallback }])
      }
    } catch (err) {
      console.error('Error calling Claude:', err)
      setMessages(prev => [
        ...prev,
        { role: 'system', content: 'Something went wrong reaching the AI. Please try again.' }
      ])
    }

    setIsLoading(false)
  }

  const handleApprove = async () => {
    if (!pendingSegment) return
    setIsCreating(true)

    try {
      // Call stored procedure via Custom/Execute.
      // The SQL is base64-encoded so the WAF doesn't see SQL keywords.
      const webApiBase = (orgData?.organizations?.tessitura_base_url || '')
        .replace(/\/TessituraService\/?$/i, '/Tessitura/api/')

      const sqlB64 = btoa(unescape(encodeURIComponent(pendingSegment.sql)))

      const execPayload = {
        ProcedureName: 'usp_tessbuddy_create_list',
        ParameterValues: [
          { Name: '@description',  Value: pendingSegment.summary.slice(0, 30) },
          { Name: '@list_sql_b64', Value: sqlB64 },
          { Name: '@category_id',  Value: '31' }
        ]
      }

      const endpoint = encodeURIComponent('Custom/Execute')
      const createResp = await fetch(`/api/tessitura?endpoint=${endpoint}`, {
        method: 'POST',
        headers: {
          'x-tessitura-auth': orgData?.organizations?.tessitura_auth_string,
          'x-tessitura-url':  webApiBase,
          'Content-Type':     'application/json'
        },
        body: JSON.stringify(execPayload)
      })

      if (!createResp.ok) {
        const errText = await createResp.text()
        const isHtml = /<html|<!doctype/i.test(errText)
        const friendly = isHtml
          ? `Tessitura's firewall blocked the request (HTTP ${createResp.status}). Contact your Tessitura admin to whitelist the API.`
          : (errText.slice(0, 300) || `Tessitura returned ${createResp.status}`)
        throw new Error(friendly)
      }

      // Parse the stored proc result — expects [{ Id, Description }]
      let listId = '?'
      try {
        const result = await createResp.json()
        const row = Array.isArray(result) ? result[0] : result
        listId = row?.Id ?? row?.id ?? row?.list_id ?? '?'
      } catch { /* response may be empty on success */ }

      // Generate the list (run the SQL to populate membership).
      // This endpoint takes no SQL in the body — just the list ID in the URL.
      let count = null
      if (listId !== '?') {
        try {
          const genEndpoint = encodeURIComponent(`Reporting/Lists/${listId}/Generate`)
          const genResp = await fetch(`/api/tessitura?endpoint=${genEndpoint}`, {
            method: 'POST',
            headers: {
              'x-tessitura-auth': orgData?.organizations?.tessitura_auth_string,
              'x-tessitura-url':  webApiBase,
              'Content-Type':     'application/json'
            },
            body: JSON.stringify({})
          })
          if (genResp.ok) {
            // Fetch the count after generation
            try {
              const summaryEp = encodeURIComponent(`Reporting/Lists/Summary/${listId}`)
              const summaryResp = await fetch(`/api/tessitura?endpoint=${summaryEp}`, {
                method: 'GET',
                headers: {
                  'x-tessitura-auth': orgData?.organizations?.tessitura_auth_string,
                  'x-tessitura-url':  webApiBase,
                  'Content-Type':     'application/json'
                }
              })
              if (summaryResp.ok) {
                const summary = await summaryResp.json()
                count = summary?.ConstituentCount ?? summary?.constituentCount ?? null
              }
            } catch { /* count is optional */ }
          }
        } catch {
          console.warn('List created but generate failed — user can generate in Tessitura')
        }
      }

      setMessages(prev => [
        ...prev,
        {
          role: 'system',
          type: 'success',
          content: `Segment created in Tessitura${listId !== '?' ? ` (List #${listId})` : ''}.${count != null ? ` ${count.toLocaleString()} constituents matched.` : ''}`
        }
      ])
      setPendingSegment(null)
    } catch (err) {
      console.error('Failed to create list:', err)
      setMessages(prev => [
        ...prev,
        { role: 'system', content: `Failed to create the segment: ${err.message}` }
      ])
    }

    setIsCreating(false)
  }

  const handleReject = () => {
    setPendingSegment(null)
    setMessages(prev => [
      ...prev,
      { role: 'system', content: "No problem — describe what you'd like to change and I'll regenerate." }
    ])
    inputRef.current?.focus()
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  return (
    <div style={styles.buildWrapper}>
      {/* Chat area */}
      <div style={styles.chatContainer}>
        <div style={styles.chatMessages}>
          {messages.length === 0 && (
            <div style={styles.emptyState}>
              <div style={styles.emptyIcon}>&#10022;</div>
              <p style={styles.emptyTitle}>Describe your segment</p>
              <p style={styles.emptyHint}>
                Try something like: "Everyone who donated over $500 in the last 12 months"
                or "Subscribers who attended 3+ performances this season"
              </p>
            </div>
          )}

          {messages.map((msg, i) => (
            <div key={i} style={msg.role === 'user' ? styles.userRow : styles.assistantRow}>
              <div style={{
                ...styles.bubble,
                ...(msg.role === 'user' ? styles.userBubble : {}),
                ...(msg.role === 'system' ? styles.systemBubble : {}),
                ...(msg.type === 'success' ? styles.successBubble : {}),
                ...(msg.type === 'segment' ? styles.segmentBubble : {})
              }}>
                {msg.type === 'segment' && <div style={styles.segmentLabel}>Proposed Segment</div>}
                <p style={styles.bubbleText}>{msg.content}</p>
              </div>
            </div>
          ))}

          {isLoading && (
            <div style={styles.assistantRow}>
              <div style={styles.bubble}>
                <div style={styles.typing}>
                  <span style={styles.dot}>&#9679;</span>
                  <span style={{ ...styles.dot, animationDelay: '0.2s' }}>&#9679;</span>
                  <span style={{ ...styles.dot, animationDelay: '0.4s' }}>&#9679;</span>
                </div>
              </div>
            </div>
          )}

          <div ref={chatEndRef} />
        </div>

        {/* Approval bar */}
        {pendingSegment && !isCreating && (
          <div style={styles.approvalBar}>
            <p style={styles.approvalText}>Does this segment look right?</p>
            <div style={styles.approvalButtons}>
              <button style={styles.approveBtn} onClick={handleApprove}>Create Segment</button>
              <button style={styles.rejectBtn} onClick={handleReject}>Refine</button>
            </div>
          </div>
        )}

        {isCreating && (
          <div style={styles.approvalBar}>
            <p style={styles.approvalText}>Creating segment in Tessitura...</p>
          </div>
        )}

        {/* Input area */}
        <div style={styles.inputArea}>
          <textarea
            ref={inputRef}
            style={styles.chatInput}
            placeholder="Describe the segment you want to build..."
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            rows={1}
            disabled={isLoading || isCreating}
          />
          <button
            style={{
              ...styles.sendBtn,
              ...((!input.trim() || isLoading) ? styles.sendBtnDisabled : {})
            }}
            onClick={sendMessage}
            disabled={!input.trim() || isLoading}
          >
            &#8593;
          </button>
        </div>
      </div>
    </div>
  )
}

// =====================================================================
// MY SEGMENTS TAB — lists filtered to "Tess Buddy" category
// =====================================================================

function MySegmentsTab({ orgData }) {
  const [lists, setLists]               = useState([])
  const [loadingLists, setLoadingLists] = useState(true)
  const [listsError, setListsError]     = useState(null)
  const [searchText, setSearchText]     = useState('')
  const [expandedId, setExpandedId]     = useState(null)    // which list is expanded
  const [contents, setContents]         = useState([])       // [{ customer_no, sort_name }]
  const [loadingContents, setLoadingContents] = useState(false)
  const [contentsError, setContentsError]     = useState(null)
  const [totalCount, setTotalCount]     = useState(0)
  const [deletingId, setDeletingId]     = useState(null)

  // Compute the Tessitura Web API base from the classic TessituraService URL
  const webApiBase = (orgData?.organizations?.tessitura_base_url || '')
    .replace(/\/TessituraService\/?$/i, '/Tessitura/api/')

  // Fetch lists filtered to "Tess Buddy" category. Debounced 300ms for search.
  useEffect(() => {
    let cancelled = false
    const timer = setTimeout(async () => {
      setLoadingLists(true)
      setListsError(null)
      try {
        const authHeaders = {
          'x-tessitura-auth': orgData?.organizations?.tessitura_auth_string,
          'x-tessitura-url':  webApiBase,
          'Content-Type':     'application/json'
        }

        // First, find the "Tess Buddy" category ID
        const catEndpoint = encodeURIComponent('ReferenceData/ListCategories/Summary?activeOnly=true')
        const catResp = await fetch(`/api/tessitura?endpoint=${catEndpoint}`, {
          method: 'GET', headers: authHeaders
        })
        if (!catResp.ok) throw new Error(`Categories: ${catResp.status}`)
        const catData = await catResp.json()
        const catRaw = Array.isArray(catData) ? catData : (catData?.Categories || catData?.categories || [])
        const tessBuddyCat = catRaw.find(c => {
          const name = (c?.Description ?? c?.description ?? c?.Name ?? c?.name ?? '').toLowerCase()
          return name === 'tess buddy'
        })

        if (!tessBuddyCat) {
          if (!cancelled) {
            setLists([])
            setListsError('No "Tess Buddy" list category found in Tessitura. Create the category first, then segments built here will appear.')
          }
          if (!cancelled) setLoadingLists(false)
          return
        }

        const categoryId = tessBuddyCat?.Id ?? tessBuddyCat?.id ?? tessBuddyCat?.CategoryId

        // Now fetch lists in that category
        const listEndpoint = encodeURIComponent('Reporting/Lists/Search')
        const body = {
          MyListsOnly:     false,
          ActiveOnly:      true,
          CategoryId:      Number(categoryId),
          Page:            1,
          PageSize:        500,
          SortByField:     'LastGeneratedDate',
          SortByDirection: 'Desc'
        }
        if (searchText.trim()) {
          body.SearchText = searchText.trim()
        }

        const listResp = await fetch(`/api/tessitura?endpoint=${listEndpoint}`, {
          method:  'POST',
          headers: authHeaders,
          body:    JSON.stringify(body)
        })
        if (!listResp.ok) throw new Error(`Lists: ${listResp.status}`)
        const listData = await listResp.json()
        const listRaw = Array.isArray(listData) ? listData : (listData?.Lists || listData?.lists || listData?.Results || [])

        const normalized = listRaw.map(raw => ({
          id:            raw?.Id ?? raw?.id ?? raw?.ListNumber ?? null,
          name:          raw?.Description ?? raw?.description ?? raw?.Name ?? raw?.name ?? '',
          createdDate:   raw?.CreateDate ?? raw?.createDate ?? raw?.CreatedDate ?? null,
          generatedDate: raw?.LastGeneratedDate ?? raw?.lastGeneratedDate ?? null,
          recordCount:   raw?.RecordCount ?? raw?.recordCount ?? raw?.NumberOfRecords ?? null,
          createdBy:     raw?.CreatedBy ?? raw?.createdBy ?? null
        })).filter(l => l.id !== null)

        if (!cancelled) setLists(normalized)
      } catch (err) {
        if (!cancelled) setListsError(err.message)
      }
      if (!cancelled) setLoadingLists(false)
    }, 300)

    return () => { cancelled = true; clearTimeout(timer) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orgData, searchText])

  const formatDate = (dateStr) => {
    if (!dateStr) return '—'
    try {
      return new Date(dateStr).toLocaleDateString('en-US', {
        month: 'short', day: 'numeric', year: 'numeric'
      })
    } catch { return '—' }
  }

  const authHeaders = {
    'x-tessitura-auth': orgData?.organizations?.tessitura_auth_string,
    'x-tessitura-url':  webApiBase,
    'Content-Type':     'application/json'
  }

  const handleDelete = async (e, listId, listName) => {
    e.stopPropagation() // don't trigger row expand
    if (!window.confirm(`Delete list "${listName}" (#${listId})? This cannot be undone.`)) return

    setDeletingId(listId)
    try {
      const ep = encodeURIComponent(`Reporting/Lists/${listId}`)
      const resp = await fetch(`/api/tessitura?endpoint=${ep}`, {
        method: 'DELETE', headers: authHeaders
      })
      if (!resp.ok) {
        const errText = await resp.text()
        throw new Error(errText.slice(0, 200) || `Delete failed: ${resp.status}`)
      }
      // Remove from local state
      setLists(prev => prev.filter(l => l.id !== listId))
      if (expandedId === listId) {
        setExpandedId(null)
        setContents([])
      }
    } catch (err) {
      alert(`Failed to delete: ${err.message}`)
    }
    setDeletingId(null)
  }

  const PREVIEW_LIMIT = 100

  const handleRowClick = async (listId) => {
    // Toggle off if clicking the same row
    if (expandedId === listId) {
      setExpandedId(null)
      setContents([])
      setContentsError(null)
      return
    }

    setExpandedId(listId)
    setContents([])
    setContentsError(null)
    setLoadingContents(true)
    setTotalCount(0)

    try {
      // Step 1: Get constituent IDs from list contents
      const contentsEndpoint = encodeURIComponent(`Reporting/Lists/${listId}/Contents`)
      const contentsResp = await fetch(`/api/tessitura?endpoint=${contentsEndpoint}`, {
        method: 'GET', headers: authHeaders
      })

      // Read as text first so we can detect HTML/WAF responses
      const rawText = await contentsResp.text()

      if (!contentsResp.ok) {
        const isHtml = /<html|<!doctype/i.test(rawText)
        throw new Error(isHtml
          ? 'Tessitura firewall blocked the request. The list contents could not be loaded.'
          : `Failed to load list contents (HTTP ${contentsResp.status})`)
      }

      let contentsData
      try {
        contentsData = JSON.parse(rawText)
      } catch {
        console.error('Contents response is not JSON:', rawText.slice(0, 200))
        throw new Error('Tessitura returned an unexpected response for list contents.')
      }

      // Contents may be a flat array of IDs, or an array of objects with ConstituentId
      let allIds = []
      if (Array.isArray(contentsData)) {
        allIds = contentsData.map(item => {
          if (item == null) return null
          if (typeof item === 'number' || typeof item === 'string') return item
          if (typeof item === 'object') return item?.ConstituentId ?? item?.constituentId ?? item?.Id ?? item?.id ?? null
          return null
        }).filter(id => id != null)
      } else if (contentsData && typeof contentsData === 'object') {
        const nested = contentsData?.ConstituentIds ?? contentsData?.constituentIds ?? contentsData?.Results ?? contentsData?.results ?? null
        if (Array.isArray(nested)) {
          allIds = nested.filter(id => id != null)
        }
      }

      if (!Array.isArray(allIds) || allIds.length === 0) {
        setContentsError('This list has no constituents. Try regenerating it in Tessitura.')
        setLoadingContents(false)
        return
      }

      // Check if the contents data already includes names (some Tessitura versions do)
      let alreadyHasNames = false
      if (Array.isArray(contentsData) && contentsData.length > 0 && typeof contentsData[0] === 'object') {
        const first = contentsData[0]
        if (first?.SortName || first?.sortName || first?.DisplayName || first?.displayName || first?.Name || first?.name) {
          alreadyHasNames = true
        }
      }

      setTotalCount(allIds.length)

      const previewIds = allIds.slice(0, PREVIEW_LIMIT)

      if (alreadyHasNames) {
        // Contents already has name data — use it directly
        const constituentRows = contentsData.slice(0, PREVIEW_LIMIT).map((item, idx) => ({
          customer_no: String(item?.ConstituentId ?? item?.constituentId ?? item?.Id ?? item?.id ?? allIds[idx] ?? ''),
          sort_name: String(item?.SortName ?? item?.sortName ?? item?.DisplayName ?? item?.displayName ?? item?.Name ?? item?.name ?? '')
        }))
        setContents(constituentRows)
      } else {
        // Try bulk search first — much faster than individual calls
        let constituentRows = null
        try {
          const searchEp = encodeURIComponent('CRM/Constituents/Search')
          const searchResp = await fetch(`/api/tessitura?endpoint=${searchEp}`, {
            method: 'POST',
            headers: authHeaders,
            body: JSON.stringify({
              ConstituentIds: previewIds.map(Number),
              PageSize: PREVIEW_LIMIT
            })
          })
          if (searchResp.ok) {
            const searchText = await searchResp.text()
            const searchData = JSON.parse(searchText)
            const results = Array.isArray(searchData) ? searchData : (searchData?.Results ?? searchData?.results ?? [])
            if (Array.isArray(results) && results.length > 0) {
              constituentRows = results.map(r => ({
                customer_no: String(r?.Id ?? r?.id ?? r?.ConstituentId ?? r?.constituentId ?? ''),
                sort_name: String(r?.SortName ?? r?.sortName ?? r?.DisplayName ?? r?.displayName ?? r?.Name ?? r?.name ?? '')
              }))
            }
          }
        } catch {
          console.warn('Bulk constituent search failed, falling back to individual lookups')
        }

        // Fallback: individual lookups in small batches
        if (!constituentRows) {
          constituentRows = []
          const BATCH_SIZE = 10
          for (let i = 0; i < previewIds.length; i += BATCH_SIZE) {
            const batch = previewIds.slice(i, i + BATCH_SIZE)
            let batchResults
            try {
              batchResults = await Promise.all(
                batch.map(async (id) => {
                  try {
                    const ep = encodeURIComponent(`CRM/Constituents/${id}`)
                    const resp = await fetch(`/api/tessitura?endpoint=${ep}`, {
                      method: 'GET', headers: authHeaders
                    })
                    if (!resp.ok) return { customer_no: String(id), sort_name: '(unable to load)' }
                    const data = await resp.json()
                    return {
                      customer_no: String(id),
                      sort_name: String(data?.SortName ?? data?.sortName ?? data?.DisplayName ?? data?.displayName ?? `#${id}`)
                    }
                  } catch {
                    return { customer_no: String(id), sort_name: '(error)' }
                  }
                })
              )
            } catch {
              batchResults = batch.map(id => ({ customer_no: String(id), sort_name: '(batch error)' }))
            }
            constituentRows.push(...batchResults)
          }
        }

        setContents(constituentRows)
      }
    } catch (err) {
      console.error('handleRowClick error:', err)
      setContentsError(String(err?.message || 'An unexpected error occurred'))
    }

    setLoadingContents(false)
  }

  return (
    <div>
      <h2 style={styles.sectionHeading}>Tess Buddy Segments</h2>
      <p style={styles.sectionBody}>
        Lists created by Tess Buddy's segment builder. These are stored in Tessitura under the "Tess Buddy" category.
      </p>

      <div style={styles.formRow}>
        <label style={styles.label}>Search</label>
        <input
          type="text"
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
          placeholder="Filter by name..."
          style={styles.formInput}
        />
      </div>

      {listsError && (
        <div style={{ ...styles.messageBox, backgroundColor: '#fffbea', borderColor: '#f6e05e', color: '#975a16' }}>
          {listsError}
        </div>
      )}

      {loadingLists && (
        <p style={styles.loadingText}>Loading segments...</p>
      )}

      {!loadingLists && !listsError && lists.length === 0 && (
        <div style={styles.emptySegments}>
          <p style={styles.emptySegmentsTitle}>No segments yet</p>
          <p style={styles.emptySegmentsHint}>
            Segments you build using the AI assistant will show up here.
          </p>
        </div>
      )}

      {!loadingLists && lists.length > 0 && (
        <div style={styles.tableWrap}>
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.th}>List #</th>
                <th style={styles.th}>Name</th>
                <th style={styles.th}>Records</th>
                <th style={styles.th}>Created</th>
                <th style={styles.th}>Last Generated</th>
                <th style={{ ...styles.th, width: '60px' }}> </th>
              </tr>
            </thead>
            <tbody>
              {lists.map((l) => (
                <React.Fragment key={l.id}>
                  <tr
                    style={{
                      ...styles.tr,
                      cursor: 'pointer',
                      backgroundColor: expandedId === l.id ? '#f7f8fa' : 'transparent'
                    }}
                    onClick={() => handleRowClick(l.id)}
                  >
                    <td style={styles.td}>
                      <span style={styles.listId}>
                        <span style={{ marginRight: '6px', fontSize: '10px', color: '#4b5563' }}>
                          {expandedId === l.id ? '▼' : '▶'}
                        </span>
                        #{l.id}
                      </span>
                    </td>
                    <td style={styles.td}>
                      <span style={styles.listName}>{l.name}</span>
                    </td>
                    <td style={styles.td}>
                      {l.recordCount != null ? Number(l.recordCount).toLocaleString() : '—'}
                    </td>
                    <td style={styles.td}>{formatDate(l.createdDate)}</td>
                    <td style={styles.td}>{formatDate(l.generatedDate)}</td>
                    <td style={styles.td}>
                      <button
                        style={styles.deleteBtn}
                        onClick={(e) => handleDelete(e, l.id, l.name)}
                        disabled={deletingId === l.id}
                        title="Delete this segment"
                      >
                        {deletingId === l.id ? '...' : '✕'}
                      </button>
                    </td>
                  </tr>

                  {/* Expanded contents panel */}
                  {expandedId === l.id && (
                    <tr>
                      <td colSpan={6} style={{ padding: 0 }}>
                        <ErrorBoundary>
                        <div style={styles.contentsPanel}>
                          {loadingContents && (
                            <p style={styles.loadingText}>Loading constituents...</p>
                          )}
                          {contentsError && (
                            <div style={{ ...styles.messageBox, backgroundColor: '#fff5f5', borderColor: '#feb2b2', color: '#c53030', margin: '0' }}>
                              {String(contentsError)}
                            </div>
                          )}
                          {!loadingContents && !contentsError && Array.isArray(contents) && contents.length > 0 && (
                            <>
                              <div style={styles.contentsHeader}>
                                {Number(totalCount) > PREVIEW_LIMIT
                                  ? `Showing ${PREVIEW_LIMIT} of ${Number(totalCount).toLocaleString()} constituents`
                                  : `${Number(totalCount).toLocaleString()} constituent${Number(totalCount) === 1 ? '' : 's'}`
                                }
                              </div>
                              <div style={styles.contentsScroll}>
                                <table style={styles.contentsTable}>
                                  <thead>
                                    <tr>
                                      <th style={styles.contentsTh}>Customer #</th>
                                      <th style={styles.contentsTh}>Sort Name</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {contents.map((c, idx) => (
                                      <tr key={c?.customer_no ?? idx} style={styles.contentsTr}>
                                        <td style={styles.contentsTd}>
                                          <span style={styles.listId}>{String(c?.customer_no ?? '')}</span>
                                        </td>
                                        <td style={styles.contentsTd}>{String(c?.sort_name ?? '')}</td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            </>
                          )}
                        </div>
                        </ErrorBoundary>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ---- Keyframe animation for typing dots (injected once) ----
const styleTag = document.createElement('style')
styleTag.textContent = `
  @keyframes blink {
    0%, 80%, 100% { opacity: 0.3; }
    40% { opacity: 1; }
  }
`
document.head.appendChild(styleTag)

// ---- Styles ----

const styles = {
  // Layout
  header: { marginBottom: '24px' },
  title: { fontSize: '24px', fontWeight: '700', color: '#0c1a33', marginBottom: '4px' },
  subtitle: { fontSize: '13px', color: '#4b5563', maxWidth: '640px', lineHeight: '1.6' },

  // Tabs (matching Screening)
  tabBar: { display: 'flex', gap: '4px', borderBottom: '1px solid rgba(29,111,219,0.15)', marginBottom: '24px' },
  tab: {
    padding: '10px 18px', backgroundColor: 'transparent', color: '#4b5563',
    border: 'none', borderBottom: '2px solid transparent',
    fontSize: '14px', fontWeight: '500', cursor: 'pointer'
  },
  tabActive: {
    padding: '10px 18px', backgroundColor: 'transparent', color: '#0c1a33',
    border: 'none', borderBottom: '2px solid #1d6fdb',
    fontSize: '14px', fontWeight: '700', cursor: 'pointer'
  },

  panel: {
    backgroundColor: 'white', borderRadius: '12px', padding: '28px',
    boxShadow: '0 2px 16px rgba(29,111,219,0.08)', border: '1px solid rgba(29,111,219,0.1)', maxWidth: '860px'
  },

  // ---------- Build tab ----------
  buildWrapper: {
    display: 'flex',
    flexDirection: 'column',
    height: 'calc(100vh - 280px)',
    minHeight: '400px'
  },

  // Chat container
  chatContainer: {
    flex: 1, display: 'flex', flexDirection: 'column',
    border: '1px solid rgba(29,111,219,0.12)', borderRadius: '10px', overflow: 'hidden'
  },
  chatMessages: {
    flex: 1, overflowY: 'auto', padding: '24px',
    display: 'flex', flexDirection: 'column', gap: '16px'
  },

  // Empty state
  emptyState: {
    flex: 1, display: 'flex', flexDirection: 'column',
    alignItems: 'center', justifyContent: 'center',
    color: '#9ca3af', textAlign: 'center', padding: '40px'
  },
  emptyIcon: { fontSize: '32px', color: '#1d6fdb', marginBottom: '12px' },
  emptyTitle: { fontSize: '16px', fontWeight: '600', color: '#4b5563', marginBottom: '8px' },
  emptyHint: { fontSize: '13px', color: '#9ca3af', lineHeight: '1.6', maxWidth: '400px' },

  // Message rows
  userRow: { display: 'flex', justifyContent: 'flex-end' },
  assistantRow: { display: 'flex', justifyContent: 'flex-start' },

  // Bubbles
  bubble: {
    maxWidth: '85%', padding: '12px 16px', borderRadius: '12px',
    backgroundColor: '#f8fafd', fontSize: '14px', lineHeight: '1.6'
  },
  userBubble: { backgroundColor: '#1d6fdb', color: 'white' },
  systemBubble: { backgroundColor: 'transparent', color: '#4b5563', fontStyle: 'italic', padding: '8px 0' },
  successBubble: { backgroundColor: '#f0fff4', color: '#16a34a', border: '1px solid #c6f6d5', fontStyle: 'normal' },
  segmentBubble: { backgroundColor: 'rgba(29,111,219,0.06)', border: '1px solid rgba(29,111,219,0.2)' },
  segmentLabel: {
    fontSize: '11px', fontWeight: '700', letterSpacing: '0.5px',
    textTransform: 'uppercase', color: '#1d6fdb', marginBottom: '6px'
  },
  bubbleText: { margin: 0, whiteSpace: 'pre-wrap' },

  // Typing
  typing: { display: 'flex', gap: '4px', padding: '4px 0' },
  dot: { fontSize: '10px', color: '#4b5563', animation: 'blink 1.4s infinite both' },

  // Approval bar
  approvalBar: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '12px 24px', backgroundColor: 'rgba(29,111,219,0.06)', borderTop: '1px solid #bee3f8'
  },
  approvalText: { fontSize: '14px', fontWeight: '500', color: '#1d6fdb', margin: 0 },
  approvalButtons: { display: 'flex', gap: '8px' },
  approveBtn: {
    padding: '8px 20px', backgroundColor: '#1d6fdb', color: 'white',
    border: 'none', borderRadius: '8px', fontSize: '13px', fontWeight: '600', cursor: 'pointer'
  },
  rejectBtn: {
    padding: '8px 20px', backgroundColor: 'transparent', color: '#1d6fdb',
    border: '1px solid #1d6fdb', borderRadius: '8px', fontSize: '13px', fontWeight: '600', cursor: 'pointer'
  },

  // Input area
  inputArea: {
    display: 'flex', alignItems: 'flex-end', gap: '8px',
    padding: '16px 24px', borderTop: '1px solid #e2e8f0'
  },
  chatInput: {
    flex: 1, padding: '12px 16px', border: '1px solid rgba(29,111,219,0.12)',
    borderRadius: '10px', fontSize: '14px', fontFamily: 'inherit',
    resize: 'none', outline: 'none', lineHeight: '1.5', maxHeight: '120px'
  },
  sendBtn: {
    width: '40px', height: '40px', borderRadius: '10px',
    backgroundColor: '#1d6fdb', color: 'white', border: 'none',
    fontSize: '18px', fontWeight: '700', cursor: 'pointer',
    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
  },
  sendBtnDisabled: { backgroundColor: '#cbd5e0', cursor: 'not-allowed' },

  // ---------- My Segments tab ----------
  sectionHeading: { fontSize: '16px', fontWeight: '700', color: '#0c1a33', marginBottom: '6px' },
  sectionBody: { fontSize: '13px', color: '#4b5563', lineHeight: '1.6', marginBottom: '12px', maxWidth: '640px' },

  formRow: { display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px', flexWrap: 'wrap' },
  label: { fontSize: '12px', fontWeight: '700', color: '#4b5563', textTransform: 'uppercase', letterSpacing: '0.5px', minWidth: '80px' },
  formInput: {
    padding: '8px 12px', fontSize: '14px', borderRadius: '8px',
    border: '1px solid #d0d4db', minWidth: '260px', outline: 'none'
  },

  messageBox: {
    padding: '12px 16px', borderRadius: '8px', border: '1px solid',
    fontSize: '13px', marginTop: '8px', marginBottom: '16px'
  },

  loadingText: { fontSize: '13px', color: '#4b5563', padding: '20px 0' },

  emptySegments: {
    padding: '40px 20px', textAlign: 'center',
    backgroundColor: '#f0f7ff', borderRadius: '8px', border: '1px dashed #d0d4db'
  },
  emptySegmentsTitle: { fontSize: '15px', fontWeight: '600', color: '#4b5563', marginBottom: '6px' },
  emptySegmentsHint: { fontSize: '13px', color: '#4b5563', margin: 0 },

  // Table
  tableWrap: {
    marginTop: '16px', border: '1px solid rgba(29,111,219,0.12)', borderRadius: '8px',
    overflow: 'hidden'
  },
  table: { width: '100%', borderCollapse: 'collapse', fontSize: '13px' },
  th: {
    textAlign: 'left', padding: '10px 14px', backgroundColor: '#f0f7ff',
    fontSize: '11px', fontWeight: '700', color: '#4b5563', textTransform: 'uppercase',
    letterSpacing: '0.4px', borderBottom: '1px solid rgba(29,111,219,0.15)'
  },
  tr: { borderBottom: '1px solid #f2f4f7' },
  td: { padding: '10px 14px', verticalAlign: 'middle', color: '#333' },
  listId: { fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontSize: '12px', color: '#4b5563' },
  listName: { fontWeight: '600', color: '#0c1a33' },

  // Expanded contents panel
  contentsPanel: {
    padding: '16px 20px', backgroundColor: '#fafbfc',
    borderTop: '1px solid #e2e5ea'
  },
  contentsHeader: {
    fontSize: '11px', fontWeight: '700', color: '#4b5563', textTransform: 'uppercase',
    letterSpacing: '0.4px', marginBottom: '10px'
  },
  deleteBtn: {
    background: 'none', border: '1px solid rgba(29,111,219,0.12)', borderRadius: '4px',
    color: '#9ca3af', cursor: 'pointer', fontSize: '13px', padding: '2px 8px',
    lineHeight: '1.4', transition: 'all 0.15s'
  },
  contentsScroll: {
    maxHeight: '320px', overflowY: 'auto',
    border: '1px solid rgba(29,111,219,0.12)', borderRadius: '6px', backgroundColor: 'white'
  },
  contentsTable: { width: '100%', borderCollapse: 'collapse', fontSize: '12px' },
  contentsTh: {
    position: 'sticky', top: 0, backgroundColor: '#f8fafd',
    textAlign: 'left', padding: '8px 12px', fontSize: '11px',
    fontWeight: '700', color: '#4b5563', textTransform: 'uppercase',
    letterSpacing: '0.4px', borderBottom: '1px solid rgba(29,111,219,0.15)'
  },
  contentsTr: { borderBottom: '1px solid #f2f4f7' },
  contentsTd: { padding: '6px 12px', verticalAlign: 'middle', color: '#333' }
}

export default BuildSegment

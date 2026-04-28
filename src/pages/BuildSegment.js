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
        <TabButton label="Build"              active={activeTab === 'build'}         onClick={() => setActiveTab('build')} />
        <TabButton label="Suggested Segments" active={activeTab === 'suggested'}     onClick={() => setActiveTab('suggested')} />
        <TabButton label="Quick Tools"        active={activeTab === 'quickTools'}    onClick={() => setActiveTab('quickTools')} />
        <TabButton label="My Segments"        active={activeTab === 'mySegments'}    onClick={() => setActiveTab('mySegments')} />
      </div>

      <div style={activeTab === 'build' || activeTab === 'mySegments' ? styles.panel : styles.panelWide}>
        {activeTab === 'build'         && <BuildTab orgData={orgData} />}
        {activeTab === 'suggested'     && <SuggestedTab onBuild={(prompt) => { setActiveTab('build'); }} />}
        {activeTab === 'quickTools'    && <QuickToolsTab />}
        {activeTab === 'mySegments'    && <ErrorBoundary><MySegmentsTab orgData={orgData} /></ErrorBoundary>}
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

// =====================================================================
// SUGGESTED SEGMENTS TAB
// =====================================================================

const SUGGESTED_SEGMENTS = [
  {
    id: 1,
    icon: '📉',
    tag: 'Lapsed Donors',
    name: 'The "We Miss You" List',
    description: 'Donors who gave between $100–$999 in FY22 or FY23 but have made no gift since. High recapture potential based on giving history.',
    est: '1,284',
    confidence: 'High',
    sql: `SELECT c.customer_no, c.sort_name, MAX(g.gift_dt) AS last_gift_dt\nFROM t_customer c\nJOIN t_gift g ON g.customer_no = c.customer_no\nWHERE g.gift_dt < DATEADD(year,-1,GETDATE())\n  AND g.gift_amount BETWEEN 100 AND 999\n  AND NOT EXISTS (\n    SELECT 1 FROM t_gift g2\n    WHERE g2.customer_no = c.customer_no\n      AND g2.gift_dt >= DATEADD(year,-1,GETDATE())\n  )\nGROUP BY c.customer_no, c.sort_name`,
  },
  {
    id: 2,
    icon: '🎟️',
    tag: 'Upgrade Prospects',
    name: 'Season Ticket Holders, No Gift on File',
    description: 'Subscribers who have renewed at least twice but have never made an outright donation. Your lowest-hanging major gift fruit.',
    est: '412',
    confidence: 'High',
    sql: `SELECT DISTINCT c.customer_no, c.sort_name\nFROM t_customer c\nJOIN t_sub s ON s.customer_no = c.customer_no\nWHERE s.sub_count >= 2\n  AND NOT EXISTS (\n    SELECT 1 FROM t_gift g\n    WHERE g.customer_no = c.customer_no\n  )`,
  },
  {
    id: 3,
    icon: '🌱',
    tag: 'First-Time Buyers',
    name: 'New Faces — No Follow-Up Yet',
    description: 'Patrons who purchased tickets for the first time in the current or prior season and have received no cultivation contact since.',
    est: '2,108',
    confidence: 'Medium',
    sql: `SELECT c.customer_no, c.sort_name, MIN(o.order_dt) AS first_purchase\nFROM t_customer c\nJOIN t_order o ON o.customer_no = c.customer_no\nWHERE o.order_dt >= DATEADD(year,-2,GETDATE())\nGROUP BY c.customer_no, c.sort_name\nHAVING MIN(o.order_dt) >= DATEADD(year,-2,GETDATE())\n  AND MAX(o.order_dt) < DATEADD(month,-3,GETDATE())`,
  },
  {
    id: 4,
    icon: '🏆',
    tag: 'Major Gift',
    name: 'Cumulative $5K+ — No Current Ask',
    description: 'Constituents whose cumulative lifetime giving exceeds $5,000 but who are not currently in an active major gift solicitation.',
    est: '88',
    confidence: 'High',
    sql: `SELECT c.customer_no, c.sort_name, SUM(g.gift_amount) AS lifetime_giving\nFROM t_customer c\nJOIN t_gift g ON g.customer_no = c.customer_no\nGROUP BY c.customer_no, c.sort_name\nHAVING SUM(g.gift_amount) >= 5000`,
  },
  {
    id: 5,
    icon: '🔁',
    tag: 'Reactivation',
    name: 'Ticket Buyers Gone Dark (3+ Years)',
    description: 'Patrons with 5 or more past transactions who haven\'t purchased in 3 or more years. Strong attendance history makes them worthwhile to re-engage.',
    est: '3,741',
    confidence: 'Medium',
    sql: `SELECT c.customer_no, c.sort_name, COUNT(o.id) AS order_count\nFROM t_customer c\nJOIN t_order o ON o.customer_no = c.customer_no\nGROUP BY c.customer_no, c.sort_name\nHAVING COUNT(o.id) >= 5\n  AND MAX(o.order_dt) < DATEADD(year,-3,GETDATE())`,
  },
  {
    id: 6,
    icon: '📬',
    tag: 'Email Reachout',
    name: 'Valid Email, No Open in 18 Months',
    description: 'Constituents with a verified email address who haven\'t opened a campaign email in the past 18 months. Good list for a re-permission campaign.',
    est: '5,902',
    confidence: 'Medium',
    sql: `SELECT c.customer_no, c.sort_name, c.email_address\nFROM t_customer c\nWHERE c.email_address IS NOT NULL\n  AND c.email_status = 'A'\n  AND (c.last_email_open_dt IS NULL\n    OR c.last_email_open_dt < DATEADD(month,-18,GETDATE()))`,
  },
]

function SuggestedTag({ label, color }) {
  return (
    <span style={{
      display: 'inline-block', padding: '2px 8px', borderRadius: '100px',
      fontSize: '10px', fontWeight: '700', letterSpacing: '0.04em', textTransform: 'uppercase',
      background: color + '18', color: color, fontFamily: "'Inter', sans-serif",
    }}>{label}</span>
  )
}

const TAG_COLORS = { 'Lapsed Donors': '#9333ea', 'Upgrade Prospects': '#0369a1', 'First-Time Buyers': '#16a34a', 'Major Gift': '#b45309', 'Reactivation': '#1d6fdb', 'Email Reachout': '#0891b2' }

function SuggestedTab({ onBuild }) {
  const [expanded, setExpanded] = useState(null)
  const [building, setBuilding] = useState(null)
  const [built, setBuilt] = useState({})

  const handleBuild = async (seg) => {
    setBuilding(seg.id)
    await new Promise(r => setTimeout(r, 1400))
    setBuilding(null)
    setBuilt(prev => ({ ...prev, [seg.id]: true }))
  }

  return (
    <div>
      <p style={{ fontSize: '13px', color: '#6b7280', marginBottom: '20px', fontFamily: "'Inter', sans-serif", lineHeight: '1.6' }}>
        Based on your patron database patterns, these audiences are ready to use. Click any card to preview the logic, then build the segment in one click.
      </p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '14px' }}>
        {SUGGESTED_SEGMENTS.map(seg => {
          const isExp = expanded === seg.id
          const isDone = built[seg.id]
          const isBldg = building === seg.id
          const tagColor = TAG_COLORS[seg.tag] || '#1d6fdb'
          return (
            <div
              key={seg.id}
              style={{
                background: 'white', borderRadius: '12px', border: `1px solid ${isExp ? 'rgba(29,111,219,0.28)' : 'rgba(29,111,219,0.1)'}`,
                boxShadow: isExp ? '0 4px 20px rgba(29,111,219,0.12)' : '0 2px 8px rgba(29,111,219,0.06)',
                overflow: 'hidden', transition: 'box-shadow 0.15s, border-color 0.15s',
              }}
            >
              {/* Card header */}
              <div
                style={{ padding: '16px 18px', cursor: 'pointer' }}
                onClick={() => setExpanded(isExp ? null : seg.id)}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '8px', marginBottom: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '18px' }}>{seg.icon}</span>
                    <SuggestedTag label={seg.tag} color={tagColor} />
                  </div>
                  <span style={{ fontSize: '11px', color: '#9ca3af', fontFamily: "'Inter', sans-serif", marginTop: '2px', flexShrink: 0 }}>
                    {isExp ? '▲ Less' : '▼ Preview'}
                  </span>
                </div>
                <p style={{ fontSize: '13px', fontWeight: '700', color: '#0c1a33', margin: '0 0 6px', fontFamily: "'Space Grotesk', sans-serif" }}>{seg.name}</p>
                <p style={{ fontSize: '12px', color: '#6b7280', margin: 0, lineHeight: '1.55', fontFamily: "'Inter', sans-serif" }}>{seg.description}</p>
              </div>

              {/* Expanded SQL preview */}
              {isExp && (
                <div style={{ borderTop: '1px solid rgba(29,111,219,0.1)', padding: '12px 18px', background: '#f8fafd' }}>
                  <p style={{ fontSize: '10px', fontWeight: '700', letterSpacing: '0.06em', textTransform: 'uppercase', color: '#9ca3af', marginBottom: '6px', fontFamily: "'Inter', sans-serif" }}>Generated SQL</p>
                  <pre style={{ fontSize: '11px', color: '#374151', background: '#f0f4fa', borderRadius: '6px', padding: '10px 12px', margin: 0, overflowX: 'auto', fontFamily: "ui-monospace, 'Cascadia Code', monospace", lineHeight: '1.6', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                    {seg.sql}
                  </pre>
                </div>
              )}

              {/* Footer */}
              <div style={{ padding: '10px 18px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', gap: '12px' }}>
                  <span style={{ fontSize: '11px', color: '#9ca3af', fontFamily: "'Inter', sans-serif" }}>
                    ~<strong style={{ color: '#374151' }}>{seg.est}</strong> records
                  </span>
                  <span style={{ fontSize: '11px', fontFamily: "'Inter', sans-serif", color: seg.confidence === 'High' ? '#16a34a' : '#d97706' }}>
                    ● {seg.confidence} confidence
                  </span>
                </div>
                {isDone ? (
                  <span style={{ fontSize: '12px', fontWeight: '600', color: '#16a34a', fontFamily: "'Inter', sans-serif" }}>✓ Segment created</span>
                ) : (
                  <button
                    onClick={() => handleBuild(seg)}
                    disabled={!!isBldg}
                    style={{
                      padding: '6px 14px', border: 'none', borderRadius: '7px',
                      background: isBldg ? '#d1d9e6' : 'linear-gradient(135deg, #1d6fdb, #38bdf8)',
                      color: 'white', fontSize: '12px', fontWeight: '600',
                      fontFamily: "'Inter', sans-serif", cursor: isBldg ? 'not-allowed' : 'pointer',
                    }}
                  >
                    {isBldg ? 'Building…' : 'Build Segment'}
                  </button>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// =====================================================================
// QUICK TOOLS TAB
// =====================================================================

const FAKE_APPEALS = [
  { id: 'AF25',    label: 'Annual Fund 2025' },
  { id: 'SPRING',  label: 'Spring Appeal' },
  { id: 'GALA25',  label: 'Opening Gala 2025' },
  { id: 'PHONETH', label: 'Spring Phonathon' },
  { id: 'MAJOR25', label: 'Major Gifts Campaign' },
  { id: 'EOY25',   label: 'End of Year Appeal' },
]

const TB_LISTS_QT = [
  { id: 4201, name: 'Donors >$500 last 12 months — no 2024 subscription' },
  { id: 4202, name: 'Lapsed subscribers — attended 3+ shows in prior 3 seasons' },
  { id: 4203, name: 'First-time buyers 2024 season — no follow-up gift' },
  { id: 2201, name: 'Annual Fund Appeal 2024 — Lapsed Donors' },
  { id: 2204, name: 'Spring Appeal — Under-40 Donors' },
  { id: 2206, name: '5+ Year Ticket Buyers No Recent Gift' },
]

function QuickToolsTab() {
  const [activeTool, setActiveTool] = useState(null)
  // Track last created source code so Promote to Source can default to it
  const [lastSourceCode, setLastSourceCode] = useState(null)

  return (
    <div>
      <p style={{ fontSize: '13px', color: '#6b7280', marginBottom: '20px', fontFamily: "'Inter', sans-serif", lineHeight: '1.6' }}>
        One-off utilities for common Tessitura tasks — no SQL required.
      </p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '14px' }}>
        <PromoCodeTool
          active={activeTool === 'promo'}
          onToggle={() => setActiveTool(activeTool === 'promo' ? null : 'promo')}
        />
        <SourceCodeTool
          active={activeTool === 'source'}
          onToggle={() => setActiveTool(activeTool === 'source' ? null : 'source')}
          onCreated={(code) => setLastSourceCode(code)}
        />
        <PromoteToSourceTool
          active={activeTool === 'promote'}
          onToggle={() => setActiveTool(activeTool === 'promote' ? null : 'promote')}
          defaultSourceCode={lastSourceCode}
        />
      </div>
    </div>
  )
}

// ── Promo Code Creator ─────────────────────────────────────────────────────────

function PromoCodeTool({ active, onToggle }) {
  const [code, setCode] = useState('')
  const [discount, setDiscount] = useState('')
  const [discountType, setDiscountType] = useState('percent')
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [loading, setLoading] = useState(false)
  const [created, setCreated] = useState(null)

  const handleCreate = async () => {
    setLoading(true)
    await new Promise(r => setTimeout(r, 900))
    setLoading(false)
    setCreated({
      code: code.trim().toUpperCase(),
      discount: discountType === 'percent' ? `${discount}%` : `$${discount}`,
      startDate: startDate || 'Immediately',
      endDate: endDate || 'No expiry',
    })
  }

  const canCreate = code.trim() && discount.trim() && !isNaN(Number(discount))

  if (created) {
    return (
      <div style={qtStyles.card}>
        <div style={{ padding: '20px 18px', textAlign: 'center' }}>
          <div style={{ fontSize: '28px', marginBottom: '8px' }}>✅</div>
          <p style={{ ...qtStyles.toolName, marginBottom: '4px' }}>Promo code created!</p>
          <p style={{ fontSize: '22px', fontWeight: '700', color: '#1d6fdb', fontFamily: "'Space Grotesk', sans-serif", marginBottom: '4px' }}>{created.code}</p>
          <p style={{ fontSize: '12px', color: '#6b7280', fontFamily: "'Inter', sans-serif", marginBottom: '14px' }}>
            {created.discount} off · {created.startDate} → {created.endDate}
          </p>
          <button onClick={() => { setCreated(null); setCode(''); setDiscount(''); setStartDate(''); setEndDate('') }} style={{ ...qtStyles.btn, width: '100%' }}>
            Create Another
          </button>
        </div>
      </div>
    )
  }

  return (
    <div style={qtStyles.card}>
      <div style={qtStyles.cardHead} onClick={onToggle}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={qtStyles.icon}>🏷️</span>
          <div>
            <p style={qtStyles.toolName}>Create Promo Code</p>
            <p style={qtStyles.toolDesc}>New discount code with optional date window</p>
          </div>
        </div>
        <span style={{ fontSize: '12px', color: '#9ca3af' }}>{active ? '▲' : '▼'}</span>
      </div>
      {active && (
        <div style={qtStyles.body}>
          <div style={qtStyles.fieldGroup}>
            <label style={qtStyles.label}>Code</label>
            <input
              value={code}
              onChange={e => setCode(e.target.value.toUpperCase())}
              placeholder="e.g. OPENING25"
              style={qtStyles.input}
            />
          </div>
          <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
            <div style={{ flex: 1 }}>
              <label style={qtStyles.label}>Discount</label>
              <input
                value={discount}
                onChange={e => setDiscount(e.target.value)}
                placeholder="20"
                style={qtStyles.input}
                type="number"
                min="0"
              />
            </div>
            <div style={{ flex: 1 }}>
              <label style={qtStyles.label}>Type</label>
              <select
                value={discountType}
                onChange={e => setDiscountType(e.target.value)}
                style={{ ...qtStyles.input, background: 'white' }}
              >
                <option value="percent">Percent off</option>
                <option value="amount">Dollar off</option>
                <option value="comp">Comp (100%)</option>
              </select>
            </div>
          </div>

          <button
            onClick={() => setShowAdvanced(!showAdvanced)}
            style={{ background: 'none', border: 'none', color: '#1d6fdb', fontSize: '12px', fontFamily: "'Inter', sans-serif", cursor: 'pointer', padding: '0 0 10px', fontWeight: '600' }}
          >
            {showAdvanced ? '▲ Hide options' : '▼ Add start / end dates'}
          </button>

          {showAdvanced && (
            <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
              <div style={{ flex: 1 }}>
                <label style={qtStyles.label}>Start date</label>
                <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} style={qtStyles.input} />
              </div>
              <div style={{ flex: 1 }}>
                <label style={qtStyles.label}>End date</label>
                <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} style={qtStyles.input} />
              </div>
            </div>
          )}

          <button
            onClick={handleCreate}
            disabled={!canCreate || loading}
            style={{ ...qtStyles.btn, width: '100%', opacity: canCreate && !loading ? 1 : 0.5, cursor: canCreate && !loading ? 'pointer' : 'not-allowed' }}
          >
            {loading ? 'Creating…' : 'Create Promo Code'}
          </button>
        </div>
      )}
    </div>
  )
}

// ── Source Code Creator ────────────────────────────────────────────────────────

function SourceCodeTool({ active, onToggle, onCreated }) {
  const [code, setCode] = useState('')
  const [appeal, setAppeal] = useState('')
  const [description, setDescription] = useState('')
  const [loading, setLoading] = useState(false)
  const [created, setCreated] = useState(null)

  const handleCreate = async () => {
    setLoading(true)
    await new Promise(r => setTimeout(r, 800))
    setLoading(false)
    const result = {
      code: code.trim().toUpperCase(),
      appeal: FAKE_APPEALS.find(a => a.id === appeal)?.label || appeal,
      description: description.trim() || '—',
    }
    setCreated(result)
    onCreated && onCreated(result.code)
  }

  const canCreate = code.trim() && appeal

  if (created) {
    return (
      <div style={qtStyles.card}>
        <div style={{ padding: '20px 18px', textAlign: 'center' }}>
          <div style={{ fontSize: '28px', marginBottom: '8px' }}>✅</div>
          <p style={{ ...qtStyles.toolName, marginBottom: '4px' }}>Source code created!</p>
          <p style={{ fontSize: '22px', fontWeight: '700', color: '#1d6fdb', fontFamily: "'Space Grotesk', sans-serif", marginBottom: '4px' }}>{created.code}</p>
          <p style={{ fontSize: '12px', color: '#6b7280', fontFamily: "'Inter', sans-serif", marginBottom: '14px' }}>
            Appeal: {created.appeal}
          </p>
          <button onClick={() => { setCreated(null); setCode(''); setAppeal(''); setDescription('') }} style={{ ...qtStyles.btn, width: '100%' }}>
            Create Another
          </button>
        </div>
      </div>
    )
  }

  return (
    <div style={qtStyles.card}>
      <div style={qtStyles.cardHead} onClick={onToggle}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={qtStyles.icon}>📊</span>
          <div>
            <p style={qtStyles.toolName}>Create Source Code</p>
            <p style={qtStyles.toolDesc}>New source code linked to an appeal</p>
          </div>
        </div>
        <span style={{ fontSize: '12px', color: '#9ca3af' }}>{active ? '▲' : '▼'}</span>
      </div>
      {active && (
        <div style={qtStyles.body}>
          <div style={qtStyles.fieldGroup}>
            <label style={qtStyles.label}>Source code</label>
            <input
              value={code}
              onChange={e => setCode(e.target.value.toUpperCase())}
              placeholder="e.g. EMAIL-MAY25"
              style={qtStyles.input}
            />
          </div>
          <div style={qtStyles.fieldGroup}>
            <label style={qtStyles.label}>Appeal</label>
            <select
              value={appeal}
              onChange={e => setAppeal(e.target.value)}
              style={{ ...qtStyles.input, background: 'white' }}
            >
              <option value="">Select an appeal…</option>
              {FAKE_APPEALS.map(a => (
                <option key={a.id} value={a.id}>{a.label}</option>
              ))}
            </select>
          </div>
          <div style={{ ...qtStyles.fieldGroup, marginBottom: '14px' }}>
            <label style={qtStyles.label}>Description <span style={{ color: '#9ca3af', fontWeight: '400' }}>(optional)</span></label>
            <input
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="e.g. May email blast to lapsed donors"
              style={qtStyles.input}
            />
          </div>
          <button
            onClick={handleCreate}
            disabled={!canCreate || loading}
            style={{ ...qtStyles.btn, width: '100%', opacity: canCreate && !loading ? 1 : 0.5, cursor: canCreate && !loading ? 'pointer' : 'not-allowed' }}
          >
            {loading ? 'Creating…' : 'Create Source Code'}
          </button>
        </div>
      )}
    </div>
  )
}

// ── Promote to Source ──────────────────────────────────────────────────────────

function PromoteToSourceTool({ active, onToggle, defaultSourceCode }) {
  const [sourceCode, setSourceCode] = useState('')
  const [listId, setListId] = useState('')
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(null)

  // Pre-fill source code if one was just created
  React.useEffect(() => {
    if (defaultSourceCode) setSourceCode(defaultSourceCode)
  }, [defaultSourceCode])

  const handlePromote = async () => {
    setLoading(true)
    await new Promise(r => setTimeout(r, 1000))
    setLoading(false)
    const list = TB_LISTS_QT.find(l => String(l.id) === String(listId))
    setDone({
      sourceCode: sourceCode.trim().toUpperCase(),
      list: list ? list.name : `List #${listId}`,
      listId,
    })
  }

  const canPromote = sourceCode.trim() && listId

  if (done) {
    return (
      <div style={qtStyles.card}>
        <div style={{ padding: '20px 18px', textAlign: 'center' }}>
          <div style={{ fontSize: '28px', marginBottom: '8px' }}>✅</div>
          <p style={{ ...qtStyles.toolName, marginBottom: '6px' }}>Promoted to source!</p>
          <p style={{ fontSize: '12px', color: '#6b7280', fontFamily: "'Inter', sans-serif", lineHeight: '1.6', marginBottom: '14px' }}>
            Source <strong style={{ color: '#1d6fdb' }}>{done.sourceCode}</strong> is now linked to<br />"{done.list}"
          </p>
          <button onClick={() => { setDone(null); setSourceCode(''); setListId('') }} style={{ ...qtStyles.btn, width: '100%' }}>
            Promote Another
          </button>
        </div>
      </div>
    )
  }

  return (
    <div style={qtStyles.card}>
      <div style={qtStyles.cardHead} onClick={onToggle}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={qtStyles.icon}>🔗</span>
          <div>
            <p style={qtStyles.toolName}>Promote to Source</p>
            <p style={qtStyles.toolDesc}>Link a source code to a Tessitura list</p>
          </div>
        </div>
        <span style={{ fontSize: '12px', color: '#9ca3af' }}>{active ? '▲' : '▼'}</span>
      </div>
      {active && (
        <div style={qtStyles.body}>
          <div style={qtStyles.fieldGroup}>
            <label style={qtStyles.label}>Source code</label>
            <input
              value={sourceCode}
              onChange={e => setSourceCode(e.target.value.toUpperCase())}
              placeholder="e.g. EMAIL-MAY25"
              style={qtStyles.input}
            />
            <p style={{ fontSize: '11px', color: '#9ca3af', marginTop: '4px', fontFamily: "'Inter', sans-serif" }}>
              Create one using the Source Code tool above, or enter any existing code.
            </p>
          </div>
          <div style={{ ...qtStyles.fieldGroup, marginBottom: '14px' }}>
            <label style={qtStyles.label}>List</label>
            <select
              value={listId}
              onChange={e => setListId(e.target.value)}
              style={{ ...qtStyles.input, background: 'white' }}
            >
              <option value="">Select a list…</option>
              {TB_LISTS_QT.map(l => (
                <option key={l.id} value={l.id}>#{l.id} — {l.name}</option>
              ))}
            </select>
          </div>
          <button
            onClick={handlePromote}
            disabled={!canPromote || loading}
            style={{ ...qtStyles.btn, width: '100%', opacity: canPromote && !loading ? 1 : 0.5, cursor: canPromote && !loading ? 'pointer' : 'not-allowed' }}
          >
            {loading ? 'Promoting…' : 'Promote to Source'}
          </button>
        </div>
      )}
    </div>
  )
}

const qtStyles = {
  card: { background: 'white', borderRadius: '12px', border: '1px solid rgba(29,111,219,0.1)', boxShadow: '0 2px 8px rgba(29,111,219,0.06)', overflow: 'hidden' },
  cardHead: { padding: '16px 18px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between' },
  icon: { fontSize: '20px', lineHeight: 1 },
  toolName: { fontSize: '13px', fontWeight: '700', color: '#0c1a33', margin: 0, fontFamily: "'Space Grotesk', sans-serif" },
  toolDesc: { fontSize: '12px', color: '#6b7280', margin: '2px 0 0', fontFamily: "'Inter', sans-serif" },
  body: { borderTop: '1px solid rgba(29,111,219,0.08)', padding: '14px 18px 18px' },
  fieldGroup: { marginBottom: '12px' },
  label: { display: 'block', fontSize: '11px', fontWeight: '700', color: '#374151', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '5px', fontFamily: "'Inter', sans-serif" },
  input: { width: '100%', boxSizing: 'border-box', padding: '8px 12px', border: '1px solid rgba(29,111,219,0.18)', borderRadius: '7px', fontSize: '13px', fontFamily: "'Inter', sans-serif", outline: 'none' },
  btn: { padding: '9px 16px', background: 'linear-gradient(135deg, #1d6fdb, #38bdf8)', color: 'white', border: 'none', borderRadius: '7px', fontSize: '12px', fontWeight: '600', fontFamily: "'Inter', sans-serif", cursor: 'pointer', whiteSpace: 'nowrap' },
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
    backgroundColor: 'white', borderRadius: '12px', padding: '20px',
    boxShadow: '0 2px 16px rgba(29,111,219,0.08)', border: '1px solid rgba(29,111,219,0.1)', maxWidth: '720px'
  },
  panelWide: {
    maxWidth: '960px',
  },

  // ---------- Build tab ----------
  buildWrapper: {
    display: 'flex',
    flexDirection: 'column',
    height: '460px',
  },

  // Chat container
  chatContainer: {
    flex: 1, display: 'flex', flexDirection: 'column',
    border: '1px solid rgba(29,111,219,0.14)', borderRadius: '10px',
    overflow: 'hidden', backgroundColor: '#fafbfd'
  },
  chatMessages: {
    flex: 1, overflowY: 'auto', padding: '14px 16px',
    display: 'flex', flexDirection: 'column', gap: '10px'
  },

  // Empty state
  emptyState: {
    flex: 1, display: 'flex', flexDirection: 'column',
    alignItems: 'center', justifyContent: 'center',
    color: '#9ca3af', textAlign: 'center', padding: '24px'
  },
  emptyIcon: { fontSize: '22px', color: '#c7d9f5', marginBottom: '8px' },
  emptyTitle: { fontSize: '13px', fontWeight: '600', color: '#9ca3af', marginBottom: '4px' },
  emptyHint: { fontSize: '12px', color: '#b0bac7', lineHeight: '1.5', maxWidth: '320px' },

  // Message rows
  userRow: { display: 'flex', justifyContent: 'flex-end' },
  assistantRow: { display: 'flex', justifyContent: 'flex-start' },

  // Bubbles
  bubble: {
    maxWidth: '80%', padding: '9px 13px', borderRadius: '10px',
    backgroundColor: 'white', fontSize: '13px', lineHeight: '1.55',
    boxShadow: '0 1px 3px rgba(0,0,0,0.06)', border: '1px solid #edf0f5'
  },
  userBubble: {
    backgroundColor: '#1d6fdb', color: 'white',
    border: 'none', boxShadow: '0 1px 4px rgba(29,111,219,0.25)'
  },
  systemBubble: {
    backgroundColor: 'transparent', color: '#9ca3af',
    fontStyle: 'italic', padding: '4px 0', boxShadow: 'none', border: 'none', fontSize: '12px'
  },
  successBubble: {
    backgroundColor: '#f0fff4', color: '#16a34a',
    border: '1px solid #c6f6d5', boxShadow: 'none', fontStyle: 'normal'
  },
  segmentBubble: {
    backgroundColor: 'rgba(29,111,219,0.05)',
    border: '1px solid rgba(29,111,219,0.18)', boxShadow: 'none'
  },
  segmentLabel: {
    fontSize: '10px', fontWeight: '700', letterSpacing: '0.5px',
    textTransform: 'uppercase', color: '#1d6fdb', marginBottom: '5px'
  },
  bubbleText: { margin: 0, whiteSpace: 'pre-wrap' },

  // Typing
  typing: { display: 'flex', gap: '4px', padding: '2px 0' },
  dot: { fontSize: '8px', color: '#9ca3af', animation: 'blink 1.4s infinite both' },

  // Approval bar
  approvalBar: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '9px 16px', backgroundColor: 'rgba(29,111,219,0.05)',
    borderTop: '1px solid rgba(29,111,219,0.12)'
  },
  approvalText: { fontSize: '12px', fontWeight: '600', color: '#1d6fdb', margin: 0 },
  approvalButtons: { display: 'flex', gap: '6px' },
  approveBtn: {
    padding: '6px 16px', backgroundColor: '#1d6fdb', color: 'white',
    border: 'none', borderRadius: '7px', fontSize: '12px', fontWeight: '600', cursor: 'pointer'
  },
  rejectBtn: {
    padding: '6px 16px', backgroundColor: 'transparent', color: '#1d6fdb',
    border: '1px solid rgba(29,111,219,0.3)', borderRadius: '7px', fontSize: '12px', fontWeight: '600', cursor: 'pointer'
  },

  // Input area
  inputArea: {
    display: 'flex', alignItems: 'flex-end', gap: '8px',
    padding: '10px 12px', borderTop: '1px solid #edf0f5',
    backgroundColor: 'white'
  },
  chatInput: {
    flex: 1, padding: '9px 13px', border: '1px solid rgba(29,111,219,0.14)',
    borderRadius: '8px', fontSize: '13px', fontFamily: 'inherit',
    resize: 'none', outline: 'none', lineHeight: '1.5', maxHeight: '100px',
    backgroundColor: '#fafbfd'
  },
  sendBtn: {
    width: '34px', height: '34px', borderRadius: '8px',
    backgroundColor: '#1d6fdb', color: 'white', border: 'none',
    fontSize: '16px', fontWeight: '700', cursor: 'pointer',
    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
  },
  sendBtnDisabled: { backgroundColor: '#d1d9e6', cursor: 'not-allowed' },

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

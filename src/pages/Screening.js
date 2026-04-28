import React, { useState, useEffect, useRef } from 'react'

// Constituent Contact Points > Screening
// Framework only. Wire to stored procs + verification API in a later pass.
//
// Planned stored procedures (each accepts EITHER @list_no OR @customer_no):
//   sp_screen_email   @list_no INT = NULL, @customer_no INT = NULL
//   sp_screen_phone   @list_no INT = NULL, @customer_no INT = NULL
//   sp_screen_address @list_no INT = NULL, @customer_no INT = NULL
//
// Shared logic (all three streams):
//   1. Pull primary, non-inactive contact points for active customers
//      (list-driven: WHERE customer_no IN (SELECT customer_no FROM T_LIST_CONTENTS WHERE list_no = @list_no))
//   2. Exclude records with a recent "Verified" CPP (freshness window TBD)
//   3. Send batch to the verification API (Email / Phone / Address)
//   4. Write-back rules:
//        - Clean       -> stamp "Verified" CPP on existing record
//        - Corrected   -> new record (same type_id, primary), disable old, stamp "Verified"
//        - Hard fail   -> stamp "Hard Bounce" CPP on original, inactivate it
//   5. Return updated-records list to the UI for review

const CONTACT_TYPES = [
  { value: 'email',   label: 'Email' },
  { value: 'phone',   label: 'Phone' },
  { value: 'address', label: 'Address' }
]

// kognative_CONTACT_SCREEN local proc id — see Tess Buddy magic number registry
const CONTACT_SCREEN_PROC = { id: 105, name: 'kognative_CONTACT_SCREEN' }

// ---------- Verification result classification ----------
// Client-side mapping, easy to tune here.
//
// HARD_FAIL_CODES should ONLY contain result codes that unambiguously mean
// "this mailbox/domain cannot receive mail." Informational codes (role address,
// catch-all, disposable, etc.) belong in INFO_CODES and must NOT automatically
// force a HARD_BOUNCE when ES01 is present with a high confidence score.
const HARD_FAIL_CODES  = ['ES03', 'ES04', 'ES05']   // bad mailbox / bad domain / bad syntax
const CLEAN_CODE       = 'ES01'                     // email deliverable
// Score thresholds (Melissa DeliverabilityConfidenceScore, 0-100):
//   < HARD_BOUNCE_MAX (50) -> HARD_BOUNCE — catches typo/mailbox-unreachable cases
//      where domain resolves (ES01) but mailbox probe tanks the score.
//   >= CLEAN_MIN (80) + ES01 + no hard-fail code -> CLEAN.
//   Anything in the 50-79 band -> INCONCLUSIVE (not confident enough either way).
const HARD_BOUNCE_MAX  = 50
const CLEAN_MIN        = 80

function classifyMelissaEmail(record, inputEmail) {
  const resultsStr   = String(record?.Results || '').toUpperCase()
  const codes        = resultsStr.split(',').map(c => c.trim()).filter(Boolean)
  const rawScore     = record?.DeliverabilityConfidenceScore
  const score        = rawScore === undefined || rawScore === null || rawScore === ''
    ? null
    : parseInt(rawScore, 10)
  const returned     = String(record?.EmailAddress || '').trim()
  const input        = String(inputEmail || '').trim().toLowerCase()

  const hasHardFail = codes.some(c => HARD_FAIL_CODES.includes(c))
  const hasClean    = codes.includes(CLEAN_CODE)
  const hasScore    = score !== null && !isNaN(score)

  // 1. CLEAN wins first — if the verifier says deliverable AND is confident AND
  //    there is no unambiguous hard-fail code, trust it. Informational codes
  //    (role / catch-all / disposable) ride along but do not force a bounce.
  if (hasClean && hasScore && score >= CLEAN_MIN && !hasHardFail) {
    return { action: 'CLEAN', newEmail: null, score, codes }
  }

  // 2. CORRECTED — verifier returned a usable address that differs from input,
  //    and we are not in the clearly-clean path above.
  if (returned && returned.toLowerCase() !== input) {
    return { action: 'CORRECTED', newEmail: returned, score, codes }
  }

  // 3. HARD_BOUNCE — explicit hard-fail code, or deliverability score too low.
  if (hasHardFail || (hasScore && score < HARD_BOUNCE_MAX)) {
    return { action: 'HARD_BOUNCE', newEmail: null, score, codes }
  }

  // 4. INCONCLUSIVE — middling signal. UI shows result but EMAIL_WRITE is not called.
  return { action: 'INCONCLUSIVE', newEmail: null, score, codes }
}

// ---------- Phone classification ----------
// Melissa Global Phone result codes we care about:
//   PS01 = Valid phone number                (clean signal)
//   PS02 = Valid area code                   (informational)
//   PE01 = Bad format / unable to parse      (hard fail)
//   PE02 = Invalid phone number              (hard fail)
//   PE03 = Country not supported             (inconclusive, not a bounce)
// If Melissa returns a PhoneNumber that differs from the input (after
// digits-only normalization), we treat it as CORRECTED.
const PHONE_HARD_FAIL_CODES = ['PE01', 'PE02']
const PHONE_CLEAN_CODE      = 'PS01'

function digitsOnly(s) {
  return String(s || '').replace(/\D+/g, '')
}

function classifyMelissaPhone(record, inputPhone) {
  const resultsStr  = String(record?.Results || '').toUpperCase()
  const codes       = resultsStr.split(',').map(c => c.trim()).filter(Boolean)
  const returned    = String(record?.PhoneNumber || record?.InternationalPhoneNumber || '').trim()
  const inputDigits = digitsOnly(inputPhone)
  const returnedDigits = digitsOnly(returned)

  const hasHardFail = codes.some(c => PHONE_HARD_FAIL_CODES.includes(c))
  const hasClean    = codes.includes(PHONE_CLEAN_CODE)

  if (hasHardFail) {
    return { action: 'HARD_BOUNCE', newPhone: null, codes }
  }
  if (hasClean && returnedDigits && returnedDigits !== inputDigits) {
    return { action: 'CORRECTED', newPhone: returned, codes }
  }
  if (hasClean) {
    return { action: 'CLEAN', newPhone: null, codes }
  }
  return { action: 'INCONCLUSIVE', newPhone: null, codes }
}

// ---------- Address classification ----------
// Melissa Global Address result codes we care about (high-level):
//   AV24, AV25          = highest delivery confidence   (clean)
//   AV21, AV22, AV23    = partial confidence            (inconclusive)
//   AC01..AC14          = address changed/corrected     (corrected if fields differ)
//   AE01..AE17          = error / undeliverable         (hard fail)
// An address is CORRECTED if Melissa returned a non-empty result AND any of
// the key fields differ from input (street1 / city / state / postal).
const ADDRESS_HARD_FAIL_PREFIXES = ['AE']
const ADDRESS_CLEAN_CODES = ['AV24', 'AV25']

function classifyMelissaAddress(record, inputAddress) {
  const resultsStr  = String(record?.Results || '').toUpperCase()
  const codes       = resultsStr.split(',').map(c => c.trim()).filter(Boolean)

  const hasHardFail = codes.some(c => ADDRESS_HARD_FAIL_PREFIXES.some(p => c.startsWith(p)))
  const hasClean    = codes.some(c => ADDRESS_CLEAN_CODES.includes(c))

  // Extract Melissa-normalized fields. Different endpoints use different
  // field names, so we look at a few common ones and fall back gracefully.
  const newAddress = {
    street1: String(record?.AddressLine1  || '').trim(),
    street2: String(record?.AddressLine2  || '').trim(),
    city:    String(record?.Locality      || record?.Thoroughfare || '').trim(),
    state:   String(record?.AdministrativeArea || '').trim(),
    postal:  String(record?.PostalCode    || '').trim(),
    country: String(record?.CountryISO3166_1_Alpha2 || record?.CountryName || '').trim()
  }

  if (hasHardFail) {
    return { action: 'HARD_BOUNCE', newAddress: null, codes }
  }

  // Strip postal hyphens before comparing (Tessitura stores 294123598,
  // Melissa returns 29412-3598 — same zip, cosmetic difference).
  const normPostal = (s) => String(s || '').replace(/[-\s]/g, '').toUpperCase()
  const norm = (s) => String(s || '').trim().toUpperCase()

  const differs =
    (newAddress.street1 && norm(newAddress.street1) !== norm(inputAddress?.street1)) ||
    (newAddress.city    && norm(newAddress.city)    !== norm(inputAddress?.city))    ||
    (newAddress.state   && norm(newAddress.state)   !== norm(inputAddress?.state))   ||
    (newAddress.postal  && normPostal(newAddress.postal)  !== normPostal(inputAddress?.postal))

  if (hasClean && differs) {
    return { action: 'CORRECTED', newAddress, codes }
  }
  if (hasClean) {
    return { action: 'CLEAN', newAddress: null, codes }
  }
  return { action: 'INCONCLUSIVE', newAddress: null, codes }
}

function Screening({ orgData }) {
  const [activeTab, setActiveTab] = useState('email')

  return (
    <div>
      <div style={styles.header}>
        <h1 style={styles.title}>Screening</h1>
        <p style={styles.subtitle}>
          Check your constituents' emails, phone numbers, and addresses — then send the corrections
          straight back to Tessitura.
        </p>
      </div>

      <div style={styles.tabBar}>
        <TabButton label="Email"           active={activeTab === 'email'}    onClick={() => setActiveTab('email')} />
        <TabButton label="Phone"           active={activeTab === 'phone'}    onClick={() => setActiveTab('phone')} />
        <TabButton label="Address"         active={activeTab === 'address'}  onClick={() => setActiveTab('address')} />
        <TabButton label="Single record" active={activeTab === 'singular'} onClick={() => setActiveTab('singular')} />
      </div>

      <div style={styles.panel}>
        {activeTab === 'email'    && <BulkTab streamLabel="Email"   orgData={orgData} />}
        {activeTab === 'phone'    && <BulkTab streamLabel="Phone"   orgData={orgData} />}
        {activeTab === 'address'  && <BulkTab streamLabel="Address" orgData={orgData} />}
        {activeTab === 'singular' && <SingularTab orgData={orgData} />}
      </div>
    </div>
  )
}

// ---------- Bulk tab (shared shell for Email / Phone / Address) ----------

// Normalize a raw list entry from the Tessitura API into a consistent shape.
// Defensive because field casing / category-nesting varies across installs.
function normalizeList(raw) {
  const id =
    raw?.Id ?? raw?.id ?? raw?.ListNumber ?? raw?.list_no ?? null
  const name =
    raw?.Description ?? raw?.description ?? raw?.Name ?? raw?.name ?? `List ${id}`
  const category =
    raw?.Category?.Description ??
    raw?.Category?.description ??
    raw?.CategoryDescription ??
    raw?.categoryDescription ??
    raw?.category ??
    'Uncategorized'
  const categoryId =
    raw?.Category?.Id ??
    raw?.Category?.id ??
    raw?.CategoryId ??
    raw?.categoryId ??
    null
  return { id, name, category, categoryId }
}

function BulkTab({ streamLabel, orgData }) {
  const [lists, setLists]                 = useState([])
  const [categories, setCategories]       = useState([])
  const [loadingLists, setLoadingLists]   = useState(true)
  const [listsError, setListsError]       = useState(null)
  const [selectedCategory, setCategory]   = useState('__ALL__')
  const [searchText, setSearchText]       = useState('')
  const [listNo, setListNo]               = useState('')

  // Bulk run state
  //   idle       -> user is picking a list
  //   previewing -> EMAIL_PULL returned, showing count + confirm
  //   running    -> looping through rows: Melissa verify + EMAIL_WRITE
  //   done       -> finished (or cancelled), showing summary
  const [runStage, setRunStage]       = useState('idle')
  const [previewRows, setPreviewRows] = useState([])
  const [runStats, setRunStats]       = useState(null)   // { total, processed, clean, corrected, hardBounce, inconclusive, errors }
  const [runLog, setRunLog]           = useState([])     // [{customer_no, sort_name, email, action, newEmail, writeOk, error}]
  const [currentRow, setCurrentRow]   = useState(null)   // {sort_name, email} currently being processed
  const [runMessage, setRunMessage]   = useState(null)   // { type, text }
  const [busyBulk, setBusyBulk]       = useState(false)
  const cancelRef                     = useRef(false)

  const lower = streamLabel.toLowerCase()

  // Compute the Tessitura Web API base (/Tessitura/api/) from the classic
  // TessituraService base stored on the org. These are two different services
  // on the same host, and list data lives on the Web API.
  const webApiBase = (orgData?.organizations?.tessitura_base_url || '')
    .replace(/\/TessituraService\/?$/i, '/Tessitura/api/')

  // Fetch categories once on mount.
  useEffect(() => {
    let cancelled = false
    async function fetchCategories() {
      try {
        const authHeaders = {
          'x-tessitura-auth': orgData?.organizations?.tessitura_auth_string,
          'x-tessitura-url':  webApiBase,
          'Content-Type':     'application/json'
        }
        const catEndpoint = encodeURIComponent('ReferenceData/ListCategories/Summary?activeOnly=true')
        const catResp = await fetch(`/api/tessitura?endpoint=${catEndpoint}`, {
          method: 'GET', headers: authHeaders
        })
        if (!catResp.ok) throw new Error(`Categories: ${catResp.status}`)
        const catData = await catResp.json()
        const catRaw  = Array.isArray(catData) ? catData : (catData?.Categories || catData?.categories || [])
        const normalizedCats = catRaw
          .map(c => ({
            id:   c?.Id          ?? c?.id          ?? c?.CategoryId ?? null,
            name: c?.Description ?? c?.description ?? c?.Name       ?? c?.name ?? 'Uncategorized'
          }))
          .filter(c => c.id !== null)
          .sort((a, b) => a.name.localeCompare(b.name))
        if (!cancelled) setCategories(normalizedCats)
      } catch (err) {
        if (!cancelled) setListsError(err.message)
      }
    }
    fetchCategories()
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orgData])

  // Fetch lists whenever searchText or selectedCategory changes.
  // Default view (no search, no category): 500 most-recently-generated active lists.
  // With search: server-side SearchText filter against list descriptions.
  // With category: server-side CategoryId filter.
  // Debounced 300ms so keystrokes don't hammer Tessitura.
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
        const listEndpoint = encodeURIComponent('Reporting/Lists/Search')
        const body = {
          MyListsOnly:     false,
          ActiveOnly:      true,
          Page:            1,
          PageSize:        500,
          SortByField:     'LastGeneratedDate',
          SortByDirection: 'Desc'
        }
        if (selectedCategory !== '__ALL__') {
          body.CategoryId = Number(selectedCategory)
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
        const listRaw  = Array.isArray(listData) ? listData : (listData?.Lists || listData?.lists || listData?.Results || [])
        const normalizedLists = listRaw.map(normalizeList).filter(l => l.id !== null)
        if (!cancelled) setLists(normalizedLists)
      } catch (err) {
        if (!cancelled) setListsError(err.message)
      }
      if (!cancelled) setLoadingLists(false)
    }, 300)
    return () => { cancelled = true; clearTimeout(timer) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orgData, searchText, selectedCategory])

  // Lists are now server-filtered — render them directly.
  const visibleLists = lists

  // ------------------------------------------------------------------
  // Bulk screening orchestration — polymorphic across email, phone,
  // and address streams. Each BULK_STREAM entry mirrors the shape
  // used by STREAM_CONFIG in SingularTab.
  // ------------------------------------------------------------------
  const BULK_STREAM = {
    Email: {
      pullMode:  'EMAIL_PULL',
      writeMode: 'EMAIL_WRITE',
      melissaPath: '/api/melissa',
      classify:  (record, row) => classifyMelissaEmail(record, row.email),
      buildBody: (row) => ({ email: row.email }),
      pulledField: 'email',
      displayOriginal: (row) => row.email,
      buildWriteParams: (verdict, melText, row) => {
        const params = [
          { Name: '@mode',         Value: 'EMAIL_WRITE' },
          { Name: '@customer_no',  Value: String(row.customer_no) },
          { Name: '@result',       Value: verdict.action },
          { Name: '@melissa_code', Value: melText || '' }
        ]
        if (verdict.action === 'CORRECTED' && verdict.newEmail) {
          params.push({ Name: '@new_email', Value: verdict.newEmail })
        }
        return params
      },
      correctedValue: (verdict) => verdict.newEmail || null,
    },
    Phone: {
      pullMode:  'PHONE_PULL',
      writeMode: 'PHONE_WRITE',
      melissaPath: '/api/melissa-phone',
      classify:  (record, row) => classifyMelissaPhone(record, row.phone),
      buildBody: (row) => ({ phone: row.phone, country: 'US' }),
      pulledField: 'phone',
      displayOriginal: (row) => row.phone,
      buildWriteParams: (verdict, melText, row) => {
        const params = [
          { Name: '@mode',         Value: 'PHONE_WRITE' },
          { Name: '@customer_no',  Value: String(row.customer_no) },
          { Name: '@result',       Value: verdict.action },
          { Name: '@melissa_code', Value: melText || '' }
        ]
        if (verdict.action === 'CORRECTED' && verdict.newPhone) {
          params.push({ Name: '@new_phone', Value: verdict.newPhone })
        }
        return params
      },
      correctedValue: (verdict) => verdict.newPhone || null,
    },
    Address: {
      pullMode:  'ADDRESS_PULL',
      writeMode: 'ADDRESS_WRITE',
      melissaPath: '/api/melissa-address',
      classify:  (record, row) => classifyMelissaAddress(record, {
        street1: row.street1, street2: row.street2,
        city: row.city, state: row.state, postal: row.postal_code
      }),
      buildBody: (row) => ({
        street1: row.street1, street2: row.street2,
        city: row.city, state: row.state,
        postal: row.postal_code, country: 'US'
      }),
      pulledField: 'street1',
      displayOriginal: (row) => [row.street1, row.city, row.state, row.postal_code].filter(Boolean).join(', '),
      buildWriteParams: (verdict, melText, row) => {
        const params = [
          { Name: '@mode',         Value: 'ADDRESS_WRITE' },
          { Name: '@customer_no',  Value: String(row.customer_no) },
          { Name: '@result',       Value: verdict.action },
          { Name: '@melissa_code', Value: melText || '' }
        ]
        if (verdict.action === 'CORRECTED' && verdict.newAddress) {
          params.push({ Name: '@new_street1', Value: verdict.newAddress.street1 || '' })
          params.push({ Name: '@new_street2', Value: verdict.newAddress.street2 || '' })
          params.push({ Name: '@new_city',    Value: verdict.newAddress.city    || '' })
          params.push({ Name: '@new_state',   Value: verdict.newAddress.state   || '' })
          params.push({ Name: '@new_postal',  Value: verdict.newAddress.postal  || '' })
          params.push({ Name: '@new_country', Value: verdict.newAddress.country || '' })
        }
        return params
      },
      correctedValue: (verdict) =>
        verdict.newAddress
          ? [verdict.newAddress.street1, verdict.newAddress.city, verdict.newAddress.state, verdict.newAddress.postal].filter(Boolean).join(', ')
          : null,
    }
  }
  const stream = BULK_STREAM[streamLabel]

  const procHeaders = {
    'x-tessitura-auth': orgData?.organizations?.tessitura_auth_string,
    'x-tessitura-url':  orgData?.organizations?.tessitura_base_url,
    'Content-Type':     'application/json'
  }

  const callProc = async (parameterValues) => {
    const response = await fetch('/api/tessitura?endpoint=Custom/Execute', {
      method:  'POST',
      headers: procHeaders,
      body:    JSON.stringify({
        ProcedureId:     CONTACT_SCREEN_PROC.id,
        ProcedureName:   CONTACT_SCREEN_PROC.name,
        ParameterValues: parameterValues
      })
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

  const resetBulkFlow = () => {
    cancelRef.current = false
    setRunStage('idle')
    setPreviewRows([])
    setRunStats(null)
    setRunLog([])
    setCurrentRow(null)
    setRunMessage(null)
    setBusyBulk(false)
  }

  // Step 1: pull the list via <stream>_PULL @list_no, show preview for confirmation.
  const handleStartBulk = async () => {
    if (!listNo) return
    cancelRef.current = false
    setBusyBulk(true)
    setRunMessage(null)
    try {
      const { ok, text } = await callProc([
        { Name: '@mode',    Value: stream.pullMode },
        { Name: '@list_no', Value: String(listNo) }
      ])
      if (!ok) {
        setRunMessage({ type: 'error', text: "Couldn't load that list from Tessitura: " + text.slice(0, 200) })
        setBusyBulk(false)
        return
      }
      const rows = parseRows(text)
      if (rows.length === 0) {
        setRunMessage({ type: 'warn', text: `Nothing to screen — every primary ${lower} on this list is either missing, already verified recently, or on an inactive customer.` })
        setBusyBulk(false)
        return
      }
      setPreviewRows(rows)
      setRunStage('previewing')
    } catch (err) {
      setRunMessage({ type: 'error', text: 'Error: ' + err.message })
    }
    setBusyBulk(false)
  }

  // Step 2: loop — for each row, verify via Melissa, classify, write-back if actionable.
  const handleConfirmRun = async () => {
    cancelRef.current = false
    setRunStage('running')
    setBusyBulk(true)
    setRunMessage(null)

    const stats = {
      total:        previewRows.length,
      processed:    0,
      clean:        0,
      corrected:    0,
      hardBounce:   0,
      inconclusive: 0,
      errors:       0
    }
    setRunStats({ ...stats })
    const log = []
    setRunLog([])

    for (const row of previewRows) {
      if (cancelRef.current) break
      setCurrentRow({ sort_name: row.sort_name, original: stream.displayOriginal(row) })

      const entry = {
        customer_no: row.customer_no,
        sort_name:   row.sort_name,
        original:    stream.displayOriginal(row),
        action:      null,
        corrected:   null,
        writeOk:     null,
        error:       null
      }

      try {
        // 2a. Melissa verify
        const melResp = await fetch(stream.melissaPath, {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify(stream.buildBody(row))
        })
        const melText = await melResp.text()
        if (!melResp.ok) {
          stats.errors += 1
          entry.error = `Tess Buddy verify failed (${melResp.status})`
        } else {
          let parsed
          try { parsed = JSON.parse(melText) } catch { parsed = null }
          const record  = parsed?.Records?.[0] || parsed || {}
          const verdict = stream.classify(record, row)
          entry.action    = verdict.action
          entry.corrected = stream.correctedValue(verdict)

          // Skip INCONCLUSIVE — we don't touch Tessitura on those
          if (verdict.action === 'INCONCLUSIVE') {
            stats.inconclusive += 1
          } else {
            const writeParams = stream.buildWriteParams(verdict, melText, row)
            const { ok, text: writeText } = await callProc(writeParams)
            entry.writeOk = ok
            if (!ok) {
              stats.errors += 1
              entry.error = 'Tessitura write failed: ' + (writeText || '').slice(0, 120)
            } else if (verdict.action === 'CLEAN') {
              stats.clean += 1
            } else if (verdict.action === 'CORRECTED') {
              stats.corrected += 1
            } else if (verdict.action === 'HARD_BOUNCE') {
              stats.hardBounce += 1
            }
          }
        }
      } catch (err) {
        stats.errors += 1
        entry.error = err.message
      }

      stats.processed += 1
      log.push(entry)
      setRunStats({ ...stats })
      setRunLog([...log])
    }

    setCurrentRow(null)
    setRunStage('done')
    setBusyBulk(false)
    setRunMessage(
      cancelRef.current
        ? { type: 'warn',    text: `Stopped after ${stats.processed} of ${stats.total} ${lower}${stats.processed === 1 ? '' : 's'}.` }
        : { type: 'success', text: `Done — screened ${stats.processed} ${lower}${stats.processed === 1 ? '' : 's'}.` }
    )
  }

  const handleCancelRun = () => {
    cancelRef.current = true
  }

  return (
    <div>
      <h2 style={styles.sectionHeading}>Screen a list of {lower}s</h2>
      <p style={styles.sectionBody}>
        Pick a list from Tessitura and we'll check every primary {lower} on it. Records that are
        already verified or marked inactive are skipped automatically, so you only check what needs
        checking.
      </p>
      <p style={styles.hint}>
        Haven't created your list yet? Do it{' '}
        <a
          href="https://spoletussc0webtest.tnhs.cloud/Tessitura/#/lists-and-templates/list-manager"
          target="_blank"
          rel="noopener noreferrer"
          style={styles.link}
        >
          in Tessitura
        </a>
        {' '}and return here.
      </p>

      {listsError && (
        <div style={{ ...styles.messageBox, backgroundColor: '#fff5f5', borderColor: '#feb2b2', color: '#c53030' }}>
          Couldn't load your Tessitura lists: {listsError}
        </div>
      )}

      <div style={styles.formRow}>
        <label style={styles.label}>Search by list name</label>
        <input
          type="text"
          value={searchText}
          onChange={(e) => { setSearchText(e.target.value); setListNo('') }}
          placeholder="Start typing to search all Tessitura lists..."
          style={styles.input}
          disabled={!!listsError}
        />
      </div>

      <div style={styles.formRow}>
        <label style={styles.label}>List category</label>
        <select
          value={selectedCategory}
          onChange={(e) => { setCategory(e.target.value); setListNo('') }}
          style={styles.input}
          disabled={loadingLists || !!listsError}
        >
          <option value="__ALL__">All categories</option>
          {categories.map((cat) => (
            <option key={cat.id} value={cat.id}>{cat.name}</option>
          ))}
        </select>
      </div>

      <div style={styles.formRow}>
        <label style={styles.label}>Tessitura list</label>
        <select
          value={listNo}
          onChange={(e) => setListNo(e.target.value)}
          style={styles.input}
          disabled={loadingLists || !!listsError || visibleLists.length === 0}
        >
          <option value="">
            {loadingLists
              ? 'Loading your lists...'
              : visibleLists.length === 0
                ? 'No lists found'
                : 'Choose a list'}
          </option>
          {visibleLists.map((l) => (
            <option key={l.id} value={l.id}>
              {l.name} (#{l.id})
            </option>
          ))}
        </select>
        <button
          style={{ ...styles.runButton, opacity: (!listNo || busyBulk) ? 0.5 : 1, cursor: (!listNo || busyBulk) ? 'not-allowed' : 'pointer' }}
          onClick={handleStartBulk}
          disabled={!listNo || busyBulk || runStage !== 'idle'}
        >
          {busyBulk && runStage === 'idle' ? 'Loading list...' : 'Start screening'}
        </button>
      </div>

      {runMessage && (
        <div style={{
          ...styles.messageBox,
          backgroundColor: runMessage.type === 'error' ? '#fff5f5' : runMessage.type === 'warn' ? '#fffbea' : '#f0fff4',
          borderColor:     runMessage.type === 'error' ? '#feb2b2' : runMessage.type === 'warn' ? '#f6e05e' : '#9ae6b4',
          color:           runMessage.type === 'error' ? '#c53030' : runMessage.type === 'warn' ? '#975a16' : '#276749'
        }}>
          {runMessage.text}
        </div>
      )}

      {/* Preview: show count, confirm before kicking off Melissa loop */}
      {runStage === 'previewing' && (
        <div style={styles.previewBox}>
          <h3 style={styles.previewHeading}>Ready to screen {previewRows.length} {lower}{previewRows.length === 1 ? '' : 's'}</h3>
          <p style={styles.sectionBody}>
            Tess Buddy will check every primary {lower} on this list, skip anything that was already verified
            recently, and update Tessitura for any record that comes back corrected or hard-bounced. You can
            stop partway through if you need to.
          </p>
          <div style={styles.buttonRow}>
            <button style={styles.runButton} onClick={handleConfirmRun}>Start screening</button>
            <button style={styles.secondaryButton} onClick={resetBulkFlow}>Back</button>
          </div>
        </div>
      )}

      {/* Running: live progress + counters + cancel */}
      {runStage === 'running' && runStats && (
        <div style={styles.previewBox}>
          <h3 style={styles.previewHeading}>
            Screening {runStats.processed} of {runStats.total}
          </h3>
          {currentRow && (
            <p style={styles.sectionBody}>
              Currently checking: <strong>{currentRow.sort_name}</strong> — {currentRow.original}
            </p>
          )}
          <div style={styles.progressBar}>
            <div style={{
              ...styles.progressFill,
              width: `${runStats.total === 0 ? 0 : Math.round((runStats.processed / runStats.total) * 100)}%`
            }} />
          </div>
          <BulkCounters stats={runStats} />
          <BulkLogTable log={runLog} live />
          <div style={styles.buttonRow}>
            <button style={styles.secondaryButton} onClick={handleCancelRun}>Stop</button>
          </div>
        </div>
      )}

      {/* Done: summary + reset */}
      {runStage === 'done' && runStats && (
        <div style={styles.previewBox}>
          <h3 style={styles.previewHeading}>Screening complete</h3>
          <BulkCounters stats={runStats} />
          <BulkLogTable log={runLog} />
          <div style={styles.buttonRow}>
            <button style={styles.runButton} onClick={resetBulkFlow}>Done</button>
          </div>
        </div>
      )}
    </div>
  )
}

// Small helper for the four-bucket counter row used in running + done states.
function BulkCounters({ stats }) {
  return (
    <div style={styles.counterRow}>
      <CounterPill label="Clean"        value={stats.clean}        color="#2f855a" />
      <CounterPill label="Corrected"    value={stats.corrected}    color="#1d6fdb" />
      <CounterPill label="Hard bounce"  value={stats.hardBounce}   color="#c53030" />
      <CounterPill label="Inconclusive" value={stats.inconclusive} color="#975a16" />
      {stats.errors > 0 && (
        <CounterPill label="Errors" value={stats.errors} color="#742a2a" />
      )}
    </div>
  )
}

function CounterPill({ label, value, color }) {
  return (
    <div style={{ ...styles.counterPill, borderColor: color, color }}>
      <div style={styles.counterValue}>{value}</div>
      <div style={styles.counterLabel}>{label}</div>
    </div>
  )
}

// Per-row detail table for the bulk run. Newest row at the top.
// When `live` is true (running state), only shows the most recent 25 rows
// so long runs don't bog down the DOM. When done, shows everything.
function BulkLogTable({ log, live = false }) {
  if (!log || log.length === 0) return null
  const rows = live ? log.slice(-25).reverse() : [...log].reverse()

  const actionColor = (action, writeOk, hasError) => {
    if (hasError)                 return '#742a2a'
    if (action === 'CLEAN')       return '#2f855a'
    if (action === 'CORRECTED')   return '#1d6fdb'
    if (action === 'HARD_BOUNCE') return '#c53030'
    if (action === 'INCONCLUSIVE')return '#975a16'
    return '#4a5568'
  }
  const actionLabel = (entry) => {
    if (entry.error)                        return 'Error'
    if (entry.action === 'CLEAN')           return 'Clean (verified)'
    if (entry.action === 'CORRECTED')       return 'Corrected'
    if (entry.action === 'HARD_BOUNCE')     return 'Hard bounce'
    if (entry.action === 'INCONCLUSIVE')    return 'Inconclusive (no change)'
    return '—'
  }

  return (
    <div style={styles.logWrap}>
      <div style={styles.logHeader}>
        {live ? `Latest results (${log.length} processed so far)` : `Per-row results (${log.length} total)`}
      </div>
      <div style={styles.logScroll}>
        <table style={styles.logTable}>
          <thead>
            <tr>
              <th style={styles.logTh}>Status</th>
              <th style={styles.logTh}>Customer</th>
              <th style={styles.logTh}>Original value</th>
              <th style={styles.logTh}>Corrected value</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((entry, i) => (
              <tr key={`${entry.customer_no}-${i}`} style={styles.logRow}>
                <td style={styles.logTd}>
                  <span style={{
                    ...styles.logPill,
                    color: actionColor(entry.action, entry.writeOk, !!entry.error),
                    borderColor: actionColor(entry.action, entry.writeOk, !!entry.error)
                  }}>
                    {actionLabel(entry)}
                  </span>
                </td>
                <td style={styles.logTd}>
                  <div style={styles.logName}>{entry.sort_name}</div>
                  <div style={styles.logMuted}>#{entry.customer_no}</div>
                </td>
                <td style={{ ...styles.logTd, ...styles.logMono }}>{entry.original}</td>
                <td style={{ ...styles.logTd, ...styles.logMono }}>
                  {entry.corrected || (entry.error ? <span style={styles.logMuted}>{entry.error}</span> : '—')}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ---------- Singular tab (single customer, dropdown for stream) ----------
//
// Email flow, end-to-end:
//   1. PULL    kognative_CONTACT_SCREEN @mode=EMAIL_PULL   @customer_no=...
//   2. VERIFY  /api/melissa POST { email }
//   3. Client-side classify -> CLEAN | CORRECTED | HARD_BOUNCE | INCONCLUSIVE
//   4. APPLY   kognative_CONTACT_SCREEN @mode=EMAIL_WRITE  @customer_no, @result,
//                                                          @new_email (corrected only),
//                                                          @melissa_code (raw response JSON)

function SingularTab({ orgData }) {
  const [contactType, setContactType] = useState('email')
  const [customerNo, setCustomerNo]   = useState('')

  // Email flow state
  const [stage, setStage]                   = useState('idle')   // idle | pulled | verified | applied
  const [pulled, setPulled]                 = useState(null)     // { sort_name, customer_no, email }
  const [melissaRecord, setMelissaRecord]   = useState(null)     // first Records[] entry
  const [melissaRawText, setMelissaRawText] = useState(null)     // verbatim JSON string
  const [classification, setClassification] = useState(null)     // { action, newEmail, score, codes }
  const [summary, setSummary]               = useState(null)     // row returned by EMAIL_WRITE
  const [busy, setBusy]                     = useState(false)
  const [message, setMessage]               = useState(null)     // { type, text }

  const headers = {
    'x-tessitura-auth': orgData?.organizations?.tessitura_auth_string,
    'x-tessitura-url':  orgData?.organizations?.tessitura_base_url,
    'Content-Type':     'application/json'
  }

  const callProc = async (parameterValues) => {
    const body = {
      ProcedureId:     CONTACT_SCREEN_PROC.id,
      ProcedureName:   CONTACT_SCREEN_PROC.name,
      ParameterValues: parameterValues
    }
    const response = await fetch(`/api/tessitura?endpoint=Custom/Execute`, {
      method:  'POST',
      headers,
      body:    JSON.stringify(body)
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

  const resetFlow = () => {
    setStage('idle')
    setPulled(null)
    setMelissaRecord(null)
    setMelissaRawText(null)
    setClassification(null)
    setSummary(null)
    setMessage(null)
  }

  // Per-stream config for the three contact types. Centralizes the mode
  // names, Melissa endpoints, classifiers, and display labels so the flow
  // is identical for email / phone / address — only the data shape changes.
  const STREAM_CONFIG = {
    email: {
      label:       'email',
      pullMode:    'EMAIL_PULL',
      writeMode:   'EMAIL_WRITE',
      verifyPath:  '/api/melissa',
      pulledField: 'Primary email',
      buttonLabel: 'Look up email',
      emptyMessage: "No primary email on file for that customer — or it was already verified recently.",
      renderPulledValue: (row) => row.email,
      buildVerifyBody:   (row) => ({ email: row.email }),
      classify:          (record, row) => classifyMelissaEmail(record, row.email),
      buildWriteParams:  (verdict, raw) => {
        const params = [{ Name: '@melissa_code', Value: raw || '' }]
        if (verdict.action === 'CORRECTED' && verdict.newEmail) {
          params.push({ Name: '@new_email', Value: verdict.newEmail })
        }
        return params
      },
      renderCorrection: (verdict) => (
        <div style={styles.kvRow}>
          <span style={styles.kvKey}>Suggested email</span>
          <span style={{ ...styles.kvVal, color: '#1d6fdb', fontWeight: 700 }}>{verdict.newEmail}</span>
        </div>
      )
    },
    phone: {
      label:       'phone',
      pullMode:    'PHONE_PULL',
      writeMode:   'PHONE_WRITE',
      verifyPath:  '/api/melissa-phone',
      pulledField: 'Primary phone',
      buttonLabel: 'Look up phone',
      emptyMessage: "No primary phone on file for that customer — or it was already verified recently.",
      renderPulledValue: (row) => row.extension ? `${row.phone} x${row.extension}` : row.phone,
      buildVerifyBody:   (row) => ({ phone: row.phone, country: 'US' }),
      classify:          (record, row) => classifyMelissaPhone(record, row.phone),
      buildWriteParams:  (verdict, raw) => {
        const params = [{ Name: '@melissa_code', Value: raw || '' }]
        if (verdict.action === 'CORRECTED' && verdict.newPhone) {
          params.push({ Name: '@new_phone', Value: verdict.newPhone })
        }
        return params
      },
      renderCorrection: (verdict) => (
        <div style={styles.kvRow}>
          <span style={styles.kvKey}>Suggested phone</span>
          <span style={{ ...styles.kvVal, color: '#1d6fdb', fontWeight: 700 }}>{verdict.newPhone}</span>
        </div>
      )
    },
    address: {
      label:       'address',
      pullMode:    'ADDRESS_PULL',
      writeMode:   'ADDRESS_WRITE',
      verifyPath:  '/api/melissa-address',
      pulledField: 'Primary address',
      buttonLabel: 'Look up address',
      emptyMessage: "No primary address on file for that customer — or it was already verified recently.",
      // Omit row.country from display — it's an INT FK, not a label.
      renderPulledValue: (row) => [
        row.street1,
        row.street2,
        [row.city, row.state].filter(Boolean).join(', '),
        row.postal_code
      ].filter(Boolean).join(' · '),
      // T_ADDRESS.country is an INT FK to TR_COUNTRY — not an ISO2
      // string. Always send 'US' to Melissa since Spoleto is US-based.
      buildVerifyBody:   (row) => ({
        street1: row.street1 || '',
        street2: row.street2 || '',
        city:    row.city    || '',
        state:   row.state   || '',
        postal:  row.postal_code || '',
        country: 'US'
      }),
      classify:          (record, row) => classifyMelissaAddress(record, {
        street1: row.street1,
        city:    row.city,
        state:   row.state,
        postal:  row.postal_code
      }),
      buildWriteParams:  (verdict, raw) => {
        const params = [{ Name: '@melissa_code', Value: raw || '' }]
        if (verdict.action === 'CORRECTED' && verdict.newAddress) {
          const a = verdict.newAddress
          if (a.street1) params.push({ Name: '@new_street1', Value: a.street1 })
          if (a.street2) params.push({ Name: '@new_street2', Value: a.street2 })
          if (a.city)    params.push({ Name: '@new_city',    Value: a.city })
          if (a.state)   params.push({ Name: '@new_state',   Value: a.state })
          if (a.postal)  params.push({ Name: '@new_postal',  Value: a.postal })
          if (a.country) params.push({ Name: '@new_country', Value: a.country })
        }
        return params
      },
      renderCorrection: (verdict) => {
        const a = verdict.newAddress || {}
        const line = [
          a.street1,
          a.street2,
          [a.city, a.state].filter(Boolean).join(', '),
          a.postal,
          a.country
        ].filter(Boolean).join(' · ')
        return (
          <div style={styles.kvRow}>
            <span style={styles.kvKey}>Suggested address</span>
            <span style={{ ...styles.kvVal, color: '#1d6fdb', fontWeight: 700 }}>{line}</span>
          </div>
        )
      }
    }
  }
  const cfg = STREAM_CONFIG[contactType]

  // Step 1: {EMAIL|PHONE|ADDRESS}_PULL
  const handlePull = async () => {
    if (!customerNo) return
    resetFlow()
    setBusy(true)
    try {
      const { ok, text } = await callProc([
        { Name: '@mode',        Value: cfg.pullMode },
        { Name: '@customer_no', Value: String(customerNo) }
      ])
      if (!ok) {
        setMessage({ type: 'error', text: "Couldn't look up that customer. Double-check the customer number and try again." })
        setBusy(false)
        return
      }
      const rows = parseRows(text)
      if (rows.length === 0) {
        setMessage({ type: 'error', text: cfg.emptyMessage })
        setBusy(false)
        return
      }
      setPulled(rows[0])
      setStage('pulled')
      setMessage({ type: 'success', text: `Found ${rows[0].sort_name}'s primary ${cfg.label}. Click "Verify with Tess Buddy" to continue.` })
    } catch (err) {
      setMessage({ type: 'error', text: 'Error: ' + err.message })
    }
    setBusy(false)
  }

  // Step 2: Tess Buddy verify + classify
  const handleVerify = async () => {
    if (!pulled) return
    setBusy(true)
    setMessage(null)
    try {
      const response = await fetch(cfg.verifyPath, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(cfg.buildVerifyBody(pulled))
      })
      const text = await response.text()
      if (!response.ok) {
        setMessage({ type: 'error', text: 'Tess Buddy verification failed: ' + text.slice(0, 200) })
        setBusy(false)
        return
      }

      let parsed
      try { parsed = JSON.parse(text) } catch { parsed = null }
      const record = parsed?.Records?.[0] || parsed || {}

      setMelissaRawText(text)
      setMelissaRecord(record)
      const verdict = cfg.classify(record, pulled)
      setClassification(verdict)
      setStage('verified')

      if (verdict.action === 'INCONCLUSIVE') {
        setMessage({ type: 'warn', text: "Result was inconclusive — nothing will be updated in Tessitura." })
      } else {
        setMessage({ type: 'success', text: `Result: ${verdict.action}. Review below, then click "Update in Tessitura" to apply.` })
      }
    } catch (err) {
      setMessage({ type: 'error', text: 'Error: ' + err.message })
    }
    setBusy(false)
  }

  // Step 3: {EMAIL|PHONE|ADDRESS}_WRITE
  const handleApply = async () => {
    if (!classification || classification.action === 'INCONCLUSIVE') return
    setBusy(true)
    setMessage(null)
    try {
      const params = [
        { Name: '@mode',         Value: cfg.writeMode },
        { Name: '@customer_no',  Value: String(customerNo) },
        { Name: '@result',       Value: classification.action },
        ...cfg.buildWriteParams(classification, melissaRawText)
      ]

      const { ok, text } = await callProc(params)
      if (!ok) {
        setMessage({ type: 'error', text: "Update didn't go through: " + text.slice(0, 200) })
        setBusy(false)
        return
      }
      const rows = parseRows(text)
      setSummary(rows[0] || null)
      setStage('applied')
      setMessage({ type: 'success', text: 'Updated in Tessitura. See summary below.' })
    } catch (err) {
      setMessage({ type: 'error', text: 'Error: ' + err.message })
    }
    setBusy(false)
  }

  const verdictColor = (action) => {
    if (action === 'CLEAN')        return '#2f855a'
    if (action === 'CORRECTED')    return '#1d6fdb'
    if (action === 'HARD_BOUNCE')  return '#c53030'
    return '#888' // INCONCLUSIVE
  }

  const messageBox = (m) => {
    if (!m) return null
    const bg = m.type === 'error' ? '#fff5f5' : m.type === 'warn' ? '#fffaf0' : '#f0fff4'
    const bd = m.type === 'error' ? '#feb2b2' : m.type === 'warn' ? '#fbd38d' : '#9ae6b4'
    const fg = m.type === 'error' ? '#c53030' : m.type === 'warn' ? '#975a16' : '#2f855a'
    return (
      <div style={{ ...styles.messageBox, backgroundColor: bg, borderColor: bd, color: fg }}>
        {m.text}
      </div>
    )
  }

  return (
    <div>
      <h2 style={styles.sectionHeading}>Screen one constituent</h2>
      <p style={styles.sectionBody}>
        Check a single constituent by customer number. Great for spot-checking one person or testing
        the workflow before you run a full list.
      </p>

      <div style={styles.formRow}>
        <label style={styles.label}>Contact point type</label>
        <select
          value={contactType}
          onChange={(e) => { setContactType(e.target.value); resetFlow() }}
          style={styles.input}
        >
          {CONTACT_TYPES.map((t) => (
            <option key={t.value} value={t.value}>{t.label}</option>
          ))}
        </select>
      </div>

      <div style={styles.formRow}>
        <label style={styles.label}>Customer number</label>
        <input
          type="number"
          value={customerNo}
          onChange={(e) => setCustomerNo(e.target.value)}
          placeholder="e.g. 987654"
          style={styles.input}
          disabled={busy}
        />
        <button
          style={{ ...styles.runButton, opacity: (!customerNo || busy) ? 0.5 : 1, cursor: (!customerNo || busy) ? 'not-allowed' : 'pointer' }}
          onClick={handlePull}
          disabled={!customerNo || busy}
        >
          {busy && stage === 'idle' ? 'Looking up...' : cfg.buttonLabel}
        </button>
      </div>

      {messageBox(message)}

          {/* Pulled record card */}
          {pulled && (
            <div style={styles.stepCard}>
              <p style={styles.stepHeader}>1. Found in Tessitura</p>
              <div style={styles.kvRow}><span style={styles.kvKey}>Name</span><span style={styles.kvVal}>{pulled.sort_name}</span></div>
              <div style={styles.kvRow}><span style={styles.kvKey}>Customer #</span><span style={styles.kvVal}>{pulled.customer_no}</span></div>
              <div style={styles.kvRow}><span style={styles.kvKey}>{cfg.pulledField}</span><span style={styles.kvVal}>{cfg.renderPulledValue(pulled)}</span></div>

              {stage === 'pulled' && (
                <button
                  style={{ ...styles.runButton, marginTop: '16px', opacity: busy ? 0.5 : 1, cursor: busy ? 'not-allowed' : 'pointer' }}
                  onClick={handleVerify}
                  disabled={busy}
                >
                  {busy ? 'Verifying...' : 'Verify with Tess Buddy'}
                </button>
              )}
            </div>
          )}

          {/* Verification result card */}
          {melissaRecord && classification && (
            <div style={styles.stepCard}>
              <p style={styles.stepHeader}>2. Verification result</p>
              <div style={styles.kvRow}>
                <span style={styles.kvKey}>Classification</span>
                <span style={{ ...styles.kvVal, color: verdictColor(classification.action), fontWeight: 700 }}>
                  {classification.action}
                </span>
              </div>
              <div style={styles.kvRow}>
                <span style={styles.kvKey}>Confidence score</span>
                <span style={styles.kvVal}>{classification.score ?? '—'}</span>
              </div>
              <div style={styles.kvRow}>
                <span style={styles.kvKey}>Result codes</span>
                <span style={styles.kvVal}>{classification.codes.join(', ') || '—'}</span>
              </div>
              {classification.action === 'CORRECTED' && cfg.renderCorrection(classification)}

              {stage === 'verified' && (
                <button
                  style={{
                    ...styles.runButton,
                    marginTop: '16px',
                    backgroundColor: classification.action === 'HARD_BOUNCE' ? '#c53030' : '#0c1a33',
                    opacity: (busy || classification.action === 'INCONCLUSIVE') ? 0.5 : 1,
                    cursor: (busy || classification.action === 'INCONCLUSIVE') ? 'not-allowed' : 'pointer'
                  }}
                  onClick={handleApply}
                  disabled={busy || classification.action === 'INCONCLUSIVE'}
                >
                  {busy
                    ? 'Updating...'
                    : classification.action === 'INCONCLUSIVE'
                      ? 'No action (inconclusive)'
                      : 'Update in Tessitura'}
                </button>
              )}
            </div>
          )}

          {/* Post-write summary */}
          {summary && (
            <div style={styles.stepCard}>
              <p style={styles.stepHeader}>3. Summary</p>
              <div style={styles.kvRow}><span style={styles.kvKey}>Name</span><span style={styles.kvVal}>{summary.sort_name}</span></div>
              <div style={styles.kvRow}><span style={styles.kvKey}>Customer #</span><span style={styles.kvVal}>{summary.customer_no}</span></div>
              <div style={styles.kvRow}>
                <span style={styles.kvKey}>Action taken</span>
                <span style={{ ...styles.kvVal, fontWeight: 700 }}>{summary.action_taken}</span>
              </div>
              <button style={{ ...styles.runButton, marginTop: '16px', backgroundColor: '#4a5568' }} onClick={() => { setCustomerNo(''); resetFlow() }}>
                Check another constituent
              </button>
            </div>
          )}

      {!pulled && !melissaRecord && !summary && (
        <ResultsGridPlaceholder singleRow />
      )}
    </div>
  )
}

// ---------- Shared placeholder for results ----------

function ResultsGridPlaceholder({ singleRow = false }) {
  return (
    <div style={styles.resultsBox}>
      <p style={styles.resultsHeader}>Results</p>
      <p style={styles.resultsEmpty}>
        {singleRow
          ? 'Results for this customer will show up here once you run a check.'
          : 'Results will show up here — each record that was updated in Tessitura.'}
      </p>
    </div>
  )
}

// ---------- Tab button ----------

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

const styles = {
  header: { marginBottom: '24px' },
  title: { fontSize: '24px', fontWeight: '700', color: '#0c1a33', marginBottom: '4px' },
  subtitle: { fontSize: '13px', color: '#4b5563', maxWidth: '640px', lineHeight: '1.6' },

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

  panel: { backgroundColor: 'white', borderRadius: '12px', padding: '28px', boxShadow: '0 2px 16px rgba(29,111,219,0.08)', border: '1px solid rgba(29,111,219,0.1)', maxWidth: '860px' },
  sectionHeading: { fontSize: '16px', fontWeight: '700', color: '#0c1a33', marginBottom: '6px' },
  sectionBody: { fontSize: '13px', color: '#4b5563', lineHeight: '1.6', marginBottom: '12px', maxWidth: '640px' },
  hint: {
    fontSize: '12px', color: '#4a5568', lineHeight: '1.6',
    marginTop: '0', marginBottom: '20px', maxWidth: '640px',
    padding: '10px 14px', backgroundColor: '#f0f7ff',
    borderLeft: '3px solid #1d6fdb', borderRadius: '4px'
  },
  link: { color: '#1d6fdb', textDecoration: 'underline', fontWeight: '600' },

  formRow: { display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px', flexWrap: 'wrap' },
  label: { fontSize: '12px', fontWeight: '700', color: '#4b5563', textTransform: 'uppercase', letterSpacing: '0.5px', minWidth: '160px' },
  input: {
    padding: '8px 12px', fontSize: '14px', borderRadius: '8px',
    border: '1px solid #d0d4db', minWidth: '200px', outline: 'none'
  },
  runButton: {
    padding: '9px 18px', backgroundColor: '#0c1a33', color: 'white',
    border: 'none', borderRadius: '8px', fontSize: '14px', fontWeight: '600', cursor: 'pointer'
  },
  secondaryButton: {
    padding: '9px 18px', backgroundColor: 'white', color: '#0c1a33',
    border: '1px solid #d0d4db', borderRadius: '8px', fontSize: '14px', fontWeight: '600', cursor: 'pointer'
  },
  buttonRow: { display: 'flex', gap: '12px', marginTop: '16px' },

  // --- Bulk run preview / progress / done ---
  previewBox: {
    marginTop: '24px', padding: '20px', backgroundColor: 'white',
    borderRadius: '10px', border: '1px solid rgba(29,111,219,0.12)', boxShadow: '0 1px 4px rgba(0,0,0,0.04)'
  },
  previewHeading: { fontSize: '16px', fontWeight: '700', color: '#0c1a33', margin: '0 0 8px 0' },
  progressBar: {
    marginTop: '12px', height: '10px', width: '100%',
    backgroundColor: '#edf0f5', borderRadius: '6px', overflow: 'hidden'
  },
  progressFill: {
    height: '100%', backgroundColor: '#0c1a33',
    transition: 'width 200ms linear'
  },
  counterRow: {
    display: 'flex', flexWrap: 'wrap', gap: '10px', marginTop: '16px'
  },
  counterPill: {
    padding: '10px 16px', borderRadius: '8px', border: '1.5px solid',
    backgroundColor: 'white', minWidth: '90px', textAlign: 'center'
  },
  counterValue: { fontSize: '22px', fontWeight: '700', lineHeight: 1 },
  counterLabel: { fontSize: '11px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.4px', marginTop: '4px' },

  // --- Bulk run per-row log table ---
  logWrap:   { marginTop: '20px' },
  logHeader: { fontSize: '11px', fontWeight: '700', color: '#4b5563', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '8px' },
  logScroll: {
    maxHeight: '320px', overflowY: 'auto',
    border: '1px solid rgba(29,111,219,0.12)', borderRadius: '8px', backgroundColor: 'white'
  },
  logTable:  { width: '100%', borderCollapse: 'collapse', fontSize: '12px' },
  logTh:     {
    position: 'sticky', top: 0, backgroundColor: '#f0f7ff',
    textAlign: 'left', padding: '8px 12px', fontSize: '11px',
    fontWeight: '700', color: '#4b5563', textTransform: 'uppercase',
    letterSpacing: '0.4px', borderBottom: '1px solid rgba(29,111,219,0.15)'
  },
  logRow:    { borderBottom: '1px solid #f2f4f7' },
  logTd:     { padding: '8px 12px', verticalAlign: 'top' },
  logPill:   {
    display: 'inline-block', padding: '2px 8px', borderRadius: '12px',
    border: '1px solid', fontSize: '11px', fontWeight: '600', whiteSpace: 'nowrap'
  },
  logName:   { fontWeight: '600', color: '#0c1a33' },
  logMuted:  { fontSize: '11px', color: '#4b5563' },
  logMono:   { fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', wordBreak: 'break-all' },

  resultsBox: {
    marginTop: '24px', padding: '20px', backgroundColor: '#f0f7ff',
    borderRadius: '8px', border: '1px dashed #d0d4db'
  },
  resultsHeader: { fontSize: '12px', fontWeight: '700', color: '#4b5563', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '8px' },
  resultsEmpty: { fontSize: '13px', color: '#4b5563', margin: 0 },

  // --- Singular email flow ---
  messageBox: {
    padding: '12px 16px', borderRadius: '8px', border: '1px solid',
    fontSize: '13px', marginTop: '16px', marginBottom: '8px'
  },
  stepCard: {
    marginTop: '20px', padding: '20px',
    backgroundColor: 'white', borderRadius: '10px',
    border: '1px solid rgba(29,111,219,0.12)', boxShadow: '0 1px 4px rgba(0,0,0,0.04)'
  },
  stepHeader: {
    fontSize: '11px', fontWeight: '700', color: '#4b5563',
    textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: '12px'
  },
  kvRow: {
    display: 'flex', alignItems: 'center', gap: '12px',
    padding: '6px 0', borderBottom: '1px solid #f2f4f7'
  },
  kvKey: {
    fontSize: '12px', fontWeight: '600', color: '#4b5563',
    textTransform: 'uppercase', letterSpacing: '0.4px', minWidth: '160px'
  },
  kvVal: { fontSize: '13px', color: '#0c1a33', wordBreak: 'break-word' },
  detailsSummary: { fontSize: '12px', color: '#1d6fdb', cursor: 'pointer' },
  pre: {
    marginTop: '8px', padding: '12px', backgroundColor: '#f0f7ff',
    borderRadius: '6px', border: '1px solid rgba(29,111,219,0.12)',
    fontSize: '11px', color: '#333', maxHeight: '240px', overflow: 'auto',
    whiteSpace: 'pre-wrap', wordBreak: 'break-word'
  }
}

export default Screening
